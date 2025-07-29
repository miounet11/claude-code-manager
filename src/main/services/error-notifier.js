'use strict';

const { dialog, Notification, BrowserWindow } = require('electron');
const EventEmitter = require('events');
// 避免循环依赖，直接定义常量
const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning', 
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * 错误通知器
 */
class ErrorNotifier extends EventEmitter {
  constructor() {
    super();
    this.mainWindow = null;
    this.notificationQueue = [];
    this.isShowingDialog = false;
    this.recentNotifications = new Map(); // 防止重复通知
    this.duplicateThreshold = 5000; // 5秒内相同错误不重复通知
  }
  
  /**
   * 设置主窗口引用
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }
  
  /**
   * 通知错误
   */
  async notify(errorInfo) {
    try {
      // 检查是否是重复通知
      if (this.isDuplicateNotification(errorInfo)) {
        console.log('Skipping duplicate notification:', errorInfo.message);
        return;
      }
      
      // 根据严重程度选择通知方式
      switch (errorInfo.severity) {
        case ErrorSeverity.INFO:
          await this.showInfo(errorInfo);
          break;
          
        case ErrorSeverity.WARNING:
          await this.showWarning(errorInfo);
          break;
          
        case ErrorSeverity.ERROR:
          await this.showError(errorInfo);
          break;
          
        case ErrorSeverity.CRITICAL:
          await this.showCritical(errorInfo);
          break;
          
        default:
          await this.showError(errorInfo);
      }
      
      // 记录通知历史
      this.recordNotification(errorInfo);
      
      // 发出事件
      this.emit('notified', errorInfo);
      
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }
  
  /**
   * 检查是否是重复通知
   */
  isDuplicateNotification(errorInfo) {
    const key = `${errorInfo.type}_${errorInfo.message}`;
    const lastNotification = this.recentNotifications.get(key);
    
    if (lastNotification) {
      const timeDiff = Date.now() - lastNotification;
      return timeDiff < this.duplicateThreshold;
    }
    
    return false;
  }
  
  /**
   * 记录通知历史
   */
  recordNotification(errorInfo) {
    const key = `${errorInfo.type}_${errorInfo.message}`;
    this.recentNotifications.set(key, Date.now());
    
    // 定期清理旧记录
    setTimeout(() => {
      this.recentNotifications.delete(key);
    }, this.duplicateThreshold);
  }
  
  /**
   * 显示信息通知
   */
  async showInfo(errorInfo) {
    // 信息级别使用系统通知
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: errorInfo.message,
        body: errorInfo.detail || errorInfo.suggestion || '',
        icon: this.getIconPath('info')
      });
      
      notification.show();
      
      notification.on('click', () => {
        this.emit('notification-clicked', errorInfo);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });
    } else {
      // 降级到控制台
      console.info(`[INFO] ${errorInfo.message}:`, errorInfo.detail);
    }
  }
  
  /**
   * 显示警告通知
   */
  async showWarning(errorInfo) {
    // 如果主窗口存在且聚焦，使用内部通知
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isFocused()) {
      this.sendToRenderer('error:warning', errorInfo);
    } else {
      // 否则使用系统通知
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: '⚠️ ' + errorInfo.message,
          body: errorInfo.detail || errorInfo.suggestion || '',
          icon: this.getIconPath('warning'),
          urgency: 'normal'
        });
        
        notification.show();
      }
    }
  }
  
  /**
   * 显示错误对话框
   */
  async showError(errorInfo) {
    // 如果正在显示对话框，加入队列
    if (this.isShowingDialog) {
      this.notificationQueue.push(errorInfo);
      return;
    }
    
    this.isShowingDialog = true;
    
    try {
      const buttons = errorInfo.actions && errorInfo.actions.length > 0 
        ? errorInfo.actions 
        : ['确定'];
      
      const detail = this.formatErrorDetail(errorInfo);
      
      const result = await dialog.showMessageBox(this.mainWindow || null, {
        type: 'error',
        title: '错误',
        message: errorInfo.message,
        detail: detail,
        buttons: buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
        noLink: true
      });
      
      // 处理用户选择
      this.emit('action-selected', {
        errorInfo,
        action: buttons[result.response],
        index: result.response
      });
      
    } finally {
      this.isShowingDialog = false;
      
      // 处理队列中的下一个通知
      if (this.notificationQueue.length > 0) {
        const next = this.notificationQueue.shift();
        this.showError(next);
      }
    }
  }
  
  /**
   * 显示严重错误
   */
  async showCritical(errorInfo) {
    // 严重错误总是显示对话框，即使有队列
    const buttons = ['重启应用', '查看日志', '退出'];
    
    if (errorInfo.actions && errorInfo.actions.length > 0) {
      buttons.unshift(...errorInfo.actions);
    }
    
    const detail = this.formatErrorDetail(errorInfo, true);
    
    const result = await dialog.showMessageBox(this.mainWindow || null, {
      type: 'error',
      title: '严重错误',
      message: '⚠️ ' + errorInfo.message,
      detail: detail,
      buttons: buttons,
      defaultId: 0,
      noLink: true
    });
    
    // 处理系统按钮
    const selectedButton = buttons[result.response];
    switch (selectedButton) {
      case '重启应用':
        const { app } = require('electron');
        app.relaunch();
        app.exit(0);
        break;
        
      case '查看日志':
        this.emit('show-logs-requested', errorInfo);
        break;
        
      case '退出':
        const { app: app2 } = require('electron');
        app2.quit();
        break;
        
      default:
        this.emit('action-selected', {
          errorInfo,
          action: selectedButton,
          index: result.response
        });
    }
  }
  
  /**
   * 格式化错误详情
   */
  formatErrorDetail(errorInfo, includeStack = false) {
    const parts = [];
    
    if (errorInfo.detail) {
      parts.push(errorInfo.detail);
    }
    
    if (errorInfo.suggestion) {
      parts.push('\n建议: ' + errorInfo.suggestion);
    }
    
    if (errorInfo.id) {
      parts.push('\n错误ID: ' + errorInfo.id);
    }
    
    if (includeStack && errorInfo.stack) {
      parts.push('\n\n技术详情:\n' + errorInfo.stack);
    }
    
    return parts.join('\n');
  }
  
  /**
   * 发送到渲染进程
   */
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
  
  /**
   * 获取图标路径
   */
  getIconPath(type) {
    // 这里可以返回实际的图标文件路径
    // 暂时返回 null，使用系统默认图标
    return null;
  }
  
  /**
   * 显示错误详情窗口
   */
  showErrorDetailsWindow(errorInfo) {
    const detailWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: this.mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: require('path').join(__dirname, '../../preload/preload.js')
      },
      title: '错误详情 - ' + errorInfo.id
    });
    
    // 加载错误详情页面
    detailWindow.loadFile('src/renderer/error-details.html');
    
    // 发送错误信息
    detailWindow.webContents.on('did-finish-load', () => {
      detailWindow.webContents.send('error:details', errorInfo);
    });
    
    this.emit('details-window-opened', errorInfo);
  }
  
  /**
   * 批量通知
   */
  async notifyBatch(errors) {
    if (errors.length === 0) return;
    
    if (errors.length === 1) {
      return this.notify(errors[0]);
    }
    
    // 多个错误，显示摘要
    const summary = {
      type: 'multiple',
      severity: ErrorSeverity.ERROR,
      message: `发生了 ${errors.length} 个错误`,
      detail: errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n'),
      actions: ['查看详情', '忽略']
    };
    
    await this.showError(summary);
  }
}

// 导出单例
module.exports = new ErrorNotifier();