'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 测试 IPC
  testIPC: () => ipcRenderer.invoke('test-ipc'),
  
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  deleteConfig: (configId) => ipcRenderer.invoke('delete-config', configId),
  
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  
  checkEnvironment: () => ipcRenderer.invoke('check-environment'),
  
  installDependency: (dependency) => ipcRenderer.invoke('install-dependency', dependency),
  
  startClaudeCode: (config) => ipcRenderer.invoke('start-claude-code', config),
  
  stopClaudeCode: () => ipcRenderer.invoke('stop-claude-code'),
  
  testApiConnection: (config) => ipcRenderer.invoke('test-api-connection', config),
  
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal-data', (event, data) => callback(data));
  },
  
  sendTerminalInput: (data) => {
    ipcRenderer.send('terminal-input', data);
  },
  
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, data) => callback(data));
  },
  
  platform: process.platform,
  
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    app: require('electron').remote ? require('electron').remote.app.getVersion() : '2.0.0'
  },
  
  // 数据统计
  trackPageView: (pageName) => {
    ipcRenderer.send('track-page-view', pageName);
  },
  
  trackFeatureUse: (featureName) => {
    ipcRenderer.send('track-feature-use', featureName);
  },
  
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 系统信息
  isAppleSilicon: process.arch === 'arm64' && process.platform === 'darwin'
});