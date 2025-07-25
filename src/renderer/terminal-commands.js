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
      this.terminal.writeln('\x1b[33m核心命令：\x1b[0m');
      this.terminal.writeln('\x1b[32mmenu\x1b[0m       - 显示欢迎菜单');
      this.terminal.writeln('\x1b[32mclaude\x1b[0m     - 启动 Claude Code');
      this.terminal.writeln('\x1b[32mconfig\x1b[0m     - 配置管理');
      this.terminal.writeln('\x1b[32menv\x1b[0m        - 检查环境');
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[33m系统命令：\x1b[0m');
      this.terminal.writeln('\x1b[32mstatus\x1b[0m     - 显示系统状态');
      this.terminal.writeln('\x1b[32mdiagnose\x1b[0m   - 运行系统诊断');
      this.terminal.writeln('\x1b[32mversion\x1b[0m    - 显示版本信息');
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[33m终端命令：\x1b[0m');
      this.terminal.writeln('\x1b[32mclear\x1b[0m      - 清空终端（保存历史）');
      this.terminal.writeln('\x1b[32msave\x1b[0m       - 保存当前对话');
      this.terminal.writeln('\x1b[32mhistory\x1b[0m    - 查看历史记录');
      this.terminal.writeln('\x1b[32mrestore <ID>\x1b[0m - 恢复历史记录');
      this.terminal.writeln('\x1b[32mexit\x1b[0m       - 退出应用');
      this.terminal.writeln('\x1b[32mhelp\x1b[0m       - 显示此帮助');
      this.terminal.writeln('\x1b[36m========================\x1b[0m\r\n');
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

    // 状态检查命令
    this.registerCommand('status', () => {
      this._showStatus();
    });

    // 诊断命令
    this.registerCommand('diagnose', () => {
      if (window.runDiagnostics) {
        window.runDiagnostics();
      } else {
        this.terminal.writeln('\r\n\x1b[33m正在检查系统状态...\x1b[0m');
        this.terminal.writeln('诊断功能正在开发中\r\n');
      }
    });

    // 版本信息命令
    this.registerCommand('version', () => {
      this._showVersion();
    });

    // 历史记录命令
    this.registerCommand('history', () => {
      this._showHistory();
    });

    // 恢复历史记录命令 - 需要支持参数
    this.registerCommand('restore', () => {
      this._showRestoreHelp();
    });
    
    // 保存当前对话命令
    this.registerCommand('save', () => {
      this._saveCurrentSession();
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
      // 详细日志：监控命令拦截器的输入
      console.log('[TerminalCommands.onData] 收到输入:', JSON.stringify(data), {
        charCode: data.charCodeAt(0),
        isInWelcomeMenu: window.isInWelcomeMenu,
        currentInput: this.currentInput
      });
      
      // 如果正在显示欢迎菜单，不拦截
      if (window.isInWelcomeMenu) {
        console.log('[TerminalCommands.onData] 在欢迎菜单中，跳过拦截');
        return;
      }

      // 处理输入字符
      if (data === '\r' || data === '\n') {
        // 回车键 - 检查是否是特殊命令
        const inputParts = this.currentInput.trim().split(/\s+/);
        const command = inputParts[0].toLowerCase();
        const args = inputParts.slice(1);
        
        if (this.commandHandlers.has(command)) {
          // 是特殊命令，拦截并处理
          this.terminal.writeln(''); // 换行
          const handler = this.commandHandlers.get(command);
          
          // 特殊处理restore命令，需要传递参数
          if (command === 'restore' && args.length > 0) {
            this._restoreHistory(args[0]);
          } else {
            handler();
          }
          
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
      
      // 注意：不再需要在这里发送数据到终端
      // terminal.js 的 onData 处理器会负责发送数据到 PTY
    });
  }

  /**
   * 显示历史记录
   */
  _showHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('terminal_history') || '[]');
      
      this.terminal.writeln('\r\n\x1b[36m=== 终端历史记录 ===\x1b[0m');
      
      if (history.length === 0) {
        this.terminal.writeln('\x1b[33m暂无历史记录\x1b[0m');
        this.terminal.writeln('输入一些命令后，或手动清空终端时会自动保存历史记录');
      } else {
        this.terminal.writeln(`\x1b[32m共找到 ${history.length} 条历史记录：\x1b[0m\r\n`);
        
        history.forEach((entry, index) => {
          const date = new Date(entry.timestamp);
          const formattedDate = date.toLocaleString('zh-CN');
          const reasonText = this._getReasonText(entry.reason);
          
          this.terminal.writeln(`\x1b[33m[${entry.id}]\x1b[0m ${formattedDate} - ${reasonText}`);
          
          // 显示内容预览（前100个字符）
          const preview = entry.content.slice(0, 100).replace(/\n/g, ' ');
          this.terminal.writeln(`  \x1b[37m${preview}${entry.content.length > 100 ? '...' : ''}\x1b[0m`);
          
          if (index < history.length - 1) {
            this.terminal.writeln('');
          }
        });
        
        this.terminal.writeln('\r\n\x1b[36m使用 "restore <ID>" 恢复指定历史记录\x1b[0m');
      }
      
      this.terminal.writeln('\x1b[36m========================\x1b[0m\r\n');
      
    } catch (error) {
      this.terminal.writeln('\r\n\x1b[31m错误：无法读取历史记录\x1b[0m');
      console.error('Failed to show history:', error);
    }
  }

  /**
   * 显示restore命令帮助
   */
  _showRestoreHelp() {
    this.terminal.writeln('\r\n\x1b[36m=== 恢复历史记录 ===\x1b[0m');
    this.terminal.writeln('\x1b[32m用法：\x1b[0m restore <历史记录ID>');
    this.terminal.writeln('\x1b[32m示例：\x1b[0m restore 1642567890123');
    this.terminal.writeln('');
    this.terminal.writeln('先使用 \x1b[33mhistory\x1b[0m 命令查看可用的历史记录ID');
    this.terminal.writeln('\x1b[36m==================\x1b[0m\r\n');
    
    // 检查是否有历史记录
    try {
      const history = JSON.parse(localStorage.getItem('terminal_history') || '[]');
      if (history.length > 0) {
        this.terminal.writeln('\x1b[33m💡 提示：当前有 ' + history.length + ' 条历史记录可供恢复\x1b[0m\r\n');
      }
    } catch (error) {
      console.error('Failed to check history:', error);
    }
  }

  /**
   * 恢复指定历史记录
   */
  _restoreHistory(historyId) {
    try {
      const history = JSON.parse(localStorage.getItem('terminal_history') || '[]');
      const entry = history.find(h => h.id.toString() === historyId.toString());
      
      if (!entry) {
        this.terminal.writeln(`\r\n\x1b[31m错误：未找到ID为 ${historyId} 的历史记录\x1b[0m`);
        this.terminal.writeln('使用 \x1b[33mhistory\x1b[0m 命令查看可用的历史记录\r\n');
        return;
      }

      // 确认恢复操作
      const date = new Date(entry.timestamp);
      const formattedDate = date.toLocaleString('zh-CN');
      const reasonText = this._getReasonText(entry.reason);
      
      this.terminal.writeln(`\r\n\x1b[36m正在恢复历史记录：\x1b[0m`);
      this.terminal.writeln(`\x1b[33mID:\x1b[0m ${entry.id}`);
      this.terminal.writeln(`\x1b[33m时间:\x1b[0m ${formattedDate}`);
      this.terminal.writeln(`\x1b[33m原因:\x1b[0m ${reasonText}`);
      this.terminal.writeln('');

      // 清空当前终端内容
      this.terminal.xterm.clear();
      
      // 恢复历史内容
      this.terminal.xterm.write(entry.content);
      
      // 显示恢复成功信息
      this.terminal.writeln('\r\n');
      this.terminal.writeln('\x1b[32m✅ 历史记录已成功恢复\x1b[0m');
      this.terminal.writeln(`\x1b[37m恢复时间：${new Date().toLocaleString('zh-CN')}\x1b[0m\r\n`);
      
    } catch (error) {
      this.terminal.writeln('\r\n\x1b[31m错误：恢复历史记录失败\x1b[0m');
      console.error('Failed to restore history:', error);
    }
  }

  /**
   * 获取原因文本描述
   */
  _getReasonText(reason) {
    const reasonMap = {
      'manual_clear': '手动清空',
      'auto_clear': '自动清空',
      'manual_save': '手动保存',
      'system_clear': '系统清空',
      'auto_save_important': '重要内容自动保存',
      'auto_save_before_menu': '显示菜单前自动保存',
      'session_end': '会话结束',
      'before_restart': '重启前保存'
    };
    return reasonMap[reason] || reason;
  }

  /**
   * 保存当前会话
   */
  _saveCurrentSession() {
    if (this.terminal && this.terminal._saveToHistory) {
      const historyId = this.terminal._saveToHistory('manual_save');
      
      if (historyId) {
        this.terminal.writeln('\r\n\x1b[32m✅ 当前对话已保存到历史记录\x1b[0m');
        this.terminal.writeln(`\x1b[90m历史记录 ID: ${historyId}\x1b[0m`);
        this.terminal.writeln('\x1b[90m使用 "history" 查看所有历史记录\x1b[0m');
        this.terminal.writeln(`\x1b[90m使用 "restore ${historyId}" 恢复此对话\x1b[0m\r\n`);
      } else {
        this.terminal.writeln('\r\n\x1b[31m❌ 保存失败，请稍后重试\x1b[0m\r\n');
      }
    } else {
      this.terminal.writeln('\r\n\x1b[33m⚠️ 保存功能暂时不可用\x1b[0m\r\n');
    }
  }
  
  /**
   * 显示状态信息
   */
  _showStatus() {
    this.terminal.writeln('\r\n\x1b[36m=== 系统状态 ===\x1b[0m');
    
    // 显示Claude状态
    const claudeStatus = window.claudeStatus || 'unknown';
    const statusColor = claudeStatus === 'running' ? '\x1b[32m' : 
                       claudeStatus === 'stopped' ? '\x1b[31m' : '\x1b[33m';
    this.terminal.writeln(`Claude 状态: ${statusColor}${claudeStatus}\x1b[0m`);
    
    // 显示终端信息
    const terminalType = this.terminal.terminalId ? '真实终端' : '模拟终端';
    this.terminal.writeln(`终端类型: \x1b[32m${terminalType}\x1b[0m`);
    
    if (this.terminal.terminalId) {
      this.terminal.writeln(`终端ID: \x1b[36m${this.terminal.terminalId}\x1b[0m`);
    }
    
    // 显示内存使用情况
    if (performance.memory) {
      const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
      const total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
      this.terminal.writeln(`内存使用: \x1b[33m${used}MB / ${total}MB\x1b[0m`);
    }
    
    this.terminal.writeln('\x1b[36m================\x1b[0m\r\n');
  }

  /**
   * 显示版本信息
   */
  _showVersion() {
    this.terminal.writeln('\r\n\x1b[36m=== Claude Code Manager ===\x1b[0m');
    this.terminal.writeln('\x1b[32m版本:\x1b[0m 2.0.9');
    this.terminal.writeln('\x1b[32m作者:\x1b[0m Miaoda Team');
    this.terminal.writeln('\x1b[32m支持模型:\x1b[0m 380+ AI Models');
    this.terminal.writeln('\x1b[32m平台:\x1b[0m Electron + Node.js');
    this.terminal.writeln('\x1b[32m许可证:\x1b[0m Open Source');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m🚀 让AI编程变得更简单！\x1b[0m');
    this.terminal.writeln('\x1b[36m===========================\x1b[0m\r\n');
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