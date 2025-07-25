'use strict';

/**
 * 欢迎界面 - 简化版本，自动化流程
 */
class WelcomeMenu {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.currentConfig = options.currentConfig;
    this.updateFooterStatus = options.updateFooterStatus || (() => {});
    this.onClose = null;
    
    // 平台检测
    const platform = navigator.userAgent.toLowerCase();
    if (platform.includes('win')) {
      this.platform = 'win32';
    } else if (platform.includes('mac')) {
      this.platform = 'darwin';  
    } else {
      this.platform = 'linux';
    }
    
    // 倒计时相关
    this.countdown = 30; // 30秒倒计时
    this.countdownTimer = null;
    this.autoStartTimer = null;
    
    // 环境检查结果
    this.environmentOK = false;
    this.hasConfig = false;
  }

  /**
   * 显示欢迎界面
   */
  async show() {
    // 禁用终端输入到PTY
    if (this.terminal.setInputEnabled) {
      this.terminal.setInputEnabled(false);
    }
    
    // 禁用自动回显
    if (this.terminal.setAutoEcho) {
      this.terminal.setAutoEcho(false);
    }
    
    // 不清空终端，保留之前的内容
    this.terminal.writeln('');  // 添加一个空行
    this.displayLogo();
    
    // 检查当前配置
    this.hasConfig = !!this.currentConfig;
    
    // 显示欢迎信息和倒计时
    this.displayWelcomeMessage();
    
    // 开始倒计时
    this.startCountdown();
    
    // 监听用户输入
    this.setupInputHandler();
  }

  /**
   * 显示 Logo
   */
  displayLogo() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[92m    ███╗   ███╗██╗ █████╗  ██████╗ ██████╗  █████╗ ');
    this.terminal.writeln('    ████╗ ████║██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗');
    this.terminal.writeln('    ██╔████╔██║██║███████║██║   ██║██║  ██║███████║');
    this.terminal.writeln('    ██║╚██╔╝██║██║██╔══██║██║   ██║██║  ██║██╔══██║');
    this.terminal.writeln('    ██║ ╚═╝ ██║██║██║  ██║╚██████╔╝██████╔╝██║  ██║');
    this.terminal.writeln('    ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('                \x1b[33mClaude Code Manager v2.0.8\x1b[0m');
    this.terminal.writeln('    \x1b[90m全球唯一支持 380+ AI 模型的管理工具 - 永久免费\x1b[0m');
    this.terminal.writeln('\x1b[90m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
  }

  /**
   * 显示欢迎信息
   */
  displayWelcomeMessage() {
    const platform = this.platform === 'darwin' ? 'macOS' : 
      this.platform === 'win32' ? 'Windows' : 'Linux';
    
    this.terminal.writeln(`  \x1b[90m系统: ${platform} | 时间: ${new Date().toLocaleString('zh-CN')}\x1b[0m`);
    this.terminal.writeln('');
    this.terminal.writeln('  \x1b[36m欢迎使用 Claude Code 管理器\x1b[0m');
    this.terminal.writeln('');
    
    if (this.hasConfig) {
      this.terminal.writeln(`  \x1b[32m✓\x1b[0m 当前配置: ${this.currentConfig.name}`);
      this.terminal.writeln(`  \x1b[90m  模型: ${this.currentConfig.model || '未设置'}\x1b[0m`);
    } else {
      this.terminal.writeln('  \x1b[33m⚠\x1b[0m 尚未选择配置');
    }
    
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    
    // 记录倒计时行的位置
    this.countdownLineMarker = '[[COUNTDOWN]]';
    this.terminal.writeln(`  \x1b[93m⏰ 将在 \x1b[96m${this.countdown}\x1b[93m 秒后自动检查环境并启动...\x1b[0m${this.countdownLineMarker}`);
    
    this.terminal.writeln('');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[Enter]\x1b[90m 立即开始\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[C]\x1b[90m 只检查环境\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[I]\x1b[90m 安装 Claude Code\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[S]\x1b[90m 跳过并直接启动\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[31m[ESC]\x1b[90m 退出\x1b[0m');
    this.terminal.writeln('');
  }

  /**
   * 设置输入处理
   */
  setupInputHandler() {
    // 添加标志防止重复处理
    this.isProcessingInput = false;
    this.isClosing = false;
    
    this.dataHandler = (data) => {
      // 详细日志：监控欢迎菜单的输入
      console.log('[WelcomeMenu.dataHandler] 收到输入:', JSON.stringify(data), {
        charCode: data.charCodeAt(0),
        isProcessingInput: this.isProcessingInput,
        isClosing: this.isClosing
      });
      
      // 如果正在处理输入或正在关闭，忽略新的输入
      if (this.isProcessingInput || this.isClosing) {
        console.log('[WelcomeMenu.dataHandler] 忽略输入（正在处理或关闭）');
        return;
      }
      
      // ESC 键
      if (data === '\x1b' || data === '\x1b\x1b') {
        this.isProcessingInput = true;
        this.stopCountdown();
        this.close();
        return;
      }
      
      // Enter 键
      if (data === '\r' || data === '\n') {
        this.isProcessingInput = true;
        this.stopCountdown();
        this.startAutoProcess();
        return;
      }
      
      // 处理其他按键
      const key = data.toLowerCase();
      if (key === 'c' || key === 's' || key === 'i') {
        console.log('[WelcomeMenu.dataHandler] 处理按键:', key.toUpperCase());
        this.isProcessingInput = true;
        // 手动显示按下的键（因为自动回显已关闭）
        console.log('[WelcomeMenu.dataHandler] 写入到终端:', data.toUpperCase());
        this.terminal.write(data.toUpperCase());
        this.terminal.writeln('');
        this.stopCountdown();
        
        // 使用 setTimeout 确保显示完成后再执行操作
        setTimeout(() => {
          if (key === 'c') {
            this.checkEnvironmentOnly();
          } else if (key === 's') {
            this.skipAndStart();
          } else if (key === 'i') {
            this.installClaudeCode();
          }
        }, 100);
      }
    };
    
    if (this.terminal.onInput) {
      console.log('[WelcomeMenu.setupInputHandler] 设置终端输入处理器');
      this.terminal.onInput(this.dataHandler);
    }
  }
  
  /**
   * 开始倒计时
   */
  startCountdown() {
    // 防止重复启动倒计时
    if (this.countdownTimer) {
      return;
    }
    
    this.countdownTimer = setInterval(() => {
      this.countdown--;
      
      // 不更新显示，避免终端混乱
      // this.updateCountdownDisplay();
      
      if (this.countdown <= 0) {
        this.stopCountdown();
        this.startAutoProcess();
      }
    }, 1000);
  }
  
  /**
   * 停止倒计时
   */
  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
  
  /**
   * 更新倒计时显示
   */
  updateCountdownDisplay() {
    // 移动光标到倒计时行
    this.terminal.write('\x1b[s'); // 保存光标位置
    this.terminal.write('\x1b[11A'); // 向上移动 11 行
    this.terminal.write('\x1b[2K'); // 清除当前行
    this.terminal.write(`  \x1b[93m⏰ 将在 \x1b[96m${this.countdown}\x1b[93m 秒后自动检查环境并启动...\x1b[0m`);
    this.terminal.write('\x1b[u'); // 恢复光标位置
  }

  /**
   * 开始自动处理流程
   */
  async startAutoProcess() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('🚀 \x1b[33m正在检查环境...\x1b[0m');
    this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    
    try {
      const result = await window.electronAPI.checkEnvironment();
      
      const components = [
        { key: 'nodejs', name: 'Node.js', required: true },
        { key: 'git', name: 'Git', required: true },
        { key: 'uv', name: 'UV (Python 包管理器)', required: false },
        { key: 'claude', name: 'Claude Code', required: true }
      ];
      
      let hasError = false;
      let needsInstall = [];
      
      for (const comp of components) {
        const status = result[comp.key];
        if (status?.installed) {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${comp.name}: ${status.version || '已安装'}`);
        } else {
          this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${comp.name}: 未安装${comp.required ? ' (必需)' : ' (可选)'}`);
          if (comp.required) {
            hasError = true;
            needsInstall.push(comp);
          }
        }
      }
      
      this.terminal.writeln('');
      
      if (hasError) {
        this.terminal.writeln('\x1b[33m⚠ 发现缺失的必需组件\x1b[0m');
        this.terminal.writeln('\x1b[90m请使用命令行工具安装缺失的组件，然后重新启动应用\x1b[0m');
        
        // 显示安装指南
        this.showInstallGuide(needsInstall);
      } else {
        this.environmentOK = true;
        this.terminal.writeln('\x1b[32m✓ 所有必需组件都已安装！\x1b[0m');
        this.terminal.writeln('');
        
        // 如果有配置，自动启动 Claude Code
        if (this.hasConfig) {
          this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
          this.terminal.writeln('🚀 \x1b[33m正在启动 Claude Code...\x1b[0m');
          this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
          this.terminal.writeln('');
          
          await this.launchClaudeCode();
        } else {
          this.terminal.writeln('\x1b[33m⚠ 尚未配置 API\x1b[0m');
          this.terminal.writeln('\x1b[90m请使用左侧配置面板创建或选择一个配置\x1b[0m');
        }
      }
      
      // 关闭菜单
      this.close();
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 检查失败: ${error.message}\x1b[0m`);
      // 立即关闭菜单
      this.close();
    }
  }

  /**
   * 只检查环境
   */
  async checkEnvironmentOnly() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('🛠️ \x1b[33m环境检查\x1b[0m');
    this.terminal.writeln('\x1b[36m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    
    try {
      const result = await window.electronAPI.checkEnvironment();
      
      const components = [
        { key: 'nodejs', name: 'Node.js', required: true },
        { key: 'git', name: 'Git', required: true },
        { key: 'uv', name: 'UV (Python 包管理器)', required: false },
        { key: 'claude', name: 'Claude Code', required: true }
      ];
      
      for (const comp of components) {
        const status = result[comp.key];
        if (status?.installed) {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${comp.name}: ${status.version || '已安装'}`);
        } else {
          this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${comp.name}: 未安装${comp.required ? ' (必需)' : ' (可选)'}`);
        }
      }
      
      this.terminal.writeln('');
      // 立即关闭菜单
      this.close();
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 检查失败: ${error.message}\x1b[0m`);
      // 立即关闭菜单
      this.close();
    }
  }

  /**
   * 跳过并直接启动
   */
  async skipAndStart() {
    this.terminal.writeln('');
    
    if (this.hasConfig) {
      this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
      this.terminal.writeln('🚀 \x1b[33m跳过检查，直接启动 Claude Code...\x1b[0m');
      this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
      this.terminal.writeln('');
      
      await this.launchClaudeCode();
      // 立即关闭菜单
      this.close();
    } else {
      this.terminal.writeln('\x1b[33m⚠ 无法启动：尚未配置 API\x1b[0m');
      this.terminal.writeln('\x1b[90m请使用左侧配置面板创建或选择一个配置\x1b[0m');
      this.terminal.writeln('');
      
      // 立即关闭菜单
      this.close();
    }
  }

  /**
   * 启动 Claude Code
   */
  async launchClaudeCode() {
    try {
      const result = await window.electronAPI.startClaudeCode(this.currentConfig);
      
      if (result.success) {
        this.terminal.writeln(`  \x1b[92m✨ Claude Code 启动成功！\x1b[0m`);
        this.terminal.writeln('');
        this.terminal.writeln('  \x1b[90mClaude Code 已在新的终端窗口中打开\x1b[0m');
        this.terminal.writeln('  \x1b[90m请在新窗口中与 Claude 进行对话\x1b[0m');
      } else {
        this.terminal.writeln(`  \x1b[91m❌ 启动失败: ${result.message}\x1b[0m`);
      }
    } catch (error) {
      this.terminal.writeln(`  \x1b[91m❌ 启动异常: ${error.message}\x1b[0m`);
    }
  }

  /**
   * 显示安装指南
   */
  showInstallGuide(needsInstall) {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m安装指南：\x1b[0m');
    
    for (const comp of needsInstall) {
      this.terminal.writeln('');
      this.terminal.writeln(`  \x1b[33m${comp.name}：\x1b[0m`);
      
      switch (comp.key) {
      case 'nodejs':
        if (this.platform === 'darwin') {
          this.terminal.writeln('    brew install node');
        } else if (this.platform === 'win32') {
          this.terminal.writeln('    从 https://nodejs.org 下载安装');
        } else {
          this.terminal.writeln('    sudo apt install nodejs npm');
        }
        break;
        
      case 'git':
        if (this.platform === 'darwin') {
          this.terminal.writeln('    brew install git');
        } else if (this.platform === 'win32') {
          this.terminal.writeln('    从 https://git-scm.com 下载安装');
        } else {
          this.terminal.writeln('    sudo apt install git');
        }
        break;
        
      case 'claude':
        this.terminal.writeln('    npm install -g @anthropic-ai/claude-code');
        break;
      }
    }
    
    this.terminal.writeln('');
  }

  /**
   * 安装 Claude Code
   */
  async installClaudeCode() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('📦 \x1b[33m正在安装 Claude Code...\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    try {
      this.terminal.writeln('\x1b[90m执行命令: npm install -g @anthropic-ai/claude-code\x1b[0m');
      this.terminal.writeln('\x1b[90m这可能需要几分钟时间，请耐心等待...\x1b[0m');
      this.terminal.writeln('');
      
      const result = await window.electronAPI.installDependency('claude');
      
      if (result.success) {
        this.terminal.writeln('\x1b[32m✅ ' + result.message + '\x1b[0m');
        this.terminal.writeln('');
        this.terminal.writeln('\x1b[33m⚠️  请重启应用程序以确保环境变量生效\x1b[0m');
      } else {
        this.terminal.writeln('\x1b[31m❌ ' + result.message + '\x1b[0m');
        
        if (result.instructions) {
          this.terminal.writeln('');
          this.terminal.writeln('\x1b[36m建议步骤：\x1b[0m');
          for (const instruction of result.instructions) {
            this.terminal.writeln(`  \x1b[90m${instruction}\x1b[0m`);
          }
        }
      }
    } catch (error) {
      this.terminal.writeln(`\x1b[31m❌ 安装失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
    
    // 等待按键后关闭
    const tempHandler = () => {
      if (this.terminal.onInput) {
        this.terminal.onInput(null);
      }
      this.close();
    };
    
    if (this.terminal.onInput) {
      this.terminal.onInput(tempHandler);
    }
  }

  /**
   * 关闭菜单
   */
  close() {
    // 防止重复关闭
    if (this.isClosing) {
      return;
    }
    this.isClosing = true;
    
    // 停止倒计时
    this.stopCountdown();
    
    // 移除事件监听
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    
    // 清理数据处理器 - 重要：先移除输入处理器
    if (this.terminal.onInput && this.dataHandler) {
      // 设置一个空的处理器来移除之前的
      console.log('[WelcomeMenu.close] 清理输入处理器');
      this.terminal.onInput(null);
      this.dataHandler = null;
    }
    
    // 恢复终端输入
    if (this.terminal.setInputEnabled) {
      this.terminal.setInputEnabled(true);
    }
    
    // 保持自动回显为 false，避免双重回显问题
    if (this.terminal.setAutoEcho) {
      this.terminal.setAutoEcho(false);
    }
    
    // 调用关闭回调
    if (this.onClose) {
      this.onClose();
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelcomeMenu;
} else {
  window.WelcomeMenu = WelcomeMenu;
}