#!/usr/bin/env node
'use strict';

/**
 * 版本更新脚本
 * 用于在每次构建前更新版本号，确保 JS 文件不会被缓存
 */

const fs = require('fs').promises;
const path = require('path');

const VERSION_FILE = path.join(__dirname, '../src/renderer/version.json');
const BUILD_INFO_FILE = path.join(__dirname, '../build-info.json');

async function updateVersion() {
  try {
    console.log('🔄 更新版本号...');
    
    // 生成新的版本信息
    const versionInfo = {
      buildTime: new Date().toISOString(),
      buildTimestamp: Date.now(),
      buildNumber: await getNextBuildNumber(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    // 写入版本文件（供渲染进程使用）
    await fs.writeFile(
      VERSION_FILE,
      JSON.stringify(versionInfo, null, 2)
    );
    
    console.log('✅ 版本号已更新:', versionInfo.buildNumber);
    console.log('📅 构建时间:', versionInfo.buildTime);
    
    // 同时更新 package.json 中的构建信息（可选）
    await updatePackageJsonBuildInfo(versionInfo);
    
  } catch (error) {
    console.error('❌ 更新版本号失败:', error);
    process.exit(1);
  }
}

/**
 * 获取下一个构建号
 */
async function getNextBuildNumber() {
  try {
    const data = await fs.readFile(BUILD_INFO_FILE, 'utf8');
    const buildInfo = JSON.parse(data);
    const nextNumber = (buildInfo.lastBuildNumber || 0) + 1;
    
    // 更新构建信息
    buildInfo.lastBuildNumber = nextNumber;
    buildInfo.lastBuildTime = new Date().toISOString();
    
    await fs.writeFile(
      BUILD_INFO_FILE,
      JSON.stringify(buildInfo, null, 2)
    );
    
    return nextNumber;
  } catch (error) {
    // 文件不存在，创建新的
    const buildInfo = {
      lastBuildNumber: 1,
      lastBuildTime: new Date().toISOString()
    };
    
    await fs.writeFile(
      BUILD_INFO_FILE,
      JSON.stringify(buildInfo, null, 2)
    );
    
    return 1;
  }
}

/**
 * 更新 package.json 中的构建信息
 */
async function updatePackageJsonBuildInfo(versionInfo) {
  try {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    // 添加或更新构建信息
    packageJson.buildInfo = {
      number: versionInfo.buildNumber,
      time: versionInfo.buildTime,
      timestamp: versionInfo.buildTimestamp
    };
    
    // 写回文件
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    
    console.log('📦 package.json 构建信息已更新');
  } catch (error) {
    console.warn('⚠️ 更新 package.json 失败:', error.message);
  }
}

// 执行更新
if (require.main === module) {
  updateVersion();
}

module.exports = { updateVersion };