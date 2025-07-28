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
      const { execSync } = require('child_process');
      
      // 使用 npm config get prefix 替代已废弃的 npm bin -g
      const npmPrefix = execSync('npm config get prefix', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      return npmPrefix;
    } catch (error) {
      console.error('获取 npm prefix 失败:', error.message);
      
      // 尝试常见的默认路径
      const defaultPaths = [
        '/usr/local',
        `${process.env.HOME}/.npm-global`,
        `${process.env.HOME}/Documents/claude code/node-v20.10.0-darwin-arm64`
      ];
      
      for (const path of defaultPaths) {
        try {
          const fs = require('fs');
          fs.accessSync(`${path}/bin`, fs.constants.R_OK);
          return path;
        } catch {
          // 继续尝试下一个
        }
      }
      
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
    console.log('开始检查 Claude Code...');
    
    // 首先尝试通过 npm 检测已安装的包
    try {
      const { execSync } = require('child_process');
      
      // 获取 npm prefix
      const npmPrefix = execSync('npm config get prefix', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      // 检查 @anthropic-ai/claude-code 包
      const npmListResult = execSync(`npm list -g @anthropic-ai/claude-code 2>&1`, {
        encoding: 'utf8'
      });
      
      if (npmListResult.includes('@anthropic-ai/claude-code')) {
        // 包已安装，构建可能的路径
        const possiblePaths = [
          `${npmPrefix}/bin/claude`,
          `${process.env.HOME}/Documents/claude code/node-v20.10.0-darwin-arm64/bin/claude`,
          '/usr/local/bin/claude',
          `${process.env.HOME}/.npm-global/bin/claude`
        ];
        
        // 尝试找到可执行文件
        for (const path of possiblePaths) {
          try {
            const fs = require('fs');
            fs.accessSync(path, fs.constants.X_OK);
            
            // 获取版本信息
            let version = '已安装';
            try {
              version = execSync(`"${path}" --version 2>&1`, {
                encoding: 'utf8',
                timeout: 3000
              }).trim();
            } catch (e) {
              // 某些版本可能不支持 --version
              version = '已安装 (版本未知)';
            }
            
            console.log(`找到 Claude Code: ${path}`);
            return {
              installed: true,
              command: 'claude',
              version: version,
              path: path,
              displayName: 'Claude Code CLI'
            };
          } catch (e) {
            // 继续尝试下一个路径
          }
        }
      }
    } catch (e) {
      console.log('npm 检测失败，使用备用方法');
    }
    
    // 如果 npm 方法失败，使用原有的检测方法
    const result = await this.checkCommand('claude', '--version');
    
    if (result.installed) {
      result.displayName = 'Claude Code CLI';
    } else {
      // 提供更详细的错误信息
      result.error = '未检测到 Claude Code CLI。请确保已通过 npm install -g @anthropic-ai/claude-code 安装';
      result.helpUrl = 'https://claude.ai/code';
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
    const { execSync } = require('child_process');
    
    try {
      // 特殊处理 Claude 命令
      if (command === 'claude') {
        return await this.checkClaude();
      }
      
      // 使用与 Claude_code_proxy.sh 相同的检测方法
      let isInstalled = false;
      let commandPath = '';
      
      // 方法1: 直接使用 command -v 检测
      try {
        const testCmd = `command -v ${command}`;
        
        execSync(testCmd, { 
          stdio: 'ignore',
          shell: '/bin/bash'
        });
        isInstalled = true;
        
        // 获取命令路径
        try {
          commandPath = execSync(testCmd, {
            encoding: 'utf8',
            shell: '/bin/bash'
          }).trim();
        } catch (e) {
          commandPath = command;
        }
      } catch (e) {
        
        // 方法2: 尝试 which
        try {
          commandPath = execSync(`which ${command}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
          }).trim();
          
          if (commandPath) {
            isInstalled = true;
          }
        } catch (e2) {
          // 继续尝试下一个方法
        }
        
        // 方法3: 直接尝试执行命令
        if (!isInstalled) {
          try {
            const output = execSync(`${command} --version 2>&1`, {
              encoding: 'utf8',
              timeout: 2000
            });
            isInstalled = true;
            commandPath = command;
          } catch (e3) {
            // 继续尝试下一个方法
          }
        }
      }
      
      // 方法4: 在打包环境中，PATH 可能被限制，尝试使用完整路径
      if (!isInstalled) {
        const pathsToCheck = [
          '/usr/local/bin',
          '/usr/bin',
          '/opt/homebrew/bin',
          `${process.env.HOME}/.npm-global/bin`,
          `${process.env.HOME}/Documents/claude code/node-v20.10.0-darwin-arm64/bin`,
          `${process.env.HOME}/.local/bin`,
          `${process.env.HOME}/.cargo/bin`,
          '/Applications/Claude.app/Contents/Resources/bin'
        ];
        
        for (const dir of pathsToCheck) {
          const fullPath = `${dir}/${command}`;
          try {
            // 检查文件是否存在且可执行
            const fs = require('fs');
            fs.accessSync(fullPath, fs.constants.X_OK);
            
            // 尝试使用完整路径执行版本命令
            try {
              const versionOutput = execSync(`"${fullPath}" ${versionArg} 2>&1`, {
                encoding: 'utf8',
                timeout: 3000
              }).trim();
              
              isInstalled = true;
              commandPath = fullPath;
              break;
            } catch (execError) {
              // 对于某些命令，即使版本参数失败，文件存在也算已安装
              if (command === 'node' || command === 'claude' || command === 'npm') {
                isInstalled = true;
                commandPath = fullPath;
                break;
              }
            }
          } catch (e) {
            // 文件不存在或不可执行，继续下一个
          }
        }
      }
      
      if (!isInstalled) {
        console.log(`未找到命令 ${command}`);
        
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

      console.log(`找到 ${command} 位于: ${commandPath}`);

      // 获取版本信息
      let version = '已安装';
      try {
        // 使用完整路径执行版本命令
        const versionCommand = commandPath.includes('/') ? `"${commandPath}"` : command;
        const versionOutput = execSync(`${versionCommand} ${versionArg} 2>&1`, {
          encoding: 'utf8',
          timeout: 3000
        }).trim();
        
        if (versionOutput) {
          version = versionOutput.split('\n')[0];
        }
        console.log(`${command} 版本: ${version}`);
      } catch (e) {
        // 对于 node 和 claude，即使无法获取版本也认为已安装
        if (command === 'node' || command === 'claude' || command === 'npm') {
          version = '已安装';
        } else {
          version = '已安装（版本未知）';
        }
      }

      return {
        installed: true,
        command: command,
        version: version,
        path: commandPath
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
    const { execSync } = require('child_process');
    
    // 方法1：使用 command -v (POSIX 标准)
    try {
      const result = execSync(`command -v ${command} 2>/dev/null`, {
        encoding: 'utf8',
        shell: '/bin/bash'
      }).trim();
      
      if (result) {
        console.log(`通过 command -v 找到 ${command}: ${result}`);
        return result;
      }
    } catch (e) {
      // 继续尝试其他方法
    }

    // 方法2：使用 which
    try {
      const result = execSync(`which ${command} 2>/dev/null`, {
        encoding: 'utf8'
      }).trim();
      
      if (result) {
        console.log(`通过 which 找到 ${command}: ${result}`);
        return result;
      }
    } catch (e) {
      // 继续尝试其他方法
    }

    // 方法3：在常见路径中查找
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
    const { execSync } = require('child_process');
    
    try {
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const result = execSync(fullCommand, {
        encoding: 'utf8',
        timeout: 5000,
        shell: '/bin/bash'
      });
      
      return {
        success: true,
        code: 0,
        stdout: result.trim(),
        stderr: ''
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: '',
        stderr: error.stderr ? error.stderr.toString() : ''
      };
    }
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