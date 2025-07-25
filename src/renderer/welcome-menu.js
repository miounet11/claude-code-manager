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
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[I]\x1b[90m 一键安装缺失依赖\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[S]\x1b[90m 跳过并直接启动\x1b[0m');
    this.terminal.writeln('  \x1b[90m按 \x1b[32m[D]\x1b[90m 调试环境检测\x1b[0m');
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
      if (key === 'c' || key === 's' || key === 'i' || key === 'd') {
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
          } else if (key === 'd') {
            this.debugEnvironment();
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
   * 一键安装缺失依赖
   */
  async installClaudeCode() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('📦 \x1b[33m一键安装缺失依赖...\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    try {
      // 先检查环境
      this.terminal.writeln('\x1b[90m正在检查环境...\x1b[0m');
      const envCheck = await window.electronAPI.checkEnvironment();
      
      // 找出缺失的依赖
      const missing = [];
      const components = [
        { key: 'nodejs', name: 'Node.js' },
        { key: 'git', name: 'Git' },
        { key: 'uv', name: 'UV' },
        { key: 'claude', name: 'Claude Code' }
      ];
      
      for (const comp of components) {
        if (!envCheck[comp.key]?.installed) {
          missing.push(comp);
        }
      }
      
      if (missing.length === 0) {
        this.terminal.writeln('\x1b[32m✅ 所有依赖都已安装！\x1b[0m');
      } else {
        this.terminal.writeln(`\x1b[33m发现 ${missing.length} 个缺失的依赖:\x1b[0m`);
        for (const dep of missing) {
          this.terminal.writeln(`  • ${dep.name}`);
        }
        this.terminal.writeln('');
        
        // 监听安装进度
        const progressHandler = (event, progress) => {
          if (progress.status === 'installing') {
            this.terminal.writeln(`\x1b[90m正在安装 ${progress.current}...\x1b[0m`);
          } else if (progress.status === 'success') {
            this.terminal.writeln(`\x1b[32m✅ ${progress.current}: ${progress.message}\x1b[0m`);
          } else if (progress.status === 'failed') {
            this.terminal.writeln(`\x1b[31m❌ ${progress.current}: ${progress.message}\x1b[0m`);
            
            // 显示安装说明
            if (progress.result?.details?.instructions) {
              this.terminal.writeln('\x1b[36m  手动安装说明:\x1b[0m');
              for (const instruction of progress.result.details.instructions) {
                this.terminal.writeln(`    \x1b[90m${instruction}\x1b[0m`);
              }
              this.terminal.writeln('');
            }
          }
        };
        
        // 注册进度监听器
        if (window.electronAPI.onInstallProgress) {
          window.electronAPI.onInstallProgress(progressHandler);
        }
        
        // 开始批量安装
        this.terminal.writeln('\x1b[36m开始安装...\x1b[0m');
        this.terminal.writeln('');
        
        const results = await window.electronAPI.installMissingDependencies();
        
        // 移除进度监听器
        if (window.electronAPI.removeInstallProgress) {
          window.electronAPI.removeInstallProgress(progressHandler);
        }
        
        // 显示总结
        this.terminal.writeln('');
        this.terminal.writeln('\x1b[36m安装总结:\x1b[0m');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [dep, result] of Object.entries(results)) {
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
        
        if (successCount > 0) {
          this.terminal.writeln(`  \x1b[32m✅ 成功安装 ${successCount} 个依赖\x1b[0m`);
        }
        if (failCount > 0) {
          this.terminal.writeln(`  \x1b[31m❌ ${failCount} 个依赖需要手动安装\x1b[0m`);
        }
        
        if (successCount > 0) {
          this.terminal.writeln('');
          this.terminal.writeln('\x1b[33m⚠️  请重启应用程序以确保环境变量生效\x1b[0m');
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
   * 调试环境检测
   */
  async debugEnvironment() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🔍 \x1b[33m调试环境检测\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    try {
      // 使用新的调试 API
      if (window.electronAPI.debugEnvironment) {
        this.terminal.writeln('\x1b[90m正在收集系统信息...\x1b[0m');
        const debugInfo = await window.electronAPI.debugEnvironment();
        
        // 显示系统信息
        this.terminal.writeln('\x1b[36m系统信息:\x1b[0m');
        this.terminal.writeln(`  平台: ${debugInfo.system.platform}`);
        this.terminal.writeln(`  架构: ${debugInfo.system.arch}`);
        this.terminal.writeln(`  Node 版本: ${debugInfo.system.nodeVersion}`);
        this.terminal.writeln('');
        
        // 显示 PATH
        this.terminal.writeln('\x1b[36mPATH 环境变量:\x1b[0m');
        if (debugInfo.system.env.PATH) {
          const paths = debugInfo.system.env.PATH.split(process.platform === 'win32' ? ';' : ':');
          paths.forEach(p => {
            this.terminal.writeln(`  \x1b[90m${p}\x1b[0m`);
          });
        }
        this.terminal.writeln('');
        
        // 显示 Shell PATH（如果不同）
        if (debugInfo.system.shellPath && debugInfo.system.shellPath !== debugInfo.system.env.PATH) {
          this.terminal.writeln('\x1b[36mShell PATH:\x1b[0m');
          const shellPaths = debugInfo.system.shellPath.split(':');
          shellPaths.forEach(p => {
            this.terminal.writeln(`  \x1b[90m${p}\x1b[0m`);
          });
          this.terminal.writeln('');
        }
        
        // 显示环境检查结果
        this.terminal.writeln('\x1b[36m环境检查结果:\x1b[0m');
        for (const [key, value] of Object.entries(debugInfo.environment)) {
          if (value.installed) {
            this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${key}: ${value.version}${value.path ? ` (${value.path})` : ''}`);
          } else {
            this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${key}: ${value.error || '未安装'}`);
          }
        }
        this.terminal.writeln('');
        
        // 显示总结
        this.terminal.writeln('\x1b[36m总结:\x1b[0m');
        if (debugInfo.summary.ready) {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${debugInfo.summary.message}`);
        } else {
          this.terminal.writeln(`  \x1b[33m⚠\x1b[0m ${debugInfo.summary.message}`);
          if (debugInfo.summary.missing.length > 0) {
            this.terminal.writeln(`  缺失: ${debugInfo.summary.missing.join(', ')}`);
          }
        }
      } else {
        // 降级到旧的调试方法
        this.terminal.writeln('\x1b[90mPATH 环境变量:\x1b[0m');
        const pathResult = await window.electronAPI.executeCommand('echo $PATH');
        if (pathResult.success) {
          const paths = pathResult.stdout.split(':');
          paths.forEach(p => {
            this.terminal.writeln(`  \x1b[90m${p}\x1b[0m`);
          });
        }
        this.terminal.writeln('');
        
        // 测试直接执行命令
        const commands = [
          { cmd: 'node', args: '--version', name: 'Node.js' },
          { cmd: 'npm', args: '--version', name: 'npm' },
          { cmd: 'claude', args: '--version', name: 'Claude Code' },
          { cmd: 'uv', args: '--version', name: 'UV' },
          { cmd: 'which node', args: '', name: 'which node' },
          { cmd: 'which claude', args: '', name: 'which claude' },
          { cmd: '/usr/local/bin/node', args: '--version', name: '/usr/local/bin/node' },
          { cmd: '/opt/homebrew/bin/node', args: '--version', name: '/opt/homebrew/bin/node' }
        ];
        
        this.terminal.writeln('\x1b[90m直接命令测试:\x1b[0m');
        for (const test of commands) {
          const fullCmd = test.args ? `${test.cmd} ${test.args}` : test.cmd;
          const result = await window.electronAPI.executeCommand(fullCmd);
          
          if (result.success && result.stdout) {
            this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${test.name}: ${result.stdout.trim()}`);
          } else {
            this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${test.name}: ${result.error || '无输出'}`);
          }
        }
        
        this.terminal.writeln('');
        
        // 调用后端环境检测
        this.terminal.writeln('\x1b[90m后端环境检测结果:\x1b[0m');
        const envResult = await window.electronAPI.checkEnvironment();
        
        for (const [key, value] of Object.entries(envResult)) {
          if (value.installed) {
            this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${key}: ${value.version}`);
          } else {
            this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${key}: ${value.error || '未安装'}`);
          }
        }
      }
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m调试失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回...\x1b[0m');
    
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