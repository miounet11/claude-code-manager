'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkCommand(command, versionFlag = '--version') {
  console.log(`正在检查: ${command} ${versionFlag}`);
  
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
  
  // 尝试多种策略检测
  for (const strategy of checkStrategies) {
    try {
      // Windows下使用更合适的选项
      const execOptions = {
        timeout: 5000, // 减少超时时间，更快尝试下一个策略
        killSignal: 'SIGTERM',
        encoding: 'utf8',
        windowsHide: true, // Windows下隐藏窗口
        maxBuffer: 1024 * 1024 // 1MB 缓冲区
      };
      
      // Windows下强制使用shell
      if (isWindows) {
        execOptions.shell = true;
        execOptions.env = { ...process.env, LANG: 'en_US.UTF-8' }; // 设置环境变量避免编码问题
      }
      
      console.log(`尝试执行: ${strategy} ${versionFlag}`);
      // 只有在路径包含空格时才使用引号
      const commandToRun = strategy.includes(' ') ? `"${strategy}" ${versionFlag}` : `${strategy} ${versionFlag}`;
      const { stdout, stderr } = await execPromise(commandToRun, execOptions);
      
      const output = stdout || stderr || '';
      
      // 过滤掉错误信息，只保留版本信息
      if (output && !output.toLowerCase().includes('not found') && !output.toLowerCase().includes('not recognized')) {
        console.log(`${command} 检查成功 (使用 ${strategy}):`, output.trim());
        
        return {
          installed: true,
          version: output.trim().split('\n')[0] || '已安装'
        };
      }
    } catch (error) {
      console.log(`策略 ${strategy} 失败:`, error.code || error.message);
      // 继续尝试下一个策略
    }
  }
  
  // 所有策略都失败了，使用 which/where 命令最后检测
  try {
    const findCmd = isWindows ? 'where' : 'which';
    const { stdout } = await execPromise(`${findCmd} ${command}`, {
      timeout: 3000,
      encoding: 'utf8',
      windowsHide: true,
      shell: isWindows
    });
    
    if (stdout && stdout.trim()) {
      console.log(`通过 ${findCmd} 找到 ${command}: ${stdout.trim()}`);
      // 找到了命令，但无法获取版本，仍然返回已安装
      return {
        installed: true,
        version: '已安装（版本未知）'
      };
    }
  } catch (findError) {
    console.log(`${findCmd} ${command} 也失败了:`, findError.message);
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
  checkEnvironment,
  checkNodejs,
  checkGit,
  checkUV,
  checkClaudeCode,
  checkAdminPrivileges
};