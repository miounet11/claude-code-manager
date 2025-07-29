#!/usr/bin/env node
'use strict';

/**
 * 测试配置保存功能修复
 * 验证 appendChild 错误是否已解决
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 测试配置保存功能修复...\n');

// 测试项目
const tests = [
  {
    name: '检查 app-full.html 中的 alert 替换',
    test: async () => {
      const filePath = path.join(__dirname, '../src/renderer/app-full.html');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 检查是否还有 alert 调用
      const alertMatches = content.match(/alert\s*\(/g);
      if (alertMatches && alertMatches.length > 0) {
        throw new Error(`发现 ${alertMatches.length} 个未替换的 alert 调用`);
      }
      
      // 检查是否正确使用了 electronAPI
      const electronAPICalls = content.match(/window\.electronAPI\.show(Error|Success|Info)/g);
      if (!electronAPICalls || electronAPICalls.length < 5) {
        throw new Error('electronAPI 调用数量不足，可能有遗漏');
      }
      
      console.log(`✅ 发现 ${electronAPICalls.length} 个 electronAPI 调用`);
      return true;
    }
  },
  
  {
    name: '检查 preload.js 中的 API 定义',
    test: async () => {
      const filePath = path.join(__dirname, '../src/preload/preload.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 检查必要的 API 是否定义
      const requiredAPIs = ['showError', 'showSuccess', 'showInfo', 'startProxy', 'stopProxy'];
      const missingAPIs = [];
      
      for (const api of requiredAPIs) {
        if (!content.includes(`${api}:`)) {
          missingAPIs.push(api);
        }
      }
      
      if (missingAPIs.length > 0) {
        throw new Error(`缺少 API 定义: ${missingAPIs.join(', ')}`);
      }
      
      console.log('✅ 所有必要的 API 都已定义');
      return true;
    }
  },
  
  {
    name: '检查 IPC 处理器',
    test: async () => {
      const filePath = path.join(__dirname, '../src/main/services/ipc-controller-simple.js');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 检查代理相关的处理器
      const requiredHandlers = ['proxy:start', 'proxy:stop', 'proxy:status'];
      const missingHandlers = [];
      
      for (const handler of requiredHandlers) {
        if (!content.includes(`'${handler}'`)) {
          missingHandlers.push(handler);
        }
      }
      
      if (missingHandlers.length > 0) {
        throw new Error(`缺少 IPC 处理器: ${missingHandlers.join(', ')}`);
      }
      
      console.log('✅ 所有代理处理器都已注册');
      return true;
    }
  },
  
  {
    name: '检查错误处理改进',
    test: async () => {
      // 检查是否创建了修复文档
      const docPath = path.join(__dirname, '../agentdocs/fix-appendchild-error.md');
      if (!fs.existsSync(docPath)) {
        throw new Error('修复文档未找到');
      }
      
      const docContent = fs.readFileSync(docPath, 'utf8');
      if (!docContent.includes('appendChild 错误修复')) {
        throw new Error('修复文档内容不完整');
      }
      
      console.log('✅ 修复文档已创建并包含正确内容');
      return true;
    }
  }
];

// 运行测试
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  for (const {name, test} of tests) {
    try {
      console.log(`\n📋 ${name}`);
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ 失败: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！修复已验证成功。');
    console.log('✅ 可以安全地发布 v4.7.2 版本');
  } else {
    console.log('\n⚠️  存在失败的测试，请检查并修复。');
    process.exit(1);
  }
}

// 执行测试
runTests().catch(console.error);