'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  deleteConfig: (configId) => ipcRenderer.invoke('delete-config', configId),
  
  checkEnvironment: () => ipcRenderer.invoke('check-environment'),
  
  installDependency: (dependency) => ipcRenderer.invoke('install-dependency', dependency),
  
  startClaudeCode: (config) => ipcRenderer.invoke('start-claude-code', config),
  
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
    electron: process.versions.electron
  }
});