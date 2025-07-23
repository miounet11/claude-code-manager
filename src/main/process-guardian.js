'use strict';

/**
 * 进程守护和保活机制核心模块
 * 实现驱动级的进程保护、自启动、防卸载等功能
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { app, dialog, BrowserWindow } = require('electron');
const Store = require('electron-store');
const os = require('os');

const store = new Store();

class ProcessGuardian {
  constructor() {
    this.isGuardianActive = false;
    this.guardianProcess = null;
    this.heartbeatInterval = null;
    this.mainProcess = process;
    this.backupProcesses = [];
    this.protectionLevel = 'maximum'; // minimum, moderate, maximum
    this.uninstallAttempts = 0;
    this.maxUninstallAttempts = 5;
    this.portManager = new PortManager();
    this.launchDaemon = new LaunchDaemon();
    
    this.bindEvents();
  }

  /**
   * 启动完整的保活机制
   */
  async startGuardian() {
    console.log('🛡️ 启动进程守护系统...');
    
    try {
      // 1. 请求管理员权限
      await this.requestAdminPrivileges();
      
      // 2. 启动系统级守护进程
      await this.startSystemDaemon();
      
      // 3. 设置开机自启动
      await this.setupAutoLaunch();
      
      // 4. 启动进程监控
      await this.startProcessMonitoring();
      
      // 5. 设置防卸载保护
      await this.setupUninstallProtection();
      
      // 6. 启动端口管理
      await this.portManager.initialize();
      
      this.isGuardianActive = true;
      console.log('✅ 进程守护系统启动成功');
      
      return { success: true, message: '保活机制启动成功' };
    } catch (error) {
      console.error('❌ 进程守护系统启动失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 请求管理员权限
   */
  async requestAdminPrivileges() {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS - 请求管理员权限
      return new Promise((resolve, reject) => {
        const osascript = `osascript -e 'do shell script "echo \\"Admin access granted\\"" with administrator privileges'`;
        exec(osascript, (error, stdout, stderr) => {
          if (error) {
            reject(new Error('需要管理员权限才能启用保活机制'));
          } else {
            resolve(true);
          }
        });
      });
    } else if (platform === 'win32') {
      // Windows - 检查是否以管理员身份运行
      return new Promise((resolve, reject) => {
        exec('net session >nul 2>&1', (error) => {
          if (error) {
            reject(new Error('需要以管理员身份运行才能启用保活机制'));
          } else {
            resolve(true);
          }
        });
      });
    }
    
    return true;
  }

  /**
   * 启动系统级守护进程
   */
  async startSystemDaemon() {
    const platform = process.platform;
    const appPath = app.getPath('exe');
    const daemonScript = await this.generateDaemonScript(appPath);
    
    if (platform === 'darwin') {
      // macOS - 创建LaunchAgent
      await this.launchDaemon.createMacOSLaunchAgent(daemonScript);
    } else if (platform === 'win32') {
      // Windows - 创建系统服务
      await this.createWindowsService(daemonScript);
    } else {
      // Linux - 创建systemd服务
      await this.createLinuxService(daemonScript);
    }
  }

  /**
   * 生成守护脚本
   */
  async generateDaemonScript(appPath) {
    const platform = process.platform;
    let script = '';
    
    if (platform === 'darwin') {
      script = `#!/bin/bash
# Miaoda Guardian Daemon
APP_PATH="${appPath}"
LOCK_FILE="/tmp/miaoda.lock"
LOG_FILE="$HOME/Library/Logs/miaoda-guardian.log"

while true; do
  if ! pgrep -f "$APP_PATH" > /dev/null; then
    echo "$(date): Restarting Miaoda..." >> "$LOG_FILE"
    nohup "$APP_PATH" > /dev/null 2>&1 &
  fi
  sleep 5
done`;
    } else if (platform === 'win32') {
      script = `@echo off
rem Miaoda Guardian Daemon
set APP_PATH=${appPath}
set LOG_FILE=%TEMP%\\miaoda-guardian.log

:loop
tasklist /FI "IMAGENAME eq Miaoda.exe" 2>NUL | find /I /N "Miaoda.exe">NUL
if "%ERRORLEVEL%"=="1" (
  echo %date% %time%: Restarting Miaoda... >> "%LOG_FILE%"
  start "" "%APP_PATH%"
)
timeout /t 5 /nobreak >nul
goto loop`;
    }
    
    return script;
  }

  /**
   * 设置开机自启动（增强版）
   */
  async setupAutoLaunch() {
    const platform = process.platform;
    const appPath = app.getPath('exe');
    
    if (platform === 'darwin') {
      // macOS - 多重启动方式
      await this.setupMacOSAutoLaunch(appPath);
    } else if (platform === 'win32') {
      // Windows - 注册表 + 启动文件夹 + 任务计划程序
      await this.setupWindowsAutoLaunch(appPath);
    }
  }

  /**
   * macOS自启动设置
   */
  async setupMacOSAutoLaunch(appPath) {
    // 1. 使用auto-launch库
    const autoLauncher = require('auto-launch');
    const appLauncher = new autoLauncher({
      name: 'Miaoda',
      path: appPath,
      isHidden: true
    });
    await appLauncher.enable();
    
    // 2. 创建LoginItem
    const loginItemScript = `
osascript -e 'tell application "System Events" to make login item at end with properties {path:"${appPath}", hidden:true}'
    `;
    exec(loginItemScript);
    
    // 3. 创建LaunchAgent（开机启动）
    const launchAgentPath = path.join(os.homedir(), 'Library/LaunchAgents/com.miaoda.autostart.plist');
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.miaoda.autostart</string>
    <key>ProgramArguments</key>
    <array>
        <string>${appPath}</string>
        <string>--background</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
</dict>
</plist>`;
    
    await fs.writeFile(launchAgentPath, plistContent);
    exec(`launchctl load ${launchAgentPath}`);
  }

  /**
   * Windows自启动设置
   */
  async setupWindowsAutoLaunch(appPath) {
    // 1. 注册表启动项（HKCU）
    const regCmd1 = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Miaoda" /t REG_SZ /d "${appPath}" /f`;
    exec(regCmd1);
    
    // 2. 注册表启动项（HKLM - 需要管理员权限）
    const regCmd2 = `reg add "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Miaoda" /t REG_SZ /d "${appPath}" /f`;
    exec(regCmd2);
    
    // 3. 启动文件夹
    const startupFolder = path.join(os.homedir(), 'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup');
    const shortcutPath = path.join(startupFolder, 'Miaoda.lnk');
    
    // 创建快捷方式的PowerShell脚本
    const createShortcutScript = `
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
$Shortcut.TargetPath = "${appPath}"
$Shortcut.Arguments = "--background"
$Shortcut.WindowStyle = 7
$Shortcut.Save()
    `;
    
    const scriptPath = path.join(os.tmpdir(), 'create-shortcut.ps1');
    await fs.writeFile(scriptPath, createShortcutScript);
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
    
    // 4. 任务计划程序
    const taskName = 'MiaodaAutoStart';
    const taskCmd = `schtasks /create /tn "${taskName}" /tr "${appPath}" /sc onstart /ru "SYSTEM" /f`;
    exec(taskCmd);
  }

  /**
   * 启动进程监控
   */
  async startProcessMonitoring() {
    // 心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 3000);

    // 进程异常监控
    process.on('SIGTERM', () => this.handleProcessTermination('SIGTERM'));
    process.on('SIGINT', () => this.handleProcessTermination('SIGINT'));
    process.on('SIGHUP', () => this.handleProcessTermination('SIGHUP'));
    
    // 内存监控
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('⚠️ 内存使用过高，尝试优化...');
        this.optimizeMemory();
      }
    }, 10000);

    // 启动备份进程
    await this.startBackupProcesses();
  }

  /**
   * 启动备份进程
   */
  async startBackupProcesses() {
    const appPath = app.getPath('exe');
    const backupCount = 2;
    
    for (let i = 0; i < backupCount; i++) {
      setTimeout(() => {
        const backupProcess = spawn(appPath, ['--backup-mode', `--backup-id=${i}`], {
          detached: true,
          stdio: 'ignore'
        });
        
        backupProcess.unref();
        this.backupProcesses.push(backupProcess);
        console.log(`🔄 启动备份进程 ${i + 1}`);
      }, (i + 1) * 2000);
    }
  }

  /**
   * 处理进程终止信号
   */
  handleProcessTermination(signal) {
    console.log(`🚨 收到终止信号: ${signal}`);
    
    if (this.protectionLevel === 'maximum') {
      // 最高保护级别 - 阻止退出并重启
      console.log('🛡️ 保护模式激活，阻止进程退出');
      this.restartProcess();
      return false;
    }
    
    // 正常清理并退出
    this.cleanup();
  }

  /**
   * 重启进程
   */
  async restartProcess() {
    const appPath = app.getPath('exe');
    
    setTimeout(() => {
      spawn(appPath, process.argv.slice(1), {
        detached: true,
        stdio: 'ignore'
      }).unref();
    }, 1000);
  }

  /**
   * 设置防卸载保护
   */
  async setupUninstallProtection() {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows - 监控卸载注册表项
      await this.monitorWindowsUninstall();
    } else if (platform === 'darwin') {
      // macOS - 监控应用程序文件夹
      await this.monitorMacOSUninstall();
    }
  }

  /**
   * 监控Windows卸载
   */
  async monitorWindowsUninstall() {
    // 监控注册表卸载项的变化
    const registryPath = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Miaoda';
    
    setInterval(async () => {
      try {
        const result = await this.checkRegistryKey(registryPath);
        if (!result) {
          await this.handleUninstallAttempt();
        }
      } catch (error) {
        console.error('注册表监控错误:', error);
      }
    }, 2000);
  }

  /**
   * 监控macOS卸载
   */
  async monitorMacOSUninstall() {
    const appBundle = app.getAppPath();
    
    setInterval(async () => {
      try {
        await fs.access(appBundle);
      } catch (error) {
        // 应用被删除，触发保护机制
        await this.handleUninstallAttempt();
      }
    }, 2000);
  }

  /**
   * 处理卸载尝试
   */
  async handleUninstallAttempt() {
    this.uninstallAttempts++;
    console.log(`🚨 检测到卸载尝试 (${this.uninstallAttempts}/${this.maxUninstallAttempts})`);
    
    if (this.uninstallAttempts <= this.maxUninstallAttempts) {
      // 显示挽留对话框（模仿360）
      const result = await this.showRetentionDialog();
      
      if (result === 'cancel') {
        // 用户选择不卸载，重新安装注册表项
        await this.restoreInstallation();
        this.uninstallAttempts = 0;
        return;
      }
    }
    
    if (this.uninstallAttempts >= this.maxUninstallAttempts) {
      // 达到最大尝试次数，允许卸载但保留用户数据
      await this.prepareGracefulUninstall();
    }
  }

  /**
   * 显示挽留对话框
   */
  async showRetentionDialog() {
    const messages = [
      '真的要离开我吗？我会想你的... 😢',
      '等等！我还有很多功能你没有发现呢！ 🎉',
      '我保证会更好地服务你，再给我一次机会好吗？ 🙏',
      '卸载我很容易，但重新安装可就麻烦了... 🤔',
      '好吧，如果你真的要走，我尊重你的选择... 💔'
    ];
    
    const messageIndex = Math.min(this.uninstallAttempts - 1, messages.length - 1);
    const message = messages[messageIndex];
    
    const buttons = this.uninstallAttempts < this.maxUninstallAttempts 
      ? ['继续卸载', '取消卸载', '稍后再试']
      : ['确认卸载', '再考虑一下'];
    
    return new Promise((resolve) => {
      dialog.showMessageBox(null, {
        type: 'question',
        title: 'Miaoda - 卸载确认',
        message: message,
        detail: '我们致力于为您提供最好的Claude Code管理体验',
        buttons: buttons,
        defaultId: 1,
        cancelId: 1
      }).then((result) => {
        if (result.response === 1) {
          resolve('cancel');
        } else if (result.response === 2) {
          resolve('later');
        } else {
          resolve('continue');
        }
      });
    });
  }

  /**
   * 恢复安装
   */
  async restoreInstallation() {
    console.log('🔧 正在恢复安装...');
    
    // 重新设置自启动
    await this.setupAutoLaunch();
    
    // 重新启动守护进程
    await this.startSystemDaemon();
    
    console.log('✅ 安装已恢复');
  }

  /**
   * 检查注册表项
   */
  checkRegistryKey(keyPath) {
    return new Promise((resolve) => {
      exec(`reg query "${keyPath}"`, (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * 发送心跳
   */
  sendHeartbeat() {
    const heartbeat = {
      pid: process.pid,
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    // 存储心跳信息到文件
    const heartbeatFile = path.join(os.tmpdir(), 'miaoda-heartbeat.json');
    fs.writeFile(heartbeatFile, JSON.stringify(heartbeat)).catch(() => {});
  }

  /**
   * 优化内存
   */
  optimizeMemory() {
    if (global.gc) {
      global.gc();
      console.log('🧹 已执行垃圾回收');
    }
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    app.on('before-quit', (event) => {
      if (this.protectionLevel === 'maximum' && this.isGuardianActive) {
        event.preventDefault();
        console.log('🛡️ 阻止应用退出');
        return false;
      }
    });

    app.on('window-all-closed', (event) => {
      if (this.protectionLevel === 'maximum') {
        event.preventDefault();
        // 隐藏到系统托盘而不是退出
        console.log('🔄 应用最小化到系统托盘');
        return false;
      }
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.guardianProcess) {
      this.guardianProcess.kill();
    }
    
    this.backupProcesses.forEach(proc => {
      try {
        proc.kill();
      } catch (e) {}
    });
    
    this.isGuardianActive = false;
  }

  /**
   * 设置保护级别
   */
  setProtectionLevel(level) {
    this.protectionLevel = level;
    store.set('protectionLevel', level);
    console.log(`🔧 保护级别设置为: ${level}`);
  }

  /**
   * 获取守护状态
   */
  getStatus() {
    return {
      isActive: this.isGuardianActive,
      protectionLevel: this.protectionLevel,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      uninstallAttempts: this.uninstallAttempts,
      backupProcesses: this.backupProcesses.length,
      currentPort: this.portManager.currentPort
    };
  }
}

/**
 * 端口管理器
 */
class PortManager {
  constructor() {
    this.preferredPorts = [8082, 8083, 8084, 8085, 8086];
    this.currentPort = null;
  }

  async initialize() {
    this.currentPort = await this.findAvailablePort();
    console.log(`🔌 分配端口: ${this.currentPort}`);
    return this.currentPort;
  }

  async findAvailablePort() {
    const net = require('net');
    
    for (const port of this.preferredPorts) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    
    // 如果首选端口都被占用，寻找随机可用端口
    return await this.findRandomAvailablePort();
  }

  isPortAvailable(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      
      server.on('error', () => resolve(false));
    });
  }

  async findRandomAvailablePort() {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();
      
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  }
}

/**
 * 启动守护程序管理器
 */
class LaunchDaemon {
  async createMacOSLaunchAgent(script) {
    const launchAgentPath = path.join(os.homedir(), 'Library/LaunchAgents/com.miaoda.guardian.plist');
    const scriptPath = path.join(os.tmpdir(), 'miaoda-guardian.sh');
    
    // 保存脚本文件
    await fs.writeFile(scriptPath, script, { mode: 0o755 });
    
    // 创建LaunchAgent plist
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.miaoda.guardian</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${scriptPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/miaoda-guardian.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/miaoda-guardian.out</string>
</dict>
</plist>`;

    await fs.writeFile(launchAgentPath, plistContent);
    
    // 加载LaunchAgent
    exec(`launchctl load ${launchAgentPath}`, (error) => {
      if (error) {
        console.error('LaunchAgent加载失败:', error);
      } else {
        console.log('✅ macOS守护程序已启动');
      }
    });
  }
}

module.exports = ProcessGuardian;