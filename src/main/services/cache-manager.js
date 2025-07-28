'use strict';

const { app, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;

/**
 * 缓存管理器
 * 提供统一的缓存清理和防缓存策略
 */
class CacheManager {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.versionFile = path.join(app.getPath('userData'), 'app-version.json');
    this.currentVersion = app.getVersion();
  }

  /**
   * 初始化缓存管理
   */
  async initialize() {
    try {
      // 检查版本变化
      const versionChanged = await this.checkVersionChange();
      
      if (versionChanged || this.isDevelopment) {
        console.log('[CacheManager] 版本已更新或处于开发模式，清理所有缓存');
        await this.clearAllCaches();
      }
      
      // 保存当前版本
      await this.saveCurrentVersion();
      
      // 设置缓存策略
      this.setupCachePolicy();
      
    } catch (error) {
      console.error('[CacheManager] 初始化失败:', error);
    }
  }

  /**
   * 检查版本是否发生变化
   */
  async checkVersionChange() {
    try {
      const data = await fs.readFile(this.versionFile, 'utf8');
      const { version } = JSON.parse(data);
      return version !== this.currentVersion;
    } catch (error) {
      // 文件不存在，说明是首次运行
      return true;
    }
  }

  /**
   * 保存当前版本号
   */
  async saveCurrentVersion() {
    try {
      const data = {
        version: this.currentVersion,
        timestamp: Date.now()
      };
      await fs.writeFile(this.versionFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[CacheManager] 保存版本失败:', error);
    }
  }

  /**
   * 清理所有缓存
   */
  async clearAllCaches() {
    try {
      // 清理默认会话缓存
      await session.defaultSession.clearCache();
      console.log('[CacheManager] 默认会话缓存已清理');
      
      // 清理存储数据
      await session.defaultSession.clearStorageData({
        storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
      });
      console.log('[CacheManager] 存储数据已清理');
      
      // 清理 HTTP 缓存
      await session.defaultSession.clearHostResolverCache();
      console.log('[CacheManager] HTTP 缓存已清理');
      
      // 清理认证缓存
      await session.defaultSession.clearAuthCache();
      console.log('[CacheManager] 认证缓存已清理');
      
    } catch (error) {
      console.error('[CacheManager] 清理缓存失败:', error);
    }
  }

  /**
   * 设置缓存策略
   */
  setupCachePolicy() {
    const ses = session.defaultSession;
    
    // 拦截所有请求，添加防缓存头
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const { requestHeaders } = details;
      
      // 为本地文件请求添加防缓存头
      if (details.url.startsWith('file://')) {
        requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        requestHeaders['Pragma'] = 'no-cache';
        requestHeaders['Expires'] = '0';
      }
      
      callback({ requestHeaders });
    });
    
    // 在开发模式下，拦截响应并添加防缓存头
    if (this.isDevelopment) {
      ses.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        
        // 为所有响应添加防缓存头
        responseHeaders['cache-control'] = ['no-cache, no-store, must-revalidate'];
        responseHeaders['pragma'] = ['no-cache'];
        responseHeaders['expires'] = ['0'];
        
        callback({ responseHeaders });
      });
    }
    
    console.log('[CacheManager] 缓存策略已设置');
  }

  /**
   * 为 URL 添加版本查询参数
   */
  addVersionToUrl(url) {
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${timestamp}`;
  }

  /**
   * 清理特定窗口的缓存
   */
  async clearWindowCache(webContents) {
    try {
      await webContents.session.clearCache();
      console.log('[CacheManager] 窗口缓存已清理');
      
      // 重新加载忽略缓存
      webContents.reloadIgnoringCache();
    } catch (error) {
      console.error('[CacheManager] 清理窗口缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    try {
      const cacheSize = await session.defaultSession.getCacheSize();
      return {
        size: cacheSize,
        sizeInMB: (cacheSize / 1024 / 1024).toFixed(2),
        isDevelopment: this.isDevelopment,
        version: this.currentVersion
      };
    } catch (error) {
      console.error('[CacheManager] 获取缓存统计失败:', error);
      return null;
    }
  }
}

module.exports = new CacheManager();