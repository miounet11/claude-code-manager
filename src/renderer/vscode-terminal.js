'use strict';

/**
 * VSCode 终端完美复刻
 * 使用 xterm.js + node-pty 实现真正的终端体验
 */
class VSCodeTerminal {
  constructor() {
    this.terminal = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.webLinksAddon = null;
    this.ptyProcess = null;
    this.isInitialized = false;
  }

  /**
   * 初始化终端
   */
  async initialize(container) {
    // 动态加载 xterm
    const { Terminal } = await this.loadXterm();
    const { FitAddon } = await this.loadAddon('xterm-addon-fit');
    const { SearchAddon } = await this.loadAddon('xterm-addon-search');
    const { WebLinksAddon } = await this.loadAddon('xterm-addon-web-links');

    // 创建终端 - VSCode 主题
    this.terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        cursorAccent: '#000000',
        selection: 'rgba(255, 255, 255, 0.3)',
        
        // VSCode 默认颜色
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
      
      // VSCode 字体设置
      fontFamily: '"Cascadia Code", "SF Mono", Monaco, Menlo, Consolas, "Courier New", monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      
      // 光标设置
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 1,
      
      // 功能设置
      bellStyle: 'none',
      drawBoldTextInBrightColors: true,
      fastScrollModifier: 'alt',
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      rightClickSelectsWord: true,
      
      // 滚动设置
      scrollback: 1000,
      smoothScrollDuration: 125,
      scrollSensitivity: 1,
      
      // 渲染设置
      allowProposedApi: true,
      allowTransparency: false,
      disableStdin: false,
      
      // 其他
      cols: 80,
      rows: 30,
      convertEol: true,
      termName: 'xterm-256color',
      screenReaderMode: false,
      wordSeparator: ' ()[]{}\'"`,;'
    });

    // 加载插件
    this.fitAddon = new FitAddon();
    this.searchAddon = new SearchAddon();
    this.webLinksAddon = new WebLinksAddon((event, uri) => {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(uri);
      }
    });

    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(this.searchAddon);
    this.terminal.loadAddon(this.webLinksAddon);

    // 打开终端
    this.terminal.open(container);
    
    // 自适应
    this.fit();

    // 设置自动调整大小
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        this.fit();
      });
      resizeObserver.observe(container);
    }

    // 初始化 PTY
    await this.initializePty();

    this.isInitialized = true;
  }

  /**
   * 初始化 PTY
   */
  async initializePty() {
    try {
      // 获取当前配置
      const config = await window.electronAPI.getCurrentConfig();
      
      // 创建 PTY 进程
      const result = await window.electronAPI.createPtyProcess({
        shell: this.getShell(),
        env: this.getEnvironment(config),
        cols: this.terminal.cols,
        rows: this.terminal.rows
      });

      if (result.success) {
        this.ptyProcess = result.pid;
        
        // 处理终端输入
        this.terminal.onData((data) => {
          window.electronAPI.writeToPty(data);
        });

        // 处理终端输出
        window.electronAPI.onPtyData((data) => {
          this.terminal.write(data);
        });

        // 处理终端退出
        window.electronAPI.onPtyExit((code) => {
          this.terminal.writeln(`\r\n\x1b[31m进程已退出，代码: ${code}\x1b[0m`);
          this.ptyProcess = null;
        });

        // 监听终端大小变化
        this.terminal.onResize(({ cols, rows }) => {
          window.electronAPI.resizePty(cols, rows);
        });
      }
    } catch (error) {
      console.error('初始化 PTY 失败:', error);
      this.terminal.writeln(`\x1b[31m初始化终端失败: ${error.message}\x1b[0m`);
    }
  }

  /**
   * 获取系统 Shell
   */
  getShell() {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  /**
   * 获取环境变量
   */
  getEnvironment(config) {
    const env = { ...process.env };
    
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
    
    // 设置终端类型
    env.TERM = 'xterm-256color';
    env.COLORTERM = 'truecolor';
    
    return env;
  }

  /**
   * 动态加载 xterm
   */
  async loadXterm() {
    return new Promise((resolve, reject) => {
      if (window.Terminal) {
        resolve({ Terminal: window.Terminal });
      } else {
        const script = document.createElement('script');
        script.src = '../../node_modules/xterm/lib/xterm.js';
        script.onload = () => resolve({ Terminal: window.Terminal });
        script.onerror = reject;
        document.head.appendChild(script);
      }
    });
  }

  /**
   * 动态加载插件
   */
  async loadAddon(name) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `../../node_modules/${name}/lib/${name}.js`;
      script.onload = () => {
        const addonName = name.split('-').map((part, i) => 
          i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        resolve(window[addonName]);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 调整大小
   */
  fit() {
    if (this.fitAddon) {
      try {
        this.fitAddon.fit();
      } catch (e) {
        console.error('Fit error:', e);
      }
    }
  }

  /**
   * 搜索
   */
  findNext(term, options = {}) {
    if (this.searchAddon) {
      this.searchAddon.findNext(term, options);
    }
  }

  findPrevious(term, options = {}) {
    if (this.searchAddon) {
      this.searchAddon.findPrevious(term, options);
    }
  }

  /**
   * 清屏
   */
  clear() {
    this.terminal.clear();
  }

  /**
   * 聚焦
   */
  focus() {
    this.terminal.focus();
  }

  /**
   * 失焦
   */
  blur() {
    this.terminal.blur();
  }

  /**
   * 销毁
   */
  dispose() {
    if (this.ptyProcess) {
      window.electronAPI.killPty();
    }
    if (this.terminal) {
      this.terminal.dispose();
    }
  }

  /**
   * 执行命令
   */
  runCommand(command) {
    if (this.ptyProcess) {
      window.electronAPI.writeToPty(command + '\r');
    }
  }

  /**
   * 粘贴
   */
  paste(text) {
    if (this.terminal) {
      this.terminal.paste(text);
    }
  }

  /**
   * 获取选中文本
   */
  getSelection() {
    if (this.terminal) {
      return this.terminal.getSelection();
    }
    return '';
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VSCodeTerminal;
}