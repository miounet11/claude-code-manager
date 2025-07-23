class EnhancedTerminal extends SimpleTerminal {
  constructor(container) {
    super(container);
    this.commandHistory = [];
    this.historyIndex = -1;
    this.isProcessing = false;
    
    // 初始化快捷命令系统
    if (window.ClaudeShortcuts) {
      this.shortcuts = new window.ClaudeShortcuts();
    }
    
    this.setupEnhancements();
  }
  
  setupEnhancements() {
    // 添加命令历史功能
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.handleTabCompletion();
      } else if (e.key === '/' && this.input.value === '') {
        // 显示快捷命令面板
        this.showShortcutPanel();
      }
    });
    
    // 添加状态指示器
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.className = 'terminal-status';
    this.statusIndicator.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success-color, #6a9955);
      transition: all 0.3s ease;
      box-shadow: 0 0 4px var(--success-color, #6a9955);
    `;
    this.container.style.position = 'relative';
    this.container.appendChild(this.statusIndicator);
    
    // 添加加载动画
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'terminal-loading';
    this.loadingIndicator.style.cssText = `
      display: none;
      position: absolute;
      bottom: 45px;
      left: 15px;
      color: var(--accent-color, #569cd6);
      font-size: var(--font-size-small, 12px);
    `;
    this.loadingIndicator.innerHTML = '<span class="loading-dots">处理中...</span>';
    this.container.appendChild(this.loadingIndicator);
    
    // 添加快捷提示
    this.shortcutHint = document.createElement('div');
    this.shortcutHint.className = 'terminal-shortcuts';
    this.shortcutHint.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 15px;
      font-size: var(--font-size-small, 12px);
      color: var(--text-secondary, #969696);
      opacity: 0.6;
      font-family: var(--font-family-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
    `;
    this.shortcutHint.innerHTML = '↑↓ 历史 | Tab 补全 | Ctrl+C 停止';
    this.container.appendChild(this.shortcutHint);
    
    // 添加加载动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes loading-dots {
        0%, 20% { content: '处理中.'; }
        40% { content: '处理中..'; }
        60%, 100% { content: '处理中...'; }
      }
      .loading-dots::after {
        content: '';
        animation: loading-dots 1.5s infinite;
      }
      .terminal-status.processing {
        background: var(--warning-color, #dcdcaa);
        animation: pulse 1s infinite;
      }
      .terminal-status.error {
        background: var(--error-color, #f48771);
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
  
  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return;
    
    if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
    } else if (direction === 1 && this.historyIndex > -1) {
      this.historyIndex--;
    }
    
    if (this.historyIndex === -1) {
      this.input.value = '';
    } else {
      this.input.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
    }
  }
  
  handleTabCompletion() {
    const currentValue = this.input.value;
    const suggestions = this.getCompletionSuggestions(currentValue);
    
    if (suggestions.length === 1) {
      this.input.value = suggestions[0];
    } else if (suggestions.length > 1) {
      this.writeln('');
      this.writeln('可用命令:');
      suggestions.forEach(s => this.writeln(`  ${s}`));
      this.write(`$ ${currentValue}`);
    }
  }
  
  getCompletionSuggestions(prefix) {
    const commands = [
      'help', 'clear', 'exit', 'config', 'status', 
      'start', 'stop', 'restart', 'logs', 'version'
    ];
    
    if (!prefix) return commands;
    
    return commands.filter(cmd => cmd.startsWith(prefix.toLowerCase()));
  }
  
  write(text) {
    // 解析并应用更多 ANSI 颜色
    const colorMap = {
      '\\x1b\\[30m': '<span style="color: #000000">',  // 黑色
      '\\x1b\\[31m': '<span style="color: #ff3b30">',  // 红色
      '\\x1b\\[32m': '<span style="color: #00ff00">',  // 绿色
      '\\x1b\\[33m': '<span style="color: #ffcc00">',  // 黄色
      '\\x1b\\[34m': '<span style="color: #007aff">',  // 蓝色
      '\\x1b\\[35m': '<span style="color: #ff2d55">',  // 品红
      '\\x1b\\[36m': '<span style="color: #32ade6">',  // 青色
      '\\x1b\\[37m': '<span style="color: #c0c0c0">',  // 白色
      '\\x1b\\[90m': '<span style="color: #666666">',  // 亮黑（灰）
      '\\x1b\\[91m': '<span style="color: #ff6b6b">',  // 亮红
      '\\x1b\\[92m': '<span style="color: #51cf66">',  // 亮绿
      '\\x1b\\[93m': '<span style="color: #ffd43b">',  // 亮黄
      '\\x1b\\[94m': '<span style="color: #5c7cfa">',  // 亮蓝
      '\\x1b\\[95m': '<span style="color: #c56cf0">',  // 亮品红
      '\\x1b\\[96m': '<span style="color: #66d9ef">',  // 亮青
      '\\x1b\\[97m': '<span style="color: #ffffff">',  // 亮白
      '\\x1b\\[0m': '</span>',  // 重置
      '\\x1b\\[1m': '<strong>',  // 粗体
      '\\x1b\\[22m': '</strong>',  // 重置粗体
      '\\x1b\\[3m': '<em>',  // 斜体
      '\\x1b\\[23m': '</em>',  // 重置斜体
      '\\x1b\\[4m': '<u>',  // 下划线
      '\\x1b\\[24m': '</u>',  // 重置下划线
    };
    
    let processedText = text;
    for (const [code, replacement] of Object.entries(colorMap)) {
      const regex = new RegExp(code, 'g');
      processedText = processedText.replace(regex, replacement);
    }
    
    super.write(processedText);
  }
  
  onData(callback) {
    super.onData(callback);
    
    // 重写输入处理以添加历史记录
    const originalKeyHandler = this.input.onkeydown;
    this.input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const command = this.input.value;
        if (command.trim()) {
          this.commandHistory.push(command);
          if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
          }
          this.historyIndex = -1;
        }
      }
      
      if (originalKeyHandler) {
        originalKeyHandler.call(this.input, e);
      }
    };
  }
  
  setProcessing(isProcessing) {
    this.isProcessing = isProcessing;
    if (isProcessing) {
      this.statusIndicator.classList.add('processing');
      this.loadingIndicator.style.display = 'block';
      this.input.disabled = true;
      this.prompt.style.color = '#ff9500';
    } else {
      this.statusIndicator.classList.remove('processing');
      this.loadingIndicator.style.display = 'none';
      this.input.disabled = false;
      this.prompt.style.color = '#00ff00';
    }
  }
  
  setError(hasError) {
    if (hasError) {
      this.statusIndicator.classList.add('error');
    } else {
      this.statusIndicator.classList.remove('error');
    }
  }
  
  showWelcomeMessage() {
    const asciiArt = `
    ╔═╗┬┌─┐┌─┐┌┬┐┌─┐
    ║║║│├─┤│ │ ││├─┤
    ╩ ╩┴┴ ┴└─┘─┴┘┴ ┴
    `;
    
    this.writeln(asciiArt);
    this.writeln('');
    this.writeln('欢迎使用 Miaoda - Claude Code 图形化管理工具');
    this.writeln('');
    this.writeln('快速开始:');
    this.writeln('  1. 检查环境 - 确保所有依赖已安装');
    this.writeln('  2. 选择配置 - 选择或创建 AI 配置');
    this.writeln('  3. 启动对话 - 开始与 AI 交互');
    this.writeln('');
    this.writeln('输入 "help" 查看可用命令');
    this.writeln('');
  }
  
  handleCommand(command) {
    const cmd = command.trim();
    
    // 检查是否是快捷命令
    if (cmd.startsWith('/') && this.shortcuts) {
      if (this.shortcuts.executeShortcut(cmd, this)) {
        return;
      }
    }
    
    // 处理普通命令
    switch (cmd.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;
      case 'clear':
        this.clear();
        break;
      case 'version':
        this.writeln(`Miaoda v${window.electronAPI.versions.app || '2.0.0'}`);
        break;
      case 'status':
        this.showStatus();
        break;
      case 'approval':
      case 'auto-approval':
        if (window.autoApproval) {
          window.autoApproval.openSettings();
        }
        break;
      default:
        if (this.onDataCallback) {
          this.onDataCallback(command + '\n');
        }
    }
  }
  
  showHelp() {
    this.writeln('');
    this.writeln('可用命令:');
    this.writeln('  help         - 显示此帮助信息');
    this.writeln('  clear        - 清空终端');
    this.writeln('  version      - 显示版本信息');
    this.writeln('  status       - 显示当前状态');
    this.writeln('  approval     - 打开自动批准设置');
    this.writeln('  /help        - 显示 Claude Code 快捷命令');
    this.writeln('  exit         - 退出程序');
    this.writeln('');
    this.writeln('Claude Code 快捷命令:');
    this.writeln('  /            - 显示所有快捷命令');
    this.writeln('  /analyze     - 分析代码');
    this.writeln('  /refactor    - 重构代码');
    this.writeln('  /test        - 生成测试');
    this.writeln('  /doc         - 生成文档');
    this.writeln('  更多命令请输入 /help');
    this.writeln('');
    this.writeln('快捷键:');
    this.writeln('  ↑/↓          - 浏览命令历史');
    this.writeln('  Tab          - 命令补全');
    this.writeln('  Ctrl+C       - 停止当前操作');
    this.writeln('  Ctrl+L       - 清空终端');
    this.writeln('');
    this.writeln('提示:');
    this.writeln('  • 点击右下角 "⚡ 快捷命令" 按钮查看所有快捷命令');
    this.writeln('  • 使用 "approval" 命令配置自动批准功能');
    this.writeln('');
  }
  
  showStatus() {
    this.writeln('');
    this.writeln('系统状态:');
    this.writeln(`  终端状态: ${this.isProcessing ? '处理中' : '就绪'}`);
    this.writeln(`  命令历史: ${this.commandHistory.length} 条`);
    this.writeln(`  当前配置: ${window.currentConfig ? window.currentConfig.name : '未选择'}`);
    this.writeln(`  自动批准: ${window.autoApproval && window.autoApproval.config.enabled ? '已启用' : '已禁用'}`);
    this.writeln('');
  }
  
  showShortcutPanel() {
    if (!this.shortcuts) return;
    
    // 创建或显示快捷命令面板
    if (!this.shortcutPanel) {
      this.shortcutPanel = this.shortcuts.createShortcutPanel();
      document.body.appendChild(this.shortcutPanel);
      
      // 添加快捷按钮
      const shortcutButton = document.createElement('button');
      shortcutButton.id = 'shortcut-button';
      shortcutButton.innerHTML = '⚡ 快捷命令';
      shortcutButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background: var(--putty-green);
        color: var(--putty-bg);
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-weight: bold;
        font-family: inherit;
        z-index: 999;
        transition: all 0.3s ease;
      `;
      
      shortcutButton.addEventListener('click', () => {
        this.toggleShortcutPanel();
      });
      
      shortcutButton.addEventListener('mouseenter', () => {
        shortcutButton.style.transform = 'scale(1.1)';
      });
      
      shortcutButton.addEventListener('mouseleave', () => {
        shortcutButton.style.transform = 'scale(1)';
      });
      
      document.body.appendChild(shortcutButton);
    }
    
    this.toggleShortcutPanel();
  }
  
  toggleShortcutPanel() {
    if (this.shortcutPanel) {
      if (this.shortcutPanel.style.display === 'none') {
        this.shortcutPanel.style.display = 'block';
        this.shortcutPanel.querySelector('input').focus();
      } else {
        this.shortcutPanel.style.display = 'none';
      }
    }
  }
  
  // 处理 Claude 的批准请求
  async handleApprovalRequest(type, request) {
    if (window.autoApproval) {
      return new Promise((resolve) => {
        window.autoApproval.handleApprovalRequest(type, request, resolve);
      });
    }
    
    // 默认手动批准
    return this.showManualApproval(type, request);
  }
  
  showManualApproval(type, request) {
    return new Promise((resolve) => {
      this.writeln('');
      this.writeln(`⚠️ 需要批准: ${type}`);
      this.writeln(`详情: ${JSON.stringify(request, null, 2)}`);
      this.writeln('输入 "yes" 批准，"no" 拒绝:');
      
      const handleResponse = (data) => {
        const response = data.trim().toLowerCase();
        if (response === 'yes' || response === 'y') {
          this.writeln('✓ 已批准');
          resolve(true);
          this.onDataCallback = this.originalCallback;
        } else if (response === 'no' || response === 'n') {
          this.writeln('✗ 已拒绝');
          resolve(false);
          this.onDataCallback = this.originalCallback;
        } else {
          this.writeln('请输入 "yes" 或 "no"');
        }
      };
      
      this.originalCallback = this.onDataCallback;
      this.onDataCallback = handleResponse;
    });
  }
}

// 导出增强终端类
window.EnhancedTerminal = EnhancedTerminal;