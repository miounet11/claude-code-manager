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
    this.inputEnabled = true; // 控制是否允许输入到PTY
    this.inputHandler = null; // 自定义输入处理器
    this._onDataListenerSet = false; // 标记是否已设置 onData 监听器
  }

  async initialize(container) {
    if (!container) {
      // XtermWrapper: 容器不存在
      return false;
    }

    try {
      // 等待 DOM 完全加载
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          window.addEventListener('load', resolve);
        });
      }

      // 等待 xterm-ready 事件或 XTerminal 可用
      if (!window.XTerminal) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('等待 xterm.js 加载超时'));
          }, 5000);
          
          // 监听 xterm-ready 事件
          window.addEventListener('xterm-ready', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          
          // 如果已经加载，立即解决
          if (window.XTerminal) {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
      
      // 检查 xterm.js 是否已加载
      if (!window.XTerminal || typeof window.XTerminal !== 'function') {
        console.error('XtermWrapper: window.XTerminal 不存在或不是有效的构造函数');
        return false;
      }

      // 创建终端实例
      
      // 计算容器尺寸（考虑内边距）
      const containerRect = container.getBoundingClientRect();
      const fontSize = 11;
      const lineHeight = 1.1;
      const charWidth = fontSize * 0.6;
      const charHeight = fontSize * lineHeight;
      const padding = 16; // 考虑8px的内边距 x 2
      
      const cols = Math.floor((containerRect.width - padding) / charWidth) || 80;
      const rows = Math.floor((containerRect.height - padding) / charHeight) || 24;
      
      // 终端尺寸: ${cols}x${rows}
      
      // 创建 xterm 实例
      this.xterm = new window.XTerminal({
        cols: cols,
        rows: rows,
        fontSize: fontSize,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff'
        },
        cursorBlink: true,
        scrollback: 1000,
        allowTransparency: false,
        // 禁用括号粘贴模式，避免粘贴时出现乱码
        bracketedPasteMode: false
      });

      // 打开终端
      // 打开终端
      this.xterm.open(container);
      
      // 确保终端完全填充容器
      if (window.FitAddon && window.FitAddon.FitAddon) {
        const fitAddon = new window.FitAddon.FitAddon();
        this.xterm.loadAddon(fitAddon);
        
        // 立即适配尺寸
        setTimeout(() => {
          fitAddon.fit();
          // 适配后的终端尺寸
        }, 100);
        
        // 监听窗口大小变化
        const resizeObserver = new ResizeObserver(() => {
          setTimeout(() => {
            fitAddon.fit();
          }, 50);
        });
        resizeObserver.observe(container);
        
        this.fitAddon = fitAddon;
        this.resizeObserver = resizeObserver;
      }
      
      this.container = container;
      this.isReady = true;
      
      // 尝试创建真实终端
      if (window.electronAPI && window.electronAPI.terminal) {
        await this._createRealTerminal();
      }
      
      return true;
    } catch (error) {
      // XtermWrapper: 初始化失败
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
        // 真实终端创建成功

        // 监听终端输出
        window.electronAPI.terminal.onOutput((terminalId, data) => {
          if (terminalId === this.terminalId && this.xterm) {
            this.xterm.write(data);
          }
        });

        // 监听终端退出
        window.electronAPI.terminal.onExit((terminalId, exitCode) => {
          if (terminalId === this.terminalId) {
            // 终端退出
            this.writeln(`\r\n[进程已退出，退出码: ${exitCode}]`);
            this.terminalId = null;
            this.isRealTerminal = false;
          }
        });

        // 输入处理已经在 onInput 方法中统一设置
        // 不需要在这里再次设置
        
        // 在真实终端模式下，不需要阻止键盘事件
        // PTY 会自动处理回显
      } else {
        throw new Error(result.error || '创建终端失败');
      }
    } catch (error) {
      // XtermWrapper: 创建真实终端失败
      this.isRealTerminal = false;
    }
  }

  onInput(handler) {
    // 保存输入处理器，而不是直接添加新的 onData 监听器
    console.log('[XtermWrapper.onInput] 设置输入处理器:', !!handler);
    this.inputHandler = handler;
    
    // 如果还没有设置过 onData 监听器，现在设置一个统一的
    if (!this._onDataListenerSet) {
      this._onDataListenerSet = true;
      this.xterm.onData((data) => {
        console.log('[XtermWrapper.onData-unified] 收到输入:', JSON.stringify(data), {
          hasInputHandler: !!this.inputHandler,
          isRealTerminal: this.isRealTerminal
        });
        
        // 如果有自定义输入处理器，优先使用
        if (this.inputHandler) {
          this.inputHandler(data);
        } else if (this.isRealTerminal && this.terminalId && this.inputEnabled) {
          // 否则，在真实终端模式下发送到 PTY
          window.electronAPI.terminal.write(this.terminalId, data);
        }
      });
    }
  }
  
  setInputEnabled(enabled) {
    this.inputEnabled = enabled;
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
    // 清理尺寸监听器
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // 关闭真实终端
    if (this.isRealTerminal && this.terminalId) {
      window.electronAPI.terminal.close(this.terminalId);
      this.terminalId = null;
    }
    
    if (this.xterm) {
      this.xterm.dispose();
      this.xterm = null;
    }
    this.fitAddon = null;
    this.isReady = false;
  }
}

// 导出
window.XtermWrapper = XtermWrapper;