#!/usr/bin/env node
'use strict';

/**
 * 打包前准备脚本
 * 确保生产环境配置正确，保活机制被激活
 */

const fs = require('fs');
const path = require('path');
const GuardianEnvironmentController = require('./guardian-control');

async function prebuild() {
  console.log('🚀 开始打包前准备...\n');
  
  try {
    const controller = new GuardianEnvironmentController();
    
    // 1. 检查当前状态
    console.log('1. 检查当前环境状态:');
    const status = await controller.checkStatus();
    
    // 2. 只显示当前模式，不自动切换
    if (status.mode === 'development') {
      console.log('\n⚠️  注意：当前处于开发模式');
      console.log('ℹ️  将构建温和版本（无强效保活机制）\n');
    } else {
      console.log('\n✅ 当前处于生产模式');
      console.log('ℹ️  将构建温和版本（无强效保活机制）\n');
    }
    
    // 3. 验证环境变量
    console.log('2. 验证环境变量:');
    if (!process.env.NODE_ENV) {
      console.log('⚠️  NODE_ENV 未设置，将设置为 production');
      process.env.NODE_ENV = 'production';
    }
    console.log(`✅ NODE_ENV: ${process.env.NODE_ENV}\n`);
    
    // 4. 检查关键文件
    console.log('3. 检查关键文件:');
    const criticalFiles = [
      'src/main/index.js',
      'src/preload/preload.js',
      'src/renderer/app-full.html',
      'package.json'
    ];
    
    for (const file of criticalFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
      } else {
        throw new Error(`❌ 关键文件缺失: ${file}`);
      }
    }
    
    console.log('\n🎉 打包前准备完成！');
    console.log('💡 提示：打包完成后，可以使用以下命令切换回开发模式：');
    console.log('   node scripts/guardian-control.js dev\n');
    
  } catch (error) {
    console.error('❌ 打包前准备失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  prebuild();
}

module.exports = prebuild;