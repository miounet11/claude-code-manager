'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { ipcMain } = require('electron');

async function installDependency(dependency) {
  switch (dependency) {
  case 'uv':
    return await installUV();
  case 'claude':
    return await installClaudeCode();
  case 'nodejs':
    return await installNodejs();
  case 'git':
    return await installGit();
  default:
    throw new Error(`Unknown dependency: ${dependency}`);
  }
}

async function installUV() {
  try {
    // 先尝试使用 npm 安装（更通用的方法）
    console.log('尝试使用 npm 安装 UV...');
    
    try {
      await execPromise('npm install -g uv', {
        timeout: 60000, // 60秒超时
        encoding: 'utf8'
      });
      
      return {
        success: true,
        message: 'UV 通过 npm 安装成功'
      };
    } catch (npmError) {
      console.log('npm 安装失败，尝试官方安装脚本...');
      
      // 如果 npm 失败，尝试官方安装脚本
      const platform = process.platform;
      let command;
      
      if (platform === 'darwin' || platform === 'linux') {
        command = 'curl -LsSf https://astral.sh/uv/install.sh | sh';
      } else if (platform === 'win32') {
        command = 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"';
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      const { stderr } = await execPromise(command, {
        timeout: 60000,
        encoding: 'utf8'
      });
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }
      
      return {
        success: true,
        message: 'UV 通过官方脚本安装成功'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `UV 安装失败: ${error.message}。请手动安装: npm install -g uv`
    };
  }
}

async function installClaudeCode() {
  try {
    // 先尝试使用 npm 安装
    console.log('尝试使用 npm 安装 Claude Code...');
    
    try {
      await execPromise('npm install -g @anthropic-ai/claude-code', {
        timeout: 60000,
        encoding: 'utf8'
      });
      
      return {
        success: true,
        message: 'Claude Code 通过 npm 安装成功'
      };
    } catch (npmError) {
      console.log('npm 安装失败，尝试使用 UV...');
      
      // 如果 npm 失败，尝试 UV
      const { stderr } = await execPromise('uv tool install claude-code', {
        timeout: 60000,
        encoding: 'utf8'
      });
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(stderr);
      }
      
      return {
        success: true,
        message: 'Claude Code 通过 UV 安装成功'
      };
    }
  } catch (error) {
    if (error.message.includes('uv: command not found') || error.message.includes('uv 不是')) {
      return {
        success: false,
        message: 'Claude Code 安装失败。请使用以下命令手动安装: npm install -g @anthropic-ai/claude-code'
      };
    }
    
    return {
      success: false,
      message: `Claude Code 安装失败: ${error.message}。请手动安装: npm install -g @anthropic-ai/claude-code`
    };
  }
}

function setupInstallationHandlers(mainWindow) {
  ipcMain.handle('install-dependency', async (event, dependency) => {
    mainWindow.webContents.send('status-update', {
      message: `正在安装 ${dependency}...`
    });
    
    const result = await installDependency(dependency);
    
    mainWindow.webContents.send('status-update', {
      message: result.message
    });
    
    return result;
  });
}

async function installNodejs() {
  try {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS - 提供 Homebrew 和直接下载选项
      return {
        success: false,
        message: 'Node.js 需要手动安装。请访问 https://nodejs.org 下载安装包，或使用 Homebrew: brew install node'
      };
    } else if (platform === 'win32') {
      // Windows - 提供下载链接
      return {
        success: false,
        message: 'Node.js 需要手动安装。请访问 https://nodejs.org 下载 Windows 安装包'
      };
    } else {
      // Linux - 提供包管理器命令
      return {
        success: false,
        message: 'Node.js 需要手动安装。请使用包管理器: sudo apt install nodejs npm 或 sudo yum install nodejs npm'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Node.js 安装指导获取失败: ${error.message}`
    };
  }
}

async function installGit() {
  try {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS - Git 通常已经预装，或通过 Xcode Command Line Tools
      return {
        success: false,
        message: 'Git 需要手动安装。请运行 xcode-select --install 或使用 Homebrew: brew install git'
      };
    } else if (platform === 'win32') {
      // Windows - 提供下载链接
      return {
        success: false,
        message: 'Git 需要手动安装。请访问 https://git-scm.com/download/win 下载安装包'
      };
    } else {
      // Linux - 提供包管理器命令
      return {
        success: false,
        message: 'Git 需要手动安装。请使用包管理器: sudo apt install git 或 sudo yum install git'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Git 安装指导获取失败: ${error.message}`
    };
  }
}

module.exports = {
  installDependency,
  installUV,
  installClaudeCode,
  installNodejs,
  installGit,
  setupInstallationHandlers
};