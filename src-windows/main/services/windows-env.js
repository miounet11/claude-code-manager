'use strict';

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Windows 环境检测服务
 * 专门针对 Windows 平台优化的环境检测
 */
class WindowsEnvironmentService {
  constructor() {
    this.cachedResult = null;
    this.isChecking = false;
  }

  /**
   * 检查所有环境依赖
   */
  async checkAll() {
    if (this.isChecking) {
      return this.cachedResult;
    }

    this.isChecking = true;
    console.log('===== Windows 环境检测开始 =====');

    try {
      const result = {
        timestamp: new Date().toISOString(),
        platform: 'win32',
        system: await this.getSystemInfo(),
        dependencies: {
          nodejs: await this.checkNodejs(),
          python: await this.checkPython(),
          git: await this.checkGit(),
          claude: await this.checkClaude(),
          powershell: await this.checkPowerShell(),
          windowsTerminal: await this.checkWindowsTerminal()
        },
        paths: await this.getWindowsPaths(),
        summary: null
      };

      // 生成摘要
      result.summary = this.generateSummary(result.dependencies);
      
      console.log('===== Windows 环境检测完成 =====');
      this.cachedResult = result;
      return result;
    } catch (error) {
      console.error('Windows 环境检测错误:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 获取 Windows 系统信息
   */
  async getSystemInfo() {
    try {
      // 获取 Windows 版本
      const { stdout: osVersion } = await execAsync('wmic os get Caption,Version /value');
      const versionMatch = osVersion.match(/Caption=([^\r\n]+)/);
      const buildMatch = osVersion.match(/Version=([^\r\n]+)/);

      // 获取系统架构
      const arch = process.arch;
      
      // 获取用户信息
      const username = process.env.USERNAME || process.env.USER;
      const userprofile = process.env.USERPROFILE;

      return {
        os: versionMatch ? versionMatch[1].trim() : 'Windows',
        version: buildMatch ? buildMatch[1].trim() : 'Unknown',
        arch: arch,
        username: username,
        userProfile: userprofile,
        isAdmin: await this.checkAdminRights()
      };
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return {
        os: 'Windows',
        version: 'Unknown',
        arch: process.arch,
        username: process.env.USERNAME,
        userProfile: process.env.USERPROFILE,
        isAdmin: false
      };
    }
  }

  /**
   * 检查管理员权限
   */
  async checkAdminRights() {
    try {
      await execAsync('net session', { windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查 Node.js
   */
  async checkNodejs() {
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      return {
        installed: true,
        version: version,
        path: await this.findExecutable('node.exe')
      };
    } catch (error) {
      return {
        installed: false,
        error: 'Node.js 未安装'
      };
    }
  }

  /**
   * 检查 Python
   */
  async checkPython() {
    try {
      // 尝试多个 Python 命令
      const commands = ['python', 'python3', 'py'];
      
      for (const cmd of commands) {
        try {
          const { stdout } = await execAsync(`${cmd} --version`);
          const version = stdout.trim();
          return {
            installed: true,
            version: version,
            command: cmd,
            path: await this.findExecutable(`${cmd}.exe`)
          };
        } catch {
          continue;
        }
      }
      
      return {
        installed: false,
        error: 'Python 未安装'
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message
      };
    }
  }

  /**
   * 检查 Git
   */
  async checkGit() {
    try {
      const { stdout } = await execAsync('git --version');
      const version = stdout.trim();
      return {
        installed: true,
        version: version,
        path: await this.findExecutable('git.exe')
      };
    } catch (error) {
      return {
        installed: false,
        error: 'Git 未安装'
      };
    }
  }

  /**
   * 检查 Claude CLI
   */
  async checkClaude() {
    try {
      const { stdout } = await execAsync('claude --version');
      const version = stdout.trim();
      return {
        installed: true,
        version: version,
        path: await this.findExecutable('claude.exe')
      };
    } catch (error) {
      // 检查常见的安装位置
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA, 'Programs', 'claude', 'claude.exe'),
        path.join(process.env.PROGRAMFILES, 'Claude', 'claude.exe'),
        path.join(process.env.USERPROFILE, '.claude', 'bin', 'claude.exe')
      ];

      for (const claudePath of possiblePaths) {
        try {
          await fs.access(claudePath);
          return {
            installed: true,
            version: 'Unknown',
            path: claudePath,
            needsPathConfig: true
          };
        } catch {
          continue;
        }
      }

      return {
        installed: false,
        error: 'Claude CLI 未安装'
      };
    }
  }

  /**
   * 检查 PowerShell
   */
  async checkPowerShell() {
    try {
      const { stdout } = await execAsync('powershell -Command "$PSVersionTable.PSVersion.ToString()"');
      const version = stdout.trim();
      
      // 检查是否是 PowerShell Core (7.x)
      let isPowerShellCore = false;
      try {
        await execAsync('pwsh --version');
        isPowerShellCore = true;
      } catch {
        isPowerShellCore = false;
      }

      return {
        installed: true,
        version: version,
        isPowerShellCore: isPowerShellCore
      };
    } catch (error) {
      return {
        installed: false,
        error: 'PowerShell 检测失败'
      };
    }
  }

  /**
   * 检查 Windows Terminal
   */
  async checkWindowsTerminal() {
    try {
      // 检查 Windows Terminal 是否安装
      const { stdout } = await execAsync('powershell -Command "Get-AppxPackage Microsoft.WindowsTerminal | Select-Object -ExpandProperty Version"');
      const version = stdout.trim();
      
      return {
        installed: !!version,
        version: version || 'Not installed'
      };
    } catch {
      return {
        installed: false,
        version: 'Not installed'
      };
    }
  }

  /**
   * 获取 Windows 路径配置
   */
  async getWindowsPaths() {
    const paths = {
      system: process.env.PATH ? process.env.PATH.split(';') : [],
      userProfile: process.env.USERPROFILE,
      programFiles: process.env.PROGRAMFILES,
      programFilesX86: process.env['PROGRAMFILES(X86)'],
      localAppData: process.env.LOCALAPPDATA,
      appData: process.env.APPDATA,
      temp: process.env.TEMP
    };

    // 添加常见的开发工具路径
    const additionalPaths = [
      path.join(process.env.PROGRAMFILES, 'nodejs'),
      path.join(process.env.PROGRAMFILES, 'Git', 'bin'),
      path.join(process.env.LOCALAPPDATA, 'Programs', 'Python'),
      path.join(process.env.USERPROFILE, '.npm-global', 'bin'),
      path.join(process.env.USERPROFILE, 'scoop', 'shims'),
      path.join(process.env.PROGRAMDATA, 'chocolatey', 'bin')
    ];

    paths.recommended = additionalPaths;
    
    return paths;
  }

  /**
   * 查找可执行文件
   */
  async findExecutable(exeName) {
    try {
      const { stdout } = await execAsync(`where ${exeName}`);
      const paths = stdout.trim().split('\n').filter(p => p);
      return paths[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 生成检测摘要
   */
  generateSummary(dependencies) {
    const required = ['nodejs', 'claude'];
    const missing = [];
    const warnings = [];

    for (const dep of required) {
      if (!dependencies[dep]?.installed) {
        missing.push(dep);
      }
    }

    // 检查版本兼容性
    if (dependencies.nodejs?.installed) {
      const version = dependencies.nodejs.version;
      const majorVersion = parseInt(version.match(/v(\d+)/)?.[1] || '0');
      if (majorVersion < 18) {
        warnings.push(`Node.js 版本过低 (${version})，建议升级到 v18 或更高版本`);
      }
    }

    // PowerShell 建议
    if (!dependencies.powershell?.isPowerShellCore) {
      warnings.push('建议安装 PowerShell Core (7.x) 以获得更好的体验');
    }

    return {
      ready: missing.length === 0,
      missing: missing,
      warnings: warnings,
      message: missing.length === 0 
        ? '环境检测通过' 
        : `缺少依赖: ${missing.join(', ')}`
    };
  }

  /**
   * 安装缺失的依赖
   */
  async installDependency(name) {
    const installCommands = {
      nodejs: {
        command: 'winget install OpenJS.NodeJS',
        alternative: 'https://nodejs.org/en/download/'
      },
      python: {
        command: 'winget install Python.Python.3',
        alternative: 'https://www.python.org/downloads/'
      },
      git: {
        command: 'winget install Git.Git',
        alternative: 'https://git-scm.com/download/win'
      },
      claude: {
        command: 'npm install -g @anthropic/claude-cli',
        alternative: 'https://claude.ai/cli'
      }
    };

    const install = installCommands[name];
    if (!install) {
      throw new Error(`未知的依赖: ${name}`);
    }

    return {
      command: install.command,
      alternative: install.alternative,
      instructions: `请在管理员权限的终端中运行: ${install.command}`
    };
  }
}

module.exports = new WindowsEnvironmentService();