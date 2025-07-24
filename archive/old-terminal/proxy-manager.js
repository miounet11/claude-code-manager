'use strict';

/**
 * 代理管理器 - 处理 Claude Code Proxy 的安装、配置和启动
 */
class ProxyManager {
  constructor(terminal) {
    this.terminal = terminal;
    this.platform = process.platform;
    this.proxyPort = 8082;
    this.proxyDir = this.getProxyDirectory();
    this.proxyProjectDir = `${this.proxyDir}/claude-code-proxy`;
  }

  getProxyDirectory() {
    const homeDir = process.platform === 'win32' 
      ? process.env.USERPROFILE 
      : process.env.HOME;
    return `${homeDir}/.claude/proxy`;
  }

  /**
   * 检查并安装代理
   */
  async setupProxy(config) {
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('🔧 \x1b[33m设置 Claude Code Proxy\x1b[0m');
    this.terminal.writeln('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    this.terminal.writeln('');

    // 1. 检查依赖
    await this.checkDependencies();

    // 2. 检查代理是否已安装
    const isInstalled = await this.checkProxyInstalled();
    if (!isInstalled) {
      await this.installProxy();
    }

    // 3. 配置代理
    await this.configureProxy(config);

    // 4. 检查端口
    const portAvailable = await this.checkPort();
    if (!portAvailable) {
      const handled = await this.handlePortConflict();
      if (!handled) {
        return false;
      }
    }

    // 5. 启动代理
    await this.startProxy(config);

    return true;
  }

  /**
   * 检查依赖
   */
  async checkDependencies() {
    this.terminal.writeln('📋 检查依赖项...');
    
    // 检查 Git
    const gitCheck = await this.checkCommand('git --version');
    if (!gitCheck) {
      this.terminal.writeln('❌ Git 未安装，请先安装 Git');
      if (this.platform === 'win32') {
        this.terminal.writeln('   下载地址: https://git-scm.com/download/win');
      } else if (this.platform === 'darwin') {
        this.terminal.writeln('   安装命令: brew install git');
      } else {
        this.terminal.writeln('   安装命令: sudo apt-get install git');
      }
      throw new Error('Git 未安装');
    }
    this.terminal.writeln('✅ Git 已安装');

    // 检查 UV
    const uvCheck = await this.checkCommand('uv --version');
    if (!uvCheck) {
      this.terminal.writeln('⚠️  UV 未安装，正在自动安装...');
      await this.installUV();
    } else {
      this.terminal.writeln('✅ UV 已安装');
    }

    this.terminal.writeln('');
  }

  /**
   * 检查命令是否可用
   */
  async checkCommand(command) {
    try {
      const result = await window.electronAPI.runCommand(command);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * 安装 UV
   */
  async installUV() {
    try {
      const result = await window.electronAPI.installDependency('uv');
      if (result.success) {
        this.terminal.writeln('✅ UV 安装成功');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.terminal.writeln(`❌ UV 安装失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查代理是否已安装
   */
  async checkProxyInstalled() {
    try {
      const result = await window.electronAPI.runCommand(
        this.platform === 'win32' 
          ? `if (Test-Path "${this.proxyProjectDir}") { echo "exists" } else { echo "not exists" }`
          : `[ -d "${this.proxyProjectDir}" ] && echo "exists" || echo "not exists"`
      );
      return result.stdout && result.stdout.includes('exists');
    } catch (error) {
      return false;
    }
  }

  /**
   * 安装代理
   */
  async installProxy() {
    this.terminal.writeln('📦 安装 Claude Code Proxy...');
    this.terminal.writeln('');

    // 创建目录
    await window.electronAPI.runCommand(
      this.platform === 'win32'
        ? `New-Item -ItemType Directory -Force -Path "${this.proxyDir}"`
        : `mkdir -p "${this.proxyDir}"`
    );

    // 克隆仓库
    this.terminal.writeln('正在克隆 Claude Code Proxy 仓库...');
    const cloneResult = await window.electronAPI.runCommand(
      `cd "${this.proxyDir}" && git clone https://github.com/fuergaosi233/claude-code-proxy.git`
    );

    if (!cloneResult.success) {
      throw new Error('克隆仓库失败: ' + cloneResult.error);
    }

    // 初始化项目
    this.terminal.writeln('正在初始化项目...');
    const initResult = await window.electronAPI.runCommand(
      `cd "${this.proxyProjectDir}" && uv sync`
    );

    if (!initResult.success) {
      throw new Error('项目初始化失败: ' + initResult.error);
    }

    this.terminal.writeln('✅ Claude Code Proxy 安装成功');
    this.terminal.writeln('');
  }

  /**
   * 配置代理
   */
  async configureProxy(config) {
    this.terminal.writeln('⚙️  配置代理参数...');

    // 获取本地 IP
    const ip = await this.getLocalIP();

    // 创建 .env 文件内容
    const envContent = `
HOST="0.0.0.0"
PORT="${this.proxyPort}"
OPENAI_API_KEY="${config.apiKey}"
OPENAI_BASE_URL="${config.apiUrl}"
BIG_MODEL="${config.model || 'gpt-4'}"
SMALL_MODEL="${config.smallModel || 'gpt-3.5-turbo'}"
LOG_LEVEL="WARNING"
MAX_TOKENS_LIMIT="${config.maxTokens || 4096}"
MIN_TOKENS_LIMIT="1024"
REQUEST_TIMEOUT="120"
MAX_RETRIES="3"
`.trim();

    // 写入 .env 文件
    const envPath = `${this.proxyProjectDir}/.env`;
    await window.electronAPI.writeFile(envPath, envContent);

    this.terminal.writeln(`✅ 配置完成`);
    this.terminal.writeln(`   代理地址: http://${ip}:${this.proxyPort}`);
    this.terminal.writeln(`   模型: ${config.model}`);
    this.terminal.writeln('');
  }

  /**
   * 获取本地 IP
   */
  async getLocalIP() {
    try {
      const result = await window.electronAPI.runCommand(
        this.platform === 'win32'
          ? `(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress`
          : `ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1`
      );
      
      const ip = result.stdout?.trim() || 'localhost';
      return ip;
    } catch (error) {
      return 'localhost';
    }
  }

  /**
   * 检查端口是否可用
   */
  async checkPort() {
    this.terminal.writeln(`🔍 检查端口 ${this.proxyPort} 是否可用...`);
    
    const result = await window.electronAPI.checkPort(this.proxyPort);
    
    if (result.available) {
      this.terminal.writeln(`✅ 端口 ${this.proxyPort} 可用`);
      return true;
    } else {
      this.terminal.writeln(`⚠️  端口 ${this.proxyPort} 已被占用`);
      if (result.process) {
        this.terminal.writeln(`   进程: ${result.process.name} (PID: ${result.process.pid})`);
      }
      return false;
    }
  }

  /**
   * 处理端口冲突
   */
  async handlePortConflict() {
    this.terminal.writeln('');
    this.terminal.writeln('端口冲突处理选项：');
    this.terminal.writeln('  \x1b[32m[1]\x1b[0m 终止占用进程');
    this.terminal.writeln('  \x1b[32m[2]\x1b[0m 使用其他端口');
    this.terminal.writeln('  \x1b[32m[3]\x1b[0m 假设是之前的代理进程，直接启动 Claude');
    this.terminal.writeln('  \x1b[32m[0]\x1b[0m 取消');
    this.terminal.writeln('');
    this.terminal.write('请选择 (0-3): ');

    return new Promise((resolve) => {
      const handleKeyPress = async (e) => {
        const key = e.key;
        
        if (key >= '0' && key <= '3') {
          this.terminal.write(key);
          document.removeEventListener('keypress', handleKeyPress);
          this.terminal.writeln('');
          this.terminal.writeln('');
          
          const choice = parseInt(key);
          
          switch (choice) {
            case 1:
              // 终止进程
              const killResult = await window.electronAPI.killPort(this.proxyPort);
              if (killResult.success) {
                this.terminal.writeln('✅ 进程已终止');
                resolve(true);
              } else {
                this.terminal.writeln('❌ 无法终止进程，可能需要管理员权限');
                resolve(false);
              }
              break;
              
            case 2:
              // 使用其他端口
              this.proxyPort = await this.findAvailablePort();
              this.terminal.writeln(`✅ 使用新端口: ${this.proxyPort}`);
              resolve(true);
              break;
              
            case 3:
              // 假设是之前的代理，跳过启动
              this.terminal.writeln('跳过代理启动，直接使用现有服务');
              resolve(true);
              break;
              
            default:
              resolve(false);
          }
        }
      };
      
      document.addEventListener('keypress', handleKeyPress);
    });
  }

  /**
   * 查找可用端口
   */
  async findAvailablePort() {
    let port = this.proxyPort;
    while (port < this.proxyPort + 100) {
      const result = await window.electronAPI.checkPort(port);
      if (result.available) {
        return port;
      }
      port++;
    }
    throw new Error('无法找到可用端口');
  }

  /**
   * 启动代理
   */
  async startProxy(config) {
    this.terminal.writeln('🚀 启动代理服务...');
    
    // 获取本地 IP
    const ip = await this.getLocalIP();
    const proxyUrl = `http://${ip}:${this.proxyPort}`;
    
    // 启动代理进程
    const startResult = await window.electronAPI.runCommand(
      `cd "${this.proxyProjectDir}" && uv run claude-code-proxy`,
      { background: true }
    );
    
    if (!startResult.success) {
      throw new Error('启动代理失败: ' + startResult.error);
    }
    
    // 等待代理启动
    this.terminal.writeln('等待代理服务启动...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    this.terminal.writeln('✅ 代理服务已启动');
    this.terminal.writeln('');
    
    // 启动 Claude Code
    this.terminal.writeln('🚀 启动 Claude Code...');
    this.terminal.writeln('');
    
    // 设置环境变量并启动
    const env = {
      ANTHROPIC_BASE_URL: proxyUrl,
      ANTHROPIC_AUTH_TOKEN: 'api-key',
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: config.maxTokens || '4096'
    };
    
    await window.electronAPI.startClaudeWithEnv(env);
    
    this.terminal.writeln('✅ Claude Code 已启动！');
    this.terminal.writeln('');
    this.terminal.writeln(`代理地址: ${proxyUrl}`);
    this.terminal.writeln(`使用模型: ${config.model}`);
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxyManager;
} else {
  window.ProxyManager = ProxyManager;
}