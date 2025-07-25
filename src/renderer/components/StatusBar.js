'use strict';

/**
 * 状态栏组件
 */
class StatusBar {
  constructor() {
    this.container = null;
    this.messageTimeout = null;
    this.timeInterval = null;
  }

  /**
   * 挂载组件
   */
  mount(container) {
    this.container = container;
    this.render();
  }

  /**
   * 渲染组件
   */
  render() {
    this.container.innerHTML = `
      <div class="status-bar-content">
        <div class="status-left">
          <div class="status-item" id="env-status-item">
            <i class="icon icon-environment"></i>
            <span id="env-status-text">检查环境...</span>
          </div>
          <div class="status-separator"></div>
          <div class="status-item" id="claude-status-item">
            <i class="icon icon-claude"></i>
            <span id="claude-status-text">未运行</span>
          </div>
        </div>
        
        <div class="status-center">
          <div id="status-message" class="status-message"></div>
        </div>
        
        <div class="status-right">
          <div class="status-item" id="config-status-item">
            <i class="icon icon-config"></i>
            <span id="config-status-text">未选择配置</span>
          </div>
          <div class="status-separator"></div>
          <div class="status-item">
            <i class="icon icon-time"></i>
            <span id="time-display">${this.getCurrentTime()}</span>
          </div>
        </div>
      </div>
    `;
    
    // 开始时间更新
    this.startTimeUpdate();
  }

  /**
   * 更新环境状态
   */
  updateEnvironmentStatus(status) {
    const textEl = this.container.querySelector('#env-status-text');
    const itemEl = this.container.querySelector('#env-status-item');
    
    if (!status) {
      textEl.textContent = '检查环境...';
      itemEl.className = 'status-item';
      return;
    }
    
    if (status.summary.ready) {
      textEl.textContent = '环境就绪';
      itemEl.className = 'status-item status-ready';
    } else {
      textEl.textContent = `缺少 ${status.summary.missing.length} 个依赖`;
      itemEl.className = 'status-item status-warning';
    }
  }

  /**
   * 更新 Claude 状态
   */
  updateClaudeStatus(status) {
    const textEl = this.container.querySelector('#claude-status-text');
    const itemEl = this.container.querySelector('#claude-status-item');
    
    if (status.running) {
      textEl.textContent = `运行中 (端口: ${status.port})`;
      itemEl.className = 'status-item status-running';
    } else {
      textEl.textContent = '未运行';
      itemEl.className = 'status-item';
    }
  }

  /**
   * 更新配置状态
   */
  updateConfigStatus(config) {
    const textEl = this.container.querySelector('#config-status-text');
    
    if (config) {
      textEl.textContent = config.name;
    } else {
      textEl.textContent = '未选择配置';
    }
  }

  /**
   * 显示消息
   */
  showMessage(message, type = 'info', duration = 3000) {
    const messageEl = this.container.querySelector('#status-message');
    
    // 清除之前的超时
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }
    
    // 设置消息
    messageEl.textContent = message;
    messageEl.className = `status-message show ${type}`;
    
    // 自动隐藏
    if (duration > 0) {
      this.messageTimeout = setTimeout(() => {
        messageEl.classList.remove('show');
        this.messageTimeout = null;
      }, duration);
    }
  }

  /**
   * 显示成功消息
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * 显示错误消息
   */
  showError(message) {
    this.showMessage(message, 'error', 5000);
  }

  /**
   * 显示警告消息
   */
  showWarning(message) {
    this.showMessage(message, 'warning', 4000);
  }

  /**
   * 显示信息消息
   */
  showInfo(message) {
    this.showMessage(message, 'info');
  }

  /**
   * 获取当前时间
   */
  getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 开始时间更新
   */
  startTimeUpdate() {
    // 立即更新一次
    const timeEl = this.container.querySelector('#time-display');
    timeEl.textContent = this.getCurrentTime();
    
    // 每分钟更新
    this.timeInterval = setInterval(() => {
      timeEl.textContent = this.getCurrentTime();
    }, 60000);
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = null;
    }
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }
}

module.exports = { StatusBar };