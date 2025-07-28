#!/usr/bin/env node
'use strict';

/**
 * 缓存清理脚本
 * 用于开发时手动清理应用缓存
 */

const { app, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

async function clearCache() {
  console.log('🧹 开始清理缓存...');
  
  try {
    // 获取应用缓存目录
    const appName = 'miaoda';
    let cacheDir;
    
    switch (process.platform) {
      case 'darwin':
        cacheDir = path.join(os.homedir(), 'Library', 'Caches', appName);
        break;
      case 'win32':
        cacheDir = path.join(process.env.APPDATA, appName, 'Cache');
        break;
      default:
        cacheDir = path.join(os.homedir(), '.cache', appName);
    }
    
    console.log('📁 缓存目录:', cacheDir);
    
    // 删除缓存目录
    if (await fileExists(cacheDir)) {
      await fs.rm(cacheDir, { recursive: true, force: true });
      console.log('✅ 缓存目录已删除');
    } else {
      console.log('ℹ️ 缓存目录不存在');
    }
    
    // 删除临时文件
    const tempDir = path.join(os.tmpdir(), appName);
    if (await fileExists(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('✅ 临时文件已删除');
    }
    
    // 清理构建产物中的版本文件
    const versionFile = path.join(__dirname, '../src/renderer/version.json');
    if (await fileExists(versionFile)) {
      await fs.unlink(versionFile);
      console.log('✅ 版本文件已删除');
    }
    
    console.log('🎉 缓存清理完成！');
    
  } catch (error) {
    console.error('❌ 清理缓存失败:', error);
    process.exit(1);
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 执行清理
if (require.main === module) {
  clearCache();
}

module.exports = { clearCache };