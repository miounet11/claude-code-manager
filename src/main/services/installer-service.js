'use strict';

const { spawn } = require('child_process');
const { dialog } = require('electron');

/**
 * 安装服务 - 负责安装各种依赖
 */
class InstallerService {
  constructor() {
    this.isInstalling = false;
    this.currentInstall = null;
  }

  /**
   * 安装指定的依赖
   */
  async install(dependency, progressCallback) {
    if (this.isInstalling) {
      throw new Error('已有安装任务正在进行');
    }

    this.isInstalling = true;
    this.currentInstall = dependency;

    try {
      let result;
      
      switch (dependency) {
        case 'nodejs':
          result = await this.installNodejs(progressCallback);
          break;
        case 'git':
          result = await this.installGit(progressCallback);
          break;
        case 'claude':
          result = await this.installClaude(progressCallback);
          break;
        case 'uv':
          result = await this.installUV(progressCallback);
          break;
        default:
          throw new Error(`未知的依赖: ${dependency}`);
      }

      return result;
    } finally {
      this.isInstalling = false;
      this.currentInstall = null;
    }
  }

  /**
   * 批量安装依赖
   */
  async installMultiple(dependencies, progressCallback) {
    const results = {};
    
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      
      if (progressCallback) {
        progressCallback({
          type: 'batch_progress',
          current: i + 1,
          total: dependencies.length,
          dependency: dep,
          status: 'installing'
        });
      }

      try {
        results[dep] = await this.install(dep, (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              batchCurrent: i + 1,
              batchTotal: dependencies.length
            });
          }
        });
      } catch (error) {
        results[dep] = {
          success: false,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * 安装 Node.js
   */
  async installNodejs(progressCallback) {
    // Node.js 需要手动安装
    const platform = process.platform;
    
    const instructions = {
      darwin: {
        title: '安装 Node.js - macOS',
        steps: [
          '方法 1: 使用 Homebrew（推荐）',
          '1. 打开终端',
          '2. 运行: brew install node',
          '',
          '方法 2: 官方安装包',
          '1. 访问 https://nodejs.org',
          '2. 下载 macOS 安装包',
          '3. 双击安装'
        ],
        downloadUrl: 'https://nodejs.org'
      },
      win32: {
        title: '安装 Node.js - Windows',
        steps: [
          '1. 访问 https://nodejs.org',
          '2. 下载 Windows 安装包',
          '3. 运行安装程序',
          '4. 确保勾选 "Add to PATH"',
          '5. 完成安装后重启应用'
        ],
        downloadUrl: 'https://nodejs.org'
      },
      linux: {
        title: '安装 Node.js - Linux',
        steps: [
          'Ubuntu/Debian:',
          '  sudo apt update',
          '  sudo apt install nodejs npm',
          '',
          'CentOS/RHEL:',
          '  sudo yum install nodejs npm',
          '',
          'Arch:',
          '  sudo pacman -S nodejs npm'
        ]
      }
    };

    const info = instructions[platform] || instructions.linux;
    
    if (progressCallback) {
      progressCallback({
        type: 'manual_install',
        dependency: 'nodejs',
        instructions: info
      });
    }

    return {
      success: false,
      manual: true,
      instructions: info
    };
  }

  /**
   * 安装 Git
   */
  async installGit(progressCallback) {
    const platform = process.platform;
    
    const instructions = {
      darwin: {
        title: '安装 Git - macOS',
        steps: [
          'macOS 通常已预装 Git',
          '',
          '如果没有，请选择以下方法：',
          '',
          '方法 1: Xcode Command Line Tools',
          '  xcode-select --install',
          '',
          '方法 2: Homebrew',
          '  brew install git'
        ]
      },
      win32: {
        title: '安装 Git - Windows',
        steps: [
          '1. 访问 https://git-scm.com/download/win',
          '2. 下载 Git for Windows',
          '3. 运行安装程序',
          '4. 使用默认设置即可'
        ],
        downloadUrl: 'https://git-scm.com/download/win'
      },
      linux: {
        title: '安装 Git - Linux',
        steps: [
          'Ubuntu/Debian:',
          '  sudo apt update',
          '  sudo apt install git',
          '',
          'CentOS/RHEL:',
          '  sudo yum install git',
          '',
          'Arch:',
          '  sudo pacman -S git'
        ]
      }
    };

    const info = instructions[platform] || instructions.linux;
    
    if (progressCallback) {
      progressCallback({
        type: 'manual_install',
        dependency: 'git',
        instructions: info
      });
    }

    return {
      success: false,
      manual: true,
      instructions: info
    };
  }

  /**
   * 安装 Claude Code
   */
  async installClaude(progressCallback) {
    if (progressCallback) {
      progressCallback({
        type: 'progress',
        dependency: 'claude',
        status: 'checking',
        message: '检查 npm 是否可用...'
      });
    }

    // 检查 npm 是否可用
    const npmCheck = await this.executeCommand('npm', ['--version']);
    if (!npmCheck.success) {
      return {
        success: false,
        error: '需要先安装 Node.js（包含 npm）'
      };
    }

    if (progressCallback) {
      progressCallback({
        type: 'progress',
        dependency: 'claude',
        status: 'installing',
        message: '正在安装 Claude Code CLI...'
      });
    }

    // 执行安装 - 使用正确的包名
    const result = await this.executeCommand('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      timeout: 180000, // 3分钟
      env: {
        ...process.env,
        // 确保 npm 使用正确的路径
        PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${process.env.PATH || ''}`,
        // 避免权限问题
        npm_config_unsafe_perm: 'true'
      }
    });

    if (result.success) {
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          dependency: 'claude',
          status: 'verifying',
          message: '验证安装...'
        });
      }

      // 验证安装 - 尝试多个可能的路径
      let verifyResult = await this.executeCommand('claude', ['--version']);
      
      // 如果直接命令失败，尝试完整路径
      if (!verifyResult.success) {
        const possiblePaths = [
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
          `${process.env.HOME}/.npm-global/bin/claude`,
          '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude'
        ];
        
        for (const claudePath of possiblePaths) {
          const pathResult = await this.executeCommand(claudePath, ['--version']);
          if (pathResult.success) {
            verifyResult = pathResult;
            break;
          }
        }
      }
      
      if (verifyResult.success) {
        return {
          success: true,
          message: 'Claude Code 安装成功',
          version: verifyResult.stdout
        };
      } else {
        return {
          success: true,
          message: 'Claude Code 已安装，请重启应用以刷新环境变量',
          needsRestart: true
        };
      }
    } else {
      // 检查是否是权限问题
      if (result.stderr && (result.stderr.includes('EACCES') || result.stderr.includes('permission'))) {
        return {
          success: false,
          error: '权限不足',
          instructions: {
            title: '解决权限问题',
            steps: [
              '方法 1: 使用 sudo（macOS/Linux）',
              '  sudo npm install -g @anthropic-ai/claude-code',
              '',
              '方法 2: 修改 npm 全局目录',
              '  mkdir ~/.npm-global',
              '  npm config set prefix "~/.npm-global"',
              '  export PATH=~/.npm-global/bin:$PATH',
              '  npm install -g @anthropic-ai/claude-code'
            ]
          }
        };
      }

      return {
        success: false,
        error: result.stderr || '安装失败',
        output: result.stdout
      };
    }
  }

  /**
   * 安装 UV
   */
  async installUV(progressCallback) {
    if (progressCallback) {
      progressCallback({
        type: 'progress',
        dependency: 'uv',
        status: 'installing',
        message: '正在安装 UV...'
      });
    }

    const platform = process.platform;

    // 尝试使用官方脚本
    if (platform === 'darwin' || platform === 'linux') {
      const scriptResult = await this.executeCommand('/bin/bash', [
        '-c',
        'curl -LsSf https://astral.sh/uv/install.sh | sh'
      ], {
        timeout: 120000
      });

      if (scriptResult.success) {
        return {
          success: true,
          message: 'UV 安装成功',
          instructions: {
            title: 'UV 已安装',
            steps: [
              'UV 已安装到 ~/.cargo/bin/uv',
              '请确保 ~/.cargo/bin 在您的 PATH 中',
              '可能需要重启应用'
            ]
          }
        };
      }
    }

    // Windows 或脚本失败
    return {
      success: false,
      manual: true,
      instructions: {
        title: '手动安装 UV',
        steps: [
          'macOS/Linux:',
          '  curl -LsSf https://astral.sh/uv/install.sh | sh',
          '',
          'Windows:',
          '  powershell -c "irm https://astral.sh/uv/install.ps1 | iex"',
          '',
          '详情访问: https://github.com/astral-sh/uv'
        ],
        downloadUrl: 'https://github.com/astral-sh/uv'
      }
    };
  }

  /**
   * 执行命令
   */
  executeCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const spawnOptions = {
        shell: true,
        timeout: options.timeout || 30000,
        windowsHide: true,
        ...options
      };

      const child = spawn(command, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          stdout,
          stderr
        });
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      // 超时处理
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: '命令执行超时',
          stdout,
          stderr
        });
      }, spawnOptions.timeout);
    });
  }

  /**
   * 取消当前安装
   */
  cancel() {
    // TODO: 实现取消逻辑
    this.isInstalling = false;
    this.currentInstall = null;
  }
}

// 导出单例
module.exports = new InstallerService();