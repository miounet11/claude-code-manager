'use strict';

const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * 多会话 PTY 管理器
 * 支持多个独立的终端会话
 */
class PtySessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> { ptyProcess, options, createdAt }
    this.mainWindow = null;
    this.pty = null; // node-pty 模块引用
    
    // 尝试加载 node-pty
    try {
      this.pty = require('node-pty');
    } catch (e) {
      console.warn('node-pty 不可用，将使用标准进程模式');
    }
  }

  /**
   * 初始化
   */
  initialize(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 创建新的 PTY 会话
   */
  async createSession(options = {}) {
    const sessionId = options.sessionId || uuidv4();
    
    // 检查会话是否已存在
    if (this.sessions.has(sessionId)) {
      return {
        success: false,
        error: '会话已存在',
        sessionId
      };
    }

    try {
      let session;
      
      if (this.pty) {
        // 使用 node-pty
        session = await this.createPtySession(sessionId, options);
      } else {
        // 使用标准进程
        session = await this.createStandardSession(sessionId, options);
      }
      
      // 存储会话
      this.sessions.set(sessionId, {
        ...session,
        createdAt: new Date(),
        options
      });
      
      return {
        success: true,
        sessionId,
        pid: session.process.pid
      };
    } catch (error) {
      console.error(`创建会话失败 [${sessionId}]:`, error);
      return {
        success: false,
        error: error.message,
        sessionId
      };
    }
  }

  /**
   * 创建 PTY 会话（node-pty 可用时）
   */
  async createPtySession(sessionId, options) {
    const shell = options.shell || this.getDefaultShell();
    const env = { ...process.env, ...(options.env || {}) };
    const cwd = options.cwd || os.homedir();
    const cols = options.cols || 80;
    const rows = options.rows || 30;

    // 创建 PTY
    const ptyProcess = this.pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
      encoding: 'utf8'
    });

    // 处理数据
    ptyProcess.onData((data) => {
      this.sendToRenderer('pty:data', { sessionId, data });
    });

    // 处理退出
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sendToRenderer('pty:exit', { sessionId, exitCode, signal });
      this.removeSession(sessionId);
    });

    return {
      process: ptyProcess,
      type: 'pty'
    };
  }

  /**
   * 创建标准进程会话（node-pty 不可用时）
   */
  async createStandardSession(sessionId, options) {
    const { spawn } = require('child_process');
    
    const shell = options.shell || this.getDefaultShell();
    const env = { ...process.env, ...(options.env || {}) };
    const cwd = options.cwd || os.homedir();

    const process = spawn(shell, [], {
      cwd,
      env,
      shell: false,
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 设置编码
    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');

    // 处理输出
    process.stdout.on('data', (data) => {
      this.sendToRenderer('pty:data', { sessionId, data });
    });

    process.stderr.on('data', (data) => {
      this.sendToRenderer('pty:data', { sessionId, data });
    });

    // 处理退出
    process.on('exit', (code, signal) => {
      this.sendToRenderer('pty:exit', { sessionId, exitCode: code, signal });
      this.removeSession(sessionId);
    });

    // 处理错误
    process.on('error', (error) => {
      this.sendToRenderer('pty:error', { sessionId, error: error.message });
    });

    return {
      process,
      type: 'standard'
    };
  }

  /**
   * 写入数据到指定会话
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`会话不存在: ${sessionId}`);
      return false;
    }

    try {
      if (session.type === 'pty' && session.process.write) {
        session.process.write(data);
      } else if (session.type === 'standard' && session.process.stdin) {
        session.process.stdin.write(data);
      }
      return true;
    } catch (error) {
      console.error(`写入失败 [${sessionId}]:`, error);
      return false;
    }
  }

  /**
   * 调整会话大小
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session || session.type !== 'pty') {
      return false;
    }

    try {
      if (session.process.resize) {
        session.process.resize(cols, rows);
        return true;
      }
    } catch (error) {
      console.error(`调整大小失败 [${sessionId}]:`, error);
    }
    return false;
  }

  /**
   * 终止指定会话
   */
  kill(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      if (session.process.kill) {
        session.process.kill();
      } else if (session.process.pid) {
        process.kill(session.process.pid);
      }
      this.removeSession(sessionId);
      return true;
    } catch (error) {
      console.error(`终止会话失败 [${sessionId}]:`, error);
      return false;
    }
  }

  /**
   * 终止所有会话
   */
  killAll() {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach(sessionId => this.kill(sessionId));
  }

  /**
   * 获取会话信息
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      pid: session.process.pid,
      type: session.type,
      createdAt: session.createdAt,
      options: session.options
    };
  }

  /**
   * 获取所有会话
   */
  getAllSessions() {
    const sessions = [];
    this.sessions.forEach((session, sessionId) => {
      sessions.push(this.getSession(sessionId));
    });
    return sessions;
  }

  /**
   * 移除会话
   */
  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // 发送格式：channel, sessionId, data
      if (data && data.sessionId) {
        this.mainWindow.webContents.send(channel, data.sessionId, data.data || data.exitCode || data);
      } else {
        this.mainWindow.webContents.send(channel, data);
      }
    }
  }

  /**
   * 获取默认 Shell
   */
  getDefaultShell() {
    if (process.env.SHELL) {
      return process.env.SHELL;
    }
    
    // macOS 版本检查
    const release = os.release();
    const majorVersion = parseInt(release.split('.')[0]);
    if (majorVersion >= 19) { // Catalina+
      return '/bin/zsh';
    }
    return '/bin/bash';
  }

  /**
   * 运行命令在指定会话
   */
  runCommand(sessionId, command) {
    return this.write(sessionId, command + '\r');
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.killAll();
    this.sessions.clear();
  }
}

module.exports = PtySessionManager;