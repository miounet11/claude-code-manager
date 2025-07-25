'use strict';

/**
 * 安装向导组件 - 引导用户安装缺失的依赖
 */
class InstallerWizard {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.dependencies = [];
    this.currentStep = 0;
    this.installResults = {};
  }

  /**
   * 显示安装向导
   */
  show(container, dependencies = []) {
    this.container = container;
    this.dependencies = dependencies;
    this.currentStep = 0;
    this.installResults = {};
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal installer-wizard';
    this.modalElement.innerHTML = this.render();
    
    // 添加到容器
    this.container.appendChild(this.modalElement);
    
    // 绑定事件
    this.bindEvents();
    
    // 显示动画
    requestAnimationFrame(() => {
      this.modalElement.classList.add('show');
    });
  }

  /**
   * 渲染内容
   */
  render() {
    return `
      <div class="modal-backdrop"></div>
      <div class="modal-content modal-wizard">
        <div class="wizard-header">
          <h2>依赖安装向导</h2>
          <div class="wizard-steps">
            ${this.renderSteps()}
          </div>
        </div>
        
        <div class="wizard-body">
          ${this.renderCurrentStep()}
        </div>
        
        <div class="wizard-footer">
          ${this.renderFooter()}
        </div>
      </div>
    `;
  }

  /**
   * 渲染步骤指示器
   */
  renderSteps() {
    const steps = ['检查依赖', '安装依赖', '完成'];
    
    return steps.map((step, index) => `
      <div class="wizard-step ${index === this.currentStep ? 'active' : ''} 
                              ${index < this.currentStep ? 'completed' : ''}">
        <div class="step-number">${index + 1}</div>
        <div class="step-label">${step}</div>
      </div>
    `).join('<div class="step-connector"></div>');
  }

  /**
   * 渲染当前步骤内容
   */
  renderCurrentStep() {
    switch (this.currentStep) {
      case 0:
        return this.renderCheckStep();
      case 1:
        return this.renderInstallStep();
      case 2:
        return this.renderCompleteStep();
      default:
        return '';
    }
  }

  /**
   * 渲染检查步骤
   */
  renderCheckStep() {
    const depInfo = {
      nodejs: {
        name: 'Node.js',
        description: 'JavaScript 运行时环境',
        icon: 'icon-nodejs',
        required: true
      },
      git: {
        name: 'Git',
        description: '版本控制系统',
        icon: 'icon-git',
        required: true
      },
      claude: {
        name: 'Claude Code CLI',
        description: 'Claude 命令行工具',
        icon: 'icon-claude',
        required: true
      },
      uv: {
        name: 'UV',
        description: 'Python 包管理器（可选）',
        icon: 'icon-python',
        required: false
      }
    };
    
    return `
      <div class="step-content">
        <h3>检查缺失的依赖</h3>
        <p class="step-description">
          以下依赖需要安装才能正常使用 Claude Code：
        </p>
        
        <div class="dependency-check-list">
          ${this.dependencies.map(dep => {
            const info = depInfo[dep] || { name: dep, icon: 'icon-package' };
            return `
              <div class="dependency-check-item">
                <div class="dep-icon">
                  <i class="icon ${info.icon}"></i>
                </div>
                <div class="dep-details">
                  <div class="dep-name">${info.name}</div>
                  <div class="dep-description">${info.description}</div>
                </div>
                <div class="dep-status">
                  <span class="badge badge-warning">未安装</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="step-info">
          <i class="icon icon-info"></i>
          <p>安装向导将帮助您安装这些依赖。某些依赖可能需要手动安装。</p>
        </div>
      </div>
    `;
  }

  /**
   * 渲染安装步骤
   */
  renderInstallStep() {
    return `
      <div class="step-content">
        <h3>正在安装依赖</h3>
        
        <div class="install-progress-list">
          ${this.dependencies.map(dep => `
            <div class="install-progress-item" data-dep="${dep}">
              <div class="progress-header">
                <span class="dep-name">${this.getDepName(dep)}</span>
                <span class="progress-status" data-status="pending">
                  <i class="icon icon-clock"></i>
                  等待中
                </span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
              </div>
              <div class="progress-message"></div>
            </div>
          `).join('')}
        </div>
        
        <div class="install-log" id="install-log">
          <div class="log-header">
            <i class="icon icon-terminal"></i>
            安装日志
          </div>
          <div class="log-content"></div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染完成步骤
   */
  renderCompleteStep() {
    const allSuccess = Object.values(this.installResults).every(r => r.success);
    const hasManual = Object.values(this.installResults).some(r => r.manual);
    
    return `
      <div class="step-content">
        <div class="complete-icon ${allSuccess ? 'success' : 'warning'}">
          <i class="icon ${allSuccess ? 'icon-check-circle' : 'icon-warning'}"></i>
        </div>
        
        <h3>${allSuccess ? '安装完成！' : '部分依赖需要手动安装'}</h3>
        
        <div class="install-summary">
          ${Object.entries(this.installResults).map(([dep, result]) => `
            <div class="summary-item ${result.success ? 'success' : 'failed'}">
              <i class="icon ${result.success ? 'icon-check' : 'icon-x'}"></i>
              <span class="dep-name">${this.getDepName(dep)}</span>
              <span class="result-message">${result.message || (result.success ? '安装成功' : '需要手动安装')}</span>
            </div>
          `).join('')}
        </div>
        
        ${hasManual ? this.renderManualInstructions() : ''}
        
        ${allSuccess ? `
          <div class="success-message">
            <p>所有依赖都已成功安装！您现在可以开始使用 Claude Code 了。</p>
            <p class="text-secondary">建议重启应用以确保所有环境变量生效。</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 渲染手动安装说明
   */
  renderManualInstructions() {
    const manualDeps = Object.entries(this.installResults)
      .filter(([_, result]) => result.manual && result.instructions)
      .map(([dep, result]) => ({ dep, ...result }));
    
    if (manualDeps.length === 0) return '';
    
    return `
      <div class="manual-instructions">
        <h4>手动安装说明</h4>
        ${manualDeps.map(({ dep, instructions }) => `
          <div class="instruction-block">
            <h5>${this.getDepName(dep)}</h5>
            <div class="instruction-content">
              ${instructions.steps ? 
                `<ol>${instructions.steps.map(step => `<li>${step}</li>`).join('')}</ol>` :
                `<p>${instructions}</p>`
              }
              ${instructions.downloadUrl ? 
                `<a href="#" class="download-link" data-url="${instructions.downloadUrl}">
                  <i class="icon icon-download"></i>
                  前往下载页面
                </a>` : ''
              }
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染底部按钮
   */
  renderFooter() {
    switch (this.currentStep) {
      case 0:
        return `
          <button class="btn btn-secondary" id="btn-cancel">取消</button>
          <button class="btn btn-primary" id="btn-start-install">
            开始安装
            <i class="icon icon-arrow-right"></i>
          </button>
        `;
      case 1:
        return `
          <button class="btn btn-secondary" id="btn-cancel" disabled>取消</button>
          <div class="install-status">正在安装，请稍候...</div>
        `;
      case 2:
        return `
          <button class="btn btn-primary" id="btn-close">完成</button>
        `;
      default:
        return '';
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 取消/关闭按钮
    const cancelBtn = this.modalElement.querySelector('#btn-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
    
    const closeBtn = this.modalElement.querySelector('#btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // 开始安装按钮
    const startBtn = this.modalElement.querySelector('#btn-start-install');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startInstallation());
    }
    
    // 下载链接
    this.modalElement.addEventListener('click', (e) => {
      const downloadLink = e.target.closest('.download-link');
      if (downloadLink) {
        e.preventDefault();
        const url = downloadLink.dataset.url;
        window.electronAPI.openExternal(url);
      }
    });
  }

  /**
   * 开始安装
   */
  async startInstallation() {
    this.currentStep = 1;
    this.updateView();
    
    // 监听安装进度
    window.electronAPI.onInstallProgress((progress) => {
      this.handleInstallProgress(progress);
    });
    
    // 开始批量安装
    try {
      const results = await window.electronAPI.installMultiple(this.dependencies);
      this.installResults = results;
      
      // 进入完成步骤
      this.currentStep = 2;
      this.updateView();
      
    } catch (error) {
      window.electronAPI.showError('安装失败', error.message);
    }
  }

  /**
   * 处理安装进度
   */
  handleInstallProgress(progress) {
    const logContent = this.modalElement.querySelector('.log-content');
    const progressItem = this.modalElement.querySelector(`[data-dep="${progress.dependency}"]`);
    
    if (!progressItem) return;
    
    const statusEl = progressItem.querySelector('.progress-status');
    const fillEl = progressItem.querySelector('.progress-fill');
    const messageEl = progressItem.querySelector('.progress-message');
    
    // 更新状态
    switch (progress.type || progress.status) {
      case 'progress':
      case 'installing':
        statusEl.innerHTML = '<i class="icon icon-spinner"></i> 安装中...';
        statusEl.dataset.status = 'installing';
        fillEl.style.width = '50%';
        messageEl.textContent = progress.message || '';
        break;
        
      case 'verifying':
        fillEl.style.width = '80%';
        messageEl.textContent = '验证安装...';
        break;
        
      case 'success':
        statusEl.innerHTML = '<i class="icon icon-check"></i> 完成';
        statusEl.dataset.status = 'success';
        fillEl.style.width = '100%';
        fillEl.classList.add('success');
        messageEl.textContent = progress.message || '安装成功';
        break;
        
      case 'failed':
      case 'error':
        statusEl.innerHTML = '<i class="icon icon-x"></i> 失败';
        statusEl.dataset.status = 'failed';
        fillEl.style.width = '100%';
        fillEl.classList.add('error');
        messageEl.textContent = progress.message || '安装失败';
        break;
        
      case 'manual_install':
        statusEl.innerHTML = '<i class="icon icon-hand"></i> 手动';
        statusEl.dataset.status = 'manual';
        fillEl.style.width = '100%';
        fillEl.classList.add('warning');
        messageEl.textContent = '需要手动安装';
        break;
    }
    
    // 添加日志
    if (progress.message && logContent) {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${progress.type || 'info'}`;
      logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${progress.dependency}: ${progress.message}`;
      logContent.appendChild(logEntry);
      logContent.scrollTop = logContent.scrollHeight;
    }
  }

  /**
   * 获取依赖名称
   */
  getDepName(dep) {
    const names = {
      nodejs: 'Node.js',
      git: 'Git',
      claude: 'Claude Code CLI',
      uv: 'UV'
    };
    return names[dep] || dep;
  }

  /**
   * 更新视图
   */
  updateView() {
    const body = this.modalElement.querySelector('.wizard-body');
    const footer = this.modalElement.querySelector('.wizard-footer');
    const steps = this.modalElement.querySelector('.wizard-steps');
    
    body.innerHTML = this.renderCurrentStep();
    footer.innerHTML = this.renderFooter();
    steps.innerHTML = this.renderSteps();
    
    // 重新绑定事件
    this.bindEvents();
  }

  /**
   * 检查是否可见
   */
  isVisible() {
    return this.modalElement && this.modalElement.classList.contains('show');
  }

  /**
   * 关闭向导
   */
  close() {
    if (!this.modalElement) return;
    
    // 如果安装完成，刷新环境状态
    if (this.currentStep === 2) {
      window.electronAPI.checkEnvironment();
    }
    
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

module.exports = { InstallerWizard };