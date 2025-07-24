// 基于 xterm.js 的终端实现
class XtermTerminal {
  constructor(container) {
    this.container = container;
    this.terminal = null;
    this.fitAddon = null;
    this.webLinksAddon = null;
    this.searchAddon = null;
    this.onDataCallback = null;
    this.isProcessing = false;
    this.commandHistory = [];
    this.historyIndex = -1;
    
    // 延迟初始化，确保库已加载
    setTimeout(() => this.setupTerminal(), 100);
  }
  
  async setupTerminal() {
    // 在浏览器环境中使用动态导入
    try {
      // 检查是否已经在全局作用域中可用
      if (typeof Terminal === 'undefined') {
        // 如果 xterm 还没有加载，我们需要通过其他方式加载
        console.error('xterm.js 未正确加载，使用备用终端');
        this.useFallbackTerminal();
        return;
      }
      
      // 使用全局的 Terminal 类（需要在 HTML 中通过 script 标签加载）
      // 这些类已经在全局作用域中，不需要重新声明
      /* global Terminal */
    
      // 创建终端实例
      this.terminal = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#cccccc',
          cursor: '#569cd6',
          cursorAccent: '#000000',
          selection: '#264f78',
          black: '#000000',
          red: '#f48771',
          green: '#6a9955',
          yellow: '#dcdcaa',
          blue: '#569cd6',
          magenta: '#c586c0',
          cyan: '#4ec9b0',
          white: '#cccccc',
          brightBlack: '#666666',
          brightRed: '#f48771',
          brightGreen: '#6a9955',
          brightYellow: '#dcdcaa',
          brightBlue: '#569cd6',
          brightMagenta: '#c586c0',
          brightCyan: '#4ec9b0',
          brightWhite: '#ffffff'
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,  // 统一字体大小
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,  // 统一行高
        letterSpacing: -0.2,  // 统一字符间距
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10000,
        allowTransparency: false,
        windowsMode: window.electronAPI && window.electronAPI.platform === 'win32',
        macOptionIsMeta: true,
        macOptionClickForcesSelection: true,
        rendererType: 'canvas',
        convertEol: true,
        wordSeparator: ' ()[]{}\'"',
        fastScrollModifier: 'alt',
        fastScrollSensitivity: 5,
        scrollSensitivity: 1,
        rightClickSelectsWord: true,
        drawBoldTextInBrightColors: true,
        minimumContrastRatio: 4.5
      });
    
      // 加载插件
      // 检查插件是否正确加载
      /* global FitAddon */
      if (typeof FitAddon !== 'undefined') {
        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);
      } else {
        console.warn('FitAddon 未能加载');
      }
    
      /* global WebLinksAddon */
      if (typeof WebLinksAddon !== 'undefined') {
        this.webLinksAddon = new WebLinksAddon.WebLinksAddon();
        this.terminal.loadAddon(this.webLinksAddon);
      } else {
        console.warn('WebLinksAddon 未能加载');
      }
    
      /* global SearchAddon */
      if (typeof SearchAddon !== 'undefined') {
        this.searchAddon = new SearchAddon.SearchAddon();
        this.terminal.loadAddon(this.searchAddon);
      } else {
        console.warn('SearchAddon 未能加载');
      }
    
      // 打开终端
      this.terminal.open(this.container);
    
      // 自适应大小
      this.fit();
    
      // 监听数据事件
      this.terminal.onData((data) => {
        if (this.onDataCallback) {
          this.onDataCallback(data);
        }
      });
    
      // 监听窗口大小变化
      window.addEventListener('resize', () => {
        this.fit();
      });
    
      // 添加快捷键支持
      this.setupKeyboardShortcuts();
    
      // 显示欢迎信息
      this.showWelcomeMessage();
    } catch (error) {
      console.error('终端初始化失败:', error);
      this.useFallbackTerminal();
    }
  }
  
  setupKeyboardShortcuts() {
    // Ctrl+C 复制
    this.terminal.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.code === 'KeyC' && this.terminal.hasSelection()) {
        e.preventDefault();
        navigator.clipboard.writeText(this.terminal.getSelection());
        return false;
      }
      
      // Ctrl+V 粘贴
      if (e.ctrlKey && e.code === 'KeyV') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          this.terminal.paste(text);
        });
        return false;
      }
      
      // Ctrl+F 搜索
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        this.openSearchBox();
        return false;
      }
      
      // Ctrl+K 清屏
      if (e.ctrlKey && e.code === 'KeyK') {
        e.preventDefault();
        this.clear();
        return false;
      }
      
      return true;
    });
  }
  
  showWelcomeMessage() {
    // 清空终端
    this.clear();
    
    // ASCII 艺术字标题 - 使用亮绿色
    this.writeln('\x1b[38;2;0;255;128m███╗   ███╗██╗ █████╗  ██████╗ ██████╗  █████╗');
    this.writeln('████╗ ████║██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗');
    this.writeln('██╔████╔██║██║███████║██║   ██║██║  ██║███████║');
    this.writeln('██║╚██╔╝██║██║██╔══██║██║   ██║██║  ██║██╔══██║');
    this.writeln('██║ ╚═╝ ██║██║██║  ██║╚██████╔╝██████╔╝██║  ██║');
    this.writeln('╚═╝     ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝\x1b[0m');
    
    // 副标题 - 使用青绿色（减少间距）
    this.writeln('\x1b[38;2;100;255;180m        CLAUDE CODE MANAGER        \x1b[0m');
    this.writeln('\x1b[38;2;50;150;100m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    
    // 版本和状态信息（更紧凑的布局）
    this.write('\x1b[38;2;0;255;200m◆ v2.0.8\x1b[0m ');
    this.write('\x1b[38;2;100;100;100m│\x1b[0m ');
    this.write('\x1b[38;2;255;200;0m◆ xterm.js\x1b[0m ');
    this.write('\x1b[38;2;100;100;100m│\x1b[0m ');
    this.writeln('\x1b[38;2;255;100;100m◆ Ready\x1b[0m');
    
    // 快捷提示（更紧凑的版本）
    this.writeln('\x1b[38;2;150;150;255m┌─ Commands ────────────────────────────────────┐\x1b[0m');
    this.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mhelp\x1b[0m    - Show available commands           \x1b[38;2;150;150;255m│\x1b[0m');
    this.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mclear\x1b[0m   - Clear terminal                   \x1b[38;2;150;150;255m│\x1b[0m');
    this.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mconfig\x1b[0m  - Manage configurations            \x1b[38;2;150;150;255m│\x1b[0m');
    this.writeln('\x1b[38;2;150;150;255m│\x1b[0m \x1b[38;2;255;255;100mstart\x1b[0m   - Start Claude Code                \x1b[38;2;150;150;255m│\x1b[0m');
    this.writeln('\x1b[38;2;150;150;255m└───────────────────────────────────────────────┘\x1b[0m');
    
    // 提示信息
    this.writeln('\x1b[38;2;100;100;100m💡 Click terminal to focus • Ctrl+K to clear\x1b[0m');
    
    // 命令提示符
    this.write('\x1b[38;2;0;255;0mmiaoda\x1b[0m \x1b[38;2;100;200;255m>\x1b[0m ');
  }
  
  write(data) {
    this.terminal.write(data);
  }
  
  writeln(data) {
    this.terminal.writeln(data);
  }
  
  clear() {
    this.terminal.clear();
  }
  
  fit() {
    if (this.fitAddon && this.fitAddon.fit) {
      try {
        this.fitAddon.fit();
      } catch (e) {
        console.warn('调整终端大小时出错:', e);
      }
    }
  }
  
  onData(callback) {
    this.onDataCallback = callback;
  }
  
  getSelection() {
    return this.terminal.getSelection();
  }
  
  openSearchBox() {
    // 创建搜索框 UI
    const searchBox = document.createElement('div');
    searchBox.className = 'terminal-search-box';
    searchBox.innerHTML = `
      <input type="text" placeholder="搜索..." class="search-input" />
      <button class="search-prev">↑</button>
      <button class="search-next">↓</button>
      <button class="search-close">×</button>
    `;
    
    this.container.appendChild(searchBox);
    
    const input = searchBox.querySelector('.search-input');
    const prevBtn = searchBox.querySelector('.search-prev');
    const nextBtn = searchBox.querySelector('.search-next');
    const closeBtn = searchBox.querySelector('.search-close');
    
    input.focus();
    
    input.addEventListener('input', () => {
      if (this.searchAddon) {
        this.searchAddon.findNext(input.value, { 
          regex: false, 
          wholeWord: false, 
          caseSensitive: false 
        });
      }
    });
    
    prevBtn.addEventListener('click', () => {
      if (this.searchAddon) {
        this.searchAddon.findPrevious(input.value);
      }
    });
    
    nextBtn.addEventListener('click', () => {
      if (this.searchAddon) {
        this.searchAddon.findNext(input.value);
      }
    });
    
    closeBtn.addEventListener('click', () => {
      searchBox.remove();
      this.terminal.focus();
    });
    
    // ESC 键关闭搜索
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchBox.remove();
        this.terminal.focus();
      }
    });
  }
  
  setProcessing(processing) {
    this.isProcessing = processing;
    // 可以在这里添加处理状态的视觉反馈
  }
  
  setError(/* error */) {
    // 可以在这里添加错误状态的视觉反馈
  }
  
  focus() {
    this.terminal.focus();
  }
  
  // 设置字体大小（响应式）
  setFontSize(size) {
    this.terminal.options.fontSize = size;
    this.fit();
  }
  
  // 根据屏幕尺寸自动调整字体
  autoAdjustFontSize() {
    const width = window.innerWidth;
    let fontSize = 13;
    
    if (width <= 1280) {
      fontSize = 12;
    } else if (width > 1920 && width <= 2560) {
      fontSize = 14;
    } else if (width > 2560) {
      fontSize = 15;
    }
    
    this.setFontSize(fontSize);
  }
  
  // 备用终端实现
  useFallbackTerminal() {
    console.warn('使用备用终端实现');
    // 创建一个简单的终端模拟
    this.container.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        background-color: #1e1e1e;
        color: #cccccc;
        font-family: monospace;
        font-size: 13px;
        padding: 10px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
      " id="fallback-terminal">
        <div style="color: #6a9955;">⚠️ xterm.js 加载失败，使用简化终端模式</div>
        <div style="color: #569cd6;">提示：功能可能受限，请检查网络连接或重新加载</div>
        <div id="terminal-output"></div>
      </div>
    `;
    
    const output = this.container.querySelector('#terminal-output');
    
    // 提供基本的 write 和 writeln 方法
    this.write = (text) => {
      const span = document.createElement('span');
      span.textContent = text;
      output.appendChild(span);
    };
    
    this.writeln = (text) => {
      this.write(text + '\n');
    };
    
    this.clear = () => {
      output.innerHTML = '';
    };
    
    this.fit = () => {
      // 备用终端不需要调整大小
    };
    
    this.focus = () => {
      this.container.focus();
    };
    
    this.onData = (callback) => {
      this.onDataCallback = callback;
    };
    
    this.getSelection = () => {
      return window.getSelection().toString();
    };
    
    this.setProcessing = () => {};
    this.setError = () => {};
    this.autoAdjustFontSize = () => {};
    this.setFontSize = () => {};
    this.openSearchBox = () => {
      console.warn('搜索功能在简化模式下不可用');
    };
    
    // 显示基本的欢迎信息
    this.writeln('欢迎使用 Miaoda 终端（简化模式）');
    this.writeln('----------------------------');
    this.writeln('');
  }
}

// 导出类
window.XtermTerminal = XtermTerminal;