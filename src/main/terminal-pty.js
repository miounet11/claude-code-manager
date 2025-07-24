'use strict';

const { ipcMain } = require('electron');
const os = require('os');

// 尝试加载 node-pty
let pty = null;
let isPtyAvailable = false;

try {
  pty = require('node-pty');
  isPtyAvailable = true;
  // node-pty 加载成功
} catch (error) {
  console.error('node-pty 加载失败:', error.message);
  // 真实终端功能将不可用
}

/**
 * 真实终端管理器
 * 使用 node-pty 创建真实的系统终端
 */
class TerminalPTY {
  constructor() {
    this.terminals = new Map();
    this.defaultShell = this.getDefaultShell();
    this.setupIPC();
  }

  /**
   * 获取默认 Shell
   */
  getDefaultShell() {
    if (process.platform === 'win32') {
      // Windows: 优先使用 PowerShell
      return process.env.COMSPEC || 'powershell.exe';
    } else {
      // macOS/Linux: 优先使用用户默认 shell
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * 获取 Shell 环境变量
   */
  getShellEnv() {
    const env = { ...process.env };
    
    // 设置终端类型
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';
    
    // 设置语言环境
    if (!env.LANG) {
      env.LANG = 'zh_CN.UTF-8';
    }
    
    // Windows 特殊处理
    if (process.platform === 'win32') {
      env.PYTHONIOENCODING = 'utf-8';
    }
    
    return env;
  }

  /**
   * 创建终端
   */
  createTerminal(id, options = {}) {
    if (!isPtyAvailable) {
      return {
        success: false,
        error: 'node-pty 不可用，无法创建真实终端'
      };
    }

    try {
      const shell = options.shell || this.defaultShell;
      const cwd = options.cwd || os.homedir();
      const env = this.getShellEnv();
      
      // 创建终端: ${id}, Shell: ${shell}, 工作目录: ${cwd}
      
      // 创建 PTY 进程
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: cwd,
        env: env,
        encoding: 'utf8',
        // 重要：不要在 PTY 层禁用回显，让 shell 自己处理
        // 这样可以支持密码输入等需要隐藏字符的场景
      });

      // 保存终端实例
      this.terminals.set(id, {
        id,
        pty: ptyProcess,
        shell,
        cwd
      });

      // 处理终端输出
      ptyProcess.onData((data) => {
        this.sendToRenderer(id, 'terminal:output', data);
      });

      // 处理终端退出
      ptyProcess.onExit((exitCode) => {
        // 终端 ${id} 退出，退出码: ${exitCode}
        this.closeTerminal(id);
        this.sendToRenderer(id, 'terminal:exit', exitCode);
      });

      return {
        success: true,
        id,
        pid: ptyProcess.pid
      };
    } catch (error) {
      console.error('创建终端失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 写入数据到终端
   */
  writeToTerminal(id, data) {
    const terminal = this.terminals.get(id);
    if (terminal && terminal.pty) {
      terminal.pty.write(data);
    }
  }

  /**
   * 调整终端大小
   */
  resizeTerminal(id, cols, rows) {
    const terminal = this.terminals.get(id);
    if (terminal && terminal.pty) {
      terminal.pty.resize(cols, rows);
    }
  }

  /**
   * 关闭终端
   */
  closeTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      if (terminal.pty) {
        try {
          terminal.pty.kill();
        } catch (error) {
          console.error('关闭终端进程失败:', error);
        }
      }
      this.terminals.delete(id);
    }
  }

  /**
   * 关闭所有终端
   */
  closeAllTerminals() {
    for (const id of this.terminals.keys()) {
      this.closeTerminal(id);
    }
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(terminalId, channel, data) {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, { terminalId, data });
      }
    });
  }

  /**
   * 设置 IPC 通信
   */
  setupIPC() {
    // 创建终端
    ipcMain.handle('terminal:create', (event, options) => {
      const id = options.id || `terminal-${Date.now()}`;
      return this.createTerminal(id, options);
    });

    // 写入数据
    ipcMain.on('terminal:write', (event, { id, data }) => {
      this.writeToTerminal(id, data);
    });

    // 调整大小
    ipcMain.on('terminal:resize', (event, { id, cols, rows }) => {
      this.resizeTerminal(id, cols, rows);
    });

    // 关闭终端
    ipcMain.on('terminal:close', (event, { id }) => {
      this.closeTerminal(id);
    });

    // 获取终端信息
    ipcMain.handle('terminal:info', (event, { id }) => {
      const terminal = this.terminals.get(id);
      if (terminal) {
        return {
          id: terminal.id,
          shell: terminal.shell,
          cwd: terminal.cwd,
          pid: terminal.pty ? terminal.pty.pid : null
        };
      }
      return null;
    });

    // 执行命令（在指定终端中）
    ipcMain.handle('terminal:execute', (event, { id, command }) => {
      const terminal = this.terminals.get(id);
      if (terminal && terminal.pty) {
        terminal.pty.write(command + '\r');
        return { success: true };
      }
      return { success: false, error: '终端不存在' };
    });

    // 获取所有终端
    ipcMain.handle('terminal:list', () => {
      const list = [];
      for (const [, terminal] of this.terminals) {
        list.push({
          id: terminal.id,
          shell: terminal.shell,
          cwd: terminal.cwd,
          pid: terminal.pty ? terminal.pty.pid : null
        });
      }
      return list;
    });
  }
}

// 导出单例
module.exports = new TerminalPTY();