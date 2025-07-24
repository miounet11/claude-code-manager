'use strict';

class WelcomeMenu {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.currentConfig = options.currentConfig;
    this.updateFooterStatus = options.updateFooterStatus || (() => {});
    this.selectedOption = null;
    // 通过 navigator.platform 判断平台
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      this.platform = 'win32';
    } else if (platform.includes('mac')) {
      this.platform = 'darwin';
    } else {
      this.platform = 'linux';
    }
  }

  async show() {
    this.clear();
    this.displayWelcome();
    await this.displayInitialMenu();
  }

  clear() {
    this.terminal.clear();
  }

  displayWelcome() {
    this.terminal.writeln('');
    
    // ASCII Art Logo - 使用亮绿色
    this.terminal.writeln('\x1b[92m    ███╗   ███╗██╗ █████╗  ██████╗ ██████╗  █████╗ ');
    this.terminal.writeln('    ████╗ ████║██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗');
    this.terminal.writeln('    ██╔████╔██║██║███████║██║   ██║██║  ██║███████║');
    this.terminal.writeln('    ██║╚██╔╝██║██║██╔══██║██║   ██║██║  ██║██╔══██║');
    this.terminal.writeln('    ██║ ╚═╝ ██║██║██║  ██║╚██████╔╝██████╔╝██║  ██║');
    this.terminal.writeln('    ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝\x1b[0m');
    
    this.terminal.writeln('                \x1b[33mClaude Code Manager v2.0.8\x1b[0m');
    this.terminal.writeln('    \x1b[90m全球唯一支持 380+ AI 模型的管理工具 - 永久免费\x1b[0m');
    this.terminal.writeln('\x1b[90m═══════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
  }

  async displayInitialMenu() {
    // 显示系统信息
    const platform = this.platform === 'darwin' ? 'macOS' : 
                    this.platform === 'win32' ? 'Windows' : 'Linux';
    
    this.terminal.writeln(`  \x1b[90m系统: ${platform} | 时间: ${new Date().toLocaleString('zh-CN')}\x1b[0m`);
    this.terminal.writeln('');
    
    // 显示主菜单
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
    this.terminal.write('  请输入选项 (1-5): ');

    this.waitForMenuInput();
  }

  waitForMenuInput() {
    const handleKeyPress = (e) => {
      console.log('欢迎菜单接收到按键:', e.key);
      const key = e.key;
      
      if (key >= '1' && key <= '5') {
        this.terminal.write(key);
        this.selectedOption = parseInt(key);
        
        document.removeEventListener('keypress', handleKeyPress);
        
        setTimeout(() => {
          console.log('处理菜单选择:', this.selectedOption);
          this.handleMenuSelection(this.selectedOption);
        }, 100);
      }
    };

    document.addEventListener('keypress', handleKeyPress);
  }

  async handleMenuSelection(option) {
    this.terminal.writeln('');
    this.terminal.writeln('');
    
    let shouldClose = true; // 默认情况下关闭菜单
    
    switch (option) {
      case 1:
        await this.handleQuickStart();
        break;
      case 2:
        await this.handleProxyMode();
        shouldClose = false; // 代理模式有子菜单，不立即关闭
        break;
      case 3:
        await this.handleQuickExperience();
        break;
      case 4:
        await this.handleSelectConfig();
        break;
      case 5:
        await this.handleEnvironmentCheck();
        shouldClose = false; // 环境检查可能返回主菜单
        break;
    }
    
    // 只有需要关闭时才调用回调
    if (shouldClose && this.onClose) {
      this.onClose();
    }
  }

  async handleQuickStart() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🚀 \x1b[33m快速开始 - 官方 Claude API\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    // 检查 Claude 是否已安装
    const envResult = await window.electronAPI.checkEnvironment();
    
    if (!envResult.claude?.installed) {
      this.terminal.writeln('⚠️  检测到 Claude Code 未安装');
      this.terminal.writeln('');
      this.terminal.writeln('正在安装 Claude Code...');
      await this.installClaude();
      this.terminal.writeln('');
    }
    
    this.terminal.writeln('请准备你的 Anthropic API Key');
    this.terminal.writeln('获取地址: https://console.anthropic.com/');
    this.terminal.writeln('');
    this.terminal.writeln('启动后，Claude Code 会提示你输入 API Key');
    this.terminal.writeln('');
    this.terminal.writeln('正在启动 Claude Code...');
    this.terminal.writeln('');
    
    try {
      // 检查是否有默认配置
      const configs = await window.electronAPI.getConfigs();
      if (configs.configs && configs.configs.length > 0) {
        // 使用第一个配置启动
        const defaultConfig = configs.configs[0];
        await window.electronAPI.startClaudeCode(defaultConfig);
      } else {
        // 创建一个临时配置用于官方 API
        const officialConfig = {
          id: 'official-' + Date.now(),
          name: '官方 Claude API',
          apiUrl: 'https://api.anthropic.com',
          apiKey: 'YOUR_API_KEY', // 用户需要在启动后输入
          model: 'claude-3-opus-20240229'
        };
        await window.electronAPI.startClaudeCode(officialConfig);
      }
    } catch (error) {
      this.terminal.writeln(`❌ 启动失败: ${error.message}`);
    }
  }

  async handleProxyMode() {
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
    
    this.waitForProxySelection();
  }

  waitForProxySelection() {
    const handleKeyPress = async (e) => {
      const key = e.key;
      
      if ((key >= '0' && key <= '4')) {
        this.terminal.write(key);
        document.removeEventListener('keypress', handleKeyPress);
        
        const selection = parseInt(key);
        this.terminal.writeln('');
        this.terminal.writeln('');
        
        if (selection === 0) {
          await this.displayInitialMenu();
          return;
        }
        
        await this.setupProxy(selection);
      }
    };
    
    document.addEventListener('keypress', handleKeyPress);
  }

  async setupProxy(type) {
    let proxyConfig = {};
    
    switch (type) {
      case 1: // OpenAI
        this.terminal.writeln('\x1b[33m配置 OpenAI 代理\x1b[0m');
        this.terminal.writeln('');
        proxyConfig = {
          name: 'OpenAI 代理',
          apiUrl: 'https://api.openai.com/v1',
          model: 'gpt-4',
          smallModel: 'gpt-3.5-turbo',
          maxTokens: 8192,
          proxyType: 'openai'
        };
        break;
        
      case 2: // Gemini
        this.terminal.writeln('\x1b[33m配置 Google Gemini 代理\x1b[0m');
        this.terminal.writeln('');
        proxyConfig = {
          name: 'Gemini 代理',
          apiUrl: 'https://generativelanguage.googleapis.com/v1',
          model: 'gemini-2.5-pro',
          smallModel: 'gemini-2.5-flash',
          maxTokens: 65535,
          proxyType: 'gemini'
        };
        break;
        
      case 3: // 国内大模型
        this.terminal.writeln('\x1b[33m配置国内大模型代理\x1b[0m');
        this.terminal.writeln('');
        this.terminal.writeln('支持: 通义千问、文心一言、智谱清言等');
        proxyConfig = {
          name: '国内大模型代理',
          apiUrl: '',
          model: '',
          smallModel: '',
          maxTokens: 4096,
          proxyType: 'custom'
        };
        break;
        
      case 4: // 自定义
        this.terminal.writeln('\x1b[33m自定义代理配置\x1b[0m');
        this.terminal.writeln('');
        proxyConfig = {
          name: '自定义代理',
          apiUrl: '',
          model: '',
          smallModel: '',
          maxTokens: 4096,
          proxyType: 'custom'
        };
        break;
    }
    
    // 提示输入 API Key
    this.terminal.writeln('请输入您的 API Key:');
    this.terminal.writeln('（输入后按回车，或按 ESC 取消）');
    this.terminal.writeln('');
    this.terminal.write('API Key: ');
    
    // 等待输入 API Key
    const apiKey = await this.waitForApiKeyInput();
    if (!apiKey) {
      this.terminal.writeln('');
      this.terminal.writeln('已取消配置');
      return;
    }
    
    proxyConfig.apiKey = apiKey;
    
    // 如果是自定义配置，需要输入更多信息
    if (type === 3 || type === 4) {
      this.terminal.writeln('');
      this.terminal.writeln('请输入 API Base URL:');
      this.terminal.write('URL: ');
      
      const apiUrl = await this.waitForTextInput();
      if (!apiUrl) {
        this.terminal.writeln('');
        this.terminal.writeln('已取消配置');
        return;
      }
      proxyConfig.apiUrl = apiUrl;
      
      this.terminal.writeln('');
      this.terminal.writeln('请输入模型名称:');
      this.terminal.write('Model: ');
      
      const model = await this.waitForTextInput();
      if (!model) {
        this.terminal.writeln('');
        this.terminal.writeln('已取消配置');
        return;
      }
      proxyConfig.model = model;
      proxyConfig.smallModel = model;
    }
    
    // 使用代理管理器设置代理
    this.terminal.writeln('');
    this.terminal.writeln('');
    
    try {
      const proxyManager = new window.ProxyManager(this.terminal);
      const success = await proxyManager.setupProxy(proxyConfig);
      
      if (success) {
        // 保存配置
        const config = {
          id: Date.now().toString(),
          name: proxyConfig.name,
          apiUrl: proxyConfig.apiUrl,
          apiKey: proxyConfig.apiKey,
          model: proxyConfig.model,
          proxyType: proxyConfig.proxyType
        };
        
        await window.electronAPI.saveConfig(config);
        window.currentConfig = config;
        this.updateFooterStatus();
      }
    } catch (error) {
      this.terminal.writeln(`❌ 设置代理失败: ${error.message}`);
    }
    
    // 代理设置完成后，关闭菜单
    if (this.onClose) {
      this.onClose();
    }
  }
  
  async waitForApiKeyInput() {
    return new Promise((resolve) => {
      let input = '';
      
      const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          document.removeEventListener('keypress', handleKeyPress);
          this.terminal.writeln('');
          resolve(input);
        } else if (e.key === 'Escape') {
          document.removeEventListener('keypress', handleKeyPress);
          resolve(null);
        } else if (e.key === 'Backspace') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            this.terminal.write('\b \b');
          }
        } else if (e.key.length === 1) {
          input += e.key;
          this.terminal.write('*'); // 隐藏 API Key
        }
      };
      
      document.addEventListener('keypress', handleKeyPress);
    });
  }
  
  async waitForTextInput() {
    return new Promise((resolve) => {
      let input = '';
      
      const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          document.removeEventListener('keypress', handleKeyPress);
          this.terminal.writeln('');
          resolve(input);
        } else if (e.key === 'Escape') {
          document.removeEventListener('keypress', handleKeyPress);
          resolve(null);
        } else if (e.key === 'Backspace') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            this.terminal.write('\b \b');
          }
        } else if (e.key.length === 1) {
          input += e.key;
          this.terminal.write(e.key);
        }
      };
      
      document.addEventListener('keypress', handleKeyPress);
    });
  }

  async handleQuickExperience() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('⚡ \x1b[33m快速体验模式\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    // 检查环境
    const envResult = await window.electronAPI.checkEnvironment();
    
    if (!envResult.claude?.installed) {
      this.terminal.writeln('⚠️  检测到 Claude Code 未安装');
      this.terminal.writeln('');
      this.terminal.writeln('正在自动安装 Claude Code...');
      await this.installClaude();
      this.terminal.writeln('');
    }
    
    // 创建免费测试配置
    this.terminal.writeln('正在配置免费测试 API...');
    
    const testConfig = {
      id: 'quick-experience-' + Date.now(),
      name: '免费测试 API',
      apiUrl: 'http://www.miaoda.vip/',
      apiKey: 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44',
      model: 'claude-3-7-sonnet-20250219'
    };
    
    // 保存配置
    await window.electronAPI.saveConfig(testConfig);
    this.terminal.writeln('✓ 配置已保存');
    
    // 设置为当前配置
    window.currentConfig = testConfig;
    this.updateFooterStatus();
    
    this.terminal.writeln('');
    this.terminal.writeln('正在启动 Claude Code...');
    this.terminal.writeln('');
    
    try {
      await window.electronAPI.startClaudeCode(testConfig);
      this.terminal.writeln('✅ Claude Code 已启动！');
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[33m提示：这是第三方提供的免费测试 API，可能有使用限制。\x1b[0m');
      this.terminal.writeln('你可以在左侧配置管理中添加自己的 API。');
    } catch (error) {
      this.terminal.writeln(`❌ 启动失败: ${error.message}`);
    }
  }

  async handleSelectConfig() {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('📋 \x1b[33m选择配置\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    // 获取所有配置
    const configs = await window.electronAPI.getConfigs();
    
    if (configs.length === 0) {
      this.terminal.writeln('⚠️  \x1b[33m没有找到任何配置\x1b[0m');
      this.terminal.writeln('');
      this.terminal.writeln('请点击左侧的 "新建配置" 按钮来创建你的第一个配置。');
      this.terminal.writeln('');
      this.terminal.writeln('提示：你也可以选择 "快速体验" 来使用免费测试 API。');
      return;
    }
    
    // 显示配置列表
    this.terminal.writeln('可用配置：');
    this.terminal.writeln('');
    
    configs.forEach((config, index) => {
      this.terminal.writeln(`  \x1b[32m[${index + 1}]\x1b[0m ${config.name}`);
      this.terminal.writeln(`      模型: \x1b[90m${config.model}\x1b[0m`);
      this.terminal.writeln(`      API: \x1b[90m${this.getDisplayUrl(config.apiUrl)}\x1b[0m`);
      this.terminal.writeln('');
    });
    
    this.terminal.writeln(`请选择配置 (1-${configs.length})，或按 \x1b[32m[0]\x1b[0m 返回主菜单：`);
    
    // 等待用户选择
    this.waitForConfigSelection(configs);
  }

  async handleEnvironmentCheck() {
    console.log('开始环境检查...');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🛠️ \x1b[33m环境检查\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');
    
    this.terminal.writeln('正在检查系统环境...');
    this.terminal.writeln('');
    
    let hasError = false;
    let envResult;
    
    try {
      console.log('调用 checkEnvironment API...');
      envResult = await window.electronAPI.checkEnvironment();
      console.log('环境检查结果:', envResult);
      
      // 显示检查结果
      const components = [
        { key: 'nodejs', name: 'Node.js', required: true },
        { key: 'git', name: 'Git', required: true },
        { key: 'uv', name: 'UV (Python 包管理器)', required: false },
        { key: 'claude', name: 'Claude Code', required: true }
      ];
      
      for (const comp of components) {
        const status = envResult[comp.key];
        if (status?.installed) {
          this.terminal.writeln(`  ✅ ${comp.name}: ${status.version || '已安装'}`);
        } else {
          hasError = true;
          this.terminal.writeln(`  ❌ ${comp.name}: 未安装${comp.required ? ' (必需)' : ' (可选)'}`);
        }
      }
      
      this.terminal.writeln('');
    } catch (error) {
      console.error('环境检查失败:', error);
      this.terminal.writeln(`❌ 环境检查失败: ${error.message}`);
      this.terminal.writeln('');
      return;
    }
    
    if (hasError) {
      this.terminal.writeln('发现缺失的组件，是否自动安装？');
      this.terminal.writeln('');
      this.terminal.writeln('  \x1b[32m[1]\x1b[0m 自动安装所有缺失组件');
      this.terminal.writeln('  \x1b[32m[2]\x1b[0m 只安装必需组件');
      this.terminal.writeln('  \x1b[32m[0]\x1b[0m 返回主菜单');
      this.terminal.writeln('');
      this.terminal.write('请选择 (0-2): ');
      
      this.waitForInstallChoice(envResult);
    } else {
      this.terminal.writeln('✅ 所有组件都已安装！');
      this.terminal.writeln('');
      this.terminal.writeln('按任意键返回主菜单...');
      
      const handleKey = async () => {
        document.removeEventListener('keypress', handleKey);
        await this.displayInitialMenu();
      };
      document.addEventListener('keypress', handleKey);
    }
  }

  waitForInstallChoice(envResult) {
    const handleKeyPress = async (e) => {
      const key = e.key;
      
      if (key >= '0' && key <= '2') {
        this.terminal.write(key);
        document.removeEventListener('keypress', handleKeyPress);
        
        const choice = parseInt(key);
        this.terminal.writeln('');
        this.terminal.writeln('');
        
        if (choice === 0) {
          await this.displayInitialMenu();
          return;
        }
        
        // 安装缺失的组件
        if (!envResult.uv?.installed && choice === 1) {
          await this.installUV();
        }
        
        if (!envResult.claude?.installed) {
          await this.installClaude();
        }
        
        this.terminal.writeln('');
        this.terminal.writeln('✅ 安装完成！');
        this.terminal.writeln('');
        this.terminal.writeln('按任意键返回主菜单...');
        
        const handleKey = async () => {
          document.removeEventListener('keypress', handleKey);
          await this.displayInitialMenu();
        };
        document.addEventListener('keypress', handleKey);
      }
    };
    
    document.addEventListener('keypress', handleKeyPress);
  }

  async installUV() {
    try {
      this.terminal.writeln('📦 正在安装 UV...');
      const result = await window.electronAPI.installDependency('uv');
      if (result.success) {
        this.terminal.writeln('✓ UV 安装成功');
      } else {
        this.terminal.writeln(`✗ UV 安装失败: ${result.error}`);
      }
    } catch (error) {
      this.terminal.writeln(`✗ UV 安装出错: ${error.message}`);
    }
  }

  async installClaude() {
    try {
      this.terminal.writeln('📦 正在安装 Claude Code...');
      const result = await window.electronAPI.installDependency('claude');
      if (result.success) {
        this.terminal.writeln('✓ Claude Code 安装成功');
      } else {
        this.terminal.writeln(`✗ Claude Code 安装失败: ${result.error}`);
      }
    } catch (error) {
      this.terminal.writeln(`✗ Claude Code 安装出错: ${error.message}`);
    }
  }

  getDisplayUrl(apiUrl) {
    try {
      const url = new URL(apiUrl);
      return url.hostname + (url.port ? ':' + url.port : '');
    } catch (e) {
      return apiUrl;
    }
  }

  waitForConfigSelection(configs) {
    const handleKeyPress = async (e) => {
      const key = e.key;
      const num = parseInt(key);
      
      if (key === '0') {
        this.terminal.write(key);
        document.removeEventListener('keypress', handleKeyPress);
        this.terminal.writeln('');
        this.terminal.writeln('');
        await this.displayInitialMenu();
        return;
      }
      
      if (num >= 1 && num <= configs.length) {
        this.terminal.write(key);
        document.removeEventListener('keypress', handleKeyPress);
        
        const selectedConfig = configs[num - 1];
        this.terminal.writeln('');
        this.terminal.writeln('');
        this.terminal.writeln(`已选择: ${selectedConfig.name}`);
        this.terminal.writeln('');
        
        // 设置当前配置
        window.currentConfig = selectedConfig;
        this.updateFooterStatus();
        
        // 启动 Claude
        this.terminal.writeln('正在启动 Claude Code...');
        this.terminal.writeln('');
        
        try {
          await window.electronAPI.startClaudeCode(selectedConfig);
          this.terminal.writeln('✅ Claude Code 已启动！');
        } catch (error) {
          this.terminal.writeln(`❌ 启动失败: ${error.message}`);
        }
      }
    };
    
    document.addEventListener('keypress', handleKeyPress);
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WelcomeMenu;
} else {
  window.WelcomeMenu = WelcomeMenu;
}