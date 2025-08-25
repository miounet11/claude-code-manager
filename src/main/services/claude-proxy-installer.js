'use strict';

const { spawn, exec, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

/**
 * Claude Code Proxy 自动安装和配置服务
 * 完全复现 Claude_code_proxy.sh 的功能
 */
class ClaudeProxyInstaller extends EventEmitter {
  constructor() {
    super();
    
    // 默认配置（与参考脚本一致）
    this.config = {
      CLAUDE_DIR: path.join(os.homedir(), '.claude'),
      CLAUDE_PROXY_DIR: path.join(os.homedir(), '.claude', 'proxy'),
      PROXY_PROJECT_DIR: path.join(os.homedir(), '.claude', 'proxy', 'claude-code-proxy'),
      PROXY_PORT: 8082,
      OPENAI_API_KEY: 'sk-xKnZ1EtU7YNW14fvMw1NNpxUnHm3KyLG11bkebclSMmNfiDD',
      OPENAI_BASE_URL: 'https://ttkk.inping.com/v1',
      BIG_MODEL: 'claude-opus-4-1-20250805',
      MIDDLE_MODEL: 'claude-sonnet-4-20250514',
      SMALL_MODEL: 'grok-4',
      ANTHROPIC_AUTH_TOKEN: 'api-key',
      LOG_LEVEL: 'WARNING',
      MAX_TOKENS_LIMIT: 32000,
      REQUEST_TIMEOUT: 90,
      MAX_RETRIES: 3,
      HOST: '0.0.0.0'
    };
    
    this.proxyProcess = null;
    this.claudeProcess = null;
  }

  /**
   * 一键部署全部功能
   */
  async deployAll(customConfig = {}) {
    try {
      // 合并自定义配置
      this.config = { ...this.config, ...customConfig };
      
      this.emit('progress', { step: 'start', message: '开始部署 Claude Code Proxy...' });
      
      // 1. 检查并安装 uv
      await this.installUV();
      
      // 2. 检查并安装 Claude Code
      await this.installClaudeCode();
      
      // 3. 检查并安装 Claude Code Proxy
      await this.installClaudeProxy();
      
      // 4. 配置代理
      await this.configureProxy();
      
      // 5. 检查并清理端口
      await this.checkAndCleanPort();
      
      // 6. 启动代理服务
      await this.startProxy();
      
      // 7. 启动 Claude Code
      await this.startClaude();
      
      this.emit('progress', { step: 'complete', message: '部署完成！Claude Code 已启动。' });
      
      return { success: true, message: '部署成功' };
    } catch (error) {
      this.emit('error', { step: 'deploy', error: error.message });
      throw error;
    }
  }

  /**
   * 检查命令是否存在
   */
  async commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安装 UV (Python 包管理器)
   */
  async installUV() {
    this.emit('progress', { step: 'uv', message: '检查 uv 是否已安装...' });
    
    if (await this.commandExists('uv')) {
      this.emit('progress', { step: 'uv', message: '✅ uv 已安装' });
      return;
    }
    
    this.emit('progress', { step: 'uv', message: '正在安装 uv...' });
    
    return new Promise((resolve, reject) => {
      exec('curl -LsSf https://astral.sh/uv/install.sh | sh', (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`安装 uv 失败: ${error.message}`));
        } else {
          // 添加到 PATH
          process.env.PATH = `${os.homedir()}/.cargo/bin:${process.env.PATH}`;
          this.emit('progress', { step: 'uv', message: '✅ uv 安装完成' });
          resolve();
        }
      });
    });
  }

  /**
   * 安装 Claude Code
   */
  async installClaudeCode() {
    this.emit('progress', { step: 'claude', message: '检查 Claude Code 是否已安装...' });
    
    if (await this.commandExists('claude')) {
      this.emit('progress', { step: 'claude', message: '✅ Claude Code 已安装' });
      return;
    }
    
    this.emit('progress', { step: 'claude', message: '正在安装 Claude Code...' });
    
    return new Promise((resolve, reject) => {
      const install = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
        shell: true
      });
      
      install.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', { step: 'claude', message: '✅ Claude Code 安装完成' });
          resolve();
        } else {
          reject(new Error(`安装 Claude Code 失败，错误码: ${code}`));
        }
      });
      
      install.on('error', (error) => {
        reject(new Error(`安装 Claude Code 失败: ${error.message}`));
      });
    });
  }

  /**
   * 安装 Claude Code Proxy
   */
  async installClaudeProxy() {
    this.emit('progress', { step: 'proxy', message: '检查 Claude Code Proxy...' });
    
    // 检查项目是否已存在
    try {
      await fs.access(this.config.PROXY_PROJECT_DIR);
      this.emit('progress', { step: 'proxy', message: '✅ Claude Code Proxy 已存在' });
      return;
    } catch {
      // 项目不存在，需要安装
    }
    
    this.emit('progress', { step: 'proxy', message: '正在安装 Claude Code Proxy...' });
    
    // 创建目录
    await fs.mkdir(this.config.CLAUDE_PROXY_DIR, { recursive: true });
    
    // 克隆项目
    return new Promise((resolve, reject) => {
      const clone = spawn('git', [
        'clone',
        'https://github.com/fuergaosi233/claude-code-proxy.git',
        this.config.PROXY_PROJECT_DIR
      ], {
        cwd: this.config.CLAUDE_PROXY_DIR
      });
      
      clone.on('close', async (code) => {
        if (code === 0) {
          this.emit('progress', { step: 'proxy', message: '项目克隆完成，正在初始化...' });
          
          // 使用 uv sync 初始化项目
          const sync = spawn('uv', ['sync'], {
            cwd: this.config.PROXY_PROJECT_DIR
          });
          
          sync.on('close', (syncCode) => {
            if (syncCode === 0) {
              this.emit('progress', { step: 'proxy', message: '✅ Claude Code Proxy 安装完成' });
              resolve();
            } else {
              reject(new Error(`初始化 Claude Code Proxy 失败，错误码: ${syncCode}`));
            }
          });
          
          sync.on('error', (error) => {
            reject(new Error(`初始化 Claude Code Proxy 失败: ${error.message}`));
          });
        } else {
          reject(new Error(`克隆 Claude Code Proxy 失败，错误码: ${code}`));
        }
      });
      
      clone.on('error', (error) => {
        reject(new Error(`克隆 Claude Code Proxy 失败: ${error.message}`));
      });
    });
  }

  /**
   * 配置代理 .env 文件
   */
  async configureProxy() {
    this.emit('progress', { step: 'config', message: '正在配置代理...' });
    
    const envPath = path.join(this.config.PROXY_PROJECT_DIR, '.env');
    
    // 创建 .env 文件内容
    const envContent = `HOST="${this.config.HOST}"
PROXY_PORT="${this.config.PROXY_PORT}"
OPENAI_API_KEY="${this.config.OPENAI_API_KEY}"
OPENAI_BASE_URL="${this.config.OPENAI_BASE_URL}"
BIG_MODEL="${this.config.BIG_MODEL}"
SMALL_MODEL="${this.config.SMALL_MODEL}"
LOG_LEVEL="${this.config.LOG_LEVEL}"
MAX_TOKENS_LIMIT="${this.config.MAX_TOKENS_LIMIT}"
REQUEST_TIMEOUT="${this.config.REQUEST_TIMEOUT}"
MAX_RETRIES="${this.config.MAX_RETRIES}"`;
    
    await fs.writeFile(envPath, envContent, 'utf8');
    
    this.emit('progress', { step: 'config', message: '✅ 代理配置完成' });
  }

  /**
   * 检查并清理端口
   */
  async checkAndCleanPort() {
    this.emit('progress', { step: 'port', message: `检查端口 ${this.config.PROXY_PORT}...` });
    
    return new Promise((resolve) => {
      exec(`lsof -ti:${this.config.PROXY_PORT}`, (error, stdout) => {
        if (stdout) {
          const pid = stdout.trim();
          this.emit('progress', { 
            step: 'port', 
            message: `端口 ${this.config.PROXY_PORT} 被占用，正在清理...`,
            needConfirm: true,
            pid
          });
          
          // 强制终止进程
          try {
            process.kill(pid, 'SIGKILL');
            this.emit('progress', { step: 'port', message: '✅ 端口已清理' });
          } catch (e) {
            this.emit('progress', { step: 'port', message: '⚠️ 无法清理端口，可能需要管理员权限' });
          }
        } else {
          this.emit('progress', { step: 'port', message: '✅ 端口可用' });
        }
        resolve();
      });
    });
  }

  /**
   * 启动代理服务
   */
  async startProxy() {
    this.emit('progress', { step: 'start-proxy', message: '正在启动代理服务...' });
    
    return new Promise((resolve, reject) => {
      this.proxyProcess = spawn('uv', ['run', 'claude-code-proxy'], {
        cwd: this.config.PROXY_PROJECT_DIR,
        env: { ...process.env },
        detached: false
      });
      
      this.proxyProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Proxy:', output);
        
        // 检查是否启动成功
        if (output.includes('Running on') || output.includes('started')) {
          this.emit('progress', { step: 'start-proxy', message: '✅ 代理服务已启动' });
          resolve();
        }
      });
      
      this.proxyProcess.stderr.on('data', (data) => {
        console.error('Proxy Error:', data.toString());
      });
      
      this.proxyProcess.on('error', (error) => {
        reject(new Error(`启动代理服务失败: ${error.message}`));
      });
      
      // 设置超时，假设 3 秒内应该启动成功
      setTimeout(() => {
        if (this.proxyProcess) {
          this.emit('progress', { step: 'start-proxy', message: '✅ 代理服务已在后台启动' });
          resolve();
        }
      }, 3000);
    });
  }

  /**
   * 启动 Claude Code
   */
  async startClaude() {
    this.emit('progress', { step: 'start-claude', message: '正在启动 Claude Code...' });
    
    // 获取本机 IP
    const ip = this.getLocalIP();
    const proxyUrl = `http://${ip}:${this.config.PROXY_PORT}`;
    
    // 设置环境变量
    const env = {
      ...process.env,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: this.config.MAX_TOKENS_LIMIT.toString(),
      ANTHROPIC_BASE_URL: proxyUrl,
      ANTHROPIC_API_URL: proxyUrl,
      ANTHROPIC_AUTH_TOKEN: this.config.ANTHROPIC_AUTH_TOKEN
    };
    
    return new Promise((resolve, reject) => {
      this.claudeProcess = spawn('claude', [], {
        env,
        stdio: 'inherit'
      });
      
      this.claudeProcess.on('spawn', () => {
        this.emit('progress', { 
          step: 'start-claude', 
          message: '✅ Claude Code 已启动',
          details: {
            proxyUrl,
            maxTokens: this.config.MAX_TOKENS_LIMIT,
            model: this.config.BIG_MODEL
          }
        });
        resolve();
      });
      
      this.claudeProcess.on('error', (error) => {
        reject(new Error(`启动 Claude Code 失败: ${error.message}`));
      });
    });
  }

  /**
   * 获取本机 IP
   */
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    
    // macOS 优先使用 en0
    if (interfaces.en0) {
      for (const addr of interfaces.en0) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    
    // 其他情况查找第一个非内部 IPv4 地址
    for (const name of Object.keys(interfaces)) {
      for (const addr of interfaces[name]) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    
    return 'localhost';
  }

  /**
   * 停止所有服务
   */
  async stopAll() {
    this.emit('progress', { step: 'stop', message: '正在停止服务...' });
    
    if (this.claudeProcess) {
      this.claudeProcess.kill();
      this.claudeProcess = null;
    }
    
    if (this.proxyProcess) {
      this.proxyProcess.kill();
      this.proxyProcess = null;
    }
    
    // 清理端口上的残留进程
    try {
      const pid = execSync(`lsof -ti:${this.config.PROXY_PORT}`, { encoding: 'utf8' }).trim();
      if (pid) {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // 忽略错误
    }
    
    this.emit('progress', { step: 'stop', message: '✅ 所有服务已停止' });
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = new ClaudeProxyInstaller();