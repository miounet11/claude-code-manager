'use strict';

/**
 * 终端组件 - 只显示 Claude 的输出
 */
class Terminal {
  constructor() {
    this.container = null;
    this.xterm = null;
    this.fitAddon = null;
    this.isReady = false;
  }

  /**
   * 挂载组件
   */
  async mount(container) {
    this.container = container;
    await this.initialize();
  }

  /**
   * 初始化终端
   */
  async initialize() {
    let XTerm, FitAddon;
    
    try {
      // 动态加载 xterm
      const xtermModule = await import('xterm');
      const fitModule = await import('xterm-addon-fit');
      XTerm = xtermModule.Terminal;
      FitAddon = fitModule.FitAddon;
    } catch (error) {
      console.error('加载 xterm 失败，使用简单终端:', error);
      this.useSimpleTerminal();
      return;
    }
    
    // 添加 CSS
    this.addStyles();
    
    // 创建终端容器
    this.container.innerHTML = `
      <div class="terminal-header">
        <div class="terminal-title">
          <i class="icon icon-terminal"></i>
          <span>Claude 终端</span>
        </div>
        <div class="terminal-actions">
          <button class="btn-icon" id="btn-clear" title="清空">
            <i class="icon icon-trash"></i>
          </button>
          <button class="btn-icon" id="btn-copy" title="复制">
            <i class="icon icon-copy"></i>
          </button>
        </div>
      </div>
      <div id="terminal" class="terminal-body"></div>
    `;
    
    // 创建终端实例
    this.xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selection: '#264f78',
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
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true
    });
    
    // 添加 fit 插件
    this.fitAddon = new FitAddon();
    this.xterm.loadAddon(this.fitAddon);
    
    // 打开终端
    const terminalEl = this.container.querySelector('#terminal');
    this.xterm.open(terminalEl);
    
    // 自适应大小
    this.fitAddon.fit();
    
    // 显示欢迎信息
    this.showWelcome();
    
    // 绑定事件
    this.bindEvents();
    
    // 设置输入处理
    this.setupInputHandler();
    
    this.isReady = true;
  }

  /**
   * 添加样式
   */
  addStyles() {
    if (document.getElementById('xterm-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'xterm-styles';
    link.rel = 'stylesheet';
    link.href = 'node_modules/xterm/css/xterm.css';
    document.head.appendChild(link);
  }

  /**
   * 显示欢迎信息
   */
  showWelcome() {
    this.xterm.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
    this.xterm.writeln('\x1b[1;36m║                    Miaoda Claude Terminal                      ║\x1b[0m');
    this.xterm.writeln('\x1b[1;36m╚════════════════════════════════════════════════════════════════╝\x1b[0m');
    this.xterm.writeln('');
    this.xterm.writeln('\x1b[90m提示: 此终端仅显示 Claude 的输入输出\x1b[0m');
    this.xterm.writeln('\x1b[90m请先选择配置并启动 Claude\x1b[0m');
    this.xterm.writeln('');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 清空按钮
    this.container.querySelector('#btn-clear').addEventListener('click', () => {
      this.clear();
    });
    
    // 复制按钮
    this.container.querySelector('#btn-copy').addEventListener('click', () => {
      this.copySelection();
    });
    
    // 窗口大小变化
    window.addEventListener('resize', () => {
      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    });
  }

  /**
   * 设置输入处理
   */
  setupInputHandler() {
    this.xterm.onData((data) => {
      // 发送输入到 Claude
      window.electronAPI.sendClaudeInput(data);
    });
  }

  /**
   * 处理 Claude 输出
   */
  handleOutput(data) {
    if (!this.isReady) return;
    
    if (data.type === 'stdout') {
      this.xterm.write(data.data);
    } else if (data.type === 'stderr') {
      // 错误输出用红色显示
      this.xterm.write('\x1b[31m' + data.data + '\x1b[0m');
    }
  }

  /**
   * 显示系统消息
   */
  showSystemMessage(message, type = 'info') {
    if (!this.isReady) return;
    
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m'
    };
    
    const color = colors[type] || colors.info;
    
    this.xterm.writeln('');
    this.xterm.writeln(`${color}[系统] ${message}\x1b[0m`);
    this.xterm.writeln('');
  }

  /**
   * 清空终端
   */
  clear() {
    if (this.xterm) {
      this.xterm.clear();
      this.showWelcome();
    }
  }

  /**
   * 复制选中内容
   */
  copySelection() {
    if (this.xterm && this.xterm.hasSelection()) {
      const selection = this.xterm.getSelection();
      navigator.clipboard.writeText(selection);
      
      // 显示提示
      this.showToast('已复制到剪贴板');
    }
  }

  /**
   * 显示提示
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'terminal-toast';
    toast.textContent = message;
    
    this.container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }

  /**
   * 调整大小
   */
  resize() {
    if (this.fitAddon) {
      this.fitAddon.fit();
    }
  }

  /**
   * 使用简单终端（备用方案）
   */
  useSimpleTerminal() {
    this.container.innerHTML = `
      <div class="terminal-header">
        <div class="terminal-title">
          <i class="icon icon-terminal"></i>
          <span>Claude 终端</span>
        </div>
        <div class="terminal-actions">
          <button class="btn-icon" id="btn-clear" title="清空">
            <i class="icon icon-trash"></i>
          </button>
        </div>
      </div>
      <div id="simple-terminal" class="simple-terminal"></div>
    `;
    
    this.simpleTerminal = this.container.querySelector('#simple-terminal');
    this.simpleTerminal.innerHTML = `
      <div class="terminal-output">
        <div class="welcome-text">
          <h3>Miaoda Claude Terminal</h3>
          <p>提示: 此终端仅显示 Claude 的输入输出</p>
          <p>请先选择配置并启动 Claude</p>
        </div>
      </div>
      <div class="terminal-input-line">
        <span class="prompt">></span>
        <input type="text" class="terminal-input" placeholder="输入命令...">
      </div>
    `;
    
    // 简单的样式
    const style = document.createElement('style');
    style.textContent = `
      .simple-terminal {
        flex: 1;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 14px;
        padding: 10px;
        display: flex;
        flex-direction: column;
      }
      .terminal-output {
        flex: 1;
        overflow-y: auto;
        margin-bottom: 10px;
      }
      .welcome-text {
        text-align: center;
        padding: 40px;
        color: #969696;
      }
      .terminal-input-line {
        display: flex;
        align-items: center;
      }
      .prompt {
        margin-right: 8px;
        color: #0dbc79;
      }
      .terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #d4d4d4;
        outline: none;
        font-family: inherit;
        font-size: inherit;
      }
    `;
    document.head.appendChild(style);
    
    // 绑定简单事件
    const clearBtn = this.container.querySelector('#btn-clear');
    clearBtn.addEventListener('click', () => {
      const output = this.simpleTerminal.querySelector('.terminal-output');
      output.innerHTML = '';
    });
    
    const input = this.simpleTerminal.querySelector('.terminal-input');
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const value = input.value.trim();
        if (value) {
          window.electronAPI.sendClaudeInput(value + '\n');
          input.value = '';
        }
      }
    });
    
    this.isReady = true;
    
    // 重写输出方法
    this.handleOutput = (data) => {
      const output = this.simpleTerminal.querySelector('.terminal-output');
      const line = document.createElement('div');
      line.textContent = data.data;
      if (data.type === 'stderr') {
        line.style.color = '#cd3131';
      }
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    };
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.xterm) {
      this.xterm.dispose();
      this.xterm = null;
    }
    
    if (this.fitAddon) {
      this.fitAddon.dispose();
      this.fitAddon = null;
    }
    
    this.isReady = false;
  }
}

module.exports = { Terminal };