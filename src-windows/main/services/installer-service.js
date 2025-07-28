'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * Windows 安装服务
 * 负责安装依赖和软件包
 */
class InstallerService extends EventEmitter {
  constructor() {
    super();
    this.isInstalling = false;
    this.installProcess = null;
  }

  /**
   * 安装 Claude CLI (Windows 版本)
   */
  async installClaude() {
    if (this.isInstalling) {
      throw new Error('已有安装任务正在进行中');
    }

    this.isInstalling = true;
    this.emit('install-start', { package: '@anthropic-ai/claude-code' });
    
    try {
      // 1. 检查 npm 是否可用
      console.log('检查 npm 是否可用...');
      try {
        execSync('npm --version', { windowsHide: true });
      } catch (e) {
        throw new Error('未找到 npm，请先安装 Node.js');
      }
      
      // 2. 获取 npm 全局路径
      const npmPrefix = execSync('npm config get prefix', { 
        encoding: 'utf8',
        windowsHide: true 
      }).trim();
      
      console.log('NPM 全局路径:', npmPrefix);
      
      // 3. 执行安装 - 使用正确的包名
      const result = await this.executeCommand('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
        timeout: 180000, // 3分钟
        env: {
          ...process.env,
          PATH: `${npmPrefix};${npmPrefix}\\node_modules\\.bin;${process.env.PATH || ''}`,
          npm_config_unsafe_perm: 'true'
        }
      });
      
      if (result.success) {
        this.emit('install-success', {
          package: '@anthropic-ai/claude-code',
          message: 'Claude CLI 安装成功'
        });
        
        // 4. 验证安装
        await this.verifyClaude();
        
        return { 
          success: true, 
          message: 'Claude CLI 安装成功！',
          details: {
            npmPrefix,
            claudePath: await this.findClaudePath()
          }
        };
      } else {
        throw new Error(result.error || '安装失败');
      }
      
    } catch (error) {
      console.error('安装 Claude CLI 失败:', error);
      this.emit('install-error', {
        package: '@anthropic-ai/claude-code',
        error: error.message
      });
      
      // 提供故障排除建议
      const troubleshooting = this.getTroubleshootingAdvice(error);
      
      return {
        success: false,
        error: error.message,
        troubleshooting
      };
    } finally {
      this.isInstalling = false;
    }
  }
  
  /**
   * 验证 Claude 安装
   */
  async verifyClaude() {
    try {
      const claudePath = await this.findClaudePath();
      
      if (!claudePath) {
        // 尝试直接执行
        execSync('claude --version', { 
          timeout: 5000,
          windowsHide: true 
        });
        console.log('Claude CLI 验证成功（通过命令）');
        return true;
      }
      
      // 使用找到的路径验证
      execSync(`"${claudePath}" --version`, { 
        timeout: 5000,
        windowsHide: true 
      });
      console.log('Claude CLI 验证成功，路径:', claudePath);
      return true;
      
    } catch (error) {
      console.error('Claude CLI 验证失败:', error);
      
      // 检查 PATH 环境变量
      const paths = this.getEnvironmentPaths();
      console.log('\n需要检查的路径:');
      paths.forEach(p => console.log(' -', p));
      
      throw new Error('Claude CLI 安装后无法验证，可能需要重启应用或手动配置 PATH');
    }
  }
  
  /**
   * 查找 Claude CLI 路径 (Windows 版本)
   */
  async findClaudePath() {
    const fs = require('fs').promises;
    const possiblePaths = [];
    
    try {
      // 1. 通过 where 命令查找
      try {
        const claudePath = execSync('where claude', {
          encoding: 'utf8',
          windowsHide: true
        }).split('\n')[0].trim();
        
        if (claudePath) {
          return claudePath;
        }
      } catch (e) {
        // where 命令失败，继续其他方法
      }
      
      // 2. 获取 npm 全局路径
      const npmPrefix = execSync('npm config get prefix', {
        encoding: 'utf8',
        windowsHide: true
      }).trim();
      
      if (npmPrefix) {
        possiblePaths.push(
          path.join(npmPrefix, 'claude.cmd'),
          path.join(npmPrefix, 'claude.exe'),
          path.join(npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.cmd')
        );
      }
      
      // 3. AppData 路径
      const appDataNpm = path.join(process.env.APPDATA || '', 'npm');
      possiblePaths.push(
        path.join(appDataNpm, 'claude.cmd'),
        path.join(appDataNpm, 'claude.exe')
      );
      
      // 4. 标准 Node.js 路径
      possiblePaths.push(
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'claude.cmd'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'claude.cmd'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'claude.cmd')
      );
      
      // 5. 尝试所有路径
      for (const claudePath of possiblePaths) {
        try {
          await fs.access(claudePath, fs.constants.F_OK);
          return claudePath;
        } catch (e) {
          // 继续下一个
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('查找 Claude 路径时出错:', error);
      return null;
    }
  }
  
  /**
   * 获取环境路径
   */
  getEnvironmentPaths() {
    const paths = [];
    
    try {
      const npmPrefix = execSync('npm config get prefix', {
        encoding: 'utf8',
        windowsHide: true
      }).trim();
      
      if (npmPrefix) {
        paths.push(npmPrefix);
      }
    } catch (e) {
      // 忽略
    }
    
    const appDataNpm = path.join(process.env.APPDATA || '', 'npm');
    paths.push(appDataNpm);
    
    return paths;
  }
  
  /**
   * 执行命令
   */
  executeCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = options.timeout || 60000;
      
      console.log(`执行命令: ${command} ${args.join(' ')}`);
      
      const child = spawn('cmd.exe', ['/c', command, ...args], {
        env: options.env || process.env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.installProcess = child;
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      
      // 设置超时
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.emit('install-output', { type: 'stdout', data: output });
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.emit('install-output', { type: 'stderr', data: output });
      });
      
      child.on('error', (error) => {
        clearTimeout(timer);
        this.installProcess = null;
        resolve({
          success: false,
          error: error.message,
          stdout,
          stderr
        });
      });
      
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        this.installProcess = null;
        
        const duration = Date.now() - startTime;
        console.log(`命令执行完成，耗时: ${duration}ms`);
        
        if (timedOut) {
          resolve({
            success: false,
            error: '命令执行超时',
            stdout,
            stderr,
            code,
            signal
          });
        } else {
          resolve({
            success: code === 0,
            error: code !== 0 ? `命令返回错误代码: ${code}` : null,
            stdout,
            stderr,
            code,
            signal
          });
        }
      });
    });
  }
  
  /**
   * 获取故障排除建议
   */
  getTroubleshootingAdvice(error) {
    const advice = [];
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('npm')) {
      advice.push('确保 Node.js 和 npm 已正确安装');
      advice.push('尝试在管理员权限下运行');
    }
    
    if (errorMsg.includes('permission') || errorMsg.includes('access')) {
      advice.push('尝试以管理员身份运行应用程序');
      advice.push('检查防病毒软件是否阻止了安装');
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
      advice.push('检查网络连接');
      advice.push('如果使用代理，请配置 npm 代理设置');
      advice.push('尝试使用镜像源：npm config set registry https://registry.npmmirror.com');
    }
    
    if (errorMsg.includes('path')) {
      advice.push('确保 npm 全局安装路径已添加到系统 PATH 环境变量');
      advice.push('可能需要重启电脑以使 PATH 更改生效');
    }
    
    // 通用建议
    advice.push('尝试手动安装：npm install -g @anthropic-ai/claude-code');
    advice.push('查看详细日志：npm install -g @anthropic-ai/claude-code --verbose');
    
    return advice;
  }
  
  /**
   * 取消安装
   */
  cancelInstall() {
    if (this.installProcess) {
      console.log('取消安装任务...');
      
      // Windows 下使用 taskkill
      try {
        if (this.installProcess.pid) {
          execSync(`taskkill /pid ${this.installProcess.pid} /f /t`, { 
            windowsHide: true 
          });
        }
      } catch (e) {
        console.error('使用 taskkill 终止进程失败:', e);
        // 尝试常规方法
        this.installProcess.kill('SIGTERM');
      }
      
      this.installProcess = null;
      this.isInstalling = false;
      
      this.emit('install-cancelled');
      
      return { success: true, message: '安装已取消' };
    }
    
    return { success: false, message: '没有正在进行的安装任务' };
  }
  
  /**
   * 获取安装状态
   */
  getInstallStatus() {
    return {
      isInstalling: this.isInstalling,
      hasActiveProcess: !!this.installProcess
    };
  }
}

// 导出单例
module.exports = new InstallerService();