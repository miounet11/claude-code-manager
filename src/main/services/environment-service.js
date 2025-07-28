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
   * 获取 npm 全局 bin 目录
   */
  async getNpmBinPath() {
    const prefix = await this.getNpmPrefix();
    if (prefix) {
      return `${prefix}/bin`;
    }
    return null;
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
    const { execSync } = require('child_process');
    
    try {
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
        const pathsToCheck = await this.getSearchPaths(command);
        
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
          errorMessage = '未安装 Claude CLI。请运行: npm install -g @anthropic-ai/claude-code';
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
    const paths = await this.getSearchPaths(command);
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
   * 动态获取搜索路径
   */
  async getSearchPaths(command) {
    const paths = [];
    const { execSync } = require('child_process');
    
    // 1. 获取 npm 全局路径
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      if (npmPrefix) {
        paths.push(`${npmPrefix}/bin/${command}`);
        // 检查 @anthropic-ai/claude-code 包的 bin 目录
        if (command === 'claude') {
          paths.push(`${npmPrefix}/lib/node_modules/@anthropic-ai/claude-code/bin/${command}`);
        }
      }
    } catch (e) {
      console.log('无法获取 npm prefix');
    }
    
    // 2. 获取当前 Node.js 的 bin 目录
    try {
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      if (nodePath) {
        const nodeDir = path.dirname(nodePath);
        paths.push(`${nodeDir}/${command}`);
      }
    } catch (e) {
      console.log('无法获取 node 路径');
    }
    
    // 3. 标准系统路径
    const standardPaths = [
      `/usr/local/bin/${command}`,
      `/usr/bin/${command}`,
      `/bin/${command}`,
      `/opt/homebrew/bin/${command}`,
      `${process.env.HOME}/.npm-global/bin/${command}`,
      `${process.env.HOME}/.local/bin/${command}`,
      `${process.env.HOME}/.cargo/bin/${command}`,
      `/Applications/Claude.app/Contents/Resources/bin/${command}`
    ];
    
    paths.push(...standardPaths);
    
    // 4. 检查 nvm 管理的 Node 版本
    const nvmDir = process.env.NVM_DIR || `${process.env.HOME}/.nvm`;
    try {
      const fs = require('fs');
      const versionDirs = await fs.promises.readdir(`${nvmDir}/versions/node`).catch(() => []);
      for (const version of versionDirs) {
        paths.push(`${nvmDir}/versions/node/${version}/bin/${command}`);
      }
    } catch (e) {
      // nvm 不存在或无法访问
    }
    
    // 5. 添加当前 PATH 中的所有路径
    if (process.env.PATH) {
      const pathDirs = process.env.PATH.split(':');
      for (const dir of pathDirs) {
        if (dir && dir.trim()) {
          paths.push(`${dir.trim()}/${command}`);
        }
      }
    }
    
    // 去重
    return [...new Set(paths)];
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
      
      // 动态获取额外的路径
      const additionalPaths = await this.getDynamicPaths();
      
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

  /**
   * 尝试修复 Claude CLI 路径问题
   */
  async fixClaudePath() {
    const { execSync } = require('child_process');
    
    try {
      // 1. 获取 npm 全局安装路径
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const npmBinPath = `${npmPrefix}/bin`;
      
      // 2. 检查 Claude 是否在 npm bin 目录中
      const claudePath = `${npmBinPath}/claude`;
      const fs = require('fs');
      
      if (fs.existsSync(claudePath)) {
        // 3. 创建符号链接到常用路径
        const targetPaths = ['/usr/local/bin/claude', '/opt/homebrew/bin/claude'];
        
        for (const target of targetPaths) {
          try {
            // 检查目录是否存在
            const targetDir = path.dirname(target);
            if (fs.existsSync(targetDir)) {
              // 如果目标已存在，先删除
              if (fs.existsSync(target)) {
                fs.unlinkSync(target);
              }
              // 创建符号链接
              execSync(`ln -s "${claudePath}" "${target}"`, { encoding: 'utf8' });
              console.log(`创建符号链接: ${target} -> ${claudePath}`);
              return { success: true, message: `已创建符号链接到 ${target}` };
            }
          } catch (e) {
            console.log(`无法创建链接到 ${target}:`, e.message);
          }
        }
      }
      
      // 4. 如果 Claude 未安装，返回安装建议
      return {
        success: false,
        message: 'Claude CLI 未找到，请运行: npm install -g @anthropic-ai/claude-code'
      };
      
    } catch (error) {
      console.error('修复 Claude 路径失败:', error);
      return {
        success: false,
        error: error.message,
        message: '无法自动修复，请手动检查 Claude CLI 安装'
      };
    }
  }

  /**
   * 获取详细的环境诊断信息
   */
  async getDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      paths: {
        PATH: process.env.PATH,
        npm: await this.getNpmPrefix(),
        home: process.env.HOME || process.env.USERPROFILE
      },
      checks: {}
    };
    
    // 检查关键命令
    const commands = ['node', 'npm', 'git', 'claude'];
    for (const cmd of commands) {
      diagnostics.checks[cmd] = await this.checkCommand(cmd);
    }
    
    // 检查 npm 全局包
    try {
      const { execSync } = require('child_process');
      const globalPackages = execSync('npm list -g --depth=0', { encoding: 'utf8' });
      diagnostics.npmGlobalPackages = globalPackages;
    } catch (e) {
      diagnostics.npmGlobalPackages = 'Unable to list global packages';
    }
    
    return diagnostics;
  }
  
  /**
   * 动态获取额外的 PATH 路径
   */
  async getDynamicPaths() {
    const paths = [];
    const { execSync } = require('child_process');
    
    // 基础系统路径
    const basePaths = [
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin'
    ];
    
    paths.push(...basePaths);
    
    // 动态获取 npm 相关路径
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      if (npmPrefix) {
        paths.push(`${npmPrefix}/bin`);
      }
    } catch (e) {
      // npm 不可用
    }
    
    // 动态获取当前 Node.js 的 bin 目录
    try {
      const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
      if (nodePath) {
        const nodeDir = path.dirname(nodePath);
        paths.push(nodeDir);
      }
    } catch (e) {
      // node 路径获取失败
    }
    
    // 用户目录下的常见路径
    paths.push(
      `${process.env.HOME}/.npm-global/bin`,
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/.cargo/bin`
    );
    
    // 应用特定路径
    paths.push('/Applications/Claude.app/Contents/Resources/bin');
    
    return [...new Set(paths)];
  }
}

// 创建单例实例
const environmentService = new EnvironmentService();

// 导出单例和一些有用的方法
module.exports = environmentService;
module.exports.executeCommand = environmentService.executeCommand.bind(environmentService);