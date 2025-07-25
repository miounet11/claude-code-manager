'use strict';

/**
 * 一键修复界面
 */
class OneClickFixUI {
  constructor(terminal) {
    this.terminal = terminal;
    this.isRunning = false;
  }

  /**
   * 显示修复界面
   */
  async show() {
    if (this.isRunning) {
      this.terminal.writeln('\x1b[33m⚠ 修复程序正在运行中...\x1b[0m');
      return;
    }

    this.isRunning = true;
    
    // 清空终端
    this.terminal.clear();
    
    // 显示标题
    this.terminal.writeln('\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
    this.terminal.writeln('\x1b[36m║                    一键修复和环境检测工具                    ║\x1b[0m');
    this.terminal.writeln('\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m');
    this.terminal.writeln('');
    
    // 显示选项
    this.terminal.writeln('  \x1b[32m[1]\x1b[0m 完整环境检测和修复');
    this.terminal.writeln('      • 检测 Node.js、Git、UV、Claude Code');
    this.terminal.writeln('      • 自动安装缺失的组件');
    this.terminal.writeln('      • 修复常见问题');
    this.terminal.writeln('');
    
    this.terminal.writeln('  \x1b[32m[2]\x1b[0m 仅检测环境');
    this.terminal.writeln('      • 检测所有依赖的安装状态');
    this.terminal.writeln('      • 不进行任何安装操作');
    this.terminal.writeln('');
    
    this.terminal.writeln('  \x1b[32m[3]\x1b[0m 修复 macOS "已损坏" 问题');
    this.terminal.writeln('      • 清除隔离属性');
    this.terminal.writeln('      • 应用临时签名');
    this.terminal.writeln('');
    
    this.terminal.writeln('  \x1b[32m[4]\x1b[0m 检查并清理端口冲突');
    this.terminal.writeln('      • 检查常用端口占用情况');
    this.terminal.writeln('      • 可选择性终止占用进程');
    this.terminal.writeln('');
    
    this.terminal.writeln('  \x1b[31m[ESC]\x1b[0m 退出');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m请选择操作 (1-4):\x1b[0m');
    
    // 设置输入处理
    this.setupInputHandler();
  }

  /**
   * 设置输入处理
   */
  setupInputHandler() {
    this.inputHandler = async (data) => {
      // ESC 键
      if (data === '\x1b') {
        this.close();
        return;
      }
      
      const key = data.trim();
      
      switch (key) {
      case '1':
        await this.runFullFix();
        break;
      case '2':
        await this.runEnvironmentCheck();
        break;
      case '3':
        await this.fixMacOSDamage();
        break;
      case '4':
        await this.checkPortConflicts();
        break;
      default:
        // 忽略其他输入
        break;
      }
    };
    
    if (this.terminal.onInput) {
      this.terminal.onInput(this.inputHandler);
    }
  }

  /**
   * 运行完整修复
   */
  async runFullFix() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m🔧 开始完整环境修复...\x1b[0m');
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    
    try {
      const result = await window.electronAPI.runOneClickFix({
        installUV: true,
        checkPort: 8082,
        autoKillPort: false,
        fixMacDamage: process.platform === 'darwin'
      });
      
      // 显示每个步骤的结果
      for (const step of result.steps) {
        const icon = step.status === 'success' ? '✅' : 
                    step.status === 'warning' ? '⚠️' : 
                    step.status === 'failed' ? '❌' : '⏳';
        
        this.terminal.writeln(`  ${icon} ${step.name}: ${step.message || ''}`);
        
        // 如果有额外的说明
        if (step.instructions) {
          this.terminal.writeln('');
          for (const instruction of step.instructions) {
            this.terminal.writeln(`     \x1b[90m${instruction}\x1b[0m`);
          }
          this.terminal.writeln('');
        }
      }
      
      this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
      
      if (result.success) {
        this.terminal.writeln('\x1b[32m✅ 修复完成！\x1b[0m');
        if (result.needsRestart) {
          this.terminal.writeln('\x1b[33m⚠ 某些更改需要重启应用程序才能生效\x1b[0m');
        }
      } else {
        this.terminal.writeln('\x1b[31m❌ 修复过程中遇到问题，请查看上方的错误信息\x1b[0m');
      }
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m❌ 修复失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
    
    // 等待按键后返回菜单
    this.waitForKeyThenShowMenu();
  }

  /**
   * 仅运行环境检查
   */
  async runEnvironmentCheck() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m🔍 正在检查环境...\x1b[0m');
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    
    try {
      const result = await window.electronAPI.checkEnvironment();
      
      const components = [
        { key: 'nodejs', name: 'Node.js', required: true },
        { key: 'git', name: 'Git', required: true },
        { key: 'uv', name: 'UV (Python 包管理器)', required: false },
        { key: 'claude', name: 'Claude Code', required: true }
      ];
      
      for (const comp of components) {
        const status = result[comp.key];
        if (status?.installed) {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m ${comp.name}: ${status.version || '已安装'}`);
        } else {
          this.terminal.writeln(`  \x1b[31m✗\x1b[0m ${comp.name}: 未安装${comp.required ? ' (必需)' : ' (可选)'}`);
        }
      }
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m❌ 检查失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
    
    this.waitForKeyThenShowMenu();
  }

  /**
   * 修复 macOS 损坏问题
   */
  async fixMacOSDamage() {
    if (process.platform !== 'darwin') {
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[33m⚠ 此功能仅适用于 macOS 系统\x1b[0m');
      this.terminal.writeln('');
      this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
      this.waitForKeyThenShowMenu();
      return;
    }
    
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m🔧 修复 macOS "已损坏" 问题...\x1b[0m');
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    
    try {
      const result = await window.electronAPI.runOneClickFix({
        fixMacDamage: true,
        appPath: '/Applications/Miaoda.app'
      });
      
      const fixStep = result.steps.find(s => s.name.includes('macOS'));
      if (fixStep) {
        const icon = fixStep.status === 'success' ? '✅' : '❌';
        this.terminal.writeln(`  ${icon} ${fixStep.message}`);
        
        if (fixStep.instructions) {
          this.terminal.writeln('');
          for (const instruction of fixStep.instructions) {
            this.terminal.writeln(`     \x1b[90m${instruction}\x1b[0m`);
          }
        }
      }
      
    } catch (error) {
      this.terminal.writeln(`\x1b[31m❌ 修复失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
    
    this.waitForKeyThenShowMenu();
  }

  /**
   * 检查端口冲突
   */
  async checkPortConflicts() {
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[33m🔍 检查端口冲突...\x1b[0m');
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    
    const portsToCheck = [8080, 8081, 8082, 3000, 5000];
    
    try {
      for (const port of portsToCheck) {
        const inUse = await window.electronAPI.checkPort(port);
        
        if (inUse) {
          const processInfo = await window.electronAPI.getProcessUsingPort(port);
          if (processInfo) {
            this.terminal.writeln(`  \x1b[31m✗\x1b[0m 端口 ${port}: 被占用 (PID: ${processInfo.pid})`);
          } else {
            this.terminal.writeln(`  \x1b[31m✗\x1b[0m 端口 ${port}: 被占用`);
          }
        } else {
          this.terminal.writeln(`  \x1b[32m✓\x1b[0m 端口 ${port}: 可用`);
        }
      }
    } catch (error) {
      this.terminal.writeln(`\x1b[31m❌ 检查失败: ${error.message}\x1b[0m`);
    }
    
    this.terminal.writeln('\x1b[90m════════════════════════════════════════════════════════════════\x1b[0m');
    this.terminal.writeln('');
    this.terminal.writeln('\x1b[90m按任意键返回菜单...\x1b[0m');
    
    this.waitForKeyThenShowMenu();
  }

  /**
   * 等待按键然后显示菜单
   */
  waitForKeyThenShowMenu() {
    // 临时修改输入处理器
    const tempHandler = () => {
      // 恢复原始处理器并重新显示菜单
      if (this.terminal.onInput) {
        this.terminal.onInput(null);
      }
      this.show();
    };
    
    if (this.terminal.onInput) {
      this.terminal.onInput(tempHandler);
    }
  }

  /**
   * 关闭修复界面
   */
  close() {
    this.isRunning = false;
    
    // 清理输入处理器
    if (this.terminal.onInput && this.inputHandler) {
      this.terminal.onInput(null);
      this.inputHandler = null;
    }
    
    // 清空终端
    this.terminal.clear();
    this.terminal.writeln('\x1b[32m修复工具已退出\x1b[0m');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneClickFixUI;
} else {
  window.OneClickFixUI = OneClickFixUI;
}