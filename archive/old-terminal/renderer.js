'use strict';

let terminal = null;
let currentConfig = null;
let configs = [];
let isInitialized = false; // 防止重复初始化
let commandExecutor = null; // 命令执行器

// 备用终端设置
function setupFallbackTerminal(container) {
  const TerminalClass = window.SimpleTerminal || window.EnhancedTerminal;
  if (TerminalClass) {
    terminal = new TerminalClass(container);
    terminal.writeln('⚠️ 使用简化终端模式');
    terminal.writeln('');
  } else {
    console.error('❌ 没有可用的终端实现');
  }
}

async function init() {
  // 防止重复初始化
  if (isInitialized) {
    console.warn('应用已经初始化，跳过重复初始化');
    return;
  }
  isInitialized = true;
  console.log('初始化渲染进程...');
  
  // 测试 IPC 通信
  console.log('测试 electronAPI:', window.electronAPI);
  
  try {
    // 先测试 IPC 是否正常
    const testResult = await window.electronAPI.testIPC();
    console.log('IPC 测试结果:', testResult);
  } catch (error) {
    console.error('IPC 测试失败:', error);
  }
  
  // 先设置欢迎菜单标志，防止过早处理输入
  window.isInWelcomeMenu = true;
  
  await setupTerminal();
  setupEventListeners();
  await loadConfigs();
  
  // 延迟一下确保终端完全初始化
  setTimeout(async () => {
    console.log('准备显示欢迎菜单...');
    console.log('window.WelcomeMenu:', window.WelcomeMenu);
    console.log('terminal:', terminal);
    
    // 先清空终端，确保没有其他内容
    if (terminal && terminal.clear) {
      terminal.clear();
    }
    
    // 每次启动都显示欢迎菜单
    if (window.WelcomeMenu && terminal) {
      console.log('创建欢迎菜单实例...');
      try {
        // 设置欢迎菜单标志
        window.isInWelcomeMenu = true;
        
        // 显示欢迎菜单
        const welcomeMenu = new window.WelcomeMenu(terminal, { 
          currentConfig, 
          updateFooterStatus: updateFooterStatus.bind(this) 
        });
        
        // 监听菜单关闭
        welcomeMenu.onClose = () => {
          window.isInWelcomeMenu = false;
        };
        
        console.log('显示欢迎菜单...');
        await welcomeMenu.show();
        console.log('欢迎菜单显示完成');
      } catch (error) {
        console.error('显示欢迎菜单出错:', error);
        terminal.writeln(`错误: ${error.message}`);
        window.isInWelcomeMenu = false;
      }
    } else {
      console.warn('欢迎菜单不可用', { WelcomeMenu: window.WelcomeMenu, terminal });
      // 如果欢迎菜单不可用，显示普通的欢迎信息
      window.isInWelcomeMenu = false; // 取消欢迎菜单模式
      terminal.writeln('');
      terminal.writeln('欢迎使用 Miaoda Claude Code Manager');
      terminal.writeln('');
      terminal.writeln('提示：输入 "help" 查看可用命令');
      terminal.writeln('');
      terminal.write('\x1b[38;2;0;255;0mmiaoda\x1b[0m \x1b[38;2;100;200;255m>\x1b[0m ');
    }
  }, 1000); // 增加延迟到1秒确保所有资源加载完成
}

async function setupTerminal() {
  const container = document.getElementById('terminal');
  console.log('开始设置终端...');
  console.log('终端容器:', container);
  
  // 使用新的终端管理器
  if (window.TerminalManager) {
    console.log('TerminalManager 可用');
    const manager = new window.TerminalManager();
    const success = await manager.initialize(container);
    
    if (success) {
      terminal = manager;
      console.log('✓ 使用 xterm.js 终端');
      console.log('终端对象:', terminal);
    } else {
      console.warn('⚠️ xterm.js 初始化失败，使用备用终端');
      setupFallbackTerminal(container);
    }
  } else {
    console.warn('⚠️ TerminalManager 不可用，使用备用终端');
    setupFallbackTerminal(container);
  }

  // 设置终端数据接收
  let blockTerminalData = true; // 初始时阻止终端数据，等欢迎菜单显示后再启用
  
  window.electronAPI.onTerminalData((data) => {
    console.log('收到终端数据:', data);
    if (!blockTerminalData) {
      terminal.write(data);
    } else {
      console.log('阻止终端数据（欢迎菜单模式）');
    }
  });
  
  // 2秒后解除阻止
  setTimeout(() => {
    blockTerminalData = false;
    console.log('解除终端数据阻止');
  }, 2000);

  // 创建命令执行器
  if (window.CommandExecutor) {
    commandExecutor = new window.CommandExecutor(terminal);
  }
  
  terminal.onData(async (data) => {
    // 测试命令：输入 "menu" 显示欢迎菜单
    if (data.trim() === 'menu') {
      console.log('手动触发欢迎菜单显示');
      terminal.clear();
      if (window.WelcomeMenu) {
        window.isInWelcomeMenu = true;
        const welcomeMenu = new window.WelcomeMenu(terminal, { 
          currentConfig, 
          updateFooterStatus: updateFooterStatus.bind(this) 
        });
        // 监听菜单关闭
        welcomeMenu.onClose = () => {
          window.isInWelcomeMenu = false;
        };
        await welcomeMenu.show();
      }
      return;
    }
    
    // 如果在欢迎菜单中，不处理输入（让欢迎菜单自己处理）
    if (window.isInWelcomeMenu) {
      console.log('在欢迎菜单中，跳过命令处理');
      return;
    }
    
    console.log('window.isInWelcomeMenu:', window.isInWelcomeMenu);
    
    // 只处理包含回车的完整命令
    if (data.includes('\r')) {
      const command = data.replace(/[\r\n]/g, '').trim();
      console.log('处理命令:', JSON.stringify(command));
      
      // 如果有命令执行器，先尝试本地处理
      if (commandExecutor) {
        const handled = await commandExecutor.execute(command);
        if (handled) {
          // 显示新的提示符
          terminal.write('\x1b[38;2;0;255;0mmiaoda\x1b[0m \x1b[38;2;100;200;255m>\x1b[0m ');
          return;
        }
      }
      
      // 如果命令为空，只显示新提示符
      if (!command) {
        terminal.write('\x1b[38;2;0;255;0mmiaoda\x1b[0m \x1b[38;2;100;200;255m>\x1b[0m ');
        return;
      }
      
      // 否则发送到后端
      window.electronAPI.sendTerminalInput(data);
    }
    // 其他字符已经在 TerminalManager 中处理并显示了
  });
  
  // 设置全局终端引用
  window.terminal = terminal;
  
  // 确保终端获得焦点
  setTimeout(() => {
    if (terminal.focus) {
      terminal.focus();
      console.log('终端已获得焦点');
    } else if (terminal.input) {
      terminal.input.focus();
      console.log('终端输入已获得焦点');
    }
    
    // 再次确保终端容器可以接收事件
    const terminalContainer = document.getElementById('terminal');
    if (terminalContainer) {
      terminalContainer.setAttribute('tabindex', '0');
      terminalContainer.focus();
    }
  }, 200);
  
  // 监听批准请求
  window.electronAPI.onApprovalRequest && window.electronAPI.onApprovalRequest(async (type, request) => {
    if (terminal.handleApprovalRequest) {
      return await terminal.handleApprovalRequest(type, request);
    }
    return false;
  });
}

function setupEventListeners() {
  // 记录已绑定的事件监听器（用于验证）
  window._boundEventListeners = window._boundEventListeners || [];
  
  // 辅助函数：安全地添加事件监听器
  const addListener = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
      // 记录绑定信息
      window._boundEventListeners.push({ id, event, handler: handler.name });
      console.log(`✓ 为 #${id} 绑定了 ${event} 事件 -> ${handler.name}`);
    } else {
      console.warn(`元素 #${id} 未找到`);
    }
  };

  addListener('check-env-btn', 'click', checkEnvironment);
  addListener('new-config-btn', 'click', showNewConfigForm);
  addListener('start-claude-btn', 'click', startClaudeCode);
  addListener('export-config-btn', 'click', exportConfigs);
  addListener('import-config-btn', 'click', importConfigs);
  addListener('restore-default-btn', 'click', restoreDefaults);
  addListener('config-edit-form', 'submit', saveConfig);
  addListener('cancel-config-btn', 'click', hideConfigForm);
  addListener('test-config-btn', 'click', testConfig);
  addListener('save-and-start-btn', 'click', saveAndStartConfig);
  addListener('stop-claude-btn', 'click', stopClaudeCode);
  addListener('quick-fill-btn', 'click', quickFillTestConfig);
  addListener('clear-terminal-btn', 'click', clearTerminal);
  addListener('copy-terminal-btn', 'click', copyTerminal);
  addListener('about-btn', 'click', showAbout);
  addListener('share-btn', 'click', showShare);
  
  // 设置按钮事件
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettings);
  }
  
  // 添加设置对话框的事件监听器
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', closeSettingsDialog);
  }
  
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  // 添加关于对话框的事件监听器
  const aboutCloseBtn = document.getElementById('about-close-btn');
  if (aboutCloseBtn) {
    aboutCloseBtn.addEventListener('click', closeAboutDialog);
  }
  
  const githubBtn = document.getElementById('github-btn');
  if (githubBtn) {
    githubBtn.addEventListener('click', openGithub);
  }
  
  const websiteBtn = document.getElementById('website-btn');
  if (websiteBtn) {
    websiteBtn.addEventListener('click', openWebsite);
  }
  
  // 添加配置对话框关闭按钮事件
  const configCloseBtn = document.getElementById('config-close-btn');
  if (configCloseBtn) {
    configCloseBtn.addEventListener('click', hideConfigForm);
  }
  
  // 添加 Ctrl+C 快捷键来停止 Claude Code
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key === 'c' && document.activeElement === terminal.input) {
      e.preventDefault();
      await stopClaudeCode();
    }
  });

  window.addEventListener('resize', () => {
    // 简单终端会自动适应
  });

  window.electronAPI.onStatusUpdate((data) => {
    updateStatus(data.message);
  });
  
  // 监听代理配置事件
  window.addEventListener('showProxyConfig', (event) => {
    const proxyConfig = event.detail;
    showProxyConfigForm(proxyConfig);
  });
}

async function checkEnvironment() {
  const checkBtn = document.getElementById('check-env-btn');
  const originalText = checkBtn.textContent;
  
  // 禁用按钮，防止重复点击
  checkBtn.disabled = true;
  checkBtn.textContent = '检查中...';
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('check_environment');
  
  updateStatus('正在检查环境...');
  terminal.writeln('');
  terminal.writeln('正在检查系统环境...');
  terminal.writeln('');
  
  // 立即显示检查状态，避免界面无响应
  const envItems = ['nodejs', 'git', 'uv', 'claude'];
  envItems.forEach(key => {
    const statusEl = document.querySelector(`[data-env="${key}"]`);
    if (statusEl) {
      statusEl.textContent = '检查中...';
      statusEl.setAttribute('data-status', 'checking');
    }
  });

  try {
    console.log('开始调用 checkEnvironment API...');
    const results = await window.electronAPI.checkEnvironment();
    console.log('收到环境检查结果:', results);
    
    for (const [key, value] of Object.entries(results)) {
      const statusEl = document.querySelector(`[data-env="${key}"]`);
      const installBtn = document.querySelector(`[data-dep="${key}"]`);
      
      if (statusEl) {
        if (value.installed) {
          statusEl.textContent = value.version || '已安装';
          statusEl.setAttribute('data-status', 'installed');
          terminal.writeln(`✓ ${key}: ${value.version || '已安装'}`);
          if (installBtn) installBtn.style.display = 'none';
        } else {
          // 特殊处理 uv 的错误码显示
          let errorMsg = value.error || '未安装';
          // 确保 errorMsg 是字符串
          errorMsg = String(errorMsg);
          if (key === 'uv' && (errorMsg === '127' || errorMsg === 'ENOENT' || errorMsg.includes('not found'))) {
            errorMsg = '未安装';
          }
          statusEl.textContent = errorMsg;
          statusEl.setAttribute('data-status', 'not-installed');
          terminal.writeln(`✗ ${key}: ${errorMsg}`);
          if (installBtn) installBtn.style.display = 'inline-block';
        }
      }
    }
    
    terminal.writeln('');
    terminal.writeln('环境检查完成');
    terminal.writeln('');
    updateStatus('环境检查完成');
    setupInstallButtons();
  } catch (error) {
    console.error('环境检查失败:', error);
    terminal.writeln('');
    terminal.writeln(`错误: ${error.message}`);
    terminal.writeln('');
    updateStatus('环境检查失败');
    
    // 如果检查失败，将所有状态重置为错误状态
    envItems.forEach(key => {
      const statusEl = document.querySelector(`[data-env="${key}"]`);
      if (statusEl) {
        statusEl.textContent = '检查失败';
        statusEl.setAttribute('data-status', 'error');
      }
    });
  } finally {
    // 恢复按钮状态
    checkBtn.disabled = false;
    checkBtn.textContent = originalText;
  }
}

function setupInstallButtons() {
  const installButtons = document.querySelectorAll('.install-btn');
  installButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const dep = e.target.getAttribute('data-dep');
      await installDependency(dep);
    });
  });
}

async function installDependency(dep) {
  updateStatus(`正在安装 ${dep}...`);
  terminal.writeln(`\n正在安装 ${dep}...\n`);
  
  try {
    const result = await window.electronAPI.installDependency(dep);
    if (result.success) {
      terminal.writeln(`\n${result.message}\n`);
      updateStatus(result.message);
      await checkEnvironment();
    } else {
      terminal.writeln(`\n安装失败: ${result.message}\n`);
      updateStatus(`安装 ${dep} 失败`);
    }
  } catch (error) {
    terminal.writeln(`\n安装出错: ${error.message}\n`);
    updateStatus(`安装 ${dep} 出错`);
  }
}

async function loadConfigs() {
  try {
    // 初始化默认配置（如果需要）
    if (window.initializeDefaultConfigs) {
      configs = await window.initializeDefaultConfigs();
    } else {
      const result = await window.electronAPI.getConfigs();
      configs = result.configs || [];
    }
    
    renderConfigList();
    
    // 不再自动选择配置，让用户通过欢迎菜单选择
    // if (!currentConfig && configs.length > 0) {
    //   const recommendedConfig = window.getRecommendedConfig ? 
    //     configs.find(c => c.id === window.getRecommendedConfig().id) : 
    //     configs[0];
    //   
    //   if (recommendedConfig) {
    //     selectConfig(recommendedConfig);
    //   }
    // }
    
    // 检查是否需要配置提示
    if (currentConfig && window.needsConfiguration && window.needsConfiguration(currentConfig)) {
      const tips = window.getConfigurationTips(currentConfig);
      if (tips.length > 0) {
        terminal.writeln('\n⚠️ 配置提示:');
        tips.forEach(tip => terminal.writeln(`  • ${tip}`));
        terminal.writeln('');
      }
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    terminal.writeln('❌ 加载配置失败: ' + error.message);
  }
}

function renderConfigList() {
  const listEl = document.getElementById('config-list');
  listEl.innerHTML = '';

  configs.forEach(config => {
    const item = document.createElement('div');
    item.className = 'config-item';
    if (currentConfig && currentConfig.id === config.id) {
      item.classList.add('active');
    }
    
    item.innerHTML = `
      <div class="config-item-content">
        <div class="config-item-name">${config.name}</div>
        <div class="config-item-url">${config.apiUrl}</div>
      </div>
      <button class="btn btn-small btn-danger delete-config-btn" data-id="${config.id}" title="删除配置">删除</button>
    `;
    
    // 为配置内容区域添加点击事件
    const contentArea = item.querySelector('.config-item-content');
    contentArea.addEventListener('click', () => selectConfig(config));
    
    // 双击直接启动
    contentArea.addEventListener('dblclick', async () => {
      currentConfig = config;
      renderConfigList();
      updateStartButton();
      await startClaudeCode();
    });
    
    // 删除按钮事件
    const deleteBtn = item.querySelector('.delete-config-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConfig(config.id, config.name);
    });
    
    listEl.appendChild(item);
  });
}

function selectConfig(config) {
  currentConfig = config;
  renderConfigList();
  showConfigForm(config);
  updateStartButton();
  updateFooterStatus();
}

function updateStartButton() {
  const startBtn = document.getElementById('start-claude-btn');
  if (currentConfig && currentConfig.apiUrl && currentConfig.apiKey) {
    startBtn.style.display = 'inline-block';
    startBtn.textContent = `启动 ${currentConfig.name || 'Claude Code'}`;
  } else {
    startBtn.style.display = 'none';
  }
}

function showNewConfigForm() {
  currentConfig = {
    id: Date.now().toString(),
    name: '',
    apiUrl: '',
    apiKey: '',
    model: 'claude-3-opus-20240229'
  };
  showConfigForm(currentConfig);
}

function showConfigForm(config) {
  document.getElementById('config-id').value = config.id;
  document.getElementById('config-name').value = config.name;
  document.getElementById('api-url').value = config.apiUrl;
  document.getElementById('api-key').value = config.apiKey;
  document.getElementById('model').value = config.model;
  
  // 显示配置对话框
  document.getElementById('config-dialog').style.display = 'flex';
}

function showProxyConfigForm(proxyConfig) {
  // 创建新的配置对象
  const config = {
    id: Date.now().toString(),
    name: proxyConfig.name || '',
    apiUrl: proxyConfig.apiUrl || '',
    apiKey: '',
    model: proxyConfig.model || '',
    proxyType: proxyConfig.proxyType || 'custom'
  };
  
  // 设置当前配置
  currentConfig = config;
  
  // 显示配置表单
  showConfigForm(config);
}

function hideConfigForm() {
  // 隐藏配置对话框
  document.getElementById('config-dialog').style.display = 'none';
  // 隐藏测试结果
  const testResultDiv = document.getElementById('test-result');
  if (testResultDiv) {
    testResultDiv.style.display = 'none';
  }
}

async function testConfig() {
  const testResultDiv = document.getElementById('test-result');
  const testResultContent = testResultDiv.querySelector('.test-result-content');
  const testBtn = document.getElementById('test-config-btn');
  
  // 获取当前表单中的配置
  const config = {
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    model: document.getElementById('model').value
  };
  
  // 基本验证
  if (!config.apiUrl || !config.apiKey || !config.model) {
    testResultDiv.style.display = 'block';
    testResultDiv.className = 'test-result error';
    testResultContent.textContent = '请填写所有必需的配置项';
    return;
  }
  
  // 显示测试中状态
  testBtn.disabled = true;
  testBtn.textContent = '测试中...';
  testResultDiv.style.display = 'block';
  testResultDiv.className = 'test-result testing';
  testResultContent.textContent = '正在测试连接...';
  
  try {
    // 调用主进程测试 API
    const result = await window.electronAPI.testApiConnection(config);
    
    if (result.success) {
      testResultDiv.className = 'test-result success';
      testResultContent.textContent = '✓ 连接成功！API 配置有效';
    } else {
      testResultDiv.className = 'test-result error';
      testResultContent.textContent = `✗ 连接失败：${result.message || '无法连接到 API'}`;
    }
  } catch (error) {
    testResultDiv.className = 'test-result error';
    testResultContent.textContent = `✗ 测试失败：${error.message}`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
}

async function saveAndStartConfig(e) {
  if (e) e.preventDefault();
  
  const config = {
    id: document.getElementById('config-id').value,
    name: document.getElementById('config-name').value,
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    model: document.getElementById('model').value
  };

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    updateStatus(validation.message);
    terminal.writeln(`\n配置错误: ${validation.message}\n`);
    return;
  }

  try {
    // 保存配置
    await window.electronAPI.saveConfig(config);
    await loadConfigs();
    hideConfigForm();
    updateStatus('配置已保存');
    terminal.writeln(`\n配置 "${config.name}" 已保存\n`);
    
    // 设置当前配置
    currentConfig = config;
    updateStartButton();
    
    // 立即启动 Claude Code
    terminal.writeln('\n正在启动 Claude Code...\n');
    await startClaudeCode();
  } catch (error) {
    updateStatus('保存配置失败');
    terminal.writeln(`\n保存配置失败: ${error.message}\n`);
  }
}

async function saveConfig(e) {
  e.preventDefault();
  
  const config = {
    id: document.getElementById('config-id').value,
    name: document.getElementById('config-name').value,
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    model: document.getElementById('model').value
  };

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    updateStatus(validation.message);
    terminal.writeln(`\n配置错误: ${validation.message}\n`);
    return;
  }

  try {
    await window.electronAPI.saveConfig(config);
    await loadConfigs();
    hideConfigForm();
    updateStatus('配置已保存');
    terminal.writeln(`\n配置 "${config.name}" 已保存\n`);
    
    // 设置当前配置
    currentConfig = config;
    updateStartButton();
    
    // 自动启动 Claude Code
    terminal.writeln('\n正在自动启动 Claude Code...\n');
    await startClaudeCode();
  } catch (error) {
    updateStatus('保存配置失败');
    terminal.writeln(`\n保存配置失败: ${error.message}\n`);
  }
}

function validateConfig(config) {
  if (!config.name || config.name.trim() === '') {
    return { valid: false, message: '请输入配置名称' };
  }
  
  if (!config.apiUrl || !isValidUrl(config.apiUrl)) {
    return { valid: false, message: '请输入有效的 API URL' };
  }
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    return { valid: false, message: '请输入 API Key' };
  }
  
  
  return { valid: true };
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function startClaudeCode() {
  if (!currentConfig) {
    updateStatus('请先选择一个配置');
    return;
  }
  
  // 检查配置是否需要设置
  if (window.needsConfiguration && window.needsConfiguration(currentConfig)) {
    const tips = window.getConfigurationTips(currentConfig);
    terminal.writeln('\n❌ 配置不完整:');
    tips.forEach(tip => terminal.writeln(`  • ${tip}`));
    terminal.writeln('\n请先完成配置设置');
    updateStatus('配置不完整');
    return;
  }

  updateStatus('正在启动 Claude Code...');
  terminal.writeln('\n正在启动 Claude Code...\n');
  
  // 设置终端为处理状态
  if (terminal.setProcessing) {
    terminal.setProcessing(true);
  }
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('start_claude');

  try {
    const result = await window.electronAPI.startClaudeCode(currentConfig);
    if (result.success) {
      updateStatus('Claude Code 已启动');
      terminal.writeln('\nClaude Code 已启动，现在可以开始对话了\n');
      if (terminal.setProcessing) {
        terminal.setProcessing(false);
      }
    } else {
      updateStatus('启动失败');
      terminal.writeln(`\n启动失败: ${result.message}\n`);
      if (terminal.setError) {
        terminal.setError(true);
        setTimeout(() => terminal.setError(false), 3000);
      }
    }
  } catch (error) {
    updateStatus('启动出错');
    terminal.writeln(`\n启动出错: ${error.message}\n`);
    if (terminal.setError) {
      terminal.setError(true);
      setTimeout(() => terminal.setError(false), 3000);
    }
  } finally {
    if (terminal.setProcessing) {
      terminal.setProcessing(false);
    }
  }
}

async function deleteConfig(configId, configName) {
  // 检查是否是默认的免费试用配置
  if (configId === 'free-claude-trial') {
    updateStatus('不能删除默认的免费试用配置');
    terminal.writeln('\n❌ 不能删除默认的免费试用配置\n');
    return;
  }
  
  if (confirm(`确定要删除配置 "${configName}" 吗？`)) {
    try {
      await window.electronAPI.deleteConfig(configId);
      
      // 如果删除的是当前选中的配置，清空选择
      if (currentConfig && currentConfig.id === configId) {
        currentConfig = null;
        updateStartButton();
      }
      
      await loadConfigs();
      updateStatus(`已删除配置: ${configName}`);
      terminal.writeln(`\n已删除配置 "${configName}"\n`);
    } catch (error) {
      updateStatus('删除配置失败');
      terminal.writeln(`\n删除配置失败: ${error.message}\n`);
    }
  }
}

async function restoreDefaults() {
  if (confirm('确定要恢复官方默认设置吗？这将删除所有自定义配置。')) {
    try {
      configs = [];
      for (const config of await window.electronAPI.getConfigs()) {
        await window.electronAPI.deleteConfig(config.id);
      }
      renderConfigList();
      updateStatus('已恢复默认设置');
      terminal.writeln('\n已恢复官方默认设置\n');
    } catch (error) {
      updateStatus('恢复默认设置失败');
      terminal.writeln(`\n恢复默认设置失败: ${error.message}\n`);
    }
  }
}

function quickFillTestConfig() {
  // 填充免费测试配置
  document.getElementById('config-name').value = '免费测试 API';
  document.getElementById('api-url').value = 'http://www.miaoda.vip/';
  document.getElementById('api-key').value = 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44';
  document.getElementById('model').value = 'claude-3-7-sonnet-20250219';
  
  updateStatus('已填充免费测试配置');
  terminal.writeln('');
  terminal.writeln('已填充免费测试配置');
  terminal.writeln('');
  terminal.writeln('提示: 这是第三方提供的免费测试 API，可能有使用限制');
  terminal.writeln('');
}

function clearTerminal() {
  terminal.clear();
}

function copyTerminal() {
  const selection = terminal.getSelection();
  if (selection) {
    navigator.clipboard.writeText(selection);
    updateStatus('已复制到剪贴板');
  }
}

function updateStatus(message) {
  // 添加时间戳到控制台
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  
  console.log(`[${timeStr}] ${message}`);
  
  // 更新底部状态栏
  updateFooterStatus();
  
  // 如果是重要消息，可以显示在终端中
  if (message && !message.includes('就绪')) {
    if (terminal && terminal.writeln) {
      terminal.writeln(`[${timeStr}] ${message}`);
    }
  }
}

function updateFooterStatus() {
  // 更新底部状态栏
  const apiUrlEl = document.getElementById('api-url-display');
  const modelEl = document.getElementById('model-display');
  
  if (currentConfig) {
    // 显示 API URL（移除协议部分，只显示域名）
    let displayUrl = currentConfig.apiUrl;
    try {
      const url = new URL(currentConfig.apiUrl);
      displayUrl = url.hostname;
      // 如果有端口号，也显示出来
      if (url.port) {
        displayUrl += ':' + url.port;
      }
    } catch (e) {
      // 如果解析失败，显示原始 URL
    }
    
    if (apiUrlEl) apiUrlEl.textContent = displayUrl;
    if (modelEl) modelEl.textContent = currentConfig.model;
  } else {
    if (apiUrlEl) apiUrlEl.textContent = '未配置';
    if (modelEl) modelEl.textContent = '未选择模型';
  }
}

async function exportConfigs() {
  if (configs.length === 0) {
    updateStatus('没有配置可导出');
    return;
  }
  
  const data = JSON.stringify(configs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `miaoda-configs-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  updateStatus(`已导出 ${configs.length} 个配置`);
  terminal.writeln(`\n已导出 ${configs.length} 个配置到文件\n`);
}

async function importConfigs() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedConfigs = JSON.parse(text);
      
      if (!Array.isArray(importedConfigs)) {
        throw new Error('无效的配置文件格式');
      }
      
      for (const config of importedConfigs) {
        // 验证导入的配置
        const validation = validateConfig(config);
        if (validation.valid) {
          // 生成新ID避免冲突
          config.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          await window.electronAPI.saveConfig(config);
        }
      }
      
      await loadConfigs();
      updateStatus(`已导入 ${importedConfigs.length} 个配置`);
      terminal.writeln(`\n已从文件导入 ${importedConfigs.length} 个配置\n`);
    } catch (error) {
      updateStatus('导入配置失败');
      terminal.writeln(`\n导入失败: ${error.message}\n`);
    }
  };
  
  input.click();
}

async function stopClaudeCode() {
  try {
    await window.electronAPI.stopClaudeCode();
    terminal.writeln('\n\n已停止 Claude Code 进程\n');
    updateStatus('Claude Code 已停止');
  } catch (error) {
    terminal.writeln(`\n停止失败: ${error.message}\n`);
  }
}

function showAbout() {
  const dialog = document.getElementById('about-dialog');
  dialog.style.display = 'flex';
  
  // 设置当前版本号
  const currentVersion = '2.0.3';
  document.getElementById('current-version').textContent = currentVersion;
  
  // 添加检查更新按钮事件
  const checkUpdateBtn = document.getElementById('check-update-btn');
  checkUpdateBtn.onclick = () => checkForUpdates(currentVersion);
}

function closeAboutDialog() {
  const dialog = document.getElementById('about-dialog');
  dialog.style.display = 'none';
}

function openGithub() {
  window.electronAPI.openExternal('https://github.com/miaoda-ai/miaoda');
}

function openWebsite() {
  window.electronAPI.openExternal('https://www.imiaoda.cn');
}

async function checkForUpdates(currentVersion) {
  const updateInfo = document.getElementById('update-info');
  const updateContent = updateInfo.querySelector('.update-content');
  const checkBtn = document.getElementById('check-update-btn');
  
  // 显示检查中状态
  updateInfo.style.display = 'block';
  updateInfo.className = 'update-info';
  updateContent.textContent = '正在检查更新...';
  checkBtn.disabled = true;
  
  try {
    // 调用主进程检查更新
    const result = await window.electronAPI.checkForUpdates();
    
    if (result.error) {
      updateInfo.className = 'update-info error';
      updateContent.textContent = `检查更新失败：${result.error}`;
    } else if (result.hasUpdate) {
      updateInfo.className = 'update-info available';
      
      // 根据平台选择正确的下载链接
      const platform = window.electronAPI.platform;
      let downloadUrl = result.downloadUrl;
      
      if (platform === 'darwin') {
        // Mac 平台 - 检测是否为 Apple Silicon
        const isAppleSilicon = window.electronAPI.isAppleSilicon;
        downloadUrl = isAppleSilicon ? result.downloadUrlMacArm : result.downloadUrlMac;
      } else if (platform === 'win32') {
        downloadUrl = result.downloadUrlWin;
      }
      
      updateContent.innerHTML = `
        <p>发现新版本 <strong>${result.latestVersion}</strong></p>
        <p>当前版本：${currentVersion}</p>
        <p style="margin-top: 10px;">
          <a href="#" onclick="window.electronAPI.openExternal('${downloadUrl}'); return false;">
            点击下载最新版本
          </a>
        </p>
        <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">
          提示：下载完成后，请关闭当前应用并安装新版本
        </p>
      `;
    } else {
      updateInfo.className = 'update-info success';
      updateContent.textContent = '✓ 您正在使用最新版本';
    }
  } catch (error) {
    updateInfo.className = 'update-info error';
    updateContent.textContent = `检查更新失败：${error.message}`;
  } finally {
    checkBtn.disabled = false;
  }
}

// 将函数暴露到全局作用域
window.closeAboutDialog = closeAboutDialog;
window.openGithub = openGithub;
window.openWebsite = openWebsite;

// 添加对话框点击外部关闭功能
document.addEventListener('DOMContentLoaded', () => {
  const aboutDialog = document.getElementById('about-dialog');
  if (aboutDialog) {
    aboutDialog.addEventListener('click', (e) => {
      if (e.target === aboutDialog) {
        closeAboutDialog();
      }
    });
  }
});

function showShare() {
  terminal.writeln('\n========== 🔥 必须分享！这是 AI 编程革命！==========');
  terminal.writeln('');
  terminal.writeln('💥 **震撼！全球唯一支持 380+ AI 模型的神器！**');
  terminal.writeln('');
  terminal.writeln('📋 一键复制，分享给所有人：');
  terminal.writeln('');
  terminal.writeln('【🔥AI编程神器】Miaoda - 让你赢在 AI 时代起跑线！');
  terminal.writeln('');
  terminal.writeln('💥 为什么说用了就回不去了？');
  terminal.writeln('✅ 支持 380+ 种 AI 大模型（全球唯一！）');
  terminal.writeln('✅ 效率提升 100 倍（3秒启动！）');
  terminal.writeln('✅ 永久免费（省下几千块！）');
  terminal.writeln('✅ 中文原生支持（完美体验！）');
  terminal.writeln('');
  terminal.writeln('🎯 支持所有大厂：OpenAI/Claude/Google/百度/阿里/腾讯...');
  terminal.writeln('');
  terminal.writeln('⚡ 立即下载：https://github.com/miounet11/claude-code-manager');
  terminal.writeln('');
  terminal.writeln('#Miaoda #AI编程神器 #效率100倍 #开发者必备');
  terminal.writeln('');
  terminal.writeln('📢 分享渠道：');
  terminal.writeln('  • 💬 微信群 - 让朋友们都用上！');
  terminal.writeln('  • 🌟 朋友圈 - 展示你的前瞻眼光！');
  terminal.writeln('  • 📱 抖音/小红书 - 成为 AI 领域 KOL！');
  terminal.writeln('  • ⭐ GitHub Star - 支持优秀开源！');
  terminal.writeln('');
  terminal.writeln('🎁 **分享就是最大的支持！让更多人受益！**');
  terminal.writeln('=========================================\n');
  
  // 复制分享文本到剪贴板
  const shareText = `【🔥AI编程神器】Miaoda - 让你赢在 AI 时代起跑线！

💥 为什么说用了就回不去了？
✅ 支持 380+ 种 AI 大模型（全球唯一！）
✅ 效率提升 100 倍（3秒启动！）
✅ 永久免费（省下几千块！）
✅ 中文原生支持（完美体验！）

🎯 支持所有大厂：OpenAI/Claude/Google/百度/阿里/腾讯...

⚡ 立即下载：https://github.com/miounet11/claude-code-manager

#Miaoda #AI编程神器 #效率100倍 #开发者必备`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    updateStatus('震撼文案已复制！快去分享吧！');
  });
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('share');
}

// 显示设置对话框
async function showSettings() {
  document.getElementById('settings-dialog').style.display = 'flex';
  
  // 加载当前设置
  const autoLaunchStatus = await window.electronAPI.getAutoLaunchStatus();
  document.getElementById('auto-launch-checkbox').checked = autoLaunchStatus;
  
  // 加载自动更新设置
  const autoUpdateEnabled = await window.electronAPI.getConfig('autoUpdate');
  document.getElementById('auto-update-checkbox').checked = autoUpdateEnabled !== false;
}

// 关闭设置对话框
function closeSettingsDialog() {
  document.getElementById('settings-dialog').style.display = 'none';
}

// 保存设置
async function saveSettings() {
  const autoLaunch = document.getElementById('auto-launch-checkbox').checked;
  const autoUpdate = document.getElementById('auto-update-checkbox').checked;
  
  // 设置开机启动
  const autoLaunchResult = await window.electronAPI.setAutoLaunch(autoLaunch);
  if (!autoLaunchResult.success) {
    updateStatus('设置开机启动失败');
    terminal.writeln(`\n❌ 设置开机启动失败: ${autoLaunchResult.error}\n`);
  }
  
  // 保存自动更新设置
  await window.electronAPI.setConfig('autoUpdate', autoUpdate);
  
  updateStatus('设置已保存');
  terminal.writeln('\n✓ 设置已保存\n');
  
  closeSettingsDialog();
}

// 导出函数到全局
window.updateFooterStatus = updateFooterStatus;
window.currentConfig = currentConfig;

document.addEventListener('DOMContentLoaded', init);