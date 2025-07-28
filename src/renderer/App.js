'use strict';

/**
 * 主应用组件 - 管理整个应用的布局和状态
 */
class App {
  constructor() {
    this.components = {};
    this.state = {
      environmentReady: false,
      currentConfig: null,
      claudeRunning: false,
      sidebarVisible: true
    };
    
    // 版本号用于防止缓存
    this.scriptVersion = Date.now();
    
    this.initialize();
  }
  
  /**
   * 动态导入模块（带版本号防缓存）
   */
  async importModule(modulePath) {
    // 为模块路径添加版本查询参数
    const versionedPath = `${modulePath}?v=${this.scriptVersion}`;
    try {
      return await import(versionedPath);
    } catch (error) {
      console.error(`模块加载失败: ${modulePath}`, error);
      // 如果带版本号失败，尝试不带版本号
      return await import(modulePath);
    }
  }

  /**
   * 初始化应用
   */
  async initialize() {
    // 创建主要组件
    await this.createComponents();
    
    // 设置布局
    this.setupLayout();
    
    // 绑定事件
    this.bindEvents();
    
    // 初始化数据
    await this.loadInitialData();
    
    // 开始环境检查
    this.startEnvironmentCheck();
  }

  /**
   * 创建组件
   */
  async createComponents() {
    // 动态加载组件（带版本号防缓存）
    const { Sidebar } = await this.importModule('./components/Sidebar.js');
    const { Terminal } = await this.importModule('./components/Terminal.js');
    const { StatusBar } = await this.importModule('./components/StatusBar.js');
    const { EnvironmentPanel } = await this.importModule('./components/EnvironmentPanel.js');
    const { ConfigManager } = await this.importModule('./components/ConfigManager.js');
    const { ConfigWizard } = await this.importModule('./components/ConfigWizard.js');
    const { InstallerWizard } = await this.importModule('./components/InstallerWizard.js');
    const { LocalModelManager } = await this.importModule('./components/LocalModelManager.js');
    
    // 创建组件实例
    this.components.sidebar = new Sidebar();
    this.components.terminal = new Terminal();
    this.components.statusBar = new StatusBar();
    this.components.environmentPanel = new EnvironmentPanel();
    this.components.configManager = new ConfigManager();
    this.components.configWizard = new ConfigWizard();
    this.components.installerWizard = new InstallerWizard();
    this.components.localModelManager = new LocalModelManager();
  }

  /**
   * 设置布局
   */
  setupLayout() {
    const appContainer = document.getElementById('app');
    
    appContainer.innerHTML = `
      <div class="app-container">
        <div class="app-header">
          <div class="app-title">
            <img src="assets/icon.png" alt="Miaoda" class="app-icon">
            <span>Miaoda - Claude Code Manager</span>
          </div>
          <div class="app-controls">
            <button id="btn-minimize" class="control-btn">－</button>
            <button id="btn-maximize" class="control-btn">□</button>
            <button id="btn-close" class="control-btn">×</button>
          </div>
        </div>
        
        <div class="app-body">
          <div id="sidebar" class="sidebar"></div>
          
          <div class="main-content">
            <div id="terminal-container" class="terminal-container"></div>
          </div>
        </div>
        
        <div id="status-bar" class="status-bar"></div>
        
        <!-- 模态窗口容器 -->
        <div id="modal-container"></div>
      </div>
    `;
    
    // 挂载组件
    this.components.sidebar.mount(document.getElementById('sidebar'));
    this.components.terminal.mount(document.getElementById('terminal-container'));
    this.components.statusBar.mount(document.getElementById('status-bar'));
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 窗口控制
    document.getElementById('btn-minimize').addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });
    
    document.getElementById('btn-maximize').addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });
    
    document.getElementById('btn-close').addEventListener('click', () => {
      this.handleClose();
    });
    
    // 组件事件
    this.components.sidebar.on('config-selected', (config) => {
      this.handleConfigChange(config);
    });
    
    this.components.sidebar.on('show-environment', () => {
      this.showEnvironmentPanel();
    });
    
    this.components.sidebar.on('show-configs', () => {
      this.showConfigManager();
    });
    
    this.components.sidebar.on('show-config-wizard', () => {
      this.showConfigWizard();
    });
    
    // 监听配置界面切换事件
    window.addEventListener('show-config-manager', () => {
      this.showConfigManager();
    });
    
    window.addEventListener('show-config-wizard', () => {
      this.showConfigWizard();
    });
    
    this.components.sidebar.on('show-installer', () => {
      this.showInstallerWizard();
    });
    
    this.components.sidebar.on('show-local-models', () => {
      this.showLocalModelManager();
    });
    
    this.components.sidebar.on('toggle-claude', () => {
      this.toggleClaude();
    });
    
    // IPC 事件
    window.electronAPI.onEnvironmentUpdate((data) => {
      this.handleEnvironmentUpdate(data);
    });
    
    window.electronAPI.onClaudeOutput((data) => {
      this.components.terminal.handleOutput(data);
    });
    
    window.electronAPI.onClaudeStatusChange((status) => {
      this.handleClaudeStatusChange(status);
    });
    
    window.electronAPI.onConfigChange((config) => {
      this.handleConfigChange(config);
    });
  }

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    try {
      // 加载配置
      const configs = await window.electronAPI.getAllConfigs();
      const currentConfig = await window.electronAPI.getCurrentConfig();
      
      this.components.sidebar.updateConfigs(configs, currentConfig);
      this.state.currentConfig = currentConfig;
      
      // 加载 Claude 状态
      const claudeStatus = await window.electronAPI.getClaudeStatus();
      this.state.claudeRunning = claudeStatus.running;
      this.components.statusBar.updateClaudeStatus(claudeStatus);
      
    } catch (error) {
      console.error('加载初始数据失败:', error);
    }
  }

  /**
   * 开始环境检查
   */
  async startEnvironmentCheck() {
    // 立即执行一次检查
    const result = await window.electronAPI.checkEnvironment();
    this.handleEnvironmentUpdate(result);
    
    // 开始定期检查
    await window.electronAPI.startPeriodicEnvironmentCheck(30000);
  }

  /**
   * 处理环境更新
   */
  handleEnvironmentUpdate(data) {
    this.state.environmentReady = data.summary.ready;
    
    // 更新侧边栏
    this.components.sidebar.updateEnvironmentStatus(data);
    
    // 更新状态栏
    this.components.statusBar.updateEnvironmentStatus(data);
    
    // 更新环境面板（如果打开）
    if (this.components.environmentPanel.isVisible()) {
      this.components.environmentPanel.update(data);
    }
    
    // 如果环境未就绪，显示提示
    if (!data.summary.ready && !this.components.installerWizard.isVisible()) {
      this.components.statusBar.showWarning('环境未就绪，点击查看详情');
    }
  }

  /**
   * 显示环境面板
   */
  showEnvironmentPanel() {
    const modalContainer = document.getElementById('modal-container');
    this.components.environmentPanel.show(modalContainer);
  }

  /**
   * 显示配置管理器
   */
  showConfigManager() {
    const modalContainer = document.getElementById('modal-container');
    this.components.configManager.show(modalContainer);
  }

  /**
   * 显示配置向导
   */
  showConfigWizard() {
    const modalContainer = document.getElementById('modal-container');
    this.components.configWizard.show(modalContainer);
  }
  
  /**
   * 切换到终端页面
   */
  switchToTerminal() {
    // 确保终端容器可见
    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
      terminalContainer.scrollIntoView({ behavior: 'smooth' });
      
      // 激活终端焦点
      if (this.components.terminal) {
        this.components.terminal.focus();
      }
      
      // 更新侧边栏活动状态
      if (this.components.sidebar) {
        this.components.sidebar.setActiveItem('terminal');
      }
    }
  }

  /**
   * 显示安装向导
   */
  async showInstallerWizard() {
    const modalContainer = document.getElementById('modal-container');
    
    // 获取最新的环境状态
    const envStatus = await window.electronAPI.checkEnvironment();
    const missing = envStatus.summary.missing;
    
    if (missing.length === 0) {
      window.electronAPI.showInfo('提示', '所有依赖都已安装！');
      return;
    }
    
    this.components.installerWizard.show(modalContainer, missing);
  }

  /**
   * 切换 Claude 状态
   */
  async toggleClaude() {
    try {
      if (this.state.claudeRunning) {
        await window.electronAPI.stopClaude();
      } else {
        if (!this.state.environmentReady) {
          const confirm = await window.electronAPI.showConfirm(
            '环境未就绪',
            '环境检测显示有缺失的依赖，是否仍要尝试启动？'
          );
          
          if (!confirm) return;
        }
        
        if (!this.state.currentConfig) {
          window.electronAPI.showError('错误', '请先选择一个配置');
          return;
        }
        
        await window.electronAPI.startClaude(this.state.currentConfig);
      }
    } catch (error) {
      window.electronAPI.showError('操作失败', error.message);
    }
  }

  /**
   * 处理配置变更
   */
  async handleConfigChange(config) {
    this.state.currentConfig = config;
    
    // 如果 Claude 正在运行，提示重启
    if (this.state.claudeRunning) {
      const confirm = await window.electronAPI.showConfirm(
        '配置已更改',
        'Claude 正在运行中，是否重启以应用新配置？'
      );
      
      if (confirm) {
        await window.electronAPI.restartClaude();
      }
    }
  }

  /**
   * 处理 Claude 状态变化
   */
  handleClaudeStatusChange(status) {
    this.state.claudeRunning = status.running;
    
    // 更新 UI
    this.components.sidebar.updateClaudeStatus(status);
    this.components.statusBar.updateClaudeStatus(status);
    
    // 显示通知
    if (status.type === 'started') {
      this.components.statusBar.showSuccess('Claude 已启动');
    } else if (status.type === 'stopped') {
      this.components.statusBar.showInfo('Claude 已停止');
    } else if (status.type === 'error') {
      this.components.statusBar.showError('Claude 运行错误: ' + status.message);
    }
  }

  /**
   * 显示本地模型管理器
   */
  showLocalModelManager() {
    const modalContainer = document.getElementById('modal-container');
    this.components.localModelManager.show(modalContainer);
  }

  /**
   * 处理关闭
   */
  async handleClose() {
    if (this.state.claudeRunning) {
      const confirm = await window.electronAPI.showConfirm(
        '确认退出',
        'Claude 正在运行中，是否确定退出？'
      );
      
      if (!confirm) return;
    }
    
    window.electronAPI.quit();
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  
  // 暴露必要的方法到全局
  window.switchToTerminal = () => window.app.switchToTerminal();
  window.showConfigManager = () => window.app.showConfigManager();
  window.showConfigWizard = () => window.app.showConfigWizard();
  window.showEnvironmentPanel = () => window.app.showEnvironmentPanel();
  window.showLocalModelManager = () => window.app.showLocalModelManager();
});