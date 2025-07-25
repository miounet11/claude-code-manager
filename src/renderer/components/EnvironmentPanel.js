'use strict';

/**
 * 环境面板组件 - 显示详细的环境信息
 */
class EnvironmentPanel {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.data = null;
  }

  /**
   * 显示面板
   */
  show(container, data = null) {
    this.container = container;
    this.data = data;
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal environment-panel';
    this.modalElement.innerHTML = this.render();
    
    // 添加到容器
    this.container.appendChild(this.modalElement);
    
    // 绑定事件
    this.bindEvents();
    
    // 显示动画
    requestAnimationFrame(() => {
      this.modalElement.classList.add('show');
    });
    
    // 如果没有提供数据，加载数据
    if (!data) {
      this.loadData();
    }
  }

  /**
   * 渲染内容
   */
  render() {
    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>环境检测详情</h2>
          <button class="btn-close" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          ${this.data ? this.renderContent() : this.renderLoading()}
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-refresh">
            <i class="icon icon-refresh"></i>
            刷新
          </button>
          <button class="btn btn-primary" id="btn-install">
            <i class="icon icon-download"></i>
            安装缺失依赖
          </button>
          <button class="btn" data-action="close">关闭</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染加载中
   */
  renderLoading() {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>正在检测环境...</p>
      </div>
    `;
  }

  /**
   * 渲染内容
   */
  renderContent() {
    if (!this.data) return '';
    
    const { system, dependencies, summary } = this.data;
    
    return `
      <div class="env-sections">
        <!-- 系统信息 -->
        <div class="env-section">
          <h3>系统信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">操作系统:</span>
              <span class="value">${this.formatPlatform(system.platform)}</span>
            </div>
            <div class="info-item">
              <span class="label">架构:</span>
              <span class="value">${system.arch}</span>
            </div>
            <div class="info-item">
              <span class="label">Node 版本:</span>
              <span class="value">${system.nodeVersion}</span>
            </div>
            <div class="info-item">
              <span class="label">Home 目录:</span>
              <span class="value">${system.paths.home}</span>
            </div>
          </div>
        </div>
        
        <!-- 依赖状态 -->
        <div class="env-section">
          <h3>依赖状态</h3>
          <div class="dependencies-list">
            ${this.renderDependencies(dependencies)}
          </div>
        </div>
        
        <!-- 环境总结 -->
        <div class="env-section">
          <h3>环境总结</h3>
          <div class="summary-box ${summary.ready ? 'ready' : 'not-ready'}">
            <div class="summary-icon">
              <i class="icon ${summary.ready ? 'icon-check-circle' : 'icon-warning'}"></i>
            </div>
            <div class="summary-content">
              <p class="summary-message">${summary.message}</p>
              ${summary.issues.length > 0 ? `
                <div class="issues-list">
                  <p class="issues-title">发现的问题:</p>
                  <ul>
                    ${summary.issues.map(issue => `<li>${issue}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- PATH 信息 -->
        <div class="env-section">
          <h3>PATH 环境变量</h3>
          <div class="path-info">
            <pre>${this.formatPath(system.paths.path)}</pre>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染依赖列表
   */
  renderDependencies(dependencies) {
    const depInfo = {
      nodejs: { name: 'Node.js', icon: 'icon-nodejs', required: true },
      git: { name: 'Git', icon: 'icon-git', required: true },
      claude: { name: 'Claude Code CLI', icon: 'icon-claude', required: true },
      uv: { name: 'UV (Python 包管理器)', icon: 'icon-python', required: false }
    };
    
    return Object.entries(dependencies).map(([key, dep]) => {
      const info = depInfo[key] || { name: key, icon: 'icon-package' };
      const installed = dep.installed;
      
      return `
        <div class="dependency-item ${installed ? 'installed' : 'not-installed'}">
          <div class="dep-icon">
            <i class="icon ${info.icon}"></i>
          </div>
          <div class="dep-info">
            <div class="dep-header">
              <span class="dep-name">${info.name}</span>
              ${info.required ? '<span class="dep-required">必需</span>' : '<span class="dep-optional">可选</span>'}
            </div>
            <div class="dep-status">
              ${installed ? `
                <i class="icon icon-check"></i>
                <span class="version">${dep.version || dep.displayVersion || '已安装'}</span>
                ${dep.path ? `<span class="path">${dep.path}</span>` : ''}
              ` : `
                <i class="icon icon-x"></i>
                <span class="error">${dep.error || '未安装'}</span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 格式化平台名称
   */
  formatPlatform(platform) {
    const platforms = {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux'
    };
    return platforms[platform] || platform;
  }

  /**
   * 格式化 PATH
   */
  formatPath(path) {
    if (!path) return '未设置';
    
    const separator = process.platform === 'win32' ? ';' : ':';
    return path.split(separator).join('\n');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 关闭按钮
    this.modalElement.querySelectorAll('[data-action="close"]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });
    
    // 刷新按钮
    this.modalElement.querySelector('#btn-refresh').addEventListener('click', () => {
      this.refresh();
    });
    
    // 安装按钮
    this.modalElement.querySelector('#btn-install').addEventListener('click', () => {
      this.installDependencies();
    });
    
    // ESC 键关闭
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * 加载数据
   */
  async loadData() {
    try {
      this.data = await window.electronAPI.checkEnvironment();
      this.update(this.data);
    } catch (error) {
      console.error('加载环境数据失败:', error);
      window.electronAPI.showError('错误', '加载环境数据失败');
    }
  }

  /**
   * 刷新
   */
  async refresh() {
    const button = this.modalElement.querySelector('#btn-refresh');
    button.disabled = true;
    button.innerHTML = '<i class="icon icon-spinner"></i> 检测中...';
    
    try {
      await this.loadData();
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="icon icon-refresh"></i> 刷新';
    }
  }

  /**
   * 安装依赖
   */
  installDependencies() {
    if (!this.data || !this.data.summary.missing.length) {
      window.electronAPI.showInfo('提示', '所有依赖都已安装！');
      return;
    }
    
    // 关闭当前面板
    this.close();
    
    // 触发安装向导
    window.app.showInstallerWizard();
  }

  /**
   * 更新数据
   */
  update(data) {
    this.data = data;
    const body = this.modalElement.querySelector('.modal-body');
    body.innerHTML = this.renderContent();
  }

  /**
   * 检查是否可见
   */
  isVisible() {
    return this.modalElement && this.modalElement.classList.contains('show');
  }

  /**
   * 关闭面板
   */
  close() {
    if (!this.modalElement) return;
    
    // 移除事件监听
    document.removeEventListener('keydown', this.escHandler);
    
    // 隐藏动画
    this.modalElement.classList.remove('show');
    
    // 移除元素
    setTimeout(() => {
      if (this.modalElement) {
        this.modalElement.remove();
        this.modalElement = null;
      }
    }, 300);
  }
}

module.exports = { EnvironmentPanel };