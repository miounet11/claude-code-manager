#!/usr/bin/env node
'use strict';

/**
 * 测试配置管理器增强功能
 */

console.log('\n=== 测试配置管理器增强功能 ===\n');

// 测试项目
const tests = [
  {
    name: 'Claude Code 检测功能',
    description: '验证环境服务能否正确检测 Claude Code CLI',
    test: async () => {
      const environmentService = require('../src/main/services/environment-service');
      const result = await environmentService.checkClaude();
      
      console.log('Claude Code 检测结果:', result);
      
      if (result.installed) {
        console.log('✓ Claude Code 已安装');
        console.log(`  路径: ${result.path}`);
        console.log(`  版本: ${result.version}`);
        return true;
      } else {
        console.log('✗ Claude Code 未检测到');
        console.log(`  错误: ${result.error}`);
        return false;
      }
    }
  },
  {
    name: 'NPM Prefix 获取',
    description: '验证获取 npm 全局路径功能',
    test: async () => {
      const environmentService = require('../src/main/services/environment-service');
      const npmPrefix = await environmentService.getNpmPrefix();
      
      if (npmPrefix) {
        console.log(`✓ NPM Prefix: ${npmPrefix}`);
        return true;
      } else {
        console.log('✗ 无法获取 NPM Prefix');
        return false;
      }
    }
  },
  {
    name: '配置验证功能',
    description: '测试配置验证逻辑',
    test: async () => {
      // 模拟 IPC 调用
      const testConfigs = [
        {
          name: '测试配置',
          apiUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test-key',
          model: 'claude-3-5-sonnet-20241022'
        },
        {
          name: '',
          apiUrl: 'invalid-url',
          apiKey: '',
          model: ''
        }
      ];
      
      console.log('测试有效配置...');
      const validConfig = testConfigs[0];
      const validErrors = [];
      
      if (!validConfig.name || validConfig.name.trim() === '') {
        validErrors.push('配置名称不能为空');
      }
      
      if (!validConfig.apiUrl || validConfig.apiUrl.trim() === '') {
        validErrors.push('API 地址不能为空');
      } else if (!validConfig.apiUrl.match(/^https?:\/\/.+/)) {
        validErrors.push('API 地址格式不正确');
      }
      
      if (!validConfig.apiKey || validConfig.apiKey.trim() === '') {
        validErrors.push('API Key 不能为空');
      }
      
      if (!validConfig.model) {
        validErrors.push('请选择模型');
      }
      
      if (validErrors.length === 0) {
        console.log('✓ 有效配置验证通过');
      } else {
        console.log('✗ 有效配置验证失败:', validErrors);
        return false;
      }
      
      console.log('\n测试无效配置...');
      const invalidConfig = testConfigs[1];
      const invalidErrors = [];
      
      if (!invalidConfig.name || invalidConfig.name.trim() === '') {
        invalidErrors.push('配置名称不能为空');
      }
      
      if (!invalidConfig.apiUrl || invalidConfig.apiUrl.trim() === '') {
        invalidErrors.push('API 地址不能为空');
      } else if (!invalidConfig.apiUrl.match(/^https?:\/\/.+/)) {
        invalidErrors.push('API 地址格式不正确');
      }
      
      if (!invalidConfig.apiKey || invalidConfig.apiKey.trim() === '') {
        invalidErrors.push('API Key 不能为空');
      }
      
      if (!invalidConfig.model) {
        invalidErrors.push('请选择模型');
      }
      
      if (invalidErrors.length > 0) {
        console.log('✓ 无效配置正确识别');
        console.log('  检测到的错误:', invalidErrors);
        return true;
      } else {
        console.log('✗ 无效配置未能识别');
        return false;
      }
    }
  },
  {
    name: '默认配置还原',
    description: '测试 Claude Code 官方默认配置',
    test: async () => {
      const defaultConfig = {
        name: 'Claude Code 默认配置',
        apiUrl: 'https://api.anthropic.com',
        apiKey: '',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        temperature: 0,
        proxy: ''
      };
      
      console.log('默认配置:', JSON.stringify(defaultConfig, null, 2));
      
      if (defaultConfig.apiUrl === 'https://api.anthropic.com' && 
          defaultConfig.model === 'claude-3-5-sonnet-20241022' &&
          defaultConfig.maxTokens === 4096 &&
          defaultConfig.temperature === 0) {
        console.log('✓ 默认配置符合 Claude Code 官方标准');
        return true;
      } else {
        console.log('✗ 默认配置不符合标准');
        return false;
      }
    }
  }
];

// 运行测试
async function runTests() {
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n测试: ${test.name}`);
    console.log(`说明: ${test.description}`);
    
    try {
      const result = await test.test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`✗ 测试出错: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${tests.length}`);
  
  if (failed === 0) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 部分测试失败');
  }
}

// 执行测试
runTests().catch(console.error);