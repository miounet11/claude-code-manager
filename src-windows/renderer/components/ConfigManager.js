'use strict';

/**
 * 配置管理器组件
 */
class ConfigManager {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.configs = [];
    this.currentConfig = null;
    this.editingConfig = null;
  }

  /**
   * 显示配置管理器
   */
  async show(container) {
    this.container = container;
    
    // 加载配置
    await this.loadConfigs();
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal config-manager';
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
   * 加载配置
   */
  async loadConfigs() {
    this.configs = await window.electronAPI.getAllConfigs();
    this.currentConfig = await window.electronAPI.getCurrentConfig();
  }

  /**
   * 渲染内容
   */
  render() {
    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>配置管理</h2>
          <button class="btn-close" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="config-manager-layout">
            <!-- 配置列表 -->
            <div class="config-list-panel">
              <div class="panel-header">
                <h3>配置列表</h3>
                <div class="panel-header-actions">
                  <button class="btn btn-primary btn-sm" id="btn-add-config">
                    <i class="icon icon-plus"></i>
                    新建
                  </button>
                  <button class="btn btn-warning btn-sm" id="btn-restore-default" title="恢复 Claude Code 默认配置">
                    <i class="icon icon-restore"></i>
                    恢复默认
                  </button>
                </div>
              </div>
              <div class="config-list">
                ${this.renderConfigList()}
              </div>
            </div>
            
            <!-- 配置详情 -->
            <div class="config-detail-panel">
              ${this.renderConfigDetail()}
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
   * 渲染配置列表
   */
  renderConfigList() {
    if (this.configs.length === 0) {
      return '<div class="config-list-empty">暂无配置</div>';
    }
    
    return this.configs.map(config => `
      <div class="config-list-item ${config.id === this.currentConfig?.id ? 'current' : ''}" 
           data-config-id="${config.id}">
        <div class="config-info">
          <div class="config-name">${this.escapeHtml(config.name)}</div>
          <div class="config-meta">
            <span class="config-model">${this.escapeHtml(config.model || '未设置')}</span>
            ${config.id === this.currentConfig?.id ? '<span class="config-badge">当前</span>' : ''}
          </div>
        </div>
        <div class="config-actions">
          <button class="btn-icon" title="编辑" data-action="edit" data-config-id="${config.id}">
            <i class="icon icon-edit"></i>
          </button>
          <button class="btn-icon" title="复制" data-action="duplicate" data-config-id="${config.id}">
            <i class="icon icon-copy"></i>
          </button>
          <button class="btn-icon" title="导出" data-action="export" data-config-id="${config.id}">
            <i class="icon icon-export"></i>
          </button>
          <button class="btn-icon danger" title="删除" data-action="delete" data-config-id="${config.id}">
            <i class="icon icon-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染配置详情
   */
  renderConfigDetail() {
    if (!this.editingConfig) {
      return `
        <div class="config-detail-empty">
          <i class="icon icon-config-large"></i>
          <p>选择一个配置进行编辑</p>
          <p class="text-secondary">或创建新的配置</p>
        </div>
      `;
    }
    
    return `
      <div class="config-form">
        <h3>${this.editingConfig.id ? '编辑配置' : '新建配置'}</h3>
        
        <div class="form-group">
          <label for="config-name">配置名称</label>
          <input type="text" id="config-name" class="form-control" 
                 value="${this.escapeHtml(this.editingConfig.name || '')}" 
                 placeholder="例如：生产环境">
        </div>
        
        <div class="form-group">
          <label for="config-api-url">API 地址</label>
          <input type="url" id="config-api-url" class="form-control" 
                 value="${this.escapeHtml(this.editingConfig.apiUrl || '')}" 
                 placeholder="https://api.anthropic.com">
        </div>
        
        <div class="form-group">
          <label for="config-api-key">API Key</label>
          <div class="input-group">
            <input type="password" id="config-api-key" class="form-control" 
                   value="${this.escapeHtml(this.editingConfig.apiKey || '')}" 
                   placeholder="sk-ant-...">
            <button class="btn btn-secondary" id="btn-toggle-key">
              <i class="icon icon-eye"></i>
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="config-model">模型</label>
          <select id="config-model" class="form-control">
            <option value="claude-3-opus-20240229" 
                    ${this.editingConfig.model === 'claude-3-opus-20240229' ? 'selected' : ''}>
              Claude 3 Opus
            </option>
            <option value="claude-3-sonnet-20240229" 
                    ${this.editingConfig.model === 'claude-3-sonnet-20240229' ? 'selected' : ''}>
              Claude 3 Sonnet
            </option>
            <option value="claude-3-haiku-20240307" 
                    ${this.editingConfig.model === 'claude-3-haiku-20240307' ? 'selected' : ''}>
              Claude 3 Haiku
            </option>
            <option value="claude-3-7-sonnet-20250219" 
                    ${this.editingConfig.model === 'claude-3-7-sonnet-20250219' ? 'selected' : ''}>
              Claude 3.7 Sonnet (测试)
            </option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="config-max-tokens">最大 Token 数</label>
            <input type="number" id="config-max-tokens" class="form-control" 
                   value="${this.editingConfig.maxTokens || 4000}" 
                   min="1" max="100000">
          </div>
          
          <div class="form-group">
            <label for="config-temperature">温度</label>
            <input type="number" id="config-temperature" class="form-control" 
                   value="${this.editingConfig.temperature || 0}" 
                   min="0" max="1" step="0.1">
          </div>
        </div>
        
        <div class="form-group">
          <label for="config-proxy">代理设置（可选）</label>
          <input type="text" id="config-proxy" class="form-control" 
                 value="${this.escapeHtml(this.editingConfig.proxy || '')}" 
                 placeholder="http://127.0.0.1:7890">
        </div>
        
        <div class="form-actions">
          <button class="btn btn-primary" id="btn-save-and-apply">
            <i class="icon icon-save"></i>
            保存并启用
          </button>
          <button class="btn btn-secondary" id="btn-save-only">
            <i class="icon icon-save"></i>
            仅保存
          </button>
          <button class="btn btn-secondary" id="btn-test-config">
            <i class="icon icon-test"></i>
            测试连接
          </button>
          <button class="btn btn-secondary" id="btn-cancel-edit">
            取消
          </button>
        </div>
        
        <div id="test-result" class="test-result" style="display: none; margin-top: 20px; padding: 15px; border-radius: 5px;"></div>
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
    
    // 新建配置
    this.modalElement.querySelector('#btn-add-config').addEventListener('click', () => {
      this.editConfig();
    });
    
    // 恢复默认配置
    const restoreBtn = this.modalElement.querySelector('#btn-restore-default');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => this.restoreDefaultConfig());
    }
    
    // 配置列表点击
    this.modalElement.querySelector('.config-list').addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const configId = e.target.closest('[data-config-id]')?.dataset.configId;
      
      if (action && configId) {
        this.handleConfigAction(action, configId);
      }
    });
    
    // 编辑表单事件
    if (this.editingConfig) {
      this.bindFormEvents();
    }
  }

  /**
   * 绑定表单事件
   */
  bindFormEvents() {
    // 保存并启用
    const saveAndApplyBtn = this.modalElement.querySelector('#btn-save-and-apply');
    if (saveAndApplyBtn) {
      saveAndApplyBtn.addEventListener('click', () => this.saveConfig(true));
    }
    
    // 仅保存
    const saveOnlyBtn = this.modalElement.querySelector('#btn-save-only');
    if (saveOnlyBtn) {
      saveOnlyBtn.addEventListener('click', () => this.saveConfig(false));
    }
    
    // 测试连接
    const testBtn = this.modalElement.querySelector('#btn-test-config');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testConnection());
    }
    
    // 取消编辑
    const cancelBtn = this.modalElement.querySelector('#btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.editingConfig = null;
        this.updateView();
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
  }

  /**
   * 测试连接
   */
  async testConnection() {
    const testResultDiv = this.modalElement.querySelector('#test-result');
    const testBtn = this.modalElement.querySelector('#btn-test-config');
    
    // 收集表单数据
    const formData = {
      name: this.modalElement.querySelector('#config-name').value.trim(),
      apiUrl: this.modalElement.querySelector('#config-api-url').value.trim(),
      apiKey: this.modalElement.querySelector('#config-api-key').value.trim(),
      model: this.modalElement.querySelector('#config-model').value,
      proxy: this.modalElement.querySelector('#config-proxy').value.trim()
    };

    // 基本验证
    if (!formData.apiUrl || !formData.apiKey) {
      testResultDiv.style.display = 'block';
      testResultDiv.className = 'test-result error';
      testResultDiv.innerHTML = `
        <i class="icon icon-error"></i>
        <span>请先填写 API 地址和 API Key</span>
      `;
      return;
    }

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
      const result = await window.electronAPI.invoke('config:test', formData);
      
      if (result.success) {
        testResultDiv.className = 'test-result success';
        testResultDiv.innerHTML = `
          <i class="icon icon-check"></i>
          <span>${result.message}</span>
          ${result.latency ? `<small>延迟: ${result.latency}ms</small>` : ''}
        `;
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
   * 处理配置操作
   */
  async handleConfigAction(action, configId) {
    const config = this.configs.find(c => c.id === configId);
    if (!config && action !== 'add') return;
    
    switch (action) {
      case 'edit':
        this.editConfig(config);
        break;
        
      case 'duplicate':
        await this.duplicateConfig(config);
        break;
        
      case 'export':
        await this.exportConfig(config);
        break;
        
      case 'delete':
        await this.deleteConfig(config);
        break;
    }
  }

  /**
   * 编辑配置
   */
  editConfig(config = null) {
    this.editingConfig = config ? { ...config } : {
      name: '',
      apiUrl: '',
      apiKey: '',
      model: 'claude-3-opus-20240229',
      maxTokens: 4000,
      temperature: 0,
      proxy: ''
    };
    
    this.updateView();
  }

  /**
   * 保存配置
   * @param {boolean} applyConfig - 是否保存后立即启用
   */
  async saveConfig(applyConfig = false) {
    // 收集表单数据
    const formData = {
      name: this.modalElement.querySelector('#config-name').value.trim(),
      apiUrl: this.modalElement.querySelector('#config-api-url').value.trim(),
      apiKey: this.modalElement.querySelector('#config-api-key').value.trim(),
      model: this.modalElement.querySelector('#config-model').value,
      maxTokens: parseInt(this.modalElement.querySelector('#config-max-tokens').value),
      temperature: parseFloat(this.modalElement.querySelector('#config-temperature').value),
      proxy: this.modalElement.querySelector('#config-proxy').value.trim()
    };
    
    // 验证
    const validation = await window.electronAPI.validateConfig(formData);
    if (!validation.valid) {
      window.electronAPI.showError('验证失败', validation.errors.join('\n'));
      return;
    }
    
    try {
      let savedConfig;
      
      if (this.editingConfig.id) {
        // 更新配置
        formData.id = this.editingConfig.id;
        await window.electronAPI.updateConfig(this.editingConfig.id, formData);
        savedConfig = { ...formData };
      } else {
        // 新建配置
        const result = await window.electronAPI.addConfig(formData);
        savedConfig = result.config || formData;
      }
      
      // 如果需要应用配置
      if (applyConfig) {
        await this.applyConfigAndStart(savedConfig);
      } else {
        // 仅保存，显示成功提示
        await window.electronAPI.showInfo('保存成功', '配置已保存');
        
        // 重新加载配置
        await this.loadConfigs();
        this.editingConfig = null;
        this.updateView();
      }
      
    } catch (error) {
      window.electronAPI.showError('保存失败', error.message);
    }
  }
  
  /**
   * 应用配置并启动 Claude
   */
  async applyConfigAndStart(config) {
    try {
      // 设置为当前配置
      await window.electronAPI.setCurrentConfig(config);
      
      // 关闭配置管理窗口
      this.close();
      
      // 停止当前运行的 Claude（如果有）
      const claudeStatus = await window.electronAPI.getClaudeStatus();
      if (claudeStatus.running) {
        await window.electronAPI.stopClaude();
        // 等待停止完成
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 切换到终端页面
      if (window.switchToTerminal) {
        window.switchToTerminal();
      }
      
      // 启动 Claude
      setTimeout(async () => {
        try {
          await window.electronAPI.startClaude(config);
        } catch (error) {
          console.error('启动 Claude 失败:', error);
          window.electronAPI.showError('启动失败', error.message);
        }
      }, 500);
      
    } catch (error) {
      window.electronAPI.showError('应用配置失败', error.message);
    }
  }

  /**
   * 使用配置
   */
  async useConfig() {
    if (!this.editingConfig?.id) return;
    
    try {
      await window.electronAPI.setCurrentConfig(this.editingConfig.id);
      this.currentConfig = this.editingConfig;
      this.updateView();
    } catch (error) {
      window.electronAPI.showError('切换配置失败', error.message);
    }
  }

  /**
   * 复制配置
   */
  async duplicateConfig(config) {
    try {
      await window.electronAPI.duplicateConfig(config.id);
      await this.loadConfigs();
      this.updateView();
    } catch (error) {
      window.electronAPI.showError('复制失败', error.message);
    }
  }

  /**
   * 导出配置
   */
  async exportConfig(config) {
    try {
      const exportData = await window.electronAPI.exportConfig(config.id);
      
      // 创建下载
      const blob = new Blob([JSON.stringify(exportData, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miaoda-config-${config.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      window.electronAPI.showError('导出失败', error.message);
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(config) {
    const confirm = await window.electronAPI.showConfirm(
      '确认删除',
      `确定要删除配置"${config.name}"吗？`
    );
    
    if (!confirm) return;
    
    try {
      await window.electronAPI.deleteConfig(config.id);
      await this.loadConfigs();
      
      // 如果删除的是正在编辑的配置
      if (this.editingConfig?.id === config.id) {
        this.editingConfig = null;
      }
      
      this.updateView();
    } catch (error) {
      window.electronAPI.showError('删除失败', error.message);
    }
  }

  /**
   * 更新视图
   */
  updateView() {
    const listPanel = this.modalElement.querySelector('.config-list');
    const detailPanel = this.modalElement.querySelector('.config-detail-panel');
    
    listPanel.innerHTML = this.renderConfigList();
    detailPanel.innerHTML = this.renderConfigDetail();
    
    // 重新绑定表单事件
    if (this.editingConfig) {
      this.bindFormEvents();
    }
  }

  /**
   * 关闭配置管理器
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
  
  /**
   * 恢复默认配置
   */
  async restoreDefaultConfig() {
    // 确认对话框
    const confirmed = await this.showConfirmDialog(
      '恢复默认配置',
      '此操作将创建一个 Claude Code 官方默认配置。\n\n这不会删除您现有的配置，只是添加一个新的默认配置供您使用。\n\n是否继续？'
    );
    
    if (!confirmed) return;
    
    try {
      // 官方 Claude Code 默认配置
      const defaultConfig = {
        name: 'Claude Code 默认配置',
        apiUrl: 'https://api.anthropic.com',
        apiKey: '',  // 用户需要自己填写
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        temperature: 0,
        proxy: ''
      };
      
      // 检查是否已存在同名配置
      const existingDefault = this.configs.find(c => c.name === 'Claude Code 默认配置');
      if (existingDefault) {
        const overwrite = await this.showConfirmDialog(
          '配置已存在',
          '已存在名为"Claude Code 默认配置"的配置。\n\n是否覆盖现有配置？'
        );
        
        if (!overwrite) return;
        
        // 更新现有配置
        await window.electronAPI.updateConfig(existingDefault.id, defaultConfig);
        await window.electronAPI.showInfo('恢复成功', '已更新为 Claude Code 默认配置');
      } else {
        // 创建新配置
        await window.electronAPI.addConfig(defaultConfig);
        await window.electronAPI.showInfo('恢复成功', '已创建 Claude Code 默认配置\n\n请记得填写您的 API Key');
      }
      
      // 重新加载配置列表
      await this.loadConfigs();
      this.updateView();
      
    } catch (error) {
      window.electronAPI.showError('恢复失败', error.message);
    }
  }
  
  /**
   * 显示确认对话框
   */
  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'modal-overlay';
      dialog.innerHTML = `
        <div class="confirm-dialog">
          <h3>${this.escapeHtml(title)}</h3>
          <p style="white-space: pre-line">${this.escapeHtml(message)}</p>
          <div class="dialog-buttons">
            <button class="btn btn-primary" id="confirm-yes">确定</button>
            <button class="btn btn-secondary" id="confirm-no">取消</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const cleanup = (result) => {
        dialog.remove();
        resolve(result);
      };
      
      dialog.querySelector('#confirm-yes').addEventListener('click', () => cleanup(true));
      dialog.querySelector('#confirm-no').addEventListener('click', () => cleanup(false));
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) cleanup(false);
      });
    });
  }
}

module.exports = { ConfigManager };