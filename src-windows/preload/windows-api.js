'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Windows 版本专用 API
 * 针对 Windows 平台优化的接口
 */
contextBridge.exposeInMainWorld('miaodaAPI', {
  // 平台信息
  platform: 'win32',
  version: process.env.npm_package_version || '1.0.0',
  
  // 环境检测
  env: {
    check: () => ipcRenderer.invoke('env:check'),
    install: (dependency) => ipcRenderer.invoke('env:install', dependency),
    diagnostics: () => ipcRenderer.invoke('env:diagnostics'),
    fixClaudePath: () => ipcRenderer.invoke('env:fix-claude-path')
  },

  // 终端管理
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (sessionId, data) => ipcRenderer.send('terminal:write', sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    close: (sessionId) => ipcRenderer.invoke('terminal:close', sessionId),
    list: () => ipcRenderer.invoke('terminal:list'),
    
    // 事件监听
    onData: (callback) => {
      ipcRenderer.on('terminal:data', (event, sessionId, data) => {
        callback(sessionId, data);
      });
    },
    onExit: (callback) => {
      ipcRenderer.on('terminal:exit', (event, sessionId, exitCode, signal) => {
        callback(sessionId, exitCode, signal);
      });
    },
    onError: (callback) => {
      ipcRenderer.on('terminal:error', (event, sessionId, error) => {
        callback(sessionId, error);
      });
    }
  },

  // Claude 管理
  claude: {
    start: (config) => ipcRenderer.invoke('claude:start', config),
    stop: () => ipcRenderer.invoke('claude:stop'),
    restart: () => ipcRenderer.invoke('claude:restart'),
    getStatus: () => ipcRenderer.invoke('claude:status'),
    sendInput: (input) => ipcRenderer.invoke('claude:send-input', input)
  },

  // 配置管理
  config: {
    getAll: () => ipcRenderer.invoke('config:get-all'),
    save: (config) => ipcRenderer.invoke('config:save', config),
    add: (config) => ipcRenderer.invoke('config:add', config),
    update: (id, config) => ipcRenderer.invoke('config:update', id, config),
    delete: (configId) => ipcRenderer.invoke('config:delete', configId),
    getCurrent: () => ipcRenderer.invoke('config:get-current'),
    setCurrent: (configId) => ipcRenderer.invoke('config:set-current', configId),
    duplicate: (configId) => ipcRenderer.invoke('config:duplicate', configId),
    export: (configId) => ipcRenderer.invoke('config:export', configId),
    test: (config) => ipcRenderer.invoke('config:test', config),
    validate: (config) => ipcRenderer.invoke('config:validate', config)
  },

  // 系统操作
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
    showItemInFolder: (fullPath) => ipcRenderer.invoke('system:show-item-in-folder', fullPath),
    
    // Windows 特定功能
    getWindowsVersion: async () => {
      const result = await ipcRenderer.invoke('env:check');
      return result.system;
    },
    
    // 注册表操作（未来功能）
    registry: {
      get: (key) => ipcRenderer.invoke('registry:get', key),
      set: (key, value) => ipcRenderer.invoke('registry:set', key, value)
    }
  },

  // 应用控制
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    restore: () => ipcRenderer.send('app:restore')
  },

  // 托盘事件
  tray: {
    onStartClaude: (callback) => {
      ipcRenderer.on('tray:start-claude', callback);
    },
    onStopClaude: (callback) => {
      ipcRenderer.on('tray:stop-claude', callback);
    },
    onOpenSettings: (callback) => {
      ipcRenderer.on('tray:open-settings', callback);
    }
  },

  // 深度链接
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (event, url) => {
      callback(url);
    });
  },

  // Windows 特定：深色模式检测
  theme: {
    isDarkMode: () => {
      // Windows 10/11 深色模式检测
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    onChange: (callback) => {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        callback(e.matches);
      });
    }
  },

  // 通知（Windows 10/11 原生通知）
  notification: {
    show: (title, body, options = {}) => {
      return new Notification(title, {
        body,
        icon: options.icon || '../../assets/icon.ico',
        ...options
      });
    }
  }
});

// Windows 特定：阻止拖放文件到窗口
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// Windows 特定：处理右键菜单
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// 为了兼容性，也暴露 electronAPI（ConfigManager 组件使用）
contextBridge.exposeInMainWorld('electronAPI', {
  // 基本操作
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  
  // 配置管理
  getAllConfigs: () => ipcRenderer.invoke('config:get-all'),
  getCurrentConfig: () => ipcRenderer.invoke('config:get-current'),
  addConfig: (config) => ipcRenderer.invoke('config:add', config),
  updateConfig: (id, config) => ipcRenderer.invoke('config:update', id, config),
  deleteConfig: (id) => ipcRenderer.invoke('config:delete', id),
  setCurrentConfig: (id) => ipcRenderer.invoke('config:set-current', id),
  duplicateConfig: (id) => ipcRenderer.invoke('config:duplicate', id),
  exportConfig: (id) => ipcRenderer.invoke('config:export', id),
  validateConfig: (config) => ipcRenderer.invoke('config:validate', config),
  
  // Claude 管理
  startClaude: (config) => ipcRenderer.invoke('claude:start', config),
  stopClaude: () => ipcRenderer.invoke('claude:stop'),
  getClaudeStatus: () => ipcRenderer.invoke('claude:status'),
  
  // 对话框
  showConfirm: async (title, message) => {
    // TODO: 实现 Windows 版本的确认对话框
    return confirm(`${title}\n\n${message}`);
  },
  showError: (title, message) => {
    alert(`❌ ${title}\n\n${message}`);
  },
  showInfo: (title, message) => {
    alert(`ℹ️ ${title}\n\n${message}`);
  }
});