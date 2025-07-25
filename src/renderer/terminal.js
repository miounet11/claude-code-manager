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
      
      // 使用保存的 xterm.js Terminal
      const XTerminal = window.XTerminal;
      
      // 检查 xterm.js 是否正确加载
      if (!XTerminal || typeof XTerminal !== 'function') {
        throw new Error('xterm.js 未正确加载或不是有效的构造函数');
      }

      // 创建 xterm 实例 - 优化配置提升性能和用户体验
      this.xterm = new XTerminal({
        fontSize: 13,  // 稍微增大字体提升可读性
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontWeight: 'normal',
        letterSpacing: 0.5,  // 增加字符间距提升清晰度
        lineHeight: 1.2,  // 增加行高提升阅读体验
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selection: '#264f78',  // 改善选择高亮颜色
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
        scrollback: 15000,  // 增加历史记录容量
        tabStopWidth: 4,
        convertEol: true,
        allowTransparency: false,  // 关闭透明度提升性能
        smoothScrollDuration: 0,  // 关闭平滑滚动提升性能
        fastScrollModifier: 'alt',  // Alt+滚轮快速滚动
        // 在真实终端模式下，禁用本地回显
        localEcho: false,
        // 禁用括号粘贴模式，避免粘贴时出现乱码
        bracketedPasteMode: false
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
      // 应用滚动条样式
      container.style.overflowY = 'auto';
      container.style.maxHeight = '100%';
      this.xterm.open(container);
      
      // 拦截键盘事件，防止默认行为
      this.xterm.attachCustomKeyEventHandler((event) => {
        // 如果有输入处理器且不是真实终端，阻止默认行为
        if (this.inputHandler && !this.isRealTerminal) {
          console.log('[Terminal] 拦截键盘事件:', event.key, event.type);
          // 阻止默认的键盘输入显示
          if (event.type === 'keypress' || event.type === 'keydown') {
            return false; // false 表示阻止默认行为
          }
        }
        return true; // true 表示允许默认行为
      });

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
      this._isManualClear = false; // 初始化手动清空标志
      console.log('Terminal: 初始化成功');
      return true;

    } catch (error) {
      console.error('Terminal: 初始化失败', error);
      return false;
    }
  }

  /**
   * 设置缓冲输出机制
   */
  _setupBufferedOutput() {
    this._outputBuffer = '';
    this._flushTimer = null;
    this._maxBufferSize = 1024; // 最大缓冲区大小（字符）
    this._flushInterval = 16; // 刷新间隔（毫秒，约60fps）
  }

  /**
   * 缓冲写入数据
   */
  _writeBuffered(data) {
    if (!this.xterm) return;

    this._outputBuffer += data;

    // 如果缓冲区太大，立即刷新
    if (this._outputBuffer.length >= this._maxBufferSize) {
      this._flushBuffer();
      return;
    }

    // 设置定时刷新
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
    }

    this._flushTimer = setTimeout(() => {
      this._flushBuffer();
    }, this._flushInterval);
  }

  /**
   * 刷新缓冲区
   */
  _flushBuffer() {
    if (this._outputBuffer && this.xterm) {
      this.xterm.write(this._outputBuffer);
      this._outputBuffer = '';
    }
    
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
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

        // 监听终端输出 - 使用缓冲机制优化性能
        this._setupBufferedOutput();
        window.electronAPI.terminal.onOutput((terminalId, data) => {
          if (terminalId === this.terminalId && this.xterm) {
            this._writeBuffered(data);
          }
        });

        // 监听终端退出
        window.electronAPI.terminal.onExit((terminalId, exitCode) => {
          if (terminalId === this.terminalId) {
            console.log(`Terminal: 终端退出, 退出码: ${exitCode}`);
            this.writeln(`\r\n[进程已退出，退出码: ${exitCode}]`);
            // 使用 electronAPI 记录日志而不是直接使用 fs
            window.electronAPI.terminal.logTerminalOutput(`\r\n[进程已退出，退出码: ${exitCode}]\n`)
              .catch(error => console.error('Failed to log terminal output:', error));
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
    // 添加是否自动回显的标志
    this.autoEcho = false; // 关闭自动回显，让输入处理器负责回显
    
    // 处理用户输入
    this.xterm.onData((data) => {
      // 详细日志：监控所有输入
      console.log('[Terminal.onData] 收到输入:', JSON.stringify(data), {
        charCode: data.charCodeAt(0),
        isRealTerminal: this.isRealTerminal,
        hasInputHandler: !!this.inputHandler,
        autoEcho: this.autoEcho,
        inputEnabled: this.inputEnabled
      });
      
      if (this.isRealTerminal && this.terminalId) {
        // 真实终端模式：直接发送到 PTY
        console.log('[Terminal.onData] 发送到真实终端');
        window.electronAPI.terminal.write(this.terminalId, data);
      } else if (this.inputHandler) {
        // 模拟模式：直接调用输入处理器，让它负责回显
        console.log('[Terminal.onData] 调用inputHandler');
        this.inputHandler(data);
      } else if (this.autoEcho) {
        // 只有在明确启用自动回显时才回显
        console.log('[Terminal.onData] 自动回显');
        this.write(data);
      } else {
        // 如果没有任何处理器且自动回显关闭，不做任何操作
        console.log('[Terminal.onData] 无操作（没有处理器且自动回显关闭）');
      }
    });

    // 处理按键事件
    this.xterm.onKey(() => {
      // 可以在这里处理特殊按键
    });
  }

  /**
   * 写入文本到终端
   * @param {string} text - 要写入的文本
   */
  write(text) {
    if (this.xterm) {
      console.log('[Terminal.write] 写入文本:', JSON.stringify(text), {
        length: text.length,
        caller: new Error().stack.split('\n')[2].trim()
      });
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
      
      // 记录到日志文件
      window.electronAPI.terminal.logTerminalOutput(text)
        .catch(error => console.error('Failed to log terminal output:', error));
      
      // 自动保存重要内容
      this._autoSaveImportantContent(text);
    }
  }
  
  /**
   * 检查终端是否包含重要内容
   */
  _hasImportantContent() {
    if (!this.xterm || !this.xterm.buffer) return false;
    
    try {
      const buffer = this.xterm.buffer.active;
      let fullContent = '';
      
      // 获取所有可见行的内容
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          fullContent += line.translateToString(true);
        }
      }
      
      // 检查是否包含重要关键词
      const importantKeywords = [
        'Claude', 'API', '配置', 'sk-', 'http', 'https',
        '错误', 'Error', '失败', 'Failed', '成功', 'Success',
        '启动', '停止', '运行', 'Running', 'Started',
        '✅', '❌', '⚠️', '💡', '🚀', '📝'
      ];
      
      // 检查是否包含重要内容
      const hasImportantKeyword = importantKeywords.some(keyword => 
        fullContent.includes(keyword)
      );
      
      // 如果内容较长（超过500字符）或包含重要关键词，认为是重要内容
      return fullContent.length > 500 || hasImportantKeyword;
      
    } catch (error) {
      console.error('Terminal: 检查重要内容失败', error);
      // 出错时保守处理，认为有重要内容
      return true;
    }
  }
  
  /**
   * 自动保存重要内容
   */
  _autoSaveImportantContent(text) {
    // 检测是否是重要内容（Claude的回复、用户的问题等）
    const isImportant = text.includes('Claude') || 
                       text.includes('✨') || 
                       text.includes('💡') ||
                       text.includes('API') ||
                       text.includes('配置') ||
                       text.length > 50; // 较长的文本可能是重要内容
    
    if (isImportant) {
      // 标记最后一次重要内容时间
      this._lastImportantContent = Date.now();
      
      // 设置自动保存定时器（5分钟后自动保存）
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
      }
      
      this._autoSaveTimer = setTimeout(() => {
        this._saveToHistory('auto_save_important');
        console.log('Terminal: 重要内容已自动保存到历史记录');
      }, 5 * 60 * 1000); // 5分钟
    }
  }

  /**
   * 保存终端内容到历史记录
   * @param {string} reason - 保存原因
   */
  _saveToHistory(reason = 'manual_save') {
    if (!this.xterm) return;
    
    try {
      const buffer = this.xterm.buffer.active;
      const content = [];
      
      // 获取所有可见行的内容
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content.push(line.translateToString(true));
        }
      }
      
      const historyEntry = {
        timestamp: new Date().toISOString(),
        content: content.join('\n'),
        reason: reason,
        id: Date.now()
      };
      
      // 保存到 localStorage
      const history = JSON.parse(localStorage.getItem('terminal_history') || '[]');
      history.unshift(historyEntry);
      
      // 只保留最近的50条记录
      if (history.length > 50) {
        history.splice(50);
      }
      
      localStorage.setItem('terminal_history', JSON.stringify(history));
      
      // 同时写入日志文件
      this._logToFile(`\n=== 终端历史记录保存 [${reason}] - ${historyEntry.timestamp} ===\n${historyEntry.content}\n=== 历史记录结束 ===\n`);
      
      console.log(`Terminal: 历史记录已保存 (ID: ${historyEntry.id})`);
      return historyEntry.id;
    } catch (error) {
      console.error('Terminal: 保存历史记录失败', error);
      return null;
    }
  }
  
  /**
   * 写入内容到日志文件
   * @param {string} content - 要写入的内容
   */
  _logToFile(content) {
    try {
      window.electronAPI.terminal.logTerminalOutput(content)
        .catch(error => console.error('Failed to log to file:', error));
    } catch (error) {
      console.error('Terminal: 日志写入失败', error);
    }
  }
  
  /**
   * 手动清空终端（带用户确认和历史保存）
   */
  manualClear() {
    if (!this.xterm) return;
    
    const confirmMessage = `确定要清空终端内容吗？

📝 您的重要对话内容将被保存到：
• 本地历史记录（可随时查看）
• 日志文件（永久保存）

清空后可以使用以下命令恢复：
• history - 查看历史记录
• restore <编号> - 恢复指定历史记录`;

    if (confirm(confirmMessage)) {
      const historyId = this._saveToHistory('manual_clear');
      this.xterm.clear();
      this.writeln('✅ 终端已清空，内容已保存到历史记录');
      if (historyId) {
        this.writeln(`💡 输入 "history" 查看历史记录，输入 "restore ${historyId}" 恢复内容`);
      }
    }
  }
  
  /**
   * 内部自动清空（用于系统内部调用）
   */
  _autoClear() {
    if (!this.xterm) return;
    
    // 自动保存到历史记录
    this._saveToHistory('auto_clear');
    this.xterm.clear();
    console.log('Terminal: 自动清空并已保存历史记录');
  }
  
  /**
   * 清空终端（智能处理）
   */
  clear() {
    // 如果是欢迎菜单调用，检查是否有重要内容需要保存
    if (window.isInWelcomeMenu) {
      // 即使是欢迎菜单，也要检查是否有重要内容
      if (this._hasImportantContent()) {
        console.log('Terminal: 欢迎菜单清空前检测到重要内容，自动保存');
        this._saveToHistory('auto_save_before_menu');
      }
      this._autoClear();
      return;
    }
    
    // 如果终端内容很少（少于10行），允许清空
    if (this.xterm && this.xterm.buffer.active.length < 10) {
      this._autoClear();
      return;
    }
    
    // 其他情况，需要用户确认
    console.warn('Terminal: 检测到重要内容，请使用 manualClear() 进行确认清空');
    this.writeln('\r\n\x1b[33m⚠️ 终端包含重要内容，如需清空请：\x1b[0m');
    this.writeln('\x1b[32m• 点击"清空"按钮\x1b[0m');
    this.writeln('\x1b[32m• 或输入 Ctrl+L\x1b[0m');
    this.writeln('\x1b[90m提示：清空前会自动保存内容到历史记录\x1b[0m\r\n');
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
    console.log('[Terminal.onInput] 设置输入处理器:', !!handler, {
      previousHandler: !!this.inputHandler,
      caller: new Error().stack.split('\n')[2].trim()
    });
    this.inputHandler = handler;
  }
  
  /**
   * 设置是否自动回显输入
   * @param {boolean} enabled - 是否启用自动回显
   */
  setAutoEcho(enabled) {
    this.autoEcho = enabled;
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
    try {
      // 先清理缓冲区定时器
      if (this._flushTimer) {
        clearTimeout(this._flushTimer);
        this._flushTimer = null;
      }
      
      // 清理自动保存定时器
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = null;
      }
      
      // 关闭真实终端
      if (this.isRealTerminal && this.terminalId && window.electronAPI && window.electronAPI.terminal) {
        window.electronAPI.terminal.close(this.terminalId);
        this.terminalId = null;
      }
      
      // 清理插件
      if (this.fitAddon) {
        try {
          this.fitAddon.dispose();
        } catch (e) {
          console.warn('Terminal: 清理 fitAddon 时出错', e);
        }
        this.fitAddon = null;
      }
      
      if (this.searchAddon) {
        try {
          this.searchAddon.dispose();
        } catch (e) {
          console.warn('Terminal: 清理 searchAddon 时出错', e);
        }
        this.searchAddon = null;
      }
      
      if (this.webLinksAddon) {
        try {
          this.webLinksAddon.dispose();
        } catch (e) {
          console.warn('Terminal: 清理 webLinksAddon 时出错', e);
        }
        this.webLinksAddon = null;
      }
      
      // 最后清理 xterm 实例
      if (this.xterm) {
        try {
          this.xterm.dispose();
        } catch (e) {
          console.warn('Terminal: 清理 xterm 时出错', e);
        }
        this.xterm = null;
      }
      
      this.isReady = false;
      console.log('Terminal: 已销毁');
    } catch (error) {
      console.error('Terminal: 销毁时出错', error);
    }
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