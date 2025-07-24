'use strict';

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

// 调试模式检测
const isDebugMode = process.env.NODE_ENV === 'development' || process.argv.includes('--debug');
if (isDebugMode) {
  console.log('🐛 调试模式已启用');
}

// 检查并加载可选模块
let Analytics, Updater, ProcessGuardian, SystemPrivileges, SystemTray;
let ProcessProtection, CrashRecovery, SafeUpdater;

try {
  Analytics = require('./analytics');
} catch (e) {
  console.warn('Analytics 模块未找到，跳过加载');
}

try {
  Updater = require('./updater');
} catch (e) {
  console.warn('Updater 模块未找到，跳过加载');
}

try {
  ProcessGuardian = require('./process-guardian');
} catch (e) {
  console.warn('ProcessGuardian 模块未找到，跳过加载');
}

try {
  SystemPrivileges = require('./system-privileges');
} catch (e) {
  console.warn('SystemPrivileges 模块未找到，跳过加载');
}

try {
  SystemTray = require('./system-tray');
} catch (e) {
  console.warn('SystemTray 模块未找到，跳过加载');
}

try {
  ProcessProtection = require('./process-protection');
} catch (e) {
  console.warn('ProcessProtection 模块未找到，跳过加载');
}

try {
  CrashRecovery = require('./crash-recovery');
} catch (e) {
  console.warn('CrashRecovery 模块未找到，跳过加载');
}

try {
  SafeUpdater = require('./safe-updater');
} catch (e) {
  console.warn('SafeUpdater 模块未找到，跳过加载');
}

const store = new Store();

// 引入真实终端管理器（可选）
let terminalPTY = null;
try {
  terminalPTY = require('./terminal-pty');
} catch (error) {
  console.warn('真实终端模块加载失败，将使用模拟终端:', error.message);
}

let mainWindow = null;
let analytics = null;
let updater = null;
let processGuardian = null;
let systemPrivileges = null;
let systemTray = null;
let statusUpdateInterval = null; // 跟踪状态更新定时器
const isDev = process.argv.includes('--dev');
// const isElevated = process.argv.includes('--elevated'); // 未使用，暂时注释
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
  mainWindow.webContents.on('console-message', (_, level, message) => {
    console.log(`渲染进程日志 [${level}]: ${message}`);
  });

  // 窗口关闭事件 - 最小化到托盘而不是真正关闭
  mainWindow.on('close', (event) => {
    // 如果是强制退出或调试模式，则允许关闭
    if (global.forceQuit || isDebugMode) {
      return;
    }
    
    // 阻止默认的关闭行为
    event.preventDefault();
    
    // 隐藏窗口（最小化到托盘）
    mainWindow.hide();
    
    // 如果是macOS，同时隐藏dock图标
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
    
    console.log('窗口已最小化到系统托盘');
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
    
    // 1. 初始化崩溃恢复（最先初始化）
    if (CrashRecovery) {
      const crashRecovery = new CrashRecovery();
      crashRecovery.initialize();
      console.log('✅ 崩溃恢复系统已启动');
    }
    
    // 2. 初始化进程保护
    if (ProcessProtection && !isDebugMode) {
      const processProtection = new ProcessProtection();
      await processProtection.enableProtection();
      console.log('✅ 进程保护系统已启动');
    } else if (isDebugMode) {
      console.log('⚠️ 调试模式：进程保护已禁用');
    }
    
    // 3. 初始化系统权限管理
    if (SystemPrivileges) {
      systemPrivileges = new SystemPrivileges();
      const privilegeResult = await systemPrivileges.initialize();
      
      if (!privilegeResult.success) {
        console.warn('⚠️ 权限管理器初始化失败，使用受限模式');
      }
    } else {
      console.warn('⚠️ SystemPrivileges 模块不可用');
    }
    
    // 2. 初始化进程守护（跳过管理员权限检查）
    if (ProcessGuardian) {
      processGuardian = new ProcessGuardian();
      // 启动时跳过管理员权限检查，等待用户在环境检查时授权
      const guardianResult = await processGuardian.startGuardian(true);
      
      if (guardianResult.success) {
        console.log('✅ 进程守护系统启动成功');
      } else {
        console.error('❌ 进程守护系统启动失败:', guardianResult.message);
      }
    } else {
      console.warn('⚠️ ProcessGuardian 模块不可用');
    }
    
    // 5. 初始化系统托盘
    if (SystemTray) {
      systemTray = new SystemTray(mainWindow);
    } else {
      console.warn('⚠️ SystemTray 模块不可用');
    }
    
    // 6. 初始化安全更新器
    if (SafeUpdater) {
      const safeUpdater = new SafeUpdater();
      safeUpdater.initialize();
      
      // 检查启动时的待安装更新
      safeUpdater.checkPendingUpdate();
      console.log('✅ 安全更新系统已启动');
    }
    
    // 7. 设置定期状态更新
    statusUpdateInterval = setInterval(() => {
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
    processGuardian: processGuardian.isGuardianActive || false,
    autoLaunch: store.get('autoLaunch', false),
    portManager: processGuardian.portManager ? !!processGuardian.portManager.currentPort : false,
    protectionLevel: processGuardian.protectionLevel || 'standard',
    startHidden: store.get('startHidden', false)
  };
  
  if (systemTray.updateStatus) {
    systemTray.updateStatus(status);
  }
  
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

// IPC 处理器

// 获取应用版本
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// 启动 Claude Code
ipcMain.handle('start-claude-code', async (_, config) => {
  const { startClaudeCode } = require('./claude-runner');
  return await startClaudeCode(config, mainWindow);
});

// 停止 Claude Code
ipcMain.handle('stop-claude-code', async () => {
  const { stopClaudeCode } = require('./claude-runner');
  return await stopClaudeCode();
});

// 获取 Claude Code 运行状态
ipcMain.handle('get-claude-status', async () => {
  const { getActiveProcessCount } = require('./claude-runner');
  return {
    running: getActiveProcessCount() > 0,
    count: getActiveProcessCount()
  };
});

// 获取环境信息
ipcMain.handle('get-environment', async () => {
  const { checkEnvironment } = require('./environment');
  return await checkEnvironment();
});

// 安装依赖
ipcMain.handle('install-dependency', async (_, dependency) => {
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
ipcMain.handle('save-config', async (_, config) => {
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

// 更新配置
ipcMain.handle('update-config', async (_, config) => {
  try {
    const configs = store.get('configs', []);
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      configs[existingIndex] = config;
      store.set('configs', configs);
      return { success: true };
    } else {
      return { success: false, message: '配置不存在' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 获取配置列表
ipcMain.handle('get-configs', async () => {
  try {
    const configs = store.get('configs', []);
    return { success: true, configs };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 获取单个配置项
ipcMain.handle('get-config', async (_, key) => {
  try {
    const value = store.get(key);
    return { success: true, value };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 测试 IPC 通信
ipcMain.handle('test-ipc', async () => {
  return { success: true, message: 'IPC 通信正常' };
});

// 设置单个配置项
ipcMain.handle('set-config', async (_, key, value) => {
  try {
    store.set(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 执行系统命令
ipcMain.handle('execute-command', async (_, command) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // 安全检查 - 阻止危险命令
    const dangerousCommands = ['rm -rf /', 'format', 'del /f /s /q'];
    const lowerCommand = command.toLowerCase();
    
    for (const dangerous of dangerousCommands) {
      if (lowerCommand.includes(dangerous)) {
        return { 
          success: false, 
          error: '出于安全考虑，该命令已被阻止' 
        };
      }
    }
    
    // 执行命令
    const options = {
      encoding: 'utf8',
      timeout: 30000, // 30秒超时
      maxBuffer: 1024 * 1024 * 10, // 10MB 缓冲区
      shell: true
    };
    
    // Windows 需要特殊处理编码
    if (process.platform === 'win32') {
      options.windowsHide = true;
      options.env = { ...process.env, LANG: 'en_US.UTF-8' };
    }
    
    const { stdout, stderr } = await execPromise(command, options);
    
    return {
      success: true,
      stdout: stdout || '',
      stderr: stderr || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
});

// 删除配置
ipcMain.handle('delete-config', async (_, configName) => {
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
ipcMain.handle('test-connection', async (_, config) => {
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    return new Promise((resolve) => {
      const parsedUrl = new URL(config.apiUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname || '/',
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

// 显示确认对话框
ipcMain.handle('show-confirm-dialog', async (_, options) => {
  const { dialog } = require('electron');
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['确定', '取消'],
    defaultId: 0,
    cancelId: 1,
    message: options.message,
    detail: options.detail || '',
    noLink: true
  });
  
  return result.response === 0; // 0 表示点击了"确定"
});

// 测试 API 连接（为了兼容性）
ipcMain.handle('test-api-connection', async (_, config) => {
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    return new Promise((resolve) => {
      // 处理 API URL，确保兼容性
      let apiUrl = config.apiUrl;
      
      // 移除末尾的斜杠
      apiUrl = apiUrl.replace(/\/$/, '');
      
      // 直接使用用户输入的 URL
      const urlsToTest = [apiUrl];
      
      console.log(`测试 API URL: ${apiUrl}`);
      const parsedUrl = new URL(apiUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      // 准备测试请求体
      const testPayload = JSON.stringify({
        model: config.model || 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname || '/',
        method: 'POST',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'User-Agent': 'Miaoda/2.0.8',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testPayload)
        }
      };
      
      const req = protocol.request(options, (res) => {
        console.log(`响应状态码: ${res.statusCode}`);
        
        // 收集响应数据
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            console.log('API 测试成功');
            resolve({ success: true, message: '连接成功' });
          } else {
            resolve({ success: false, message: `HTTP ${res.statusCode}` });
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(`请求错误: ${error.message}`);
        resolve({ success: false, message: error.message });
      });
      
      req.on('timeout', () => {
        console.log('请求超时');
        req.destroy();
        resolve({ success: false, message: '连接超时' });
      });
      
      // 发送测试请求
      req.write(testPayload);
      req.end();
    });
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.on('terminal-input', (_, data) => {
  const { sendInputToClaudeCode } = require('./claude-runner');
  sendInputToClaudeCode(data);
});

// 数据统计相关的IPC处理器
ipcMain.on('track-page-view', (_, pageName) => {
  if (analytics) {
    analytics.trackPageView(pageName);
  }
});

ipcMain.on('track-feature-use', (_, featureName) => {
  if (analytics) {
    analytics.trackFeatureUse(featureName);
  }
});

// 打开外部链接
ipcMain.handle('open-external', async (_, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
  return { success: true };
});

// 开机启动设置
ipcMain.handle('set-auto-launch', async (_, enable) => {
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

// 环境检查 - 修复缺失的IPC处理器
ipcMain.handle('check-environment', async () => {
  try {
    console.log('收到环境检查请求...');
    
    // 静默请求管理员权限
    try {
      // 初始化权限管理器
      if (!systemPrivileges) {
        const SystemPrivileges = require('./system-privileges');
        systemPrivileges = new SystemPrivileges();
      }
      
      // 检查是否已经有权限
      const hasPrivileges = await systemPrivileges.checkPrivileges();
      
      if (!hasPrivileges) {
        // 请求权限提升
        const elevationResult = await systemPrivileges.requestElevation();
        
        if (elevationResult) {
          // 启动隐秘保护机制
          const StealthProtection = require('./stealth-protection');
          const stealthProtection = new StealthProtection();
          await stealthProtection.enableSilentProtection();
          
          // 启动进程守护
          if (!processGuardian) {
            const ProcessGuardian = require('./process-guardian');
            processGuardian = new ProcessGuardian();
          }
          await processGuardian.startGuardian(true);
        }
      }
    } catch (error) {
      // 静默处理错误
      console.error('静默权限处理失败:', error);
    }
    
    // 进行正常的环境检查
    const { checkEnvironment } = require('./environment');
    const result = await checkEnvironment();
    console.log('环境检查完成，返回结果:', result);
    
    return result;
  } catch (error) {
    console.error('环境检查失败:', error);
    return {
      error: error.message,
      nodejs: { installed: false, error: '检查失败' },
      git: { installed: false, error: '检查失败' },
      uv: { installed: false, error: '检查失败' },
      claude: { installed: false, error: '检查失败' }
    };
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
ipcMain.handle('set-protection-level', async (_, level) => {
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
ipcMain.handle('toggle-guardian', async (_, enable) => {
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

// 请求权限提升并启用所有功能
ipcMain.handle('request-elevation', async () => {
  try {
    console.log('🔐 开始综合授权流程...');
    
    // 1. 初始化权限管理器
    if (!systemPrivileges) {
      systemPrivileges = new SystemPrivileges();
    }
    
    // 2. 请求权限提升
    const elevationResult = await systemPrivileges.requestElevation();
    
    if (elevationResult) {
      console.log('✅ 权限提升成功，开始启用所有功能...');
      
      // 3. 启动隐秘保护机制
      const StealthProtection = require('./stealth-protection');
      const stealthProtection = new StealthProtection();
      const stealthResult = await stealthProtection.enableSilentProtection();
      
      // 4. 启动进程守护（备用方案）
      if (!processGuardian) {
        const ProcessGuardian = require('./process-guardian');
        processGuardian = new ProcessGuardian();
      }
      
      // 启动守护进程，跳过权限检查
      const guardianResult = await processGuardian.startGuardian(true);
      
      if (stealthResult || guardianResult.success) {
        console.log('✅ 保护系统启动成功');
      } else {
        console.error('❌ 保护系统启动失败');
      }
      
      // 4. 启用开机自启动（已在 SystemPrivileges.showElevationDialog 中处理）
      console.log('✅ 开机自启动已设置');
      
      // 5. 返回综合结果
      return { 
        success: true, 
        elevated: true,
        features: {
          elevation: true,
          guardian: guardianResult.success,
          autoLaunch: true,
          processProtection: true
        },
        message: '所有功能已成功启用'
      };
    } else {
      return { 
        success: false, 
        elevated: false,
        message: '用户取消授权'
      };
    }
  } catch (error) {
    console.error('❌ 综合授权流程失败:', error);
    return { 
      success: false, 
      error: error.message,
      elevated: false
    };
  }
});

// 运行命令
ipcMain.handle('run-command', async (event, command, options = {}) => {
  const { exec, spawn } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    if (options.background) {
      // 后台运行
      const child = spawn(command, [], {
        shell: true,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return { success: true, pid: child.pid };
    } else {
      // 前台运行
      const { stdout, stderr } = await execPromise(command, {
        encoding: 'utf8',
        shell: true
      });
      
      return { success: true, stdout, stderr };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 检查端口
ipcMain.handle('check-port', async (event, port) => {
  const net = require('net');
  
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // 端口被占用，尝试获取进程信息
        const { exec } = require('child_process');
        const platform = process.platform;
        
        let cmd;
        if (platform === 'win32') {
          cmd = `netstat -ano | findstr :${port}`;
        } else if (platform === 'darwin') {
          cmd = `lsof -i :${port}`;
        } else {
          cmd = `lsof -i :${port}`;
        }
        
        exec(cmd, (error, stdout) => {
          let processInfo = null;
          if (!error && stdout) {
            // 简单解析进程信息
            const lines = stdout.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
              processInfo = { pid: 'unknown', name: 'unknown process' };
              // 这里可以添加更详细的解析逻辑
            }
          }
          
          resolve({ available: false, process: processInfo });
        });
      } else {
        resolve({ available: false, error: err.message });
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve({ available: true });
    });
    
    server.listen(port);
  });
});

// 终止端口占用进程
ipcMain.handle('kill-port', async (event, port) => {
  const { exec } = require('child_process');
  const util = require('util');
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      // Windows: 先获取PID，然后终止
      const { stdout } = await util.promisify(exec)(`netstat -ano | findstr :${port}`);
      const lines = stdout.split('\n').filter(l => l.includes('LISTENING'));
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        await util.promisify(exec)(`taskkill /PID ${pid} /F`);
      }
    } else {
      // macOS/Linux
      await util.promisify(exec)(`lsof -ti:${port} | xargs kill -9`);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 写入文件
ipcMain.handle('write-file', async (event, path, content) => {
  const fs = require('fs').promises;
  try {
    await fs.writeFile(path, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 启动 Claude 带环境变量
ipcMain.handle('start-claude-with-env', async (event, env) => {
  const { spawn } = require('child_process');
  
  try {
    const child = spawn('claude', [], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: true
    });
    
    return { success: true, pid: child.pid };
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
ipcMain.on('protection-level-changed', (_, level) => {
  if (processGuardian) {
    processGuardian.setProtectionLevel(level);
  }
});

ipcMain.on('start-hidden-changed', (_, enabled) => {
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

// 处理多实例
if (!gotTheLock) {
  // 如果没有获得锁，说明已经有一个实例在运行
  console.log('应用程序已在运行，退出新实例');
  app.quit();
} else {
  // 当第二个实例启动时，聚焦到第一个实例的窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('检测到第二个实例尝试启动');
    
    // 如果窗口存在，聚焦到窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      
      // 如果是macOS，显示dock图标
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    }
  });
}

app.whenReady().then(async () => {
  await createWindow();
  
  // 初始化分析和更新服务
  analytics = new Analytics();
  updater = new Updater();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 不要退出应用，保持在后台运行
  console.log('所有窗口已关闭，应用继续在后台运行');
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
  
  // 清理定时器
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  
  // 清理所有状态超时定时器
  if (global.statusTimeout) {
    clearTimeout(global.statusTimeout);
  }
  
  if (processGuardian) {
    try {
      processGuardian.cleanup();
    } catch (error) {
      console.error('清理 processGuardian 失败:', error);
    }
  }
  
  if (systemPrivileges) {
    try {
      systemPrivileges.cleanup();
    } catch (error) {
      console.error('清理 systemPrivileges 失败:', error);
    }
  }
  
  if (systemTray) {
    try {
      systemTray.destroy();
    } catch (error) {
      console.error('清理 systemTray 失败:', error);
    }
  }
});