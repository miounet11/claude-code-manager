'use strict';

const { executeCommand } = require('./services/environment-service');

// 调试模式
let DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[INSTALLER-V2]', ...args);
  }
}

/**
 * 安装结果
 */
class InstallResult {
  constructor(success, message, details = {}) {
    this.success = success;
    this.message = message;
    this.details = details;
    this.logs = [];
  }
  
  addLog(log) {
    this.logs.push(log);
  }
}

/**
 * 安装 Node.js
 */
async function installNodejs() {
  debug('安装 Node.js...');
  
  const result = new InstallResult(false, 'Node.js 需要手动安装');
  
  result.details.instructions = [
    '请访问 https://nodejs.org 下载并安装 Node.js',
    '',
    'macOS 用户也可以使用 Homebrew:',
    '  brew install node',
    '',
    'Windows 用户请下载安装包并确保勾选 "Add to PATH"',
    '',
    '安装完成后请重启应用程序'
  ];
  
  result.details.downloadUrl = 'https://nodejs.org';
  
  return result;
}

/**
 * 安装 Git
 */
async function installGit() {
  debug('安装 Git...');
  
  const result = new InstallResult(false, 'Git 需要手动安装');
  
  const platform = process.platform;
  
  if (platform === 'darwin') {
    result.details.instructions = [
      'macOS 通常已预装 Git，如果没有：',
      '',
      '方法 1: 安装 Xcode Command Line Tools',
      '  xcode-select --install',
      '',
      '方法 2: 使用 Homebrew',
      '  brew install git'
    ];
  } else if (platform === 'win32') {
    result.details.instructions = [
      '请访问 https://git-scm.com/download/win',
      '下载并安装 Git for Windows',
      '',
      '安装时请确保：',
      '- 选择 "Git from the command line and also from 3rd-party software"',
      '- 其他选项保持默认即可'
    ];
    result.details.downloadUrl = 'https://git-scm.com/download/win';
  } else {
    result.details.instructions = [
      'Linux 用户请使用包管理器安装：',
      '',
      'Ubuntu/Debian:',
      '  sudo apt update',
      '  sudo apt install git',
      '',
      'CentOS/RHEL:',
      '  sudo yum install git',
      '',
      'Arch:',
      '  sudo pacman -S git'
    ];
  }
  
  return result;
}

/**
 * 安装 UV
 */
async function installUV() {
  debug('安装 UV...');
  
  const result = new InstallResult(false, '正在安装 UV...');
  
  // 方法 1: 使用 npm
  try {
    result.addLog('尝试使用 npm 安装 UV...');
    
    const npmResult = await executeCommand('npm', ['install', '-g', 'uv'], {
      timeout: 120000 // 2分钟
    });
    
    if (npmResult.success) {
      result.success = true;
      result.message = 'UV 安装成功！';
      result.addLog('UV 通过 npm 安装成功');
      return result;
    } else {
      result.addLog(`npm 安装失败: ${npmResult.error}`);
    }
  } catch (error) {
    result.addLog(`npm 安装异常: ${error.message}`);
  }
  
  // 方法 2: 使用官方脚本
  const platform = process.platform;
  
  if (platform === 'darwin' || platform === 'linux') {
    try {
      result.addLog('尝试使用官方脚本安装...');
      
      const scriptResult = await executeCommand('/bin/bash', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], {
        timeout: 120000
      });
      
      if (scriptResult.success) {
        result.success = true;
        result.message = 'UV 通过官方脚本安装成功！';
        result.addLog('请重启应用以使环境变量生效');
        
        // 添加 PATH 提示
        result.details.postInstall = [
          'UV 已安装到 ~/.cargo/bin/uv',
          '请确保 ~/.cargo/bin 在您的 PATH 中'
        ];
        
        return result;
      } else {
        result.addLog(`官方脚本安装失败: ${scriptResult.error}`);
      }
    } catch (error) {
      result.addLog(`官方脚本异常: ${error.message}`);
    }
  }
  
  // 安装失败，提供手动安装说明
  result.message = 'UV 自动安装失败，请手动安装';
  result.details.instructions = [
    '方法 1: 使用 npm（推荐）',
    '  npm install -g uv',
    '',
    '方法 2: 使用官方安装脚本',
    'macOS/Linux:',
    '  curl -LsSf https://astral.sh/uv/install.sh | sh',
    '',
    'Windows:',
    '  powershell -c "irm https://astral.sh/uv/install.ps1 | iex"',
    '',
    '详情请访问: https://github.com/astral-sh/uv'
  ];
  
  return result;
}

/**
 * 安装 Claude Code
 */
async function installClaudeCode() {
  debug('安装 Claude Code...');
  
  const result = new InstallResult(false, '正在安装 Claude Code...');
  
  // 检查 npm 是否可用
  try {
    const npmCheck = await executeCommand('npm', ['--version'], { timeout: 5000 });
    if (!npmCheck.success) {
      result.message = '需要先安装 Node.js 和 npm';
      result.details.error = 'npm 命令不可用';
      result.details.instructions = [
        '请先安装 Node.js（会自带 npm）',
        '访问 https://nodejs.org 下载安装'
      ];
      return result;
    }
  } catch (error) {
    result.message = '无法检测 npm';
    result.details.error = error.message;
    return result;
  }
  
  // 尝试全局安装
  try {
    result.addLog('执行: npm install -g @anthropic-ai/claude-code');
    
    const installResult = await executeCommand('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
      timeout: 180000 // 3分钟
    });
    
    result.addLog(`输出: ${installResult.stdout}`);
    if (installResult.stderr) {
      result.addLog(`警告: ${installResult.stderr}`);
    }
    
    if (installResult.success) {
      // 验证安装
      const verifyResult = await executeCommand('claude', ['--version'], { timeout: 5000 });
      
      if (verifyResult.success) {
        result.success = true;
        result.message = 'Claude Code 安装成功！';
        result.details.version = verifyResult.stdout;
        return result;
      } else {
        result.success = true;
        result.message = 'Claude Code 已安装，请重启应用以刷新环境变量';
        result.details.needsRestart = true;
        return result;
      }
    } else {
      result.addLog(`安装失败: ${installResult.error}`);
      
      // 检查是否是权限问题
      if (installResult.error && (installResult.error.includes('EACCES') || installResult.error.includes('permission'))) {
        result.message = '安装失败：权限不足';
        result.details.instructions = [
          '请尝试以下方法：',
          '',
          '方法 1: 使用 sudo（macOS/Linux）',
          '  sudo npm install -g @anthropic-ai/claude-code',
          '',
          '方法 2: 修改 npm 全局目录',
          '  mkdir ~/.npm-global',
          '  npm config set prefix "~/.npm-global"',
          '  export PATH=~/.npm-global/bin:$PATH',
          '  npm install -g @anthropic-ai/claude-code',
          '',
          '方法 3: 使用 npx（无需全局安装）',
          '  npx @anthropic-ai/claude-code'
        ];
      } else {
        result.message = '安装失败';
        result.details.instructions = [
          '请手动运行以下命令：',
          '  npm install -g @anthropic-ai/claude-code',
          '',
          '如果失败，请检查：',
          '1. 网络连接是否正常',
          '2. npm 镜像源是否可访问',
          '3. 是否有权限写入全局 node_modules'
        ];
      }
    }
  } catch (error) {
    result.message = `安装过程出错: ${error.message}`;
    result.addLog(`异常: ${error.stack}`);
  }
  
  return result;
}

/**
 * 根据依赖名称调用对应的安装函数
 */
async function installDependency(dependency) {
  debug(`安装依赖: ${dependency}`);
  
  switch (dependency) {
  case 'nodejs':
    return await installNodejs();
      
  case 'git':
    return await installGit();
      
  case 'uv':
    return await installUV();
      
  case 'claude':
    return await installClaudeCode();
      
  default:
    return new InstallResult(false, `未知的依赖: ${dependency}`);
  }
}

/**
 * 批量安装依赖
 */
async function installMultipleDependencies(dependencies, progressCallback) {
  const results = {};
  
  for (const dep of dependencies) {
    if (progressCallback) {
      progressCallback({
        current: dep,
        status: 'installing',
        message: `正在安装 ${dep}...`
      });
    }
    
    const result = await installDependency(dep);
    results[dep] = result;
    
    if (progressCallback) {
      progressCallback({
        current: dep,
        status: result.success ? 'success' : 'failed',
        message: result.message,
        result
      });
    }
  }
  
  return results;
}

module.exports = {
  installNodejs,
  installGit,
  installUV,
  installClaudeCode,
  installDependency,
  installMultipleDependencies,
  setDebugMode: (enabled) => { DEBUG_MODE = enabled; }
};