'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Windows 环境检测服务
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
    this.checkAll().then(callback);
    
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
    console.log('====== 开始环境检测 (Windows) ======');
    console.log('当前 PATH:', process.env.PATH);

    try {
      const result = {
        timestamp: new Date().toISOString(),
        system: await this.getSystemInfo(),
        dependencies: {
          nodejs: await this.checkNodejs(),
          git: await this.checkGit(),
          claude: await this.checkClaude(),
          python: await this.checkPython()
        },
        summary: null
      };

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
        home: process.env.USERPROFILE || process.env.HOME,
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
      // Windows 下 npm 全局包通常在 prefix 目录下
      return prefix;
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
   * 检查 Python (Windows 可能需要)
   */
  async checkPython() {
    const result = await this.checkCommand('python', '--version');
    
    if (result.installed) {
      result.displayName = 'Python';
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
      // Windows 使用 where 命令代替 which
      let commandPath = '';
      let isInstalled = false;
      
      try {
        commandPath = execSync(`where ${command}`, {
          encoding: 'utf8',
          windowsHide: true
        }).split('\n')[0].trim();
        
        if (commandPath) {
          isInstalled = true;
        }
      } catch (e) {
        // where 命令失败，尝试直接执行
        try {
          const output = execSync(`${command} ${versionArg}`, {
            encoding: 'utf8',
            timeout: 3000,
            windowsHide: true
          });
          isInstalled = true;
          commandPath = command;
        } catch (e2) {
          // 继续检查特定路径
        }
      }
      
      // Windows 特定路径检查
      if (!isInstalled) {
        const pathsToCheck = await this.getWindowsSearchPaths(command);
        
        for (const fullPath of pathsToCheck) {
          try {
            const fs = require('fs');
            await fs.promises.access(fullPath, fs.constants.F_OK);
            
            // 尝试执行版本命令
            try {
              execSync(`"${fullPath}" ${versionArg}`, {
                encoding: 'utf8',
                timeout: 3000,
                windowsHide: true
              });
              
              isInstalled = true;
              commandPath = fullPath;
              break;
            } catch (execError) {
              // 某些命令可能不支持版本参数
              if (command === 'node' || command === 'claude' || command === 'npm') {
                isInstalled = true;
                commandPath = fullPath;
                break;
              }
            }
          } catch (e) {
            // 文件不存在，继续下一个
          }
        }
      }
      
      if (!isInstalled) {
        console.log(`未找到命令 ${command}`);
        
        let errorMessage = '未找到可执行文件';
        if (command === 'claude') {
          errorMessage = '未安装 Claude CLI。请运行: npm install -g @anthropic-ai/claude-code';
        } else if (command === 'node') {
          errorMessage = '未安装 Node.js。请访问 nodejs.org 安装';
        } else if (command === 'git') {
          errorMessage = '未安装 Git。请访问 git-scm.com 安装';
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
        const versionCommand = commandPath.includes(' ') || commandPath.includes('\\') 
          ? `"${commandPath}"` 
          : command;
        const versionOutput = execSync(`${versionCommand} ${versionArg}`, {
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true
        }).trim();
        
        if (versionOutput) {
          version = versionOutput.split('\n')[0];
        }
        console.log(`${command} 版本: ${version}`);
      } catch (e) {
        version = '已安装（版本未知）';
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
   * 获取 Windows 搜索路径
   */
  async getWindowsSearchPaths(command) {
    const paths = [];
    const ext = command.endsWith('.exe') ? '' : '.exe';
    const cmdWithExt = command + ext;
    
    // 动态获取 npm 路径
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      if (npmPrefix) {
        paths.push(path.join(npmPrefix, cmdWithExt));
        paths.push(path.join(npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', cmdWithExt));
        
        // npm 全局包在 Windows 下可能在 AppData
        const appDataNpm = path.join(process.env.APPDATA || '', 'npm', cmdWithExt);
        paths.push(appDataNpm);
      }
    } catch (e) {
      console.log('无法获取 npm prefix');
    }
    
    // 标准 Windows 路径
    const standardPaths = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', cmdWithExt),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', cmdWithExt),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', cmdWithExt),
      path.join(process.env.USERPROFILE || '', '.npm-global', cmdWithExt),
      path.join('C:\\Windows\\System32', cmdWithExt),
      path.join('C:\\Windows', cmdWithExt)
    ];
    
    paths.push(...standardPaths);
    
    // Git 特定路径
    if (command === 'git') {
      paths.push(
        'C:\\Program Files\\Git\\bin\\git.exe',
        'C:\\Program Files (x86)\\Git\\bin\\git.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'git.exe')
      );
    }
    
    // 从 PATH 环境变量获取
    if (process.env.PATH) {
      const pathDirs = process.env.PATH.split(';');
      for (const dir of pathDirs) {
        if (dir && dir.trim()) {
          paths.push(path.join(dir.trim(), cmdWithExt));
        }
      }
    }
    
    return [...new Set(paths)];
  }

  /**
   * 执行命令
   */
  executeCommand(command, args = []) {
    try {
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const result = execSync(fullCommand, {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
        shell: true
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
   * 尝试修复 Claude CLI 路径问题 (Windows 版本)
   */
  async fixClaudePath() {
    try {
      // Windows 下通常不需要创建符号链接，npm 会自动处理
      // 只需要确保 npm 的全局路径在 PATH 中
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const npmPath = path.join(npmPrefix);
      const appDataNpm = path.join(process.env.APPDATA || '', 'npm');
      
      console.log('NPM 全局路径:', npmPath);
      console.log('AppData NPM 路径:', appDataNpm);
      
      // 检查 PATH 是否包含这些路径
      const currentPath = process.env.PATH || '';
      const pathsToCheck = [npmPath, appDataNpm];
      const missingPaths = pathsToCheck.filter(p => !currentPath.includes(p));
      
      if (missingPaths.length > 0) {
        return {
          success: false,
          message: `请将以下路径添加到系统 PATH 环境变量：\n${missingPaths.join('\n')}\n\n然后重启应用。`
        };
      }
      
      return {
        success: true,
        message: 'PATH 环境变量已包含必要的路径'
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
        home: process.env.USERPROFILE || process.env.HOME,
        appData: process.env.APPDATA,
        localAppData: process.env.LOCALAPPDATA
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
      const globalPackages = execSync('npm list -g --depth=0', { 
        encoding: 'utf8',
        windowsHide: true 
      });
      diagnostics.npmGlobalPackages = globalPackages;
    } catch (e) {
      diagnostics.npmGlobalPackages = 'Unable to list global packages';
    }
    
    return diagnostics;
  }
}

// 创建单例实例
const environmentService = new EnvironmentService();

// 导出单例和一些有用的方法
module.exports = environmentService;
module.exports.executeCommand = environmentService.executeCommand.bind(environmentService);