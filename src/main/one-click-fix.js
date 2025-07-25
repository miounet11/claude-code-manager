'use strict';

const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const net = require('net');

/**
 * 一键修复和安装功能
 * 基于 Claude_code_proxy.sh 和 Claude_code_proxy.ps1 的逻辑
 */

// 检查端口是否被占用
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// 获取占用端口的进程信息
async function getProcessUsingPort(port) {
  try {
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
    } else if (platform === 'darwin') {
      command = `lsof -ti:${port}`;
    } else {
      command = `lsof -ti:${port}`;
    }
    
    const { stdout } = await execPromise(command);
    
    if (platform === 'win32') {
      // Windows: 解析 netstat 输出获取 PID
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          return { pid, platform };
        }
      }
    } else {
      // macOS/Linux: lsof 直接返回 PID
      const pid = stdout.trim();
      if (pid) {
        return { pid, platform };
      }
    }
  } catch (error) {
    // 没有找到进程
  }
  return null;
}

// 终止占用端口的进程
async function killProcessUsingPort(port) {
  try {
    const processInfo = await getProcessUsingPort(port);
    
    if (!processInfo) {
      return { success: true, message: '端口未被占用' };
    }
    
    const { pid, platform } = processInfo;
    
    if (platform === 'win32') {
      await execPromise(`taskkill /F /PID ${pid}`);
    } else {
      await execPromise(`kill -9 ${pid}`);
    }
    
    return {
      success: true,
      message: `已终止进程 PID: ${pid}`
    };
  } catch (error) {
    return {
      success: false,
      message: `无法终止进程: ${error.message}`
    };
  }
}

// 检测命令是否存在（改进版）
async function commandExists(command) {
  try {
    const platform = process.platform;
    const checkCmd = platform === 'win32' ? 'where' : 'which';
    
    await execPromise(`${checkCmd} ${command}`, {
      timeout: 5000,
      windowsHide: true
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

// 安装 Node.js（提供指引）
async function installNodejs() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    return {
      success: false,
      needsManual: true,
      instructions: [
        '请访问 https://nodejs.org 下载并安装 Node.js',
        '推荐下载 LTS 版本',
        '安装时确保勾选 "Add to PATH" 选项',
        '安装完成后重启应用程序'
      ]
    };
  } else if (platform === 'darwin') {
    return {
      success: false,
      needsManual: true,
      instructions: [
        '方法 1: 使用 Homebrew',
        '  brew install node',
        '',
        '方法 2: 访问 https://nodejs.org 下载安装包',
        '',
        '安装完成后重启应用程序'
      ]
    };
  } else {
    return {
      success: false,
      needsManual: true,
      instructions: [
        '使用包管理器安装:',
        '  Ubuntu/Debian: sudo apt install nodejs npm',
        '  CentOS/RHEL: sudo yum install nodejs npm',
        '  Arch: sudo pacman -S nodejs npm',
        '',
        '安装完成后重启应用程序'
      ]
    };
  }
}

// 安装 UV
async function installUV() {
  try {
    // 先尝试使用 npm 安装
    if (await commandExists('npm')) {
      console.log('尝试使用 npm 安装 UV...');
      
      try {
        await execPromise('npm install -g uv', {
          timeout: 60000,
          encoding: 'utf8'
        });
        
        return {
          success: true,
          message: 'UV 通过 npm 安装成功'
        };
      } catch (npmError) {
        console.log('npm 安装失败，尝试官方脚本...');
      }
    }
    
    // 使用官方安装脚本
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin' || platform === 'linux') {
      command = 'curl -LsSf https://astral.sh/uv/install.sh | sh';
    } else if (platform === 'win32') {
      command = 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"';
    } else {
      throw new Error(`不支持的平台: ${platform}`);
    }
    
    await execPromise(command, {
      timeout: 60000,
      encoding: 'utf8'
    });
    
    return {
      success: true,
      message: 'UV 通过官方脚本安装成功'
    };
  } catch (error) {
    return {
      success: false,
      message: `UV 安装失败: ${error.message}`,
      instructions: [
        '请手动安装 UV:',
        '  npm install -g uv',
        '或访问: https://docs.astral.sh/uv/'
      ]
    };
  }
}

// 安装 Claude Code
async function installClaudeCode() {
  try {
    // 检查 npm 是否存在
    if (!await commandExists('npm')) {
      return {
        success: false,
        message: '需要先安装 Node.js 和 npm',
        needsNodejs: true
      };
    }
    
    console.log('正在安装 Claude Code...');
    
    await execPromise('npm install -g @anthropic-ai/claude-code', {
      timeout: 120000,
      encoding: 'utf8'
    });
    
    return {
      success: true,
      message: 'Claude Code 安装成功'
    };
  } catch (error) {
    // 如果 npm 安装失败，尝试 UV
    if (await commandExists('uv')) {
      try {
        await execPromise('uv tool install claude-code', {
          timeout: 60000,
          encoding: 'utf8'
        });
        
        return {
          success: true,
          message: 'Claude Code 通过 UV 安装成功'
        };
      } catch (uvError) {
        // UV 也失败了
      }
    }
    
    return {
      success: false,
      message: `Claude Code 安装失败: ${error.message}`,
      instructions: [
        '请手动安装 Claude Code:',
        '  npm install -g @anthropic-ai/claude-code',
        '或使用 UV:',
        '  uv tool install claude-code'
      ]
    };
  }
}

// 一键修复主函数
async function oneClickFix(options = {}) {
  const results = {
    steps: [],
    success: true,
    needsRestart: false
  };
  
  try {
    // 步骤 1: 检查 Node.js
    results.steps.push({ name: '检查 Node.js', status: 'running' });
    
    if (await commandExists('node')) {
      const { stdout } = await execPromise('node -v');
      results.steps[results.steps.length - 1] = {
        name: '检查 Node.js',
        status: 'success',
        message: `已安装 ${stdout.trim()}`
      };
    } else {
      const nodeResult = await installNodejs();
      results.steps[results.steps.length - 1] = {
        name: '检查 Node.js',
        status: 'failed',
        message: 'Node.js 未安装',
        ...nodeResult
      };
      results.success = false;
      results.needsManualInstall = true;
      return results; // Node.js 是必需的，无法继续
    }
    
    // 步骤 2: 检查并安装 UV（可选）
    results.steps.push({ name: '检查 UV', status: 'running' });
    
    if (await commandExists('uv')) {
      results.steps[results.steps.length - 1] = {
        name: '检查 UV',
        status: 'success',
        message: 'UV 已安装'
      };
    } else if (options.installUV) {
      const uvResult = await installUV();
      results.steps[results.steps.length - 1] = {
        name: '安装 UV',
        status: uvResult.success ? 'success' : 'warning',
        message: uvResult.message,
        ...uvResult
      };
    } else {
      results.steps[results.steps.length - 1] = {
        name: '检查 UV',
        status: 'warning',
        message: 'UV 未安装（可选）'
      };
    }
    
    // 步骤 3: 检查并安装 Claude Code
    results.steps.push({ name: '检查 Claude Code', status: 'running' });
    
    if (await commandExists('claude')) {
      const { stdout } = await execPromise('claude --version');
      results.steps[results.steps.length - 1] = {
        name: '检查 Claude Code',
        status: 'success',
        message: `已安装 ${stdout.trim()}`
      };
    } else {
      const claudeResult = await installClaudeCode();
      results.steps[results.steps.length - 1] = {
        name: '安装 Claude Code',
        status: claudeResult.success ? 'success' : 'failed',
        message: claudeResult.message,
        ...claudeResult
      };
      
      if (!claudeResult.success) {
        results.success = false;
      } else {
        results.needsRestart = true;
      }
    }
    
    // 步骤 4: 检查端口冲突（如果提供了端口）
    if (options.checkPort) {
      results.steps.push({ name: `检查端口 ${options.checkPort}`, status: 'running' });
      
      if (await isPortInUse(options.checkPort)) {
        if (options.autoKillPort) {
          const killResult = await killProcessUsingPort(options.checkPort);
          results.steps[results.steps.length - 1] = {
            name: `清理端口 ${options.checkPort}`,
            status: killResult.success ? 'success' : 'failed',
            message: killResult.message
          };
        } else {
          results.steps[results.steps.length - 1] = {
            name: `检查端口 ${options.checkPort}`,
            status: 'warning',
            message: `端口 ${options.checkPort} 已被占用`
          };
        }
      } else {
        results.steps[results.steps.length - 1] = {
          name: `检查端口 ${options.checkPort}`,
          status: 'success',
          message: '端口可用'
        };
      }
    }
    
    // 步骤 5: 修复 macOS 损坏问题（如果在 macOS 上）
    if (process.platform === 'darwin' && options.fixMacDamage) {
      results.steps.push({ name: '修复 macOS 应用签名', status: 'running' });
      
      try {
        const appPath = options.appPath || '/Applications/Miaoda.app';
        
        // 清除隔离属性
        await execPromise(`xattr -cr "${appPath}"`);
        
        // 应用临时签名
        await execPromise(`codesign --force --deep --sign - "${appPath}"`);
        
        results.steps[results.steps.length - 1] = {
          name: '修复 macOS 应用签名',
          status: 'success',
          message: '应用签名已修复'
        };
      } catch (error) {
        results.steps[results.steps.length - 1] = {
          name: '修复 macOS 应用签名',
          status: 'warning',
          message: `签名修复失败: ${error.message}`,
          instructions: [
            '请手动运行:',
            '  sudo xattr -cr /Applications/Miaoda.app',
            '  codesign --force --deep --sign - /Applications/Miaoda.app'
          ]
        };
      }
    }
    
  } catch (error) {
    results.success = false;
    results.error = error.message;
  }
  
  return results;
}

// 导出函数
module.exports = {
  oneClickFix,
  commandExists,
  isPortInUse,
  getProcessUsingPort,
  killProcessUsingPort,
  installNodejs,
  installUV,
  installClaudeCode
};