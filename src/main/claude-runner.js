'use strict';

const { spawn } = require('child_process');

// 使用数组管理所有启动的进程
const claudeProcesses = [];

// 规范化 API URL，确保兼容性
function normalizeApiUrl(apiUrl) {
  // 只移除末尾的斜杠，其他保持原样
  return apiUrl.replace(/\/$/, '');
}

async function startClaudeCode(config, mainWindow) {
  try {
    // 先检查 Claude Code 是否已安装
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      // Windows下更准确的命令检查
      let checkCmd;
      const checkOptions = { timeout: 5000, windowsHide: true };
      
      if (process.platform === 'win32') {
        checkCmd = 'where claude.exe';
        checkOptions.shell = true;
        checkOptions.env = { ...process.env };
      } else {
        checkCmd = 'which claude';
      }
      
      await execPromise(checkCmd, checkOptions);
    } catch (checkError) {
      console.log('Claude检查失败:', checkError.message);
      mainWindow.webContents.send('terminal-data', '\n❌ Claude Code 未安装或不在系统路径中\n');
      mainWindow.webContents.send('terminal-data', '请先安装 Claude Code:\n');
      
      if (process.platform === 'win32') {
        mainWindow.webContents.send('terminal-data', '  方法1: npm install -g @anthropic/claude-code\n');
        mainWindow.webContents.send('terminal-data', '  方法2: 下载Windows安装包并添加到PATH\n');
        mainWindow.webContents.send('terminal-data', '  注意: 可能需要以管理员身份运行命令提示符\n');
      } else {
        mainWindow.webContents.send('terminal-data', '  npm install -g @anthropic/claude-code\n');
      }
      
      return {
        success: false,
        message: 'Claude Code 未安装'
      };
    }
    
    // 不需要在启动前停止所有进程，允许多个实例
    
    // 设置环境变量
    const env = { ...process.env };
    
    // 检查是否为空配置（恢复官方默认设置）
    const isEmptyConfig = config.isEmptyConfig || 
                         (config.useNativeConfig && !config.apiUrl && !config.apiKey && !config.model);
    
    // 如果不是空配置，才设置环境变量
    if (!isEmptyConfig) {
      // 如果是官方配置，不设置 API URL，使用 Claude Code 默认值
      if (!config.useNativeConfig && config.apiUrl) {
        env.ANTHROPIC_BASE_URL = normalizeApiUrl(config.apiUrl);
      }
      
      // API Key 设置
      if (config.apiKey) {
        // 如果是官方配置，使用官方的环境变量名
        if (config.useNativeConfig) {
          env.ANTHROPIC_API_KEY = config.apiKey;
        } else {
          // 第三方服务可能需要 AUTH_TOKEN
          env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
        }
      }
    }
    
    mainWindow.webContents.send('terminal-data', '\n配置信息:\n');
    mainWindow.webContents.send('terminal-data', `- 配置名称: ${config.name}\n`);
    
    if (isEmptyConfig) {
      mainWindow.webContents.send('terminal-data', '- 使用 Claude Code 完全默认配置\n');
    } else {
      if (!config.useNativeConfig && config.apiUrl) {
        mainWindow.webContents.send('terminal-data', `- API URL: ${normalizeApiUrl(config.apiUrl)}\n`);
      }
      if (config.model) {
        mainWindow.webContents.send('terminal-data', `- 模型: ${config.model}\n`);
      }
    }
    
    // 检查 API Key 是否有效
    if (!config.apiKey || config.apiKey === 'YOUR_API_KEY') {
      mainWindow.webContents.send('terminal-data', '\n⚠️ 配置提示:\n');
      mainWindow.webContents.send('terminal-data', '  • 请替换为您的 API Key 以开始使用\n');
      mainWindow.webContents.send('terminal-data', '  • 访问 https://console.anthropic.com 获取免费 API Key\n');
    }
    
    mainWindow.webContents.send('terminal-data', '\n正在启动 Claude Code...\n\n');
    
    // 根据平台选择合适的终端命令
    let terminalCmd, terminalArgs;
    
    if (process.platform === 'darwin') {
      // macOS - 使用 Terminal.app
      terminalCmd = 'osascript';
      
      // 构建命令字符串
      let claudeCommand;
      if (isEmptyConfig) {
        // 空配置：只运行 claude chat，不带任何参数
        claudeCommand = 'claude chat';
      } else {
        // 构建带参数的命令
        const envExports = [];
        if (!config.useNativeConfig && config.apiUrl) {
          envExports.push(`export ANTHROPIC_BASE_URL='${normalizeApiUrl(config.apiUrl)}'`);
        }
        if (config.apiKey) {
          if (config.useNativeConfig) {
            envExports.push(`export ANTHROPIC_API_KEY='${config.apiKey}'`);
          } else {
            envExports.push(`export ANTHROPIC_AUTH_TOKEN='${config.apiKey}'`);
          }
        }
        const envString = envExports.length > 0 ? envExports.join(' && ') + ' && ' : '';
        const modelArg = config.model ? ` --model ${config.model}` : '';
        claudeCommand = `${envString}claude chat${modelArg}`;
      }
      
      terminalArgs = [
        '-e', 'tell application "Terminal"',
        '-e', 'activate',
        '-e', `do script "cd ~ && ${claudeCommand}"`,
        '-e', 'end tell'
      ];
    } else if (process.platform === 'win32') {
      // Windows - 使用 PowerShell 或 cmd.exe，支持更好的编码
      const usesPowerShell = true; // 优先使用PowerShell以获得更好的Unicode支持
      
      if (usesPowerShell) {
        terminalCmd = 'powershell.exe';
        
        let claudeCommand;
        if (isEmptyConfig) {
          // 空配置：只运行 claude chat，不带任何参数
          claudeCommand = 'cd $env:USERPROFILE; claude chat';
        } else {
          // 构建带参数的命令
          const envSets = [];
          if (!config.useNativeConfig && config.apiUrl) {
            envSets.push(`$env:ANTHROPIC_BASE_URL='${normalizeApiUrl(config.apiUrl)}'`);
          }
          if (config.apiKey) {
            if (config.useNativeConfig) {
              envSets.push(`$env:ANTHROPIC_API_KEY='${config.apiKey}'`);
            } else {
              envSets.push(`$env:ANTHROPIC_AUTH_TOKEN='${config.apiKey}'`);
            }
          }
          const envString = envSets.length > 0 ? envSets.join('; ') + '; ' : '';
          const modelArg = config.model ? ` --model ${config.model}` : '';
          claudeCommand = `${envString}cd $env:USERPROFILE; claude chat${modelArg}`;
        }
        
        terminalArgs = ['-NoExit', '-Command', claudeCommand];
      } else {
        terminalCmd = 'cmd.exe';
        
        let claudeCommand;
        if (isEmptyConfig) {
          // 空配置：只运行 claude chat，不带任何参数
          claudeCommand = 'chcp 65001 && cd %USERPROFILE% && claude.exe chat';
        } else {
          // 构建带参数的命令
          const envSets = [];
          if (!config.useNativeConfig && config.apiUrl) {
            envSets.push(`set ANTHROPIC_BASE_URL=${normalizeApiUrl(config.apiUrl)}`);
          }
          if (config.apiKey) {
            if (config.useNativeConfig) {
              envSets.push(`set ANTHROPIC_API_KEY=${config.apiKey}`);
            } else {
              envSets.push(`set ANTHROPIC_AUTH_TOKEN=${config.apiKey}`);
            }
          }
          const envString = envSets.length > 0 ? envSets.join(' && ') + ' && ' : '';
          const modelArg = config.model ? ` --model ${config.model}` : '';
          claudeCommand = `chcp 65001 && ${envString}cd %USERPROFILE% && claude.exe chat${modelArg}`;
        }
        
        terminalArgs = ['/k', claudeCommand];
      }
    } else {
      // Linux - 尝试使用常见的终端
      terminalCmd = 'gnome-terminal';
      
      let claudeCommand;
      if (isEmptyConfig) {
        // 空配置：只运行 claude chat，不带任何参数
        claudeCommand = 'cd ~ && claude chat; exec bash';
      } else {
        // 构建带参数的命令
        const envExports = [];
        if (!config.useNativeConfig && config.apiUrl) {
          envExports.push(`export ANTHROPIC_BASE_URL='${normalizeApiUrl(config.apiUrl)}'`);
        }
        if (config.apiKey) {
          if (config.useNativeConfig) {
            envExports.push(`export ANTHROPIC_API_KEY='${config.apiKey}'`);
          } else {
            envExports.push(`export ANTHROPIC_AUTH_TOKEN='${config.apiKey}'`);
          }
        }
        const envString = envExports.length > 0 ? envExports.join(' && ') + ' && ' : '';
        const modelArg = config.model ? ` --model ${config.model}` : '';
        claudeCommand = `cd ~ && ${envString}claude chat${modelArg}; exec bash`;
      }
      
      terminalArgs = ['--', 'bash', '-c', claudeCommand];
    }
    
    const newProcess = spawn(terminalCmd, terminalArgs, {
      detached: true,
      stdio: 'ignore'
    });
    
    newProcess.on('error', (error) => {
      mainWindow.webContents.send('terminal-data', `\n❌ 启动错误: ${error.message}\n`);
    });
    
    // 记录进程以便后续管理
    claudeProcesses.push({
      process: newProcess,
      config: config,
      startTime: new Date()
    });
    
    // 不再跟踪进程关闭，因为它在独立终端中运行
    newProcess.unref();
    
    mainWindow.webContents.send('terminal-data', '\n✓ Claude Code 已在新终端窗口中启动\n');
    mainWindow.webContents.send('terminal-data', '请在新打开的终端窗口中使用 Claude Code\n');
    
    return {
      success: true,
      message: 'Claude Code 已启动'
    };
  } catch (error) {
    await stopClaudeCode();
    return {
      success: false,
      message: `启动失败: ${error.message}`
    };
  }
}


async function stopClaudeCode() {
  // 停止所有 Claude 进程
  for (const processInfo of claudeProcesses) {
    try {
      if (processInfo.process && !processInfo.process.killed) {
        processInfo.process.kill();
      }
    } catch (error) {
      console.error('停止进程失败:', error);
    }
  }
  // 清空进程数组
  claudeProcesses.length = 0;
}

function sendInputToClaudeCode(/* input */) {
  // 因为 Claude Code 运行在独立终端中，无法直接发送输入
  // 返回 false 表示不支持此操作
  return false;
}

// 获取当前活动的 Claude 进程数量
function getActiveProcessCount() {
  return claudeProcesses.filter(p => p.process && !p.process.killed).length;
}

module.exports = {
  startClaudeCode,
  stopClaudeCode,
  sendInputToClaudeCode,
  getActiveProcessCount
};