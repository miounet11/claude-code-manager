'use strict';

/**
 * xterm.js 包装器
 * 直接使用 xterm.js 而不是自定义的 Terminal 类
 */
class XtermWrapper {
  constructor() {
    this.xterm = null;
    this.container = null;
    this.isReady = false;
    this.isRealTerminal = false; // 兼容性标志
    this.terminalId = null;
  }

  async initialize(container) {
    if (!container) {
      console.error('XtermWrapper: 容器不存在');
      return false;
    }

    try {
      // 等待 DOM 完全加载
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }

      // 检查 xterm.js 是否已加载
      if (!window.XTerminal) {
        console.error('XtermWrapper: window.XTerminal 不存在');
        return false;
      }

      console.log('XtermWrapper: 创建终端实例');
      
      // 创建 xterm 实例
      this.xterm = new window.XTerminal({
        cols: 80,
        rows: 24,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff'
        },
        cursorBlink: true
      });

      // 打开终端
      console.log('XtermWrapper: 打开终端');
      this.xterm.open(container);
      
      this.container = container;
      this.isReady = true;
      
      // 尝试创建真实终端
      if (window.electronAPI && window.electronAPI.terminal) {
        await this._createRealTerminal();
      }
      
      return true;
    } catch (error) {
      console.error('XtermWrapper: 初始化失败', error);
      return false;
    }
  }

  write(text) {
    if (this.xterm) {
      this.xterm.write(text);
    }
  }

  writeln(text = '') {
    if (this.xterm) {
      this.xterm.writeln(text);
    }
  }

  clear() {
    if (this.xterm) {
      this.xterm.clear();
    }
  }

  focus() {
    if (this.xterm) {
      this.xterm.focus();
    }
  }

  /**
   * 创建真实终端
   */
  async _createRealTerminal() {
    try {
      const result = await window.electronAPI.terminal.create({
        cols: this.xterm.cols,
        rows: this.xterm.rows
      });

      if (result.success) {
        this.terminalId = result.id;
        this.isRealTerminal = true;
        console.log(`XtermWrapper: 真实终端创建成功, ID: ${this.terminalId}, PID: ${result.pid}`);

        // 监听终端输出
        window.electronAPI.terminal.onOutput((terminalId, data) => {
          if (terminalId === this.terminalId && this.xterm) {
            this.xterm.write(data);
          }
        });

        // 监听终端退出
        window.electronAPI.terminal.onExit((terminalId, exitCode) => {
          if (terminalId === this.terminalId) {
            console.log(`XtermWrapper: 终端退出, 退出码: ${exitCode}`);
            this.writeln(`\r\n[进程已退出，退出码: ${exitCode}]`);
            this.terminalId = null;
            this.isRealTerminal = false;
          }
        });

        // 设置输入处理
        this.xterm.onData((data) => {
          if (this.isRealTerminal && this.terminalId) {
            window.electronAPI.terminal.write(this.terminalId, data);
          }
        });
        
        // 在真实终端模式下，尝试禁用本地键盘事件处理
        // 这样可以防止 xterm.js 显示输入的字符
        this.xterm.attachCustomKeyEventHandler((event) => {
          if (this.isRealTerminal && event.type === 'keypress') {
            // 在真实终端模式下，阻止默认的按键处理
            // PTY 会发送回显的字符
            return false;
          }
          return true;
        });
      } else {
        throw new Error(result.error || '创建终端失败');
      }
    } catch (error) {
      console.error('XtermWrapper: 创建真实终端失败', error);
      this.isRealTerminal = false;
    }
  }

  onInput(handler) {
    if (this.xterm && !this.isRealTerminal) {
      this.xterm.onData(handler);
    }
  }

  getSelection() {
    if (this.xterm && this.xterm.getSelection) {
      return this.xterm.getSelection();
    }
    return '';
  }

  getSize() {
    if (this.xterm) {
      return {
        cols: this.xterm.cols,
        rows: this.xterm.rows
      };
    }
    return { cols: 80, rows: 24 };
  }

  dispose() {
    // 关闭真实终端
    if (this.isRealTerminal && this.terminalId) {
      window.electronAPI.terminal.close(this.terminalId);
      this.terminalId = null;
    }
    
    if (this.xterm) {
      this.xterm.dispose();
      this.xterm = null;
    }
    this.isReady = false;
  }
}

// 导出
window.XtermWrapper = XtermWrapper;