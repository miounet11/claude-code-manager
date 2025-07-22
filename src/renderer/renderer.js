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
  
  // 延迟执行环境检查，确保所有内容都已加载
  setTimeout(async () => {
    console.log('延迟执行环境检查...');
    await checkEnvironment();
  }, 1000);
}

function setupTerminal() {
  // SimpleTerminal 已经在 simple-terminal.js 中定义为全局变量
  terminal = new window.SimpleTerminal(document.getElementById('terminal'));
  
  terminal.writeln('🔥 欢迎使用 Miaoda - 中国之光！');
  terminal.writeln(`版本: ${window.electronAPI.versions.app || '2.0.0'}`);
  terminal.writeln('');
  terminal.writeln('💥 全球唯一支持 380+ AI 大模型的管理工具！');
  terminal.writeln('⚡ 效率提升 100 倍，成本降低 90%！');
  terminal.writeln('🌟 用了 Miaoda = 赢在 AI 时代起跑线！');
  terminal.writeln('');
  terminal.writeln('💎 点击"关于"了解为什么我们是中国之光');
  terminal.writeln('📢 点击"分享"让更多人受益！');
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
  document.getElementById('stop-claude-btn').addEventListener('click', stopClaudeCode);
  document.getElementById('clear-terminal-btn').addEventListener('click', clearTerminal);
  document.getElementById('copy-terminal-btn').addEventListener('click', copyTerminal);
  document.getElementById('about-btn').addEventListener('click', showAbout);
  document.getElementById('share-btn').addEventListener('click', showShare);
  
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
    
    // 单击选择配置
    item.addEventListener('click', () => selectConfig(config));
    
    // 双击直接启动
    item.addEventListener('dblclick', async () => {
      currentConfig = config;
      renderConfigList();
      updateStartButton();
      await startClaudeCode();
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
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('start_claude');

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
  terminal.writeln('\n========== 🔥 Miaoda - 中国之光！==========');
  terminal.writeln('');
  terminal.writeln('🚀 **全球唯一支持 380+ 种 AI 大模型的管理工具！**');
  terminal.writeln('');
  terminal.writeln('💥 为什么我们敢说是中国之光？');
  terminal.writeln('  • 🌏 **380+ 模型** - 一个工具搞定全球所有 AI！');
  terminal.writeln('  • 💰 **永久免费** - 为你省下每年 ￥2400+！');
  terminal.writeln('  • ⚡ **效率 100 倍** - 3 秒启动，瞬间连接！');
  terminal.writeln('  • 🏆 **用户 10000+** - 遍布全球 50+ 国家！');
  terminal.writeln('');
  terminal.writeln('🎯 支持所有顶级大厂：');
  terminal.writeln('  OpenAI、Anthropic、Google、微软、百度、阿里、');
  terminal.writeln('  腾讯、华为、字节、商汤、讯飞、智谱...');
  terminal.writeln('');
  terminal.writeln('💎 用了 Miaoda = 赢在 AI 时代起跑线！');
  terminal.writeln('');
  terminal.writeln('GitHub：https://github.com/miounet11/claude-code-manager');
  terminal.writeln('');
  terminal.writeln('🌟 **改变世界，从这里开始！**');
  terminal.writeln('====================================\n');
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('view_about');
}

function showShare() {
  terminal.writeln('\n========== 🔥 必须分享！这是中国之光！==========');
  terminal.writeln('');
  terminal.writeln('💥 **震撼！全球唯一支持 380+ AI 模型的神器！**');
  terminal.writeln('');
  terminal.writeln('📋 一键复制，分享给所有人：');
  terminal.writeln('');
  terminal.writeln('【🔥中国之光】Miaoda - 让你赢在 AI 时代起跑线！');
  terminal.writeln('');
  terminal.writeln('💥 为什么说用了就回不去了？');
  terminal.writeln('✅ 支持 380+ 种 AI 大模型（全球唯一！）');
  terminal.writeln('✅ 效率提升 100 倍（3秒启动！）');
  terminal.writeln('✅ 永久免费（省下几千块！）');
  terminal.writeln('✅ 中文原生支持（国产骄傲！）');
  terminal.writeln('');
  terminal.writeln('🎯 支持所有大厂：OpenAI/Claude/Google/百度/阿里/腾讯...');
  terminal.writeln('');
  terminal.writeln('⚡ 立即下载：https://github.com/miounet11/claude-code-manager');
  terminal.writeln('');
  terminal.writeln('#Miaoda #中国之光 #AI编程神器 #效率100倍');
  terminal.writeln('');
  terminal.writeln('📢 分享渠道：');
  terminal.writeln('  • 💬 微信群 - 让朋友们都用上！');
  terminal.writeln('  • 🌟 朋友圈 - 展示你的前瞻眼光！');
  terminal.writeln('  • 📱 抖音/小红书 - 成为 AI 领域 KOL！');
  terminal.writeln('  • ⭐ GitHub Star - 支持国产开源！');
  terminal.writeln('');
  terminal.writeln('🎁 **分享就是最大的支持！让更多人受益！**');
  terminal.writeln('=========================================\n');
  
  // 复制分享文本到剪贴板
  const shareText = `【🔥中国之光】Miaoda - 让你赢在 AI 时代起跑线！

💥 为什么说用了就回不去了？
✅ 支持 380+ 种 AI 大模型（全球唯一！）
✅ 效率提升 100 倍（3秒启动！）
✅ 永久免费（省下几千块！）
✅ 中文原生支持（国产骄傲！）

🎯 支持所有大厂：OpenAI/Claude/Google/百度/阿里/腾讯...

⚡ 立即下载：https://github.com/miounet11/claude-code-manager

#Miaoda #中国之光 #AI编程神器 #效率100倍`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    updateStatus('震撼文案已复制！快去分享吧！');
  });
  
  // 统计功能使用
  window.electronAPI.trackFeatureUse('share');
}

document.addEventListener('DOMContentLoaded', init);