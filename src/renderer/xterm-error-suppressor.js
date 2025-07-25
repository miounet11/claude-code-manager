'use strict';

/**
 * xterm.js 错误抑制器
 * 抑制 xterm.js 的已知非致命错误，避免控制台噪音
 */

(function() {
  // 记录错误计数（用于调试）
  let suppressedErrors = 0;
  let lastErrorTime = 0;
  
  // 原始的 console.error
  const originalConsoleError = console.error;
  
  // 重写 console.error 来过滤 xterm.js 错误
  console.error = function(...args) {
    // 检查是否包含 xterm.js 的特定错误模式
    const errorString = args.join(' ');
    
    if (errorString.includes('xterm.js') && 
        errorString.includes("Cannot read properties of null (reading 'call')")) {
      suppressedErrors++;
      
      // 每隔 10 秒记录一次被抑制的错误数量（用于调试）
      const now = Date.now();
      if (now - lastErrorTime > 10000 && suppressedErrors > 0) {
        originalConsoleError.call(console, 
          `[xterm-error-suppressor] 已抑制 ${suppressedErrors} 个 xterm.js 错误`);
        suppressedErrors = 0;
        lastErrorTime = now;
      }
      
      return; // 不输出错误
    }
    
    // 其他错误正常输出
    originalConsoleError.apply(console, args);
  };
  
  // 添加全局错误处理器作为第二道防线
  const errorHandler = function(event) {
    if (event.filename && event.filename.includes('xterm') && 
        event.message && event.message.includes("Cannot read properties of null")) {
      event.preventDefault();
      event.stopPropagation();
      suppressedErrors++;
      return false;
    }
  };
  
  // 使用捕获阶段确保更早处理错误
  window.addEventListener('error', errorHandler, true);
  
  // 处理未捕获的 Promise 拒绝
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.stack && 
        event.reason.stack.includes('xterm') &&
        event.reason.message && event.reason.message.includes("Cannot read properties of null")) {
      event.preventDefault();
      suppressedErrors++;
    }
  });
  
  console.log('[xterm-error-suppressor] 已启用 xterm.js 错误抑制');
})();