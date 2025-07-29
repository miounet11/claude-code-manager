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
    this.debugMode = process.env.NODE_ENV === 'development';
    this.logs = []; // 存储检测日志用于调试
  }

  /**
   * 结构化日志记录
   */
  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      details,
      context: 'EnvironmentService'
    };
    
    this.logs.push(logEntry);
    
    // 保持最近100条日志
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    // 根据级别输出到控制台
    const consoleMsg = `[${timestamp}] [ENV-${level}] ${message}`;
    switch (level) {
      case 'ERROR':
        console.error(consoleMsg, details || '');
        break;
      case 'WARN':
        console.warn(consoleMsg, details || '');
        break;
      case 'INFO':
        if (this.debugMode) console.log(consoleMsg, details || '');
        break;
      case 'DEBUG':
        if (this.debugMode) console.debug(consoleMsg, details || '');
        break;
    }
  }

  /**
   * 获取检测日志
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 启动定期检测
   */
  startPeriodicCheck(callback, interval = 30000) {
    if (this.checkInterval) {
      this.log('WARN', '定期检测已在运行，先停止现有检测');
      this.stopPeriodicCheck();
    }
    
    this.log('INFO', '启动定期环境检测', { interval });
    
    // 立即执行一次检测
    this.checkAll().then(result => {
      try {
        callback(result);
      } catch (callbackError) {
        this.log('ERROR', '检测回调函数执行失败', { error: callbackError.message });
      }
    }).catch(error => {
      this.log('ERROR', '初始环境检测失败', { error: error.message });
    });
    
    // 设置定期检测
    this.checkInterval = setInterval(async () => {
      try {
        const result = await this.checkAll();
        callback(result);
      } catch (error) {
        this.log('ERROR', '定期检测失败', { error: error.message });
        callback({ error: '定期检测失败', timestamp: new Date().toISOString() });
      }
    }, interval);
  }

  /**
   * 停止定期检测
   */
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.log('INFO', '定期环境检测已停止');
    }
  }

  /**
   * 检查所有环境
   */
  async checkAll() {
    const checkId = `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 使用更安全的并发控制
    if (this.isChecking) {
      this.log('INFO', '环境检测正在进行中，返回缓存结果', {
        requestId: checkId,
        cachedTimestamp: this.lastCheckResult?.timestamp
      });
      return this.lastCheckResult || { error: '检测正在进行中' };
    }

    this.isChecking = true;
    const startTime = Date.now();
    
    this.log('INFO', '开始环境检测', { requestId: checkId });
    
    try {
      // 在打包应用中增强 PATH
      await this.enhanceEnvironmentPath();
      this.log('DEBUG', 'PATH环境增强完成', {
        pathLength: process.env.PATH?.split(':').length || 0
      });

      // 并行检测所有依赖（提高效率）
      const [systemInfo, dependencies] = await Promise.all([
        this.getSystemInfo(),
        Promise.all([
          this.checkNodejs().catch(err => ({ installed: false, error: err.message, command: 'nodejs' })),
          this.checkGit().catch(err => ({ installed: false, error: err.message, command: 'git' })),
          this.checkClaude().catch(err => ({ installed: false, error: err.message, command: 'claude' })),
          this.checkUV().catch(err => ({ installed: false, error: err.message, command: 'uv' }))
        ])
      ]);

      const result = {
        timestamp: new Date().toISOString(),
        requestId: checkId,
        system: systemInfo,
        dependencies: {
          nodejs: dependencies[0],
          git: dependencies[1],
          claude: dependencies[2],
          uv: dependencies[3]
        },
        summary: null,
        logs: this.debugMode ? this.getLogs().slice(-20) : undefined // 包含最近的日志用于调试
      };

      // 生成摘要
      result.summary = this.generateSummary(result.dependencies);
      
      const duration = Date.now() - startTime;
      this.log('INFO', '环境检测完成', {
        requestId: checkId,
        duration,
        ready: result.summary.ready,
        installed: result.summary.installed.length,
        missing: result.summary.missing.length
      });
      
      this.lastCheckResult = result;
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('ERROR', '环境检测出错', {
        requestId: checkId,
        error: error.message,
        stack: error.stack,
        duration
      });
      
      // 返回错误结果而不是抛出异常
      const errorResult = {
        timestamp: new Date().toISOString(),
        requestId: checkId,
        error: error.message,
        system: null,
        dependencies: {},
        summary: { ready: false, installed: [], missing: [], issues: ['检测过程出错'], message: '检测失败' }
      };
      
      this.lastCheckResult = errorResult;
      return errorResult;
      
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
    // 先尝试常规检测
    let result = await this.checkCommand('node', '--version');
    
    // 如果常规检测失败，尝试特殊方法
    if (!result.installed) {
      console.log('Node.js 常规检测失败，尝试特殊方法...');
      
      // 方法1: 检查 Electron 内置的 Node.js
      if (process.versions && process.versions.node) {
        console.log('检测到 Electron 内置 Node.js:', process.versions.node);
        result = {
          installed: true,
          command: 'node',
          version: `v${process.versions.node}`,
          path: process.execPath,
          displayVersion: `v${process.versions.node}`,
          note: 'Electron 内置'
        };
      }
      
      // 方法2: 尝试通过完整路径查找常见的 Node.js 安装
      if (!result.installed) {
        const commonNodePaths = [
          '/usr/local/bin/node',
          '/opt/homebrew/bin/node',
          '/usr/bin/node',
          `${process.env.HOME}/.nvm/current/bin/node`,
          `${process.env.HOME}/n/bin/node`,
          '/Applications/Node.app/Contents/MacOS/node'
        ];
        
        const fs = require('fs');
        for (const nodePath of commonNodePaths) {
          try {
            await fs.promises.access(nodePath, fs.constants.X_OK);
            const { execSync } = require('child_process');
            const version = execSync(`"${nodePath}" --version`, { encoding: 'utf8' }).trim();
            console.log(`找到 Node.js: ${nodePath}, 版本: ${version}`);
            result = {
              installed: true,
              command: 'node',
              version: version,
              path: nodePath,
              displayVersion: version
            };
            break;
          } catch (e) {
            // 继续尝试下一个路径
          }
        }
      }
    }
    
    if (result.installed && result.version) {
      const versionMatch = result.version.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        result.minVersion = 16;
        result.compatible = major >= result.minVersion;
        result.displayVersion = result.displayVersion || `v${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`;
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
    // 先尝试常规检测
    let result = await this.checkCommand('claude', '--version');
    
    // 如果常规检测失败，尝试特殊方法
    if (!result.installed) {
      console.log('Claude CLI 常规检测失败，尝试特殊方法...');
      
      // 获取可能的 npm 全局路径
      const { execSync } = require('child_process');
      const fs = require('fs');
      const possiblePaths = [];
      
      // 方法1: 尝试获取 npm 全局路径
      try {
        const npmPrefix = execSync('npm config get prefix', { 
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        if (npmPrefix) {
          possiblePaths.push(
            `${npmPrefix}/bin/claude`,
            `${npmPrefix}/lib/node_modules/@anthropic-ai/claude-code/bin/claude`,
            `${npmPrefix}/lib/node_modules/@anthropic-ai/claude-code/bin/claude.js`
          );
        }
      } catch (e) {
        console.log('无法获取 npm prefix');
      }
      
      // 方法2: 检查常见的安装位置
      possiblePaths.push(
        '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude',
        '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude',
        `${process.env.HOME}/.npm-global/lib/node_modules/@anthropic-ai/claude-code/bin/claude`,
        `${process.env.HOME}/Documents/claude code/node-v20.10.0-darwin-arm64/bin/claude`
      );
      
      // 检查每个可能的路径
      for (const claudePath of possiblePaths) {
        try {
          await fs.promises.access(claudePath, fs.constants.F_OK);
          console.log(`检查 Claude 路径: ${claudePath}`);
          
          // 尝试执行获取版本
          try {
            const version = execSync(`"${claudePath}" --version 2>&1`, {
              encoding: 'utf8',
              timeout: 5000
            }).trim();
            
            console.log(`找到 Claude CLI: ${claudePath}, 版本: ${version}`);
            result = {
              installed: true,
              command: 'claude',
              version: version,
              path: claudePath,
              displayName: 'Claude Code CLI'
            };
            break;
          } catch (e) {
            // 即使无法执行，文件存在也认为已安装
            console.log(`找到 Claude CLI 文件但无法执行: ${claudePath}`);
            result = {
              installed: true,
              command: 'claude',
              version: '已安装',
              path: claudePath,
              displayName: 'Claude Code CLI',
              note: '检测到文件但无法获取版本'
            };
            break;
          }
        } catch (e) {
          // 文件不存在，继续检查下一个
        }
      }
    }
    
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
    const startTime = Date.now();
    this.log('INFO', `开始检查命令: ${command}`, { versionArg });
    
    const { execSync } = require('child_process');
    const fs = require('fs');
    const TIMEOUT = 5000; // 统一超时设置
    
    try {
      // 先增强 PATH 环境
      await this.enhanceEnvironmentPath();
      
      let isInstalled = false;
      let commandPath = '';
      let version = '';
      let detectionMethod = '';
      
      const execOptions = {
        encoding: 'utf8',
        timeout: TIMEOUT,
        env: process.env
      };
      
      // 方法1: 直接使用 command -v 检测
      if (!isInstalled) {
        try {
          this.log('DEBUG', `尝试 command -v 检测 ${command}`);
          const testCmd = `command -v ${command}`;
          
          commandPath = execSync(testCmd, {
            ...execOptions,
            shell: '/bin/bash'
          }).trim();
          
          if (commandPath && commandPath !== '' && !commandPath.includes('not found')) {
            isInstalled = true;
            detectionMethod = 'command -v';
            this.log('INFO', `通过 command -v 找到 ${command}`, { path: commandPath });
          }
        } catch (e) {
          this.log('DEBUG', `command -v 检测失败`, { error: e.message });
        }
      }
      
      // 方法2: 尝试 which
      if (!isInstalled) {
        try {
          this.log('DEBUG', `尝试 which 检测 ${command}`);
          commandPath = execSync(`which ${command}`, {
            ...execOptions,
            stdio: ['pipe', 'pipe', 'ignore']
          }).trim();
          
          if (commandPath && commandPath !== '' && !commandPath.includes('not found')) {
            isInstalled = true;
            detectionMethod = 'which';
            this.log('INFO', `通过 which 找到 ${command}`, { path: commandPath });
          }
        } catch (e) {
          this.log('DEBUG', `which 检测失败`, { error: e.message });
        }
      }
      
      // 方法3: 直接尝试执行命令
      if (!isInstalled) {
        try {
          this.log('DEBUG', `尝试直接执行 ${command}`);
          const output = execSync(`${command} ${versionArg} 2>&1`, execOptions);
          const outputStr = output.trim();
          
          if (outputStr && !outputStr.toLowerCase().includes('command not found') &&
              !outputStr.toLowerCase().includes('not recognized')) {
            isInstalled = true;
            commandPath = command;
            version = outputStr.split('\n')[0];
            detectionMethod = 'direct execution';
            this.log('INFO', `直接执行找到 ${command}`, { version });
          }
        } catch (e) {
          this.log('DEBUG', `直接执行失败`, { error: e.message });
        }
      }
      
      // 方法4: 在常见路径中查找
      if (!isInstalled) {
        try {
          const pathsToCheck = await this.getSearchPaths(command);
          this.log('DEBUG', `在路径中搜索 ${command}`, { pathCount: pathsToCheck.length });
          
          for (const fullPath of pathsToCheck) {
            try {
              // 检查文件是否存在和可执行
              await fs.promises.access(fullPath, fs.constants.F_OK | fs.constants.X_OK);
              
              // 尝试获取版本
              try {
                const versionOutput = execSync(`"${fullPath}" ${versionArg} 2>&1`, execOptions).trim();
                
                if (versionOutput && !versionOutput.toLowerCase().includes('command not found')) {
                  isInstalled = true;
                  commandPath = fullPath;
                  version = versionOutput.split('\n')[0];
                  detectionMethod = 'path search';
                  this.log('INFO', `在路径中找到可执行的 ${command}`, { path: fullPath, version });
                  break;
                }
              } catch (execError) {
                // 尝试其他版本参数
                if (['node', 'npm', 'git'].includes(command)) {
                  const altVersionArgs = ['-v', 'version', '-version'];
                  for (const altArg of altVersionArgs) {
                    try {
                      const altOutput = execSync(`"${fullPath}" ${altArg} 2>&1`, execOptions).trim();
                      if (altOutput && !altOutput.toLowerCase().includes('command not found')) {
                        version = altOutput.split('\n')[0];
                        break;
                      }
                    } catch (e) {
                      // 继续尝试下一个参数
                    }
                  }
                }
                
                // 即使无法获取版本，文件存在且可执行也算已安装
                isInstalled = true;
                commandPath = fullPath;
                detectionMethod = 'path search (no version)';
                if (!version) {
                  version = '已安装（版本未知）';
                }
                this.log('INFO', `在路径中找到 ${command} 但无法获取版本`, { path: fullPath });
                break;
              }
            } catch (e) {
              // 文件不存在或不可执行，继续下一个
            }
          }
        } catch (e) {
          this.log('WARN', `路径搜索失败`, { error: e.message });
        }
      }
      
      // 检测失败的情况
      if (!isInstalled) {
        const errorMessages = {
          'claude': '未安装 Claude CLI。请运行: npm install -g @anthropic-ai/claude-code',
          'node': '未安装 Node.js。请访问 nodejs.org 安装',
          'git': '未安装 Git。请通过 Homebrew 或访问 git-scm.com 安装',
          'uv': '未安装 UV。这是可选依赖，用于 Python 包管理'
        };
        
        const errorMessage = errorMessages[command] || '未找到可执行文件';
        
        this.log('WARN', `未找到命令 ${command}`, {
          error: errorMessage,
          duration: Date.now() - startTime
        });
        
        return {
          installed: false,
          command: command,
          error: errorMessage
        };
      }

      // 获取版本信息（如果还没有获取到）
      if (!version) {
        try {
          const versionCommand = commandPath.includes('/') ? `"${commandPath}"` : command;
          const versionOutput = execSync(`${versionCommand} ${versionArg} 2>&1`, execOptions).trim();
          
          if (versionOutput) {
            version = versionOutput.split('\n')[0];
          }
        } catch (e) {
          // 对于关键命令，即使无法获取版本也认为已安装
          if (['node', 'claude', 'npm', 'git'].includes(command)) {
            version = '已安装';
          } else {
            version = '已安装（版本未知）';
          }
          this.log('WARN', `无法获取 ${command} 版本信息`, { error: e.message });
        }
      }

      const result = {
        installed: true,
        command: command,
        version: version || '已安装',
        path: commandPath,
        detectionMethod
      };
      
      this.log('INFO', `成功检测到命令 ${command}`, {
        ...result,
        duration: Date.now() - startTime
      });
      
      return result;
      
    } catch (error) {
      this.log('ERROR', `检查命令 ${command} 时出错`, {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });
      
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
    
    // 1. 获取 npm 全局路径（多种方法）
    try {
      // 方法1: npm config get prefix
      const npmPrefix = execSync('npm config get prefix', { 
        encoding: 'utf8',
        env: process.env
      }).trim();
      if (npmPrefix) {
        paths.push(`${npmPrefix}/bin/${command}`);
        // 检查 @anthropic-ai/claude-code 包的 bin 目录
        if (command === 'claude') {
          paths.push(`${npmPrefix}/lib/node_modules/@anthropic-ai/claude-code/bin/${command}`);
          paths.push(`${npmPrefix}/lib/node_modules/@anthropic-ai/claude-code/bin/claude.js`);
        }
      }
    } catch (e) {
      // 方法2: 尝试默认路径
      const defaultNpmPaths = [
        '/usr/local/lib/node_modules',
        '/opt/homebrew/lib/node_modules',
        `${process.env.HOME}/.npm-global/lib/node_modules`
      ];
      for (const npmPath of defaultNpmPaths) {
        if (command === 'claude') {
          paths.push(`${npmPath}/@anthropic-ai/claude-code/bin/${command}`);
          paths.push(`${npmPath}/@anthropic-ai/claude-code/bin/claude.js`);
        }
      }
    }
    
    // 2. 获取 Node.js 相关路径
    // 从进程中获取 Node.js 执行路径
    const nodeExecPath = process.execPath;
    if (nodeExecPath) {
      const nodeDir = path.dirname(nodeExecPath);
      paths.push(`${nodeDir}/${command}`);
      // 同时检查父目录的 bin
      const parentDir = path.dirname(nodeDir);
      paths.push(`${parentDir}/bin/${command}`);
    }
    
    // 3. 标准系统路径（扩展）
    const standardPaths = [
      `/usr/local/bin/${command}`,
      `/usr/bin/${command}`,
      `/bin/${command}`,
      `/usr/sbin/${command}`,
      `/sbin/${command}`,
      `/opt/homebrew/bin/${command}`,
      `/opt/homebrew/sbin/${command}`,
      `/usr/local/opt/${command}/bin/${command}`,
      `${process.env.HOME}/.npm-global/bin/${command}`,
      `${process.env.HOME}/.local/bin/${command}`,
      `${process.env.HOME}/.cargo/bin/${command}`,
      `${process.env.HOME}/bin/${command}`,
      `/Applications/Claude.app/Contents/Resources/bin/${command}`,
      `/Applications/Xcode.app/Contents/Developer/usr/bin/${command}`
    ];
    
    paths.push(...standardPaths);
    
    // 4. nvm 相关路径
    const nvmDir = process.env.NVM_DIR || `${process.env.HOME}/.nvm`;
    paths.push(`${nvmDir}/current/bin/${command}`);
    
    try {
      const fs = require('fs');
      const versionDirs = await fs.promises.readdir(`${nvmDir}/versions/node`).catch(() => []);
      for (const version of versionDirs) {
        paths.push(`${nvmDir}/versions/node/${version}/bin/${command}`);
      }
    } catch (e) {
      // nvm 不存在或无法访问
    }
    
    // 5. n (另一个 Node 版本管理器) 相关路径
    paths.push(`${process.env.HOME}/n/bin/${command}`);
    paths.push(`/usr/local/n/versions/node/*/bin/${command}`);
    
    // 6. 添加当前 PATH 中的所有路径
    if (process.env.PATH) {
      const pathDirs = process.env.PATH.split(':');
      for (const dir of pathDirs) {
        if (dir && dir.trim()) {
          paths.push(`${dir.trim()}/${command}`);
        }
      }
    }
    
    // 7. Homebrew 特定路径（Intel 和 Apple Silicon）
    if (process.platform === 'darwin') {
      // Homebrew 安装的 Node.js
      paths.push(`/usr/local/Cellar/node/*/bin/${command}`);
      paths.push(`/opt/homebrew/Cellar/node/*/bin/${command}`);
      
      // MacPorts
      paths.push(`/opt/local/bin/${command}`);
    }
    
    // 去重并返回
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
      `${process.env.HOME}/.cargo/bin`,
      `${process.env.HOME}/.nvm/current/bin`,
      `${process.env.HOME}/bin`
    );
    
    // 应用特定路径
    paths.push('/Applications/Claude.app/Contents/Resources/bin');
    
    // macOS 特定：获取 Homebrew 路径
    if (process.platform === 'darwin') {
      // Intel Mac
      paths.push('/usr/local/Homebrew/bin');
      // Apple Silicon Mac
      paths.push('/opt/homebrew/bin');
    }
    
    return [...new Set(paths)];
  }

  /**
   * 增强环境 PATH（专门为打包应用优化）
   */
  async enhanceEnvironmentPath() {
    const startTime = Date.now();
    this.log('INFO', '开始PATH环境增强', { platform: process.platform, originalPathLength: process.env.PATH?.split(':').length || 0 });
    
    try {
      const originalPath = process.env.PATH || '';
      let pathEnhanced = false;
      
      // 如果是 macOS 打包应用，PATH 可能被限制
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        const execOptions = { encoding: 'utf8', timeout: 3000 }; // 统一超时设置
        
        // 方法1: 使用 launchctl 获取用户环境变量
        if (!pathEnhanced) {
          try {
            this.log('DEBUG', '尝试通过 launchctl 获取 PATH');
            const userPath = execSync('launchctl getenv PATH', execOptions).trim();
            if (userPath && userPath !== 'PATH not set' && userPath.length > originalPath.length) {
              process.env.PATH = userPath;
              pathEnhanced = true;
              this.log('INFO', '通过 launchctl 成功获取到 PATH', { pathLength: userPath.split(':').length });
            }
          } catch (e) {
            this.log('WARN', 'launchctl 获取 PATH 失败', { error: e.message });
          }
        }
        
        // 方法2: 使用 path_helper
        if (!pathEnhanced && (!process.env.PATH || process.env.PATH.split(':').length < 5)) {
          try {
            this.log('DEBUG', '尝试通过 path_helper 获取 PATH');
            const systemPath = execSync('/usr/libexec/path_helper -s', {
              ...execOptions,
              shell: '/bin/bash'
            });
            const pathMatch = systemPath.match(/PATH="([^"]+)"/);
            if (pathMatch && pathMatch[1]) {
              process.env.PATH = pathMatch[1];
              pathEnhanced = true;
              this.log('INFO', '通过 path_helper 成功获取到 PATH', { pathLength: pathMatch[1].split(':').length });
            }
          } catch (e) {
            this.log('WARN', 'path_helper 获取 PATH 失败', { error: e.message });
          }
        }
        
        // 方法3: 手动构建完整 PATH（始终执行以确保包含所有必要路径）
        try {
          this.log('DEBUG', '开始手动构建 PATH');
          const dynamicPaths = await this.getDynamicPaths();
          const currentPaths = (process.env.PATH || '').split(':').filter(p => p && p.trim());
          const allPaths = [...new Set([...currentPaths, ...dynamicPaths])];
          
          // 确保 PATH 至少包含基本路径
          const minimalPaths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
          for (const minPath of minimalPaths) {
            if (!allPaths.includes(minPath)) {
              allPaths.push(minPath);
            }
          }
          
          process.env.PATH = allPaths.join(':');
          this.log('INFO', 'PATH 手动构建完成', {
            totalPaths: allPaths.length,
            addedPaths: allPaths.length - currentPaths.length
          });
        } catch (e) {
          this.log('ERROR', '手动构建 PATH 失败', { error: e.message });
        }
      }
      
      const endTime = Date.now();
      const finalPathLength = process.env.PATH?.split(':').length || 0;
      
      this.log('INFO', 'PATH环境增强完成', {
        duration: endTime - startTime,
        originalLength: originalPath.split(':').length,
        finalLength: finalPathLength,
        enhanced: pathEnhanced || finalPathLength > originalPath.split(':').length
      });
      
    } catch (error) {
      this.log('ERROR', 'PATH环境增强失败', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });
      
      // 确保至少有基本的 PATH
      if (!process.env.PATH || process.env.PATH.length < 20) {
        process.env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
        this.log('WARN', '设置了最小 PATH 作为回退');
      }
    }
  }
}

// 创建单例实例
const environmentService = new EnvironmentService();

// 导出单例和一些有用的方法
module.exports = environmentService;
module.exports.executeCommand = environmentService.executeCommand.bind(environmentService);