'use strict';

/**
 * 真实终端命令拦截器
 * 在真实终端模式下拦截特定命令
 */
class TerminalCommandInterceptor {
  constructor(terminal) {
    this.terminal = terminal;
    this.currentInput = '';
    this.intercepting = false;
    this.commandHandlers = new Map();
    
    // 注册默认命令
    this.registerDefaultCommands();
    
    // 设置输入拦截
    this.setupInterceptor();
  }

  /**
   * 注册默认命令
   */
  registerDefaultCommands() {
    // 菜单命令
    this.registerCommand('menu', () => {
      if (window.showWelcomeMenu) {
        window.showWelcomeMenu();
      }
    });

    // 帮助命令
    this.registerCommand('help', () => {
      this.terminal.writeln('\r\n\x1b[36m=== Miaoda 命令帮助 ===\x1b[0m');
      this.terminal.writeln('\x1b[32mmenu\x1b[0m      - 显示欢迎菜单');
      this.terminal.writeln('\x1b[32mclaude\x1b[0m    - 启动 Claude Code');
      this.terminal.writeln('\x1b[32mconfig\x1b[0m    - 配置管理');
      this.terminal.writeln('\x1b[32menv\x1b[0m       - 检查环境');
      this.terminal.writeln('\x1b[32mclear\x1b[0m     - 清空终端');
      this.terminal.writeln('\x1b[32mexit\x1b[0m      - 退出应用');
      this.terminal.writeln('\x1b[32mhelp\x1b[0m      - 显示此帮助');
      this.terminal.writeln('\x1b[36m=====================\x1b[0m\r\n');
    });

    // Claude 启动命令
    this.registerCommand('claude', () => {
      if (window.startClaudeCode) {
        window.startClaudeCode();
      }
    });

    // 环境检查命令
    this.registerCommand('env', () => {
      if (window.checkEnvironment) {
        window.checkEnvironment();
      }
    });

    // 配置命令
    this.registerCommand('config', () => {
      this.terminal.writeln('\r\n\x1b[36m配置管理:\x1b[0m');
      this.terminal.writeln('使用左侧面板管理配置');
      this.terminal.writeln('或输入 "menu" 进入欢迎菜单选择配置\r\n');
    });

    // 退出命令
    this.registerCommand('exit', () => {
      this.terminal.writeln('\r\n正在退出...');
      setTimeout(() => {
        window.close();
      }, 1000);
    });
  }

  /**
   * 注册命令
   */
  registerCommand(command, handler) {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  /**
   * 设置输入拦截
   */
  setupInterceptor() {
    // 清理之前的输入处理器
    
    // 拦截输入
    this.terminal.xterm.onData((data) => {
      // 如果正在显示欢迎菜单，不拦截
      if (window.isInWelcomeMenu) {
        return;
      }

      // 处理输入字符
      if (data === '\r' || data === '\n') {
        // 回车键 - 检查是否是特殊命令
        const command = this.currentInput.trim().toLowerCase();
        
        if (this.commandHandlers.has(command)) {
          // 是特殊命令，拦截并处理
          this.terminal.writeln(''); // 换行
          const handler = this.commandHandlers.get(command);
          handler();
          this.currentInput = '';
          return; // 不发送到真实终端
        }
        
        // 不是特殊命令，清空缓冲区并继续
        this.currentInput = '';
      } else if (data === '\x7f' || data === '\b') {
        // 退格键
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
        }
      } else if (data === '\x03') {
        // Ctrl+C - 清空缓冲区
        this.currentInput = '';
      } else if (data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
        // 可打印字符
        this.currentInput += data;
      }
      
      // 将输入传递给真实终端
      if (this.terminal.terminalId) {
        window.electronAPI.terminal.write(this.terminal.terminalId, data);
      }
    });
  }

  /**
   * 清理
   */
  dispose() {
    this.commandHandlers.clear();
    this.currentInput = '';
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TerminalCommandInterceptor;
} else {
  window.TerminalCommandInterceptor = TerminalCommandInterceptor;
}