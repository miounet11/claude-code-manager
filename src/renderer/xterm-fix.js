'use strict';

/**
 * xterm.js 修复脚本
 * 解决在 Electron 中加载 xterm.js 的兼容性问题
 */

// 在 Electron 渲染进程中，module 和 exports 可能会导致问题
// 临时保存并清除这些变量
(function() {
  const originalModule = window.module;
  const originalExports = window.exports;
  const originalRequire = window.require;
  
  // 清除这些变量，让 xterm.js 使用浏览器模式
  delete window.module;
  delete window.exports;
  delete window.require;
  
  // 创建一个全局的恢复函数
  window._restoreElectronGlobals = function() {
    if (originalModule !== undefined) window.module = originalModule;
    if (originalExports !== undefined) window.exports = originalExports;
    if (originalRequire !== undefined) window.require = originalRequire;
  };
})();