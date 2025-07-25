'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  console.log('创建简单窗口...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Miaoda 测试版本',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  console.log('加载 HTML 文件...');
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  mainWindow.webContents.openDevTools();
  
  console.log('窗口创建完成');
}

app.whenReady().then(() => {
  console.log('Electron 准备就绪');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});