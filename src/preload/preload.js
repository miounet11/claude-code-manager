'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  appVersion: process.env.npm_package_version || '2.1.0',
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  
  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  quit: () => ipcRenderer.send('app:quit'),
  
  // 环境检测
  checkEnvironment: () => ipcRenderer.invoke('env:check'),
  startPeriodicEnvironmentCheck: (interval) => ipcRenderer.invoke('env:start-periodic-check', interval),
  stopPeriodicEnvironmentCheck: () => ipcRenderer.invoke('env:stop-periodic-check'),
  onEnvironmentUpdate: (callback) => {
    ipcRenderer.on('env:status-update', (event, data) => callback(data));
  },
  
  // 安装管理
  installDependency: (dependency) => ipcRenderer.invoke('install:dependency', dependency),
  installMultiple: (dependencies) => ipcRenderer.invoke('install:multiple', dependencies),
  cancelInstall: () => ipcRenderer.invoke('install:cancel'),
  onInstallProgress: (callback) => {
    ipcRenderer.on('install:progress', (event, data) => callback(data));
  },
  
  // 系统终端
  openSystemTerminal: (config) => ipcRenderer.invoke('terminal:open', config),
  
  // 配置管理
  getAllConfigs: () => ipcRenderer.invoke('config:get-all'),
  getCurrentConfig: () => ipcRenderer.invoke('config:get-current'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  addConfig: (config) => ipcRenderer.invoke('config:add', config),
  updateConfig: (id, updates) => ipcRenderer.invoke('config:update', id, updates),
  deleteConfig: (id) => ipcRenderer.invoke('config:delete', id),
  setCurrentConfig: (config) => ipcRenderer.invoke('config:set-current', config),
  validateConfig: (config) => ipcRenderer.invoke('config:validate', config),
  importConfig: (configData) => ipcRenderer.invoke('config:import', configData),
  exportConfig: (id) => ipcRenderer.invoke('config:export', id),
  duplicateConfig: (id) => ipcRenderer.invoke('config:duplicate', id),
  onConfigChange: (callback) => {
    ipcRenderer.on('config:current-changed', (event, config) => callback(config));
  },
  
  // Claude 管理
  startClaude: (config) => ipcRenderer.invoke('claude:start', config),
  stopClaude: () => ipcRenderer.invoke('claude:stop'),
  restartClaude: () => ipcRenderer.invoke('claude:restart'),
  getClaudeStatus: () => ipcRenderer.invoke('claude:status'),
  sendClaudeInput: (data) => ipcRenderer.send('claude:input', data),
  onClaudeOutput: (callback) => {
    ipcRenderer.on('claude:output', (event, data) => callback(data));
  },
  onClaudeStarted: (callback) => {
    ipcRenderer.on('claude:started', (event, data) => callback(data));
  },
  onClaudeStopped: (callback) => {
    ipcRenderer.on('claude:stopped', (event, data) => callback(data));
  },
  onClaudeStatusChange: (callback) => {
    const handlers = {
      'claude:starting': (event, data) => callback({ type: 'starting', ...data }),
      'claude:started': (event, data) => callback({ type: 'started', ...data }),
      'claude:stopping': () => callback({ type: 'stopping' }),
      'claude:exit': (event, data) => callback({ type: 'exit', ...data }),
      'claude:error': (event, data) => callback({ type: 'error', ...data })
    };
    
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcRenderer.on(channel, handler);
    });
  },
  
  // 通用功能
  getSystemInfo: () => ipcRenderer.invoke('app:system-info'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  showError: (title, message) => ipcRenderer.invoke('app:show-error', title, message),
  showInfo: (title, message) => {
    ipcRenderer.invoke('app:show-error', title, message); // 临时使用 error box
  },
  showConfirm: async (title, message) => {
    // 简单实现
    return confirm(`${title}\n\n${message}`);
  },
  
  // 文件操作
  selectFile: (options) => ipcRenderer.invoke('dialog:select-file', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
  
  // 系统托盘事件
  onTrayAction: (callback) => {
    ipcRenderer.on('tray:start-claude', () => callback('start'));
    ipcRenderer.on('tray:stop-claude', () => callback('stop'));
  },
  
  // PTY 终端支持
  createPtyProcess: (options) => ipcRenderer.invoke('pty:create', options),
  writeToPty: (data) => ipcRenderer.send('pty:write', data),
  resizePty: (cols, rows) => ipcRenderer.send('pty:resize', cols, rows),
  killPty: () => ipcRenderer.invoke('pty:kill'),
  
  onPtyData: (callback) => {
    ipcRenderer.on('pty:data', (event, data) => callback(data));
  },
  
  onPtyExit: (callback) => {
    ipcRenderer.on('pty:exit', (event, code) => callback(code));
  }
});