'use strict';

let terminal = null;
let session = null;
let commandInterceptor = null;
let currentConfig = null;
let configs = [];

// 欢迎菜单状态
let welcomeMenu = null;
let isInWelcomeMenu = false;

/**
 * 初始化应用
 */
async function init() {
  console.log('初始化应用...');
  
  // 初始化终端
  await setupTerminal();
  
  // 设置事件监听
  setupEventListeners();
  
  // 加载配置
  await loadConfigs();
  
  // 显示美化的欢迎界面
  await showWelcomeScreen();
  
  // 根据终端模式决定是否显示欢迎菜单
  if (terminal.isRealTerminal) {
    // 真实终端模式：显示提示信息
    terminal.writeln('\x1b[90m提示: 输入 \x1b[33mmenu\x1b[90m 显示功能菜单，输入 \x1b[33mhelp\x1b[90m 查看帮助\x1b[0m');
    terminal.writeln('');
  } else {
    // 模拟终端模式：自动显示欢迎菜单
    showWelcomeMenu();
  }
}

/**
 * 设置终端
 */
async function setupTerminal() {
  const container = document.getElementById('terminal');
  if (!container) {
    console.error('找不到终端容器');
    return;
  }

  // 调试 xterm.js 加载状态
  console.log('window.Terminal:', window.Terminal);
  console.log('window.XtermWrapper:', window.XtermWrapper);
  console.log('window.SimpleXterm:', window.SimpleXterm);
  
  // 创建终端实例（优先使用 XtermWrapper）
  if (window.XtermWrapper) {
    terminal = new window.XtermWrapper();
  } else if (window.SimpleXterm) {
    terminal = new window.SimpleXterm();
  } else if (window.MiaodaTerminal) {
    // 如果其他包装器不可用，尝试使用 MiaodaTerminal
    console.warn('使用 MiaodaTerminal 类');
    terminal = new window.MiaodaTerminal();
  } else {
    console.error('没有可用的终端实现');
    return;
  }
  
  try {
    const success = await terminal.initialize(container);
    
    if (!success) {
      console.error('终端初始化失败');
      return;
    }
  } catch (error) {
    console.error('终端初始化异常:', error);
    return;
  }

  // 检查是否是真实终端
  if (terminal.isRealTerminal) {
    console.log('使用真实终端模式');
    // 真实终端模式下不需要会话管理
    session = null;
    
    // 创建命令拦截器
    if (window.TerminalCommandInterceptor) {
      commandInterceptor = new window.TerminalCommandInterceptor(terminal);
    }
  } else {
    console.log('使用模拟终端模式');
    // 创建会话（仅在模拟模式下）
    session = new window.TerminalSession(terminal);
    
    // 设置命令处理器
    session.setCommandHandler(handleCommand);
  }
  
  // 监听来自主进程的终端数据（用于 Claude 输出）
  window.electronAPI.onTerminalData((data) => {
    terminal.write(data);
  });

  // 设置键盘快捷键监听
  // 检查是否有 xterm 实例（XtermWrapper 和 SimpleXterm 都有）
  if (terminal.xterm && terminal.xterm.onKey) {
    terminal.xterm.onKey(({ key, domEvent }) => {
    // 只在欢迎界面显示时处理快捷键
    if (!isInWelcomeMenu && !session) {
      switch (key.toLowerCase()) {
      case '1':
        startClaude();
        break;
      case '2':
        showWelcomeMenu();
        break;
      case '3':
        checkEnvironment();
        break;
      case 'h':
        showHelp();
        break;
      }
    }
    });
  }
  
  // 聚焦终端
  terminal.focus();
  
  console.log('终端初始化成功');
}

/**
 * 处理命令
 */
async function handleCommand(command, session) {
  // 特殊命令
  switch (command.toLowerCase()) {
  case 'menu':
    showWelcomeMenu();
    return;
      
  case 'help':
    showHelp();
    return;
      
  case 'clear':
    terminal.clear();
    return;
      
  case 'claude':
    await startClaude();
    return;
      
  case 'config':
    showConfigHelp();
    return;
      
  case 'env':
  case 'check':
    await checkEnvironment();
    return;
  }

  // 如果没有匹配的命令，尝试作为系统命令执行
  if (!isInWelcomeMenu) {
    terminal.writeln(`执行命令: ${command}`);
    window.electronAPI.sendTerminalInput(command + '\r');
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  terminal.writeln('\x1b[36m可用命令:\x1b[0m');
  terminal.writeln('  \x1b[32mmenu\x1b[0m      - 显示欢迎菜单');
  terminal.writeln('  \x1b[32mclaude\x1b[0m    - 启动 Claude Code');
  terminal.writeln('  \x1b[32mconfig\x1b[0m    - 配置管理');
  terminal.writeln('  \x1b[32menv\x1b[0m       - 检查环境');
  terminal.writeln('  \x1b[32mclear\x1b[0m     - 清空终端');
  terminal.writeln('  \x1b[32mhelp\x1b[0m      - 显示此帮助');
}

/**
 * 显示美化的欢迎界面
 */
async function showWelcomeScreen() {
  // 清空终端
  terminal.clear();
  
  // 获取当前时间的问候语
  const hour = new Date().getHours();
  let greeting = '早上好';
  if (hour >= 12 && hour < 18) {
    greeting = '下午好';
  } else if (hour >= 18 || hour < 6) {
    greeting = '晚上好';
  }
  
  // 显示 ASCII 艺术字 LOGO
  terminal.writeln('\x1b[36m');
  terminal.writeln('     ███╗   ███╗██╗ █████╗  ██████╗ ██████╗  █████╗ ');
  terminal.writeln('     ████╗ ████║██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗');
  terminal.writeln('     ██╔████╔██║██║███████║██║   ██║██║  ██║███████║');
  terminal.writeln('     ██║╚██╔╝██║██║██╔══██║██║   ██║██║  ██║██╔══██║');
  terminal.writeln('     ██║ ╚═╝ ██║██║██║  ██║╚██████╔╝██████╔╝██║  ██║');
  terminal.writeln('     ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝');
  terminal.writeln('\x1b[0m');
  
  // 显示副标题
  terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  terminal.writeln(`     \x1b[95m✨ ${greeting}！欢迎使用 Miaoda Claude Code 管理器 ✨\x1b[0m`);
  terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  terminal.writeln('');
  
  // 显示系统信息
  terminal.writeln('     \x1b[33m📊 系统信息\x1b[0m');
  terminal.writeln(`     \x1b[90m├─ 版本: ${await window.electronAPI.getAppVersion() || '2.0.0'}\x1b[0m`);
  terminal.writeln(`     \x1b[90m├─ 平台: ${navigator.platform}\x1b[0m`);
  terminal.writeln(`     \x1b[90m└─ 时间: ${new Date().toLocaleString('zh-CN')}\x1b[0m`);
  terminal.writeln('');
  
  // 显示当前配置信息
  if (currentConfig) {
    terminal.writeln('     \x1b[32m🔧 当前配置\x1b[0m');
    terminal.writeln(`     \x1b[90m├─ 名称: ${currentConfig.name}\x1b[0m`);
    terminal.writeln(`     \x1b[90m├─ 模型: ${currentConfig.model || '未设置'}\x1b[0m`);
    terminal.writeln('     \x1b[90m└─ 状态: \x1b[92m已就绪\x1b[0m');
  } else {
    terminal.writeln('     \x1b[31m⚠️  尚未选择配置\x1b[0m');
  }
  terminal.writeln('');
  
  // 显示快捷提示
  terminal.writeln('     \x1b[36m🚀 快速开始\x1b[0m');
  terminal.writeln('     \x1b[90m├─ 按 \x1b[33m[1]\x1b[90m 启动 Claude Code\x1b[0m');
  terminal.writeln('     \x1b[90m├─ 按 \x1b[33m[2]\x1b[90m 管理配置\x1b[0m');
  terminal.writeln('     \x1b[90m├─ 按 \x1b[33m[3]\x1b[90m 检查环境\x1b[0m');
  terminal.writeln('     \x1b[90m└─ 按 \x1b[33m[H]\x1b[90m 查看帮助\x1b[0m');
  terminal.writeln('');
  terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  terminal.writeln('');
}

/**
 * 显示欢迎菜单
 */
function showWelcomeMenu() {
  if (isInWelcomeMenu) {
    return;
  }

  // 清空终端
  terminal.clear();
  
  // 设置欢迎菜单模式
  isInWelcomeMenu = true;
  
  // 在模拟模式下禁用会话输入
  if (session) {
    session.setInputEnabled(false);
  }

  // 创建并显示欢迎菜单
  if (window.WelcomeMenu) {
    welcomeMenu = new window.WelcomeMenu(terminal, {
      currentConfig,
      updateFooterStatus
    });

    // 设置关闭回调
    welcomeMenu.onClose = () => {
      isInWelcomeMenu = false;
      
      if (terminal.isRealTerminal) {
        // 真实终端模式：直接清屏并显示新提示符
        terminal.clear();
        // 真实终端会自动显示系统提示符
      } else if (session) {
        // 模拟模式：恢复会话
        session.setInputEnabled(true);
        session.reset();
        session.showPrompt();
      }
    };

    welcomeMenu.show();
  } else {
    console.error('WelcomeMenu 类不可用');
    isInWelcomeMenu = false;
    
    if (session) {
      session.setInputEnabled(true);
      terminal.writeln('Error: 无法加载欢迎菜单');
      session.showPrompt();
    } else {
      terminal.writeln('Error: 无法加载欢迎菜单');
    }
  }
}

/**
 * 启动 Claude
 */
async function startClaude() {
  if (!currentConfig) {
    terminal.writeln('\x1b[33m⚠️  请先选择一个配置\x1b[0m');
    terminal.writeln('   使用左侧配置列表选择，或按 \x1b[33m[2]\x1b[0m 打开配置菜单');
    return;
  }

  // 清空终端并显示启动画面
  terminal.clear();
  terminal.writeln('');
  terminal.writeln('     \x1b[36m🚀 正在启动 Claude Code\x1b[0m');
  terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  terminal.writeln('');
  terminal.writeln(`     \x1b[90m配置名称:\x1b[0m ${currentConfig.name}`);
  terminal.writeln(`     \x1b[90m模型:\x1b[0m ${currentConfig.model || '默认'}`);
  if (!currentConfig.isEmptyConfig && currentConfig.apiUrl) {
    terminal.writeln(`     \x1b[90mAPI 地址:\x1b[0m ${currentConfig.apiUrl}`);
  }
  terminal.writeln('');
  terminal.writeln('     \x1b[90m正在检查环境...\x1b[0m');
  
  try {
    const result = await window.electronAPI.startClaudeCode(currentConfig);
    if (result.success) {
      terminal.writeln('');
      terminal.writeln('     \x1b[92m✨ Claude Code 启动成功！\x1b[0m');
      terminal.writeln('');
      terminal.writeln('     \x1b[90m提示: Claude Code 已在新的终端窗口中打开\x1b[0m');
      terminal.writeln('     \x1b[90m请在新窗口中与 Claude 进行对话\x1b[0m');
      terminal.writeln('');
      terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    } else {
      terminal.writeln('');
      terminal.writeln(`     \x1b[91m❌ 启动失败: ${result.message}\x1b[0m`);
      terminal.writeln('');
      terminal.writeln('     \x1b[90m请检查:\x1b[0m');
      terminal.writeln('     \x1b[90m1. Claude Code 是否已安装\x1b[0m');
      terminal.writeln('     \x1b[90m2. 配置信息是否正确\x1b[0m');
      terminal.writeln('     \x1b[90m3. 网络连接是否正常\x1b[0m');
      terminal.writeln('');
      terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    }
  } catch (error) {
    terminal.writeln('');
    terminal.writeln(`     \x1b[91m❌ 启动异常: ${error.message}\x1b[0m`);
    terminal.writeln('');
    terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  }
}

/**
 * 切换终端全屏
 */
function toggleTerminalFullscreen() {
  const terminalContainer = document.getElementById('terminal-container');
  const fullscreenBtn = document.getElementById('fullscreen-terminal-btn');
  
  if (!terminalContainer) return;
  
  if (terminalContainer.classList.contains('fullscreen')) {
    // 退出全屏
    terminalContainer.classList.remove('fullscreen');
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.title = '全屏';
  } else {
    // 进入全屏
    terminalContainer.classList.add('fullscreen');
    fullscreenBtn.textContent = '⛷';
    fullscreenBtn.title = '退出全屏';
  }
  
  // 调整终端大小
  if (terminal && terminal.fit) {
    setTimeout(() => {
      terminal.fit();
    }, 100);
  }
}

/**
 * 检查环境
 */
async function checkEnvironment() {
  console.log('checkEnvironment 函数被调用');
  
  if (!terminal) {
    console.error('终端未初始化');
    return;
  }
  
  // 清空终端并显示检查画面
  terminal.clear();
  terminal.writeln('');
  terminal.writeln('     \x1b[36m🔍 环境检查\x1b[0m');
  terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  terminal.writeln('');
  terminal.writeln('     \x1b[90m正在检查系统环境，请稍候...\x1b[0m');
  terminal.writeln('');
  
  try {
    const result = await window.electronAPI.checkEnvironment();
    
    // 显示结果
    terminal.writeln('     \x1b[33m📋 检查结果\x1b[0m');
    terminal.writeln('');
    
    const components = [
      { key: 'nodejs', name: 'Node.js', icon: '🟢' },
      { key: 'git', name: 'Git', icon: '🔧' },
      { key: 'uv', name: 'UV', icon: '📦' },
      { key: 'claude', name: 'Claude Code', icon: '🤖' }
    ];
    
    let allInstalled = true;
    
    for (const comp of components) {
      const status = result[comp.key];
      
      // 更新UI状态显示
      const statusElement = document.querySelector(`[data-env="${comp.key}"]`);
      if (statusElement) {
        if (status?.installed) {
          statusElement.textContent = status.version || '已安装';
          statusElement.classList.add('status-success');
          statusElement.classList.remove('status-checking');
        } else {
          statusElement.textContent = '未安装';
          statusElement.classList.add('status-error');
          statusElement.classList.remove('status-checking');
          allInstalled = false;
          
          // 显示安装按钮（管理员权限除外）
          if (comp.key !== 'admin') {
            const installBtn = document.querySelector(`[data-dep="${comp.key}"]`);
            if (installBtn) {
              installBtn.style.display = 'inline-block';
            }
          }
        }
      }
      
      // 终端输出
      if (status?.installed) {
        terminal.writeln(`     ${comp.icon} ${comp.name}: \x1b[92m${status.version || '已安装'}\x1b[0m`);
      } else {
        terminal.writeln(`     ❌ ${comp.name}: \x1b[91m未安装\x1b[0m`);
      }
    }
    
    terminal.writeln('');
    terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    terminal.writeln('');
    
    if (allInstalled) {
      terminal.writeln('     \x1b[92m✅ 所有组件已就绪！\x1b[0m');
      terminal.writeln('     \x1b[90m您可以开始使用 Claude Code 了\x1b[0m');
    } else {
      terminal.writeln('     \x1b[93m⚠️  部分组件未安装\x1b[0m');
      terminal.writeln('     \x1b[90m请使用左侧面板中的安装按钮进行安装\x1b[0m');
    }
    terminal.writeln('');
  } catch (error) {
    terminal.writeln('');
    terminal.writeln(`     \x1b[91m❌ 检查失败: ${error.message}\x1b[0m`);
    terminal.writeln('');
    terminal.writeln('     \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  }
}

/**
 * 显示配置帮助
 */
function showConfigHelp() {
  terminal.writeln('\x1b[36m配置管理:\x1b[0m');
  terminal.writeln('  使用左侧面板管理配置');
  terminal.writeln('  或使用 "menu" 命令选择配置');
}

/**
 * 加载配置
 */
async function loadConfigs() {
  try {
    const result = await window.electronAPI.getConfigs();
    configs = result.configs || [];
    renderConfigList();
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

/**
 * 渲染配置列表
 */
function renderConfigList() {
  const configList = document.getElementById('config-list');
  if (!configList) return;

  configList.innerHTML = '';

  configs.forEach(config => {
    const configItem = document.createElement('div');
    configItem.className = 'config-item';
    if (currentConfig && currentConfig.id === config.id) {
      configItem.classList.add('active');
    }

    configItem.innerHTML = `
      <div class="config-name">${config.name}</div>
      <div class="config-model">${config.model}</div>
    `;

    configItem.addEventListener('click', async () => await selectConfig(config));
    configList.appendChild(configItem);
  });
}

/**
 * 选择配置
 */
async function selectConfig(config) {
  // 检查 Claude Code 是否正在运行
  const status = await window.electronAPI.getClaudeStatus();
  
  if (status.running) {
    // Claude Code 正在运行，询问是否退出并使用新配置
    const confirmed = await window.electronAPI.showConfirmDialog({
      message: 'Claude Code 正在运行中。',
      detail: `是否要退出当前 Claude Code 并使用配置"${config.name}"重新运行？`
    });
    
    if (confirmed) {
      // 停止当前的 Claude Code
      terminal.writeln('\x1b[33m正在停止当前 Claude Code...\x1b[0m');
      await window.electronAPI.stopClaudeCode();
      
      // 选择新配置并启动
      currentConfig = config;
      renderConfigList();
      updateFooterStatus();
      terminal.writeln(`\x1b[32m已选择配置: ${config.name}\x1b[0m`);
      
      // 启动新的 Claude Code
      await startClaude();
    }
  } else {
    // Claude Code 未运行，询问是否选择并启动
    const confirmed = await window.electronAPI.showConfirmDialog({
      message: `是否选择配置"${config.name}"并启动 Claude Code？`
    });
    
    if (confirmed) {
      // 选择配置
      currentConfig = config;
      renderConfigList();
      updateFooterStatus();
      terminal.writeln(`\x1b[32m已选择配置: ${config.name}\x1b[0m`);
      
      // 启动 Claude Code
      await startClaude();
    }
  }
}

/**
 * 更新底部状态栏
 */
function updateFooterStatus() {
  // 更新 API URL 显示
  const apiUrlDisplay = document.getElementById('api-url-display');
  if (apiUrlDisplay) {
    if (currentConfig && currentConfig.apiUrl) {
      try {
        const url = new URL(currentConfig.apiUrl);
        apiUrlDisplay.textContent = url.hostname;
      } catch (e) {
        apiUrlDisplay.textContent = currentConfig.apiUrl;
      }
    } else {
      apiUrlDisplay.textContent = '未配置';
    }
  }

  // 更新模型显示
  const modelDisplay = document.getElementById('model-display');
  if (modelDisplay) {
    modelDisplay.textContent = currentConfig?.model || '未选择模型';
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 初始化事件监听器记录
  window._boundEventListeners = window._boundEventListeners || [];
  
  // 辅助函数：添加事件监听器并记录
  function addListener(id, handler, eventType = 'click') {
    const element = document.getElementById(id);
    if (element) {
      console.log(`绑定事件: ${id} -> ${handler.name}`);
      element.addEventListener(eventType, handler);
      window._boundEventListeners.push({ id, handler: handler.name, eventType });
    } else {
      console.error(`找不到元素: ${id}`);
    }
  }

  // 检查环境按钮
  const checkEnvBtn = document.getElementById('check-env-btn');
  if (checkEnvBtn) {
    console.log('找到检查环境按钮，样式:', window.getComputedStyle(checkEnvBtn).pointerEvents);
    // 确保按钮可点击
    checkEnvBtn.style.pointerEvents = 'auto';
    checkEnvBtn.style.cursor = 'pointer';
  }
  
  addListener('check-env-btn', async (e) => {
    console.log('检查环境按钮被点击');
    e.preventDefault();
    try {
      await checkEnvironment();
    } catch (error) {
      console.error('检查环境时出错:', error);
      if (terminal) {
        terminal.writeln(`\x1b[31m检查环境失败: ${error.message}\x1b[0m`);
      }
    }
  });

  // 新建配置按钮
  addListener('new-config-btn', showNewConfigForm);

  // 启动按钮
  addListener('start-claude-btn', startClaude);
  
  // 导出配置按钮
  addListener('export-config-btn', exportConfigs);
  
  // 导入配置按钮
  addListener('import-config-btn', importConfigs);
  
  // 恢复官方设置按钮
  addListener('restore-default-btn', restoreOfficialSettings);

  // 停止按钮
  const stopBtn = document.getElementById('stop-claude-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      terminal.writeln('\x1b[33m正在停止 Claude Code...\x1b[0m');
      try {
        const result = await window.electronAPI.stopClaudeCode();
        if (result.success) {
          terminal.writeln('\x1b[32m✓ Claude Code 已停止\x1b[0m');
        }
      } catch (error) {
        terminal.writeln(`\x1b[31m✗ 停止失败: ${error.message}\x1b[0m`);
      }
    });
  }

  // 清空终端按钮
  const clearBtn = document.getElementById('clear-terminal-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      terminal.clear();
      if (!isInWelcomeMenu && session) {
        session.showPrompt();
      }
    });
  }

  // 复制按钮
  const copyBtn = document.getElementById('copy-terminal-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const selection = terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        terminal.writeln('\x1b[32m已复制到剪贴板\x1b[0m');
      }
    });
  }
  
  // 全屏终端按钮
  const fullscreenBtn = document.getElementById('fullscreen-terminal-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleTerminalFullscreen);
  }

  // 关于按钮
  addListener('about-btn', showAbout);

  // 设置按钮
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const dialog = document.getElementById('settings-dialog');
      if (dialog) dialog.style.display = 'flex';
    });
  }

  // 分享按钮
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: 'Miaoda - Claude Code Manager',
          text: '全球唯一支持 380+ AI 模型的管理工具',
          url: 'https://github.com/miaoda-code/miaoda'
        });
      } catch (err) {
        console.log('分享失败:', err);
      }
    });
  }

  // 对话框关闭按钮
  const dialogCloseButtons = document.querySelectorAll('.dialog-close');
  dialogCloseButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dialog = e.target.closest('.dialog-overlay');
      if (dialog) dialog.style.display = 'none';
    });
  });

  // 配置表单相关事件
  setupConfigFormEvents();
  
  // 设置对话框事件
  setupSettingsEvents();
  
  // 关于对话框事件
  setupAboutEvents();
  
  // 安装/授权按钮点击处理
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('install-btn')) {
      const dep = e.target.getAttribute('data-dep');
      
      if (dep === 'uv') {
        // 安装 UV
        terminal.writeln('\x1b[36m正在安装 UV...\x1b[0m');
        try {
          const result = await window.electronAPI.installDependency('uv');
          if (result.success) {
            terminal.writeln('\x1b[32m✓ UV 安装成功\x1b[0m');
            await checkEnvironment();
          } else {
            terminal.writeln(`\x1b[31m✗ UV 安装失败: ${result.error}\x1b[0m`);
          }
        } catch (error) {
          terminal.writeln(`\x1b[31m✗ UV 安装错误: ${error.message}\x1b[0m`);
        }
      } else if (dep === 'claude') {
        // 安装 Claude Code
        terminal.writeln('\x1b[36m正在安装 Claude Code...\x1b[0m');
        try {
          const result = await window.electronAPI.installDependency('claude');
          if (result.success) {
            terminal.writeln('\x1b[32m✓ Claude Code 安装成功\x1b[0m');
            await checkEnvironment();
          } else {
            terminal.writeln(`\x1b[31m✗ Claude Code 安装失败: ${result.error}\x1b[0m`);
          }
        } catch (error) {
          terminal.writeln(`\x1b[31m✗ Claude Code 安装错误: ${error.message}\x1b[0m`);
        }
      }
    }
  });
}

/**
 * 显示新建配置表单
 */
function showNewConfigForm() {
  const dialog = document.getElementById('config-dialog');
  if (dialog) {
    dialog.style.display = 'flex';
    
    // 清空表单
    document.getElementById('config-id').value = '';
    document.getElementById('config-name').value = '';
    document.getElementById('api-url').value = '';
    document.getElementById('api-key').value = '';
    document.getElementById('model').value = '';
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成，开始初始化...');
  
  // 验证关键函数是否存在
  const requiredFunctions = [
    'setupTerminal',
    'loadConfigs',
    'startClaude',
    'showNewConfigForm',
    'checkEnvironment',
    'showAbout'
  ];
  
  const missingFunctions = requiredFunctions.filter(fname => typeof window[fname] !== 'function' && typeof eval(fname) !== 'function');
  
  if (missingFunctions.length > 0) {
    console.warn('警告：以下函数可能未定义：', missingFunctions);
  }
  
  // 开始初始化
  init();
});

/**
 * 显示关于对话框
 */
function showAbout() {
  const dialog = document.getElementById('about-dialog');
  if (dialog) {
    dialog.style.display = 'flex';
  }
}

/**
 * 恢复官方设置
 */
async function restoreOfficialSettings() {
  const confirmed = await window.electronAPI.showConfirmDialog({
    message: '确定要恢复官方默认设置吗？',
    detail: '这将清除所有自定义配置，让 Claude Code 使用完全默认的行为。\n您之后可以通过 Claude Code 自身的方式登录或配置。'
  });
  
  if (!confirmed) return;
  
  try {
    // 获取官方默认配置
    const officialConfig = window.getOfficialDefaultConfig();
    
    // 检查是否已存在官方配置
    const result = await window.electronAPI.getConfigs();
    const existingConfigs = result.configs || [];
    const existingOfficial = existingConfigs.find(c => c.id === officialConfig.id);
    
    if (existingOfficial) {
      // 如果已存在，更新它
      await window.electronAPI.updateConfig({ ...existingOfficial, ...officialConfig });
      terminal.writeln('\x1b[32m✓ 已恢复官方默认设置\x1b[0m');
    } else {
      // 如果不存在，创建新的
      await window.electronAPI.saveConfig(officialConfig);
      terminal.writeln('\x1b[32m✓ 已恢复官方默认设置\x1b[0m');
    }
    
    // 重新加载配置列表
    await loadConfigs();
    
    // 选择官方配置
    const officialConfigItem = configs.find(c => c.id === officialConfig.id);
    if (officialConfigItem) {
      await selectConfig(officialConfigItem);
    }
    
    terminal.writeln('\x1b[36m提示：所有自定义配置已清除\x1b[0m');
    terminal.writeln('\x1b[36m注意：Claude Code 将使用完全默认的行为，您可以在 Claude Code 中直接配置\x1b[0m');
  } catch (error) {
    terminal.writeln(`\x1b[31m✗ 恢复官方设置失败: ${error.message}\x1b[0m`);
  }
}

/**
 * 导出配置
 */
async function exportConfigs() {
  try {
    const result = await window.electronAPI.getConfigs();
    const configsToExport = result.configs || [];
    
    if (configsToExport.length === 0) {
      terminal.writeln('\x1b[33m没有可导出的配置\x1b[0m');
      return;
    }
    
    // 创建导出数据
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      configs: configsToExport
    };
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miaoda-configs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    terminal.writeln(`\x1b[32m✓ 已导出 ${configsToExport.length} 个配置\x1b[0m`);
  } catch (error) {
    terminal.writeln(`\x1b[31m✗ 导出配置失败: ${error.message}\x1b[0m`);
  }
}

/**
 * 导入配置
 */
async function importConfigs() {
  try {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // 验证导入数据
        if (!importData.configs || !Array.isArray(importData.configs)) {
          throw new Error('无效的配置文件格式');
        }
        
        // 导入每个配置
        let importedCount = 0;
        for (const config of importData.configs) {
          // 检查是否已存在相同ID的配置
          const result = await window.electronAPI.getConfigs();
          const existingConfigs = result.configs || [];
          const existing = existingConfigs.find(c => c.id === config.id);
          
          if (existing) {
            const overwrite = await window.electronAPI.showConfirmDialog({
              message: `配置"${config.name}"已存在，是否覆盖？`
            });
            if (overwrite) {
              await window.electronAPI.updateConfig(config);
              importedCount++;
            }
          } else {
            await window.electronAPI.saveConfig(config);
            importedCount++;
          }
        }
        
        // 重新加载配置
        await loadConfigs();
        
        terminal.writeln(`\x1b[32m✓ 成功导入 ${importedCount} 个配置\x1b[0m`);
      } catch (error) {
        terminal.writeln(`\x1b[31m✗ 导入失败: ${error.message}\x1b[0m`);
      }
    };
    
    input.click();
  } catch (error) {
    terminal.writeln(`\x1b[31m✗ 导入配置失败: ${error.message}\x1b[0m`);
  }
}

/**
 * 设置配置表单事件
 */
function setupConfigFormEvents() {
  const form = document.getElementById('config-edit-form');
  if (!form) return;

  // 表单提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveConfig();
  });

  // 取消按钮
  const cancelBtn = document.getElementById('cancel-config-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('config-dialog').style.display = 'none';
    });
  }

  // 保存并启动按钮
  const saveAndStartBtn = document.getElementById('save-and-start-btn');
  if (saveAndStartBtn) {
    saveAndStartBtn.addEventListener('click', async () => {
      const saved = await saveConfig();
      if (saved) {
        await startClaude();
      }
    });
  }

  // 测试连接按钮
  const testBtn = document.getElementById('test-config-btn');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const apiUrl = document.getElementById('api-url').value;
      const apiKey = document.getElementById('api-key').value;
      const model = document.getElementById('model').value;
      
      if (!apiUrl || !apiKey || !model) {
        showTestResult('请填写所有必填字段', 'error');
        return;
      }

      showTestResult('正在测试连接...', 'info');
      
      try {
        const result = await window.electronAPI.testApiConnection({ apiUrl, apiKey, model });
        if (result.success) {
          showTestResult('连接成功！', 'success');
        } else {
          showTestResult(`连接失败: ${result.message}`, 'error');
        }
      } catch (error) {
        showTestResult(`测试失败: ${error.message}`, 'error');
      }
    });
  }

  // 快速填充按钮
  const quickFillBtn = document.getElementById('quick-fill-btn');
  if (quickFillBtn) {
    quickFillBtn.addEventListener('click', () => {
      document.getElementById('config-name').value = '免费测试 API';
      document.getElementById('api-url').value = 'http://www.miaoda.vip/';
      document.getElementById('api-key').value = 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44';
      document.getElementById('model').value = 'claude-3-7-sonnet-20250219';
    });
  }
}

/**
 * 保存配置
 */
async function saveConfig() {
  const config = {
    id: document.getElementById('config-id').value || 'config-' + Date.now(),
    name: document.getElementById('config-name').value,
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    model: document.getElementById('model').value
  };

  try {
    await window.electronAPI.saveConfig(config);
    await loadConfigs();
    selectConfig(config);
    document.getElementById('config-dialog').style.display = 'none';
    terminal.writeln(`\x1b[32m✓ 配置已保存: ${config.name}\x1b[0m`);
    return true;
  } catch (error) {
    terminal.writeln(`\x1b[31m✗ 保存失败: ${error.message}\x1b[0m`);
    return false;
  }
}

/**
 * 显示测试结果
 */
function showTestResult(message, type) {
  const resultDiv = document.getElementById('test-result');
  const contentDiv = resultDiv.querySelector('.test-result-content');
  
  resultDiv.style.display = 'block';
  contentDiv.textContent = message;
  contentDiv.className = `test-result-content ${type}`;
}

/**
 * 设置设置对话框事件
 */
function setupSettingsEvents() {
  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const autoLaunch = document.getElementById('auto-launch-checkbox').checked;
      const autoUpdate = document.getElementById('auto-update-checkbox').checked;
      
      try {
        await window.electronAPI.saveSettings({ autoLaunch, autoUpdate });
        terminal.writeln('\x1b[32m✓ 设置已保存\x1b[0m');
        document.getElementById('settings-dialog').style.display = 'none';
      } catch (error) {
        terminal.writeln(`\x1b[31m✗ 保存设置失败: ${error.message}\x1b[0m`);
      }
    });
  }
}

/**
 * 设置关于对话框事件
 */
function setupAboutEvents() {
  // 检查更新按钮
  const checkUpdateBtn = document.getElementById('check-update-btn');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
      const updateInfo = document.getElementById('update-info');
      const updateContent = updateInfo.querySelector('.update-content');
      
      updateInfo.style.display = 'block';
      updateContent.textContent = '正在检查更新...';
      
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (result.updateAvailable) {
          updateContent.innerHTML = `
            <p>发现新版本: ${result.version}</p>
            <p>${result.releaseNotes}</p>
            <button class="btn btn-primary" onclick="window.electronAPI.downloadUpdate()">下载更新</button>
          `;
        } else {
          updateContent.textContent = '已是最新版本';
        }
      } catch (error) {
        updateContent.textContent = `检查更新失败: ${error.message}`;
      }
    });
  }

  // GitHub 按钮
  const githubBtn = document.getElementById('github-btn');
  if (githubBtn) {
    githubBtn.addEventListener('click', () => {
      window.electronAPI.openExternal('https://github.com/miaoda-code/miaoda');
    });
  }

  // 官网按钮
  const websiteBtn = document.getElementById('website-btn');
  if (websiteBtn) {
    websiteBtn.addEventListener('click', () => {
      window.electronAPI.openExternal('https://miaoda.vip');
    });
  }
}

// 导出必要的函数和变量
window.updateFooterStatus = updateFooterStatus;
window.currentConfig = currentConfig;
window.startClaude = startClaude;
window.showAbout = showAbout;
window.showNewConfigForm = showNewConfigForm;
window.checkEnvironment = checkEnvironment;
window.setupTerminal = setupTerminal;
window.loadConfigs = loadConfigs;
window.showWelcomeMenu = showWelcomeMenu;

// 导出状态变量
Object.defineProperty(window, 'isInWelcomeMenu', {
  get: () => isInWelcomeMenu,
  set: (value) => { isInWelcomeMenu = value; }
});