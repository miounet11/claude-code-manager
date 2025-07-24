'use strict';

/**
 * 进程保护增强模块
 * 提供多层级的进程保护机制
 */

const { app } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class ProcessProtection {
  constructor() {
    this.processId = process.pid;
    this.appPath = app.getPath('exe');
    this.guardianPids = new Set();
    this.protectionActive = false;
    this.watchdogInterval = null;
  }

  /**
   * 启动多层级保护
   */
  async enableProtection() {
    try {
      console.log('🔒 启动进程保护系统...');
      
      // 1. 设置进程优先级
      this.setProcessPriority();
      
      // 2. 创建看门狗进程
      await this.createWatchdog();
      
      // 3. 设置进程隐藏（Windows）
      if (process.platform === 'win32') {
        await this.hideProcess();
      }
      
      // 4. 启动心跳监控
      this.startHeartbeat();
      
      // 5. 设置崩溃处理
      this.setupCrashHandler();
      
      this.protectionActive = true;
      console.log('✅ 进程保护系统已启动');
      
    } catch (error) {
      console.error('❌ 进程保护启动失败:', error);
    }
  }

  /**
   * 设置进程优先级
   */
  setProcessPriority() {
    try {
      if (process.platform === 'win32') {
        // Windows - 设置为高优先级
        exec(`wmic process where ProcessId=${this.processId} CALL setpriority "high priority"`);
      } else if (process.platform === 'darwin') {
        // macOS - 使用 renice 命令
        exec(`renice -n -10 -p ${this.processId}`);
      } else {
        // Linux
        exec(`renice -n -10 -p ${this.processId}`);
      }
      console.log('📈 进程优先级已提升');
    } catch (error) {
      console.error('设置进程优先级失败:', error);
    }
  }

  /**
   * 创建看门狗进程
   */
  async createWatchdog() {
    const watchdogScript = `
      const { spawn } = require('child_process');
      const parentPid = ${this.processId};
      const appPath = '${this.appPath.replace(/\\/g, '\\\\')}';
      
      // 监控父进程
      setInterval(() => {
        try {
          process.kill(parentPid, 0);
        } catch (e) {
          // 父进程不存在，重新启动
          console.log('检测到主进程退出，正在重启...');
          spawn(appPath, [], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          process.exit();
        }
      }, 1000);
      
      // 保持看门狗运行
      setInterval(() => {}, 1000);
    `;
    
    // 创建临时文件
    const tmpFile = path.join(app.getPath('temp'), `watchdog_${Date.now()}.js`);
    fs.writeFileSync(tmpFile, watchdogScript);
    
    // 启动看门狗进程
    const watchdog = spawn(process.execPath, [tmpFile], {
      detached: true,
      stdio: 'ignore'
    });
    
    watchdog.unref();
    this.guardianPids.add(watchdog.pid);
    
    console.log(`🐕 看门狗进程已启动 (PID: ${watchdog.pid})`);
  }

  /**
   * Windows下隐藏进程
   */
  async hideProcess() {
    try {
      // 使用 PowerShell 隐藏进程
      const hideScript = `
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("kernel32.dll")]
          public static extern IntPtr GetConsoleWindow();
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
        $consolePtr = [Win32]::GetConsoleWindow()
        [Win32]::ShowWindow($consolePtr, 0)
      `;
      
      exec(`powershell -Command "${hideScript}"`);
      console.log('👻 进程已隐藏');
    } catch (error) {
      console.error('隐藏进程失败:', error);
    }
  }

  /**
   * 启动心跳监控
   */
  startHeartbeat() {
    const heartbeatFile = path.join(app.getPath('temp'), '.miaoda_heartbeat');
    
    this.watchdogInterval = setInterval(() => {
      // 更新心跳文件
      fs.writeFileSync(heartbeatFile, `${Date.now()}:${this.processId}`);
    }, 5000);
    
    console.log('💓 心跳监控已启动');
  }

  /**
   * 设置崩溃处理
   */
  setupCrashHandler() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      this.logCrash(error);
      // 尝试恢复
      this.attemptRecovery();
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
      this.logCrash(reason);
    });

    // 处理终止信号
    let sigintCount = 0;
    let lastSigintTime = 0;
    
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
      process.on(signal, () => {
        console.log(`收到信号: ${signal}`);
        
        // 特殊处理 SIGINT (Ctrl+C)
        if (signal === 'SIGINT') {
          const now = Date.now();
          
          // 如果3秒内连续按了3次 Ctrl+C，强制退出
          if (now - lastSigintTime < 3000) {
            sigintCount++;
            if (sigintCount >= 3) {
              console.log('检测到强制退出信号 (连续3次 Ctrl+C)，正在退出...');
              this.forceExit();
              return;
            }
          } else {
            sigintCount = 1;
          }
          
          lastSigintTime = now;
          console.log(`忽略终止信号，保持运行 (${sigintCount}/3)`);
          console.log('提示: 3秒内连续按3次 Ctrl+C 可强制退出');
          return;
        }
        
        // 其他信号在保护激活时忽略
        if (this.protectionActive) {
          console.log('忽略终止信号，保持运行');
          return;
        }
      });
    });
    
    // 处理特殊的终止信号 SIGUSR2 (可以用 kill -USR2 <pid> 发送)
    process.on('SIGUSR2', () => {
      console.log('收到调试终止信号 SIGUSR2，正在退出...');
      this.forceExit();
    });
  }

  /**
   * 记录崩溃信息
   */
  logCrash(error) {
    const crashLog = {
      timestamp: new Date().toISOString(),
      pid: this.processId,
      error: error.toString(),
      stack: error.stack,
      platform: process.platform,
      version: app.getVersion()
    };
    
    const logFile = path.join(app.getPath('userData'), 'crash-logs', `crash_${Date.now()}.json`);
    
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.writeFileSync(logFile, JSON.stringify(crashLog, null, 2));
    } catch (e) {
      console.error('写入崩溃日志失败:', e);
    }
  }

  /**
   * 尝试恢复
   */
  attemptRecovery() {
    console.log('🔧 尝试恢复应用...');
    
    // 重启应用
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1000);
  }

  /**
   * 停止保护
   */
  stopProtection() {
    this.protectionActive = false;
    
    // 清理看门狗进程
    this.guardianPids.forEach(pid => {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        // 忽略错误
      }
    });
    
    // 停止心跳
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }
    
    console.log('🔓 进程保护已停止');
  }

  /**
   * 强制退出
   */
  forceExit() {
    console.log('🛑 强制退出进程...');
    
    // 停止保护
    this.stopProtection();
    
    // 设置强制退出标志
    global.forceQuit = true;
    
    // 清理资源
    try {
      // 删除临时文件
      const tmpFiles = [
        path.join(app.getPath('temp'), '.miaoda_heartbeat'),
        ...Array.from(this.guardianPids).map(pid => 
          path.join(app.getPath('temp'), `watchdog_${pid}.js`)
        )
      ];
      
      tmpFiles.forEach(file => {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (e) {
          // 忽略错误
        }
      });
    } catch (e) {
      console.error('清理资源失败:', e);
    }
    
    // 退出应用
    if (app && app.quit) {
      app.quit();
    } else {
      process.exit(0);
    }
  }
}

module.exports = ProcessProtection;