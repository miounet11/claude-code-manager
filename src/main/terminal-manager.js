'use strict';

const { spawn } = require('child_process');
const os = require('os');

/**
 * 跨平台终端管理器
 * 兼容 macOS 和 Windows
 */
class TerminalManager {
  constructor() {
    this.process = null;
    this.platform = os.platform();
    this.shell = this.getShell();
  }

  /**
   * 获取系统默认 shell
   */
  getShell() {
    if (this.platform === 'win32') {
      // Windows 使用 cmd 或 PowerShell
      return process.env.COMSPEC || 'cmd.exe';
    } else {
      // macOS/Linux 使用默认 shell
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * 启动 Claude CLI
   */
  async start(config, callbacks) {
    if (this.process) {
      throw new Error('Claude 已在运行');
    }

    try {
      // 构建环境变量（与参考脚本一致）
      const env = { ...process.env };
      
      // 根据是否使用内部代理来设置环境变量
      if (config.useInternalProxy) {
        // 设置代理服务器 URL（固定端口 8082）
        const proxyUrl = 'http://localhost:8082';
        env.ANTHROPIC_BASE_URL = proxyUrl;
        env.ANTHROPIC_API_URL = proxyUrl;
        
        // 设置认证令牌（与参考脚本一致：ANTHROPIC_AUTH_TOKEN="api-key"）
        env.ANTHROPIC_AUTH_TOKEN = config.expectedAnthropicApiKey || 'api-key';
      } else {
        // 直接使用配置的 API
        if (config.apiKey) {
          env.ANTHROPIC_API_KEY = config.apiKey;
        }
        if (config.apiUrl) {
          env.ANTHROPIC_API_URL = config.apiUrl;
          env.ANTHROPIC_BASE_URL = config.apiUrl;
        }
      }
      
      // 设置最大输出令牌数（与参考脚本一致）
      env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = (config.maxTokens || 32000).toString();
      
      // 设置网络代理（如果配置了）
      if (config.proxy) {
        env.HTTP_PROXY = config.proxy;
        env.HTTPS_PROXY = config.proxy;
        env.http_proxy = config.proxy;
        env.https_proxy = config.proxy;
      }

      // 尝试使用 node-pty（如果可用）
      let usePty = false;
      let pty;
      
      try {
        pty = require('node-pty');
        usePty = true;
      } catch (e) {
        console.log('node-pty 不可用，使用标准终端');
      }

      if (usePty) {
        // 使用 node-pty 提供更好的终端体验
        this.process = pty.spawn('claude', [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME || process.env.USERPROFILE,
          env: env,
          shell: this.platform === 'win32'
        });

        // 处理数据
        this.process.on('data', (data) => {
          if (callbacks.onData) {
            callbacks.onData(data);
          }
        });

        // 处理退出
        this.process.on('exit', (code) => {
          this.process = null;
          if (callbacks.onExit) {
            callbacks.onExit(code);
          }
        });

      } else {
        // 标准方式启动
        const spawnOptions = {
          env: env,
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        };

        // Windows 特殊处理
        if (this.platform === 'win32') {
          // Windows 使用 cmd /c 确保正确执行
          this.process = spawn('cmd', ['/c', 'claude'], spawnOptions);
        } else {
          // macOS/Linux 直接执行
          this.process = spawn('claude', [], spawnOptions);
        }

        // 设置编码
        if (this.process.stdout) {
          this.process.stdout.setEncoding('utf8');
        }
        if (this.process.stderr) {
          this.process.stderr.setEncoding('utf8');
        }

        // 处理标准输出
        this.process.stdout.on('data', (data) => {
          if (callbacks.onData) {
            callbacks.onData(data);
          }
        });

        // 处理标准错误
        this.process.stderr.on('data', (data) => {
          if (callbacks.onError) {
            callbacks.onError(data);
          }
        });

        // 处理退出
        this.process.on('close', (code) => {
          this.process = null;
          if (callbacks.onExit) {
            callbacks.onExit(code);
          }
        });

        // 处理错误
        this.process.on('error', (error) => {
          if (callbacks.onError) {
            callbacks.onError(error.message);
          }
          this.process = null;
        });
      }

      return true;
    } catch (error) {
      this.process = null;
      throw error;
    }
  }

  /**
   * 发送输入到 Claude
   */
  write(data) {
    if (!this.process) {
      throw new Error('Claude 未运行');
    }

    try {
      // 确保换行符正确
      const input = data.endsWith('\n') ? data : data + '\n';
      
      if (this.process.write) {
        // node-pty 方式
        this.process.write(input);
      } else if (this.process.stdin && this.process.stdin.writable) {
        // 标准方式
        this.process.stdin.write(input);
      } else {
        throw new Error('无法写入终端');
      }
    } catch (error) {
      throw new Error(`发送失败: ${error.message}`);
    }
  }

  /**
   * 停止 Claude
   */
  async stop() {
    if (!this.process) {
      return;
    }

    try {
      // 尝试优雅退出
      this.write('exit');
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 如果还在运行，强制终止
      if (this.process) {
        if (this.process.kill) {
          this.process.kill();
        } else if (this.process.pid) {
          if (this.platform === 'win32') {
            // Windows 使用 taskkill
            spawn('taskkill', ['/F', '/PID', this.process.pid.toString()]);
          } else {
            // Unix 系统
            process.kill(this.process.pid);
          }
        }
      }
    } catch (error) {
      console.error('停止进程失败:', error);
    } finally {
      this.process = null;
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning() {
    return this.process !== null;
  }
}

module.exports = TerminalManager;