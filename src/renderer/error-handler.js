'use strict';

// 全局错误处理器
window.addEventListener('error', function(event) {
  // 检查是否是 xterm.js 的已知错误
  if (event.filename && event.filename.includes('xterm.js') && 
      event.message && event.message.includes("Cannot read properties of null (reading 'call')")) {
    // 阻止这个特定错误的传播和日志记录
    event.preventDefault();
    return;
  }
  
  // 其他错误正常记录
  console.error('Script error:', event.message, 'at', event.filename, 'line', event.lineno);
});