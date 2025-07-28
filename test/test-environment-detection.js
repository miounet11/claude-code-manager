#!/usr/bin/env node
'use strict';

/**
 * 测试环境检测服务
 */

const environmentService = require('../src/main/services/environment-service');

async function testEnvironmentDetection() {
  console.log('=== 测试环境检测服务 ===\n');
  
  // 1. 测试 PATH 增强
  console.log('1. 测试 PATH 增强功能:');
  console.log('原始 PATH:', process.env.PATH);
  await environmentService.enhanceEnvironmentPath();
  console.log('增强后 PATH:', process.env.PATH);
  console.log('');
  
  // 2. 测试单个命令检测
  console.log('2. 测试单个命令检测:');
  const commandsToTest = ['node', 'npm', 'git', 'claude', 'uv'];
  
  for (const cmd of commandsToTest) {
    console.log(`\n检测 ${cmd}:`);
    const result = await environmentService.checkCommand(cmd);
    console.log('结果:', JSON.stringify(result, null, 2));
  }
  
  // 3. 测试完整环境检测
  console.log('\n3. 测试完整环境检测:');
  const fullCheck = await environmentService.checkAll();
  console.log('完整结果:', JSON.stringify(fullCheck, null, 2));
  
  // 4. 测试搜索路径生成
  console.log('\n4. 测试搜索路径生成:');
  const claudePaths = await environmentService.getSearchPaths('claude');
  console.log(`Claude 搜索路径 (${claudePaths.length} 个):`);
  claudePaths.slice(0, 10).forEach(p => console.log(`  - ${p}`));
  if (claudePaths.length > 10) {
    console.log(`  ... 还有 ${claudePaths.length - 10} 个路径`);
  }
  
  // 5. 测试诊断信息
  console.log('\n5. 获取诊断信息:');
  const diagnostics = await environmentService.getDiagnostics();
  console.log('平台:', diagnostics.platform);
  console.log('架构:', diagnostics.arch);
  console.log('Node 版本:', diagnostics.nodeVersion);
  console.log('Electron 版本:', diagnostics.electronVersion);
  console.log('NPM 前缀:', diagnostics.paths.npm);
  
  // 6. 总结
  console.log('\n=== 测试总结 ===');
  const summary = fullCheck.summary;
  console.log('环境就绪:', summary.ready ? '✅ 是' : '❌ 否');
  console.log('已安装:', summary.installed.join(', '));
  console.log('缺失:', summary.missing.length > 0 ? summary.missing.join(', ') : '无');
  console.log('问题:', summary.issues.length > 0 ? summary.issues.join(', ') : '无');
}

// 运行测试
testEnvironmentDetection().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});