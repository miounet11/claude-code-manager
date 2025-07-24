'use strict';

/* global Terminal, FitAddon, WebLinksAddon, SearchAddon */

/**
 * 终端管理器 - 负责终端的创建、初始化和管理
 */
class TerminalManager {
  constructor() {
    this.terminal = null;
    this.container = null;
    this.isReady = false;
    this.pendingData = [];
    this.onDataCallback = null;
  }

  /**
   * 初始化终端
   * @param {HTMLElement} container - 终端容器元素
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize(container) {
    this.container = container;
    
    try {
      // 确保 xterm.js 已加载
      await this.ensureXtermLoaded();
      
      // 创建终端实例
      this.createTerminal();
      
      // 设置插件
      await this.setupAddons();
      
      // 打开终端
      this.terminal.open(container);
      
      // 设置事件处理
      this.setupEventHandlers();
      
      // 调整大小
      this.fit();
      
      // 不再在这里显示欢迎信息，由 welcome-menu.js 接管
      // this.showWelcome();
      
      this.isReady = true;
      
      // 处理待处理的数据
      this.flushPendingData();
      
      // 确保终端获得焦点
      setTimeout(() => {
        this.focus();
      }, 100);
      
      return true;
    } catch (error) {
      console.error('终端初始化失败:', error);
      this.fallbackToSimpleTerminal();
      return false;
    }
  }

  /**
   * 确保 xterm.js 已加载
   */
  async ensureXtermLoaded() {
    // 等待最多 3 秒
    const maxWaitTime = 3000;
    const checkInterval = 100;
    let waited = 0;
    
    while (typeof Terminal === 'undefined' && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    
    if (typeof Terminal === 'undefined') {
      throw new Error('xterm.js 加载超时');
    }
  }

  /**
   * 创建终端实例
   */
  createTerminal() {
    this.terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#e4e4e4',
        cursor: '#f0f0f0',
        cursorAccent: '#000000',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#7b8bb6',
        brightMagenta: '#ff92d0',
        brightCyan: '#a4ffff',
        brightWhite: '#e6e6e6'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,  // 缩小字体从14到12
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.3,  // 增加行高以提升可读性
      letterSpacing: -0.5,  // 减小字符间距使其更紧凑
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowTransparency: false,
      macOptionIsMeta: true,
      convertEol: true,
      rendererType: 'canvas',
      // 确保终端可以接收输入
      disableStdin: false,
      tabStopWidth: 8,
      // 优化字符宽度计算
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 4.5
    });
  }

  /**
   * 设置插件
   */
  async setupAddons() {
    // Fit 插件
    if (typeof FitAddon !== 'undefined') {
      this.fitAddon = new FitAddon.FitAddon();
      this.terminal.loadAddon(this.fitAddon);
    }
    
    // Web Links 插件
    if (typeof WebLinksAddon !== 'undefined') {
      this.webLinksAddon = new WebLinksAddon.WebLinksAddon();
      this.terminal.loadAddon(this.webLinksAddon);
    }
    
    // Search 插件
    if (typeof SearchAddon !== 'undefined') {
      this.searchAddon = new SearchAddon.SearchAddon();
      this.terminal.loadAddon(this.searchAddon);
    }
  }

  /**
   * 设置事件处理
   */
  setupEventHandlers() {
    // 保存当前行输入的内容
    this.currentLine = '';
    
    // 数据输入事件
    this.terminal.onData((data) => {
      console.log('终端输入数据:', data.charCodeAt(0), data);
      
      // 如果在欢迎菜单中，完全不处理输入
      console.log('terminal-manager: window.isInWelcomeMenu =', window.isInWelcomeMenu);
      if (window.isInWelcomeMenu) {
        console.log('terminal-manager: 在欢迎菜单中，不处理输入');
        return;
      }
      
      // 处理不同的输入
      const code = data.charCodeAt(0);
      
      // 回车键
      if (data === '\r' || data === '\n') {
        this.terminal.write('\r\n');
        // 如果在欢迎菜单中，不发送命令
        if (window.isInWelcomeMenu) {
          console.log('在欢迎菜单中，不发送命令');
          this.currentLine = '';
        } else {
          // 发送完整的命令
          if (this.onDataCallback) {
            console.log('发送命令:', JSON.stringify(this.currentLine));
            this.onDataCallback(this.currentLine + '\r');
          }
          this.currentLine = '';
        }
      }
      // 退格键
      else if (code === 127 || code === 8) {
        if (this.currentLine.length > 0) {
          this.currentLine = this.currentLine.slice(0, -1);
          // 移动光标回退一格，清除字符，再回退
          this.terminal.write('\b \b');
        }
      }
      // 可打印字符
      else if (code >= 32 && code < 127) {
        this.currentLine += data;
        this.terminal.write(data);
      }
      // 其他控制字符传递给回调
      else if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });
    
    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.fit();
    });
    
    // 终端获得焦点 - 多种方式确保焦点
    this.container.addEventListener('click', () => {
      this.terminal.focus();
    });
    
    // 鼠标进入时也获得焦点
    this.container.addEventListener('mouseenter', () => {
      this.terminal.focus();
    });
    
    // 监听键盘事件，确保输入被捕获
    this.terminal.attachCustomKeyEventHandler((event) => {
      // 打印调试信息
      if (event.type === 'keydown') {
        console.log('键盘事件:', event.key, event.code, event);
      }
      // 返回 true 表示继续处理事件
      return true;
    });
    
    // 确保终端元素可以接收焦点
    const terminalElement = this.container.querySelector('.xterm');
    if (terminalElement) {
      terminalElement.setAttribute('tabindex', '0');
    }
  }

  /**
   * 显示欢迎信息
   */
  showWelcome() {
    // 清空终端
    this.terminal.clear();
    
    // ASCII 艺术字标题 - 使用亮绿色
    this.terminal.writeln('\x1b[38;2;0;255;128m███╗   ███╗██╗ █████╗  ██████╗ ██████╗  █████╗');
    this.terminal.writeln('████╗ ████║██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗');
    this.terminal.writeln('██╔████╔██║██║███████║██║   ██║██║  ██║███████║');
    this.terminal.writeln('██║╚██╔╝██║██║██╔══██║██║   ██║██║  ██║██╔══██║');
    this.terminal.writeln('██║ ╚═╝ ██║██║██║  ██║╚██████╔╝██████╔╝██║  ██║');
    this.terminal.writeln('╚═╝     ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝\x1b[0m');
    
    // 副标题 - 使用青绿色（减少间距）
    this.terminal.writeln('\x1b[38;2;100;255;180m        CLAUDE CODE MANAGER        \x1b[0m');
    this.terminal.writeln('\x1b[38;2;50;150;100m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    
    // 版本和状态信息（更紧凑的布局）
    this.terminal.write('\x1b[38;2;0;255;200m◆ v2.0.8\x1b[0m ');
    this.terminal.write('\x1b[38;2;100;100;100m│\x1b[0m ');
    this.terminal.write('\x1b[38;2;255;200;0m◆ xterm.js\x1b[0m ');
    this.terminal.write('\x1b[38;2;100;100;100m│\x1b[0m ');
    this.terminal.writeln('\x1b[38;2;255;100;100m◆ Ready\x1b[0m');
    
    // 快捷提示（更紧凑的版本）
    this.terminal.writeln('\x1b[38;2;150;150;255m┌─ Commands ────────────────────────────────────┐\x1b[0m');
    this.terminal.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mhelp\x1b[0m    - Show available commands           \x1b[38;2;150;150;255m│\x1b[0m');
    this.terminal.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mclear\x1b[0m   - Clear terminal                   \x1b[38;2;150;150;255m│\x1b[0m');
    this.terminal.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mconfig\x1b[0m  - Manage configurations            \x1b[38;2;150;150;255m│\x1b[0m');
    this.terminal.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mstart\x1b[0m   - Start Claude Code                \x1b[38;2;150;150;255m│\x1b[0m');
    this.terminal.writeln('\x1b[38;2;150;150;255m└───────────────────────────────────────────────┘\x1b[0m');
    
    // 提示信息
    this.terminal.writeln('\x1b[38;2;100;100;100m💡 Click terminal to focus • Ctrl+K to clear\x1b[0m');
    
    // 命令提示符
    this.terminal.write('\x1b[38;2;0;255;0mmiaoda\x1b[0m \x1b[38;2;100;200;255m>\x1b[0m ');
  }

  /**
   * 调整终端大小
   */
  fit() {
    if (this.fitAddon && this.terminal) {
      try {
        this.fitAddon.fit();
      } catch (error) {
        console.warn('调整终端大小失败:', error);
      }
    }
  }

  /**
   * 写入数据
   */
  write(data) {
    if (this.isReady && this.terminal) {
      this.terminal.write(data);
    } else {
      this.pendingData.push(data);
    }
  }

  /**
   * 写入行
   */
  writeln(line) {
    this.write(line + '\r\n');
  }

  /**
   * 清空终端
   */
  clear() {
    if (this.terminal) {
      this.terminal.clear();
    }
  }

  /**
   * 获得焦点
   */
  focus() {
    if (this.terminal) {
      this.terminal.focus();
    }
  }

  /**
   * 设置数据回调
   */
  onData(callback) {
    this.onDataCallback = callback;
  }

  /**
   * 处理待处理的数据
   */
  flushPendingData() {
    if (this.pendingData.length > 0) {
      this.pendingData.forEach(data => this.write(data));
      this.pendingData = [];
    }
  }

  /**
   * 回退到简单终端
   */
  fallbackToSimpleTerminal() {
    console.warn('回退到 SimpleTerminal');
    
    // 动态创建简单终端
    const SimpleTerminal = window.SimpleTerminal;
    if (SimpleTerminal) {
      const simpleTerminal = new SimpleTerminal(this.container);
      
      // 代理方法到简单终端
      this.write = (data) => simpleTerminal.write(data);
      this.writeln = (line) => simpleTerminal.writeln(line);
      this.clear = () => simpleTerminal.clear();
      this.focus = () => simpleTerminal.focus();
      this.onData = (callback) => simpleTerminal.onData(callback);
      
      this.isReady = true;
      this.flushPendingData();
    } else {
      console.error('SimpleTerminal 也不可用');
    }
  }

  /**
   * 获取选中的文本
   */
  getSelection() {
    if (this.terminal && this.terminal.getSelection) {
      return this.terminal.getSelection();
    }
    return '';
  }

  /**
   * 处理命令（用于扩展）
   */
  handleCommand(command) {
    // 可以在这里处理特殊命令
    console.log('处理命令:', command);
  }
}

// 导出到全局
window.TerminalManager = TerminalManager;