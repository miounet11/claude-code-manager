'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkCommand(command, versionFlag = '--version') {
  console.log(`正在检查: ${command} ${versionFlag}`);
  
  // Windows 平台特殊处理
  const isWindows = process.platform === 'win32';
  const cmdToRun = isWindows && !command.includes('.') ? `${command}.exe` : command;
  
  try {
    // 添加超时机制，最多等待 5 秒
    const { stdout } = await execPromise(`${cmdToRun} ${versionFlag}`, {
      timeout: 5000,
      killSignal: isWindows ? 'SIGTERM' : 'SIGKILL',
      shell: isWindows ? true : false,
      encoding: 'utf8'
    });
    
    console.log(`${command} 检查成功:`, stdout.trim());
    return {
      installed: true,
      version: stdout.trim().split('\n')[0]
    };
  } catch (error) {
    console.log(`${command} 检查失败:`, error.message);
    
    // 如果是超时错误，返回特定的错误信息
    if (error.killed || error.signal === 'SIGKILL') {
      console.log(`${command} 检查超时`);
      return {
        installed: false,
        version: null,
        error: '检查超时'
      };
    }
    
    // Windows 特殊错误处理
    if (isWindows && error.message.includes('is not recognized')) {
      return {
        installed: false,
        version: null,
        error: '未安装'
      };
    }
    
    // 处理其他 Windows 错误信息
    if (isWindows && (error.message.includes('�') || error.message.includes('?'))) {
      return {
        installed: false,
        version: null,
        error: '未安装'
      };
    }
    
    return {
      installed: false,
      version: null,
      error: error.message
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

module.exports = {
  checkEnvironment,
  checkNodejs,
  checkGit,
  checkUV,
  checkClaudeCode
};