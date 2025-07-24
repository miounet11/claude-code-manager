'use strict';

const os = require('os');
const path = require('path');

/**
 * 跨平台工具函数
 */
class PlatformUtils {
  /**
   * 获取系统特定的文档目录
   */
  static getSystemPaths() {
    const platform = process.platform;
    const home = os.homedir();
    
    if (platform === 'win32') {
      return {
        systemDirs: [
          'C:\\Windows',
          'C:\\Program Files',
          'C:\\Program Files (x86)',
          'C:\\ProgramData',
          'C:\\System32'
        ],
        appData: process.env.APPDATA || path.join(home, 'AppData', 'Roaming'),
        localAppData: process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
        temp: process.env.TEMP || path.join(home, 'AppData', 'Local', 'Temp')
      };
    } else if (platform === 'darwin') {
      return {
        systemDirs: [
          '/System',
          '/Library',
          '/private',
          '/usr',
          '/bin',
          '/sbin'
        ],
        appData: path.join(home, 'Library', 'Application Support'),
        localAppData: path.join(home, 'Library', 'Caches'),
        temp: os.tmpdir()
      };
    } else {
      // Linux
      return {
        systemDirs: [
          '/etc',
          '/usr',
          '/bin',
          '/sbin',
          '/boot',
          '/dev',
          '/proc',
          '/sys'
        ],
        appData: path.join(home, '.config'),
        localAppData: path.join(home, '.cache'),
        temp: os.tmpdir()
      };
    }
  }

  /**
   * 规范化路径（统一使用正斜杠）
   */
  static normalizePath(inputPath) {
    return inputPath.replace(/\\/g, '/');
  }

  /**
   * 获取进程列表命令
   */
  static getProcessListCommand() {
    if (process.platform === 'win32') {
      return 'tasklist /fo csv';
    } else {
      return 'ps aux';
    }
  }

  /**
   * 获取进程终止命令
   */
  static getKillCommand(pid) {
    if (process.platform === 'win32') {
      return `taskkill /F /PID ${pid}`;
    } else {
      return `kill -9 ${pid}`;
    }
  }

  /**
   * 检查进程是否在运行
   */
  static getProcessCheckCommand(processName) {
    if (process.platform === 'win32') {
      return `tasklist /FI "IMAGENAME eq ${processName}"`;
    } else {
      return `pgrep -f "${processName}"`;
    }
  }

  /**
   * 获取默认 Shell
   */
  static getDefaultShell() {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * 获取平台特定的隐藏文件命令
   */
  static getHideFileCommand(filePath) {
    if (process.platform === 'win32') {
      return `attrib +h +s "${filePath}"`;
    } else {
      // Unix 系统使用点前缀
      return null;
    }
  }

  /**
   * 判断路径是否为绝对路径
   */
  static isAbsolutePath(inputPath) {
    if (process.platform === 'win32') {
      // Windows 绝对路径以盘符开头
      return /^[A-Za-z]:[\\/]/.test(inputPath);
    } else {
      // Unix 系统绝对路径以 / 开头
      return inputPath.startsWith('/');
    }
  }

  /**
   * 获取平台名称
   */
  static getPlatformName() {
    const platform = process.platform;
    switch (platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return platform;
    }
  }
}

module.exports = PlatformUtils;