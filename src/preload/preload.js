'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 测试 IPC
  testIPC: () => ipcRenderer.invoke('test-ipc'),
  
  // 显示确认对话框
  showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),
  
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),
  
  deleteConfig: (configId) => ipcRenderer.invoke('delete-config', configId),
  
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  
  checkEnvironment: () => ipcRenderer.invoke('check-environment'),
  
  installDependency: (dependency) => ipcRenderer.invoke('install-dependency', dependency),
  
  requestElevation: () => ipcRenderer.invoke('request-elevation'),
  
  startClaudeCode: (config) => ipcRenderer.invoke('start-claude-code', config),
  
  stopClaudeCode: () => ipcRenderer.invoke('stop-claude-code'),
  
  getClaudeStatus: () => ipcRenderer.invoke('get-claude-status'),
  
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  testApiConnection: (config) => ipcRenderer.invoke('test-api-connection', config),
  
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  
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
    app: '2.0.5' // remote API 已在新版本 Electron 中被弃用
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
  
  // 开机启动
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
  getAutoLaunchStatus: () => ipcRenderer.invoke('get-auto-launch-status'),
  
  // 系统信息
  isAppleSilicon: process.arch === 'arm64' && process.platform === 'darwin',
  
  // 保活机制相关 API
  getGuardianStatus: () => ipcRenderer.invoke('get-guardian-status'),
  setProtectionLevel: (level) => ipcRenderer.invoke('set-protection-level', level),
  toggleGuardian: (enable) => ipcRenderer.invoke('toggle-guardian', enable),
  executeElevated: (command, args) => ipcRenderer.invoke('execute-elevated', command, args),
  toggleSystemTray: (show) => ipcRenderer.invoke('toggle-system-tray', show),
  getAvailablePort: () => ipcRenderer.invoke('get-available-port'),
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  
  // 保活机制事件监听
  onGuardianStatusUpdate: (callback) => {
    ipcRenderer.on('guardian-status-update', (event, status) => callback(status));
  },
  onProtectionLevelChanged: (callback) => {
    ipcRenderer.on('protection-level-changed', (event, level) => callback(level));
  },
  onStartHiddenChanged: (callback) => {
    ipcRenderer.on('start-hidden-changed', (event, enabled) => callback(enabled));
  },
  onShowAbout: (callback) => {
    ipcRenderer.on('show-about', () => callback());
  },
  onConfirmQuit: (callback) => {
    ipcRenderer.on('confirm-quit', () => callback());
  },
  
  // 真实终端 API
  terminal: {
    // 创建终端
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    
    // 写入数据
    write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
    
    // 调整大小
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
    
    // 关闭终端
    close: (id) => ipcRenderer.send('terminal:close', { id }),
    
    // 获取终端信息
    info: (id) => ipcRenderer.invoke('terminal:info', { id }),
    
    // 执行命令
    execute: (id, command) => ipcRenderer.invoke('terminal:execute', { id, command }),
    
    // 获取所有终端
    list: () => ipcRenderer.invoke('terminal:list'),
    
    // 监听终端输出
    onOutput: (callback) => {
      ipcRenderer.on('terminal:output', (event, { terminalId, data }) => {
        callback(terminalId, data);
      });
    },
    
    // 监听终端退出
    onExit: (callback) => {
      ipcRenderer.on('terminal:exit', (event, { terminalId, data }) => {
        callback(terminalId, data);
      });
    }
  }
});