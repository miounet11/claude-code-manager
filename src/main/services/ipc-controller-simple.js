'use strict';

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const TerminalManager = require('../terminal-manager');
const localModelService = require('./local-model-service');
const cacheManager = require('./cache-manager');

/**
 * 简化的 IPC 控制器
 */
class IPCControllerSimple {
  constructor() {
    this.mainWindow = null;
    this.terminalManager = new TerminalManager();
    this.configs = [];
    this.currentConfig = null;
    this.handlers = new Map(); // 存储所有注册的处理器
    this.listeners = new Map(); // 存储所有注册的监听器
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow;
    
    // 清除之前的处理器（安全方式）
    this.cleanup();
    
    // 开始本地模型定期检测
    localModelService.startPeriodicDetection(30000);
    
    // 监听本地模型检测事件
    localModelService.on('service-detected', (data) => {
      this.mainWindow?.webContents.send('local-models:service-detected', data);
    });
    
    // 基本处理器
    this.registerHandler('app:version', () => {
      return require('electron').app.getVersion();
    });

    // 窗口控制
    this.registerListener('window:minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    this.registerListener('window:close', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });
    
    // 缓存管理
    this.registerHandler('cache:clear', async () => {
      try {
        await cacheManager.clearAllCaches();
        return { success: true, message: '缓存已清理' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    this.registerHandler('cache:get-stats', async () => {
      return await cacheManager.getCacheStats();
    });
    
    this.registerHandler('cache:reload-window', async () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        await cacheManager.clearWindowCache(this.mainWindow.webContents);
        return { success: true };
      }
      return { success: false, error: '窗口不存在' };
    });

    // 环境检测
    this.registerHandler('env:check', async () => {
      return this.checkEnvironment();
    });
    
    // 环境诊断
    this.registerHandler('env:diagnostics', async () => {
      const environmentService = require('./environment-service');
      return await environmentService.getDiagnostics();
    });
    
    // 修复 Claude 路径
    this.registerHandler('env:fix-claude-path', async () => {
      const environmentService = require('./environment-service');
      return await environmentService.fixClaudePath();
    });

    // 配置管理
    this.registerHandler('config:get-all', async () => {
      return this.getConfigs();
    });

    this.registerHandler('config:get-current', async () => {
      return this.currentConfig;
    });

    this.registerHandler('config:save', async (event, config) => {
      return this.saveConfig(config);
    });

    this.registerHandler('config:delete', async (event, id) => {
      return this.deleteConfig(id);
    });

    this.registerHandler('config:set-current', async (event, config) => {
      this.currentConfig = config;
      
      // 保存当前配置ID
      const Store = require('electron-store');
      const configStore = new Store({ name: 'miaoda-configs' });
      configStore.set('currentConfigId', config.id);
      
      return { success: true };
    });

    this.registerHandler('config:test', async (event, config) => {
      // 如果是本地服务，使用本地模型服务测试
      if (config.service === 'ollama' || config.service === 'lmstudio' || config.service === 'localai') {
        return await localModelService.testConnection(config.service);
      }
      
      // 否则使用标准配置服务测试
      const configService = require('./config-service');
      return await configService.testConnection(config);
    });

    // 使用新的配置服务方法
    this.registerHandler('getAllConfigs', async () => {
      const configService = require('./config-service');
      return configService.getAllConfigs();
    });

    this.registerHandler('getCurrentConfig', async () => {
      const configService = require('./config-service');
      return configService.getCurrentConfig();
    });

    this.registerHandler('addConfig', async (event, config) => {
      const configService = require('./config-service');
      return configService.addConfig(config);
    });

    this.registerHandler('updateConfig', async (event, id, updates) => {
      const configService = require('./config-service');
      return configService.updateConfig(id, updates);
    });

    this.registerHandler('deleteConfig', async (event, id) => {
      const configService = require('./config-service');
      return configService.deleteConfig(id);
    });

    this.registerHandler('setCurrentConfig', async (event, id) => {
      const configService = require('./config-service');
      return configService.setCurrentConfig(id);
    });

    this.registerHandler('validateConfig', async (event, config) => {
      const configService = require('./config-service');
      return configService.validateConfig(config);
    });

    this.registerHandler('duplicateConfig', async (event, id) => {
      const configService = require('./config-service');
      return configService.duplicateConfig(id);
    });

    this.registerHandler('exportConfig', async (event, id) => {
      const configService = require('./config-service');
      return configService.exportConfig(id);
    });

    // Claude 管理
    this.registerHandler('claude:start', async (event, config) => {
      return this.startClaude(config);
    });

    this.registerHandler('claude:stop', async () => {
      return this.stopClaude();
    });

    this.registerListener('claude:input', (event, data) => {
      this.sendToClaudeProcess(data);
    });

    // 环境安装
    this.registerHandler('install:dependency', async (event, dependency) => {
      const installerService = require('./installer-service');
      
      // 使用新的安装服务
      const result = await installerService.install(dependency, (progress) => {
        // 发送进度更新到渲染进程
        this.sendToRenderer('install:progress', progress);
      });
      
      // 如果是 Claude 安装成功，尝试修复路径
      if (dependency === 'claude' && result.success) {
        const environmentService = require('./environment-service');
        const fixResult = await environmentService.fixClaudePath();
        if (fixResult.success) {
          console.log('Claude 路径修复成功:', fixResult.message);
        }
        
        // 重新检查环境
        const checkResult = await this.checkEnvironment();
        this.sendToRenderer('env:updated', checkResult);
      }
      
      return result;
    });

    // 本地模型管理
    this.registerHandler('local-models:detect', async () => {
      return localModelService.detectAll();
    });

    this.registerHandler('local-models:get-models', async (event, serviceId) => {
      return localModelService.getModels(serviceId);
    });

    this.registerHandler('local-models:pull', async (event, modelName) => {
      return localModelService.pullModel(modelName, (progress) => {
        this.mainWindow?.webContents.send('local-models:pull-progress', progress);
      });
    });

    this.registerHandler('local-models:delete', async (event, modelName) => {
      return localModelService.deleteModel(modelName);
    });

    this.registerHandler('local-models:test', async (event, serviceId) => {
      return localModelService.testConnection(serviceId);
    });

    // 打开系统终端
    this.registerHandler('terminal:open', async (event, config) => {
      return this.openSystemTerminal(config);
    });

    // 代理服务器统计
    this.registerHandler('proxy:stats', async () => {
      try {
        const proxyServer = require('./proxy-server');
        if (proxyServer.isRunning) {
          return proxyServer.getStatistics();
        }
        return null;
      } catch (error) {
        return null;
      }
    });

    // 监听 Claude 服务的使用统计事件
    const claudeService = require('./claude-service');
    claudeService.on('usage', (data) => {
      this.sendToRenderer('usage:update', data);
    });
  }

  registerHandler(channel, handler) {
    // 移除旧的处理器（如果存在）
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
    }
    // 注册新处理器
    ipcMain.handle(channel, handler);
    this.handlers.set(channel, handler);
  }

  registerListener(channel, listener) {
    // 移除旧的监听器（如果存在）
    if (this.listeners.has(channel)) {
      ipcMain.removeListener(channel, this.listeners.get(channel));
    }
    // 注册新监听器
    ipcMain.on(channel, listener);
    this.listeners.set(channel, listener);
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  cleanup() {
    if (this.terminalManager.isRunning()) {
      this.stopClaude();
    }
    
    // 停止本地模型检测
    localModelService.stopPeriodicDetection();
    localModelService.removeAllListeners();
    
    // 安全地移除所有处理器
    this.handlers.forEach((handler, channel) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();
    
    // 安全地移除所有监听器
    this.listeners.forEach((listener, channel) => {
      ipcMain.removeListener(channel, listener);
    });
    this.listeners.clear();
  }

  // 环境检测实现
  async checkEnvironment() {
    console.log('[IPC] 开始环境检测...');
    
    try {
      const environmentService = require('../services/environment-service');
      console.log('[IPC] 环境服务已加载');
      
      const result = await environmentService.checkAll();
      console.log('[IPC] 环境检测原始结果:', JSON.stringify(result, null, 2));
      
      // 转换格式以匹配前端期望的格式
      const formattedResult = {
        nodejs: result.dependencies.nodejs || { installed: false },
        git: result.dependencies.git || { installed: false },
        claude: result.dependencies.claude || { installed: false },
        uv: result.dependencies.uv || { installed: false }
      };
      
      console.log('[IPC] 格式化后的结果:', JSON.stringify(formattedResult, null, 2));
      return formattedResult;
    } catch (error) {
      console.error('[IPC] 环境检测错误:', error);
      console.error('[IPC] 错误堆栈:', error.stack);
      
      // 返回默认结果
      const defaultResult = {
        nodejs: { installed: false, error: '检测失败' },
        git: { installed: false, error: '检测失败' },
        claude: { installed: false, error: '检测失败' },
        uv: { installed: false, error: '检测失败' }
      };
      
      console.log('\n[IPC] 返回默认结果:', JSON.stringify(defaultResult, null, 2));
      console.log('\n============================================\n');
      return defaultResult;
    }
  }

  // 配置管理实现
  async getConfigs() {
    const Store = require('electron-store');
    const configStore = new Store({ name: 'miaoda-configs' });
    
    console.log('[getConfigs] 配置文件路径:', configStore.path);
    let configs = configStore.get('configs', []);
    console.log('[getConfigs] 读取到的配置数量:', configs.length);
    
    // 如果没有配置，创建默认配置
    if (configs.length === 0) {
      configs = [
        {
          id: 'free-trial',
          name: '免费体验 (每日100万token)',
          apiKey: 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44',
          apiUrl: 'http://www.miaoda.vip/',
          model: 'claude-3-7-sonnet-20250219',
          proxy: '',
          isFreeAccount: true
        },
        {
          id: Date.now().toString(),
          name: '我的配置',
          apiKey: '',
          apiUrl: 'https://api.anthropic.com',
          model: 'claude-3-7-sonnet-20250219',
          proxy: ''
        }
      ];
      configStore.set('configs', configs);
    }
    
    this.configs = configs;
    
    // 设置当前配置
    const currentConfigId = configStore.get('currentConfigId');
    if (currentConfigId) {
      this.currentConfig = configs.find(c => c.id === currentConfigId) || configs[0];
    } else {
      this.currentConfig = configs[0];
    }
    
    return configs;
  }

  async saveConfig(config) {
    const Store = require('electron-store');
    const configStore = new Store({ name: 'miaoda-configs' });
    
    const index = this.configs.findIndex(c => c.id === config.id);
    if (index >= 0) {
      this.configs[index] = config;
    } else {
      this.configs.push(config);
    }
    
    configStore.set('configs', this.configs);
    return { success: true };
  }

  async deleteConfig(id) {
    const Store = require('electron-store');
    const configStore = new Store({ name: 'miaoda-configs' });
    
    this.configs = this.configs.filter(c => c.id !== id);
    configStore.set('configs', this.configs);
    return { success: true };
  }

  // Claude 进程管理 - 跨平台真实终端
  async startClaude(config) {
    if (this.terminalManager.isRunning()) {
      return { success: false, error: 'Claude 已在运行' };
    }

    try {
      this.sendToRenderer('claude:output', {
        type: 'system',
        text: '正在启动 Claude CLI...'
      });

      // 使用终端管理器启动
      await this.terminalManager.start(config, {
        onData: (data) => {
          this.sendToRenderer('claude:output', {
            type: 'raw',
            text: data
          });
        },
        onError: (error) => {
          this.sendToRenderer('claude:output', {
            type: 'error',
            text: error
          });
        },
        onExit: (code) => {
          this.sendToRenderer('claude:output', {
            type: 'system',
            text: `Claude 进程已退出 (代码: ${code})`
          });
          this.sendToRenderer('claude:stopped', { code });
        }
      });

      this.sendToRenderer('claude:started', { success: true });
      return { success: true };
    } catch (error) {
      this.sendToRenderer('claude:output', {
        type: 'error',
        text: `启动失败: ${error.message}`
      });
      return { success: false, error: error.message };
    }
  }

  async stopClaude() {
    if (!this.terminalManager.isRunning()) {
      return { success: false, error: 'Claude 未在运行' };
    }

    try {
      await this.terminalManager.stop();
      return { success: true };
    } catch (error) {
      console.error('停止 Claude 失败:', error);
      return { success: false, error: error.message };
    }
  }

  sendToClaudeProcess(data) {
    if (!this.terminalManager.isRunning()) return;

    try {
      this.terminalManager.write(data);
    } catch (error) {
      this.sendToRenderer('claude:output', {
        type: 'error',
        text: error.message
      });
    }
  }

  // 安装依赖实现
  async installDependency(dependency) {
    const { spawn } = require('child_process');
    
    this.sendToRenderer('install:progress', {
      dependency,
      status: 'starting',
      message: `开始安装 ${dependency}...`
    });

    try {
      let command, args;
      
      switch (dependency) {
        case 'claude':
          // 安装 Claude CLI - 使用正确的 npm 包名
          command = 'npm';
          args = ['install', '-g', '@anthropic-ai/claude-code'];
          // 添加环境变量以避免权限问题
          process.env.npm_config_unsafe_perm = 'true';
          break;
          
        case 'uv':
          // 安装 UV (Python 包管理器)
          command = 'curl';
          args = ['-LsSf', 'https://astral.sh/uv/install.sh', '|', 'sh'];
          break;
          
        default:
          throw new Error(`未知的依赖: ${dependency}`);
      }

      // 执行安装命令
      const install = spawn(command, args, { shell: true });
      
      install.stdout.on('data', (data) => {
        this.sendToRenderer('install:progress', {
          dependency,
          status: 'running',
          message: data.toString()
        });
      });

      install.stderr.on('data', (data) => {
        this.sendToRenderer('install:progress', {
          dependency,
          status: 'running',
          message: data.toString()
        });
      });

      install.on('close', (code) => {
        if (code === 0) {
          this.sendToRenderer('install:progress', {
            dependency,
            status: 'completed',
            message: `${dependency} 安装成功！`
          });
        } else {
          this.sendToRenderer('install:progress', {
            dependency,
            status: 'failed',
            message: `${dependency} 安装失败，错误码: ${code}`
          });
        }
      });

      return { success: true };
    } catch (error) {
      this.sendToRenderer('install:progress', {
        dependency,
        status: 'failed',
        message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  // 打开系统终端
  async openSystemTerminal(config) {
    const { exec } = require('child_process');
    const os = require('os');
    
    try {
      // 构建环境变量
      const env = [];
      if (config.apiKey) {
        env.push(`export ANTHROPIC_API_KEY="${config.apiKey}"`);
      }
      if (config.apiUrl) {
        env.push(`export ANTHROPIC_API_URL="${config.apiUrl}"`);
      }
      if (config.proxy) {
        env.push(`export HTTP_PROXY="${config.proxy}"`);
        env.push(`export HTTPS_PROXY="${config.proxy}"`);
      }

      const platform = os.platform();
      let command;
      
      if (platform === 'darwin') {
        // macOS - 使用 Terminal.app
        const envCommands = env.join('; ');
        const fullCommand = envCommands ? `${envCommands}; claude` : 'claude';
        // 使用 AppleScript 打开新的终端窗口
        command = `osascript -e 'tell application "Terminal"
          do script "${fullCommand.replace(/"/g, '\\"')}"
          activate
        end tell'`;
      } else if (platform === 'win32') {
        // Windows - 使用 cmd
        const envCommands = env.map(e => e.replace('export', 'set')).join(' & ');
        const fullCommand = envCommands ? `${envCommands} & claude` : 'claude';
        command = `start cmd /k "${fullCommand}"`;
      } else {
        // Linux - 尝试常见终端
        const envCommands = env.join('; ');
        const fullCommand = envCommands ? `${envCommands}; claude` : 'claude';
        // 尝试多个终端模拟器
        const terminals = [
          `gnome-terminal -- bash -c "${fullCommand}; exec bash"`,
          `konsole -e bash -c "${fullCommand}; exec bash"`,
          `xterm -e bash -c "${fullCommand}; exec bash"`
        ];
        command = terminals[0]; // 默认使用 gnome-terminal
      }

      exec(command, (error) => {
        if (error) {
          console.error('打开终端失败:', error);
          return { success: false, error: error.message };
        }
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new IPCControllerSimple();