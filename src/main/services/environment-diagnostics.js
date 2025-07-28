'use strict';

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * 环境诊断工具 - 用于调试打包应用的环境问题
 */
class EnvironmentDiagnostics {
  /**
   * 运行完整诊断
   */
  static async runFullDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      app: {
        name: app.getName(),
        version: app.getVersion(),
        path: app.getAppPath(),
        execPath: process.execPath,
        isPackaged: app.isPackaged
      },
      process: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        v8Version: process.versions.v8,
        pid: process.pid,
        cwd: process.cwd()
      },
      environment: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        SHELL: process.env.SHELL,
        NVM_DIR: process.env.NVM_DIR,
        npmConfig: {}
      },
      paths: {
        searched: [],
        found: {}
      },
      commands: {}
    };

    // 获取 npm 配置
    try {
      diagnostics.environment.npmConfig.prefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      diagnostics.environment.npmConfig.globalFolder = execSync('npm root -g', { encoding: 'utf8' }).trim();
    } catch (e) {
      diagnostics.environment.npmConfig.error = e.message;
    }

    // 获取增强的 PATH
    try {
      // 尝试从 launchctl 获取
      const launchctlPath = execSync('launchctl getenv PATH', { encoding: 'utf8' }).trim();
      diagnostics.environment.launchctlPATH = launchctlPath;
    } catch (e) {
      diagnostics.environment.launchctlPATH = 'Not available';
    }

    // 尝试从 path_helper 获取
    try {
      const pathHelperOutput = execSync('/usr/libexec/path_helper -s', { encoding: 'utf8' });
      diagnostics.environment.pathHelperOutput = pathHelperOutput;
    } catch (e) {
      diagnostics.environment.pathHelperError = e.message;
    }

    // 检查常见命令的位置
    const commands = ['node', 'npm', 'git', 'claude', 'python', 'python3'];
    for (const cmd of commands) {
      diagnostics.commands[cmd] = await this.findCommand(cmd);
    }

    // 搜索所有可能的路径
    const searchPaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      `${process.env.HOME}/.npm-global/bin`,
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/.cargo/bin`,
      `${process.env.HOME}/.nvm/current/bin`,
      `${process.env.HOME}/bin`,
      `${process.env.HOME}/Documents/claude code/node-v20.10.0-darwin-arm64/bin`
    ];

    for (const searchPath of searchPaths) {
      try {
        const files = await fs.readdir(searchPath);
        diagnostics.paths.searched.push({
          path: searchPath,
          exists: true,
          files: files.filter(f => ['node', 'npm', 'git', 'claude'].includes(f))
        });
      } catch (e) {
        diagnostics.paths.searched.push({
          path: searchPath,
          exists: false,
          error: e.code
        });
      }
    }

    // 查找 Claude CLI 特定位置
    const claudePaths = [
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code',
      '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code',
      `${process.env.HOME}/.npm-global/lib/node_modules/@anthropic-ai/claude-code`
    ];

    diagnostics.claudeInstallations = [];
    for (const claudePath of claudePaths) {
      try {
        const stats = await fs.stat(claudePath);
        const packageJson = await fs.readFile(path.join(claudePath, 'package.json'), 'utf8');
        const pkg = JSON.parse(packageJson);
        diagnostics.claudeInstallations.push({
          path: claudePath,
          exists: true,
          version: pkg.version,
          bin: pkg.bin
        });
      } catch (e) {
        diagnostics.claudeInstallations.push({
          path: claudePath,
          exists: false
        });
      }
    }

    return diagnostics;
  }

  /**
   * 查找命令
   */
  static async findCommand(command) {
    const result = {
      command,
      found: false,
      locations: []
    };

    // 方法1: which
    try {
      const whichPath = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
      if (whichPath) {
        result.locations.push({ method: 'which', path: whichPath });
        result.found = true;
      }
    } catch (e) {
      // which 失败
    }

    // 方法2: command -v
    try {
      const commandPath = execSync(`command -v ${command}`, { 
        encoding: 'utf8',
        shell: '/bin/bash'
      }).trim();
      if (commandPath) {
        result.locations.push({ method: 'command -v', path: commandPath });
        result.found = true;
      }
    } catch (e) {
      // command -v 失败
    }

    // 方法3: 直接执行
    try {
      const version = execSync(`${command} --version 2>&1`, { 
        encoding: 'utf8',
        timeout: 2000
      }).trim().split('\n')[0];
      result.locations.push({ method: 'direct execution', version });
      result.found = true;
    } catch (e) {
      // 直接执行失败
    }

    return result;
  }

  /**
   * 保存诊断报告
   */
  static async saveDiagnosticsReport(diagnostics) {
    const reportPath = path.join(app.getPath('desktop'), `miaoda-diagnostics-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(diagnostics, null, 2));
    return reportPath;
  }
}

// 注册 IPC 处理器
ipcMain.handle('environment:run-diagnostics', async () => {
  try {
    const diagnostics = await EnvironmentDiagnostics.runFullDiagnostics();
    const reportPath = await EnvironmentDiagnostics.saveDiagnosticsReport(diagnostics);
    
    // 显示诊断结果摘要
    const summary = {
      node: diagnostics.commands.node.found ? '✓ 已找到' : '✗ 未找到',
      npm: diagnostics.commands.npm.found ? '✓ 已找到' : '✗ 未找到',
      git: diagnostics.commands.git.found ? '✓ 已找到' : '✗ 未找到',
      claude: diagnostics.commands.claude.found ? '✓ 已找到' : '✗ 未找到',
      reportPath
    };
    
    return { success: true, diagnostics, summary };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

module.exports = EnvironmentDiagnostics;