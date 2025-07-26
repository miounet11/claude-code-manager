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
  
  // 本地模型管理
  detectLocalModels: () => ipcRenderer.invoke('local-models:detect'),
  getLocalModels: (serviceId) => ipcRenderer.invoke('local-models:get-models', serviceId),
  pullLocalModel: (modelName) => ipcRenderer.invoke('local-models:pull', modelName),
  deleteLocalModel: (modelName) => ipcRenderer.invoke('local-models:delete', modelName),
  testLocalModelConnection: (serviceId) => ipcRenderer.invoke('local-models:test', serviceId),
  onLocalModelDetected: (callback) => {
    ipcRenderer.on('local-models:service-detected', (event, data) => callback(data));
  },
  onLocalModelPullProgress: (callback) => {
    ipcRenderer.on('local-models:pull-progress', (event, data) => callback(data));
  },
  
  // 系统托盘事件
  onTrayAction: (callback) => {
    ipcRenderer.on('tray:start-claude', () => callback('start'));
    ipcRenderer.on('tray:stop-claude', () => callback('stop'));
  },
  
  // PTY 终端支持（兼容旧版本和新的会话管理）
  createPtyProcess: (options) => ipcRenderer.invoke('pty:create', options),
  writeToPty: (data, sessionId) => {
    // 兼容旧版本：如果没有 sessionId，使用第一个参数作为 sessionId
    if (typeof data === 'string' && !sessionId) {
      // 旧版本调用，data 是实际数据，sessionId 是 undefined
      // 需要从全局状态获取 sessionId
      ipcRenderer.send('pty:write', window.__currentPtySessionId || 'default', data);
    } else {
      // 新版本调用
      ipcRenderer.send('pty:write', sessionId || data, sessionId ? data : '');
    }
  },
  resizePty: (cols, rows, sessionId) => {
    // 兼容处理
    if (typeof cols === 'number' && typeof rows === 'number' && !sessionId) {
      ipcRenderer.send('pty:resize', window.__currentPtySessionId || 'default', cols, rows);
    } else {
      ipcRenderer.send('pty:resize', sessionId || cols, cols, rows);
    }
  },
  killPty: (sessionId) => {
    return ipcRenderer.invoke('pty:kill', sessionId || window.__currentPtySessionId || 'default');
  },
  
  onPtyData: (callback) => {
    ipcRenderer.on('pty:data', (event, sessionId, data) => {
      // 兼容旧版本：如果只有一个参数，那么 sessionId 实际上是 data
      if (data === undefined) {
        callback(sessionId);
      } else {
        callback(data, sessionId);
      }
    });
  },
  
  onPtyExit: (callback) => {
    ipcRenderer.on('pty:exit', (event, sessionId, code) => {
      // 兼容旧版本
      if (code === undefined) {
        callback(sessionId);
      } else {
        callback(code, sessionId);
      }
    });
  }
});