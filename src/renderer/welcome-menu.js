'use strict';

/**
 * 欢迎菜单 - 基于新的终端接口
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
    
    // 当前状态
    this.currentMenu = 'main';
    this.keyHandler = null;
  }

  /**
   * 显示欢迎菜单
   */
  async show() {
    this.terminal.clear();
    this.displayLogo();
    this.displayMainMenu();
    this.waitForInput();
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
   * 显示主菜单
   */
  displayMainMenu() {
    const platform = this.platform === 'darwin' ? 'macOS' : 
      this.platform === 'win32' ? 'Windows' : 'Linux';
    
    this.terminal.writeln(`  \x1b[90m系统: ${platform} | 时间: ${new Date().toLocaleString('zh-CN')}\x1b[0m`);
    this.terminal.writeln('');
    this.terminal.writeln('  \x1b[36m请选择启动模式:\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('  \x1b[32m[1]\x1b[0m 🚀 快速开始 - 使用官方 Claude API');
    this.terminal.writeln('      \x1b[90m直接使用 Anthropic 官方 API，无需额外配置\x1b[0m');
    this.terminal.writeln('  \x1b[32m[2]\x1b[0m 🔧 代理模式 - 使用第三方 API (OpenAI/Gemini/国内大模型)');
    this.terminal.writeln('      \x1b[90m通过代理使用 GPT-4、Gemini、通义千问等模型\x1b[0m');
    this.terminal.writeln('  \x1b[32m[3]\x1b[0m ⚡ 免费体验 - 使用测试 API 立即开始');
    this.terminal.writeln('      \x1b[90m使用第三方免费 API 快速体验，可能有使用限制\x1b[0m');
    this.terminal.writeln('  \x1b[32m[4]\x1b[0m 📋 选择配置 - 从已保存的配置中选择');
    this.terminal.writeln('      \x1b[90m加载之前保存的 API 配置\x1b[0m');
    this.terminal.writeln('  \x1b[32m[5]\x1b[0m 🛠️ 环境检查 - 检查并安装依赖');
    this.terminal.writeln('      \x1b[90m检查 Node.js、Git、UV、Claude Code 安装状态\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.write('  请输入选项 (1-5) 或按 ESC 退出: ');
  }

  /**
   * 等待输入
   */
  waitForInput() {
    // 移除之前的监听器
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }

    this.keyHandler = (e) => {
      // ESC 键退出
      if (e.key === 'Escape') {
        this.close();
        return;
      }

      // 根据当前菜单处理输入
      if (this.currentMenu === 'main') {
        this.handleMainMenuInput(e);
      } else if (this.currentMenu === 'proxy') {
        this.handleProxyMenuInput(e);
      } else if (this.currentMenu === 'install') {
        this.handleInstallMenuInput(e);
      }
    };

    document.addEventListener('keydown', this.keyHandler);
  }

  /**
   * 处理主菜单输入
   */
  handleMainMenuInput(e) {
    const key = e.key;
    
    if (key >= '1' && key <= '5') {
      this.terminal.write(key);
      this.terminal.writeln('');
      this.terminal.writeln('');
      
      // 移除监听器，防止重复处理
      document.removeEventListener('keydown', this.keyHandler);
      
      // 延迟执行，让用户看到输入
      setTimeout(() => {
        switch (key) {
        case '1':
          this.handleQuickStart();
          break;
        case '2':
          this.showProxyMenu();
          break;
        case '3':
          this.handleQuickExperience();
          break;
        case '4':
          this.handleSelectConfig();
          break;
        case '5':
          this.handleEnvironmentCheck();
          break;
        }
      }, 100);
    }
  }

  /**
   * 快速开始
   */
  async handleQuickStart() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🚀 \x1b[33m快速开始 - 官方 Claude API\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    this.terminal.writeln('请准备你的 Anthropic API Key');
    this.terminal.writeln('获取地址: https://console.anthropic.com/');
    this.terminal.writeln('');
    
    try {
      const config = {
        id: 'official-' + Date.now(),
        name: '官方 Claude API',
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'YOUR_API_KEY',
        model: 'claude-3-opus-20240229'
      };
      
      await window.electronAPI.saveConfig(config);
      window.currentConfig = config;
      this.updateFooterStatus();
      
      this.terminal.writeln('✅ 配置已创建，请在设置中填入您的 API Key');
      this.terminal.writeln('');
      
      // 关闭菜单
      setTimeout(() => this.close(), 2000);
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 创建配置失败: ${error.message}\x1b[0m`);
    }
  }

  /**
   * 显示代理菜单
   */
  showProxyMenu() {
    this.currentMenu = 'proxy';
    
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🔧 \x1b[33m代理模式配置\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('选择代理类型:');
    this.terminal.writeln('');
    this.terminal.writeln('  \x1b[32m[1]\x1b[0m 🤖 OpenAI (GPT-4/GPT-3.5)');
    this.terminal.writeln('  \x1b[32m[2]\x1b[0m 🌟 Google Gemini');
    this.terminal.writeln('  \x1b[32m[3]\x1b[0m 🐉 国内大模型 (通义千问/文心一言等)');
    this.terminal.writeln('  \x1b[32m[4]\x1b[0m 🔧 自定义代理配置');
    this.terminal.writeln('  \x1b[32m[0]\x1b[0m 返回主菜单');
    this.terminal.writeln('');
    this.terminal.write('请选择 (0-4): ');
    
    this.waitForInput();
  }

  /**
   * 处理代理菜单输入
   */
  handleProxyMenuInput(e) {
    const key = e.key;
    
    if ((key >= '0' && key <= '4')) {
      this.terminal.write(key);
      this.terminal.writeln('');
      
      document.removeEventListener('keydown', this.keyHandler);
      
      if (key === '0') {
        // 返回主菜单
        this.currentMenu = 'main';
        this.terminal.clear();
        this.displayLogo();
        this.displayMainMenu();
        this.waitForInput();
      } else {
        this.terminal.writeln('');
        this.terminal.writeln('\x1b[33m提示: 请使用左侧配置面板创建代理配置\x1b[0m');
        this.terminal.writeln('');
        setTimeout(() => this.close(), 2000);
      }
    }
  }

  /**
   * 快速体验
   */
  async handleQuickExperience() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('⚡ \x1b[33m快速体验模式\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    try {
      const testConfig = {
        id: 'quick-experience-' + Date.now(),
        name: '免费测试 API',
        apiUrl: 'http://www.miaoda.vip/',
        apiKey: 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44',
        model: 'claude-3-7-sonnet-20250219'
      };
      
      await window.electronAPI.saveConfig(testConfig);
      window.currentConfig = testConfig;
      this.updateFooterStatus();
      
      this.terminal.writeln('✅ 免费测试配置已创建');
      this.terminal.writeln('');
      this.terminal.writeln('正在启动 Claude Code...');
      
      const result = await window.electronAPI.startClaudeCode(testConfig);
      if (result.success) {
        this.terminal.writeln('\x1b[32m✓ Claude Code 已启动\x1b[0m');
        this.terminal.writeln('');
        this.terminal.writeln('\x1b[33m提示: 这是第三方提供的免费 API，可能有使用限制\x1b[0m');
      } else {
        this.terminal.writeln(`\x1b[31m✗ 启动失败: ${result.message}\x1b[0m`);
      }
      
      setTimeout(() => this.close(), 3000);
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 设置失败: ${error.message}\x1b[0m`);
    }
  }

  /**
   * 选择配置
   */
  async handleSelectConfig() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('📋 \x1b[33m选择配置\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    try {
      const result = await window.electronAPI.getConfigs();
      const configs = result.configs || [];
      
      if (configs.length === 0) {
        this.terminal.writeln('\x1b[33m没有找到任何配置\x1b[0m');
        this.terminal.writeln('');
        this.terminal.writeln('请使用其他选项创建配置，或点击左侧"新建配置"按钮');
        setTimeout(() => this.close(), 3000);
        return;
      }
      
      this.terminal.writeln('可用配置:');
      this.terminal.writeln('');
      
      configs.forEach((config, index) => {
        this.terminal.writeln(`  \x1b[32m[${index + 1}]\x1b[0m ${config.name}`);
        this.terminal.writeln(`      模型: \x1b[90m${config.model}\x1b[0m`);
      });
      
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[33m请使用左侧配置列表选择配置\x1b[0m');
      
      setTimeout(() => this.close(), 3000);
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 获取配置失败: ${error.message}\x1b[0m`);
    }
  }

  /**
   * 环境检查
   */
  async handleEnvironmentCheck() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🛠️ \x1b[33m环境检查\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    this.terminal.writeln('正在检查系统环境...');
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
      
      for (const comp of components) {
        const status = result[comp.key];
        if (status?.installed) {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${comp.name}: ${status.version || '已安装'}`);
        } else {
          hasError = true;
          this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${comp.name}: 未安装${comp.required ? ' (必需)' : ' (可选)'}`);
        }
      }
      
      this.terminal.writeln('');
      
      if (hasError) {
        this.currentMenu = 'install';
        this.terminal.writeln('发现缺失的组件，是否自动安装？');
        this.terminal.writeln('');
        this.terminal.writeln('  \x1b[32m[1]\x1b[0m 自动安装所有缺失组件');
        this.terminal.writeln('  \x1b[32m[2]\x1b[0m 只安装必需组件');
        this.terminal.writeln('  \x1b[32m[0]\x1b[0m 跳过');
        this.terminal.writeln('');
        this.terminal.write('请选择 (0-2): ');
        this.waitForInput();
      } else {
        this.terminal.writeln('\x1b[32m✓ 所有组件都已安装！\x1b[0m');
        this.terminal.writeln('');
        setTimeout(() => this.close(), 2000);
      }
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m✗ 检查失败: ${error.message}\x1b[0m`);
      setTimeout(() => this.close(), 3000);
    }
  }

  /**
   * 处理安装菜单输入
   */
  handleInstallMenuInput(e) {
    const key = e.key;
    
    if (key >= '0' && key <= '2') {
      this.terminal.write(key);
      this.terminal.writeln('');
      
      document.removeEventListener('keydown', this.keyHandler);
      
      if (key === '0') {
        this.close();
      } else {
        this.terminal.writeln('');
        this.terminal.writeln('\x1b[33m请使用命令行工具手动安装缺失的组件\x1b[0m');
        setTimeout(() => this.close(), 3000);
      }
    }
  }

  /**
   * 关闭菜单
   */
  close() {
    // 移除事件监听
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
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