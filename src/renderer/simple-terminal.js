class SimpleTerminal {
  constructor(container) {
    this.container = container;
    this.lines = [];
    this.currentLine = '';
    this.onDataCallback = null;
    
    this.setupUI();
  }
  
  setupUI() {
    this.container.innerHTML = '';
    this.container.style.backgroundColor = 'var(--bg-primary, #1e1e1e)';
    this.container.style.color = 'var(--text-primary, #cccccc)';
    this.container.style.fontFamily = "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";
    this.container.style.fontSize = 'var(--terminal-font-size, 13px)';
    this.container.style.padding = '15px';
    this.container.style.overflow = 'auto';
    this.container.style.height = '100%';
    this.container.style.whiteSpace = 'pre-wrap';
    this.container.style.wordBreak = 'break-all';
    this.container.style.lineHeight = '1.4';
    this.container.style.webkitFontSmoothing = 'antialiased';
    this.container.style.mozOsxFontSmoothing = 'grayscale';
    
    this.outputDiv = document.createElement('div');
    this.container.appendChild(this.outputDiv);
    
    this.inputLine = document.createElement('div');
    this.inputLine.style.display = 'flex';
    this.inputLine.style.marginTop = '5px';
    
    this.prompt = document.createElement('span');
    this.prompt.textContent = '$ ';
    this.prompt.style.color = 'var(--accent-color, #569cd6)';
    
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.style.flex = '1';
    this.input.style.background = 'transparent';
    this.input.style.border = 'none';
    this.input.style.outline = 'none';
    this.input.style.color = 'var(--text-primary, #cccccc)';
    this.input.style.fontFamily = 'inherit';
    this.input.style.fontSize = 'inherit';
    
    this.inputLine.appendChild(this.prompt);
    this.inputLine.appendChild(this.input);
    this.container.appendChild(this.inputLine);
    
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const command = this.input.value;
        this.writeln(`$ ${command}`);
        this.input.value = '';
        
        if (this.onDataCallback) {
          this.onDataCallback(command + '\n');
        }
      }
    });
    
    this.container.addEventListener('click', () => {
      this.input.focus();
    });
  }
  
  write(text) {
    this.currentLine += text;
    this.render();
  }
  
  writeln(text) {
    // 处理 ANSI 颜色代码
    const coloredText = this.processAnsiCodes(text);
    this.lines.push(this.currentLine + coloredText);
    this.currentLine = '';
    this.render();
    this.scrollToBottom();
  }
  
  processAnsiCodes(text) {
    // 简单的 ANSI 颜色处理
    return text
      .replace(/\u001b\[31m/g, '<span style="color: #ff0000">')  // 红色
      .replace(/\u001b\[32m/g, '<span style="color: #00ff00">')  // 绿色
      .replace(/\u001b\[33m/g, '<span style="color: #ffff00">')  // 黄色
      .replace(/\u001b\[34m/g, '<span style="color: #0066ff">')  // 蓝色
      .replace(/\u001b\[35m/g, '<span style="color: #ff00ff">')  // 洋红
      .replace(/\u001b\[36m/g, '<span style="color: #00ffff">')  // 青色
      .replace(/\u001b\[0m/g, '</span>')                          // 重置
      .replace(/\u001b\[[0-9;]*m/g, '');                         // 忽略其他
  }
  
  render() {
    const content = this.lines.join('\n') + (this.currentLine ? '\n' + this.currentLine : '');
    this.outputDiv.innerHTML = content;
  }
  
  clear() {
    this.lines = [];
    this.currentLine = '';
    this.render();
  }
  
  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
  
  onData(callback) {
    this.onDataCallback = callback;
  }
  
  getSelection() {
    return window.getSelection().toString();
  }
}

// 导出到全局作用域，供其他脚本使用
window.SimpleTerminal = SimpleTerminal;