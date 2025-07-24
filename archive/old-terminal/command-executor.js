'use strict';

/**
 * 命令执行器 - 处理终端命令执行
 */
class CommandExecutor {
  constructor(terminal) {
    this.terminal = terminal;
    this.isClaudeRunning = false;
    this.commandHandlers = this.initializeHandlers();
  }

  /**
   * 初始化命令处理器
   */
  initializeHandlers() {
    return {
      help: () => this.showHelp(),
      clear: () => this.terminal.clear(),
      cls: () => this.terminal.clear(),
      version: () => this.showVersion(),
      status: () => this.showStatus(),
      echo: (args) => this.echo(args),
      date: () => this.showDate(),
      whoami: () => this.showUser(),
      exit: () => this.handleExit(),
      quit: () => this.handleExit(),
      claude: (args) => this.handleClaude(args),
      start: () => this.startClaude(),
      config: () => this.showConfig(),
      welcome: () => this.showWelcomeMenu(),
      reset: () => this.resetWelcomeFlag()
    };
  }

  /**
   * 执行命令
   */
  async execute(commandLine) {
    const [command, ...args] = commandLine.trim().split(' ');
    const cmd = command.toLowerCase();
    
    // 内置命令优先
    if (this.commandHandlers[cmd]) {
      await this.commandHandlers[cmd](args);
      return true;
    }
    
    // 如果 Claude 正在运行，传递给 Claude
    if (this.isClaudeRunning) {
      return false; // 让外部处理
    }
    
    // 尝试执行系统命令
    try {
      await this.executeSystemCommand(commandLine);
    } catch (error) {
      this.terminal.writeln(`\x1b[31m命令执行失败: ${error.message}\x1b[0m`);
    }
    return true;
  }

  /**
   * 执行系统命令
   */
  async executeSystemCommand(commandLine) {
    // 使用主进程执行命令
    if (window.electronAPI && window.electronAPI.executeCommand) {
      // 不显示执行提示，让终端更简洁
      
      try {
        const result = await window.electronAPI.executeCommand(commandLine);
        
        if (result.success) {
          // 特殊处理 ls 命令的输出
          if (commandLine.trim().startsWith('ls')) {
            this.formatLsOutput(result.stdout);
          } else {
            // 显示命令输出
            if (result.stdout) {
              this.terminal.write(result.stdout);
            }
            if (result.stderr) {
              this.terminal.write(`\x1b[31m${result.stderr}\x1b[0m`);
            }
          }
        } else {
          this.terminal.writeln(`\x1b[31m${result.error || '命令执行失败'}\x1b[0m`);
        }
      } catch (error) {
        this.terminal.writeln(`\x1b[31m错误: ${error.message}\x1b[0m`);
      }
    } else {
      this.terminal.writeln(`\x1b[31m系统命令执行功能未启用\x1b[0m`);
      this.terminal.writeln(`\x1b[33m请使用内置命令，输入 help 查看\x1b[0m`);
    }
  }

  /**
   * 格式化 ls 命令的输出
   */
  formatLsOutput(output) {
    if (!output) return;
    
    // 分割文件名
    const items = output.trim().split('\n').filter(item => item.length > 0);
    
    if (items.length === 0) return;
    
    // 获取终端宽度
    const terminalCols = this.terminal.cols || 100;
    
    // 计算最长的文件名
    const maxLength = Math.max(...items.map(item => item.length));
    
    // 计算每行可以显示的列数
    const colWidth = Math.min(maxLength + 3, 25); // 限制最大宽度为25，增加3个空格间隔
    const numCols = Math.max(1, Math.floor(terminalCols / colWidth));
    
    // 给文件添加颜色的函数
    const colorizeItem = (item) => {
      // 目录
      if (item.endsWith('/') || !item.includes('.')) {
        // 检查是否是常见目录名
        const dirNames = ['node_modules', 'dist', 'build', 'assets', 'docs', 'src', 'scripts', 'archive', 'internal-docs'];
        if (dirNames.includes(item.replace('/', ''))) {
          return `\x1b[1;34m${item}\x1b[0m`; // 亮蓝色加粗表示目录
        }
        return `\x1b[34m${item}\x1b[0m`; // 蓝色表示目录
      }
      
      // 根据扩展名着色
      const ext = item.substring(item.lastIndexOf('.'));
      switch (ext) {
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
          return `\x1b[33m${item}\x1b[0m`; // 黄色 - JavaScript/TypeScript
        case '.json':
        case '.yml':
        case '.yaml':
          return `\x1b[35m${item}\x1b[0m`; // 紫色 - 配置文件
        case '.md':
        case '.txt':
          return `\x1b[36m${item}\x1b[0m`; // 青色 - 文档
        case '.sh':
        case '.bat':
          return `\x1b[32m${item}\x1b[0m`; // 绿色 - 脚本
        case '.png':
        case '.jpg':
        case '.gif':
        case '.svg':
          return `\x1b[95m${item}\x1b[0m`; // 亮紫色 - 图片
        case '.html':
        case '.css':
          return `\x1b[91m${item}\x1b[0m`; // 亮红色 - Web文件
        default:
          return item; // 默认颜色
      }
    };
    
    // 排序：目录在前，文件在后
    const sortedItems = items.sort((a, b) => {
      const aIsDir = !a.includes('.') || a.endsWith('/');
      const bIsDir = !b.includes('.') || b.endsWith('/');
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    
    // 按列输出
    for (let i = 0; i < sortedItems.length; i += numCols) {
      const row = sortedItems.slice(i, i + numCols);
      const formattedRow = row.map(item => {
        const colored = colorizeItem(item);
        // 计算实际显示长度（不包括 ANSI 转义序列）
        const displayLength = item.length;
        const padding = ' '.repeat(Math.max(0, colWidth - displayLength));
        return colored + padding;
      }).join('');
      
      this.terminal.writeln(formattedRow.trimEnd());
    }
  }

  /**
   * 显示帮助
   */
  showHelp() {
    this.terminal.writeln('\x1b[36m=== Miaoda 终端命令帮助 ===\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[32m此终端支持所有系统命令！\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m内置命令:\x1b[0m');
    this.terminal.writeln('  help         - 显示此帮助信息');
    this.terminal.writeln('  clear/cls    - 清空终端屏幕');
    this.terminal.writeln('  version      - 显示版本信息');
    this.terminal.writeln('  status       - 显示系统状态');
    this.terminal.writeln('  claude code  - 启动 Claude Code');
    this.terminal.writeln('  start        - 启动 Claude Code');
    this.terminal.writeln('  config       - 查看配置信息');
    this.terminal.writeln('  welcome      - 显示欢迎菜单');
    this.terminal.writeln('  reset        - 重置欢迎菜单标记');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m系统命令示例:\x1b[0m');
    this.terminal.writeln('  ls -la       - 详细列出文件');
    this.terminal.writeln('  cd /path     - 切换目录');
    this.terminal.writeln('  pwd          - 显示当前目录');
    this.terminal.writeln('  mkdir dir    - 创建目录');
    this.terminal.writeln('  rm file      - 删除文件');
    this.terminal.writeln('  cat file     - 查看文件内容');
    this.terminal.writeln('  echo text    - 输出文本');
    this.terminal.writeln('  git status   - Git 状态');
    this.terminal.writeln('  npm install  - 安装依赖');
    this.terminal.writeln('  python script.py - 运行 Python');
    this.terminal.writeln('  ... 以及所有其他系统命令！');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m快捷键:\x1b[0m');
    this.terminal.writeln('  Ctrl+C       - 中断当前操作');
    this.terminal.writeln('  Ctrl+L       - 清空屏幕');
    this.terminal.writeln('  ↑/↓          - 浏览命令历史');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[32m提示: 这是一个完整的系统终端，可以执行任何命令！\x1b[0m');
  }

  /**
   * 显示版本
   */
  showVersion() {
    this.terminal.writeln(`Miaoda 版本: ${window.electronAPI?.versions?.app || '2.0.8'}`);
    this.terminal.writeln(`Electron: ${window.electronAPI?.versions?.electron || 'unknown'}`);
    this.terminal.writeln(`Node.js: ${window.electronAPI?.versions?.node || 'unknown'}`);
    this.terminal.writeln(`Chrome: ${window.electronAPI?.versions?.chrome || 'unknown'}`);
  }

  /**
   * 显示状态
   */
  showStatus() {
    this.terminal.writeln('\x1b[32m● 系统状态: 正常\x1b[0m');
    this.terminal.writeln(`Claude Code: ${this.isClaudeRunning ? '\x1b[32m运行中\x1b[0m' : '\x1b[90m未启动\x1b[0m'}`);
    this.terminal.writeln(`终端类型: ${this.terminal.constructor.name || 'TerminalManager'}`);
    this.terminal.writeln(`平台: ${window.electronAPI?.platform || 'unknown'}`);
  }

  /**
   * Echo 命令
   */
  echo(args) {
    this.terminal.writeln(args.join(' '));
  }

  /**
   * 显示日期
   */
  showDate() {
    const now = new Date();
    this.terminal.writeln(now.toLocaleString('zh-CN'));
  }

  /**
   * 显示用户
   */
  showUser() {
    this.terminal.writeln(window.electronAPI?.username || 'miaoda-user');
  }


  /**
   * 处理退出
   */
  handleExit() {
    this.terminal.writeln('使用窗口控制按钮退出应用');
  }


  /**
   * 处理 claude 命令
   */
  handleClaude(args) {
    // 如果只输入 "claude"，直接启动 Claude Code
    if (!args || args.length === 0) {
      this.startClaude();
      return;
    }
    
    if (args[0] === 'code') {
      this.startClaude();
    } else {
      this.terminal.writeln(`\x1b[31m未知的 claude 子命令: ${args[0]}\x1b[0m`);
      this.terminal.writeln('\x1b[33m使用 "claude" 或 "claude code" 启动 Claude Code\x1b[0m');
    }
  }

  /**
   * 启动 Claude
   */
  startClaude() {
    // 触发启动按钮点击事件
    const startBtn = document.getElementById('start-claude-btn');
    if (startBtn && startBtn.style.display !== 'none') {
      this.terminal.writeln('\x1b[92m正在启动 Claude Code...\x1b[0m');
      startBtn.click();
    } else {
      // 如果没有选中的配置，提示用户
      this.terminal.writeln('\x1b[33m请先选择一个配置，或使用欢迎菜单中的选项\x1b[0m');
      this.terminal.writeln('提示：输入 \x1b[92m"menu"\x1b[0m 显示欢迎菜单');
    }
  }

  /**
   * 显示配置
   */
  showConfig() {
    this.terminal.writeln('\x1b[36m=== 配置管理 ===\x1b[0m');
    this.terminal.writeln('请使用左侧的配置管理界面来管理配置');
    this.terminal.writeln('或点击"新建配置"按钮创建新配置');
  }

  /**
   * 显示欢迎菜单
   */
  async showWelcomeMenu() {
    if (window.WelcomeMenu) {
      const welcomeMenu = new window.WelcomeMenu(this.terminal, {
        currentConfig: window.currentConfig,
        updateFooterStatus: window.updateFooterStatus
      });
      await welcomeMenu.show();
    } else {
      this.terminal.writeln('欢迎菜单不可用');
    }
  }

  /**
   * 重置欢迎标记
   */
  async resetWelcomeFlag() {
    await window.electronAPI.saveConfig({ hasSeenWelcomeMenu: false });
    this.terminal.writeln('已重置欢迎菜单标记');
    this.terminal.writeln('下次启动时将显示欢迎菜单');
  }

  /**
   * 设置 Claude 运行状态
   */
  setClaudeRunning(running) {
    this.isClaudeRunning = running;
  }
}

// 导出到全局
window.CommandExecutor = CommandExecutor;