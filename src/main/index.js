'use strict';

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const Analytics = require('./analytics');
const Updater = require('./updater');

const store = new Store();

let mainWindow = null;
let analytics = null;
let updater = null;
const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Miaoda - Claude Code Manager',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // 在开发模式下打开控制台输出
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('窗口加载完成');
  });
  
  // 监听渲染进程的控制台消息
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`渲染进程日志 [${level}]: ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Miaoda',
      submenu: [
        {
          label: '关于 Miaoda',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于 Miaoda',
              message: 'Miaoda - Claude Code Manager',
              detail: `专业的 Claude Code 部署和管理工具\n版本: ${app.getVersion()}`,
              buttons: ['确定']
            });
          }
        },
        {
          label: '检查更新...',
          click: () => {
            if (updater) {
              updater.checkForUpdates(false);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 添加一个简单的 IPC 测试
ipcMain.handle('test-ipc', async () => {
  console.log('IPC 测试成功');
  return { success: true, message: 'IPC 通信正常' };
});

app.whenReady().then(() => {
  createWindow();
  
  // 初始化数据统计
  analytics = new Analytics();
  analytics.startSession();
  analytics.trackPageView('main');
  analytics.setupAutoUpload();
  
  // 初始化自动更新
  updater = new Updater(mainWindow);
  updater.setupAutoCheck();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 结束会话统计
  if (analytics) {
    analytics.endSession();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前上报数据
app.on('before-quit', async (event) => {
  if (analytics && !analytics.hasUploaded) {
    event.preventDefault();
    analytics.hasUploaded = true;
    
    try {
      await analytics.uploadReports();
    } catch (error) {
      console.error('退出前上报数据失败:', error);
    }
    
    app.quit();
  }
});

ipcMain.handle('get-configs', async () => {
  return store.get('configs', []);
});

ipcMain.handle('save-config', async (event, config) => {
  const configs = store.get('configs', []);
  const index = configs.findIndex(c => c.id === config.id);
  
  if (index >= 0) {
    configs[index] = config;
  } else {
    configs.push(config);
  }
  
  store.set('configs', configs);
  return { success: true };
});

ipcMain.handle('delete-config', async (event, configId) => {
  const configs = store.get('configs', []);
  const filteredConfigs = configs.filter(c => c.id !== configId);
  store.set('configs', filteredConfigs);
  return { success: true };
});

ipcMain.handle('check-environment', async () => {
  console.log('接收到环境检查请求');
  try {
    const { checkEnvironment } = require('./environment');
    const result = await checkEnvironment();
    console.log('环境检查结果:', result);
    return result;
  } catch (error) {
    console.error('环境检查出错:', error);
    throw error;
  }
});

ipcMain.handle('install-dependency', async (event, dependency) => {
  const { installDependency } = require('./installer');
  return await installDependency(dependency);
});

ipcMain.handle('start-claude-code', async (event, config) => {
  const { startClaudeCode } = require('./claude-runner');
  return await startClaudeCode(config, mainWindow);
});

ipcMain.handle('stop-claude-code', async () => {
  const { stopClaudeCode } = require('./claude-runner');
  await stopClaudeCode();
  return { success: true };
});

ipcMain.on('terminal-input', (event, data) => {
  const { sendInputToClaudeCode } = require('./claude-runner');
  sendInputToClaudeCode(data);
});

// 数据统计相关的IPC处理器
ipcMain.on('track-page-view', (event, pageName) => {
  if (analytics) {
    analytics.trackPageView(pageName);
  }
});

ipcMain.on('track-feature-use', (event, featureName) => {
  if (analytics) {
    analytics.trackFeatureUse(featureName);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (mainWindow) {
    mainWindow.webContents.send('status-update', {
      message: `错误: ${error.message}`
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (mainWindow) {
    mainWindow.webContents.send('status-update', {
      message: `未处理的错误: ${reason}`
    });
  }
});