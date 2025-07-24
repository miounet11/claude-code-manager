'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkCommand(command, versionFlag = '--version') {
  console.log(`正在检查: ${command} ${versionFlag}`);
  
  // Windows 平台特殊处理
  const isWindows = process.platform === 'win32';
  let cmdToRun = command;
  
  // Windows下更智能的命令检测
  if (isWindows) {
    // 首先尝试原命令
    cmdToRun = command;
    // 如果命令没有扩展名，尝试添加.exe
    if (!command.includes('.') && !command.includes('\\') && !command.includes('/')) {
      // 对于特定命令的特殊处理
      if (command === 'claude') {
        cmdToRun = 'claude.exe';
      } else if (command === 'uv') {
        cmdToRun = 'uv.exe';
      } else {
        cmdToRun = `${command}.exe`;
      }
    }
  }
  
  try {
    // Windows下使用更合适的选项
    const execOptions = {
      timeout: 10000, // 增加超时时间到10秒
      killSignal: 'SIGTERM',
      encoding: 'utf8',
      windowsHide: true // Windows下隐藏窗口
    };
    
    // Windows下强制使用shell
    if (isWindows) {
      execOptions.shell = true;
      execOptions.env = { ...process.env, LANG: 'en_US.UTF-8' }; // 设置环境变量避免编码问题
    }
    
    console.log(`执行命令: ${cmdToRun} ${versionFlag}`);
    const { stdout, stderr } = await execPromise(`${cmdToRun} ${versionFlag}`, execOptions);
    
    const output = stdout || stderr || '';
    console.log(`${command} 检查成功:`, output.trim());
    
    return {
      installed: true,
      version: output.trim().split('\n')[0] || '已安装'
    };
  } catch (error) {
    console.log(`${command} 检查失败:`, error.message);
    
    // 如果是超时错误，返回特定的错误信息
    if (error.killed || error.signal === 'SIGTERM' || error.code === 'ETIMEDOUT') {
      console.log(`${command} 检查超时`);
      return {
        installed: false,
        version: null,
        error: '检查超时，可能需要管理员权限'
      };
    }
    
    // Windows 特殊错误处理
    if (isWindows) {
      if (error.message.includes('is not recognized') ||
          error.message.includes('not found') ||
          error.code === 'ENOENT') {
        return {
          installed: false,
          version: null,
          error: '未安装'
        };
      }
      
      // 处理权限问题
      if (error.message.includes('Access is denied') ||
          error.message.includes('权限不足') ||
          error.code === 'EACCES') {
        return {
          installed: false,
          version: null,
          error: '权限不足，请以管理员身份运行'
        };
      }
      
      // 处理编码问题
      if (error.message.includes('�') || error.message.includes('?')) {
        return {
          installed: false,
          version: null,
          error: '未安装'
        };
      }
    }
    
    return {
      installed: false,
      version: null,
      error: error.code || error.message || '检查失败'
    };
  }
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