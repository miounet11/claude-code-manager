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
          <button class="btn btn-secondary" id="btn-clear-cache">
            <i class="icon icon-trash"></i>
            清理缓存
          </button>
          <button class="btn btn-secondary" id="btn-diagnostics" title="生成详细的环境诊断报告">
            <i class="icon icon-info"></i>
            环境诊断
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
   * 运行环境诊断
   */
  async runDiagnostics() {
    const diagnosticsBtn = this.modalElement.querySelector('#btn-diagnostics');
    const originalText = diagnosticsBtn.innerHTML;
    
    try {
      // 显示加载状态
      diagnosticsBtn.disabled = true;
      diagnosticsBtn.innerHTML = '<i class="icon icon-spinner"></i> 生成诊断报告...';
      
      // 运行诊断
      const result = await window.electronAPI.runEnvironmentDiagnostics();
      
      if (result.success) {
        // 显示成功消息
        diagnosticsBtn.classList.remove('btn-secondary');
        diagnosticsBtn.classList.add('btn-success');
        diagnosticsBtn.innerHTML = '<i class="icon icon-check"></i> 诊断完成';
        
        // 显示诊断结果摘要
        const message = `
环境诊断完成！

检测结果：
• Node.js: ${result.summary.node}
• npm: ${result.summary.npm}
• Git: ${result.summary.git}
• Claude CLI: ${result.summary.claude}

详细报告已保存到：
${result.summary.reportPath}
        `;
        
        await window.electronAPI.showInfo('环境诊断报告', message);
        
        // 如果需要，可以打开报告文件
        const openReport = await window.electronAPI.showConfirm(
          '打开诊断报告',
          '是否要在 Finder 中查看诊断报告文件？'
        );
        
        if (openReport) {
          await window.electronAPI.openPath(result.summary.reportPath);
        }
      } else {
        throw new Error(result.error || '诊断失败');
      }
    } catch (error) {
      console.error('环境诊断失败:', error);
      diagnosticsBtn.classList.remove('btn-secondary');
      diagnosticsBtn.classList.add('btn-danger');
      diagnosticsBtn.innerHTML = '<i class="icon icon-error"></i> 诊断失败';
      
      await window.electronAPI.showError('诊断失败', error.message);
    } finally {
      // 恢复按钮状态
      setTimeout(() => {
        diagnosticsBtn.disabled = false;
        diagnosticsBtn.classList.remove('btn-success', 'btn-danger');
        diagnosticsBtn.classList.add('btn-secondary');
        diagnosticsBtn.innerHTML = originalText;
      }, 3000);
    }
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
    
    // 清理缓存按钮
    const clearCacheBtn = this.modalElement.querySelector('#btn-clear-cache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        await this.clearCache();
      });
    }
    
    // 环境诊断按钮
    const diagnosticsBtn = this.modalElement.querySelector('#btn-diagnostics');
    if (diagnosticsBtn) {
      diagnosticsBtn.addEventListener('click', async () => {
        await this.runDiagnostics();
      });
    }
    
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
   * 清理缓存
   */
  async clearCache() {
    const clearBtn = this.modalElement.querySelector('#btn-clear-cache');
    const originalText = clearBtn.innerHTML;
    
    try {
      // 显示加载状态
      clearBtn.disabled = true;
      clearBtn.innerHTML = '<i class="icon icon-loading"></i> 清理中...';
      
      // 调用清理缓存
      const result = await window.electronAPI.invoke('cache:clear');
      
      if (result.success) {
        // 获取缓存统计
        const stats = await window.electronAPI.invoke('cache:get-stats');
        
        window.electronAPI.showSuccess(
          '缓存已清理', 
          `缓存清理成功！\n当前版本: ${stats.version}\n开发模式: ${stats.isDevelopment ? '是' : '否'}`
        );
        
        // 询问是否重新加载
        const reload = await window.electronAPI.showConfirm(
          '重新加载',
          '缓存已清理，是否重新加载应用以确保使用最新代码？'
        );
        
        if (reload) {
          await window.electronAPI.invoke('cache:reload-window');
        }
      } else {
        window.electronAPI.showError('清理失败', result.error || '缓存清理失败');
      }
    } catch (error) {
      console.error('清理缓存失败:', error);
      window.electronAPI.showError('清理失败', error.message);
    } finally {
      // 恢复按钮状态
      clearBtn.disabled = false;
      clearBtn.innerHTML = originalText;
    }
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