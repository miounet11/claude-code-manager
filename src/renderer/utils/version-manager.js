'use strict';

/**
 * 版本管理器
 * 用于在渲染进程中管理脚本版本，防止缓存问题
 */
class VersionManager {
  constructor() {
    this._version = null;
    this._initialized = false;
    this.loadVersion();
  }

  /**
   * 加载版本信息
   */
  async loadVersion() {
    try {
      // 尝试从 version.json 加载
      const response = await fetch('./version.json');
      if (response.ok) {
        const versionInfo = await response.json();
        this._version = versionInfo.buildTimestamp;
        console.log('[VersionManager] 版本信息已加载:', versionInfo);
      } else {
        // 使用当前时间戳作为后备
        this._version = Date.now();
        console.log('[VersionManager] 使用时间戳作为版本号:', this._version);
      }
    } catch (error) {
      // 加载失败，使用当前时间戳
      this._version = Date.now();
      console.warn('[VersionManager] 加载版本信息失败，使用时间戳:', error);
    }
    
    this._initialized = true;
  }

  /**
   * 获取版本号
   */
  get version() {
    if (!this._initialized) {
      // 如果还未初始化，返回当前时间戳
      return Date.now();
    }
    return this._version;
  }

  /**
   * 为 URL 添加版本查询参数
   */
  addVersionToUrl(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${this.version}`;
  }

  /**
   * 动态加载脚本（带版本号）
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.addVersionToUrl(src);
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  /**
   * 动态导入模块（带版本号）
   */
  async importModule(modulePath) {
    const versionedPath = this.addVersionToUrl(modulePath);
    try {
      return await import(versionedPath);
    } catch (error) {
      console.error(`[VersionManager] 模块加载失败: ${modulePath}`, error);
      // 尝试不带版本号
      return await import(modulePath);
    }
  }

  /**
   * 批量加载脚本
   */
  async loadScripts(scripts) {
    const results = [];
    for (const src of scripts) {
      try {
        await this.loadScript(src);
        results.push({ src, success: true });
      } catch (error) {
        console.error(`[VersionManager] 脚本加载失败: ${src}`, error);
        results.push({ src, success: false, error });
      }
    }
    return results;
  }

  /**
   * 创建样式链接（带版本号）
   */
  createStyleLink(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = this.addVersionToUrl(href);
    return link;
  }

  /**
   * 检查是否需要重新加载
   */
  async checkForUpdate() {
    try {
      const response = await fetch('./version.json?_=' + Date.now());
      if (response.ok) {
        const newVersionInfo = await response.json();
        if (newVersionInfo.buildTimestamp !== this._version) {
          console.log('[VersionManager] 检测到新版本:', newVersionInfo);
          return true;
        }
      }
    } catch (error) {
      console.error('[VersionManager] 检查更新失败:', error);
    }
    return false;
  }
}

// 创建全局实例
window.versionManager = new VersionManager();

module.exports = VersionManager;