'use strict';

let terminal = null;
let currentConfig = null;
let configs = [];

async function init() {
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
  
  setupTerminal();
  setupEventListeners();
  await loadConfigs();
  
  // 检查是否需要显示新手引导
  const hasSeenGuide = await window.electronAPI.getConfig('hasSeenGuide');
  if (!hasSeenGuide && window.WelcomeGuide) {
    const guide = new window.WelcomeGuide();
    guide.start();
    
    // 监听引导完成事件
    window.addEventListener('guideComplete', async () => {
      await checkEnvironment();
    });
  } else {
    // 延迟执行环境检查，确保所有内容都已加载
    setTimeout(async () => {
      console.log('延迟执行环境检查...');
      await checkEnvironment();
    }, 1000);
  }
}

function setupTerminal() {
  // 优先使用 xterm.js 终端，提供最佳体验
  const TerminalClass = window.XtermTerminal || window.EnhancedTerminal || window.SimpleTerminal;
  terminal = new TerminalClass(document.getElementById('terminal'));
  
  // 显示欢迎信息
  if (terminal.showWelcomeMessage) {
    terminal.showWelcomeMessage();
  } else {
    terminal.writeln('欢迎使用 Miaoda - Claude Code 图形化管理工具');
    terminal.writeln(`版本: ${window.electronAPI.versions.app || '2.0.0'}`);
    terminal.writeln('');
    terminal.writeln('✓ 支持多种 AI 模型配置');
    terminal.writeln('✓ 内置代理服务器');
    terminal.writeln('✓ 简单易用的图形界面');
    terminal.writeln('');
    terminal.writeln('提示: 首次使用请先完成环境检查');
    terminal.writeln('');
  }

  window.electronAPI.onTerminalData((data) => {
    terminal.write(data);
  });

  terminal.onData((data) => {
    // 检查是否是内部命令
    if (data.trim() && !data.startsWith('\n')) {
      const cmd = data.trim();
      if (cmd.startsWith('/') || ['help', 'clear', 'status', 'version', 'approval', 'auto-approval'].includes(cmd.toLowerCase())) {
        terminal.handleCommand(cmd);
        return;
      }
    }
    
    window.electronAPI.sendTerminalInput(data);
  });
  
  // 设置全局终端引用
  window.terminal = terminal;
  
  // 监听批准请求
  window.electronAPI.onApprovalRequest && window.electronAPI.onApprovalRequest(async (type, request) => {
    if (terminal.handleApprovalRequest) {
      return await terminal.handleApprovalRequest(type, request);
    }
    return false;
  });
}

function setupEventListeners() {
  document.getElementById('check-env-btn').addEventListener('click', checkEnvironment);
  document.getElementById('new-config-btn').addEventListener('click', showNewConfigForm);
  document.getElementById('start-claude-btn').addEventListener('click', startClaudeCode);
  document.getElementById('export-config-btn').addEventListener('click', exportConfigs);
  document.getElementById('import-config-btn').addEventListener('click', importConfigs);
  document.getElementById('restore-default-btn').addEventListener('click', restoreDefaults);
  document.getElementById('config-edit-form').addEventListener('submit', saveConfig);
  document.getElementById('cancel-config-btn').addEventListener('click', hideConfigForm);
  document.getElementById('test-config-btn').addEventListener('click', testConfig);
  document.getElementById('save-and-start-btn').addEventListener('click', saveAndStartConfig);
  document.getElementById('stop-claude-btn').addEventListener('click', stopClaudeCode);
  document.getElementById('quick-fill-btn').addEventListener('click', quickFillTestConfig);
  document.getElementById('clear-terminal-btn').addEventListener('click', clearTerminal);
  document.getElementById('copy-terminal-btn').addEventListener('click', copyTerminal);
  document.getElementById('about-btn').addEventListener('click', showAbout);
  document.getElementById('share-btn').addEventListener('click', showShare);
  
  // 设置按钮事件
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettings);
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
  terminal.writeln('\n正在检查系统环境...\n');
  
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
          const errorMsg = value.error || '未安装';
          statusEl.textContent = errorMsg;
          statusEl.setAttribute('data-status', 'not-installed');
          terminal.writeln(`✗ ${key}: ${errorMsg}`);
          if (installBtn) installBtn.style.display = 'inline-block';
        }
      }
    }
    
    terminal.writeln('\n环境检查完成\n');
    updateStatus('环境检查完成');
    setupInstallButtons();
  } catch (error) {
    console.error('环境检查失败:', error);
    terminal.writeln(`\n错误: ${error.message}\n`);
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
      configs = await window.electronAPI.getConfigs();
    }
    
    renderConfigList();
    
    // 如果有推荐配置且没有当前选中的配置，自动选择推荐配置
    if (!currentConfig && configs.length > 0) {
      const recommendedConfig = window.getRecommendedConfig ? 
        configs.find(c => c.id === window.getRecommendedConfig().id) : 
        configs[0];
      
      if (recommendedConfig) {
        selectConfig(recommendedConfig);
      }
    }
    
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
  
  document.getElementById('config-form').style.display = 'block';
  document.getElementById('terminal-container').style.display = 'none';
}

function hideConfigForm() {
  document.getElementById('config-form').style.display = 'none';
  document.getElementById('terminal-container').style.display = 'flex';
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
  document.getElementById('api-url').value = 'http://www.miaoda.vip/v1';
  document.getElementById('api-key').value = 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44';
  document.getElementById('model').value = 'claude-3-7-sonnet-20250219';
  
  updateStatus('已填充免费测试配置');
  terminal.writeln('\n已填充免费测试配置\n');
  terminal.writeln('提示: 这是第三方提供的免费测试 API，可能有使用限制\n');
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
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  
  // 添加时间戳
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  
  // 状态栏动画效果
  statusEl.style.opacity = '0';
  setTimeout(() => {
    statusEl.textContent = `[${timeStr}] ${message}`;
    statusEl.style.opacity = '1';
  }, 100);
  
  // 自动清除状态消息
  clearTimeout(window.statusTimeout);
  window.statusTimeout = setTimeout(() => {
    if (statusEl.textContent.includes(message)) {
      statusEl.textContent = '就绪';
    }
  }, 5000);
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
window.closeSettingsDialog = function() {
  document.getElementById('settings-dialog').style.display = 'none';
};

// 保存设置
window.saveSettings = async function() {
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
};

document.addEventListener('DOMContentLoaded', init);