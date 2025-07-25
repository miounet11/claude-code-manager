'use strict';

const os = require('os');

/**
 * PTY 进程管理器
 * 提供真正的终端体验
 */
class PtyManager {
  constructor() {
    this.ptyProcess = null;
    this.mainWindow = null;
  }

  /**
   * 初始化
   */
  initialize(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 创建 PTY 进程
   */
  async createPtyProcess(options = {}) {
    try {
      // 尝试加载 node-pty
      let pty;
      try {
        pty = require('node-pty');
      } catch (e) {
        // 如果 node-pty 不可用，使用标准方式
        return this.createStandardProcess(options);
      }

      // 默认 shell
      const shell = options.shell || this.getDefaultShell();
      // 合并环境变量而不是替换
      const env = { ...process.env, ...(options.env || {}) };
      const cwd = options.cwd || os.homedir();
      const cols = options.cols || 80;
      const rows = options.rows || 30;

      // 创建 PTY
      this.ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: cols,
        rows: rows,
        cwd: cwd,
        env: env,
        encoding: 'utf8'
      });

      // 处理数据
      this.ptyProcess.onData((data) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:data', data);
        }
      });

      // 处理退出
      this.ptyProcess.onExit(({ exitCode }) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:exit', exitCode);
        }
        this.ptyProcess = null;
      });

      return {
        success: true,
        pid: this.ptyProcess.pid
      };
    } catch (error) {
      console.error('创建 PTY 失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 创建标准进程（node-pty 不可用时的备选方案）
   */
  async createStandardProcess(options = {}) {
    const { spawn } = require('child_process');
    
    try {
      const shell = options.shell || this.getDefaultShell();
      // 合并环境变量而不是替换
      const env = { ...process.env, ...(options.env || {}) };
      const cwd = options.cwd || os.homedir();

      // macOS 专用
      const command = shell;
      const args = [];

      this.ptyProcess = spawn(command, args, {
        cwd: cwd,
        env: env,
        shell: false,
        windowsHide: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置编码
      this.ptyProcess.stdout.setEncoding('utf8');
      this.ptyProcess.stderr.setEncoding('utf8');

      // 处理输出
      this.ptyProcess.stdout.on('data', (data) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:data', data);
        }
      });

      this.ptyProcess.stderr.on('data', (data) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:data', data);
        }
      });

      // 处理退出
      this.ptyProcess.on('exit', (code) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('pty:exit', code);
        }
        this.ptyProcess = null;
      });

      return {
        success: true,
        pid: this.ptyProcess.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 写入数据
   */
  write(data) {
    if (!this.ptyProcess) {
      return;
    }

    try {
      if (this.ptyProcess.write) {
        // node-pty
        this.ptyProcess.write(data);
      } else if (this.ptyProcess.stdin) {
        // 标准进程
        this.ptyProcess.stdin.write(data);
      }
    } catch (error) {
      console.error('写入失败:', error);
    }
  }

  /**
   * 调整大小
   */
  resize(cols, rows) {
    if (this.ptyProcess && this.ptyProcess.resize) {
      try {
        this.ptyProcess.resize(cols, rows);
      } catch (error) {
        console.error('调整大小失败:', error);
      }
    }
  }

  /**
   * 终止进程
   */
  kill() {
    if (!this.ptyProcess) {
      return;
    }

    try {
      if (this.ptyProcess.kill) {
        this.ptyProcess.kill();
      } else if (this.ptyProcess.pid) {
        process.kill(this.ptyProcess.pid);
      }
    } catch (error) {
      console.error('终止进程失败:', error);
    }
    
    this.ptyProcess = null;
  }

  /**
   * 获取默认 Shell（macOS 专用）
   */
  getDefaultShell() {
    // macOS - 优先使用用户的默认 shell
    // 检查 SHELL 环境变量，通常是用户的默认 shell
    if (process.env.SHELL) {
      return process.env.SHELL;
    }
    // 如果没有 SHELL 环境变量，检查 macOS 版本
    // macOS Catalina (10.15) 及以后默认使用 zsh
    const os = require('os');
    const release = os.release();
    const majorVersion = parseInt(release.split('.')[0]);
    if (majorVersion >= 19) { // Catalina 是 19.x
      return '/bin/zsh';
    }
    return '/bin/bash';
  }

  /**
   * 运行命令
   */
  runCommand(command) {
    if (this.ptyProcess) {
      this.write(command + '\r');
    }
  }
}

module.exports = PtyManager;