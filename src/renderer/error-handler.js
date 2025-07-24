'use strict';

// 全局错误处理器
window.onerror = function(msg, url, line) {
  console.error('Script error:', msg, 'at', url, 'line', line);
};