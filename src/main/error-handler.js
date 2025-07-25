'use strict';

const { dialog, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * 全局错误处理器
 * 统一处理应用中的所有错误
 */
class ErrorHandler {
  constructor() {
    this.mainWindow = null;
    this.logFile = null;
    this.errorQueue = [];
    this.isInitialized = false;
  }

  /**
   * 初始化错误处理器
   */
  async initialize(mainWindow) {
    this.mainWindow = mainWindow;
    
    // 设置日志文件路径
    const logDir = path.join(app.getPath('userData'), 'logs');
    await this.ensureDirectory(logDir);
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    this.logFile = path.join(logDir, `error-${timestamp}.log`);
    
    // 注册全局错误处理器
    this.registerGlobalHandlers();
    
    this.isInitialized = true;
    
    // 处理队列中的错误
    while (this.errorQueue.length > 0) {
      const error = this.errorQueue.shift();
      await this.handle(error.error, error.context);
    }
  }

  /**
   * 注册全局错误处理器
   */
  registerGlobalHandlers() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.handle(error, {
        type: 'uncaughtException',
        fatal: true
      });
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.handle(reason, {
        type: 'unhandledRejection',
        promise: promise.toString(),
        fatal: false
      });
    });

    // Electron 特定错误
    if (app) {
      app.on('render-process-gone', (event, webContents, details) => {
        this.handle(new Error('渲染进程崩溃'), {
          type: 'render-process-gone',
          details,
          fatal: true
        });
      });

      app.on('child-process-gone', (event, details) => {
        this.handle(new Error('子进程崩溃'), {
          type: 'child-process-gone',
          details,
          fatal: false
        });
      });
    }
  }

  /**
   * 处理错误
   */
  async handle(error, context = {}) {
    // 如果还未初始化，将错误加入队列
    if (!this.isInitialized) {
      this.errorQueue.push({ error, context });
      return;
    }

    // 构建错误信息
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || '无堆栈信息',
      context,
      platform: process.platform,
      version: app?.getVersion() || 'unknown',
      nodeVersion: process.version
    };

    // 记录到日志
    await this.logError(errorInfo);

    // 记录到控制台
    console.error('错误处理器:', errorInfo);

    // 发送到渲染进程（如果需要）
    this.notifyRenderer(errorInfo);

    // 根据错误严重性决定是否显示对话框
    if (context.fatal || context.showDialog) {
      this.showErrorDialog(errorInfo);
    }

    // 如果是致命错误，可能需要重启应用
    if (context.fatal && context.autoRestart) {
      this.scheduleRestart();
    }
  }

  /**
   * 记录错误到日志文件
   */
  async logError(errorInfo) {
    try {
      const logEntry = JSON.stringify(errorInfo, null, 2) + '\n\n';
      await fs.appendFile(this.logFile, logEntry, 'utf8');
    } catch (writeError) {
      console.error('写入错误日志失败:', writeError);
    }
  }

  /**
   * 通知渲染进程
   */
  notifyRenderer(errorInfo) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('error:occurred', {
        message: errorInfo.message,
        type: errorInfo.context.type,
        fatal: errorInfo.context.fatal
      });
    }
  }

  /**
   * 显示错误对话框
   */
  showErrorDialog(errorInfo) {
    const options = {
      type: 'error',
      title: '应用错误',
      message: errorInfo.context.fatal ? '发生严重错误' : '发生错误',
      detail: `${errorInfo.message}\n\n是否查看详细信息？`,
      buttons: ['查看详情', '忽略'],
      defaultId: 1,
      cancelId: 1
    };

    const response = dialog.showMessageBoxSync(options);
    
    if (response === 0) {
      // 显示详细错误信息
      dialog.showMessageBoxSync({
        type: 'info',
        title: '错误详情',
        message: '错误详细信息',
        detail: `时间: ${errorInfo.timestamp}\n错误: ${errorInfo.message}\n类型: ${errorInfo.context.type || '未知'}\n\n堆栈:\n${errorInfo.stack}`,
        buttons: ['确定']
      });
    }
  }

  /**
   * 计划重启应用
   */
  scheduleRestart() {
    dialog.showMessageBoxSync({
      type: 'error',
      title: '应用需要重启',
      message: '由于发生严重错误，应用需要重启。',
      buttons: ['立即重启', '稍后重启'],
      defaultId: 0
    }).then((response) => {
      if (response === 0) {
        app.relaunch();
        app.exit(0);
      }
    });
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('创建日志目录失败:', error);
    }
  }

  /**
   * 获取最近的错误日志
   */
  async getRecentErrors(count = 10) {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const entries = content.trim().split('\n\n').filter(Boolean);
      return entries.slice(-count).map(entry => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  /**
   * 清理旧的错误日志
   */
  async cleanupOldLogs(daysToKeep = 7) {
    try {
      const logDir = path.dirname(this.logFile);
      const files = await fs.readdir(logDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('error-') || !file.endsWith('.log')) continue;
        
        const filePath = path.join(logDir, file);
        const stat = await fs.stat(filePath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('清理旧日志失败:', error);
    }
  }

  /**
   * 创建错误报告
   */
  async createErrorReport() {
    const errors = await this.getRecentErrors(50);
    const report = {
      generatedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      errors
    };
    
    return report;
  }
}

// 导出单例
module.exports = new ErrorHandler();