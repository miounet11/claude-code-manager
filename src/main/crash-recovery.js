'use strict';

/**
 * 崩溃恢复模块
 * 提供应用崩溃后的自动恢复机制
 */

const { app, crashReporter } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

class CrashRecovery {
  constructor() {
    this.store = new Store();
    this.crashCount = 0;
    this.maxCrashRetries = 3;
    this.crashWindow = 60000; // 1分钟内的崩溃计数
    this.lastCrashTime = 0;
    this.recoveryInProgress = false;
  }

  /**
   * 初始化崩溃恢复系统
   */
  initialize() {
    console.log('🚑 初始化崩溃恢复系统...');
    
    // 1. 设置崩溃报告
    this.setupCrashReporter();
    
    // 2. 检查上次是否崩溃
    this.checkLastCrash();
    
    // 3. 设置崩溃处理器
    this.setupCrashHandlers();
    
    // 4. 保存当前运行状态
    this.saveRunningState();
    
    console.log('✅ 崩溃恢复系统已就绪');
  }

  /**
   * 设置崩溃报告器
   */
  setupCrashReporter() {
    const crashesDir = path.join(app.getPath('userData'), 'crashes');
    
    // 确保崩溃目录存在
    if (!fs.existsSync(crashesDir)) {
      fs.mkdirSync(crashesDir, { recursive: true });
    }
    
    // 启动崩溃报告器
    crashReporter.start({
      submitURL: '', // 不提交到服务器，仅本地记录
      uploadToServer: false,
      ignoreSystemCrashHandler: true,
      compress: true,
      extra: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.versions.node,
        electron_version: process.versions.electron
      }
    });
  }

  /**
   * 检查上次是否崩溃
   */
  checkLastCrash() {
    const lastState = this.store.get('lastRunState', {});
    const now = Date.now();
    
    if (lastState.running && lastState.pid !== process.pid) {
      // 检测到非正常退出
      console.warn('⚠️ 检测到上次非正常退出');
      
      const timeSinceLastRun = now - (lastState.timestamp || 0);
      
      if (timeSinceLastRun < this.crashWindow) {
        this.crashCount = (lastState.crashCount || 0) + 1;
      } else {
        this.crashCount = 1;
      }
      
      // 记录崩溃
      this.logCrash({
        type: 'unexpected_shutdown',
        lastPid: lastState.pid,
        lastTimestamp: lastState.timestamp,
        crashCount: this.crashCount
      });
      
      // 如果崩溃次数过多，执行安全模式
      if (this.crashCount >= this.maxCrashRetries) {
        this.enterSafeMode();
      }
    } else {
      this.crashCount = 0;
    }
  }

  /**
   * 设置崩溃处理器
   */
  setupCrashHandlers() {
    // GPU进程崩溃
    app.on('gpu-process-crashed', (event, killed) => {
      console.error('GPU进程崩溃:', { killed });
      this.handleCrash('gpu-process', { killed });
    });

    // 渲染进程崩溃
    app.on('renderer-process-crashed', (event, webContents, killed) => {
      console.error('渲染进程崩溃:', { killed });
      this.handleCrash('renderer-process', { 
        killed, 
        url: webContents.getURL() 
      });
    });

    // 子进程崩溃
    app.on('child-process-gone', (event, details) => {
      console.error('子进程崩溃:', details);
      this.handleCrash('child-process', details);
    });

    // 主进程异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      this.handleCrash('uncaught-exception', {
        error: error.toString(),
        stack: error.stack
      });
    });

    process.on('unhandledRejection', (reason) => {
      console.error('未处理的Promise拒绝:', reason);
      this.handleCrash('unhandled-rejection', {
        reason: reason?.toString(),
        stack: reason?.stack
      });
    });
  }

  /**
   * 保存运行状态
   */
  saveRunningState() {
    const state = {
      running: true,
      pid: process.pid,
      timestamp: Date.now(),
      version: app.getVersion(),
      crashCount: this.crashCount
    };
    
    this.store.set('lastRunState', state);
    
    // 定期更新时间戳
    setInterval(() => {
      if (!this.recoveryInProgress) {
        this.store.set('lastRunState.timestamp', Date.now());
      }
    }, 10000);
  }

  /**
   * 处理崩溃
   */
  handleCrash(type, details) {
    if (this.recoveryInProgress) {
      return;
    }
    
    this.recoveryInProgress = true;
    
    // 记录崩溃信息
    this.logCrash({
      type,
      details,
      timestamp: Date.now(),
      crashCount: ++this.crashCount
    });
    
    // 根据崩溃类型决定恢复策略
    switch (type) {
    case 'renderer-process':
      // 渲染进程崩溃，重新加载页面
      this.recoverRenderer();
      break;
        
    case 'gpu-process':
      // GPU进程崩溃，禁用硬件加速后重启
      this.recoverWithoutGPU();
      break;
        
    case 'uncaught-exception':
    case 'unhandled-rejection':
      // 主进程异常，尝试恢复或重启
      if (this.crashCount < this.maxCrashRetries) {
        this.attemptRecovery();
      } else {
        this.enterSafeMode();
      }
      break;
        
    default:
      this.attemptRecovery();
    }
  }

  /**
   * 记录崩溃信息
   */
  logCrash(crashInfo) {
    const crashLog = {
      ...crashInfo,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      platform: process.platform,
      version: app.getVersion(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    const logFile = path.join(
      app.getPath('userData'), 
      'crashes', 
      `crash_${Date.now()}.json`
    );
    
    try {
      fs.writeFileSync(logFile, JSON.stringify(crashLog, null, 2));
      
      // 保留最近的10个崩溃日志
      this.cleanOldCrashLogs();
    } catch (error) {
      console.error('写入崩溃日志失败:', error);
    }
  }

  /**
   * 恢复渲染进程
   */
  recoverRenderer() {
    console.log('🔧 尝试恢复渲染进程...');
    
    const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
      this.recoveryInProgress = false;
    }
  }

  /**
   * 禁用GPU后恢复
   */
  recoverWithoutGPU() {
    console.log('🔧 禁用硬件加速后重启...');
    
    app.disableHardwareAcceleration();
    this.attemptRecovery();
  }

  /**
   * 尝试恢复应用
   */
  attemptRecovery() {
    console.log('🔧 尝试恢复应用...');
    
    // 清理资源
    this.cleanup();
    
    // 延迟重启
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1000);
  }

  /**
   * 进入安全模式
   */
  enterSafeMode() {
    console.log('🛡️ 进入安全模式...');
    
    // 标记为安全模式
    this.store.set('safeMode', true);
    this.store.set('lastRunState.crashCount', 0);
    
    // 禁用可能导致问题的功能
    app.disableHardwareAcceleration();
    
    // 使用最小配置重启
    app.relaunch({
      args: process.argv.slice(1).concat(['--safe-mode'])
    });
    
    app.exit(0);
  }

  /**
   * 清理资源
   */
  cleanup() {
    try {
      // 标记为正常关闭
      this.store.set('lastRunState.running', false);
      
      // 清理临时文件
      const tempDir = app.getPath('temp');
      const files = fs.readdirSync(tempDir);
      
      files.forEach(file => {
        if (file.startsWith('miaoda_') || file.startsWith('watchdog_')) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // 忽略错误
          }
        }
      });
    } catch (error) {
      console.error('清理资源失败:', error);
    }
  }

  /**
   * 清理旧的崩溃日志
   */
  cleanOldCrashLogs() {
    try {
      const crashesDir = path.join(app.getPath('userData'), 'crashes');
      const files = fs.readdirSync(crashesDir)
        .filter(f => f.startsWith('crash_'))
        .map(f => ({
          name: f,
          path: path.join(crashesDir, f),
          time: fs.statSync(path.join(crashesDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);
      
      // 保留最近的10个
      if (files.length > 10) {
        files.slice(10).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('清理崩溃日志失败:', error);
    }
  }

  /**
   * 检查是否在安全模式
   */
  isInSafeMode() {
    return this.store.get('safeMode', false) || 
           process.argv.includes('--safe-mode');
  }

  /**
   * 退出安全模式
   */
  exitSafeMode() {
    this.store.set('safeMode', false);
    console.log('✅ 已退出安全模式');
  }
}

module.exports = CrashRecovery;