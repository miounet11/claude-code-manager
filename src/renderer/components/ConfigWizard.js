'use strict';

/**
 * 配置向导组件
 * 引导用户通过简单的步骤完成 AI 服务配置
 */
class ConfigWizard {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.currentStep = 1;
    this.totalSteps = 4;
    this.wizardData = {
      service: null,
      name: '',
      apiUrl: '',
      apiKey: '',
      model: null,
      authType: 'bearer'
    };
    
    // 服务注册表（前端副本）
    this.services = this.initializeServices();
  }

  /**
   * 初始化服务列表
   */
  initializeServices() {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        icon: '🤖',
        description: 'GPT-4, GPT-3.5 等模型',
        baseUrl: 'https://api.openai.com',
        authType: 'bearer',
        popular: true
      },
      {
        id: 'claude',
        name: 'Anthropic Claude',
        icon: '🧠',
        description: 'Claude 3 Opus, Sonnet, Haiku',
        baseUrl: 'https://api.anthropic.com',
        authType: 'api-key',
        popular: true
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        icon: '✨',
        description: 'Gemini Pro 系列模型',
        baseUrl: 'https://generativelanguage.googleapis.com',
        authType: 'api-key'
      },
      {
        id: 'groq',
        name: 'Groq Cloud',
        icon: '⚡',
        description: '超快速推理，支持 Llama, Mixtral',
        baseUrl: 'https://api.groq.com/openai',
        authType: 'bearer'
      },
      {
        id: 'ollama',
        name: 'Ollama (本地)',
        icon: '🦙',
        description: '本地运行开源模型',
        baseUrl: 'http://localhost:11434',
        authType: 'none',
        isLocal: true
      },
      {
        id: 'perplexity',
        name: 'Perplexity AI',
        icon: '🔍',
        description: '实时搜索增强的 AI',
        baseUrl: 'https://api.perplexity.ai',
        authType: 'bearer'
      },
      {
        id: 'custom',
        name: '自定义服务',
        icon: '⚙️',
        description: '配置其他兼容的 API 服务',
        authType: 'custom'
      }
    ];
  }

  /**
   * 显示配置向导
   */
  async show(container) {
    this.container = container;
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal config-wizard';
    this.modalElement.innerHTML = await this.render();
    
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
  async render() {
    const stepContent = await this.renderStep();
    
    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>配置向导</h2>
          <button class="btn-close" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          <!-- 进度条 -->
          <div class="wizard-progress">
            ${this.renderProgress()}
          </div>
          
          <!-- 步骤内容 -->
          <div class="wizard-content">
            ${stepContent}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn" id="btn-prev" ${this.currentStep === 1 ? 'disabled' : ''}>
            上一步
          </button>
          <button class="btn btn-primary" id="btn-next">
            ${this.currentStep === this.totalSteps ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染进度条
   */
  renderProgress() {
    const steps = [
      { num: 1, label: '选择服务' },
      { num: 2, label: '配置认证' },
      { num: 3, label: '选择模型' },
      { num: 4, label: '测试连接' }
    ];

    return steps.map(step => `
      <div class="progress-step ${step.num === this.currentStep ? 'active' : ''} 
                               ${step.num < this.currentStep ? 'completed' : ''}">
        <div class="step-number">${step.num}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `).join('');
  }

  /**
   * 渲染当前步骤
   */
  async renderStep() {
    switch (this.currentStep) {
      case 1:
        return this.renderServiceSelection();
      case 2:
        return this.renderAuthConfiguration();
      case 3:
        return await this.renderModelSelection();
      case 4:
        return this.renderTestConnection();
      default:
        return '';
    }
  }

  /**
   * 步骤1: 服务选择
   */
  renderServiceSelection() {
    const popularServices = this.services.filter(s => s.popular);
    const otherServices = this.services.filter(s => !s.popular);

    return `
      <div class="wizard-step step-service">
        <h3>选择 AI 服务</h3>
        <p class="step-description">选择您要使用的 AI 服务提供商</p>
        
        <div class="service-grid">
          <h4>热门服务</h4>
          <div class="service-list">
            ${popularServices.map(service => `
              <div class="service-card ${this.wizardData.service?.id === service.id ? 'selected' : ''}"
                   data-service-id="${service.id}">
                <div class="service-icon">${service.icon}</div>
                <div class="service-info">
                  <div class="service-name">${service.name}</div>
                  <div class="service-desc">${service.description}</div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <h4>其他服务</h4>
          <div class="service-list">
            ${otherServices.map(service => `
              <div class="service-card ${this.wizardData.service?.id === service.id ? 'selected' : ''}"
                   data-service-id="${service.id}">
                <div class="service-icon">${service.icon}</div>
                <div class="service-info">
                  <div class="service-name">${service.name}</div>
                  <div class="service-desc">${service.description}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 步骤2: 认证配置
   */
  renderAuthConfiguration() {
    if (!this.wizardData.service) {
      return '<div class="wizard-step">请先选择服务</div>';
    }

    const service = this.wizardData.service;
    const isLocal = service.isLocal;
    const isCustom = service.id === 'custom';

    return `
      <div class="wizard-step step-auth">
        <h3>配置认证信息</h3>
        <p class="step-description">
          ${isLocal ? '本地服务无需认证信息' : `配置 ${service.name} 的认证信息`}
        </p>
        
        <div class="form-group">
          <label for="config-name">配置名称</label>
          <input type="text" id="config-name" class="form-control" 
                 value="${this.escapeHtml(this.wizardData.name)}" 
                 placeholder="例如：${service.name} 生产环境">
        </div>
        
        ${isCustom ? `
          <div class="form-group">
            <label for="config-api-url">API 地址</label>
            <input type="url" id="config-api-url" class="form-control" 
                   value="${this.escapeHtml(this.wizardData.apiUrl)}" 
                   placeholder="https://api.example.com">
          </div>
        ` : ''}
        
        ${!isLocal ? `
          <div class="form-group">
            <label for="config-api-key">API Key</label>
            <div class="input-group">
              <input type="password" id="config-api-key" class="form-control" 
                     value="${this.escapeHtml(this.wizardData.apiKey)}" 
                     placeholder="${this.getApiKeyPlaceholder(service)}">
              <button class="btn btn-secondary" id="btn-toggle-key">
                <i class="icon icon-eye"></i>
              </button>
            </div>
            <small class="form-help">
              ${this.getApiKeyHelp(service)}
            </small>
          </div>
        ` : ''}
        
        ${service.id === 'custom' ? `
          <div class="form-group">
            <label for="config-auth-type">认证类型</label>
            <select id="config-auth-type" class="form-control">
              <option value="bearer" ${this.wizardData.authType === 'bearer' ? 'selected' : ''}>
                Bearer Token
              </option>
              <option value="api-key" ${this.wizardData.authType === 'api-key' ? 'selected' : ''}>
                API Key Header
              </option>
              <option value="none" ${this.wizardData.authType === 'none' ? 'selected' : ''}>
                无认证
              </option>
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 步骤3: 模型选择
   */
  async renderModelSelection() {
    if (!this.wizardData.service) {
      return '<div class="wizard-step">请先选择服务</div>';
    }

    let models = this.getServiceModels(this.wizardData.service.id);
    
    // 如果是本地服务，尝试获取实际的模型列表
    if (this.wizardData.service.isLocal) {
      try {
        const localModels = await window.electronAPI.getLocalModels(this.wizardData.service.id);
        if (localModels && localModels.length > 0) {
          models = localModels;
        }
      } catch (error) {
        console.warn('获取本地模型失败:', error);
      }
    }

    return `
      <div class="wizard-step step-model">
        <h3>选择模型</h3>
        <p class="step-description">选择要使用的 AI 模型</p>
        
        <div class="model-list">
          ${models.map(model => `
            <div class="model-card ${this.wizardData.model?.id === model.id ? 'selected' : ''}"
                 data-model-id="${model.id}">
              <div class="model-info">
                <div class="model-name">${model.name}</div>
                <div class="model-meta">
                  ${model.context ? `<span>上下文: ${this.formatNumber(model.context)} tokens</span>` : ''}
                  ${model.description ? `<span>${model.description}</span>` : ''}
                </div>
              </div>
              ${model.recommended ? '<div class="model-badge">推荐</div>' : ''}
            </div>
          `).join('')}
        </div>
        
        ${this.wizardData.service.isLocal ? `
          <div class="model-note">
            <i class="icon icon-info"></i>
            本地模型列表将在连接后自动获取
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 步骤4: 测试连接
   */
  renderTestConnection() {
    return `
      <div class="wizard-step step-test">
        <h3>测试连接</h3>
        <p class="step-description">验证配置是否正确</p>
        
        <div class="config-summary">
          <h4>配置摘要</h4>
          <div class="summary-item">
            <span class="summary-label">服务:</span>
            <span class="summary-value">${this.wizardData.service?.name || '未选择'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">配置名称:</span>
            <span class="summary-value">${this.wizardData.name || '未设置'}</span>
          </div>
          ${this.wizardData.service?.id === 'custom' ? `
            <div class="summary-item">
              <span class="summary-label">API 地址:</span>
              <span class="summary-value">${this.wizardData.apiUrl || '未设置'}</span>
            </div>
          ` : ''}
          <div class="summary-item">
            <span class="summary-label">模型:</span>
            <span class="summary-value">${this.wizardData.model?.name || '未选择'}</span>
          </div>
        </div>
        
        <div class="test-actions">
          <button class="btn btn-primary" id="btn-test-connection">
            <i class="icon icon-test"></i>
            测试连接
          </button>
        </div>
        
        <div id="test-result" class="test-result" style="display: none;"></div>
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
    
    // 上一步/下一步按钮
    const prevBtn = this.modalElement.querySelector('#btn-prev');
    const nextBtn = this.modalElement.querySelector('#btn-next');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousStep());
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep());
    }
    
    // 根据当前步骤绑定事件
    this.bindStepEvents();
  }

  /**
   * 绑定步骤特定事件
   */
  bindStepEvents() {
    switch (this.currentStep) {
      case 1:
        // 服务选择
        this.modalElement.querySelectorAll('.service-card').forEach(card => {
          card.addEventListener('click', (e) => {
            const serviceId = e.currentTarget.dataset.serviceId;
            this.selectService(serviceId);
          });
        });
        break;
        
      case 2:
        // 认证配置
        const nameInput = this.modalElement.querySelector('#config-name');
        if (nameInput) {
          nameInput.addEventListener('input', (e) => {
            this.wizardData.name = e.target.value;
          });
        }
        
        const urlInput = this.modalElement.querySelector('#config-api-url');
        if (urlInput) {
          urlInput.addEventListener('input', (e) => {
            this.wizardData.apiUrl = e.target.value;
          });
        }
        
        const keyInput = this.modalElement.querySelector('#config-api-key');
        if (keyInput) {
          keyInput.addEventListener('input', (e) => {
            this.wizardData.apiKey = e.target.value;
          });
        }
        
        const authTypeSelect = this.modalElement.querySelector('#config-auth-type');
        if (authTypeSelect) {
          authTypeSelect.addEventListener('change', (e) => {
            this.wizardData.authType = e.target.value;
          });
        }
        
        // 切换密钥显示
        const toggleBtn = this.modalElement.querySelector('#btn-toggle-key');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            const input = this.modalElement.querySelector('#config-api-key');
            input.type = input.type === 'password' ? 'text' : 'password';
            toggleBtn.querySelector('i').className = 
              input.type === 'password' ? 'icon icon-eye' : 'icon icon-eye-off';
          });
        }
        break;
        
      case 3:
        // 模型选择
        this.modalElement.querySelectorAll('.model-card').forEach(card => {
          card.addEventListener('click', (e) => {
            const modelId = e.currentTarget.dataset.modelId;
            this.selectModel(modelId);
          });
        });
        break;
        
      case 4:
        // 测试连接
        const testBtn = this.modalElement.querySelector('#btn-test-connection');
        if (testBtn) {
          testBtn.addEventListener('click', () => this.testConnection());
        }
        break;
    }
  }

  /**
   * 选择服务
   */
  selectService(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;
    
    this.wizardData.service = service;
    this.wizardData.apiUrl = service.baseUrl || '';
    this.wizardData.authType = service.authType || 'bearer';
    
    // 更新 UI
    this.modalElement.querySelectorAll('.service-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.serviceId === serviceId);
    });
  }

  /**
   * 选择模型
   */
  selectModel(modelId) {
    const models = this.getServiceModels(this.wizardData.service.id);
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    
    this.wizardData.model = model;
    
    // 更新 UI
    this.modalElement.querySelectorAll('.model-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.modelId === modelId);
    });
  }

  /**
   * 上一步
   */
  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateView();
    }
  }

  /**
   * 下一步
   */
  async nextStep() {
    // 验证当前步骤
    if (!this.validateStep()) {
      return;
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateView();
    } else {
      // 完成配置
      await this.completeWizard();
    }
  }

  /**
   * 验证当前步骤
   */
  validateStep() {
    switch (this.currentStep) {
      case 1:
        if (!this.wizardData.service) {
          this.showError('请选择一个服务');
          return false;
        }
        break;
        
      case 2:
        if (!this.wizardData.name.trim()) {
          this.showError('请输入配置名称');
          return false;
        }
        if (!this.wizardData.service.isLocal && !this.wizardData.apiKey.trim()) {
          this.showError('请输入 API Key');
          return false;
        }
        if (this.wizardData.service.id === 'custom' && !this.wizardData.apiUrl.trim()) {
          this.showError('请输入 API 地址');
          return false;
        }
        break;
        
      case 3:
        if (!this.wizardData.model && !this.wizardData.service.isLocal) {
          this.showError('请选择一个模型');
          return false;
        }
        break;
    }
    
    return true;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    const testResultDiv = this.modalElement.querySelector('#test-result');
    const testBtn = this.modalElement.querySelector('#btn-test-connection');
    
    // 显示测试中状态
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="icon icon-loading"></i> 测试中...';
    testResultDiv.style.display = 'block';
    testResultDiv.className = 'test-result testing';
    testResultDiv.innerHTML = `
      <i class="icon icon-loading"></i>
      <span>正在测试连接...</span>
    `;

    try {
      // 准备测试数据
      const testData = {
        name: this.wizardData.name,
        apiUrl: this.wizardData.apiUrl || this.wizardData.service.baseUrl,
        apiKey: this.wizardData.apiKey,
        model: this.wizardData.model?.id,
        authType: this.wizardData.authType,
        service: this.wizardData.service.id
      };
      
      const result = await window.electronAPI.invoke('config:test', testData);
      
      if (result.success) {
        testResultDiv.className = 'test-result success';
        testResultDiv.innerHTML = `
          <i class="icon icon-check"></i>
          <span>${result.message}</span>
          ${result.latency ? `<small>延迟: ${result.latency}ms</small>` : ''}
        `;
        
        // 启用完成按钮
        const nextBtn = this.modalElement.querySelector('#btn-next');
        nextBtn.classList.add('btn-success');
      } else {
        testResultDiv.className = 'test-result error';
        testResultDiv.innerHTML = `
          <i class="icon icon-error"></i>
          <span>${result.message}</span>
          ${result.error ? `<small>${result.error}</small>` : ''}
        `;
      }
    } catch (error) {
      testResultDiv.className = 'test-result error';
      testResultDiv.innerHTML = `
        <i class="icon icon-error"></i>
        <span>测试失败: ${error.message}</span>
      `;
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<i class="icon icon-test"></i> 测试连接';
    }
  }

  /**
   * 完成向导
   */
  async completeWizard() {
    try {
      // 准备配置数据
      const configData = {
        name: this.wizardData.name,
        apiUrl: this.wizardData.apiUrl || this.wizardData.service.baseUrl,
        apiKey: this.wizardData.apiKey,
        model: this.wizardData.model?.id,
        authType: this.wizardData.authType,
        service: this.wizardData.service.id,
        maxTokens: 4000,
        temperature: 0,
        proxy: ''
      };
      
      // 保存配置
      await window.electronAPI.addConfig(configData);
      
      // 关闭向导
      this.close();
      
      // 刷新配置管理器（如果存在）
      if (window.configManager) {
        await window.configManager.loadConfigs();
        window.configManager.updateView();
      }
      
    } catch (error) {
      this.showError(`保存配置失败: ${error.message}`);
    }
  }

  /**
   * 更新视图
   */
  async updateView() {
    const progressDiv = this.modalElement.querySelector('.wizard-progress');
    const contentDiv = this.modalElement.querySelector('.wizard-content');
    const prevBtn = this.modalElement.querySelector('#btn-prev');
    const nextBtn = this.modalElement.querySelector('#btn-next');
    
    progressDiv.innerHTML = this.renderProgress();
    contentDiv.innerHTML = await this.renderStep();
    
    // 更新按钮状态
    prevBtn.disabled = this.currentStep === 1;
    nextBtn.textContent = this.currentStep === this.totalSteps ? '完成' : '下一步';
    nextBtn.classList.remove('btn-success');
    
    // 重新绑定事件
    this.bindStepEvents();
  }

  /**
   * 获取服务的模型列表
   */
  getServiceModels(serviceId) {
    const modelMap = {
      openai: [
        { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', context: 128000, recommended: true },
        { id: 'gpt-4', name: 'GPT-4', context: 8192 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context: 4096 },
        { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', context: 16384 }
      ],
      claude: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', context: 200000, recommended: true },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', context: 200000 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', context: 200000 },
        { id: 'claude-2.1', name: 'Claude 2.1', context: 100000 }
      ],
      gemini: [
        { id: 'gemini-pro', name: 'Gemini Pro', context: 30720, recommended: true },
        { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', context: 30720 }
      ],
      groq: [
        { id: 'llama2-70b-4096', name: 'LLaMA2 70B', context: 4096 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', context: 32768, recommended: true },
        { id: 'gemma-7b-it', name: 'Gemma 7B', context: 8192 }
      ],
      ollama: [
        { id: 'llama2', name: 'Llama 2', description: '需要本地安装' },
        { id: 'mistral', name: 'Mistral', description: '需要本地安装' },
        { id: 'codellama', name: 'Code Llama', description: '需要本地安装' }
      ],
      perplexity: [
        { id: 'pplx-7b-online', name: 'Perplexity 7B Online', context: 4096 },
        { id: 'pplx-70b-online', name: 'Perplexity 70B Online', context: 4096, recommended: true },
        { id: 'codellama-34b-instruct', name: 'CodeLlama 34B', context: 16384 }
      ],
      custom: [
        { id: 'custom', name: '自定义模型', description: '手动输入模型名称' }
      ]
    };
    
    return modelMap[serviceId] || [];
  }

  /**
   * 获取 API Key 占位符
   */
  getApiKeyPlaceholder(service) {
    const placeholders = {
      openai: 'sk-...',
      claude: 'sk-ant-...',
      gemini: 'AIza...',
      groq: 'gsk_...',
      perplexity: 'pplx-...'
    };
    
    return placeholders[service.id] || 'your-api-key';
  }

  /**
   * 获取 API Key 帮助文本
   */
  getApiKeyHelp(service) {
    const helpTexts = {
      openai: '在 platform.openai.com 获取 API Key',
      claude: '在 console.anthropic.com 获取 API Key',
      gemini: '在 makersuite.google.com 获取 API Key',
      groq: '在 console.groq.com 获取 API Key',
      perplexity: '在 perplexity.ai 获取 API Key'
    };
    
    return helpTexts[service.id] || '请输入您的 API Key';
  }

  /**
   * 格式化数字
   */
  formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * 显示错误
   */
  showError(message) {
    // TODO: 实现更好的错误提示
    alert(message);
  }

  /**
   * 关闭向导
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
   * 转义 HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

module.exports = { ConfigWizard };