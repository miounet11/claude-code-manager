// 自动批准系统
class AutoApprovalSystem {
  constructor() {
    this.pendingApprovals = new Map();
    this.approvalHistory = [];
    this.config = {
      enabled: false,
      features: {
        read: false,
        write: false,
        execute: false,
        browser: false,
        retry: false,
        mcp: false,
        mode: false,
        subtask: false,
        issues: false,
        todo: false
      },
      delays: {
        write: 1000,
        execute: 500,
        retry: 10000,
        question: 60000
      },
      whitelist: {
        commands: [
          'npm test',
          'npm install',
          'npm run',
          'yarn test',
          'yarn install',
          'yarn run',
          'pnpm test',
          'pnpm install',
          'pnpm run',
          'tsc',
          'eslint',
          'prettier',
          'git log',
          'git diff',
          'git status',
          'git show',
          'git branch',
          'ls',
          'dir',
          'pwd',
          'cd',
          'echo',
          'cat',
          'type',
          'chmod +x',
          'node --version',
          'python --version',
          'java --version'
        ],
        paths: [
          'src',
          'test',
          'tests',
          'spec',
          'docs',
          'public',
          'dist',
          'build'
        ]
      },
      blacklist: {
        commands: [
          'rm -rf /',
          'rm -rf ~',
          'format c:',
          'del /f /s /q',
          'shutdown',
          'reboot',
          'poweroff',
          'kill -9',
          'taskkill /f',
          'sudo rm -rf',
          ':(){:|:&};:',  // Fork bomb
          'dd if=/dev/zero',
          'mkfs',
          'fdisk'
        ],
        paths: [
          // 系统关键目录 - 根据平台动态设置
          ...(window.electronAPI?.platform === 'win32' ? [
            'C:\\Windows\\',
            'C:\\Program Files\\',
            'C:\\Program Files (x86)\\',
            'C:\\ProgramData\\',
            'C:\\System32\\'
          ] : [
            '/etc/',
            '/usr/',
            '/bin/',
            '/sbin/',
            '/boot/',
            '/dev/',
            '/proc/',
            '/sys/',
            '/System/',  // macOS
            '/Library/', // macOS
            '/private/'  // macOS
          ]),
          // 通用敏感路径
          '~/.ssh/',
          '~/.gnupg/',
          '.git/config',
          '.env',
          'secrets',
          'credentials'
        ]
      }
    };
        
    this.loadConfig();
    this.setupUI();
  }

  // 加载配置
  async loadConfig() {
    try {
      const saved = await window.electronAPI.getConfig('autoApproval');
      if (saved) {
        this.config = this.mergeConfig(this.config, saved);
      }
    } catch (error) {
      console.error('加载自动批准配置失败:', error);
    }
  }

  // 合并配置
  mergeConfig(defaultConfig, savedConfig) {
    const merged = JSON.parse(JSON.stringify(defaultConfig));
        
    if (savedConfig.enabled !== undefined) merged.enabled = savedConfig.enabled;
    if (savedConfig.features) Object.assign(merged.features, savedConfig.features);
    if (savedConfig.delays) Object.assign(merged.delays, savedConfig.delays);
    if (savedConfig.whitelist) {
      if (savedConfig.whitelist.commands) merged.whitelist.commands = savedConfig.whitelist.commands;
      if (savedConfig.whitelist.paths) merged.whitelist.paths = savedConfig.whitelist.paths;
    }
    if (savedConfig.blacklist) {
      if (savedConfig.blacklist.commands) merged.blacklist.commands = savedConfig.blacklist.commands;
      if (savedConfig.blacklist.paths) merged.blacklist.paths = savedConfig.blacklist.paths;
    }
        
    return merged;
  }

  // 保存配置
  async saveConfig() {
    try {
      await window.electronAPI.setConfig('autoApproval', this.config);
    } catch (error) {
      console.error('保存自动批准配置失败:', error);
    }
  }

  // 检查是否应该自动批准
  shouldAutoApprove(type, request) {
    if (!this.config.enabled) return false;
    if (!this.config.features[type]) return false;

    switch (type) {
    case 'read':
      return this.checkReadApproval(request);
    case 'write':
      return this.checkWriteApproval(request);
    case 'execute':
      return this.checkExecuteApproval(request);
    default:
      return this.config.features[type] || false;
    }
  }

  // 检查读取批准
  checkReadApproval(request) {
    const path = request.path || request.file;
    if (!path) return false;

    // 检查黑名单路径
    for (const blackPath of this.config.blacklist.paths) {
      if (path.includes(blackPath)) {
        return false;
      }
    }

    // 检查白名单路径
    for (const whitePath of this.config.whitelist.paths) {
      // 跨平台路径检查
      const normalizedPath = path.replace(/\\/g, '/');
      const normalizedWhitePath = whitePath.replace(/\\/g, '/');
      if (normalizedPath.includes('/' + normalizedWhitePath + '/') || 
                normalizedPath.includes('/' + normalizedWhitePath) ||
                normalizedPath.startsWith(normalizedWhitePath + '/') ||
                normalizedPath === normalizedWhitePath) {
        return true;
      }
    }

    // 默认批准当前工作区内的文件
    // 使用更通用的绝对路径检查
    const isWin = window.electronAPI?.platform === 'win32';
    if (isWin) {
      // Windows 绝对路径通常以盘符开头 (C:\ D:\ 等)
      // eslint-disable-next-line no-useless-escape
      return !/^[A-Za-z]:[\\\/]/.test(path);
    } else {
      // Unix 系统绝对路径以 / 开头
      return !path.startsWith('/');
    }
  }

  // 检查写入批准
  checkWriteApproval(request) {
    const path = request.path || request.file;
    if (!path) return false;

    // 检查受保护文件
    const protectedFiles = ['.rooignore', '.gitignore', '.env', 'package-lock.json'];
    for (const protectedFile of protectedFiles) {
      if (path.endsWith(protectedFile)) {
        return false;
      }
    }

    return this.checkReadApproval(request);
  }

  // 检查执行批准
  checkExecuteApproval(request) {
    const command = request.command || request.cmd;
    if (!command) return false;

    // 检查黑名单命令
    for (const blackCmd of this.config.blacklist.commands) {
      if (command.includes(blackCmd)) {
        return false;
      }
    }

    // 检查白名单命令
    if (this.config.whitelist.commands.includes('*')) {
      return true;
    }

    for (const whiteCmd of this.config.whitelist.commands) {
      if (command.startsWith(whiteCmd)) {
        return true;
      }
    }

    return false;
  }

  // 处理批准请求
  async handleApprovalRequest(type, request, callback) {
    const requestId = Date.now() + Math.random();
        
    // 记录请求
    this.pendingApprovals.set(requestId, {
      type,
      request,
      callback,
      timestamp: Date.now()
    });

    // 检查是否自动批准
    if (this.shouldAutoApprove(type, request)) {
      const delay = this.config.delays[type] || 0;
            
      if (delay > 0) {
        // 显示倒计时
        this.showCountdown(type, request, delay, requestId);
                
        setTimeout(() => {
          if (this.pendingApprovals.has(requestId)) {
            this.approve(requestId);
          }
        }, delay);
      } else {
        // 立即批准
        this.approve(requestId);
      }
    } else {
      // 显示手动批准界面
      this.showApprovalDialog(type, request, requestId);
    }
  }

  // 批准请求
  approve(requestId) {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;

    this.pendingApprovals.delete(requestId);
        
    // 记录历史
    this.approvalHistory.push({
      ...pending,
      approved: true,
      approvedAt: Date.now()
    });

    // 执行回调
    if (pending.callback) {
      pending.callback(true);
    }

    // 更新UI
    this.hideApprovalDialog(requestId);
  }

  // 拒绝请求
  reject(requestId) {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;

    this.pendingApprovals.delete(requestId);
        
    // 记录历史
    this.approvalHistory.push({
      ...pending,
      approved: false,
      rejectedAt: Date.now()
    });

    // 执行回调
    if (pending.callback) {
      pending.callback(false);
    }

    // 更新UI
    this.hideApprovalDialog(requestId);
  }

  // 设置UI
  setupUI() {
    // 创建批准对话框容器
    this.dialogContainer = document.createElement('div');
    this.dialogContainer.id = 'auto-approval-dialogs';
    this.dialogContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            z-index: 10000;
            pointer-events: none;
        `;
    document.body.appendChild(this.dialogContainer);

    // 创建设置面板
    this.createSettingsPanel();
  }

  // 显示倒计时
  showCountdown(type, request, delay, requestId) {
    const dialog = document.createElement('div');
    dialog.className = 'approval-countdown';
    dialog.dataset.requestId = requestId;
    dialog.style.cssText = `
            background: var(--putty-bg);
            border: 2px solid #ffcc00;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            pointer-events: all;
            animation: slideIn 0.3s ease;
        `;

    const remaining = Math.ceil(delay / 1000);
        
    dialog.innerHTML = `
            <div style="color: #ffcc00; font-weight: bold; margin-bottom: 10px;">
                ⏱️ 自动批准倒计时: <span class="countdown">${remaining}</span>秒
            </div>
            <div style="color: #999; font-size: 12px; margin-bottom: 10px;">
                ${this.getRequestDescription(type, request)}
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.autoApproval.approve('${requestId}')" 
                        style="flex: 1; padding: 5px; background: #00ff00; color: #000; border: none; border-radius: 4px; cursor: pointer;">
                    立即批准
                </button>
                <button onclick="window.autoApproval.reject('${requestId}')" 
                        style="flex: 1; padding: 5px; background: #ff3030; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    拒绝
                </button>
            </div>
        `;

    this.dialogContainer.appendChild(dialog);

    // 倒计时更新
    const countdownEl = dialog.querySelector('.countdown');
    let seconds = remaining;
        
    const interval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        countdownEl.textContent = seconds;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    dialog.dataset.interval = interval;
  }

  // 显示批准对话框
  showApprovalDialog(type, request, requestId) {
    const dialog = document.createElement('div');
    dialog.className = 'approval-dialog';
    dialog.dataset.requestId = requestId;
    dialog.style.cssText = `
            background: var(--putty-bg);
            border: 2px solid var(--putty-green);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            pointer-events: all;
            animation: slideIn 0.3s ease;
        `;

    dialog.innerHTML = `
            <div style="color: var(--putty-green); font-weight: bold; margin-bottom: 10px;">
                🔒 需要批准: ${this.getTypeLabel(type)}
            </div>
            <div style="color: #ccc; font-size: 14px; margin-bottom: 15px; max-height: 100px; overflow-y: auto;">
                ${this.getRequestDescription(type, request)}
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.autoApproval.approve('${requestId}')" 
                        style="flex: 1; padding: 8px; background: var(--putty-green); color: var(--putty-bg); border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✓ 批准
                </button>
                <button onclick="window.autoApproval.reject('${requestId}')" 
                        style="flex: 1; padding: 8px; background: #ff3030; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    ✗ 拒绝
                </button>
            </div>
        `;

    this.dialogContainer.appendChild(dialog);
  }

  // 隐藏批准对话框
  hideApprovalDialog(requestId) {
    const dialog = this.dialogContainer.querySelector(`[data-request-id="${requestId}"]`);
    if (dialog) {
      // 清除倒计时
      if (dialog.dataset.interval) {
        clearInterval(parseInt(dialog.dataset.interval));
      }
            
      dialog.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => dialog.remove(), 300);
    }
  }

  // 获取类型标签
  getTypeLabel(type) {
    const labels = {
      read: '读取文件',
      write: '写入文件',
      execute: '执行命令',
      browser: '浏览器操作',
      retry: '重试请求',
      mcp: 'MCP 操作',
      mode: '模式切换',
      subtask: '子任务',
      issues: '问题处理',
      todo: '待办事项'
    };
    return labels[type] || type;
  }

  // 获取请求描述
  getRequestDescription(type, request) {
    switch (type) {
    case 'read':
      return `读取文件: ${request.path || request.file}`;
    case 'write':
      return `写入文件: ${request.path || request.file}`;
    case 'execute':
      return `执行命令: <code style="background: #000; padding: 2px 5px; border-radius: 3px;">${request.command || request.cmd}</code>`;
    default:
      return JSON.stringify(request, null, 2);
    }
  }

  // 创建设置面板
  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'auto-approval-settings';
    panel.className = 'auto-approval-settings';
    panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            background: var(--putty-bg);
            border: 2px solid var(--putty-green);
            border-radius: 8px;
            padding: 20px;
            overflow-y: auto;
            display: none;
            z-index: 10001;
            font-family: 'Courier New', monospace;
        `;

    panel.innerHTML = `
            <h2 style="color: var(--putty-green); margin-bottom: 20px;">自动批准设置</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; color: #ccc; cursor: pointer;">
                    <input type="checkbox" id="auto-approval-enabled" style="margin-right: 10px;">
                    <span>启用自动批准</span>
                </label>
                <div style="color: #ff9500; font-size: 12px; margin-top: 5px;">
                    ⚠️ 只有在您完全信任 AI 并了解安全风险的情况下才启用
                </div>
            </div>

            <div id="approval-features" style="margin-bottom: 20px;">
                <h3 style="color: var(--putty-green); font-size: 16px; margin-bottom: 10px;">功能权限</h3>
                ${this.renderFeatureToggles()}
            </div>

            <div id="approval-delays" style="margin-bottom: 20px;">
                <h3 style="color: var(--putty-green); font-size: 16px; margin-bottom: 10px;">批准延迟</h3>
                ${this.renderDelaySettings()}
            </div>

            <div id="approval-whitelist" style="margin-bottom: 20px;">
                <h3 style="color: var(--putty-green); font-size: 16px; margin-bottom: 10px;">命令白名单</h3>
                ${this.renderWhitelist()}
            </div>

            <div id="approval-blacklist" style="margin-bottom: 20px;">
                <h3 style="color: var(--putty-green); font-size: 16px; margin-bottom: 10px;">命令黑名单</h3>
                ${this.renderBlacklist()}
            </div>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="window.autoApproval.saveSettings()" 
                        style="flex: 1; padding: 10px; background: var(--putty-green); color: var(--putty-bg); border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    保存设置
                </button>
                <button onclick="window.autoApproval.closeSettings()" 
                        style="flex: 1; padding: 10px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    关闭
                </button>
            </div>
        `;

    document.body.appendChild(panel);
        
    // 绑定事件
    this.bindSettingsEvents();
  }

  // 渲染功能开关
  renderFeatureToggles() {
    const features = [
      { key: 'read', label: '读取', desc: '允许读取文件' },
      { key: 'write', label: '写入', desc: '允许创建和编辑文件' },
      { key: 'execute', label: '执行', desc: '允许执行命令' },
      { key: 'browser', label: '浏览器', desc: '允许浏览器操作' },
      { key: 'retry', label: '重试', desc: '允许重试失败的请求' },
      { key: 'mcp', label: 'MCP', desc: '允许 MCP 操作' },
      { key: 'mode', label: '模式', desc: '允许切换模式' },
      { key: 'subtask', label: '子任务', desc: '允许创建子任务' },
      { key: 'issues', label: '问题', desc: '允许处理问题' },
      { key: 'todo', label: '待办', desc: '允许管理待办事项' }
    ];

    return features.map(f => `
            <label style="display: flex; align-items: center; margin-bottom: 8px; color: #ccc; cursor: pointer;">
                <input type="checkbox" class="feature-toggle" data-feature="${f.key}" 
                       ${this.config.features[f.key] ? 'checked' : ''} 
                       style="margin-right: 10px;">
                <span style="min-width: 80px;">${f.label}</span>
                <span style="color: #666; font-size: 12px;">- ${f.desc}</span>
            </label>
        `).join('');
  }

  // 渲染延迟设置
  renderDelaySettings() {
    const delays = [
      { key: 'write', label: '写入延迟', unit: 'ms' },
      { key: 'execute', label: '执行延迟', unit: 'ms' },
      { key: 'retry', label: '重试延迟', unit: 'ms' },
      { key: 'question', label: '问题延迟', unit: 'ms' }
    ];

    return delays.map(d => `
            <div style="margin-bottom: 10px;">
                <label style="color: #ccc; display: block; margin-bottom: 5px;">
                    ${d.label} (${d.unit})
                </label>
                <input type="number" class="delay-input" data-delay="${d.key}" 
                       value="${this.config.delays[d.key]}" 
                       style="width: 100px; padding: 5px; background: #000; border: 1px solid var(--putty-green); color: var(--putty-green);">
            </div>
        `).join('');
  }

  // 渲染白名单
  renderWhitelist() {
    return `
            <div style="margin-bottom: 10px;">
                <input type="text" id="whitelist-input" placeholder="输入命令前缀（例如 'git '）" 
                       style="width: 300px; padding: 5px; background: #000; border: 1px solid var(--putty-green); color: var(--putty-green);">
                <button onclick="window.autoApproval.addWhitelist()" 
                        style="padding: 5px 15px; background: var(--putty-green); color: var(--putty-bg); border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                    添加
                </button>
            </div>
            <div id="whitelist-items" style="max-height: 150px; overflow-y: auto;">
                ${this.config.whitelist.commands.map((cmd, i) => `
                    <div style="padding: 5px; background: rgba(0, 255, 0, 0.1); margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <code style="color: var(--putty-green);">${cmd}</code>
                        <button onclick="window.autoApproval.removeWhitelist(${i})" 
                                style="background: #ff3030; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                            删除
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
  }

  // 渲染黑名单
  renderBlacklist() {
    return `
            <div style="margin-bottom: 10px;">
                <input type="text" id="blacklist-input" placeholder="输入危险命令前缀（例如 'rm -rf'）" 
                       style="width: 300px; padding: 5px; background: #000; border: 1px solid var(--putty-green); color: var(--putty-green);">
                <button onclick="window.autoApproval.addBlacklist()" 
                        style="padding: 5px 15px; background: #ff3030; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                    添加
                </button>
            </div>
            <div id="blacklist-items" style="max-height: 150px; overflow-y: auto;">
                ${this.config.blacklist.commands.map((cmd, i) => `
                    <div style="padding: 5px; background: rgba(255, 48, 48, 0.1); margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <code style="color: #ff6b6b;">${cmd}</code>
                        <button onclick="window.autoApproval.removeBlacklist(${i})" 
                                style="background: #666; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                            删除
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
  }

  // 绑定设置事件
  bindSettingsEvents() {
    const panel = document.getElementById('auto-approval-settings');
        
    // 主开关
    const enabledCheckbox = panel.querySelector('#auto-approval-enabled');
    enabledCheckbox.checked = this.config.enabled;
    enabledCheckbox.addEventListener('change', (e) => {
      this.config.enabled = e.target.checked;
    });

    // 功能开关
    panel.querySelectorAll('.feature-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        this.config.features[e.target.dataset.feature] = e.target.checked;
      });
    });

    // 延迟输入
    panel.querySelectorAll('.delay-input').forEach(input => {
      input.addEventListener('input', (e) => {
        this.config.delays[e.target.dataset.delay] = parseInt(e.target.value) || 0;
      });
    });
  }

  // 添加白名单
  addWhitelist() {
    const input = document.getElementById('whitelist-input');
    const value = input.value.trim();
    if (value && !this.config.whitelist.commands.includes(value)) {
      this.config.whitelist.commands.push(value);
      this.updateWhitelistDisplay();
      input.value = '';
    }
  }

  // 删除白名单
  removeWhitelist(index) {
    this.config.whitelist.commands.splice(index, 1);
    this.updateWhitelistDisplay();
  }

  // 更新白名单显示
  updateWhitelistDisplay() {
    const container = document.getElementById('whitelist-items');
    container.innerHTML = this.config.whitelist.commands.map((cmd, i) => `
            <div style="padding: 5px; background: rgba(0, 255, 0, 0.1); margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <code style="color: var(--putty-green);">${cmd}</code>
                <button onclick="window.autoApproval.removeWhitelist(${i})" 
                        style="background: #ff3030; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                    删除
                </button>
            </div>
        `).join('');
  }

  // 添加黑名单
  addBlacklist() {
    const input = document.getElementById('blacklist-input');
    const value = input.value.trim();
    if (value && !this.config.blacklist.commands.includes(value)) {
      this.config.blacklist.commands.push(value);
      this.updateBlacklistDisplay();
      input.value = '';
    }
  }

  // 删除黑名单
  removeBlacklist(index) {
    this.config.blacklist.commands.splice(index, 1);
    this.updateBlacklistDisplay();
  }

  // 更新黑名单显示
  updateBlacklistDisplay() {
    const container = document.getElementById('blacklist-items');
    container.innerHTML = this.config.blacklist.commands.map((cmd, i) => `
            <div style="padding: 5px; background: rgba(255, 48, 48, 0.1); margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <code style="color: #ff6b6b;">${cmd}</code>
                <button onclick="window.autoApproval.removeBlacklist(${i})" 
                        style="background: #666; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                    删除
                </button>
            </div>
        `).join('');
  }

  // 保存设置
  async saveSettings() {
    await this.saveConfig();
    this.closeSettings();
        
    if (window.terminal) {
      window.terminal.writeln('\n✓ 自动批准设置已保存');
    }
  }

  // 关闭设置
  closeSettings() {
    const panel = document.getElementById('auto-approval-settings');
    panel.style.display = 'none';
  }

  // 打开设置
  openSettings() {
    const panel = document.getElementById('auto-approval-settings');
    panel.style.display = 'block';
  }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(20px);
        }
    }
`;
document.head.appendChild(style);

// 创建全局实例
window.autoApproval = new AutoApprovalSystem();