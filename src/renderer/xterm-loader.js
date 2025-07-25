'use strict';

/**
 * xterm.js 加载器
 * 确保 xterm.js 及其插件正确加载
 */

(function() {
  // 检查是否在 Electron 渲染进程中
  const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
  
  // 等待所有依赖加载完成
  function waitForDependencies() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      function check() {
        attempts++;
        
        // 检查所有必需的全局对象
        const hasTerminal = typeof window.Terminal === 'function';
        const hasFitAddon = window.FitAddon && typeof window.FitAddon.FitAddon === 'function';
        const hasSearchAddon = window.SearchAddon && typeof window.SearchAddon.SearchAddon === 'function';
        const hasWebLinksAddon = window.WebLinksAddon && typeof window.WebLinksAddon.WebLinksAddon === 'function';
        
        if (hasTerminal && hasFitAddon && hasSearchAddon && hasWebLinksAddon) {
          console.log('xterm-loader: 所有依赖已加载完成');
          resolve(true);
        } else if (attempts >= maxAttempts) {
          console.error('xterm-loader: 依赖加载超时');
          console.log('Terminal:', hasTerminal);
          console.log('FitAddon:', hasFitAddon);
          console.log('SearchAddon:', hasSearchAddon);
          console.log('WebLinksAddon:', hasWebLinksAddon);
          resolve(false);
        } else {
          setTimeout(check, 100);
        }
      }
      
      check();
    });
  }
  
  // 初始化 xterm.js
  async function initializeXterm() {
    const success = await waitForDependencies();
    
    if (!success) {
      console.error('xterm-loader: 无法加载所有依赖');
      return;
    }
    
    // 保存 Terminal 类
    if (window.Terminal) {
      window.XTerminal = window.Terminal;
      console.log('xterm-loader: Terminal 类已保存为 window.XTerminal');
      
      // 恢复 Electron 全局变量
      if (window._restoreElectronGlobals) {
        window._restoreElectronGlobals();
        console.log('xterm-loader: Electron 全局变量已恢复');
      }
      
      // 触发自定义事件通知加载完成
      window.dispatchEvent(new CustomEvent('xterm-ready', {
        detail: { XTerminal: window.XTerminal }
      }));
    }
  }
  
  // 在 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeXterm);
  } else {
    initializeXterm();
  }
})();