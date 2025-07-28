'use strict';

/**
 * 测试配置管理的"保存并启用"功能
 */

const configService = require('../src/main/services/config-service');
const claudeService = require('../src/main/services/claude-service');
const environmentService = require('../src/main/services/environment-service');

console.log('🧪 测试配置管理"保存并启用"功能...\n');

async function testConfigSaveAndApply() {
  console.log('📋 测试流程：');
  console.log('1. 创建新配置');
  console.log('2. 保存配置');
  console.log('3. 设置为当前配置');
  console.log('4. 启动 Claude\n');
  
  try {
    // 1. 创建测试配置
    console.log('1️⃣ 创建测试配置...');
    const testConfig = {
      name: '测试配置 - ' + new Date().toISOString(),
      apiUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test-key',
      model: 'claude-3-opus-20240229',
      maxTokens: 4000,
      temperature: 0
    };
    
    const savedConfig = configService.addConfig(testConfig);
    console.log('✅ 配置已保存:', savedConfig.id);
    
    // 2. 设置为当前配置
    console.log('\n2️⃣ 设置为当前配置...');
    configService.setCurrentConfig(savedConfig.id);
    const currentConfig = configService.getCurrentConfig();
    console.log('✅ 当前配置:', currentConfig.name);
    
    // 3. 检查 Claude CLI 路径
    console.log('\n3️⃣ 检查 Claude CLI...');
    const claudeCheck = await environmentService.checkCommand('claude');
    if (!claudeCheck.installed) {
      console.log('❌ Claude CLI 未安装');
      console.log('请先安装: npm install -g @anthropic-ai/claude-code');
      return;
    }
    console.log('✅ Claude CLI 已安装:', claudeCheck.path || 'default');
    
    // 4. 测试查找 Claude 路径
    console.log('\n4️⃣ 测试查找 Claude 路径...');
    const claudePath = await claudeService.findClaudePath();
    console.log('找到的路径:', claudePath || '使用默认命令');
    
    // 5. 测试启动流程（不实际启动）
    console.log('\n5️⃣ 模拟启动流程...');
    console.log('配置信息:');
    console.log('- 名称:', currentConfig.name);
    console.log('- API URL:', currentConfig.apiUrl);
    console.log('- 模型:', currentConfig.model);
    console.log('- 最大 Token:', currentConfig.maxTokens);
    
    console.log('\n✅ 测试完成！');
    console.log('\n💡 实际使用时的流程：');
    console.log('1. 用户点击"保存并启用"');
    console.log('2. 系统保存配置');
    console.log('3. 系统设置为当前配置');
    console.log('4. 关闭配置窗口');
    console.log('5. 切换到终端页面');
    console.log('6. 启动 Claude CLI');
    
    // 清理测试配置
    console.log('\n🧹 清理测试配置...');
    configService.deleteConfig(savedConfig.id);
    console.log('✅ 清理完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 测试架构兼容性
async function testArchitectureCompatibility() {
  console.log('\n\n🏗️ 测试架构兼容性...');
  
  console.log('当前系统信息:');
  console.log('- 平台:', process.platform);
  console.log('- 架构:', process.arch);
  console.log('- Node 版本:', process.version);
  
  const pathsToCheck = {
    'Intel Mac': [
      '/usr/local/bin/claude',
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude'
    ],
    'Apple Silicon': [
      '/opt/homebrew/bin/claude',
      '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude'
    ],
    '通用路径': [
      `${process.env.HOME}/.npm-global/bin/claude`,
      `${process.env.HOME}/.npm-global/lib/node_modules/@anthropic-ai/claude-code/bin/claude`
    ]
  };
  
  const fs = require('fs');
  
  for (const [arch, paths] of Object.entries(pathsToCheck)) {
    console.log(`\n${arch}:`);
    for (const path of paths) {
      try {
        fs.accessSync(path, fs.constants.F_OK);
        console.log(`✅ ${path} - 存在`);
      } catch {
        console.log(`❌ ${path} - 不存在`);
      }
    }
  }
}

// 运行测试
async function runTests() {
  await testConfigSaveAndApply();
  await testArchitectureCompatibility();
  console.log('\n\n✨ 所有测试完成！');
}

runTests();