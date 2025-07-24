'use strict';

/**
 * 基于 xterm.js 的真实终端实现
 * 使用 node-pty 提供真实的系统终端
 */
class Terminal {
  constructor() {
    this.xterm = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.webLinksAddon = null;
    this.container = null;
    this.isReady = false;
    
    // 终端会话
    this.terminalId = null;
    this.isRealTerminal = false;  // 默认使用模拟终端
    
    // 输入处理
    this.inputHandler = null;
    this.commandHandler = null;
  }

  /**
   * 初始化终端
   * @param {HTMLElement} container - 终端容器元素
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async initialize(container) {
    if (!container) {
      console.error('Terminal: 容器元素不存在');
      return false;
    }

    this.container = container;

    try {
      // 使用保存的 xterm.js Terminal
      const XTerminal = window.XTerminal;
      
      // 检查 xterm.js 是否正确加载
      if (!XTerminal) {
        throw new Error('xterm.js 未正确加载');
      }

      // 创建 xterm 实例
      this.xterm = new XTerminal({
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selection: '#3a3d41',
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
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10000,
        tabStopWidth: 4,
        convertEol: true,
        // 在真实终端模式下，禁用本地回显
        // 这个选项可能在某些版本的 xterm.js 中可用
        localEcho: false
      });

      // 尝试加载插件（兼容不同版本的 xterm.js）
      try {
        if (window.FitAddon && window.FitAddon.FitAddon) {
          this.fitAddon = new window.FitAddon.FitAddon();
          if (this.xterm.loadAddon) {
            this.xterm.loadAddon(this.fitAddon);
          } else {
            console.warn('xterm.loadAddon 方法不存在，跳过 FitAddon');
          }
        }
        
        if (window.SearchAddon && window.SearchAddon.SearchAddon) {
          this.searchAddon = new window.SearchAddon.SearchAddon();
          if (this.xterm.loadAddon) {
            this.xterm.loadAddon(this.searchAddon);
          }
        }
        
        if (window.WebLinksAddon && window.WebLinksAddon.WebLinksAddon) {
          this.webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
          if (this.xterm.loadAddon) {
            this.xterm.loadAddon(this.webLinksAddon);
          }
        }
      } catch (error) {
        console.warn('加载 xterm.js 插件时出错:', error);
      }

      // 打开终端
      this.xterm.open(container);

      // 自适应大小
      if (this.fitAddon && this.fitAddon.fit) {
        this.fitAddon.fit();
      }

      // 监听窗口大小变化
      this._setupResizeHandler();

      // 创建真实终端会话（如果支持）
      if (window.electronAPI && window.electronAPI.terminal) {
        await this._createRealTerminal();
      } else {
        console.log('真实终端 API 不可用，使用模拟模式');
        this.isRealTerminal = false;
      }

      // 设置输入处理
      this._setupInputHandler();

      this.isReady = true;
      console.log('Terminal: 初始化成功');
      return true;

    } catch (error) {
      console.error('Terminal: 初始化失败', error);
      return false;
    }
  }

  /**
   * 设置窗口大小变化处理
   */
  _setupResizeHandler() {
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.fitAddon) {
          this.fitAddon.fit();
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // 监听容器大小变化
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(this.container);
    }
  }

  /**
   * 创建真实终端会话
   */
  async _createRealTerminal() {
    try {
      // 获取终端尺寸
      const size = this.getSize();
      
      // 创建真实终端
      const result = await window.electronAPI.terminal.create({
        cols: size.cols,
        rows: size.rows,
        cwd: process.env.HOME || process.env.USERPROFILE
      });

      if (result.success) {
        this.terminalId = result.id;
        console.log(`Terminal: 真实终端创建成功, ID: ${this.terminalId}, PID: ${result.pid}`);

        // 监听终端输出
        window.electronAPI.terminal.onOutput((terminalId, data) => {
          if (terminalId === this.terminalId && this.xterm) {
            this.xterm.write(data);
          }
        });

        // 监听终端退出
        window.electronAPI.terminal.onExit((terminalId, exitCode) => {
          if (terminalId === this.terminalId) {
            console.log(`Terminal: 终端退出, 退出码: ${exitCode}`);
            this.writeln(`\r\n[进程已退出，退出码: ${exitCode}]`);
            this.terminalId = null;
          }
        });
      } else {
        throw new Error(result.error || '创建终端失败');
      }
    } catch (error) {
      console.error('Terminal: 创建真实终端失败', error);
      this.isRealTerminal = false;
      // 降级到模拟终端模式
      this.writeln('⚠️ 无法创建真实终端，已切换到模拟模式');
    }
  }

  /**
   * 设置输入处理
   */
  _setupInputHandler() {
    // 处理用户输入
    this.xterm.onData((data) => {
      if (this.isRealTerminal && this.terminalId) {
        // 真实终端模式：直接发送到 PTY
        window.electronAPI.terminal.write(this.terminalId, data);
      } else if (this.inputHandler) {
        // 模拟模式：使用输入处理器
        this.inputHandler(data);
      }
    });

    // 处理按键事件
    this.xterm.onKey((e) => {
      // 可以在这里处理特殊按键
      // e.key 是字符，e.domEvent 是原始事件
    });
  }

  /**
   * 写入文本到终端
   * @param {string} text - 要写入的文本
   */
  write(text) {
    if (this.xterm) {
      this.xterm.write(text);
    }
  }

  /**
   * 写入一行文本到终端（自动添加换行）
   * @param {string} text - 要写入的文本
   */
  writeln(text = '') {
    if (this.xterm) {
      this.xterm.writeln(text);
    }
  }

  /**
   * 清空终端
   */
  clear() {
    if (this.xterm) {
      this.xterm.clear();
    }
  }

  /**
   * 重置终端
   */
  reset() {
    if (this.xterm) {
      this.xterm.reset();
    }
  }

  /**
   * 获取焦点
   */
  focus() {
    if (this.xterm) {
      this.xterm.focus();
    }
  }

  /**
   * 失去焦点
   */
  blur() {
    if (this.xterm) {
      this.xterm.blur();
    }
  }

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    if (this.xterm) {
      this.xterm.scrollToBottom();
    }
  }

  /**
   * 滚动到顶部
   */
  scrollToTop() {
    if (this.xterm) {
      this.xterm.scrollToTop();
    }
  }

  /**
   * 获取选中的文本
   * @returns {string} 选中的文本
   */
  getSelection() {
    if (this.xterm) {
      return this.xterm.getSelection();
    }
    return '';
  }

  /**
   * 清除选中
   */
  clearSelection() {
    if (this.xterm) {
      this.xterm.clearSelection();
    }
  }

  /**
   * 搜索文本
   * @param {string} term - 搜索词
   * @param {Object} options - 搜索选项
   */
  search(term, options = {}) {
    if (this.searchAddon) {
      if (options.next) {
        this.searchAddon.findNext(term, options);
      } else if (options.previous) {
        this.searchAddon.findPrevious(term, options);
      } else {
        this.searchAddon.findNext(term, options);
      }
    }
  }

  /**
   * 设置输入处理器
   * @param {Function} handler - 输入处理函数
   */
  onInput(handler) {
    this.inputHandler = handler;
  }

  /**
   * 设置命令处理器
   * @param {Function} handler - 命令处理函数
   */
  onCommand(handler) {
    this.commandHandler = handler;
  }

  /**
   * 调整终端大小
   */
  fit() {
    if (this.fitAddon) {
      this.fitAddon.fit();
      
      // 同步真实终端大小
      if (this.isRealTerminal && this.terminalId) {
        const size = this.getSize();
        window.electronAPI.terminal.resize(this.terminalId, size.cols, size.rows);
      }
    }
  }

  /**
   * 销毁终端
   */
  dispose() {
    // 关闭真实终端
    if (this.isRealTerminal && this.terminalId) {
      window.electronAPI.terminal.close(this.terminalId);
      this.terminalId = null;
    }
    
    if (this.xterm) {
      this.xterm.dispose();
    }
    this.xterm = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.webLinksAddon = null;
    this.isReady = false;
  }

  /**
   * 获取终端尺寸
   * @returns {{cols: number, rows: number}} 终端尺寸
   */
  getSize() {
    if (this.xterm) {
      return {
        cols: this.xterm.cols,
        rows: this.xterm.rows
      };
    }
    return { cols: 80, rows: 24 };
  }

  /**
   * 设置主题
   * @param {Object} theme - 主题配置
   */
  setTheme(theme) {
    if (this.xterm) {
      this.xterm.setOption('theme', theme);
    }
  }

  /**
   * 获取 xterm 实例（用于高级操作）
   * @returns {Terminal} xterm 实例
   */
  getXterm() {
    return this.xterm;
  }
}

// 导出（使用不同的名称避免冲突）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Terminal;
} else {
  window.MiaodaTerminal = Terminal;
}