'use strict';

const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * Claude 服务 - 负责管理 Claude 进程
 */
class ClaudeService extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.config = null;
    this.isRunning = false;
    this.startTime = null;
    this.port = null;
    this.killTimeout = null;
  }

  /**
   * 启动 Claude
   */
  async start(config, environmentReady = true) {
    if (this.isRunning) {
      throw new Error('Claude 已经在运行中');
    }

    if (!environmentReady) {
      throw new Error('环境未就绪，无法启动 Claude');
    }

    if (!config) {
      throw new Error('未提供配置');
    }

    this.config = config;
    this.port = await this.findAvailablePort();

    // 先启动代理服务器（如果需要）
    let proxyUrl = null;
    if (config.apiUrl && config.apiUrl !== 'https://api.anthropic.com') {
      const proxyServer = require('./proxy-server');
      const proxyResult = await proxyServer.start(config);
      proxyUrl = proxyResult.url;
      
      // 监听代理服务器事件
      proxyServer.on('usage', (data) => {
        this.emit('usage', data);
      });
      
      proxyServer.on('error', (error) => {
        this.emit('proxy-error', error);
      });
    }

    // 构建启动参数
    const args = [];
    
    // 端口参数
    args.push('serve', '--port', this.port.toString());
    
    // 模型参数
    if (config.model) {
      args.push('--model', config.model);
    }

    // API 参数 - Claude CLI 使用环境变量而不是命令行参数
    // 这些将在 buildEnvironment 中设置

    // 其他参数
    if (config.maxTokens) {
      args.push('--max-tokens', config.maxTokens.toString());
    }

    if (config.temperature !== undefined) {
      args.push('--temperature', config.temperature.toString());
    }

    // 启动进程
    this.emit('starting', { config: config.name, port: this.port, proxyUrl });
    
    try {
      this.process = spawn('claude', args, {
        env: this.buildEnvironment(config, proxyUrl),
        shell: true,
        windowsHide: true
      });

      this.isRunning = true;
      this.startTime = new Date();

      // 处理输出
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        this.emit('output', {
          type: 'stdout',
          data: output,
          timestamp: new Date()
        });
      });

      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        this.emit('output', {
          type: 'stderr',
          data: output,
          timestamp: new Date()
        });
      });

      // 处理错误
      this.process.on('error', (error) => {
        this.emit('error', {
          message: error.message,
          code: error.code
        });
        this.cleanup();
      });

      // 处理退出
      this.process.on('exit', (code, signal) => {
        this.emit('exit', {
          code,
          signal,
          runtime: this.getRuntime()
        });
        this.cleanup();
      });

      // 等待启动完成
      await this.waitForReady();
      
      this.emit('started', {
        config: config.name,
        port: this.port,
        pid: this.process.pid
      });

      return {
        success: true,
        port: this.port,
        pid: this.process.pid
      };
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * 停止 Claude
   */
  async stop() {
    if (!this.isRunning || !this.process) {
      return { success: true, message: 'Claude 未在运行' };
    }

    this.emit('stopping');
    
    // 优雅关闭
    this.process.kill('SIGTERM');
    
    // 如果 5 秒后还没退出，强制关闭
    this.killTimeout = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
      this.killTimeout = null;
    }, 5000);

    // 停止代理服务器
    try {
      const proxyServer = require('./proxy-server');
      if (proxyServer.isRunning) {
        await proxyServer.stop();
      }
    } catch (e) {
      console.error('停止代理服务器失败:', e);
    }

    return { success: true, message: '正在停止 Claude' };
  }

  /**
   * 重启 Claude
   */
  async restart() {
    const config = this.config;
    
    if (this.isRunning) {
      this.stop();
      // 等待进程完全停止
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    return this.start(config);
  }

  /**
   * 发送输入到 Claude
   */
  sendInput(data) {
    if (!this.isRunning || !this.process) {
      throw new Error('Claude 未在运行');
    }

    this.process.stdin.write(data);
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      running: this.isRunning,
      config: this.config?.name || null,
      port: this.port,
      pid: this.process?.pid || null,
      startTime: this.startTime,
      runtime: this.getRuntime()
    };
  }

  /**
   * 获取运行时间
   */
  getRuntime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  /**
   * 构建环境变量
   */
  buildEnvironment(config, proxyUrl) {
    const env = { ...process.env };

    // 如果使用代理服务器，设置代理 URL
    if (proxyUrl) {
      // Claude CLI 将通过代理访问 API
      env.ANTHROPIC_API_URL = proxyUrl;
      // 代理服务器会处理认证，这里设置一个占位符
      env.ANTHROPIC_API_KEY = 'proxy-handled';
    } else {
      // 直接使用配置的 API
      env.ANTHROPIC_API_KEY = config.apiKey;
      if (config.apiUrl) {
        env.ANTHROPIC_API_URL = config.apiUrl;
      }
    }

    // 设置网络代理
    if (config.proxy) {
      env.HTTP_PROXY = config.proxy;
      env.HTTPS_PROXY = config.proxy;
      env.http_proxy = config.proxy;
      env.https_proxy = config.proxy;
    }

    return env;
  }

  /**
   * 查找可用端口
   */
  async findAvailablePort() {
    const net = require('net');
    const preferredPorts = [5173, 5174, 5175, 8080, 8081, 8082];
    
    for (const port of preferredPorts) {
      const available = await new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once('close', () => resolve(true));
          server.close();
        });
        server.on('error', () => resolve(false));
      });
      
      if (available) {
        return port;
      }
    }
    
    // 使用随机端口
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  }

  /**
   * 等待 Claude 就绪
   */
  async waitForReady(timeout = 10000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        // 检查进程是否还在运行
        if (!this.process || this.process.killed) {
          reject(new Error('Claude 进程已退出'));
          return;
        }

        // 检查超时
        if (Date.now() - startTime > timeout) {
          reject(new Error('Claude 启动超时'));
          return;
        }

        // TODO: 实现更可靠的就绪检查
        // 目前简单等待一段时间
        setTimeout(() => {
          resolve();
        }, 2000);
      };

      checkReady();
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理定时器
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }
    
    // 移除进程事件监听器
    if (this.process) {
      this.process.stdout.removeAllListeners();
      this.process.stderr.removeAllListeners();
      this.process.removeAllListeners();
    }
    
    this.isRunning = false;
    this.process = null;
    this.startTime = null;
    this.port = null;
    
    // 移除所有事件监听器
    this.removeAllListeners();
  }
}

// 导出单例
module.exports = new ClaudeService();