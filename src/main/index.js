'use strict';

const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
// const Store = require('electron-store'); // 暂时禁用

// 服务
const ipcController = require('./services/ipc-controller-simple');
const PtySessionManager = require('./pty-session-manager');
const errorHandler = require('./error-handler');
const Analytics = require('./analytics');
const Updater = require('./updater');
const analyticsIntegration = require('./services/analytics-integration');

// 全局变量
let mainWindow = null;
let tray = null;
let ptySessionManager = null;
let analytics = null;
let updater = null;
// const store = new Store(); // 暂时禁用

// 防止多实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * 创建主窗口
 */
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Miaoda - Claude Code Manager',
    icon: path.join(__dirname, '../../assets/icon.png'),
    // frame: false, // 暂时启用边框
    // titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  // 加载应用
  const htmlPath = path.join(__dirname, '../renderer/app-full.html');
  mainWindow.loadFile(htmlPath);
  
  // 开发模式打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 初始化 IPC 控制器
  ipcController.initialize(mainWindow);
  
  // 初始化错误处理器
  errorHandler.initialize(mainWindow);
  
  // 初始化统计分析
  analytics = new Analytics();
  analytics.startSession();
  analytics.trackPageView('app_start');
  analytics.setupAutoUpload();
  
  // 初始化统计集成
  analyticsIntegration.initialize(analytics);
  
  // 初始化更新检查
  updater = new Updater(mainWindow);
  updater.setupAutoCheck();

  // 窗口关闭处理
  mainWindow.on('close', () => {
    // 允许直接关闭窗口
    // 不阻止关闭事件
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: '启动 Claude',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('tray:start-claude');
        }
      }
    },
    {
      label: '停止 Claude',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('tray:stop-claude');
        }
      }
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        if (updater) {
          updater.checkForUpdates(false);
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Miaoda - Claude Code Manager');
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

/**
 * 应用准备就绪
 */
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // 初始化多会话 PTY 管理器
  ptySessionManager = new PtySessionManager();
  ptySessionManager.initialize(mainWindow);
  
  // 注册 PTY 相关的 IPC 处理器
  ipcMain.handle('pty:create', async (event, options) => {
    return await ptySessionManager.createSession(options);
  });
  
  ipcMain.on('pty:write', (event, sessionId, data) => {
    ptySessionManager.write(sessionId, data);
  });
  
  ipcMain.on('pty:resize', (event, sessionId, cols, rows) => {
    ptySessionManager.resize(sessionId, cols, rows);
  });
  
  ipcMain.handle('pty:kill', async (event, sessionId) => {
    const result = ptySessionManager.kill(sessionId);
    return { success: result };
  });
  
  ipcMain.handle('pty:kill-all', async () => {
    ptySessionManager.killAll();
    return { success: true };
  });
  
  ipcMain.handle('pty:get-sessions', async () => {
    return ptySessionManager.getAllSessions();
  });
  
  // macOS 特殊处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

/**
 * 所有窗口关闭时
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前
 */
app.on('before-quit', () => {
  // 结束统计会话
  if (analytics) {
    analytics.endSession();
    analytics.uploadReports().catch(err => {
      console.error('上报统计数据失败:', err);
    });
  }
  
  // 清理资源
  ipcController.cleanup();
  if (ptySessionManager) {
    ptySessionManager.cleanup();
  }
});

/**
 * 处理协议
 */
app.setAsDefaultProtocolClient('miaoda');

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('protocol:url', url);
  }
});

/**
 * 错误处理 - 由全局错误处理器统一管理
 */
// 错误处理器已经注册了全局错误处理
// 可以添加额外的错误处理 IPC
ipcMain.handle('error:report', async () => {
  return await errorHandler.createErrorReport();
});

ipcMain.handle('error:get-recent', async (event, count) => {
  return await errorHandler.getRecentErrors(count);
});