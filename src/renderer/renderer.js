'use strict';

let terminal = null;
let currentConfig = null;
let configs = [];

async function init() {
  setupTerminal();
  setupEventListeners();
  await loadConfigs();
  await checkEnvironment();
}

function setupTerminal() {
  const { SimpleTerminal } = require('./simple-terminal.js');
  
  terminal = new SimpleTerminal(document.getElementById('terminal'));
  
  terminal.writeln('欢迎使用 Miaoda - Claude Code Manager');
  terminal.writeln('版本: 1.0.0');
  terminal.writeln('');

  window.electronAPI.onTerminalData((data) => {
    terminal.write(data);
  });

  terminal.onData((data) => {
    window.electronAPI.sendTerminalInput(data);
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
  document.getElementById('clear-terminal-btn').addEventListener('click', clearTerminal);
  document.getElementById('copy-terminal-btn').addEventListener('click', copyTerminal);

  window.addEventListener('resize', () => {
    // 简单终端会自动适应
  });

  window.electronAPI.onStatusUpdate((data) => {
    updateStatus(data.message);
  });
}

async function checkEnvironment() {
  updateStatus('正在检查环境...');
  terminal.writeln('\n正在检查系统环境...\n');

  try {
    const results = await window.electronAPI.checkEnvironment();
    
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
          statusEl.textContent = '未安装';
          statusEl.setAttribute('data-status', 'not-installed');
          terminal.writeln(`✗ ${key}: 未安装`);
          if (installBtn) installBtn.style.display = 'inline-block';
        }
      }
    }
    
    terminal.writeln('\n环境检查完成\n');
    updateStatus('环境检查完成');
    setupInstallButtons();
  } catch (error) {
    terminal.writeln(`\n错误: ${error.message}\n`);
    updateStatus('环境检查失败');
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
    configs = await window.electronAPI.getConfigs();
    renderConfigList();
  } catch (error) {
    console.error('加载配置失败:', error);
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
      <div class="config-item-name">${config.name}</div>
      <div class="config-item-url">${config.apiUrl}</div>
    `;
    
    item.addEventListener('click', () => selectConfig(config));
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
    model: 'claude-3-opus-20240229',
    proxyPort: 8082
  };
  showConfigForm(currentConfig);
}

function showConfigForm(config) {
  document.getElementById('config-id').value = config.id;
  document.getElementById('config-name').value = config.name;
  document.getElementById('api-url').value = config.apiUrl;
  document.getElementById('api-key').value = config.apiKey;
  document.getElementById('model').value = config.model;
  document.getElementById('proxy-port').value = config.proxyPort;
  
  document.getElementById('config-form').style.display = 'block';
  document.getElementById('terminal-container').style.display = 'none';
}

function hideConfigForm() {
  document.getElementById('config-form').style.display = 'none';
  document.getElementById('terminal-container').style.display = 'flex';
}

async function saveConfig(e) {
  e.preventDefault();
  
  const config = {
    id: document.getElementById('config-id').value,
    name: document.getElementById('config-name').value,
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    model: document.getElementById('model').value,
    proxyPort: parseInt(document.getElementById('proxy-port').value)
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
    updateStartButton();
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
  
  if (config.proxyPort < 1024 || config.proxyPort > 65535) {
    return { valid: false, message: '代理端口必须在 1024-65535 之间' };
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

  updateStatus('正在启动 Claude Code...');
  terminal.writeln('\n正在启动 Claude Code...\n');

  try {
    const result = await window.electronAPI.startClaudeCode(currentConfig);
    if (result.success) {
      updateStatus('Claude Code 已启动');
      terminal.writeln('\nClaude Code 已启动，现在可以开始对话了\n');
    } else {
      updateStatus('启动失败');
      terminal.writeln(`\n启动失败: ${result.message}\n`);
    }
  } catch (error) {
    updateStatus('启动出错');
    terminal.writeln(`\n启动出错: ${error.message}\n`);
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

document.addEventListener('DOMContentLoaded', init);