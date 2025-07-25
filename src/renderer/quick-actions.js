'use strict';

/**
 * 快捷操作面板
 * 提供常用功能的快速访问
 */
class QuickActions {
  constructor() {
    this.isVisible = false;
    this.panel = null;
  }

  /**
   * 初始化快捷操作面板
   */
  init() {
    this.createPanel();
    this.setupKeyboardShortcut();
    this.injectStyles();
  }

  /**
   * 注入样式
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 快捷操作面板 */
      .quick-actions-panel {
        position: fixed;
        top: 50%;
        right: -300px;
        transform: translateY(-50%);
        width: 280px;
        background: #2d2d2d;
        border: 1px solid #404040;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        z-index: 1000;
        transition: right 0.3s ease;
        overflow: hidden;
      }
      
      .quick-actions-panel.visible {
        right: 20px;
      }
      
      .quick-actions-header {
        padding: 15px;
        background: #1e1e1e;
        border-bottom: 1px solid #404040;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .quick-actions-title {
        font-size: 16px;
        font-weight: 500;
        color: #fff;
        margin: 0;
      }
      
      .quick-actions-close {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      
      .quick-actions-close:hover {
        background: #404040;
        color: #fff;
      }
      
      .quick-actions-content {
        padding: 15px;
      }
      
      .quick-action-group {
        margin-bottom: 20px;
      }
      
      .quick-action-group:last-child {
        margin-bottom: 0;
      }
      
      .quick-action-group-title {
        font-size: 12px;
        color: #888;
        text-transform: uppercase;
        margin: 0 0 10px 0;
      }
      
      .quick-action-item {
        display: flex;
        align-items: center;
        padding: 10px;
        background: #383838;
        border: 1px solid #484848;
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .quick-action-item:hover {
        background: #404040;
        border-color: #007acc;
        transform: translateX(-2px);
      }
      
      .quick-action-icon {
        font-size: 20px;
        margin-right: 12px;
        width: 24px;
        text-align: center;
      }
      
      .quick-action-info {
        flex: 1;
      }
      
      .quick-action-name {
        font-size: 14px;
        color: #fff;
        margin: 0;
      }
      
      .quick-action-desc {
        font-size: 12px;
        color: #888;
        margin: 2px 0 0 0;
      }
      
      .quick-action-shortcut {
        font-size: 11px;
        color: #666;
        background: #2d2d2d;
        padding: 2px 6px;
        border-radius: 3px;
      }
      
      /* 浮动触发按钮 */
      .quick-actions-trigger {
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background: #007acc;
        color: white;
        border: none;
        border-radius: 20px 0 0 20px;
        cursor: pointer;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: all 0.3s ease;
        z-index: 999;
      }
      
      .quick-actions-trigger:hover {
        background: #005a9e;
        width: 50px;
      }
      
      .quick-actions-trigger.hidden {
        right: -40px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 创建快捷操作面板
   */
  createPanel() {
    // 创建触发按钮
    this.trigger = document.createElement('button');
    this.trigger.className = 'quick-actions-trigger';
    this.trigger.innerHTML = '⚡';
    this.trigger.title = '快捷操作 (Ctrl+Q)';
    this.trigger.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.trigger);

    // 创建面板
    this.panel = document.createElement('div');
    this.panel.className = 'quick-actions-panel';
    this.panel.innerHTML = `
      <div class="quick-actions-header">
        <h3 class="quick-actions-title">快捷操作</h3>
        <button class="quick-actions-close">×</button>
      </div>
      <div class="quick-actions-content">
        <div class="quick-action-group">
          <p class="quick-action-group-title">常用操作</p>
          
          <div class="quick-action-item" data-action="start-claude">
            <span class="quick-action-icon">🚀</span>
            <div class="quick-action-info">
              <p class="quick-action-name">启动 Claude</p>
              <p class="quick-action-desc">使用当前配置启动</p>
            </div>
            <span class="quick-action-shortcut">Ctrl+S</span>
          </div>
          
          <div class="quick-action-item" data-action="run-diagnosis">
            <span class="quick-action-icon">🔍</span>
            <div class="quick-action-info">
              <p class="quick-action-name">系统诊断</p>
              <p class="quick-action-desc">检查环境问题</p>
            </div>
            <span class="quick-action-shortcut">Ctrl+D</span>
          </div>
          
          <div class="quick-action-item" data-action="clear-terminal">
            <span class="quick-action-icon">🧹</span>
            <div class="quick-action-info">
              <p class="quick-action-name">清空终端</p>
              <p class="quick-action-desc">清除所有输出</p>
            </div>
            <span class="quick-action-shortcut">Ctrl+L</span>
          </div>
        </div>
        
        <div class="quick-action-group">
          <p class="quick-action-group-title">配置管理</p>
          
          <div class="quick-action-item" data-action="new-config">
            <span class="quick-action-icon">➕</span>
            <div class="quick-action-info">
              <p class="quick-action-name">新建配置</p>
              <p class="quick-action-desc">创建新的 API 配置</p>
            </div>
          </div>
          
          <div class="quick-action-item" data-action="import-config">
            <span class="quick-action-icon">📥</span>
            <div class="quick-action-info">
              <p class="quick-action-name">导入配置</p>
              <p class="quick-action-desc">从文件导入</p>
            </div>
          </div>
          
          <div class="quick-action-item" data-action="export-config">
            <span class="quick-action-icon">📤</span>
            <div class="quick-action-info">
              <p class="quick-action-name">导出配置</p>
              <p class="quick-action-desc">保存为文件</p>
            </div>
          </div>
        </div>
        
        <div class="quick-action-group">
          <p class="quick-action-group-title">帮助</p>
          
          <div class="quick-action-item" data-action="show-guide">
            <span class="quick-action-icon">📖</span>
            <div class="quick-action-info">
              <p class="quick-action-name">使用引导</p>
              <p class="quick-action-desc">查看操作教程</p>
            </div>
          </div>
          
          <div class="quick-action-item" data-action="show-shortcuts">
            <span class="quick-action-icon">⌨️</span>
            <div class="quick-action-info">
              <p class="quick-action-name">快捷键列表</p>
              <p class="quick-action-desc">查看所有快捷键</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.panel);
    
    // 绑定事件
    this.panel.querySelector('.quick-actions-close').addEventListener('click', () => this.hide());
    
    // 绑定操作项点击事件
    this.panel.querySelectorAll('.quick-action-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.executeAction(action);
      });
    });
  }

  /**
   * 设置键盘快捷键
   */
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Q 打开/关闭快捷操作面板
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * 切换显示状态
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 显示面板
   */
  show() {
    this.isVisible = true;
    this.panel.classList.add('visible');
    this.trigger.classList.add('hidden');
  }

  /**
   * 隐藏面板
   */
  hide() {
    this.isVisible = false;
    this.panel.classList.remove('visible');
    this.trigger.classList.remove('hidden');
  }

  /**
   * 执行操作
   */
  executeAction(action) {
    switch (action) {
      case 'start-claude':
        if (window.startClaudeCode) {
          window.startClaudeCode();
        }
        break;
        
      case 'run-diagnosis':
        if (window.runDiagnostics) {
          window.runDiagnostics();
        }
        break;
        
      case 'clear-terminal':
        const clearBtn = document.getElementById('clear-terminal-btn');
        if (clearBtn) {
          clearBtn.click();
        }
        break;
        
      case 'new-config':
        const newConfigBtn = document.getElementById('new-config-btn');
        if (newConfigBtn) {
          newConfigBtn.click();
        }
        break;
        
      case 'import-config':
        const importBtn = document.getElementById('import-config-btn');
        if (importBtn) {
          importBtn.click();
        }
        break;
        
      case 'export-config':
        const exportBtn = document.getElementById('export-config-btn');
        if (exportBtn) {
          exportBtn.click();
        }
        break;
        
      case 'show-guide':
        if (window.userGuide) {
          window.userGuide.startFirstTimeGuide();
        }
        break;
        
      case 'show-shortcuts':
        this.showShortcutsList();
        break;
    }
    
    // 执行后隐藏面板
    this.hide();
  }

  /**
   * 显示快捷键列表
   */
  showShortcutsList() {
    if (window.terminal) {
      window.terminal.writeln('\r\n\x1b[36m=== 快捷键列表 ===\x1b[0m');
      window.terminal.writeln('\x1b[32mCtrl+Q\x1b[0m    - 打开快捷操作面板');
      window.terminal.writeln('\x1b[32mCtrl+S\x1b[0m    - 启动/停止 Claude');
      window.terminal.writeln('\x1b[32mCtrl+D\x1b[0m    - 运行系统诊断');
      window.terminal.writeln('\x1b[32mCtrl+L\x1b[0m    - 清空终端');
      window.terminal.writeln('\x1b[32mCtrl+,\x1b[0m    - 打开设置');
      window.terminal.writeln('\x1b[32mCtrl+R\x1b[0m    - 重启 Claude');
      window.terminal.writeln('\x1b[36m==================\x1b[0m\r\n');
    }
  }
}

// 创建全局实例
window.quickActions = new QuickActions();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuickActions;
}