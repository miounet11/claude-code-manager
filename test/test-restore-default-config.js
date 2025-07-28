'use strict';

/**
 * 测试恢复默认配置功能
 */

const configService = require('../src/main/services/config-service');

console.log('🧪 测试恢复默认配置功能...\n');

async function testRestoreDefaultConfig() {
  console.log('📋 Claude Code 官方默认配置：');
  const defaultConfig = {
    name: 'Claude Code 默认配置',
    apiUrl: 'https://api.anthropic.com',
    apiKey: '',  // 用户需要自己填写
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0,
    proxy: ''
  };
  
  console.log(JSON.stringify(defaultConfig, null, 2));
  console.log('\n特点：');
  console.log('- API URL: 官方 API 地址');
  console.log('- 模型: claude-3-5-sonnet-20241022 (最新版本)');
  console.log('- 最大 Token: 4096');
  console.log('- 温度: 0 (更确定的输出)');
  console.log('- 代理: 空 (直连)');
  
  // 测试添加默认配置
  console.log('\n\n1️⃣ 测试添加默认配置...');
  
  // 先检查是否已存在
  const configs = configService.getAllConfigs();
  const existing = configs.find(c => c.name === 'Claude Code 默认配置');
  
  if (existing) {
    console.log('⚠️  已存在同名配置，ID:', existing.id);
    console.log('   在实际使用中，会提示用户是否覆盖');
  } else {
    // 添加新配置
    const saved = configService.addConfig(defaultConfig);
    console.log('✅ 成功创建默认配置，ID:', saved.id);
    
    // 清理测试数据
    console.log('\n🧹 清理测试配置...');
    configService.deleteConfig(saved.id);
    console.log('✅ 清理完成');
  }
  
  // 显示恢复流程
  console.log('\n\n💡 恢复默认配置的用户流程：');
  console.log('1. 用户点击"恢复默认"按钮');
  console.log('2. 显示确认对话框，说明不会删除现有配置');
  console.log('3. 如果已存在同名配置，询问是否覆盖');
  console.log('4. 创建或更新配置');
  console.log('5. 提示用户需要填写 API Key');
  
  console.log('\n\n🔒 安全性考虑：');
  console.log('- 不会自动删除用户的现有配置');
  console.log('- API Key 留空，需要用户手动填写');
  console.log('- 使用官方推荐的设置值');
  console.log('- 确保用户可以正常使用官方 Claude Code');
}

// 运行测试
testRestoreDefaultConfig().then(() => {
  console.log('\n✨ 测试完成！');
}).catch(error => {
  console.error('❌ 测试失败:', error);
});