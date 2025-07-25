'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * 环境检测服务 - 负责检测系统环境和依赖
 */
class EnvironmentService {
  constructor() {
    this.lastCheckResult = null;
    this.isChecking = false;
    this.checkInterval = null;
  }

  /**
   * 启动定期检测
   */
  startPeriodicCheck(callback, interval = 30000) {
    // 立即执行一次检测
    this.checkAll().then(callback);
    
    // 设置定期检测
    this.checkInterval = setInterval(async () => {
      const result = await this.checkAll();
      callback(result);
    }, interval);
  }

  /**
   * 停止定期检测
   */
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检查所有环境
   */
  async checkAll() {
    if (this.isChecking) {
      return this.lastCheckResult;
    }

    this.isChecking = true;

    try {
      const result = {
        timestamp: new Date().toISOString(),
        system: await this.getSystemInfo(),
        dependencies: {
          nodejs: await this.checkNodejs(),
          git: await this.checkGit(),
          claude: await this.checkClaude(),
          uv: await this.checkUV()
        },
        summary: null
      };

      // 生成摘要
      result.summary = this.generateSummary(result.dependencies);
      
      this.lastCheckResult = result;
      return result;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      paths: {
        home: process.env.HOME || process.env.USERPROFILE,
        npm: await this.getNpmPrefix(),
        path: process.env.PATH
      }
    };
  }

  /**
   * 获取 npm 全局路径
   */
  async getNpmPrefix() {
    try {
      const result = await this.executeCommand('npm', ['config', 'get', 'prefix']);
      return result.success ? result.stdout.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * 检查 Node.js
   */
  async checkNodejs() {
    const result = await this.checkCommand('node', '--version');
    
    if (result.installed && result.version) {
      const versionMatch = result.version.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        result.minVersion = 16;
        result.compatible = major >= result.minVersion;
        result.displayVersion = `v${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`;
      }
    }
    
    return result;
  }

  /**
   * 检查 Git
   */
  async checkGit() {
    const result = await this.checkCommand('git', '--version');
    
    if (result.installed && result.version) {
      result.displayVersion = result.version.replace('git version ', '');
    }
    
    return result;
  }

  /**
   * 检查 Claude
   */
  async checkClaude() {
    const result = await this.checkCommand('claude', '--version');
    
    if (result.installed) {
      result.displayName = 'Claude Code CLI';
    }
    
    return result;
  }

  /**
   * 检查 UV
   */
  async checkUV() {
    const result = await this.checkCommand('uv', '--version');
    
    if (result.installed) {
      result.displayName = 'UV (Python 包管理器)';
      result.optional = true;
    }
    
    return result;
  }

  /**
   * 检查单个命令
   */
  async checkCommand(command, versionArg = '--version') {
    try {
      // 先检查命令是否存在
      const wherePath = await this.findExecutable(command);
      
      if (!wherePath) {
        return {
          installed: false,
          command: command,
          error: '未找到可执行文件'
        };
      }

      // 获取版本信息
      const versionResult = await this.executeCommand(command, [versionArg]);
      
      if (versionResult.success) {
        const version = (versionResult.stdout || versionResult.stderr || '').trim().split('\n')[0];
        return {
          installed: true,
          command: command,
          version: version || '已安装',
          path: wherePath
        };
      }

      // 某些工具可能不支持版本参数，但仍然已安装
      return {
        installed: true,
        command: command,
        version: '已安装（版本未知）',
        path: wherePath
      };
    } catch (error) {
      return {
        installed: false,
        command: command,
        error: error.message
      };
    }
  }

  /**
   * 查找可执行文件
   */
  async findExecutable(command) {
    const whereCmd = 'which';
    
    try {
      const result = await this.executeCommand(whereCmd, [command]);
      if (result.success && result.stdout) {
        return result.stdout.trim().split('\n')[0];
      }
    } catch {
      // which 命令失败，尝试常见路径
    }

    // 检查常见路径
    const paths = this.getCommonPaths(command);
    for (const p of paths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        // 继续下一个
      }
    }

    return null;
  }

  /**
   * 获取常见路径
   */
  getCommonPaths(command) {
    // macOS 专用路径
    const paths = [
      `/usr/local/bin/${command}`,
      `/usr/bin/${command}`,
      `/bin/${command}`,
      `/opt/homebrew/bin/${command}`,
      `${process.env.HOME}/.npm-global/bin/${command}`,
      `${process.env.HOME}/.local/bin/${command}`,
      `${process.env.HOME}/.nvm/current/bin/${command}`,
      `${process.env.HOME}/.cargo/bin/${command}`,
      `/Applications/Claude.app/Contents/Resources/bin/${command}`,
      `/usr/local/opt/${command}/bin/${command}`
    ];

    // 添加当前 PATH 中的所有路径
    if (process.env.PATH) {
      const pathDirs = process.env.PATH.split(':');
      for (const dir of pathDirs) {
        if (dir && dir.trim()) {
          paths.push(`${dir.trim()}/${command}`);
        }
      }
    }

    return paths;
  }

  /**
   * 获取用户完整的环境变量
   */
  async getUserEnvironment() {
    try {
      // 使用用户的默认 shell 来获取完整环境变量
      const shell = process.env.SHELL || '/bin/zsh';
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const child = spawn(shell, ['-l', '-c', 'env'], {
          timeout: 3000,
          windowsHide: true
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', (code) => {
          if (code === 0 && stdout) {
            // 解析环境变量
            const env = { ...process.env };
            const lines = stdout.trim().split('\n');
            
            for (const line of lines) {
              const equalIndex = line.indexOf('=');
              if (equalIndex > 0) {
                const key = line.substring(0, equalIndex);
                const value = line.substring(equalIndex + 1);
                env[key] = value;
              }
            }
            
            resolve(env);
          } else {
            // 如果获取失败，使用默认环境变量
            resolve(process.env);
          }
        });
        
        child.on('error', () => {
          resolve(process.env);
        });
        
        // 超时处理
        const timeout = setTimeout(() => {
          child.kill();
          resolve(process.env);
        }, 3000);
        
        // 清理定时器
        child.on('close', () => clearTimeout(timeout));
        child.on('error', () => clearTimeout(timeout));
      });
    } catch (error) {
      return process.env;
    }
  }

  /**
   * 执行命令
   */
  executeCommand(command, args = []) {
    return new Promise(async (resolve) => {
      // 获取用户完整的环境变量
      const userEnv = await this.getUserEnvironment();
      
      const options = {
        shell: true,
        timeout: 5000,
        windowsHide: true,
        env: userEnv
      };

      const child = spawn(command, args, options);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          stdout,
          stderr
        });
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      // 超时处理
      const timeout = setTimeout(() => {
        child.kill();
      }, options.timeout);
      
      // 确保定时器被清理
      child.on('close', () => clearTimeout(timeout));
      child.on('error', () => clearTimeout(timeout));
    });
  }

  /**
   * 生成摘要
   */
  generateSummary(dependencies) {
    const required = ['nodejs', 'git', 'claude'];
    const missing = [];
    const installed = [];
    const issues = [];

    for (const [key, value] of Object.entries(dependencies)) {
      if (value.installed) {
        installed.push(key);
        
        // 检查兼容性
        if (key === 'nodejs' && value.compatible === false) {
          issues.push(`Node.js 版本过低（需要 v${value.minVersion} 或更高）`);
        }
      } else if (required.includes(key)) {
        missing.push(key);
      }
    }

    const ready = missing.length === 0 && issues.length === 0;

    return {
      ready,
      installed,
      missing,
      issues,
      message: ready ? '环境就绪' : `缺少 ${missing.length} 个必需依赖`
    };
  }
}

// 创建单例实例
const environmentService = new EnvironmentService();

// 导出单例和一些有用的方法
module.exports = environmentService;
module.exports.executeCommand = environmentService.executeCommand.bind(environmentService);