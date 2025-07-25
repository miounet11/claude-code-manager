'use strict';

const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

// 全局调试模式
let DEBUG_MODE = true;

/**
 * 设置调试模式
 */
function setDebugMode(enabled) {
  DEBUG_MODE = enabled;
}

/**
 * 调试日志
 */
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[ENV-V2]', ...args);
  }
}

/**
 * 执行命令的改进版本
 * 使用 spawn 代替 exec，更好地处理环境变量
 */
function executeCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    debug(`执行命令: ${command} ${args.join(' ')}`);
    
    // 确保使用正确的 shell 环境
    const spawnOptions = {
      shell: true,
      env: { ...process.env },
      encoding: 'utf8',
      timeout: options.timeout || 5000,
      ...options
    };
    
    // macOS 特殊处理：确保加载完整的 PATH
    if (process.platform === 'darwin') {
      // 使用登录 shell 来获取完整的环境变量
      // 正确处理参数引用，避免空格问题
      const quotedArgs = args.map(arg => `'${arg.replace(/'/g, "'\"'\"'")}'`).join(' ');
      const quotedCommand = `'${command.replace(/'/g, "'\"'\"'")}'`;
      const shellCommand = `/bin/bash -l -c "${quotedCommand} ${quotedArgs}"`;
      
      const child = spawn('/bin/bash', ['-c', shellCommand], {
        ...spawnOptions,
        shell: false  // 已经在命令中指定了 shell
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        debug(`命令执行错误: ${error.message}`);
        reject(error);
      });
      
      child.on('close', (code) => {
        debug(`命令退出码: ${code}, stdout: ${stdout.trim()}, stderr: ${stderr.trim()}`);
        
        if (code === 0 || (code === null && stdout)) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code
          });
        } else {
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code,
            error: stderr.trim() || `命令退出码: ${code}`
          });
        }
      });
      
      // 处理超时
      if (spawnOptions.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error('命令执行超时'));
        }, spawnOptions.timeout);
      }
      
    } else {
      // Windows 和 Linux
      const child = spawn(command, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        debug(`命令执行错误: ${error.message}`);
        reject(error);
      });
      
      child.on('close', (code) => {
        debug(`命令退出码: ${code}`);
        
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code
          });
        } else {
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code,
            error: stderr.trim() || `命令退出码: ${code}`
          });
        }
      });
    }
  });
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 查找可执行文件
 */
async function findExecutable(name) {
  debug(`查找可执行文件: ${name}`);
  
  // 1. 先尝试 which/where 命令
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const result = await executeCommand(whichCmd, [name]);
    
    if (result.success && result.stdout) {
      const paths = result.stdout.split('\n').filter(p => p.trim());
      debug(`通过 ${whichCmd} 找到: ${paths.join(', ')}`);
      return paths[0];
    }
  } catch (error) {
    debug(`which/where 查找失败: ${error.message}`);
  }
  
  // 2. 检查常见路径
  const commonPaths = getCommonPaths(name);
  
  for (const path of commonPaths) {
    debug(`检查路径: ${path}`);
    if (await fileExists(path)) {
      debug(`找到: ${path}`);
      return path;
    }
  }
  
  debug(`未找到 ${name}`);
  return null;
}

/**
 * 获取常见的可执行文件路径
 */
function getCommonPaths(name) {
  const paths = [];
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Windows 路径
    paths.push(
      `${name}.exe`,
      `${name}.cmd`,
      `${name}.bat`,
      `C:\\Program Files\\nodejs\\${name}.cmd`,
      `C:\\Program Files\\nodejs\\${name}.exe`,
      `${process.env.APPDATA}\\npm\\${name}.cmd`,
      `${process.env.APPDATA}\\npm\\${name}.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\${name}\\${name}.exe`
    );
    
    if (name === 'git') {
      paths.push(
        'C:\\Program Files\\Git\\bin\\git.exe',
        'C:\\Program Files (x86)\\Git\\bin\\git.exe',
        'C:\\Program Files\\Git\\cmd\\git.exe'
      );
    }
  } else if (platform === 'darwin') {
    // macOS 路径
    paths.push(
      name,
      `/usr/local/bin/${name}`,
      `/opt/homebrew/bin/${name}`,
      `/usr/bin/${name}`,
      `/bin/${name}`,
      `${process.env.HOME}/.npm-global/bin/${name}`,
      `${process.env.HOME}/.npm/bin/${name}`,
      `${process.env.HOME}/.yarn/bin/${name}`,
      `${process.env.HOME}/.local/bin/${name}`
    );
    
    if (name === 'node') {
      paths.push(
        '/usr/local/opt/node/bin/node',
        '/opt/homebrew/opt/node/bin/node',
        `${process.env.HOME}/.nvm/versions/node/*/bin/node`
      );
    } else if (name === 'claude') {
      paths.push(
        '/usr/local/lib/node_modules/.bin/claude',
        '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude',
        '/opt/homebrew/lib/node_modules/.bin/claude',
        '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude'
      );
    }
  } else {
    // Linux 路径
    paths.push(
      name,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      `/bin/${name}`,
      `${process.env.HOME}/.npm-global/bin/${name}`,
      `${process.env.HOME}/.local/bin/${name}`,
      `${process.env.HOME}/.yarn/bin/${name}`
    );
  }
  
  return paths;
}

/**
 * 检查单个命令
 */
async function checkCommand(command, versionFlag = '--version') {
  debug(`\n=== 检查命令: ${command} ===`);
  
  // 1. 查找可执行文件
  const execPath = await findExecutable(command);
  
  if (!execPath) {
    debug(`${command} 未找到`);
    return {
      installed: false,
      error: '未找到可执行文件'
    };
  }
  
  // 2. 尝试获取版本
  try {
    const result = await executeCommand(execPath, [versionFlag], { timeout: 3000 });
    
    if (result.success) {
      const version = (result.stdout || result.stderr || '').split('\n')[0];
      debug(`${command} 版本: ${version}`);
      
      return {
        installed: true,
        version: version || '已安装',
        path: execPath
      };
    } else {
      // 某些工具可能不支持 --version，但仍然是已安装的
      debug(`${command} 版本获取失败，但文件存在`);
      return {
        installed: true,
        version: '已安装（版本未知）',
        path: execPath
      };
    }
  } catch (error) {
    debug(`${command} 执行错误: ${error.message}`);
    
    // 文件存在但无法执行，可能是权限问题
    return {
      installed: true,
      version: '已安装（无法获取版本）',
      path: execPath,
      error: error.message
    };
  }
}

/**
 * 检查 Node.js
 */
async function checkNodejs() {
  const result = await checkCommand('node', '-v');
  
  if (result.installed && result.version) {
    // 解析版本号
    const versionMatch = result.version.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1]);
      result.compatible = major >= 16;
      result.version = `v${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`;
    }
  }
  
  return result;
}

/**
 * 检查 Git
 */
async function checkGit() {
  const result = await checkCommand('git', '--version');
  
  if (result.installed && result.version) {
    // 清理版本字符串
    result.version = result.version.replace('git version ', '');
  }
  
  return result;
}

/**
 * 检查 UV
 */
async function checkUV() {
  return await checkCommand('uv', '--version');
}

/**
 * 检查 Claude Code
 */
async function checkClaudeCode() {
  return await checkCommand('claude', '--version');
}

/**
 * 检查所有环境
 */
async function checkEnvironment() {
  debug('\n开始环境检查...\n');
  
  const checks = {
    nodejs: await checkNodejs(),
    git: await checkGit(),
    uv: await checkUV(),
    claude: await checkClaudeCode()
  };
  
  debug('\n环境检查完成:', JSON.stringify(checks, null, 2));
  
  return checks;
}

/**
 * 获取系统信息（用于调试）
 */
async function getSystemInfo() {
  const info = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL
    }
  };
  
  // 获取实际的 PATH（从 shell）
  try {
    const result = await executeCommand('echo', ['$PATH']);
    if (result.success) {
      info.shellPath = result.stdout;
    }
  } catch (error) {
    info.shellPath = 'Failed to get shell PATH';
  }
  
  return info;
}

module.exports = {
  setDebugMode,
  checkCommand,
  checkEnvironment,
  checkNodejs,
  checkGit,
  checkUV,
  checkClaudeCode,
  executeCommand,
  findExecutable,
  getSystemInfo
};