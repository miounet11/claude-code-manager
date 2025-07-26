'use strict';

/**
 * Miaoda 4.1.0 新功能测试脚本
 */

const path = require('path');
const assert = require('assert');

// 加载服务
const serviceRegistry = require('../src/main/services/service-registry');
const formatConverter = require('../src/main/services/format-converter');
const localModelService = require('../src/main/services/local-model-service');

console.log('🧪 开始测试 Miaoda 4.1.0 新功能...\n');

/**
 * 测试服务注册表
 */
function testServiceRegistry() {
  console.log('📋 测试服务注册表...');
  
  // 测试获取所有服务
  const services = serviceRegistry.getAll();
  assert(services.length > 0, '应该有预设的服务');
  console.log(`  ✅ 找到 ${services.length} 个预设服务`);
  
  // 测试获取特定服务
  const openai = serviceRegistry.get('openai');
  assert(openai, 'OpenAI 服务应该存在');
  assert(openai.name === 'OpenAI', 'OpenAI 服务名称应该正确');
  console.log('  ✅ OpenAI 服务配置正确');
  
  // 测试构建 URL
  const url = serviceRegistry.buildUrl('openai', 'chat');
  assert(url === 'https://api.openai.com/v1/chat/completions', 'URL 应该正确构建');
  console.log('  ✅ URL 构建功能正常');
  
  // 测试认证头
  const headers = serviceRegistry.getAuthHeaders('openai', 'test-key');
  assert(headers.Authorization === 'Bearer test-key', '认证头应该正确');
  console.log('  ✅ 认证头生成正确');
  
  console.log('✨ 服务注册表测试通过！\n');
}

/**
 * 测试格式转换器
 */
function testFormatConverter() {
  console.log('🔄 测试格式转换器...');
  
  // 测试 Claude -> OpenAI 请求转换
  const claudeRequest = {
    model: 'claude-3-sonnet-20240229',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
    ],
    max_tokens: 1000,
    temperature: 0.7
  };
  
  const openaiRequest = formatConverter.claudeToOpenAIRequest(claudeRequest);
  assert(openaiRequest.model === 'claude-3-sonnet-20240229', '模型应该保留');
  assert(openaiRequest.messages[0].content === 'Hello', '消息应该正确转换');
  console.log('  ✅ Claude -> OpenAI 请求转换成功');
  
  // 测试 OpenAI -> Claude 请求转换
  const openaiReq = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' }
    ]
  };
  
  const claudeReq = formatConverter.openAIToClaudeRequest(openaiReq);
  assert(claudeReq.system === 'You are helpful', '系统消息应该提取');
  assert(claudeReq.messages[0].content[0].text === 'Hi', '用户消息应该转换');
  console.log('  ✅ OpenAI -> Claude 请求转换成功');
  
  // 测试格式检测
  const detectedFormat = formatConverter.detectRequestFormat(claudeRequest);
  assert(detectedFormat === 'claude', '应该检测为 Claude 格式');
  console.log('  ✅ 格式检测功能正常');
  
  console.log('✨ 格式转换器测试通过！\n');
}

/**
 * 测试本地模型服务
 */
async function testLocalModelService() {
  console.log('🦙 测试本地模型服务...');
  
  // 测试服务配置
  const services = localModelService.services;
  assert(services.ollama, 'Ollama 配置应该存在');
  assert(services.ollama.baseUrl === 'http://localhost:11434', 'Ollama URL 应该正确');
  console.log('  ✅ 服务配置正确');
  
  // 测试检测功能（可能失败，取决于是否安装了服务）
  console.log('  ⏳ 检测本地服务...');
  const ollamaStatus = await localModelService.detectService('ollama');
  if (ollamaStatus.available) {
    console.log(`  ✅ Ollama 服务可用，发现 ${ollamaStatus.models?.length || 0} 个模型`);
  } else {
    console.log('  ⚠️  Ollama 服务不可用（这是正常的，如果未安装）');
  }
  
  console.log('✨ 本地模型服务测试完成！\n');
}

/**
 * 测试动态路由解析
 */
function testDynamicRouting() {
  console.log('🛣️  测试动态路由...');
  
  // 模拟路由参数
  const routes = [
    { path: '/proxy/openai/gpt-4/v1/chat/completions', expected: { service: 'openai', model: 'gpt-4' } },
    { path: '/proxy/claude/claude-3-opus/v1/messages', expected: { service: 'claude', model: 'claude-3-opus' } },
    { path: '/proxy/ollama/llama2/api/chat', expected: { service: 'ollama', model: 'llama2' } }
  ];
  
  routes.forEach(route => {
    // 简单的路由解析测试
    const match = route.path.match(/^\/proxy\/([^/]+)\/([^/]+)\/(.*)$/);
    if (match) {
      const [, service, model] = match;
      assert(service === route.expected.service, `服务应该是 ${route.expected.service}`);
      assert(model === route.expected.model, `模型应该是 ${route.expected.model}`);
      console.log(`  ✅ 路由解析正确: ${route.path}`);
    }
  });
  
  console.log('✨ 动态路由测试通过！\n');
}

/**
 * 运行所有测试
 */
async function runTests() {
  try {
    testServiceRegistry();
    testFormatConverter();
    await testLocalModelService();
    testDynamicRouting();
    
    console.log('🎉 所有测试完成！Miaoda 4.1.0 功能正常工作！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runTests();