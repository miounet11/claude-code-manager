'use strict';

const { app, BrowserWindow, ipcMain, Menu, Tray, shell } = require('electron');
const path = require('path');
const windowsEnv = require('./services/windows-env');
const ConPTYManager = require('./services/conpty');
const store = require('electron-store');

// Windows 特定设置
if (process.platform === 'win32') {
  // 设置应用 ID (Windows 7+)
  app.setAppUserModelId('com.miaoda.app.windows');
}

// 全局变量
let mainWindow = null;
let tray = null;
const conptyManager = new ConPTYManager();
const configStore = new store({ name: 'miaoda-config' });

/**
 * 创建主窗口
 */
function createWindow() {
  // Windows 风格的窗口配置
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Miaoda for Windows',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    frame: true, // Windows 使用原生标题栏
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/windows-api.js')
    }
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index-dev.html'));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Windows 特定的窗口事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 防止窗口标题被修改
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/icon.ico'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '启动 Claude',
      click: () => {
        mainWindow?.webContents.send('tray:start-claude');
      }
    },
    {
      label: '停止 Claude',
      click: () => {
        mainWindow?.webContents.send('tray:stop-claude');
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        mainWindow?.webContents.send('tray:open-settings');
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Miaoda - AI Service Bridge');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * 注册 IPC 处理器
 */
function registerIPCHandlers() {
  // 环境检测
  ipcMain.handle('env:check', async () => {
    return await windowsEnv.checkAll();
  });

  ipcMain.handle('env:install', async (event, dependency) => {
    return await windowsEnv.installDependency(dependency);
  });

  // 终端管理
  ipcMain.handle('terminal:create', async (event, options) => {
    return conptyManager.createSession(options);
  });

  ipcMain.on('terminal:write', (event, sessionId, data) => {
    try {
      conptyManager.write(sessionId, data);
    } catch (error) {
      event.reply('terminal:error', sessionId, error.message);
    }
  });

  ipcMain.on('terminal:resize', (event, sessionId, cols, rows) => {
    conptyManager.resize(sessionId, cols, rows);
  });

  ipcMain.handle('terminal:close', async (event, sessionId) => {
    conptyManager.closeSession(sessionId);
    return { success: true };
  });

  ipcMain.handle('terminal:list', async () => {
    return conptyManager.getAllSessions();
  });

  // ConPTY 事件转发
  conptyManager.on('data', (sessionId, data) => {
    mainWindow?.webContents.send('terminal:data', sessionId, data);
  });

  conptyManager.on('exit', (sessionId, exitCode, signal) => {
    mainWindow?.webContents.send('terminal:exit', sessionId, exitCode, signal);
  });

  // Claude 管理
  ipcMain.handle('claude:start', async (event, config) => {
    return await conptyManager.executeClaude(config);
  });

  // 配置管理
  ipcMain.handle('config:get-all', async () => {
    const configs = configStore.get('configs', []);
    if (configs.length === 0) {
      // 默认配置
      const defaultConfigs = [
        {
          id: 'default',
          name: '默认配置',
          apiKey: '',
          apiUrl: 'http://localhost:8118',
          model: 'claude-3-7-sonnet-20250219',
          proxy: ''
        }
      ];
      configStore.set('configs', defaultConfigs);
      return defaultConfigs;
    }
    return configs;
  });

  ipcMain.handle('config:save', async (event, config) => {
    const configs = configStore.get('configs', []);
    const index = configs.findIndex(c => c.id === config.id);
    
    if (index >= 0) {
      configs[index] = config;
    } else {
      configs.push(config);
    }
    
    configStore.set('configs', configs);
    return { success: true };
  });

  ipcMain.handle('config:delete', async (event, configId) => {
    const configs = configStore.get('configs', []);
    const filtered = configs.filter(c => c.id !== configId);
    configStore.set('configs', filtered);
    return { success: true };
  });

  ipcMain.handle('config:get-current', async () => {
    const currentId = configStore.get('currentConfigId');
    const configs = configStore.get('configs', []);
    return configs.find(c => c.id === currentId) || configs[0] || null;
  });

  ipcMain.handle('config:set-current', async (event, configId) => {
    configStore.set('currentConfigId', configId);
    return { success: true };
  });

  // 系统操作
  ipcMain.handle('system:open-external', async (event, url) => {
    shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('system:show-item-in-folder', async (event, fullPath) => {
    shell.showItemInFolder(fullPath);
    return { success: true };
  });

  // 应用信息
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}

/**
 * 应用初始化
 */
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIPCHandlers();

  // Windows 特定：单实例锁
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      // 如果用户尝试打开第二个实例，聚焦到第一个实例的窗口
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
});

/**
 * 应用事件处理
 */
app.on('window-all-closed', () => {
  // Windows 下不退出应用，保持在系统托盘
  if (process.platform === 'win32') {
    // 隐藏到托盘而不是退出
    if (tray) {
      mainWindow = null;
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // 清理资源
  conptyManager.cleanup();
});

// Windows 特定：处理深度链接
app.setAsDefaultProtocolClient('miaoda');

app.on('open-url', (event, url) => {
  event.preventDefault();
  // 处理 miaoda:// 协议
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});