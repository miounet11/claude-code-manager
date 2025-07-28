'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const fs = require('fs');

/**
 * Claude 服务 - Windows 版本
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
      
      proxyServer.on('usage', (data) => {
        this.emit('usage', data);
      });
      
      proxyServer.on('error', (error) => {
        this.emit('proxy-error', error);
      });
    }

    // 构建启动参数
    const args = [];
    
    args.push('serve', '--port', this.port.toString());
    
    if (config.model) {
      args.push('--model', config.model);
    }

    if (config.maxTokens) {
      args.push('--max-tokens', config.maxTokens.toString());
    }

    if (config.temperature !== undefined) {
      args.push('--temperature', config.temperature.toString());
    }

    this.emit('starting', { config: config.name, port: this.port, proxyUrl });
    
    try {
      // 尝试找到 claude 命令的完整路径
      const claudePath = await this.findClaudePath();
      const command = claudePath || 'claude';
      
      // Windows 特殊处理：使用 cmd.exe 来执行命令
      this.process = spawn('cmd.exe', ['/c', command, ...args], {
        env: this.buildEnvironment(config, proxyUrl),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
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
    
    // Windows 下使用 taskkill
    try {
      if (this.process.pid) {
        execSync(`taskkill /pid ${this.process.pid} /f`, { windowsHide: true });
      }
    } catch (e) {
      console.error('使用 taskkill 停止进程失败:', e);
    }
    
    // 如果 taskkill 失败，尝试常规方法
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
    
    // 设置强制结束的超时
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
      await this.stop();
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

    if (proxyUrl) {
      env.ANTHROPIC_API_URL = proxyUrl;
      env.ANTHROPIC_API_KEY = 'proxy-handled';
    } else {
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
        if (!this.process || this.process.killed) {
          reject(new Error('Claude 进程已退出'));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Claude 启动超时'));
          return;
        }

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
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }
    
    if (this.process) {
      this.process.stdout.removeAllListeners();
      this.process.stderr.removeAllListeners();
      this.process.removeAllListeners();
    }
    
    this.isRunning = false;
    this.process = null;
    this.startTime = null;
    this.port = null;
    
    this.removeAllListeners();
  }
  
  /**
   * 查找 Claude CLI 的路径 (Windows 版本)
   */
  async findClaudePath() {
    try {
      // 1. 使用 where 命令
      try {
        const claudePath = execSync('where claude', { 
          encoding: 'utf8',
          windowsHide: true 
        }).split('\n')[0].trim();
        
        if (claudePath) {
          console.log('通过 where 找到 Claude CLI:', claudePath);
          return claudePath;
        }
      } catch (e) {
        // where 失败，继续尝试其他方法
      }
      
      // 2. 动态获取 npm 全局路径
      const possiblePaths = [];
      
      try {
        const npmPrefix = execSync('npm config get prefix', { 
          encoding: 'utf8',
          windowsHide: true 
        }).trim();
        
        if (npmPrefix) {
          possiblePaths.push(path.join(npmPrefix, 'claude.cmd'));
          possiblePaths.push(path.join(npmPrefix, 'claude.exe'));
          possiblePaths.push(path.join(npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.cmd'));
          
          // AppData 路径
          const appDataNpm = path.join(process.env.APPDATA || '', 'npm');
          possiblePaths.push(path.join(appDataNpm, 'claude.cmd'));
          possiblePaths.push(path.join(appDataNpm, 'claude.exe'));
        }
      } catch (e) {
        console.log('无法获取 npm prefix');
      }
      
      // 3. 标准路径
      const standardPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'claude.cmd'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'claude.cmd'),
        path.join(process.env.USERPROFILE || '', '.npm-global', 'claude.cmd')
      ];
      
      possiblePaths.push(...standardPaths);
      
      // 4. 从 PATH 环境变量获取
      if (process.env.PATH) {
        const pathDirs = process.env.PATH.split(';');
        for (const dir of pathDirs) {
          if (dir && dir.trim()) {
            possiblePaths.push(path.join(dir.trim(), 'claude.cmd'));
            possiblePaths.push(path.join(dir.trim(), 'claude.exe'));
          }
        }
      }
      
      // 5. 去重并尝试所有路径
      const uniquePaths = [...new Set(possiblePaths)];
      
      for (const claudePath of uniquePaths) {
        try {
          await fs.promises.access(claudePath, fs.constants.F_OK);
          console.log('找到 Claude CLI:', claudePath);
          return claudePath;
        } catch (e) {
          // 文件不存在
        }
      }
      
      console.log('未找到 Claude CLI 的具体路径，使用默认命令');
      return null;
      
    } catch (error) {
      console.error('查找 Claude 路径时出错:', error);
      return null;
    }
  }
}

// 导出单例
module.exports = new ClaudeService();