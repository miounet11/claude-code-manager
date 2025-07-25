'use strict';

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const TerminalManager = require('../terminal-manager');

/**
 * 简化的 IPC 控制器
 */
class IPCControllerSimple {
  constructor() {
    this.mainWindow = null;
    this.terminalManager = new TerminalManager();
    this.configs = [];
    this.currentConfig = null;
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow;
    
    // 基本处理器
    ipcMain.handle('app:version', () => {
      return require('electron').app.getVersion();
    });

    // 窗口控制
    ipcMain.on('window:minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.on('window:close', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });

    // 环境检测
    ipcMain.handle('env:check', async () => {
      return this.checkEnvironment();
    });

    // 配置管理
    ipcMain.handle('config:get-all', async () => {
      return this.getConfigs();
    });

    ipcMain.handle('config:get-current', async () => {
      return this.currentConfig;
    });

    ipcMain.handle('config:save', async (event, config) => {
      return this.saveConfig(config);
    });

    ipcMain.handle('config:delete', async (event, id) => {
      return this.deleteConfig(id);
    });

    ipcMain.handle('config:set-current', async (event, config) => {
      this.currentConfig = config;
      
      // 保存当前配置ID
      const Store = require('electron-store');
      const configStore = new Store({ name: 'claude-configs' });
      configStore.set('currentConfigId', config.id);
      
      return { success: true };
    });

    // Claude 管理
    ipcMain.handle('claude:start', async (event, config) => {
      return this.startClaude(config);
    });

    ipcMain.handle('claude:stop', async () => {
      return this.stopClaude();
    });

    ipcMain.on('claude:input', (event, data) => {
      this.sendToClaudeProcess(data);
    });

    // 环境安装
    ipcMain.handle('install:dependency', async (event, dependency) => {
      return this.installDependency(dependency);
    });

    // 打开系统终端
    ipcMain.handle('terminal:open', async (event, config) => {
      return this.openSystemTerminal(config);
    });
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
    ipcMain.removeAllListeners();
  }

  // 环境检测实现
  async checkEnvironment() {
    const { spawn } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(require('child_process').exec);
    
    const result = {
      nodejs: { installed: false },
      git: { installed: false },
      claude: { installed: false },
      uv: { installed: false }
    };

    try {
      // 检测 Node.js
      try {
        const { stdout } = await execPromise('node --version');
        result.nodejs = { installed: true, version: stdout.trim() };
      } catch (e) {}

      // 检测 Git
      try {
        const { stdout } = await execPromise('git --version');
        result.git = { installed: true, version: stdout.trim().replace('git version ', '') };
      } catch (e) {}

      // 检测 Claude
      try {
        const { stdout } = await execPromise('claude --version');
        result.claude = { installed: true, version: stdout.trim() };
      } catch (e) {}

      // 检测 UV
      try {
        const { stdout } = await execPromise('uv --version');
        result.uv = { installed: true, version: stdout.trim() };
      } catch (e) {}
    } catch (error) {
      console.error('环境检测错误:', error);
    }

    return result;
  }

  // 配置管理实现
  async getConfigs() {
    const Store = require('electron-store');
    const configStore = new Store({ name: 'claude-configs' });
    
    let configs = configStore.get('configs', []);
    
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
    const configStore = new Store({ name: 'claude-configs' });
    
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
    const configStore = new Store({ name: 'claude-configs' });
    
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
          // 安装 Claude CLI - 使用正确的包名
          if (process.platform === 'darwin' || process.platform === 'linux') {
            // macOS/Linux: 使用 brew 或 直接下载
            command = 'sh';
            args = ['-c', 'curl -fsSL https://storage.googleapis.com/anthropic-release/claude-cli/install.sh | sh'];
          } else {
            // Windows: 使用 npm 或其他方式
            command = 'npm';
            args = ['install', '-g', 'claude'];
          }
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