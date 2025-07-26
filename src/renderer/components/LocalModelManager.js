'use strict';

/**
 * 本地模型管理器组件
 * 管理 Ollama 等本地模型服务
 */
class LocalModelManager {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.services = {};
    this.selectedService = 'ollama';
    this.isRefreshing = false;
  }

  /**
   * 显示管理器
   */
  async show(container) {
    this.container = container;
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal local-model-manager';
    
    // 初始检测
    await this.detectServices();
    
    // 渲染内容
    this.modalElement.innerHTML = this.render();
    
    // 添加到容器
    this.container.appendChild(this.modalElement);
    
    // 绑定事件
    this.bindEvents();
    
    // 显示动画
    requestAnimationFrame(() => {
      this.modalElement.classList.add('show');
    });
    
    // 开始监听服务检测事件
    this.startListening();
  }

  /**
   * 检测本地服务
   */
  async detectServices() {
    try {
      const results = await window.electronAPI.detectLocalModels();
      this.services = results;
    } catch (error) {
      console.error('检测本地服务失败:', error);
    }
  }

  /**
   * 渲染内容
   */
  render() {
    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>本地模型管理</h2>
          <button class="btn-close" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="local-model-layout">
            <!-- 服务选择 -->
            <div class="service-tabs">
              ${this.renderServiceTabs()}
            </div>
            
            <!-- 服务内容 -->
            <div class="service-content">
              ${this.renderServiceContent()}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn" data-action="close">关闭</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染服务标签
   */
  renderServiceTabs() {
    const tabs = [
      { id: 'ollama', name: 'Ollama', icon: '🦙' },
      { id: 'lmstudio', name: 'LM Studio', icon: '🖥️' },
      { id: 'localai', name: 'LocalAI', icon: '🤖' }
    ];

    return tabs.map(tab => {
      const service = this.services[tab.id];
      const isActive = this.selectedService === tab.id;
      const isAvailable = service?.available;
      
      return `
        <div class="service-tab ${isActive ? 'active' : ''} ${isAvailable ? 'available' : ''}"
             data-service="${tab.id}">
          <span class="tab-icon">${tab.icon}</span>
          <span class="tab-name">${tab.name}</span>
          <span class="tab-status">
            ${isAvailable ? '✓' : '×'}
          </span>
        </div>
      `;
    }).join('');
  }

  /**
   * 渲染服务内容
   */
  renderServiceContent() {
    const service = this.services[this.selectedService];
    
    if (!service) {
      return '<div class="service-loading">检测中...</div>';
    }
    
    if (!service.available) {
      return this.renderServiceUnavailable();
    }
    
    return this.renderServiceAvailable(service);
  }

  /**
   * 渲染服务不可用
   */
  renderServiceUnavailable() {
    const serviceNames = {
      ollama: 'Ollama',
      lmstudio: 'LM Studio',
      localai: 'LocalAI'
    };
    
    const installGuides = {
      ollama: {
        url: 'https://ollama.ai',
        steps: [
          '访问 https://ollama.ai 下载安装包',
          '运行安装程序',
          '在终端运行: ollama serve'
        ]
      },
      lmstudio: {
        url: 'https://lmstudio.ai',
        steps: [
          '访问 https://lmstudio.ai 下载应用',
          '打开 LM Studio',
          '在设置中启用本地服务器'
        ]
      },
      localai: {
        url: 'https://localai.io',
        steps: [
          '使用 Docker: docker run -p 8080:8080 localai/localai',
          '或使用二进制文件安装',
          '启动服务: localai'
        ]
      }
    };
    
    const guide = installGuides[this.selectedService];
    const name = serviceNames[this.selectedService];
    
    return `
      <div class="service-unavailable">
        <div class="unavailable-icon">⚠️</div>
        <h3>${name} 未运行</h3>
        <p>未检测到 ${name} 服务，请确保已安装并启动。</p>
        
        <div class="install-guide">
          <h4>安装指南：</h4>
          <ol>
            ${guide.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
          
          <a href="${guide.url}" class="btn btn-primary" id="btn-visit-site">
            访问官网
          </a>
        </div>
        
        <button class="btn" id="btn-refresh-service">
          <i class="icon icon-refresh"></i>
          重新检测
        </button>
      </div>
    `;
  }

  /**
   * 渲染服务可用
   */
  renderServiceAvailable(service) {
    return `
      <div class="service-available">
        <div class="service-info">
          <div class="info-item">
            <span class="label">状态：</span>
            <span class="value success">运行中</span>
          </div>
          <div class="info-item">
            <span class="label">地址：</span>
            <span class="value">${service.baseUrl}</span>
          </div>
          <div class="info-item">
            <span class="label">模型数量：</span>
            <span class="value">${service.models?.length || 0}</span>
          </div>
        </div>
        
        <div class="model-actions">
          <button class="btn btn-primary" id="btn-pull-model">
            <i class="icon icon-download"></i>
            拉取新模型
          </button>
          <button class="btn" id="btn-refresh-models">
            <i class="icon icon-refresh"></i>
            刷新列表
          </button>
        </div>
        
        <div class="model-list">
          <h4>已安装的模型</h4>
          ${this.renderModelList(service.models)}
        </div>
      </div>
    `;
  }

  /**
   * 渲染模型列表
   */
  renderModelList(models) {
    if (!models || models.length === 0) {
      return '<div class="model-empty">暂无已安装的模型</div>';
    }
    
    return `
      <div class="models-grid">
        ${models.map(model => `
          <div class="model-item">
            <div class="model-header">
              <h5 class="model-name">${model.name}</h5>
              <button class="btn-icon danger" data-action="delete-model" data-model="${model.id}">
                <i class="icon icon-trash"></i>
              </button>
            </div>
            <div class="model-details">
              ${model.size ? `<span class="detail-item">大小: ${model.size}</span>` : ''}
              ${model.modified ? `<span class="detail-item">更新: ${this.formatDate(model.modified)}</span>` : ''}
              ${model.details?.parameter_size ? `<span class="detail-item">参数: ${model.details.parameter_size}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 关闭按钮
    this.modalElement.querySelectorAll('[data-action="close"]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });
    
    // 服务标签切换
    this.modalElement.querySelectorAll('.service-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const serviceId = e.currentTarget.dataset.service;
        this.selectService(serviceId);
      });
    });
    
    // 刷新服务
    const refreshBtn = this.modalElement.querySelector('#btn-refresh-service');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshService());
    }
    
    // 刷新模型
    const refreshModelsBtn = this.modalElement.querySelector('#btn-refresh-models');
    if (refreshModelsBtn) {
      refreshModelsBtn.addEventListener('click', () => this.refreshModels());
    }
    
    // 拉取模型
    const pullBtn = this.modalElement.querySelector('#btn-pull-model');
    if (pullBtn) {
      pullBtn.addEventListener('click', () => this.showPullDialog());
    }
    
    // 删除模型
    this.modalElement.querySelectorAll('[data-action="delete-model"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modelId = e.currentTarget.dataset.model;
        this.deleteModel(modelId);
      });
    });
    
    // 访问官网
    const visitBtn = this.modalElement.querySelector('#btn-visit-site');
    if (visitBtn) {
      visitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal(e.target.href);
      });
    }
  }

  /**
   * 选择服务
   */
  selectService(serviceId) {
    this.selectedService = serviceId;
    this.updateView();
  }

  /**
   * 刷新服务
   */
  async refreshService() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    const btn = this.modalElement.querySelector('#btn-refresh-service');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="icon icon-loading"></i> 检测中...';
    }
    
    try {
      await this.detectServices();
      this.updateView();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 刷新模型列表
   */
  async refreshModels() {
    const btn = this.modalElement.querySelector('#btn-refresh-models');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="icon icon-loading"></i> 刷新中...';
    }
    
    try {
      const models = await window.electronAPI.getLocalModels(this.selectedService);
      if (this.services[this.selectedService]) {
        this.services[this.selectedService].models = models;
      }
      this.updateView();
    } catch (error) {
      this.showError('刷新模型列表失败: ' + error.message);
    }
  }

  /**
   * 显示拉取对话框
   */
  showPullDialog() {
    const modelName = prompt('请输入要拉取的模型名称（如 llama2, mistral, codellama）：');
    if (modelName) {
      this.pullModel(modelName);
    }
  }

  /**
   * 拉取模型
   */
  async pullModel(modelName) {
    // 创建进度对话框
    const progressDialog = this.createProgressDialog(modelName);
    document.body.appendChild(progressDialog);
    
    try {
      await window.electronAPI.pullLocalModel(modelName);
      progressDialog.remove();
      this.showSuccess(`模型 ${modelName} 拉取成功！`);
      await this.refreshModels();
    } catch (error) {
      progressDialog.remove();
      this.showError(`拉取模型失败: ${error.message}`);
    }
  }

  /**
   * 创建进度对话框
   */
  createProgressDialog(modelName) {
    const dialog = document.createElement('div');
    dialog.className = 'modal progress-dialog show';
    dialog.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content modal-small">
        <div class="modal-header">
          <h3>正在拉取模型</h3>
        </div>
        <div class="modal-body">
          <p>正在拉取 ${modelName}，请稍候...</p>
          <div class="progress-bar">
            <div class="progress-fill" id="pull-progress"></div>
          </div>
          <div id="progress-status">准备中...</div>
        </div>
      </div>
    `;
    
    return dialog;
  }

  /**
   * 删除模型
   */
  async deleteModel(modelId) {
    const confirm = await window.electronAPI.showConfirm(
      '确认删除',
      `确定要删除模型 "${modelId}" 吗？`
    );
    
    if (!confirm) return;
    
    try {
      await window.electronAPI.deleteLocalModel(modelId);
      this.showSuccess('模型删除成功');
      await this.refreshModels();
    } catch (error) {
      this.showError(`删除模型失败: ${error.message}`);
    }
  }

  /**
   * 开始监听
   */
  startListening() {
    // 监听服务检测事件
    window.electronAPI.onLocalModelDetected((data) => {
      if (this.services[data.serviceId]) {
        this.services[data.serviceId] = data;
        this.updateView();
      }
    });
    
    // 监听模型拉取进度
    window.electronAPI.onLocalModelPullProgress((progress) => {
      const statusEl = document.getElementById('progress-status');
      const progressEl = document.getElementById('pull-progress');
      
      if (statusEl && progress.status) {
        statusEl.textContent = progress.status;
      }
      
      if (progressEl && progress.completed && progress.total) {
        const percent = (progress.completed / progress.total) * 100;
        progressEl.style.width = percent + '%';
      }
    });
  }

  /**
   * 更新视图
   */
  updateView() {
    const tabsContainer = this.modalElement.querySelector('.service-tabs');
    const contentContainer = this.modalElement.querySelector('.service-content');
    
    if (tabsContainer) {
      tabsContainer.innerHTML = this.renderServiceTabs();
    }
    
    if (contentContainer) {
      contentContainer.innerHTML = this.renderServiceContent();
    }
    
    // 重新绑定事件
    this.bindEvents();
  }

  /**
   * 关闭管理器
   */
  close() {
    if (!this.modalElement) return;
    
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

  /**
   * 格式化日期
   */
  formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 86400000) {
      return '今天';
    } else if (diff < 172800000) {
      return '昨天';
    } else {
      return d.toLocaleDateString();
    }
  }

  /**
   * 显示成功消息
   */
  showSuccess(message) {
    // TODO: 实现更好的提示
    alert(message);
  }

  /**
   * 显示错误消息
   */
  showError(message) {
    // TODO: 实现更好的提示
    alert('错误: ' + message);
  }
}

module.exports = { LocalModelManager };