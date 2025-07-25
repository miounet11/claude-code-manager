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
    
    // 设置更长的超时时间，并捕获所有输出
    const npmInstallOptions = {
      timeout: 120000, // 2分钟超时
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10 // 10MB缓冲区
    };
    
    // 根据平台设置合适的环境
    if (process.platform === 'win32') {
      npmInstallOptions.shell = true;
      npmInstallOptions.env = { ...process.env };
    }
    
    try {
      const { stdout, stderr } = await execPromise('npm install -g @anthropic-ai/claude-code', npmInstallOptions);
      
      console.log('npm 安装输出:', stdout);
      if (stderr) console.log('npm 警告:', stderr);
      
      // 验证安装是否成功
      try {
        await execPromise('claude --version', { timeout: 5000 });
        return {
          success: true,
          message: 'Claude Code 安装成功！'
        };
      } catch (verifyError) {
        // 可能需要刷新 PATH
        return {
          success: true,
          message: 'Claude Code 已安装，请重启应用以刷新环境变量'
        };
      }
    } catch (npmError) {
      console.log('npm 安装失败:', npmError.message);
      
      // 如果是权限问题，提供更详细的指引
      if (npmError.message.includes('EACCES') || npmError.message.includes('permission')) {
        return {
          success: false,
          message: '权限不足，请使用管理员权限运行，或尝试：',
          instructions: [
            'macOS/Linux: sudo npm install -g @anthropic-ai/claude-code',
            'Windows: 以管理员身份运行命令提示符'
          ]
        };
      }
      
      // 尝试 UV 作为备选
      try {
        console.log('尝试使用 UV 安装...');
        const { stdout: uvOut, stderr: uvErr } = await execPromise('uv tool install claude-code', {
          timeout: 60000,
          encoding: 'utf8'
        });
        
        console.log('UV 安装输出:', uvOut);
        
        return {
          success: true,
          message: 'Claude Code 通过 UV 安装成功'
        };
      } catch (uvError) {
        // UV 也失败了
        console.log('UV 安装也失败:', uvError.message);
      }
      
      // 提供详细的错误信息
      return {
        success: false,
        message: `安装失败: ${npmError.message}`,
        instructions: [
          '请尝试手动安装：',
          '1. 打开终端/命令提示符',
          '2. 运行: npm install -g @anthropic-ai/claude-code',
          '3. 如果失败，尝试: sudo npm install -g @anthropic-ai/claude-code',
          '4. 安装成功后重启应用'
        ]
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `安装过程出错: ${error.message}`,
      instructions: [
        '请手动安装 Claude Code：',
        'npm install -g @anthropic-ai/claude-code'
      ]
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