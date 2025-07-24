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
  default:
    throw new Error(`Unknown dependency: ${dependency}`);
  }
}

async function installUV() {
  try {
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin' || platform === 'linux') {
      command = 'curl -LsSf https://astral.sh/uv/install.sh | sh';
    } else if (platform === 'win32') {
      command = 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"';
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    const { stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(stderr);
    }
    
    return {
      success: true,
      message: 'UV 安装成功'
    };
  } catch (error) {
    return {
      success: false,
      message: `UV 安装失败: ${error.message}`
    };
  }
}

async function installClaudeCode() {
  try {
    const { stderr } = await execPromise('uv tool install claude-code');
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(stderr);
    }
    
    return {
      success: true,
      message: 'Claude Code 安装成功'
    };
  } catch (error) {
    if (error.message.includes('uv: command not found')) {
      return {
        success: false,
        message: '请先安装 UV 包管理器'
      };
    }
    
    return {
      success: false,
      message: `Claude Code 安装失败: ${error.message}`
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

module.exports = {
  installDependency,
  installUV,
  installClaudeCode,
  setupInstallationHandlers
};