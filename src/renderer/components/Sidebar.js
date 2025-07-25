'use strict';

const EventEmitter = require('events');

/**
 * 侧边栏组件
 */
class Sidebar extends EventEmitter {
  constructor() {
    super();
    this.container = null;
    this.configs = [];
    this.currentConfig = null;
    this.environmentStatus = null;
    this.claudeStatus = null;
  }

  /**
   * 挂载组件
   */
  mount(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  /**
   * 渲染组件
   */
  render() {
    this.container.innerHTML = `
      <div class="sidebar-content">
        <!-- Logo 区域 -->
        <div class="sidebar-logo">
          <img src="assets/logo.png" alt="Miaoda">
          <span class="version">v${window.electronAPI.appVersion || '2.1.0'}</span>
        </div>
        
        <!-- 环境状态 -->
        <div class="sidebar-section">
          <div class="section-header">
            <i class="icon icon-environment"></i>
            <span>环境状态</span>
            <button class="btn-icon" id="btn-env-details" title="查看详情">
              <i class="icon icon-info"></i>
            </button>
          </div>
          <div id="env-status" class="env-status">
            <div class="status-loading">检查中...</div>
          </div>
        </div>
        
        <!-- 配置列表 -->
        <div class="sidebar-section">
          <div class="section-header">
            <i class="icon icon-config"></i>
            <span>配置管理</span>
            <button class="btn-icon" id="btn-manage-configs" title="管理配置">
              <i class="icon icon-settings"></i>
            </button>
          </div>
          <div id="config-list" class="config-list">
            <div class="config-empty">暂无配置</div>
          </div>
        </div>
        
        <!-- 快捷操作 -->
        <div class="sidebar-section">
          <div class="section-header">
            <i class="icon icon-tools"></i>
            <span>快捷操作</span>
          </div>
          <div class="quick-actions">
            <button class="action-btn" id="btn-install-deps">
              <i class="icon icon-download"></i>
              <span>安装依赖</span>
            </button>
            <button class="action-btn primary" id="btn-toggle-claude">
              <i class="icon icon-play"></i>
              <span>启动 Claude</span>
            </button>
          </div>
        </div>
        
        <!-- Claude 状态 -->
        <div class="sidebar-section">
          <div class="section-header">
            <i class="icon icon-status"></i>
            <span>Claude 状态</span>
          </div>
          <div id="claude-status" class="claude-status">
            <div class="status-item">
              <span class="label">状态:</span>
              <span class="value" id="claude-state">未运行</span>
            </div>
            <div class="status-item" id="claude-port-item" style="display: none;">
              <span class="label">端口:</span>
              <span class="value" id="claude-port">-</span>
            </div>
            <div class="status-item" id="claude-runtime-item" style="display: none;">
              <span class="label">运行时间:</span>
              <span class="value" id="claude-runtime">-</span>
            </div>
          </div>
        </div>
        
        <!-- 底部链接 -->
        <div class="sidebar-footer">
          <a href="#" id="link-docs">
            <i class="icon icon-book"></i>
            <span>文档</span>
          </a>
          <a href="#" id="link-github">
            <i class="icon icon-github"></i>
            <span>GitHub</span>
          </a>
          <a href="#" id="link-about">
            <i class="icon icon-info"></i>
            <span>关于</span>
          </a>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 环境详情
    this.container.querySelector('#btn-env-details').addEventListener('click', () => {
      this.emit('show-environment');
    });
    
    // 管理配置
    this.container.querySelector('#btn-manage-configs').addEventListener('click', () => {
      this.emit('show-configs');
    });
    
    // 安装依赖
    this.container.querySelector('#btn-install-deps').addEventListener('click', () => {
      this.emit('show-installer');
    });
    
    // 切换 Claude
    this.container.querySelector('#btn-toggle-claude').addEventListener('click', () => {
      this.emit('toggle-claude');
    });
    
    // 配置列表点击
    this.container.querySelector('#config-list').addEventListener('click', (e) => {
      const configItem = e.target.closest('.config-item');
      if (configItem) {
        const configId = configItem.dataset.configId;
        this.selectConfig(configId);
      }
    });
    
    // 底部链接
    this.container.querySelector('#link-docs').addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal('https://docs.miaoda.app');
    });
    
    this.container.querySelector('#link-github').addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal('https://github.com/miounet11/claude-code-manager');
    });
    
    this.container.querySelector('#link-about').addEventListener('click', (e) => {
      e.preventDefault();
      this.showAbout();
    });
  }

  /**
   * 更新环境状态
   */
  updateEnvironmentStatus(status) {
    this.environmentStatus = status;
    const container = this.container.querySelector('#env-status');
    
    if (!status) {
      container.innerHTML = '<div class="status-loading">检查中...</div>';
      return;
    }
    
    const { summary } = status;
    let html = '';
    
    if (summary.ready) {
      html = `
        <div class="status-ready">
          <i class="icon icon-check-circle"></i>
          <span>环境就绪</span>
        </div>
      `;
    } else {
      html = `
        <div class="status-warning">
          <i class="icon icon-warning"></i>
          <span>${summary.message}</span>
        </div>
        <div class="missing-deps">
          ${summary.missing.map(dep => `<span class="dep">${dep}</span>`).join('')}
        </div>
      `;
    }
    
    container.innerHTML = html;
  }

  /**
   * 更新配置列表
   */
  updateConfigs(configs, currentConfig) {
    this.configs = configs;
    this.currentConfig = currentConfig;
    
    const container = this.container.querySelector('#config-list');
    
    if (configs.length === 0) {
      container.innerHTML = '<div class="config-empty">暂无配置</div>';
      return;
    }
    
    const html = configs.map(config => `
      <div class="config-item ${currentConfig?.id === config.id ? 'active' : ''}" 
           data-config-id="${config.id}">
        <div class="config-name">${this.escapeHtml(config.name)}</div>
        <div class="config-model">${this.escapeHtml(config.model || '未设置')}</div>
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

  /**
   * 更新 Claude 状态
   */
  updateClaudeStatus(status) {
    this.claudeStatus = status;
    
    const stateEl = this.container.querySelector('#claude-state');
    const portItem = this.container.querySelector('#claude-port-item');
    const portEl = this.container.querySelector('#claude-port');
    const runtimeItem = this.container.querySelector('#claude-runtime-item');
    const runtimeEl = this.container.querySelector('#claude-runtime');
    const toggleBtn = this.container.querySelector('#btn-toggle-claude');
    
    if (status.running) {
      stateEl.textContent = '运行中';
      stateEl.className = 'value status-running';
      
      portItem.style.display = 'flex';
      portEl.textContent = status.port || '-';
      
      runtimeItem.style.display = 'flex';
      runtimeEl.textContent = this.formatRuntime(status.runtime);
      
      toggleBtn.innerHTML = '<i class="icon icon-stop"></i><span>停止 Claude</span>';
      toggleBtn.classList.add('danger');
      toggleBtn.classList.remove('primary');
    } else {
      stateEl.textContent = '未运行';
      stateEl.className = 'value status-stopped';
      
      portItem.style.display = 'none';
      runtimeItem.style.display = 'none';
      
      toggleBtn.innerHTML = '<i class="icon icon-play"></i><span>启动 Claude</span>';
      toggleBtn.classList.add('primary');
      toggleBtn.classList.remove('danger');
    }
  }

  /**
   * 选择配置
   */
  async selectConfig(configId) {
    const config = this.configs.find(c => c.id === configId);
    if (!config) return;
    
    try {
      await window.electronAPI.setCurrentConfig(configId);
      this.currentConfig = config;
      
      // 更新 UI
      this.container.querySelectorAll('.config-item').forEach(item => {
        item.classList.toggle('active', item.dataset.configId === configId);
      });
      
      this.emit('config-selected', config);
    } catch (error) {
      window.electronAPI.showError('切换配置失败', error.message);
    }
  }

  /**
   * 显示关于
   */
  async showAbout() {
    const version = await window.electronAPI.getAppVersion();
    window.electronAPI.showInfo(
      '关于 Miaoda',
      `Miaoda - Claude Code Manager\n版本: ${version}\n\n专业的 Claude Code 部署和管理工具`
    );
  }

  /**
   * 格式化运行时间
   */
  formatRuntime(ms) {
    if (!ms) return '-';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 转义 HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

module.exports = { Sidebar };