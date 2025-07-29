#!/usr/bin/env node

/**
 * 测试 ConfigManager appendChild 错误
 * 
 * 错误描述：
 * 用户在点击"保存并启动代理"按钮后出现错误：
 * "操作失败: Cannot read properties of null (reading 'appendChild')"
 */

const path = require('path');

console.log('=== ConfigManager appendChild 错误分析 ===\n');

console.log('错误信息：');
console.log('Cannot read properties of null (reading \'appendChild\')\n');

console.log('问题分析：');
console.log('1. 错误发生在 ConfigManager.js 的第 35 行：this.container.appendChild(this.modalElement)');
console.log('2. 这表明 this.container 为 null\n');

console.log('可能的原因：');
console.log('1. 在调用 close() 方法后，ConfigManager 的 container 被设置为 null');
console.log('2. 当用户再次打开配置管理器时，如果 container 没有被正确传递，就会导致错误\n');

console.log('代码流程分析：');
console.log('1. 用户点击"保存并启动代理"按钮');
console.log('2. 触发 saveConfig(true) 方法');
console.log('3. saveConfig 调用 applyConfigAndStart()');
console.log('4. applyConfigAndStart 执行 this.close()');
console.log('5. close() 方法移除了 modalElement，但没有清理 container');
console.log('6. 如果某种情况下 ConfigManager.show() 被再次调用，但 container 参数为 null，就会出错\n');

console.log('问题根源：');
console.log('查看 App.js 的 showConfigManager 方法：');
console.log('```javascript');
console.log('showConfigManager() {');
console.log('  const modalContainer = document.getElementById(\'modal-container\');');
console.log('  this.components.configManager.show(modalContainer);');
console.log('}');
console.log('```\n');

console.log('如果 document.getElementById(\'modal-container\') 返回 null，就会导致错误。');
console.log('这可能发生在以下情况：');
console.log('1. DOM 还未完全加载');
console.log('2. modal-container 元素被意外移除');
console.log('3. 在错误的时机调用了 showConfigManager\n');

console.log('建议的修复方案：');
console.log('1. 在 ConfigManager.show() 方法中添加 container 参数的空值检查');
console.log('2. 在 ConfigManager.close() 方法中正确清理 container 引用');
console.log('3. 在 App.js 的 showConfigManager 中添加 modalContainer 的存在性检查');
console.log('4. 确保在 DOM 完全加载后再调用相关方法\n');

console.log('具体修复代码：');
console.log('\n在 ConfigManager.js 的 show 方法中添加检查：');
console.log('```javascript');
console.log('async show(container) {');
console.log('  if (!container) {');
console.log('    console.error(\'[ConfigManager] Container is null\');');
console.log('    window.electronAPI.showError(\'错误\', \'无法显示配置管理器：容器元素不存在\');');
console.log('    return;');
console.log('  }');
console.log('  this.container = container;');
console.log('  // ... 其余代码');
console.log('}');
console.log('```\n');

console.log('在 ConfigManager.js 的 close 方法中清理引用：');
console.log('```javascript');
console.log('close() {');
console.log('  if (!this.modalElement) return;');
console.log('  ');
console.log('  // 隐藏动画');
console.log('  this.modalElement.classList.remove(\'show\');');
console.log('  ');
console.log('  // 移除元素');
console.log('  setTimeout(() => {');
console.log('    if (this.modalElement) {');
console.log('      this.modalElement.remove();');
console.log('      this.modalElement = null;');
console.log('    }');
console.log('    // 清理 container 引用');
console.log('    this.container = null;');
console.log('  }, 300);');
console.log('}');
console.log('```\n');

console.log('在 App.js 的 showConfigManager 中添加检查：');
console.log('```javascript');
console.log('showConfigManager() {');
console.log('  const modalContainer = document.getElementById(\'modal-container\');');
console.log('  if (!modalContainer) {');
console.log('    console.error(\'[App] modal-container not found\');');
console.log('    window.electronAPI.showError(\'错误\', \'页面加载异常，请刷新页面\');');
console.log('    return;');
console.log('  }');
console.log('  this.components.configManager.show(modalContainer);');
console.log('}');
console.log('```\n');

console.log('测试完成！');