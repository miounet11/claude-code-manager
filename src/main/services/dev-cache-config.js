'use strict';

const { app } = require('electron');

/**
 * 开发环境缓存配置
 * 在开发模式下禁用所有缓存
 */
function setupDevCacheConfig() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  console.log('[DevCacheConfig] 开发模式：配置缓存策略');
  
  // 禁用 HTTP 缓存
  app.commandLine.appendSwitch('disable-http-cache');
  
  // 禁用 GPU 缓存
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  
  // 强制每次都从磁盘读取资源
  app.commandLine.appendSwitch('disable-http2');
  
  // 禁用服务工作者
  app.commandLine.appendSwitch('disable-features', 'ServiceWorker');
  
  // 设置缓存大小为 0
  app.commandLine.appendSwitch('disk-cache-size', '0');
  
  // 禁用应用缓存
  app.commandLine.appendSwitch('disable-application-cache');
  
  console.log('[DevCacheConfig] 缓存已禁用');
}

// 在应用启动前配置
if (app.isReady()) {
  console.warn('[DevCacheConfig] 应用已启动，缓存配置可能无效');
} else {
  setupDevCacheConfig();
}

module.exports = { setupDevCacheConfig };