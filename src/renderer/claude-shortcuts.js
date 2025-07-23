// Claude Code 快捷命令系统
class ClaudeShortcuts {
    constructor() {
        // 常用 Claude Code 命令
        this.shortcuts = [
            {
                command: '/help',
                description: '显示 Claude Code 帮助信息',
                action: 'help',
                icon: '❓'
            },
            {
                command: '/new',
                description: '开始新对话',
                action: 'new',
                icon: '🆕'
            },
            {
                command: '/clear',
                description: '清空当前对话',
                action: 'clear',
                icon: '🧹'
            },
            {
                command: '/save',
                description: '保存当前对话',
                action: 'save',
                icon: '💾'
            },
            {
                command: '/export',
                description: '导出对话历史',
                action: 'export',
                icon: '📤'
            },
            {
                command: '/model',
                description: '切换 AI 模型',
                action: 'model',
                icon: '🤖'
            },
            {
                command: '/context',
                description: '设置上下文窗口大小',
                action: 'context',
                icon: '📏'
            },
            {
                command: '/temperature',
                description: '调整创造性参数',
                action: 'temperature',
                icon: '🌡️'
            },
            {
                command: '/code',
                description: '进入代码模式',
                action: 'code',
                icon: '💻'
            },
            {
                command: '/debug',
                description: '启用调试模式',
                action: 'debug',
                icon: '🐛'
            },
            {
                command: '/history',
                description: '查看命令历史',
                action: 'history',
                icon: '📜'
            },
            {
                command: '/settings',
                description: '打开设置',
                action: 'settings',
                icon: '⚙️'
            }
        ];

        // 代码相关快捷命令
        this.codeShortcuts = [
            {
                command: '/analyze',
                description: '分析当前代码',
                template: 'Please analyze the following code and provide insights:',
                icon: '🔍'
            },
            {
                command: '/refactor',
                description: '重构代码',
                template: 'Please refactor the following code for better readability and performance:',
                icon: '♻️'
            },
            {
                command: '/test',
                description: '生成测试用例',
                template: 'Please generate test cases for the following code:',
                icon: '🧪'
            },
            {
                command: '/doc',
                description: '生成文档',
                template: 'Please generate documentation for the following code:',
                icon: '📝'
            },
            {
                command: '/fix',
                description: '修复代码问题',
                template: 'Please fix the issues in the following code:',
                icon: '🔧'
            },
            {
                command: '/explain',
                description: '解释代码',
                template: 'Please explain how the following code works:',
                icon: '💡'
            },
            {
                command: '/optimize',
                description: '优化性能',
                template: 'Please optimize the performance of the following code:',
                icon: '⚡'
            },
            {
                command: '/review',
                description: '代码审查',
                template: 'Please review the following code and suggest improvements:',
                icon: '👀'
            }
        ];

        // 自动批准配置
        this.autoApprovalConfig = {
            enabled: false,
            read: false,
            write: false,
            execute: false,
            delay: {
                write: 1000,
                retry: 10000,
                question: 60000
            },
            whitelist: [
                'npm test',
                'npm install',
                'tsc',
                'git log',
                'git diff',
                'git show',
                'cd',
                'ls',
                'pwd',
                'echo',
                'cat'
            ],
            blacklist: [
                'rm -rf',
                'format',
                'del /f',
                'shutdown',
                'reboot'
            ]
        };

        this.loadConfig();
    }

    // 加载配置
    async loadConfig() {
        try {
            const savedConfig = await window.electronAPI.getConfig('autoApprovalConfig');
            if (savedConfig) {
                this.autoApprovalConfig = { ...this.autoApprovalConfig, ...savedConfig };
            }
        } catch (error) {
            console.error('加载自动批准配置失败:', error);
        }
    }

    // 保存配置
    async saveConfig() {
        try {
            await window.electronAPI.setConfig('autoApprovalConfig', this.autoApprovalConfig);
        } catch (error) {
            console.error('保存自动批准配置失败:', error);
        }
    }

    // 获取所有快捷命令
    getAllShortcuts() {
        return [...this.shortcuts, ...this.codeShortcuts];
    }

    // 搜索快捷命令
    searchShortcuts(query) {
        const allShortcuts = this.getAllShortcuts();
        if (!query) return allShortcuts;
        
        const lowerQuery = query.toLowerCase();
        return allShortcuts.filter(s => 
            s.command.toLowerCase().includes(lowerQuery) ||
            s.description.toLowerCase().includes(lowerQuery)
        );
    }

    // 执行快捷命令
    executeShortcut(command, terminal) {
        const shortcut = this.shortcuts.find(s => s.command === command);
        if (shortcut) {
            return this.executeAction(shortcut.action, terminal);
        }

        const codeShortcut = this.codeShortcuts.find(s => s.command === command);
        if (codeShortcut) {
            return this.executeCodeShortcut(codeShortcut, terminal);
        }

        return false;
    }

    // 执行动作
    executeAction(action, terminal) {
        switch (action) {
            case 'help':
                this.showHelp(terminal);
                break;
            case 'new':
                terminal.writeln('\n开始新对话...');
                // 触发新对话事件
                window.dispatchEvent(new CustomEvent('claudeCommand', { detail: { command: 'new' } }));
                break;
            case 'clear':
                terminal.clear();
                terminal.writeln('对话已清空');
                break;
            case 'save':
                terminal.writeln('\n保存当前对话...');
                window.dispatchEvent(new CustomEvent('claudeCommand', { detail: { command: 'save' } }));
                break;
            case 'export':
                terminal.writeln('\n导出对话历史...');
                window.dispatchEvent(new CustomEvent('claudeCommand', { detail: { command: 'export' } }));
                break;
            case 'model':
                this.showModelSelector(terminal);
                break;
            case 'settings':
                terminal.writeln('\n打开设置面板...');
                window.dispatchEvent(new CustomEvent('claudeCommand', { detail: { command: 'settings' } }));
                break;
            case 'history':
                this.showHistory(terminal);
                break;
            default:
                terminal.writeln(`\n未知命令: ${action}`);
        }
        return true;
    }

    // 执行代码快捷命令
    executeCodeShortcut(shortcut, terminal) {
        terminal.writeln(`\n${shortcut.icon} ${shortcut.description}`);
        terminal.writeln(`\n${shortcut.template}\n`);
        
        // 将模板发送到 Claude
        if (terminal.onDataCallback) {
            terminal.onDataCallback(shortcut.template + '\n');
        }
        
        return true;
    }

    // 显示帮助
    showHelp(terminal) {
        terminal.writeln('\n=== Claude Code 快捷命令 ===\n');
        
        terminal.writeln('通用命令:');
        this.shortcuts.forEach(s => {
            terminal.writeln(`  ${s.icon} ${s.command.padEnd(15)} - ${s.description}`);
        });
        
        terminal.writeln('\n代码命令:');
        this.codeShortcuts.forEach(s => {
            terminal.writeln(`  ${s.icon} ${s.command.padEnd(15)} - ${s.description}`);
        });
        
        terminal.writeln('\n提示: 输入 "/" 查看所有可用命令');
        terminal.writeln('');
    }

    // 显示模型选择器
    showModelSelector(terminal) {
        terminal.writeln('\n可用模型:');
        terminal.writeln('  1. Claude 3 Opus');
        terminal.writeln('  2. Claude 3 Sonnet');
        terminal.writeln('  3. Claude 3 Haiku');
        terminal.writeln('  4. GPT-4');
        terminal.writeln('  5. GPT-3.5');
        terminal.writeln('\n输入数字选择模型');
    }

    // 显示历史
    showHistory(terminal) {
        terminal.writeln('\n=== 命令历史 ===');
        if (terminal.commandHistory && terminal.commandHistory.length > 0) {
            terminal.commandHistory.slice(-10).forEach((cmd, i) => {
                terminal.writeln(`  ${i + 1}. ${cmd}`);
            });
        } else {
            terminal.writeln('  暂无历史记录');
        }
        terminal.writeln('');
    }

    // 检查命令是否需要自动批准
    shouldAutoApprove(type, command) {
        if (!this.autoApprovalConfig.enabled) return false;

        switch (type) {
            case 'read':
                return this.autoApprovalConfig.read;
            case 'write':
                return this.autoApprovalConfig.write;
            case 'execute':
                if (!this.autoApprovalConfig.execute) return false;
                
                // 检查黑名单
                for (const blacklisted of this.autoApprovalConfig.blacklist) {
                    if (command.startsWith(blacklisted)) {
                        return false;
                    }
                }
                
                // 检查白名单
                if (this.autoApprovalConfig.whitelist.includes('*')) {
                    return true;
                }
                
                for (const whitelisted of this.autoApprovalConfig.whitelist) {
                    if (command.startsWith(whitelisted)) {
                        return true;
                    }
                }
                
                return false;
            default:
                return false;
        }
    }

    // 获取自动批准延迟
    getApprovalDelay(type) {
        return this.autoApprovalConfig.delay[type] || 0;
    }

    // 创建快捷命令面板
    createShortcutPanel() {
        const panel = document.createElement('div');
        panel.className = 'claude-shortcuts-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 300px;
            max-height: 400px;
            background: var(--putty-bg);
            border: 2px solid var(--putty-green);
            border-radius: 8px;
            padding: 15px;
            overflow-y: auto;
            display: none;
            z-index: 1000;
            font-family: 'Courier New', monospace;
        `;

        const title = document.createElement('h3');
        title.textContent = '快捷命令';
        title.style.cssText = `
            margin: 0 0 10px 0;
            color: var(--putty-green);
            font-size: 16px;
        `;
        panel.appendChild(title);

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '搜索命令...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 5px;
            margin-bottom: 10px;
            background: #000;
            border: 1px solid var(--putty-green);
            color: var(--putty-green);
            outline: none;
        `;
        panel.appendChild(searchInput);

        const shortcutList = document.createElement('div');
        shortcutList.className = 'shortcut-list';
        panel.appendChild(shortcutList);

        // 搜索功能
        searchInput.addEventListener('input', () => {
            const results = this.searchShortcuts(searchInput.value);
            this.renderShortcuts(shortcutList, results);
        });

        // 初始渲染
        this.renderShortcuts(shortcutList, this.getAllShortcuts());

        return panel;
    }

    // 渲染快捷命令列表
    renderShortcuts(container, shortcuts) {
        container.innerHTML = '';
        
        shortcuts.forEach(shortcut => {
            const item = document.createElement('div');
            item.className = 'shortcut-item';
            item.style.cssText = `
                padding: 8px;
                margin-bottom: 5px;
                background: rgba(0, 255, 0, 0.1);
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            `;
            
            item.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span style="font-size: 20px; margin-right: 10px;">${shortcut.icon}</span>
                    <div style="flex: 1;">
                        <div style="color: var(--putty-green); font-weight: bold;">${shortcut.command}</div>
                        <div style="color: #999; font-size: 12px;">${shortcut.description}</div>
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                if (window.terminal) {
                    window.terminal.input.value = shortcut.command;
                    window.terminal.input.focus();
                }
                container.parentElement.style.display = 'none';
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0, 255, 0, 0.2)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(0, 255, 0, 0.1)';
            });
            
            container.appendChild(item);
        });
    }
}

// 导出快捷命令系统
window.ClaudeShortcuts = ClaudeShortcuts;