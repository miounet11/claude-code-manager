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
    console.log('====== 开始环境检测 ======');
    console.log('当前 PATH:', process.env.PATH);

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
      
      console.log('====== 环境检测完成 ======');
      console.log('检测结果:', JSON.stringify(result, null, 2));
      
      this.lastCheckResult = result;
      return result;
    } catch (error) {
      console.error('环境检测出错:', error);
      throw error;
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
    console.log(`检查命令: ${command}`);
    
    try {
      // 先检查命令是否存在
      const wherePath = await this.findExecutable(command);
      
      if (!wherePath) {
        console.log(`未找到命令 ${command} 的可执行文件`);
        
        // 对于特定命令提供更详细的错误信息
        let errorMessage = '未找到可执行文件';
        if (command === 'claude') {
          errorMessage = '未安装 Claude CLI。请访问 claude.ai/code 安装';
        } else if (command === 'node') {
          errorMessage = '未安装 Node.js。请访问 nodejs.org 安装';
        } else if (command === 'git') {
          errorMessage = '未安装 Git。请通过 Homebrew 或访问 git-scm.com 安装';
        } else if (command === 'uv') {
          errorMessage = '未安装 UV。这是可选依赖，用于 Python 包管理';
        }
        
        return {
          installed: false,
          command: command,
          error: errorMessage
        };
      }

      console.log(`找到 ${command} 位于: ${wherePath}`);

      // 获取版本信息
      const versionResult = await this.executeCommand(command, [versionArg]);
      
      if (versionResult.success) {
        const version = (versionResult.stdout || versionResult.stderr || '').trim().split('\n')[0];
        console.log(`${command} 版本: ${version}`);
        return {
          installed: true,
          command: command,
          version: version || '已安装',
          path: wherePath
        };
      }

      // 某些工具可能不支持版本参数，但仍然已安装
      console.log(`${command} 已安装但无法获取版本信息`);
      return {
        installed: true,
        command: command,
        version: '已安装（版本未知）',
        path: wherePath
      };
    } catch (error) {
      console.error(`检查命令 ${command} 时出错:`, error);
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
    // 首先尝试直接执行命令来检查它是否存在
    try {
      const { execSync } = require('child_process');
      const userEnv = await this.getUserEnvironment();
      
      // 使用 command -v 代替 which，更加可靠
      try {
        const result = execSync(`command -v ${command}`, {
          encoding: 'utf8',
          env: userEnv,
          shell: '/bin/sh'
        }).trim();
        
        if (result) {
          console.log(`通过 command -v 找到 ${command}: ${result}`);
          return result;
        }
      } catch (e) {
        // command -v 失败，尝试 which
        try {
          const result = execSync(`which ${command}`, {
            encoding: 'utf8',
            env: userEnv
          }).trim();
          
          if (result) {
            console.log(`通过 which 找到 ${command}: ${result}`);
            return result;
          }
        } catch (e2) {
          // which 也失败了
        }
      }
    } catch (error) {
      console.log(`查找 ${command} 时出错:`, error.message);
    }

    // 检查常见路径
    console.log(`在常见路径中查找 ${command}...`);
    const paths = this.getCommonPaths(command);
    for (const p of paths) {
      try {
        await fs.access(p, fs.constants.X_OK);
        console.log(`在路径中找到 ${command}: ${p}`);
        return p;
      } catch {
        // 继续下一个
      }
    }

    console.log(`无法找到 ${command}`);
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
      // 在 macOS 的 Electron 应用中，需要特别处理 PATH
      const env = { ...process.env };
      
      // 首先尝试通过 path_helper 获取系统 PATH
      if (process.platform === 'darwin') {
        try {
          const { execSync } = require('child_process');
          const systemPath = execSync('/usr/libexec/path_helper -s', { encoding: 'utf8' });
          const pathMatch = systemPath.match(/PATH="([^"]+)"/);
          if (pathMatch && pathMatch[1]) {
            env.PATH = pathMatch[1];
          }
        } catch (e) {
          console.log('获取系统 PATH 失败，使用备用方案');
        }
      }
      
      // 添加常见的路径
      const additionalPaths = [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        `${process.env.HOME}/.npm-global/bin`,
        `${process.env.HOME}/.local/bin`,
        `${process.env.HOME}/.cargo/bin`,
        '/Applications/Claude.app/Contents/Resources/bin'
      ];
      
      // 合并 PATH
      const currentPaths = (env.PATH || '').split(':').filter(p => p);
      const allPaths = [...new Set([...currentPaths, ...additionalPaths])];
      env.PATH = allPaths.join(':');
      
      return env;
    } catch (error) {
      console.error('获取用户环境变量失败:', error);
      return process.env;
    }
  }

  /**
   * 执行命令
   */
  executeCommand(command, args = []) {
    return new Promise(async (resolve) => {
      try {
        // 获取用户完整的环境变量
        const userEnv = await this.getUserEnvironment();
        
        // 对于简单的版本检查，尝试使用 execSync 更可靠
        if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
          try {
            const { execSync } = require('child_process');
            const result = execSync(`${command} ${args[0]}`, {
              encoding: 'utf8',
              env: userEnv,
              timeout: 5000
            });
            
            return resolve({
              success: true,
              code: 0,
              stdout: result.trim(),
              stderr: ''
            });
          } catch (syncError) {
            // 如果 execSync 失败，继续使用 spawn
            console.log(`execSync 失败 (${command}):`, syncError.message);
          }
        }
        
        const options = {
          shell: true,
          timeout: 5000,
          windowsHide: true,
          env: userEnv
        };

        const child = spawn(command, args, options);
        
        let stdout = '';
        let stderr = '';
        
        if (child.stdout) {
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
        }
        
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }
        
        child.on('error', (error) => {
          console.error(`命令执行错误 (${command}):`, error);
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
          resolve({
            success: false,
            error: 'Command timeout',
            stdout,
            stderr
          });
        }, options.timeout);
        
        // 确保定时器被清理
        child.on('close', () => clearTimeout(timeout));
        child.on('error', () => clearTimeout(timeout));
      } catch (error) {
        console.error(`executeCommand 错误 (${command}):`, error);
        resolve({
          success: false,
          error: error.message,
          stdout: '',
          stderr: ''
        });
      }
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