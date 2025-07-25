'use strict';

/**
 * 调试环境检测
 */
async function debugEnvironmentCheck() {
  console.group('🔍 环境检测调试');
  
  try {
    // 1. 检查 Node.js
    console.log('正在检查 Node.js...');
    const nodeResult = await testCommand('node', '--version');
    console.log('Node.js 结果:', nodeResult);
    
    // 2. 检查 npm
    console.log('正在检查 npm...');
    const npmResult = await testCommand('npm', '--version');
    console.log('npm 结果:', npmResult);
    
    // 3. 检查 Claude
    console.log('正在检查 Claude...');
    const claudeResult = await testCommand('claude', '--version');
    console.log('Claude 结果:', claudeResult);
    
    // 4. 检查常见路径
    console.log('检查常见路径...');
    const paths = [
      '/usr/local/bin/node',
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/node',
      '/opt/homebrew/bin/claude',
      `${process.env.HOME}/.npm-global/bin/claude`
    ];
    
    for (const path of paths) {
      const exists = await checkFileExists(path);
      console.log(`${path}: ${exists ? '存在' : '不存在'}`);
    }
    
    // 5. 显示 PATH 环境变量
    console.log('PATH:', process.env.PATH);
    
  } catch (error) {
    console.error('调试检测出错:', error);
  }
  
  console.groupEnd();
}

async function testCommand(command, args) {
  try {
    const result = await window.electronAPI.executeCommand(`${command} ${args}`);
    return result;
  } catch (error) {
    return { error: error.message };
  }
}

async function checkFileExists(path) {
  try {
    const result = await window.electronAPI.executeCommand(`test -f "${path}" && echo "exists"`);
    return result.stdout && result.stdout.includes('exists');
  } catch (error) {
    return false;
  }
}

// 导出函数
window.debugEnvironmentCheck = debugEnvironmentCheck;