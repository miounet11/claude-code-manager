'use strict';

/**
 * 终端会话管理器
 * 处理命令行交互逻辑
 */
class TerminalSession {
  constructor(terminal) {
    this.terminal = terminal;
    this.currentLine = '';
    this.history = [];
    this.historyIndex = -1;
    this.prompt = '\x1b[32mmiaoda\x1b[0m \x1b[36m>\x1b[0m ';
    
    // 会话状态
    this.isProcessing = false;
    this.inputEnabled = true;
    
    // 命令处理器
    this.commandHandler = null;
    
    // 设置输入处理
    this.setupInputHandler();
  }

  /**
   * 设置输入处理器
   */
  setupInputHandler() {
    this.terminal.onInput((data) => {
      if (!this.inputEnabled) {
        return;
      }

      const code = data.charCodeAt(0);

      // 处理特殊键
      if (data === '\r' || data === '\n') {
        // 回车键 - 执行命令
        this.handleEnter();
      } else if (code === 127 || code === 8) {
        // 退格键
        this.handleBackspace();
      } else if (data === '\x1b[A') {
        // 上箭头 - 历史记录
        this.handleUpArrow();
      } else if (data === '\x1b[B') {
        // 下箭头 - 历史记录
        this.handleDownArrow();
      } else if (data === '\x1b[D') {
        // 左箭头
        // TODO: 实现光标移动
      } else if (data === '\x1b[C') {
        // 右箭头
        // TODO: 实现光标移动
      } else if (data === '\x03') {
        // Ctrl+C - 中断
        this.handleInterrupt();
      } else if (data === '\x0c') {
        // Ctrl+L - 清屏
        this.handleClear();
      } else if (code >= 32 && code < 127) {
        // 可打印字符
        this.handleChar(data);
      }
    });
  }

  /**
   * 处理回车键
   */
  handleEnter() {
    this.terminal.writeln('');
    
    const command = this.currentLine.trim();
    if (command) {
      // 添加到历史记录
      this.history.push(command);
      this.historyIndex = this.history.length;
      
      // 处理命令
      this.processCommand(command);
    } else {
      // 空命令，直接显示新提示符
      this.showPrompt();
    }
    
    this.currentLine = '';
  }

  /**
   * 处理退格键
   */
  handleBackspace() {
    if (this.currentLine.length > 0) {
      this.currentLine = this.currentLine.slice(0, -1);
      // 删除终端上的字符
      this.terminal.write('\b \b');
    }
  }

  /**
   * 处理上箭头（历史记录）
   */
  handleUpArrow() {
    if (this.historyIndex > 0) {
      // 清除当前行
      this.clearCurrentLine();
      
      // 显示历史命令
      this.historyIndex--;
      this.currentLine = this.history[this.historyIndex];
      this.terminal.write(this.currentLine);
    }
  }

  /**
   * 处理下箭头（历史记录）
   */
  handleDownArrow() {
    if (this.historyIndex < this.history.length - 1) {
      // 清除当前行
      this.clearCurrentLine();
      
      // 显示历史命令
      this.historyIndex++;
      this.currentLine = this.history[this.historyIndex];
      this.terminal.write(this.currentLine);
    } else if (this.historyIndex === this.history.length - 1) {
      // 到达历史末尾，清空当前行
      this.clearCurrentLine();
      this.historyIndex = this.history.length;
      this.currentLine = '';
    }
  }

  /**
   * 处理可打印字符
   */
  handleChar(char) {
    this.currentLine += char;
    this.terminal.write(char);
  }

  /**
   * 处理中断（Ctrl+C）
   */
  handleInterrupt() {
    this.terminal.writeln('^C');
    this.currentLine = '';
    this.showPrompt();
  }

  /**
   * 处理清屏（Ctrl+L）
   */
  handleClear() {
    this.terminal.clear();
    this.showPrompt();
    this.terminal.write(this.currentLine);
  }

  /**
   * 清除当前行
   */
  clearCurrentLine() {
    // 移动光标到行首并清除整行
    const backspaces = '\b'.repeat(this.currentLine.length);
    const spaces = ' '.repeat(this.currentLine.length);
    this.terminal.write(backspaces + spaces + backspaces);
  }

  /**
   * 处理命令
   */
  async processCommand(command) {
    this.isProcessing = true;
    
    try {
      if (this.commandHandler) {
        // 使用外部命令处理器
        await this.commandHandler(command, this);
      } else {
        // 默认处理
        this.handleBuiltinCommand(command);
      }
    } catch (error) {
      this.terminal.writeln(`\x1b[31mError: ${error.message}\x1b[0m`);
    }
    
    this.isProcessing = false;
    
    // 显示新提示符
    if (this.inputEnabled) {
      this.showPrompt();
    }
  }

  /**
   * 处理内置命令
   */
  handleBuiltinCommand(command) {
    switch (command.toLowerCase()) {
    case 'help':
      this.showHelp();
      break;
    case 'clear':
      this.terminal.clear();
      break;
    case 'exit':
      this.terminal.writeln('Goodbye!');
      this.inputEnabled = false;
      break;
    default:
      this.terminal.writeln(`Unknown command: ${command}`);
      this.terminal.writeln('Type "help" for available commands.');
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    this.terminal.writeln('Available commands:');
    this.terminal.writeln('  help    - Show this help message');
    this.terminal.writeln('  clear   - Clear the terminal');
    this.terminal.writeln('  exit    - Exit the terminal');
  }

  /**
   * 显示提示符
   */
  showPrompt() {
    this.terminal.write(this.prompt);
  }

  /**
   * 设置提示符
   */
  setPrompt(prompt) {
    this.prompt = prompt;
  }

  /**
   * 启用/禁用输入
   */
  setInputEnabled(enabled) {
    this.inputEnabled = enabled;
  }

  /**
   * 设置命令处理器
   */
  setCommandHandler(handler) {
    this.commandHandler = handler;
  }

  /**
   * 写入输出（不影响当前输入行）
   */
  writeOutput(text) {
    // 保存当前输入
    const savedLine = this.currentLine;
    
    // 清除当前行
    this.clearCurrentLine();
    
    // 写入输出
    this.terminal.writeln(text);
    
    // 恢复提示符和输入
    if (this.inputEnabled && !this.isProcessing) {
      this.showPrompt();
      this.terminal.write(savedLine);
      this.currentLine = savedLine;
    }
  }

  /**
   * 开始会话
   */
  start() {
    this.terminal.writeln('Welcome to Miaoda Terminal');
    this.terminal.writeln('Type "help" for available commands');
    this.terminal.writeln('');
    this.showPrompt();
  }

  /**
   * 重置会话
   */
  reset() {
    this.currentLine = '';
    this.historyIndex = this.history.length;
    this.isProcessing = false;
    this.inputEnabled = true;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TerminalSession;
} else {
  window.TerminalSession = TerminalSession;
}