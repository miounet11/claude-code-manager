'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkCommand(command, versionFlag = '--version') {
  console.log(`[Environment] 正在检查: ${command} ${versionFlag}`);
  console.log(`[Environment] Original PATH: ${process.env.PATH}`);
  console.log(`[Environment] Platform: ${process.platform}`);
  
  // 修复 macOS 上的 PATH 问题
  if (process.platform === 'darwin' && !process.env.PATH.includes('/usr/local/bin')) {
    const pathAdditions = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      `${process.env.HOME}/.npm-global/bin`
    ];
    
    const currentPath = process.env.PATH || '';
    const newPath = [...pathAdditions, ...currentPath.split(':')].filter(Boolean).join(':');
    process.env.PATH = newPath;
    console.log(`[Environment] Fixed PATH: ${process.env.PATH}`);
  }
  
  // Windows 平台特殊处理
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  let cmdToRun = command;
  
  // 尝试多种检测方式
  const checkStrategies = [];
  
  if (isWindows) {
    // Windows 检测策略
    if (command === 'claude') {
      checkStrategies.push('claude.exe', 'claude', 'claude.cmd', 'claude.bat');
      // 添加常见的 npm 全局安装路径
      checkStrategies.push(
        `${process.env.APPDATA}\\npm\\claude.cmd`,
        `${process.env.APPDATA}\\npm\\claude.exe`,
        `${process.env.ProgramFiles}\\nodejs\\claude.cmd`
      );
    } else if (command === 'uv') {
      checkStrategies.push('uv.exe', 'uv', 'uv.cmd', 'uv.bat');
      // UV 可能安装在用户目录
      checkStrategies.push(
        `${process.env.USERPROFILE}\\.cargo\\bin\\uv.exe`,
        `${process.env.LOCALAPPDATA}\\uv\\bin\\uv.exe`
      );
    } else if (command === 'node') {
      checkStrategies.push('node.exe', 'node');
      // Node.js 常见安装路径
      checkStrategies.push(
        `${process.env.ProgramFiles}\\nodejs\\node.exe`,
        `${process.env.ProgramFiles(x86)}\\nodejs\\node.exe`
      );
    } else if (command === 'git') {
      checkStrategies.push('git.exe', 'git');
      // Git 常见安装路径
      checkStrategies.push(
        `${process.env.ProgramFiles}\\Git\\bin\\git.exe`,
        `${process.env.ProgramFiles(x86)}\\Git\\bin\\git.exe`,
        `${process.env.ProgramFiles}\\Git\\cmd\\git.exe`
      );
    } else {
      checkStrategies.push(`${command}.exe`, command);
    }
  } else {
    // macOS/Linux 检测策略
    checkStrategies.push(command);
    
    // Claude 特定路径
    if (command === 'claude') {
      checkStrategies.push(
        `/usr/local/bin/${command}`,
        `${process.env.HOME}/.npm-global/bin/${command}`,
        `${process.env.HOME}/.npm/bin/${command}`,
        `/usr/local/lib/node_modules/.bin/${command}`,
        `/opt/homebrew/bin/${command}`,
        `/usr/bin/${command}`,
        `${process.env.HOME}/.local/bin/${command}`,
        // npm 全局安装的常见位置
        `/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/${command}`,
        `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/${command}`
      );
    } else if (command === 'uv') {
      checkStrategies.push(
        `/usr/local/bin/${command}`,
        `${process.env.HOME}/.npm-global/bin/${command}`,
        `${process.env.HOME}/.npm/bin/${command}`,
        `${process.env.HOME}/.yarn/bin/${command}`,
        `/opt/homebrew/bin/${command}`,
        `/usr/bin/${command}`,
        `${process.env.HOME}/.local/bin/${command}`,
        `${process.env.HOME}/.cargo/bin/${command}`
      );
    }
  }
  
  console.log(`[Environment] 尝试 ${checkStrategies.length} 个策略检测 ${command}`);
  
  // 尝试多种策略检测
  for (const strategy of checkStrategies) {
    try {
      // Windows下使用更合适的选项
      const execOptions = {
        timeout: 5000, // 减少超时时间，更快尝试下一个策略
        killSignal: 'SIGTERM',
        encoding: 'utf8',
        windowsHide: true, // Windows下隐藏窗口
        maxBuffer: 1024 * 1024, // 1MB 缓冲区
        env: { ...process.env } // 确保传递完整的环境变量
      };
      
      // 在 macOS 和 Windows 下都使用 shell，确保环境变量正确加载
      if (isWindows || isMac) {
        execOptions.shell = true;
        execOptions.env.LANG = 'en_US.UTF-8'; // 设置环境变量避免编码问题
      }
      
      console.log(`[Environment] 尝试执行: ${strategy} ${versionFlag}`);
      
      // 只有在路径包含空格时才使用引号
      const commandToRun = strategy.includes(' ') ? `"${strategy}" ${versionFlag}` : `${strategy} ${versionFlag}`;
      console.log(`[Environment] 完整命令: ${commandToRun}`);
      
      const { stdout, stderr } = await execPromise(commandToRun, execOptions);
      
      const output = stdout || stderr || '';
      console.log(`[Environment] 命令输出: stdout="${stdout}", stderr="${stderr}"`);
      
      // 过滤掉错误信息，只保留版本信息
      if (output && !output.toLowerCase().includes('not found') && !output.toLowerCase().includes('not recognized')) {
        console.log(`[Environment] ${command} 检查成功 (使用 ${strategy}):`, output.trim());
        
        return {
          installed: true,
          version: output.trim().split('\n')[0] || '已安装'
        };
      } else {
        console.log(`[Environment] 输出包含错误信息，继续下一个策略`);
      }
    } catch (error) {
      console.log(`[Environment] 策略 ${strategy} 失败:`, {
        code: error.code,
        message: error.message,
        cmd: error.cmd,
        killed: error.killed,
        signal: error.signal
      });
      // 继续尝试下一个策略
    }
  }
  
  // 所有策略都失败了，使用 which/where 命令最后检测
  console.log(`[Environment] 所有策略都失败，尝试使用 which/where 命令`);
  try {
    const findCmd = isWindows ? 'where' : 'which';
    const findOptions = {
      timeout: 3000,
      encoding: 'utf8',
      windowsHide: true,
      shell: true, // 所有平台都使用 shell
      env: { ...process.env }
    };
    
    console.log(`[Environment] 执行: ${findCmd} ${command}`);
    const { stdout, stderr } = await execPromise(`${findCmd} ${command}`, findOptions);
    
    console.log(`[Environment] ${findCmd} 输出: stdout="${stdout}", stderr="${stderr}"`);
    
    if (stdout && stdout.trim()) {
      console.log(`[Environment] 通过 ${findCmd} 找到 ${command}: ${stdout.trim()}`);
      // 找到了命令，但无法获取版本，仍然返回已安装
      return {
        installed: true,
        version: '已安装（版本未知）'
      };
    }
  } catch (findError) {
    console.log(`[Environment] ${isWindows ? 'where' : 'which'} ${command} 也失败了:`, {
      code: findError.code,
      message: findError.message
    });
  }
  
  // 所有方法都失败了，返回未安装
  console.log(`${command} 所有检测方法都失败，判定为未安装`);
  return {
    installed: false,
    version: null,
    error: '未安装'
  };
}

async function checkEnvironment() {
  console.log('开始环境检查...');
  
  const checks = {};
  
  console.log('检查 Node.js...');
  checks.nodejs = await checkNodejs();
  
  console.log('检查 Git...');
  checks.git = await checkGit();
  
  console.log('检查 UV...');
  checks.uv = await checkUV();
  
  console.log('检查 Claude Code...');
  checks.claude = await checkClaudeCode();
  
  
  console.log('环境检查完成:', checks);
  return checks;
}

async function checkNodejs() {
  // 尝试直接执行常见路径
  const nodePaths = [
    'node',
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    '/usr/bin/node',
    `${process.env.HOME}/.nvm/versions/node/*/bin/node` // NVM
  ];
  
  for (const nodePath of nodePaths) {
    try {
      const { stdout } = await execPromise(`${nodePath} -v`, {
        timeout: 2000,
        encoding: 'utf8',
        shell: true
      });
      
      if (stdout && stdout.startsWith('v')) {
        const version = stdout.trim().replace('v', '');
        const major = parseInt(version.split('.')[0]);
        return {
          installed: true,
          version: stdout.trim(),
          compatible: major >= 16
        };
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }
  
  // 如果都失败了，使用原来的方法
  const result = await checkCommand('node', '-v');
  if (result.installed) {
    const version = result.version.replace('v', '');
    const major = parseInt(version.split('.')[0]);
    result.compatible = major >= 16;
  }
  return result;
}

async function checkGit() {
  const result = await checkCommand('git', '--version');
  if (result.installed) {
    result.version = result.version.replace('git version ', '');
  }
  return result;
}

async function checkUV() {
  return await checkCommand('uv', '--version');
}

async function checkClaudeCode() {
  // 尝试直接执行常见路径
  const claudePaths = [
    'claude',
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    `${process.env.HOME}/.npm-global/bin/claude`,
    `${process.env.HOME}/.npm/bin/claude`,
    '/usr/local/lib/node_modules/.bin/claude',
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude'
  ];
  
  for (const claudePath of claudePaths) {
    try {
      const { stdout, stderr } = await execPromise(`${claudePath} --version`, {
        timeout: 2000,
        encoding: 'utf8',
        shell: true
      });
      
      const output = stdout || stderr || '';
      if (output && !output.toLowerCase().includes('not found')) {
        console.log(`[Environment] 找到 Claude: ${claudePath}`);
        return {
          installed: true,
          version: output.trim().split('\n')[0] || '已安装'
        };
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }
  
  // 如果都失败了，使用原来的方法
  return await checkCommand('claude', '--version');
}

async function checkAdminPrivileges() {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';
  
  try {
    if (isWindows) {
      // Windows - 检查是否以管理员身份运行
      return new Promise((resolve) => {
        exec('net session >nul 2>&1', (error) => {
          if (error) {
            resolve({
              installed: false,
              version: '未授权',
              error: '需要管理员权限'
            });
          } else {
            resolve({
              installed: true,
              version: '已授权'
            });
          }
        });
      });
    } else if (isMac || isLinux) {
      // macOS/Linux - 检查是否可以执行需要权限的操作
      return new Promise((resolve) => {
        exec('sudo -n true 2>&1', (error, stdout, stderr) => {
          if (error || stderr) {
            resolve({
              installed: false,
              version: '未授权',
              error: '需要管理员权限'
            });
          } else {
            resolve({
              installed: true,
              version: '已授权'
            });
          }
        });
      });
    }
  } catch (error) {
    return {
      installed: false,
      version: '未授权',
      error: error.message
    };
  }
}

module.exports = {
  checkCommand,
  checkEnvironment,
  checkNodejs,
  checkGit,
  checkUV,
  checkClaudeCode,
  checkAdminPrivileges
};