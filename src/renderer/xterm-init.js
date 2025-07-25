'use strict';

// 确保在 xterm.js 完全加载后再保存 Terminal 类
(function() {
  // 等待 Terminal 类可用
  function checkTerminal() {
    if (window.Terminal && typeof window.Terminal === 'function') {
      // 保存原始的 xterm.js Terminal 类
      window.XTerminal = window.Terminal;
      console.log('成功保存 xterm.js Terminal 为 window.XTerminal');
    } else {
      // 如果 Terminal 还未加载，稍后再试
      console.log('等待 xterm.js Terminal 加载...');
      setTimeout(checkTerminal, 50);
    }
  }
  
  // 开始检查
  checkTerminal();
})();