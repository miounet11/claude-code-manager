'use strict';

/**
 * 保活机制控制界面
 * 提供用户界面来管理和监控保活机制
 */

class GuardianControl {
  constructor() {
    this.status = null;
    this.isInitialized = false;
    
    this.initializeUI();
    this.bindEvents();
    this.startStatusPolling();
  }

  /**
   * 初始化用户界面
   */
  initializeUI() {
    const guardianPanel = document.createElement('div');
    guardianPanel.id = 'guardian-control-panel';
    guardianPanel.className = 'guardian-panel';
    guardianPanel.innerHTML = `
      <div class="guardian-header">
        <h3>🛡️ 保活机制控制</h3>
        <div class="guardian-status-indicator" id="guardian-status">
          <span class="status-dot offline"></span>
          <span class="status-text">初始化中...</span>
        </div>
      </div>
      
      <div class="guardian-content">
        <div class="protection-level-section">
          <h4>保护级别</h4>
          <div class="protection-levels">
            <label class="protection-option">
              <input type="radio" name="protection" value="minimum">
              <span class="option-label">🟢 最低保护</span>
              <small>基础保护，不影响正常使用</small>
            </label>
            <label class="protection-option">
              <input type="radio" name="protection" value="moderate">
              <span class="option-label">🟡 中等保护</span>
              <small>平衡保护与性能</small>
            </label>
            <label class="protection-option">
              <input type="radio" name="protection" value="maximum" checked>
              <span class="option-label">🔴 最高保护</span>
              <small>最强保护，防止一切卸载尝试</small>
            </label>
          </div>
        </div>

        <div class="guardian-features">
          <h4>保活功能状态</h4>
          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">🔄</span>
              <span class="feature-name">进程守护</span>
              <span class="feature-status" id="process-guardian-status">检查中...</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🚀</span>
              <span class="feature-name">开机启动</span>
              <span class="feature-status" id="auto-launch-status">检查中...</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔌</span>
              <span class="feature-name">端口管理</span>
              <span class="feature-status" id="port-manager-status">检查中...</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔐</span>
              <span class="feature-name">权限管理</span>
              <span class="feature-status" id="privileges-status">检查中...</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🏠</span>
              <span class="feature-name">系统托盘</span>
              <span class="feature-status" id="system-tray-status">检查中...</span>
            </div>
          </div>
        </div>

        <div class="guardian-controls">
          <button id="toggle-guardian" class="btn-primary">启用保活机制</button>
          <button id="request-elevation" class="btn-secondary">请求管理员权限</button>
          <button id="get-available-port" class="btn-secondary">获取可用端口</button>
          <button id="restart-guardian" class="btn-warning">重启保活机制</button>
        </div>

        <div class="guardian-stats">
          <h4>运行统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">运行时间</span>
              <span class="stat-value" id="uptime">0 分钟</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">内存使用</span>
              <span class="stat-value" id="memory-usage">0 MB</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">卸载尝试</span>
              <span class="stat-value" id="uninstall-attempts">0 次</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">当前端口</span>
              <span class="stat-value" id="current-port">未分配</span>
            </div>
          </div>
        </div>

        <div class="guardian-logs">
          <h4>保活日志</h4>
          <div class="log-container" id="guardian-logs">
            <div class="log-entry">
              <span class="log-time">${new Date().toLocaleTimeString()}</span>
              <span class="log-message">保活机制控制界面已初始化</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 找到合适的位置插入保活控制面板
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(guardianPanel);

    this.addStyles();
    console.log('✅ 保活机制控制界面已初始化');
  }

  /**
   * 添加样式
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .guardian-panel {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        margin: 20px 0;
        padding: 20px;
        color: #fff;
      }

      .guardian-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #333;
      }

      .guardian-header h3 {
        margin: 0;
        color: #4CAF50;
      }

      .guardian-status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        display: inline-block;
      }

      .status-dot.online { background: #4CAF50; }
      .status-dot.offline { background: #f44336; }
      .status-dot.warning { background: #ff9800; }

      .protection-levels {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
      }

      .protection-option {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px;
        border: 1px solid #333;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .protection-option:hover {
        background: #2a2a2a;
      }

      .protection-option input[type="radio"] {
        margin-top: 2px;
      }

      .option-label {
        font-weight: bold;
        margin-bottom: 5px;
      }

      .protection-option small {
        color: #888;
        display: block;
      }

      .feature-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
      }

      .feature-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #2a2a2a;
        border-radius: 5px;
      }

      .feature-icon {
        font-size: 16px;
        width: 20px;
      }

      .feature-name {
        flex: 1;
        font-weight: 500;
      }

      .feature-status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 3px;
        background: #333;
      }

      .feature-status.active {
        background: #4CAF50;
        color: white;
      }

      .feature-status.inactive {
        background: #f44336;
        color: white;
      }

      .guardian-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }

      .guardian-controls button {
        padding: 8px 16px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .btn-primary {
        background: #4CAF50;
        color: white;
      }

      .btn-primary:hover {
        background: #45a049;
      }

      .btn-secondary {
        background: #2196F3;
        color: white;
      }

      .btn-secondary:hover {
        background: #1976D2;
      }

      .btn-warning {
        background: #ff9800;
        color: white;
      }

      .btn-warning:hover {
        background: #e68900;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 12px;
        background: #2a2a2a;
        border-radius: 5px;
        text-align: center;
      }

      .stat-label {
        font-size: 12px;
        color: #888;
      }

      .stat-value {
        font-size: 16px;
        font-weight: bold;
        color: #4CAF50;
      }

      .log-container {
        background: #0a0a0a;
        border: 1px solid #333;
        border-radius: 5px;
        padding: 10px;
        max-height: 200px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }

      .log-entry {
        display: flex;
        gap: 10px;
        margin-bottom: 5px;
        padding: 2px 0;
      }

      .log-time {
        color: #888;
        white-space: nowrap;
      }

      .log-message {
        color: #fff;
      }

      .guardian-content h4 {
        color: #4CAF50;
        margin-bottom: 10px;
        margin-top: 20px;
      }

      .guardian-content h4:first-child {
        margin-top: 0;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 保护级别变更
    document.querySelectorAll('input[name="protection"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.changeProtectionLevel(e.target.value);
      });
    });

    // 控制按钮
    document.getElementById('toggle-guardian')?.addEventListener('click', () => {
      this.toggleGuardian();
    });

    document.getElementById('request-elevation')?.addEventListener('click', () => {
      this.requestElevation();
    });

    document.getElementById('get-available-port')?.addEventListener('click', () => {
      this.getAvailablePort();
    });

    document.getElementById('restart-guardian')?.addEventListener('click', () => {
      this.restartGuardian();
    });

    // 监听来自主进程的状态更新
    window.electronAPI?.onGuardianStatusUpdate((status) => {
      this.updateStatus(status);
    });
  }

  /**
   * 开始状态轮询
   */
  startStatusPolling() {
    // 立即获取一次状态
    this.fetchStatus();
    
    // 每10秒更新一次状态
    setInterval(() => {
      this.fetchStatus();
    }, 10000);
  }

  /**
   * 获取保活机制状态
   */
  async fetchStatus() {
    try {
      const result = await window.electronAPI?.getGuardianStatus();
      if (result?.success) {
        this.updateStatus(result.status);
      }
    } catch (error) {
      console.error('获取保活状态失败:', error);
      this.addLog('获取保活状态失败: ' + error.message);
    }
  }

  /**
   * 更新状态显示
   */
  updateStatus(status) {
    this.status = status;
    
    // 更新主状态指示器
    const statusIndicator = document.getElementById('guardian-status');
    const dot = statusIndicator?.querySelector('.status-dot');
    const text = statusIndicator?.querySelector('.status-text');
    
    if (status.processGuardian?.isActive) {
      dot?.classList.remove('offline', 'warning');
      dot?.classList.add('online');
      text && (text.textContent = '保活机制已启用');
    } else {
      dot?.classList.remove('online', 'warning');
      dot?.classList.add('offline');
      text && (text.textContent = '保活机制已禁用');
    }

    // 更新功能状态
    this.updateFeatureStatus('process-guardian-status', 
      status.processGuardian?.isActive ? '已启用' : '已禁用');
    
    this.updateFeatureStatus('auto-launch-status', 
      status.processGuardian?.autoLaunch ? '已启用' : '已禁用');
    
    this.updateFeatureStatus('port-manager-status', 
      status.processGuardian?.currentPort ? `端口 ${status.processGuardian.currentPort}` : '未分配');
    
    this.updateFeatureStatus('privileges-status', 
      status.systemPrivileges?.isElevated ? '已获得' : '未获得');
    
    this.updateFeatureStatus('system-tray-status', 
      status.systemTray?.isCreated ? '已启用' : '已禁用');

    // 更新统计信息
    if (status.processGuardian) {
      const pg = status.processGuardian;
      document.getElementById('uptime').textContent = 
        `${Math.floor(pg.uptime / 60)} 分钟`;
      document.getElementById('memory-usage').textContent = 
        `${Math.round(pg.memoryUsage?.heapUsed / 1024 / 1024 || 0)} MB`;
      document.getElementById('uninstall-attempts').textContent = 
        `${pg.uninstallAttempts || 0} 次`;
      document.getElementById('current-port').textContent = 
        pg.currentPort || '未分配';
    }

    // 更新保护级别选择
    const protectionLevel = status.processGuardian?.protectionLevel || 'maximum';
    const radioButton = document.querySelector(`input[name="protection"][value="${protectionLevel}"]`);
    if (radioButton) {
      radioButton.checked = true;
    }

    // 更新控制按钮
    const toggleButton = document.getElementById('toggle-guardian');
    if (toggleButton) {
      if (status.processGuardian?.isActive) {
        toggleButton.textContent = '停用保活机制';
        toggleButton.className = 'btn-warning';
      } else {
        toggleButton.textContent = '启用保活机制';
        toggleButton.className = 'btn-primary';
      }
    }
  }

  /**
   * 更新功能状态显示
   */
  updateFeatureStatus(elementId, statusText) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = statusText;
      element.className = 'feature-status';
      
      if (statusText.includes('已启用') || statusText.includes('已获得') || statusText.includes('端口')) {
        element.classList.add('active');
      } else {
        element.classList.add('inactive');
      }
    }
  }

  /**
   * 更改保护级别
   */
  async changeProtectionLevel(level) {
    try {
      const result = await window.electronAPI?.setProtectionLevel(level);
      if (result?.success) {
        this.addLog(`保护级别已设置为: ${level}`);
      } else {
        this.addLog(`设置保护级别失败: ${result?.error}`);
      }
    } catch (error) {
      console.error('设置保护级别失败:', error);
      this.addLog('设置保护级别失败: ' + error.message);
    }
  }

  /**
   * 切换保活机制
   */
  async toggleGuardian() {
    try {
      const isActive = this.status?.processGuardian?.isActive;
      const result = await window.electronAPI?.toggleGuardian(!isActive);
      
      if (result?.success) {
        this.addLog(result.message);
        // 立即刷新状态
        setTimeout(() => this.fetchStatus(), 1000);
      } else {
        this.addLog(`操作失败: ${result?.error}`);
      }
    } catch (error) {
      console.error('切换保活机制失败:', error);
      this.addLog('操作失败: ' + error.message);
    }
  }

  /**
   * 请求权限提升
   */
  async requestElevation() {
    try {
      this.addLog('正在请求管理员权限...');
      const result = await window.electronAPI?.requestElevation();
      
      if (result?.success) {
        this.addLog(result.elevated ? '管理员权限获取成功' : '用户取消权限请求');
      } else {
        this.addLog(`权限请求失败: ${result?.error}`);
      }
    } catch (error) {
      console.error('权限请求失败:', error);
      this.addLog('权限请求失败: ' + error.message);
    }
  }

  /**
   * 获取可用端口
   */
  async getAvailablePort() {
    try {
      const result = await window.electronAPI?.getAvailablePort();
      
      if (result?.success) {
        this.addLog(`可用端口: ${result.port}`);
      } else {
        this.addLog(`获取端口失败: ${result?.error}`);
      }
    } catch (error) {
      console.error('获取端口失败:', error);
      this.addLog('获取端口失败: ' + error.message);
    }
  }

  /**
   * 重启保活机制
   */
  async restartGuardian() {
    try {
      this.addLog('正在重启保活机制...');
      
      // 先停止
      await window.electronAPI?.toggleGuardian(false);
      
      // 等待1秒后重新启动
      setTimeout(async () => {
        const result = await window.electronAPI?.toggleGuardian(true);
        if (result?.success) {
          this.addLog('保活机制重启成功');
        } else {
          this.addLog(`重启失败: ${result?.error}`);
        }
        
        // 刷新状态
        setTimeout(() => this.fetchStatus(), 1000);
      }, 1000);
      
    } catch (error) {
      console.error('重启保活机制失败:', error);
      this.addLog('重启失败: ' + error.message);
    }
  }

  /**
   * 添加日志条目
   */
  addLog(message) {
    const logContainer = document.getElementById('guardian-logs');
    if (logContainer) {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      logEntry.innerHTML = `
        <span class="log-time">${new Date().toLocaleTimeString()}</span>
        <span class="log-message">${message}</span>
      `;
      
      logContainer.appendChild(logEntry);
      
      // 保持最新的50条日志
      const entries = logContainer.querySelectorAll('.log-entry');
      if (entries.length > 50) {
        entries[0].remove();
      }
      
      // 滚动到底部
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    console.log(`[Guardian] ${message}`);
  }
}

// 页面加载完成后初始化保活控制界面
document.addEventListener('DOMContentLoaded', () => {
  // 延迟初始化，确保其他组件已加载
  setTimeout(() => {
    window.guardianControl = new GuardianControl();
  }, 1000);
});