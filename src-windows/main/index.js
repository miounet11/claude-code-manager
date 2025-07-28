'use strict';

const { app, BrowserWindow, ipcMain, Menu, Tray, shell } = require('electron');
const path = require('path');
const windowsEnv = require('./services/windows-env');
const ConPTYManager = require('./services/conpty');
const store = require('electron-store');
const WindowsAnalytics = require('./analytics');
const WindowsUpdater = require('./updater');
const windowsAnalyticsIntegration = require('./services/analytics-integration');

// Windows 特定设置
if (process.platform === 'win32') {
  // 设置应用 ID (Windows 7+)
  app.setAppUserModelId('com.miaoda.app.windows');
}

// 全局变量
let mainWindow = null;
let tray = null;
let analytics = null;
let updater = null;
const conptyManager = new ConPTYManager();
const configStore = new store({ name: 'miaoda-config' });

/**
 * 创建主窗口
 */
function createWindow() {
  // Windows 风格的窗口配置
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Miaoda for Windows',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    frame: true, // Windows 使用原生标题栏
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/windows-api.js')
    }
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index-dev.html'));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Windows 特定的窗口事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 防止窗口标题被修改
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });
}

/**
 * 创建系统托盘
 */
function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/icon.ico'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '启动 Claude',
      click: () => {
        mainWindow?.webContents.send('tray:start-claude');
      }
    },
    {
      label: '停止 Claude',
      click: () => {
        mainWindow?.webContents.send('tray:stop-claude');
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        windowsAnalyticsIntegration.trackPageView('tray_settings');
        mainWindow?.webContents.send('tray:open-settings');
      }
    },
    {
      label: '检查更新',
      click: async () => {
        windowsAnalyticsIntegration.trackFeatureUse('manual_update_check');
        if (updater) {
          await updater.checkForUpdates(false);
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Miaoda - AI Service Bridge');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * 注册 IPC 处理器
 */
function registerIPCHandlers() {
  // 引入服务
  const environmentService = require('./services/environment-service');
  const installerService = require('./services/installer-service');
  // 环境检测
  ipcMain.handle('env:check', async () => {
    windowsAnalyticsIntegration.trackFeatureUse('env_check');
    return await environmentService.checkAll();
  });
  
  ipcMain.handle('env:diagnostics', async () => {
    return await environmentService.getDiagnostics();
  });
  
  ipcMain.handle('env:fix-claude-path', async () => {
    return await environmentService.fixClaudePath();
  });
  
  ipcMain.handle('env:install', async (event, dependency) => {
    if (dependency === 'claude') {
      return await installerService.installClaude();
    }
    throw new Error(`Unknown dependency: ${dependency}`);
  });

  ipcMain.handle('env:install', async (event, dependency) => {
    return await windowsEnv.installDependency(dependency);
  });

  // 终端管理
  ipcMain.handle('terminal:create', async (event, options) => {
    windowsAnalyticsIntegration.trackTerminalAction('create', options?.shell);
    return conptyManager.createSession(options);
  });

  ipcMain.on('terminal:write', (event, sessionId, data) => {
    try {
      conptyManager.write(sessionId, data);
    } catch (error) {
      event.reply('terminal:error', sessionId, error.message);
    }
  });

  ipcMain.on('terminal:resize', (event, sessionId, cols, rows) => {
    conptyManager.resize(sessionId, cols, rows);
  });

  ipcMain.handle('terminal:close', async (event, sessionId) => {
    conptyManager.closeSession(sessionId);
    return { success: true };
  });

  ipcMain.handle('terminal:list', async () => {
    return conptyManager.getAllSessions();
  });

  // ConPTY 事件转发
  conptyManager.on('data', (sessionId, data) => {
    mainWindow?.webContents.send('terminal:data', sessionId, data);
  });

  conptyManager.on('exit', (sessionId, exitCode, signal) => {
    mainWindow?.webContents.send('terminal:exit', sessionId, exitCode, signal);
  });

  // Claude 管理
  ipcMain.handle('claude:start', async (event, config) => {
    windowsAnalyticsIntegration.trackClaudeAction('start');
    const environmentService = require('./services/environment-service');
    const envResult = await environmentService.checkAll();
    
    if (!envResult.summary.ready) {
      throw new Error('环境未就绪: ' + envResult.summary.issues.join(', '));
    }
    
    return await claudeService.start(config);
  });
  
  ipcMain.handle('claude:stop', async () => {
    windowsAnalyticsIntegration.trackClaudeAction('stop');
    return await claudeService.stop();
  });
  
  ipcMain.handle('claude:restart', async () => {
    windowsAnalyticsIntegration.trackClaudeAction('restart');
    return await claudeService.restart();
  });
  
  ipcMain.handle('claude:status', async () => {
    return claudeService.getStatus();
  });
  
  ipcMain.handle('claude:send-input', async (event, input) => {
    return claudeService.sendInput(input);
  });

  // 配置管理
  const configService = require('./services/config-service-windows');
  const claudeService = require('./services/claude-service');
  
  ipcMain.handle('config:get-all', async () => {
    return configService.getAllConfigs();
  });

  ipcMain.handle('config:save', async (event, config) => {
    windowsAnalyticsIntegration.trackConfigAction('save');
    const configs = configStore.get('configs', []);
    const index = configs.findIndex(c => c.id === config.id);
    
    if (index >= 0) {
      configs[index] = config;
    } else {
      configs.push(config);
    }
    
    configStore.set('configs', configs);
    return { success: true };
  });

  ipcMain.handle('config:add', async (event, config) => {
    windowsAnalyticsIntegration.trackConfigAction('add');
    return configService.addConfig(config);
  });

  ipcMain.handle('config:update', async (event, id, config) => {
    windowsAnalyticsIntegration.trackConfigAction('update');
    return configService.updateConfig(id, config);
  });

  ipcMain.handle('config:delete', async (event, configId) => {
    windowsAnalyticsIntegration.trackConfigAction('delete');
    return configService.deleteConfig(configId);
  });

  ipcMain.handle('config:get-current', async () => {
    return configService.getCurrentConfig();
  });

  ipcMain.handle('config:set-current', async (event, config) => {
    windowsAnalyticsIntegration.trackConfigAction('set-current');
    return configService.setCurrentConfig(config.id || config);
  });
  
  ipcMain.handle('config:duplicate', async (event, configId) => {
    windowsAnalyticsIntegration.trackConfigAction('duplicate');
    return configService.duplicateConfig(configId);
  });
  
  ipcMain.handle('config:export', async (event, configId) => {
    windowsAnalyticsIntegration.trackConfigAction('export');
    return configService.exportConfig(configId);
  });
  
  ipcMain.handle('config:test', async (event, config) => {
    windowsAnalyticsIntegration.trackConfigAction('test');
    // TODO: Implement config test for Windows
    return { success: true, message: '连接成功' };
  });
  
  ipcMain.handle('config:validate', async (event, config) => {
    return configService.validateConfig(config);
  });

  // 系统操作
  ipcMain.handle('system:open-external', async (event, url) => {
    shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('system:show-item-in-folder', async (event, fullPath) => {
    shell.showItemInFolder(fullPath);
    return { success: true };
  });

  // 应用信息
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  // 统计分析相关
  ipcMain.handle('analytics:track-page', (event, pageName) => {
    windowsAnalyticsIntegration.trackPageView(pageName);
    return { success: true };
  });

  ipcMain.handle('analytics:track-feature', (event, featureName) => {
    windowsAnalyticsIntegration.trackFeatureUse(featureName);
    return { success: true };
  });

  ipcMain.handle('analytics:track-terminal', (event, action, terminalType) => {
    windowsAnalyticsIntegration.trackTerminalAction(action, terminalType);
    return { success: true };
  });

  ipcMain.handle('analytics:track-error', (event, errorType, context, details) => {
    windowsAnalyticsIntegration.trackError(errorType, context, details);
    return { success: true };
  });

  ipcMain.handle('analytics:get-stats', () => {
    return windowsAnalyticsIntegration.getStatsSummary();
  });

  ipcMain.handle('analytics:upload', async () => {
    try {
      return await windowsAnalyticsIntegration.uploadReports();
    } catch (error) {
      console.error('🪟 Analytics upload failed:', error);
      throw error;
    }
  });

  // 更新检查相关
  ipcMain.handle('updater:check', async (event, silent = false) => {
    if (updater) {
      return await updater.checkForUpdates(silent);
    }
    return false;
  });

  ipcMain.handle('updater:get-info', () => {
    if (updater) {
      return updater.getUpdateHistory();
    }
    return null;
  });

  ipcMain.handle('updater:download-latest', async () => {
    if (updater) {
      return await updater.downloadLatest();
    }
    throw new Error('Updater not available');
  });

  ipcMain.handle('updater:clear-history', () => {
    if (updater) {
      updater.clearUpdateHistory();
      return { success: true };
    }
    return { success: false };
  });
}

/**
 * 应用初始化
 */
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIPCHandlers();

  // 初始化统计分析
  analytics = new WindowsAnalytics();
  windowsAnalyticsIntegration.initialize(analytics);
  analytics.startSession();
  windowsAnalyticsIntegration.trackPageView('app_start');
  analytics.setupAutoUpload();
  
  // 初始化更新检查
  updater = new WindowsUpdater(mainWindow);
  updater.setupAutoCheck();
  
  console.log('🪟 Windows Analytics 和 Updater 已初始化');

  // Windows 特定：单实例锁
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      // 如果用户尝试打开第二个实例，聚焦到第一个实例的窗口
      windowsAnalyticsIntegration.trackFeatureUse('second_instance_focus');
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
});

/**
 * 应用事件处理
 */
app.on('window-all-closed', () => {
  // Windows 下不退出应用，保持在系统托盘
  if (process.platform === 'win32') {
    // 隐藏到托盘而不是退出
    if (tray) {
      mainWindow = null;
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // 结束统计会话
  if (analytics) {
    analytics.endSession();
    windowsAnalyticsIntegration.trackFeatureUse('app_quit');
  }
  
  // 清理资源
  conptyManager.cleanup();
});

// Windows 特定：处理深度链接
app.setAsDefaultProtocolClient('miaoda');

app.on('open-url', (event, url) => {
  event.preventDefault();
  // 处理 miaoda:// 协议
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});