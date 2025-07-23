'use strict';

const { spawn } = require('child_process');

let claudeProcess = null;

async function startClaudeCode(config, mainWindow) {
  try {
    // 先检查 Claude Code 是否已安装
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      const checkCmd = process.platform === 'win32' ? 'where claude' : 'which claude';
      await execPromise(checkCmd);
    } catch (checkError) {
      mainWindow.webContents.send('terminal-data', '\n❌ Claude Code 未安装或不在系统路径中\n');
      mainWindow.webContents.send('terminal-data', '请先安装 Claude Code: npm install -g @anthropic/claude-code\n');
      return {
        success: false,
        message: 'Claude Code 未安装'
      };
    }
    
    await stopClaudeCode();
    
    // 设置环境变量
    const env = { ...process.env };
    env.CLAUDE_API_URL = config.apiUrl;
    env.CLAUDE_API_KEY = config.apiKey;
    
    mainWindow.webContents.send('terminal-data', '\n配置信息:\n');
    mainWindow.webContents.send('terminal-data', `- 配置名称: ${config.name}\n`);
    mainWindow.webContents.send('terminal-data', `- API URL: ${config.apiUrl}\n`);
    mainWindow.webContents.send('terminal-data', `- 模型: ${config.model}\n`);
    mainWindow.webContents.send('terminal-data', '\n正在启动 Claude Code...\n\n');
    
    // 根据平台选择合适的终端命令
    let terminalCmd, terminalArgs;
    
    if (process.platform === 'darwin') {
      // macOS - 使用 Terminal.app
      terminalCmd = 'osascript';
      terminalArgs = [
        '-e', 'tell application "Terminal"',
        '-e', 'activate',
        '-e', `do script "export CLAUDE_API_URL='${config.apiUrl}' && export CLAUDE_API_KEY='${config.apiKey}' && claude chat --model ${config.model}"`,
        '-e', 'end tell'
      ];
    } else if (process.platform === 'win32') {
      // Windows - 使用 cmd.exe
      terminalCmd = 'cmd.exe';
      terminalArgs = ['/c', 'start', 'cmd.exe', '/k', `set CLAUDE_API_URL=${config.apiUrl} && set CLAUDE_API_KEY=${config.apiKey} && claude chat --model ${config.model}`];
    } else {
      // Linux - 尝试使用常见的终端
      terminalCmd = 'gnome-terminal';
      terminalArgs = ['--', 'bash', '-c', `export CLAUDE_API_URL='${config.apiUrl}' && export CLAUDE_API_KEY='${config.apiKey}' && claude chat --model ${config.model}; exec bash`];
    }
    
    claudeProcess = spawn(terminalCmd, terminalArgs, {
      detached: true,
      stdio: 'ignore'
    });
    
    claudeProcess.on('error', (error) => {
      mainWindow.webContents.send('terminal-data', `\n❌ 启动错误: ${error.message}\n`);
    });
    
    // 不再跟踪进程关闭，因为它在独立终端中运行
    claudeProcess.unref();
    
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
  if (claudeProcess) {
    claudeProcess.kill();
    claudeProcess = null;
  }
}

function sendInputToClaudeCode() {
  // 因为 Claude Code 运行在独立终端中，无法直接发送输入
  // 可以在界面上提示用户
}

module.exports = {
  startClaudeCode,
  stopClaudeCode,
  sendInputToClaudeCode
};