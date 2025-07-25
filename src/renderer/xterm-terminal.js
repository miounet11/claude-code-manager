/**
 * VSCode 风格的终端组件
 * 使用 xterm.js 实现完美的终端体验
 */

class XTerminal {
  constructor(container) {
    this.container = container;
    this.terminal = null;
    this.fitAddon = null;
    this.ptyProcess = null;
    this.sessionId = null;
    this.isInitialized = false;
    this.currentPath = '~';
    this.createUI();
  }
  
  /**
   * 创建终端 UI
   */
  createUI() {
    this.container.innerHTML = `
      <div class="xterm-wrapper" style="display: flex; flex-direction: column; height: 100%;">
        <div class="xterm-container" style="flex: 1; overflow: hidden;"></div>
        <div class="xterm-status-bar" style="
          height: 22px;
          background: #007acc;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        ">
          <div class="xterm-status-left" style="display: flex; align-items: center; gap: 15px;">
            <span class="xterm-status-path" style="opacity: 0.9;">
              <span style="opacity: 0.7;">📁</span> <span id="current-path-${this.container.id}">${this.currentPath}</span>
            </span>
            <span class="xterm-status-shell" style="opacity: 0.9;">
              <span style="opacity: 0.7;">🐚</span> <span id="shell-type-${this.container.id}">bash</span>
            </span>
          </div>
          <div class="xterm-status-right" style="display: flex; align-items: center; gap: 15px;">
            <span class="xterm-status-size" style="opacity: 0.9;">
              <span id="terminal-size-${this.container.id}">80×24</span>
            </span>
            <span class="xterm-status-encoding" style="opacity: 0.9;">UTF-8</span>
          </div>
        </div>
      </div>
    `;
    
    this.xtermContainer = this.container.querySelector('.xterm-container');
  }

  /**
   * 初始化终端
   */
  async initialize() {
    // 加载保存的设置
    const savedSettings = localStorage.getItem('terminal-settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};
    
    // 创建终端
    this.terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        cursorAccent: '#000000',
        selection: 'rgba(255, 255, 255, 0.3)',
        
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      
      fontFamily: settings.fontFamily || '"Cascadia Code", "SF Mono", Monaco, Menlo, Consolas, monospace',
      fontSize: settings.fontSize || 12,
      lineHeight: 1.1,
      letterSpacing: 0,
      
      cursorBlink: settings.cursorBlink !== undefined ? settings.cursorBlink : true,
      cursorStyle: settings.cursorStyle || 'block',
      
      scrollback: 10000,
      smoothScrollDuration: 125,
      
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}\'"`,;'
    });

    // 加载 fit 插件
    if (typeof FitAddon !== 'undefined') {
      this.fitAddon = new FitAddon.FitAddon();
      this.terminal.loadAddon(this.fitAddon);
    }

    // 打开终端
    this.terminal.open(this.xtermContainer);

    // 自适应大小
    if (this.fitAddon) {
      this.fitAddon.fit();
    }

    // 初始化 PTY
    await this.initializePty();

    // 设置事件监听
    this.setupEventListeners();

    this.isInitialized = true;
  }

  /**
   * 初始化 PTY 进程
   */
  async initializePty() {
    try {
      const config = await window.electronAPI.getCurrentConfig();
      
      const result = await window.electronAPI.createPtyProcess({
        shell: this.getShell(),
        env: this.getEnvironment(config),
        cols: this.terminal.cols,
        rows: this.terminal.rows
      });

      if (result.success) {
        this.sessionId = result.sessionId;
        // 保存到全局以支持兼容模式
        window.__currentPtySessionId = this.sessionId;
        // 处理输入
        this.terminal.onData((data) => {
          window.electronAPI.writeToPty(data, this.sessionId);
        });

        // 处理输出
        window.electronAPI.onPtyData((data, sessionId) => {
          // 只处理属于这个会话的数据
          if (!sessionId || sessionId === this.sessionId) {
            this.terminal.write(data);
          }
        });

        // 处理退出
        window.electronAPI.onPtyExit((code, sessionId) => {
          // 只处理属于这个会话的退出事件
          if (!sessionId || sessionId === this.sessionId) {
            this.terminal.writeln(`\r\n\x1b[31m进程已退出 (代码: ${code})\x1b[0m`);
            this.ptyProcess = null;
            this.sessionId = null;
          }
        });

        // 处理大小调整
        this.terminal.onResize(({ cols, rows }) => {
          window.electronAPI.resizePty(cols, rows, this.sessionId);
          // 更新状态栏显示
          const sizeEl = document.getElementById(`terminal-size-${this.container.id}`);
          if (sizeEl) {
            sizeEl.textContent = `${cols}×${rows}`;
          }
        });

        // 如果有 Claude 配置，自动运行
        if (config && config.apiKey) {
          setTimeout(() => {
            window.electronAPI.writeToPty('claude\r', this.sessionId);
          }, 500);
        }
        
        this.ptyProcess = true; // 标记 PTY 已创建
      } else {
        this.terminal.writeln('\x1b[31m初始化终端失败: ' + result.error + '\x1b[0m');
      }
    } catch (error) {
      this.terminal.writeln('\x1b[31m错误: ' + error.message + '\x1b[0m');
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 窗口大小调整
    window.addEventListener('resize', () => {
      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl+C 复制
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && this.terminal.hasSelection()) {
        e.preventDefault();
        const selection = this.terminal.getSelection();
        navigator.clipboard.writeText(selection);
      }

      // Ctrl+V 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          this.terminal.paste(text);
        });
      }

      // Ctrl+K 清屏
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.clear();
      }
    });
  }

  /**
   * 获取系统 Shell（macOS 专用）
   */
  getShell() {
    // macOS 默认使用 zsh
    return '/bin/zsh';
  }

  /**
   * 获取环境变量
   */
  getEnvironment(config) {
    const env = {};
    
    if (config) {
      if (config.apiKey) {
        env.ANTHROPIC_API_KEY = config.apiKey;
      }
      if (config.apiUrl) {
        env.ANTHROPIC_API_URL = config.apiUrl;
      }
      if (config.proxy) {
        env.HTTP_PROXY = config.proxy;
        env.HTTPS_PROXY = config.proxy;
      }
    }
    
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';
    
    return env;
  }

  /**
   * 清空终端
   */
  clear() {
    this.terminal.clear();
  }

  /**
   * 聚焦终端
   */
  focus() {
    if (this.terminal) {
      this.terminal.focus();
    }
  }

  /**
   * 写入文本
   */
  write(text) {
    if (this.terminal) {
      this.terminal.write(text);
    }
  }

  /**
   * 写入一行
   */
  writeln(text) {
    if (this.terminal) {
      this.terminal.writeln(text);
    }
  }

  /**
   * 销毁终端
   */
  dispose() {
    if (this.terminal) {
      this.terminal.dispose();
    }
    if (this.sessionId) {
      window.electronAPI.killPty(this.sessionId);
      this.sessionId = null;
    }
    // 清理全局引用
    if (window.__currentPtySessionId === this.sessionId) {
      window.__currentPtySessionId = null;
    }
  }
}

// 导出
window.XTerminal = XTerminal;