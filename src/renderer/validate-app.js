// 应用程序完整性验证脚本

window.appValidator = {
  errors: [],
  warnings: [],
  
  // 验证所有必需的依赖
  validateDependencies() {
    console.log('开始验证应用程序依赖...');
    
    // 检查全局对象
    const requiredGlobals = [
      { name: 'electronAPI', desc: 'Electron API 桥接' },
      { name: 'Terminal', desc: 'xterm.js 终端类', optional: true },
      { name: 'FitAddon', desc: 'xterm.js Fit 插件', optional: true },
      { name: 'WebLinksAddon', desc: 'xterm.js WebLinks 插件', optional: true },
      { name: 'SearchAddon', desc: 'xterm.js Search 插件', optional: true }
    ];
    
    requiredGlobals.forEach(item => {
      if (typeof window[item.name] === 'undefined') {
        if (item.optional) {
          this.warnings.push(`${item.desc} (${item.name}) 未加载`);
        } else {
          this.errors.push(`必需的 ${item.desc} (${item.name}) 未找到`);
        }
      } else {
        console.log(`✓ ${item.desc} 已加载`);
      }
    });
    
    // 检查 DOM 元素
    const requiredElements = [
      { id: 'app', desc: '主应用容器' },
      { id: 'terminal', desc: '终端容器' },
      { id: 'config-list', desc: '配置列表' },
      { id: 'config-form', desc: '配置表单' }
    ];
    
    requiredElements.forEach(item => {
      const element = document.getElementById(item.id);
      if (!element) {
        this.errors.push(`必需的 DOM 元素 ${item.desc} (#${item.id}) 未找到`);
      } else {
        console.log(`✓ DOM 元素 ${item.desc} 存在`);
      }
    });
    
    // 检查关键函数
    const requiredFunctions = [
      { name: 'setupTerminal', desc: '终端设置函数' },
      { name: 'loadConfigs', desc: '配置加载函数' },
      { name: 'startClaudeCode', desc: 'Claude Code 启动函数' }
    ];
    
    requiredFunctions.forEach(item => {
      if (typeof window[item.name] !== 'function') {
        this.warnings.push(`函数 ${item.desc} (${item.name}) 未定义`);
      } else {
        console.log(`✓ 函数 ${item.desc} 已定义`);
      }
    });
    
    return this.errors.length === 0;
  },
  
  // 验证事件监听器
  validateEventListeners() {
    console.log('验证事件监听器...');
    
    const buttons = [
      { id: 'new-config-btn', desc: '新建配置按钮' },
      { id: 'start-claude-btn', desc: '启动按钮' },
      { id: 'check-env-btn', desc: '检查环境按钮' },
      { id: 'about-btn', desc: '关于按钮' }
    ];
    
    buttons.forEach(item => {
      const btn = document.getElementById(item.id);
      if (btn) {
        // 检查是否有点击事件监听器
        const hasListener = btn.onclick !== null || 
                          btn.getAttribute('onclick') !== null ||
                          btn._listeners?.click?.length > 0;
        
        if (!hasListener) {
          this.warnings.push(`${item.desc} (#${item.id}) 可能没有事件监听器`);
        } else {
          console.log(`✓ ${item.desc} 有事件监听器`);
        }
      }
    });
  },
  
  // 验证样式加载
  validateStyles() {
    console.log('验证样式表加载...');
    
    const stylesheets = document.styleSheets;
    let hasMainStyles = false;
    let hasTerminalStyles = false;
    
    for (let sheet of stylesheets) {
      if (sheet.href) {
        if (sheet.href.includes('styles.css')) hasMainStyles = true;
        if (sheet.href.includes('terminal.css') || sheet.href.includes('xterm')) hasTerminalStyles = true;
      }
    }
    
    if (!hasMainStyles) {
      this.errors.push('主样式表未加载');
    } else {
      console.log('✓ 主样式表已加载');
    }
    
    if (!hasTerminalStyles) {
      this.warnings.push('终端样式表可能未加载');
    } else {
      console.log('✓ 终端样式表已加载');
    }
  },
  
  // 执行完整验证
  runFullValidation() {
    console.log('=== 开始完整应用程序验证 ===');
    this.errors = [];
    this.warnings = [];
    
    // 运行所有验证
    this.validateDependencies();
    this.validateEventListeners();
    this.validateStyles();
    
    // 输出结果
    console.log('\n=== 验证结果 ===');
    if (this.errors.length > 0) {
      console.error('❌ 发现错误:');
      this.errors.forEach(err => console.error('  - ' + err));
    }
    
    if (this.warnings.length > 0) {
      console.warn('⚠️ 警告:');
      this.warnings.forEach(warn => console.warn('  - ' + warn));
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ 所有验证通过！');
    }
    
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }
};

// 在 DOM 加载完成后自动运行验证
document.addEventListener('DOMContentLoaded', () => {
  // 延迟执行，确保所有脚本都已加载
  setTimeout(() => {
    window.appValidator.runFullValidation();
  }, 1000);
});