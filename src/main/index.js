'use strict';

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
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
              detail: '专业的 Claude Code 部署和管理工具\n版本: 1.0.0',
              buttons: ['确定']
            });
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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
  const { checkEnvironment } = require('./environment');
  return await checkEnvironment();
});

ipcMain.handle('install-dependency', async (event, dependency) => {
  const { installDependency } = require('./installer');
  return await installDependency(dependency);
});

ipcMain.handle('start-claude-code', async (event, config) => {
  const { startClaudeCode } = require('./claude-runner');
  return await startClaudeCode(config, mainWindow);
});

ipcMain.on('terminal-input', (event, data) => {
  const { sendInputToClaudeCode } = require('./claude-runner');
  sendInputToClaudeCode(data);
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