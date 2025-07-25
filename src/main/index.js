'use strict';

const { app, BrowserWindow, Menu, Tray, dialog, ipcMain } = require('electron');
const path = require('path');
// const Store = require('electron-store'); // 暂时禁用

// 服务
const ipcController = require('./services/ipc-controller-simple');
const PtyManager = require('./pty-manager');

// 全局变量
let mainWindow = null;
let tray = null;
let ptyManager = null;
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

  // 窗口关闭处理
  mainWindow.on('close', (event) => {
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
  
  // 初始化 PTY 管理器
  ptyManager = new PtyManager();
  ptyManager.initialize(mainWindow);
  
  // 注册 PTY 相关的 IPC 处理器
  ipcMain.handle('pty:create', async (event, options) => {
    return await ptyManager.createPtyProcess(options);
  });
  
  ipcMain.on('pty:write', (event, data) => {
    ptyManager.write(data);
  });
  
  ipcMain.on('pty:resize', (event, cols, rows) => {
    ptyManager.resize(cols, rows);
  });
  
  ipcMain.handle('pty:kill', async () => {
    ptyManager.kill();
    return { success: true };
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
  // 清理资源
  ipcController.cleanup();
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
 * 错误处理
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('意外错误', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});