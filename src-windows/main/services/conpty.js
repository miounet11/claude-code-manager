'use strict';

const { spawn } = require('node-pty');
const EventEmitter = require('events');
const path = require('path');

/**
 * Windows ConPTY 终端管理器
 * 使用 Windows 的 ConPTY API 提供真实的终端体验
 */
class ConPTYManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.defaultShell = this.detectDefaultShell();
  }

  /**
   * 检测默认 Shell
   */
  detectDefaultShell() {
    // Windows 默认 Shell 优先级
    const shells = [
      {
        name: 'PowerShell Core',
        command: 'pwsh.exe',
        args: ['-NoLogo']
      },
      {
        name: 'PowerShell',
        command: 'powershell.exe',
        args: ['-NoLogo', '-NoProfile']
      },
      {
        name: 'Command Prompt',
        command: 'cmd.exe',
        args: []
      }
    ];

    // 检查 Windows Terminal 默认配置
    const defaultProfile = process.env.WT_PROFILE_ID;
    if (defaultProfile) {
      console.log('检测到 Windows Terminal 环境');
    }

    // 返回第一个可用的 Shell
    for (const shell of shells) {
      try {
        const testPath = this.findExecutable(shell.command);
        if (testPath) {
          console.log(`使用默认 Shell: ${shell.name}`);
          return shell;
        }
      } catch {
        continue;
      }
    }

    // 默认使用 cmd.exe
    return shells[2];
  }

  /**
   * 查找可执行文件
   */
  findExecutable(command) {
    const { execSync } = require('child_process');
    try {
      const result = execSync(`where ${command}`, { encoding: 'utf8' });
      return result.trim().split('\n')[0];
    } catch {
      return null;
    }
  }

  /**
   * 创建新的终端会话
   */
  createSession(options = {}) {
    const sessionId = this.generateSessionId();
    
    // 合并默认选项
    const sessionOptions = {
      name: `Terminal ${sessionId}`,
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.env.USERPROFILE,
      env: this.prepareEnvironment(options.env),
      shell: options.shell || this.defaultShell.command,
      shellArgs: options.shellArgs || this.defaultShell.args,
      useConpty: true, // Windows 10 1703+ 支持 ConPTY
      ...options
    };

    try {
      // 创建 PTY 进程
      const pty = spawn(
        sessionOptions.shell,
        sessionOptions.shellArgs,
        {
          name: 'xterm-256color',
          cols: sessionOptions.cols,
          rows: sessionOptions.rows,
          cwd: sessionOptions.cwd,
          env: sessionOptions.env,
          useConpty: sessionOptions.useConpty,
          conptyInheritCursor: true
        }
      );

      // 创建会话对象
      const session = {
        id: sessionId,
        pty: pty,
        options: sessionOptions,
        active: true,
        created: new Date(),
        history: []
      };

      // 设置事件处理
      pty.onData((data) => {
        session.history.push(data);
        this.emit('data', sessionId, data);
      });

      pty.onExit((exitCode, signal) => {
        session.active = false;
        this.sessions.delete(sessionId);
        this.emit('exit', sessionId, exitCode, signal);
      });

      // 保存会话
      this.sessions.set(sessionId, session);
      
      // 发送初始化命令
      this.initializeSession(session);

      return {
        success: true,
        sessionId: sessionId,
        shell: sessionOptions.shell
      };
    } catch (error) {
      console.error('创建终端会话失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 准备环境变量
   */
  prepareEnvironment(customEnv = {}) {
    const env = {
      ...process.env,
      ...customEnv,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1'
    };

    // 添加 Windows 特定的环境变量
    if (!env.PYTHONIOENCODING) {
      env.PYTHONIOENCODING = 'utf-8';
    }

    // 设置代码页为 UTF-8
    env.CHCP = '65001';

    return env;
  }

  /**
   * 初始化会话
   */
  initializeSession(session) {
    const { pty, options } = session;

    // 设置 UTF-8 编码
    pty.write('chcp 65001\r\n');
    
    // 清屏
    pty.write('cls\r\n');

    // 如果是 PowerShell，设置一些有用的别名
    if (options.shell.includes('powershell') || options.shell.includes('pwsh')) {
      pty.write('$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()\r\n');
      
      // 设置更友好的提示符
      pty.write(`function prompt { "PS " + (Get-Location) + "> " }\r\n`);
    }

    // 显示欢迎信息
    const welcomeMessage = `
===========================================
  Miaoda Terminal (Windows Edition)
  Shell: ${path.basename(options.shell)}
  Session: ${session.id}
===========================================

`;
    pty.write(welcomeMessage);
  }

  /**
   * 写入数据到终端
   */
  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      throw new Error(`会话 ${sessionId} 不存在或已关闭`);
    }

    try {
      session.pty.write(data);
    } catch (error) {
      console.error(`写入会话 ${sessionId} 失败:`, error);
      throw error;
    }
  }

  /**
   * 调整终端大小
   */
  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      return;
    }

    try {
      session.pty.resize(cols, rows);
      session.options.cols = cols;
      session.options.rows = rows;
    } catch (error) {
      console.error(`调整会话 ${sessionId} 大小失败:`, error);
    }
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      if (session.active) {
        session.pty.kill();
      }
      this.sessions.delete(sessionId);
    } catch (error) {
      console.error(`关闭会话 ${sessionId} 失败:`, error);
    }
  }

  /**
   * 获取会话信息
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      active: session.active,
      shell: session.options.shell,
      created: session.created,
      cols: session.options.cols,
      rows: session.options.rows
    };
  }

  /**
   * 获取所有会话
   */
  getAllSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push(this.getSession(id));
    }
    return sessions;
  }

  /**
   * 生成会话 ID
   */
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 执行命令（用于 Claude CLI）
   */
  async executeClaude(config) {
    const sessionId = this.generateSessionId();
    
    // 准备 Claude 环境变量
    const env = this.prepareEnvironment({
      ANTHROPIC_API_KEY: config.apiKey,
      ANTHROPIC_API_URL: config.apiUrl || 'http://localhost:8118',
      HTTP_PROXY: config.proxy,
      HTTPS_PROXY: config.proxy
    });

    // 创建专门的 Claude 会话
    const session = this.createSession({
      name: 'Claude CLI',
      env: env,
      shell: 'claude.exe',
      shellArgs: [],
      cols: 120,
      rows: 30
    });

    if (!session.success) {
      // 如果 claude.exe 不在 PATH 中，尝试使用完整路径
      const claudePath = await this.findClaudePath();
      if (claudePath) {
        return this.createSession({
          name: 'Claude CLI',
          env: env,
          shell: claudePath,
          shellArgs: [],
          cols: 120,
          rows: 30
        });
      }
    }

    return session;
  }

  /**
   * 查找 Claude 安装路径
   */
  async findClaudePath() {
    const possiblePaths = [
      path.join(process.env.LOCALAPPDATA, 'Programs', 'claude', 'claude.exe'),
      path.join(process.env.PROGRAMFILES, 'Claude', 'claude.exe'),
      path.join(process.env.USERPROFILE, '.claude', 'bin', 'claude.exe'),
      path.join(process.env.APPDATA, 'npm', 'claude.cmd')
    ];

    const fs = require('fs').promises;
    for (const claudePath of possiblePaths) {
      try {
        await fs.access(claudePath);
        return claudePath;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * 清理所有会话
   */
  cleanup() {
    for (const [sessionId, session] of this.sessions) {
      if (session.active) {
        try {
          session.pty.kill();
        } catch (error) {
          console.error(`清理会话 ${sessionId} 失败:`, error);
        }
      }
    }
    this.sessions.clear();
  }
}

module.exports = ConPTYManager;