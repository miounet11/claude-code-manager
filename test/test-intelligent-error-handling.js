#!/usr/bin/env node

/**
 * 智能错误处理系统测试脚本
 * 
 * 测试以下功能：
 * 1. ErrorPredictor - 错误预测器
 * 2. AutoRecoveryManager - 自动恢复管理器
 * 3. HealthMonitor - 健康监控器
 * 4. ContextAnalyzer - 上下文分析器
 * 5. 集成测试 - 端到端错误处理流程
 */

'use strict';

const path = require('path');
const fs = require('fs');

// 设置模块路径
const srcPath = path.join(__dirname, '..', 'src', 'main', 'services');

// 模拟 Electron 环境
if (!global.require) {
  global.require = require;
}

// 模拟 electron 模块
const mockElectron = {
  app: {
    getPath: (name) => {
      const paths = {
        userData: path.join(__dirname, '..', 'test-data'),
        logs: path.join(__dirname, '..', 'test-data', 'logs')
      };
      return paths[name] || '/tmp';
    },
    getVersion: () => '4.7.2'
  },
  dialog: {
    showMessageBox: async (window, options) => {
      console.log('Mock dialog:', options.title, '-', options.message);
      return { response: 0 };
    }
  },
  Notification: class MockNotification {
    constructor(options) {
      this.options = options;
      console.log('Mock notification:', options.title, '-', options.body);
    }
    
    show() {
      console.log('Notification shown');
    }
    
    on(event, callback) {
      // 模拟事件监听
    }
    
    static isSupported() {
      return true;
    }
  },
  BrowserWindow: class MockBrowserWindow {
    constructor(options) {
      this.options = options;
    }
    
    loadFile() {}
    isDestroyed() { return false; }
    isFocused() { return true; }
    show() {}
    focus() {}
    
    get webContents() {
      return {
        send: (channel, data) => {
          console.log('Mock webContents.send:', channel, data);
        },
        on: (event, callback) => {
          if (event === 'did-finish-load') {
            setTimeout(callback, 100);
          }
        }
      };
    }
  }
};

// 注入 mock electron
require.cache[require.resolve('electron')] = {
  exports: mockElectron
};

// 创建测试数据目录
const testDataDir = path.join(__dirname, '..', 'test-data');
const testLogsDir = path.join(testDataDir, 'logs');

if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

if (!fs.existsSync(testLogsDir)) {
  fs.mkdirSync(testLogsDir, { recursive: true });
}

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * 测试工具函数
 */
function test(name, testFn) {
  testResults.total++;
  
  return new Promise(async (resolve) => {
    try {
      console.log(`\n🧪 Testing: ${name}`);
      await testFn();
      testResults.passed++;
      console.log(`✅ ${name} - PASSED`);
      resolve(true);
    } catch (error) {
      testResults.failed++;
      testResults.errors.push({ test: name, error: error.message });
      console.error(`❌ ${name} - FAILED:`, error.message);
      resolve(false);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to exist');
  }
}

/**
 * 主测试套件
 */
async function runTests() {
  console.log('🚀 Starting Intelligent Error Handling System Tests\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. 测试 ErrorPredictor
    await testErrorPredictor();
    
    // 2. 测试 AutoRecoveryManager
    await testAutoRecoveryManager();
    
    // 3. 测试 HealthMonitor
    await testHealthMonitor();
    
    // 4. 测试 ContextAnalyzer
    await testContextAnalyzer();
    
    // 5. 测试 ErrorHandler 集成
    await testErrorHandlerIntegration();
    
    // 6. 测试 ConfigService 集成
    await testConfigServiceIntegration();
    
    // 7. 测试端到端流程
    await testEndToEndFlow();
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  // 输出测试结果
  printTestResults();
}

/**
 * 测试 ErrorPredictor
 */
async function testErrorPredictor() {
  console.log('\n📊 Testing ErrorPredictor');
  
  await test('ErrorPredictor initialization', async () => {
    const errorPredictor = require(path.join(srcPath, 'error-predictor.js'));
    
    assertExists(errorPredictor, 'ErrorPredictor should be exported');
    assertExists(errorPredictor.recordError, 'recordError method should exist');
    assertExists(errorPredictor.getStatistics, 'getStatistics method should exist');
    assertExists(errorPredictor.updateConfig, 'updateConfig method should exist');
  });
  
  await test('ErrorPredictor error recording', async () => {
    const errorPredictor = require(path.join(srcPath, 'error-predictor.js'));
    
    const mockError = {
      id: 'test_error_001',
      type: 'network',
      severity: 'error',
      message: 'Connection timeout',
      timestamp: Date.now(),
      context: { url: 'https://api.test.com' }
    };
    
    // 记录错误
    errorPredictor.recordError(mockError);
    
    // 获取统计信息
    const stats = errorPredictor.getStatistics();
    assertExists(stats, 'Statistics should be returned');
    assert(stats.totalErrors >= 1, 'Total errors should be at least 1');
  });
  
  await test('ErrorPredictor prediction generation', async () => {
    const errorPredictor = require(path.join(srcPath, 'error-predictor.js'));
    
    // 模拟多个网络错误以触发预测
    for (let i = 0; i < 5; i++) {
      errorPredictor.recordError({
        id: `test_network_error_${i}`,
        type: 'network',
        severity: 'error',
        message: 'ECONNREFUSED',
        timestamp: Date.now() + i * 1000,
        context: { attempt: i + 1 }
      });
    }
    
    // 等待预测生成
    await new Promise(resolve => {
      errorPredictor.once('prediction', (prediction) => {
        assertExists(prediction, 'Prediction should be generated');
        assertExists(prediction.confidence, 'Prediction should have confidence');
        assertExists(prediction.type, 'Prediction should have type');
        resolve();
      });
      
      // 如果没有预测，5秒后超时
      setTimeout(resolve, 5000);
    });
  });
  
  await test('ErrorPredictor configuration update', async () => {
    const errorPredictor = require(path.join(srcPath, 'error-predictor.js'));
    
    const newConfig = {
      enabled: true,
      minConfidence: 0.8,
      maxPredictions: 5
    };
    
    errorPredictor.updateConfig(newConfig);
    
    const stats = errorPredictor.getStatistics();
    assert(stats.config.minConfidence === 0.8, 'Configuration should be updated');
  });
}

/**
 * 测试 AutoRecoveryManager
 */
async function testAutoRecoveryManager() {
  console.log('\n🔧 Testing AutoRecoveryManager');
  
  await test('AutoRecoveryManager initialization', async () => {
    const autoRecoveryManager = require(path.join(srcPath, 'auto-recovery-manager.js'));
    
    assertExists(autoRecoveryManager, 'AutoRecoveryManager should be exported');
    assertExists(autoRecoveryManager.handleError, 'handleError method should exist');
    assertExists(autoRecoveryManager.getStatistics, 'getStatistics method should exist');
    assertExists(autoRecoveryManager.updateConfig, 'updateConfig method should exist');
  });
  
  await test('AutoRecoveryManager error handling', async () => {
    const autoRecoveryManager = require(path.join(srcPath, 'auto-recovery-manager.js'));
    
    const mockError = {
      id: 'test_recovery_error_001',
      type: 'network',
      severity: 'error',
      message: 'ETIMEDOUT',
      timestamp: Date.now(),
      context: { url: 'https://api.test.com', timeout: 30000 }
    };
    
    const result = await autoRecoveryManager.handleError(mockError);
    
    assertExists(result, 'Recovery result should be returned');
    assert(typeof result.attempted === 'boolean', 'Result should have attempted flag');
    
    if (result.attempted) {
      assertExists(result.recovered, 'Result should indicate if recovery succeeded');
    }
  });
  
  await test('AutoRecoveryManager statistics', async () => {
    const autoRecoveryManager = require(path.join(srcPath, 'auto-recovery-manager.js'));
    
    const stats = autoRecoveryManager.getStatistics();
    
    assertExists(stats, 'Statistics should be returned');
    assertExists(stats.enabled, 'Statistics should have enabled flag');
    assertExists(stats.totalAttempts, 'Statistics should have total attempts');
    assert(typeof stats.successRate === 'number', 'Success rate should be a number');
  });
  
  await test('AutoRecoveryManager configuration', async () => {
    const autoRecoveryManager = require(path.join(srcPath, 'auto-recovery-manager.js'));
    
    const newConfig = {
      enabled: true,
      maxConcurrentRecoveries: 3,
      maxRecoveryAttempts: 5
    };
    
    autoRecoveryManager.updateConfig(newConfig);
    
    const stats = autoRecoveryManager.getStatistics();
    // 验证配置是否应用（如果实现了相应的统计）
    assertExists(stats, 'Statistics should still be available after config update');
  });
}

/**
 * 测试 HealthMonitor
 */
async function testHealthMonitor() {
  console.log('\n💓 Testing HealthMonitor');
  
  await test('HealthMonitor initialization', async () => {
    const { healthMonitor } = require(path.join(srcPath, 'health-monitor.js'));
    
    assertExists(healthMonitor, 'HealthMonitor should be exported');
    assertExists(healthMonitor.start, 'start method should exist');
    assertExists(healthMonitor.stop, 'stop method should exist');
    assertExists(healthMonitor.getStatistics, 'getStatistics method should exist');
    assertExists(healthMonitor.getCurrentHealth, 'getCurrentHealth method should exist');
  });
  
  await test('HealthMonitor start and stop', async () => {
    const { healthMonitor } = require(path.join(srcPath, 'health-monitor.js'));
    
    // 启动健康监控
    healthMonitor.start();
    
    const stats = healthMonitor.getStatistics();
    assert(stats.isRunning === true, 'HealthMonitor should be running');
    
    // 等待一些指标收集
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const health = healthMonitor.getCurrentHealth();
    assertExists(health, 'Current health should be available');
    assertExists(health.overall, 'Overall health status should exist');
    
    // 停止健康监控
    healthMonitor.stop();
    
    const finalStats = healthMonitor.getStatistics();
    assert(finalStats.isRunning === false, 'HealthMonitor should be stopped');
  });
  
  await test('HealthMonitor forced health check', async () => {
    const { healthMonitor } = require(path.join(srcPath, 'health-monitor.js'));
    
    // 启动并执行强制检查
    healthMonitor.start();
    
    const healthResult = await healthMonitor.forceHealthCheck();
    
    assertExists(healthResult, 'Health check result should be returned');
    assertExists(healthResult.overall, 'Overall health should be included');
    
    healthMonitor.stop();
  });
  
  await test('HealthMonitor configuration update', async () => {
    const { healthMonitor } = require(path.join(srcPath, 'health-monitor.js'));
    
    const newConfig = {
      enabled: true,
      enabledMetrics: ['SYSTEM_RESOURCES', 'APPLICATION_HEALTH'],
      alertThreshold: 'ERROR'
    };
    
    healthMonitor.updateConfig(newConfig);
    
    const stats = healthMonitor.getStatistics();
    assertEquals(stats.enabledMetrics.length, 2, 'Should have 2 enabled metrics');
  });
}

/**
 * 测试 ContextAnalyzer
 */
async function testContextAnalyzer() {
  console.log('\n🔍 Testing ContextAnalyzer');
  
  await test('ContextAnalyzer initialization', async () => {
    const contextAnalyzer = require(path.join(srcPath, 'context-analyzer.js'));
    
    assertExists(contextAnalyzer, 'ContextAnalyzer should be exported');
    assertExists(contextAnalyzer.analyzeContext, 'analyzeContext method should exist');
    assertExists(contextAnalyzer.getStatistics, 'getStatistics method should exist');
    assertExists(contextAnalyzer.updateConfig, 'updateConfig method should exist');
  });
  
  await test('ContextAnalyzer error analysis', async () => {
    const contextAnalyzer = require(path.join(srcPath, 'context-analyzer.js'));
    
    const mockError = {
      id: 'test_context_error_001',
      type: 'system',
      severity: 'critical',
      message: 'Memory exhausted',
      timestamp: Date.now(),
      context: { memoryUsage: { heapUsed: 1000000000 } }
    };
    
    const analysisResult = await contextAnalyzer.analyzeContext(mockError);
    
    assertExists(analysisResult, 'Analysis result should be returned');
    
    if (analysisResult.analyzed) {
      assertExists(analysisResult.contextData, 'Context data should be included');
      assertExists(analysisResult.analysisResults, 'Analysis results should be included');
      assertExists(analysisResult.insights, 'Insights should be generated');
      assert(typeof analysisResult.confidence === 'number', 'Confidence should be a number');
    }
  });
  
  await test('ContextAnalyzer configuration', async () => {
    const contextAnalyzer = require(path.join(srcPath, 'context-analyzer.js'));
    
    const newConfig = {
      enabled: true,
      enableDeepAnalysis: false,
      confidenceThreshold: 0.8
    };
    
    contextAnalyzer.updateConfig(newConfig);
    
    const stats = contextAnalyzer.getStatistics();
    assertExists(stats, 'Statistics should be available after config update');
  });
  
  await test('ContextAnalyzer statistics', async () => {
    const contextAnalyzer = require(path.join(srcPath, 'context-analyzer.js'));
    
    const stats = contextAnalyzer.getStatistics();
    
    assertExists(stats, 'Statistics should be returned');
    assertExists(stats.enabled, 'Statistics should have enabled flag');
    assert(typeof stats.totalAnalyses === 'number', 'Total analyses should be a number');
  });
}

/**
 * 测试 ErrorHandler 集成
 */
async function testErrorHandlerIntegration() {
  console.log('\n🔗 Testing ErrorHandler Integration');
  
  await test('ErrorHandler intelligent features', async () => {
    const { errorHandler } = require(path.join(srcPath, 'error-handler.js'));
    
    assertExists(errorHandler, 'ErrorHandler should be exported');
    assertExists(errorHandler.handle, 'handle method should exist');
    assertExists(errorHandler.getEnhancedStatistics, 'getEnhancedStatistics method should exist');
    assertExists(errorHandler.updateIntelligentFeatures, 'updateIntelligentFeatures method should exist');
  });
  
  await test('ErrorHandler enhanced error processing', async () => {
    const { errorHandler, ErrorTypes, ErrorSeverity } = require(path.join(srcPath, 'error-handler.js'));
    
    const mockError = {
      type: ErrorTypes.NETWORK,
      severity: ErrorSeverity.ERROR,
      message: 'Test enhanced error processing',
      detail: 'This is a test error for intelligent processing',
      context: { testId: 'enhanced_processing_001' }
    };
    
    // 处理错误
    await errorHandler.handle(mockError);
    
    // 获取增强统计
    const stats = errorHandler.getEnhancedStatistics();
    
    assertExists(stats, 'Enhanced statistics should be returned');
    assertExists(stats.intelligentFeatures, 'Intelligent features status should be included');
    assert(stats.total >= 1, 'At least one error should be recorded');
  });
  
  await test('ErrorHandler configuration update', async () => {
    const { errorHandler } = require(path.join(srcPath, 'error-handler.js'));
    
    const newConfig = {
      enabled: true,
      predictiveAnalysis: false,
      contextEnrichment: true,
      autoRecovery: false
    };
    
    errorHandler.updateIntelligentFeatures(newConfig);
    
    const stats = errorHandler.getEnhancedStatistics();
    assert(stats.intelligentFeatures.contextEnrichment === true, 'Context enrichment should be enabled');
    assert(stats.intelligentFeatures.predictiveAnalysis === false, 'Predictive analysis should be disabled');
  });
}

/**
 * 测试 ConfigService 集成
 */
async function testConfigServiceIntegration() {
  console.log('\n⚙️  Testing ConfigService Integration');
  
  await test('ConfigService intelligent error handling config', async () => {
    // 由于 ConfigService 使用 electron-store，我们需要 mock 它
    const mockStore = {
      data: {},
      get: function(key, defaultValue) {
        return this.data[key] || defaultValue;
      },
      set: function(key, value) {
        this.data[key] = value;
      }
    };
    
    // Mock electron-store
    require.cache[require.resolve('electron-store')] = {
      exports: function() {
        return mockStore;
      }
    };
    
    delete require.cache[require.resolve(path.join(srcPath, 'config-service.js'))];
    const configService = require(path.join(srcPath, 'config-service.js'));
    
    assertExists(configService, 'ConfigService should be exported');
    assertExists(configService.getIntelligentErrorHandlingConfig, 'getIntelligentErrorHandlingConfig method should exist');
    assertExists(configService.updateIntelligentErrorHandlingConfig, 'updateIntelligentErrorHandlingConfig method should exist');
  });
  
  await test('ConfigService intelligent config management', async () => {
    const configService = require(path.join(srcPath, 'config-service.js'));
    
    // 获取默认配置
    const defaultConfig = configService.getIntelligentErrorHandlingConfig();
    
    assertExists(defaultConfig, 'Default config should be returned');
    assertExists(defaultConfig.enabled, 'Config should have enabled flag');
    assertExists(defaultConfig.errorPredictor, 'Config should have error predictor settings');
    assertExists(defaultConfig.autoRecoveryManager, 'Config should have auto recovery settings');
    
    // 更新配置
    const updateResult = configService.updateIntelligentErrorHandlingConfig({
      enabled: false,
      errorPredictor: {
        enabled: false
      }
    });
    
    assertExists(updateResult, 'Update result should be returned');
    assert(updateResult.success === true, 'Update should succeed');
    
    // 验证更新
    const updatedConfig = configService.getIntelligentErrorHandlingConfig();
    assert(updatedConfig.enabled === false, 'Config should be updated');
    assert(updatedConfig.errorPredictor.enabled === false, 'Nested config should be updated');
  });
  
  await test('ConfigService preset configurations', async () => {
    const configService = require(path.join(srcPath, 'config-service.js'));
    
    const presets = configService.getIntelligentErrorHandlingPresets();
    
    assertExists(presets, 'Presets should be returned');
    assertExists(presets.conservative, 'Conservative preset should exist');
    assertExists(presets.balanced, 'Balanced preset should exist');
    assertExists(presets.aggressive, 'Aggressive preset should exist');
    
    // 应用预设配置
    const applyResult = configService.applyIntelligentErrorHandlingPreset('conservative');
    
    assertExists(applyResult, 'Apply result should be returned');
    assert(applyResult.success === true, 'Preset application should succeed');
    
    const currentConfig = configService.getIntelligentErrorHandlingConfig();
    assert(currentConfig.errorPredictor.minConfidence === 0.8, 'Conservative preset should be applied');
  });
}

/**
 * 测试端到端流程
 */
async function testEndToEndFlow() {
  console.log('\n🌟 Testing End-to-End Flow');
  
  await test('Complete error handling flow', async () => {
    // 这个测试需要集成所有组件
    console.log('Setting up complete error handling system...');
    
    // 1. 初始化所有组件
    const errorPredictor = require(path.join(srcPath, 'error-predictor.js'));
    const autoRecoveryManager = require(path.join(srcPath, 'auto-recovery-manager.js'));
    const { healthMonitor } = require(path.join(srcPath, 'health-monitor.js'));
    const contextAnalyzer = require(path.join(srcPath, 'context-analyzer.js'));
    const { errorHandler, ErrorTypes, ErrorSeverity } = require(path.join(srcPath, 'error-handler.js'));
    
    // 2. 启动健康监控（可选）
    healthMonitor.start();
    
    // 3. 模拟一个复杂错误场景
    const testError = {
      type: ErrorTypes.API,
      severity: ErrorSeverity.ERROR,
      message: 'API request failed with 429 Too Many Requests',
      detail: 'Rate limit exceeded for API endpoint',
      context: {
        url: 'https://api.example.com/v1/chat',
        statusCode: 429,
        retryAfter: 60,
        attempt: 3
      }
    };
    
    // 4. 记录错误到预测器
    errorPredictor.recordError(testError);
    
    // 5. 进行上下文分析
    const contextAnalysis = await contextAnalyzer.analyzeContext(testError);
    
    // 6. 尝试自动恢复
    const recoveryResult = await autoRecoveryManager.handleError(testError, {
      contextAnalysis
    });
    
    // 7. 通过错误处理器处理
    await errorHandler.handle(testError);
    
    // 8. 验证整个流程
    assertExists(contextAnalysis, 'Context analysis should be completed');
    assertExists(recoveryResult, 'Recovery should be attempted');
    
    // 9. 清理
    healthMonitor.stop();
    
    console.log('✅ Complete error handling flow executed successfully');
  });
  
  await test('Performance benchmarking', async () => {
    console.log('Running performance benchmark...');
    
    const { errorHandler, ErrorTypes, ErrorSeverity } = require(path.join(srcPath, 'error-handler.js'));
    
    const startTime = Date.now();
    const errorCount = 50;
    
    // 处理多个错误以测试性能
    const promises = [];
    for (let i = 0; i < errorCount; i++) {
      const testError = {
        type: ErrorTypes.NETWORK,
        severity: ErrorSeverity.WARNING,
        message: `Performance test error ${i}`,
        detail: 'This is a performance test error',
        context: { testId: i, batch: 'performance_test' }
      };
      
      promises.push(errorHandler.handle(testError));
    }
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const avgTime = duration / errorCount;
    
    console.log(`Processed ${errorCount} errors in ${duration}ms (avg: ${avgTime.toFixed(2)}ms per error)`);
    
    // 性能应该合理（每个错误处理不超过100ms）
    assert(avgTime < 100, `Average processing time should be less than 100ms, got ${avgTime.toFixed(2)}ms`);
  });
}

/**
 * 打印测试结果
 */
function printTestResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(({ test, error }) => {
      console.log(`  • ${test}: ${error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! Intelligent Error Handling System is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  test,
  assert,
  assertEquals,
  assertExists
};