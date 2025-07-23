'use strict';

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const Analytics = require('./analytics');
const Updater = require('./updater');
const ProcessGuardian = require('./process-guardian');
const SystemPrivileges = require('./system-privileges');
const SystemTray = require('./system-tray');

const store = new Store();

let mainWindow = null;
let analytics = null;
let updater = null;
let processGuardian = null;
let systemPrivileges = null;
let systemTray = null;
const isDev = process.argv.includes('--dev');
const isElevated = process.argv.includes('--elevated');
const isBackupMode = process.argv.includes('--backup-mode');

async function createWindow() {
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
  
  // 在开发模式下打开控制台输出
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('窗口加载完成');
  });
  
  // 监听渲染进程的控制台消息
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`渲染进程日志 [${level}]: ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
  
  // 初始化保活机制
  await initializeGuardianSystems();
}

/**
 * 初始化保活机制系统
 */
async function initializeGuardianSystems() {
  console.log('🛡️ 正在初始化保活机制系统...');
  
  try {
    // 如果是备份模式，不初始化完整的保活机制
    if (isBackupMode) {
      console.log('🔄 备份模式运行，跳过完整保活机制初始化');
      return;
    }
    
    // 1. 初始化系统权限管理
    systemPrivileges = new SystemPrivileges();
    const privilegeResult = await systemPrivileges.initialize();
    
    if (!privilegeResult.success) {
      console.warn('⚠️ 权限管理器初始化失败，使用受限模式');
    }
    
    // 2. 初始化进程守护
    processGuardian = new ProcessGuardian();
    const guardianResult = await processGuardian.startGuardian();
    
    if (guardianResult.success) {
      console.log('✅ 进程守护系统启动成功');
    } else {
      console.error('❌ 进程守护系统启动失败:', guardianResult.message);
    }
    
    // 3. 初始化系统托盘
    systemTray = new SystemTray(mainWindow);
    
    // 4. 设置定期状态更新
    setInterval(() => {
      updateSystemStatus();
    }, 30000); // 每30秒更新一次状态
    
    console.log('✅ 保活机制系统初始化完成');
    
  } catch (error) {
    console.error('❌ 保活机制系统初始化失败:', error);
  }
}

/**
 * 更新系统状态
 */
function updateSystemStatus() {
  if (!processGuardian || !systemTray) return;
  
  const status = {
    processGuardian: processGuardian.isGuardianActive,
    autoLaunch: store.get('autoLaunch', false),
    portManager: !!processGuardian.portManager.currentPort,
    protectionLevel: processGuardian.protectionLevel,
    startHidden: store.get('startHidden', false)
  };
  
  systemTray.updateStatus(status);
  
  // 发送状态到渲染进程
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('guardian-status-update', status);
  }
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
              detail: `专业的 Claude Code 部署和管理工具\n版本: ${app.getVersion()}`,
              buttons: ['确定']
            });
          }
        },
        {
          label: '检查更新...',
          click: () => {
            if (updater) {
              updater.checkForUpdates(false);
            }
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
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '保活机制',
      submenu: [
        {
          label: '启用保活机制',
          click: async () => {
            if (!processGuardian) {
              await initializeGuardianSystems();
            }
          }
        },
        {
          label: '保护级别',
          submenu: [
            {
              label: '最高保护',
              click: () => {
                if (processGuardian) {
                  processGuardian.setProtectionLevel('maximum');
                }
              }
            },
            {
              label: '中等保护',
              click: () => {
                if (processGuardian) {
                  processGuardian.setProtectionLevel('moderate');
                }
              }
            },
            {
              label: '最低保护',
              click: () => {
                if (processGuardian) {
                  processGuardian.setProtectionLevel('minimum');
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: '查看保活状态',
          click: () => {
            if (processGuardian) {
              const status = processGuardian.getStatus();
              dialog.showMessageBox({
                type: 'info',
                title: '保活机制状态',
                message: '当前保活机制状态',
                detail: `激活状态: ${status.isActive ? '已启用' : '已禁用'}\n保护级别: ${status.protectionLevel}\n运行时间: ${Math.floor(status.uptime / 60)} 分钟\n内存使用: ${Math.round(status.memoryUsage.heapUsed / 1024 / 1024)} MB\n卸载尝试: ${status.uninstallAttempts} 次`,
                buttons: ['确定']
              });
            }
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function checkAdminPrivileges() {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    // macOS - 检查是否有管理员权限
    const { exec } = require('child_process');
    exec('id -G', (error, stdout) => {
      if (error) {
        console.log('无法检查管理员权限');
        return;
      }
      
      const groups = stdout.trim().split(' ');
      const isAdmin = groups.includes('80'); // admin group
      
      if (!isAdmin) {
        dialog.showMessageBox({
          type: 'warning',
          title: '权限提醒',
          message: '建议以管理员权限运行 Miaoda',
          detail: '管理员权限可以确保保活机制的完整功能',
          buttons: ['确定']
        });
      }
    });
  }
}

// IPC 处理器

// 启动 Claude Code
ipcMain.handle('start-claude-code', async (event, config) => {
  const { startClaudeCode } = require('./claude-runner');
  return await startClaudeCode(config, mainWindow);
});

// 停止 Claude Code
ipcMain.handle('stop-claude-code', async () => {
  const { stopClaudeCode } = require('./claude-runner');
  return await stopClaudeCode();
});

// 获取环境信息
ipcMain.handle('get-environment', async () => {
  const { checkEnvironment } = require('./environment');
  return await checkEnvironment();
});

// 安装依赖
ipcMain.handle('install-dependency', async (event, dependency) => {
  const { installDependency } = require('./installer');
  return await installDependency(dependency);
});

// 安装 uv
ipcMain.handle('install-uv', async () => {
  const { installUV } = require('./installer');
  return await installUV();
});

// 安装 Claude Code
ipcMain.handle('install-claude-code', async () => {
  const { installClaudeCode } = require('./installer');
  return await installClaudeCode();
});

// 保存配置
ipcMain.handle('save-config', async (event, config) => {
  try {
    const configs = store.get('configs', []);
    const existingIndex = configs.findIndex(c => c.name === config.name);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }
    
    store.set('configs', configs);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 获取配置
ipcMain.handle('get-configs', async () => {
  try {
    const configs = store.get('configs', []);
    return { success: true, configs };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 删除配置
ipcMain.handle('delete-config', async (event, configName) => {
  try {
    const configs = store.get('configs', []);
    const filteredConfigs = configs.filter(c => c.name !== configName);
    store.set('configs', filteredConfigs);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 测试连接
ipcMain.handle('test-connection', async (event, config) => {
  try {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    return new Promise((resolve) => {
      const parsedUrl = url.parse(config.apiUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path || '/',
        method: 'GET',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'User-Agent': 'Miaoda/2.0.4'
        }
      };
      
      const req = protocol.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ success: true, message: '连接成功' });
        } else {
          resolve({ success: false, message: `HTTP ${res.statusCode}` });
        }
      });
      
      req.on('error', (error) => {
        resolve({ success: false, message: error.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, message: '连接超时' });
      });
      
      req.end();
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.on('terminal-input', (event, data) => {
  const { sendInputToClaudeCode } = require('./claude-runner');
  sendInputToClaudeCode(data);
});

// 数据统计相关的IPC处理器
ipcMain.on('track-page-view', (event, pageName) => {
  if (analytics) {
    analytics.trackPageView(pageName);
  }
});

ipcMain.on('track-feature-use', (event, featureName) => {
  if (analytics) {
    analytics.trackFeatureUse(featureName);
  }
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
  return { success: true };
});

// 开机启动设置
ipcMain.handle('set-auto-launch', async (event, enable) => {
  try {
    const autoLauncher = require('auto-launch');
    const appLauncher = new autoLauncher({
      name: 'Miaoda',
      path: app.getPath('exe'),
    });
    
    if (enable) {
      await appLauncher.enable();
      store.set('autoLaunch', true);
    } else {
      await appLauncher.disable();
      store.set('autoLaunch', false);
    }
    
    return { success: true, enabled: enable };
  } catch (error) {
    console.error('设置开机启动失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取开机启动状态
ipcMain.handle('get-auto-launch-status', async () => {
  return store.get('autoLaunch', false);
});

// 检查更新
ipcMain.handle('check-for-updates', async () => {
  try {
    // 这里应该调用实际的更新检查API
    // 暂时返回模拟数据
    const currentVersion = app.getVersion();
    const latestVersion = '2.0.5'; // 模拟最新版本
    
    // 比较版本号
    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      downloadUrl: 'https://github.com/miaoda-ai/miaoda/releases',
      downloadUrlMac: 'https://github.com/miaoda-ai/miaoda/releases/download/v2.0.4/Miaoda-2.0.4.dmg',
      downloadUrlMacArm: 'https://github.com/miaoda-ai/miaoda/releases/download/v2.0.4/Miaoda-2.0.4-arm64.dmg',
      downloadUrlWin: 'https://github.com/miaoda-ai/miaoda/releases/download/v2.0.4/Miaoda-2.0.4-Setup.exe'
    };
  } catch (error) {
    return { error: error.message };
  }
});

// 保活机制相关的IPC处理器

// 获取保活机制状态
ipcMain.handle('get-guardian-status', async () => {
  try {
    const status = {
      processGuardian: processGuardian ? processGuardian.getStatus() : null,
      systemPrivileges: systemPrivileges ? systemPrivileges.getStatus() : null,
      systemTray: systemTray ? systemTray.getStatus() : null
    };
    
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 设置保护级别
ipcMain.handle('set-protection-level', async (event, level) => {
  try {
    if (processGuardian) {
      processGuardian.setProtectionLevel(level);
      return { success: true, level };
    } else {
      return { success: false, error: '进程守护未初始化' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 启动/停止保活机制
ipcMain.handle('toggle-guardian', async (event, enable) => {
  try {
    if (enable) {
      if (!processGuardian) {
        processGuardian = new ProcessGuardian();
      }
      const result = await processGuardian.startGuardian();
      return result;
    } else {
      if (processGuardian) {
        processGuardian.cleanup();
        processGuardian = null;
      }
      return { success: true, message: '保活机制已停止' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 请求权限提升
ipcMain.handle('request-elevation', async () => {
  try {
    if (!systemPrivileges) {
      systemPrivileges = new SystemPrivileges();
    }
    
    const result = await systemPrivileges.requestElevation();
    return { success: true, elevated: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 获取可用端口
ipcMain.handle('get-available-port', async () => {
  try {
    if (processGuardian && processGuardian.portManager) {
      const port = await processGuardian.portManager.findAvailablePort();
      return { success: true, port };
    } else {
      // 如果进程守护未启动，创建临时端口管理器
      const net = require('net');
      const preferredPorts = [8082, 8083, 8084, 8085, 8086];
      
      for (const port of preferredPorts) {
        const available = await new Promise((resolve) => {
          const server = net.createServer();
          server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
          });
          server.on('error', () => resolve(false));
        });
        
        if (available) {
          return { success: true, port };
        }
      }
      
      // 如果首选端口都被占用，返回随机端口
      const randomPort = await new Promise((resolve) => {
        const server = net.createServer();
        server.listen(0, () => {
          const port = server.address().port;
          server.close(() => resolve(port));
        });
      });
      
      return { success: true, port: randomPort };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 监听来自系统托盘的事件
ipcMain.on('protection-level-changed', (event, level) => {
  if (processGuardian) {
    processGuardian.setProtectionLevel(level);
  }
});

ipcMain.on('start-hidden-changed', (event, enabled) => {
  store.set('startHidden', enabled);
});

ipcMain.on('show-about', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于 Miaoda',
    message: 'Miaoda - Claude Code Manager',
    detail: `专业的 Claude Code 部署和管理工具\n版本: ${app.getVersion()}\n\n具备驱动级保活机制:\n• 进程守护和自恢复\n• 强制开机启动\n• 防卸载保护\n• 智能端口管理\n• 系统级权限管理`,
    buttons: ['确定']
  });
});

ipcMain.on('confirm-quit', () => {
  if (systemTray) {
    systemTray.forceQuit();
  } else {
    app.quit();
  }
});

// 版本号比较函数
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}

app.whenReady().then(async () => {
  await createWindow();
  
  // 初始化分析和更新服务
  analytics = new Analytics();
  updater = new Updater();
  
  // 检查管理员权限
  checkAdminPrivileges();
  
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

// 应用退出前的清理工作
app.on('before-quit', () => {
  console.log('🧹 应用退出前清理...');
  
  if (processGuardian) {
    processGuardian.cleanup();
  }
  
  if (systemPrivileges) {
    systemPrivileges.cleanup();
  }
  
  if (systemTray) {
    systemTray.destroy();
  }
});