'use strict';

const { spawn } = require('child_process');
const { ipcMain } = require('electron');
const os = require('os');

/**
 * Windows 终端管理器
 * 使用 child_process 创建终端进程（当 node-pty 不可用时的备选方案）
 */
class WindowsTerminal {
  constructor() {
    this.terminals = new Map();
    this.defaultShell = this.getDefaultShell();
  }

  /**
   * 获取默认 Shell
   */
  getDefaultShell() {
    if (process.platform === 'win32') {
      // Windows: 优先使用 PowerShell，然后是 CMD
      const shells = [
        'pwsh.exe',        // PowerShell Core
        'powershell.exe',  // Windows PowerShell
        'cmd.exe'          // Command Prompt
      ];
      
      // 检查可用的 shell
      for (const shell of shells) {
        try {
          const result = require('child_process').execSync(`where ${shell}`, { encoding: 'utf8' });
          if (result) {
            return shell;
          }
        } catch (e) {
          // 继续尝试下一个
        }
      }
      
      return 'cmd.exe'; // 默认使用 CMD
    }
    return '/bin/bash';
  }

  /**
   * 创建终端进程
   */
  createTerminal(id, options = {}) {
    try {
      const shell = options.shell || this.defaultShell;
      const cwd = options.cwd || os.homedir();
      
      console.log(`使用 child_process 创建终端: ${id}, Shell: ${shell}`);
      
      // 创建子进程
      const shellProcess = spawn(shell, [], {
        cwd: cwd,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        shell: false,
        windowsHide: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置编码
      shellProcess.stdout.setEncoding('utf8');
      shellProcess.stderr.setEncoding('utf8');

      // 保存终端实例
      this.terminals.set(id, {
        id,
        process: shellProcess,
        shell,
        cwd,
        buffer: '',
        inputBuffer: ''
      });

      // 处理标准输出
      shellProcess.stdout.on('data', (data) => {
        this.handleOutput(id, data);
      });

      // 处理错误输出
      shellProcess.stderr.on('data', (data) => {
        this.handleOutput(id, data);
      });

      // 处理进程退出
      shellProcess.on('exit', (code) => {
        console.log(`终端 ${id} 退出，退出码: ${code}`);
        this.closeTerminal(id);
        this.sendToRenderer(id, 'terminal:exit', code);
      });

      // 处理错误
      shellProcess.on('error', (error) => {
        console.error(`终端 ${id} 错误:`, error);
        this.sendToRenderer(id, 'terminal:error', error.message);
      });

      // 发送初始提示符
      if (shell.includes('cmd')) {
        this.writeToTerminal(id, 'echo off\\r\\n');
      }

      return {
        success: true,
        id,
        pid: shellProcess.pid
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
   * 处理输出（模拟终端行为）
   */
  handleOutput(id, data) {
    const terminal = this.terminals.get(id);
    if (!terminal) return;

    // Windows 下需要处理换行符
    let output = data;
    if (process.platform === 'win32') {
      // 将 Windows 换行符转换为 Unix 换行符
      output = output.replace(/\\r\\n/g, '\\n');
      output = output.replace(/\\r/g, '\\n');
    }

    // 发送到渲染进程
    this.sendToRenderer(id, 'terminal:output', output);
  }

  /**
   * 写入数据到终端
   */
  writeToTerminal(id, data) {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.process) return;

    try {
      // 处理特殊字符
      if (data === '\\x03') { // Ctrl+C
        if (process.platform === 'win32') {
          // Windows 下发送中断信号
          terminal.process.kill('SIGINT');
        } else {
          terminal.process.stdin.write('\\x03');
        }
        return;
      }

      // 处理回车键
      if (data === '\\r' || data === '\\n') {
        data = os.EOL;
      }

      // 写入数据
      terminal.process.stdin.write(data);
    } catch (error) {
      console.error(`写入终端 ${id} 失败:`, error);
    }
  }

  /**
   * 关闭终端
   */
  closeTerminal(id) {
    const terminal = this.terminals.get(id);
    if (!terminal || !terminal.process) return;

    try {
      // 移除监听器
      terminal.process.stdout.removeAllListeners();
      terminal.process.stderr.removeAllListeners();
      terminal.process.removeAllListeners();

      // 关闭流
      terminal.process.stdin.end();
      terminal.process.stdout.destroy();
      terminal.process.stderr.destroy();

      // 终止进程
      if (process.platform === 'win32') {
        // Windows 下使用 taskkill
        try {
          require('child_process').execSync(`taskkill /PID ${terminal.process.pid} /T /F`, { encoding: 'utf8' });
        } catch (e) {
          // 忽略错误（进程可能已经退出）
        }
      } else {
        terminal.process.kill('SIGTERM');
      }

      this.terminals.delete(id);
    } catch (error) {
      console.error(`关闭终端 ${id} 失败:`, error);
    }
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(terminalId, channel, data) {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, { terminalId, data });
      }
    });
  }

  /**
   * 调整终端大小（仅作为占位符，child_process 不支持调整大小）
   */
  resizeTerminal(id, cols, rows) {
    // child_process 不支持动态调整大小
    console.log(`终端 ${id} 请求调整大小: ${cols}x${rows}（不支持）`);
  }

  /**
   * 关闭所有终端
   */
  closeAllTerminals() {
    const promises = [];
    for (const id of this.terminals.keys()) {
      promises.push(new Promise((resolve) => {
        this.closeTerminal(id);
        resolve();
      }));
    }
    return Promise.all(promises);
  }
}

module.exports = WindowsTerminal;