#!/usr/bin/env node
'use strict';

/**
 * 测试新的环境检测和安装系统
 */

const path = require('path');

console.log('测试新的环境检测和安装系统 v2\n');

// 加载环境管理器
const environmentManager = require('./src/main/environment-manager');

async function testEnvironmentDetection() {
  console.log('=== 1. 测试环境检测 ===\n');
  
  try {
    const result = await environmentManager.checkAll();
    console.log('环境检测结果:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n环境总结:');
    const summary = environmentManager.getSummary();
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error('环境检测失败:', error);
  }
}

async function testDebugInfo() {
  console.log('\n=== 2. 测试调试信息 ===\n');
  
  try {
    const debugInfo = await environmentManager.debug();
    console.log('调试信息:');
    console.log(JSON.stringify(debugInfo, null, 2));
  } catch (error) {
    console.error('获取调试信息失败:', error);
  }
}

async function testInstallation() {
  console.log('\n=== 3. 测试依赖安装（仅显示将要执行的操作）===\n');
  
  const missingDeps = [];
  const lastCheck = environmentManager.lastCheckResult;
  
  if (lastCheck) {
    for (const [key, value] of Object.entries(lastCheck)) {
      if (!value.installed) {
        missingDeps.push(key);
      }
    }
  }
  
  if (missingDeps.length === 0) {
    console.log('所有依赖都已安装！');
  } else {
    console.log(`发现 ${missingDeps.length} 个缺失的依赖:`, missingDeps.join(', '));
    console.log('\n如果执行安装，将会尝试:');
    
    for (const dep of missingDeps) {
      if (dep === 'nodejs' || dep === 'git') {
        console.log(`- ${dep}: 需要手动安装（会显示安装说明）`);
      } else {
        console.log(`- ${dep}: 尝试自动安装`);
      }
    }
  }
}

// 主函数
async function main() {
  console.log('当前 PATH:', process.env.PATH);
  console.log('平台:', process.platform);
  console.log('架构:', process.arch);
  console.log('Node 版本:', process.version);
  console.log('\n');
  
  await testEnvironmentDetection();
  await testDebugInfo();
  await testInstallation();
  
  console.log('\n测试完成！');
}

// 运行测试
main().catch(console.error);