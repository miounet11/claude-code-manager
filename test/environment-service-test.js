/**
 * 环境检测服务测试脚本
 * 用于验证改进后的环境检测功能的可靠性和稳定性
 */
'use strict';

const path = require('path');

// 模拟 Electron 环境
process.env.NODE_ENV = 'development'; // 启用调试模式

// 导入环境服务
const EnvironmentService = require('../src/main/services/environment-service');

class EnvironmentServiceTester {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  log(message, data = null) {
    console.log(`[TEST] ${new Date().toISOString()} - ${message}`, data || '');
  }

  async runTest(testName, testFunction) {
    this.log(`开始测试: ${testName}`);
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'PASS',
        duration,
        result
      });
      
      this.log(`✅ 测试通过: ${testName} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'FAIL',
        duration,
        error: error.message
      });
      
      this.log(`❌ 测试失败: ${testName} (${duration}ms)`, { error: error.message });
      throw error;
    }
  }

  async testBasicFunctionality() {
    return await this.runTest('基本功能测试', async () => {
      const result = await EnvironmentService.checkAll();
      
      // 验证基本结构
      if (!result.timestamp || !result.system || !result.dependencies) {
        throw new Error('返回结果缺少必要字段');
      }
      
      // 验证系统信息
      if (!result.system.platform || !result.system.arch) {
        throw new Error('系统信息不完整');
      }
      
      // 验证依赖检测
      const requiredDeps = ['nodejs', 'git', 'claude', 'uv'];
      for (const dep of requiredDeps) {
        if (!(dep in result.dependencies)) {
          throw new Error(`缺少依赖检测: ${dep}`);
        }
      }
      
      return {
        hasRequestId: !!result.requestId,
        hasLogs: !!result.logs,
        dependencyCount: Object.keys(result.dependencies).length,
        summaryReady: result.summary?.ready
      };
    });
  }

  async testConcurrentAccess() {
    return await this.runTest('并发访问测试', async () => {
      const promises = [];
      const concurrentCount = 5;
      
      // 同时发起多个检测请求
      for (let i = 0; i < concurrentCount; i++) {
        promises.push(EnvironmentService.checkAll());
      }
      
      const results = await Promise.all(promises);
      
      // 验证所有结果都有效
      for (const result of results) {
        if (!result.timestamp) {
          throw new Error('并发访问返回无效结果');
        }
      }
      
      // 检查是否有缓存机制生效
      const uniqueRequestIds = new Set(results.map(r => r.requestId).filter(Boolean));
      
      return {
        totalRequests: concurrentCount,
        uniqueRequestIds: uniqueRequestIds.size,
        allValid: results.every(r => r.timestamp),
        cachingWorking: uniqueRequestIds.size < concurrentCount
      };
    });
  }

  async testErrorHandling() {
    return await this.runTest('错误处理测试', async () => {
      // 暂时破坏 PATH 环境变量
      const originalPath = process.env.PATH;
      process.env.PATH = '/nonexistent/path';
      
      try {
        const result = await EnvironmentService.checkAll();
        
        // 即使 PATH 被破坏，也应该返回有效结果
        if (!result || !result.timestamp) {
          throw new Error('错误处理失败，未返回有效结果');
        }
        
        return {
          hasResult: !!result,
          hasErrorInfo: !!result.error || result.summary?.issues?.length > 0,
          pathRestored: false
        };
      } finally {
        // 恢复原始 PATH
        process.env.PATH = originalPath;
      }
    });
  }

  async testLoggingSystem() {
    return await this.runTest('日志系统测试', async () => {
      const initialLogCount = EnvironmentService.getLogs().length;
      
      // 执行一次检测以生成日志
      await EnvironmentService.checkAll();
      
      const finalLogCount = EnvironmentService.getLogs().length;
      const logs = EnvironmentService.getLogs();
      
      // 验证日志结构
      if (logs.length === 0) {
        throw new Error('未生成任何日志');
      }
      
      const lastLog = logs[logs.length - 1];
      if (!lastLog.timestamp || !lastLog.level || !lastLog.message) {
        throw new Error('日志结构不完整');
      }
      
      return {
        logGenerated: finalLogCount > initialLogCount,
        totalLogs: finalLogCount,
        hasStructuredLogs: !!lastLog.timestamp,
        logLevels: [...new Set(logs.map(log => log.level))]
      };
    });
  }

  async testPerformance() {
    return await this.runTest('性能测试', async () => {
      const iterations = 3;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await EnvironmentService.checkAll();
        const duration = Date.now() - startTime;
        times.push(duration);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // 验证性能是否在合理范围内（平均时间小于10秒）
      if (averageTime > 10000) {
        throw new Error(`检测时间过长: ${averageTime}ms`);
      }
      
      return {
        iterations,
        averageTime: Math.round(averageTime),
        maxTime,
        minTime,
        performanceAcceptable: averageTime < 10000
      };
    });
  }

  async runAllTests() {
    this.log('🧪 开始环境检测服务改进效果测试');
    this.log('='.repeat(50));
    
    try {
      // 运行所有测试
      const basicResult = await this.testBasicFunctionality();
      const concurrentResult = await this.testConcurrentAccess();
      const errorResult = await this.testErrorHandling();
      const loggingResult = await this.testLoggingSystem();
      const performanceResult = await this.testPerformance();
      
      // 生成测试报告
      const totalDuration = Date.now() - this.startTime;
      const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
      const totalTests = this.testResults.length;
      
      this.log('='.repeat(50));
      this.log('📊 测试结果汇总');
      this.log(`总测试数: ${totalTests}`);
      this.log(`通过测试: ${passedTests}`);
      this.log(`失败测试: ${totalTests - passedTests}`);
      this.log(`总耗时: ${totalDuration}ms`);
      
      // 详细结果分析
      this.log('\n🔍 详细测试结果:');
      console.log('基本功能:', basicResult);
      console.log('并发处理:', concurrentResult);
      console.log('错误处理:', errorResult);
      console.log('日志系统:', loggingResult);
      console.log('性能表现:', performanceResult);
      
      // 改进效果评估
      this.log('\n✨ 改进效果评估:');
      
      const improvements = [];
      if (basicResult.hasRequestId) improvements.push('✅ 请求追踪机制正常');
      if (basicResult.hasLogs) improvements.push('✅ 结构化日志系统工作正常');
      if (concurrentResult.cachingWorking) improvements.push('✅ 并发安全控制有效');
      if (errorResult.hasResult) improvements.push('✅ 错误恢复机制正常');
      if (performanceResult.performanceAcceptable) improvements.push('✅ 性能表现良好');
      
      improvements.forEach(improvement => this.log(improvement));
      
      return {
        success: passedTests === totalTests,
        passRate: (passedTests / totalTests * 100).toFixed(1),
        totalDuration,
        improvements,
        testResults: this.testResults
      };
      
    } catch (error) {
      this.log('❌ 测试过程中发生错误:', error.message);
      throw error;
    }
  }
}

// 运行测试
async function main() {
  const tester = new EnvironmentServiceTester();
  
  try {
    const result = await tester.runAllTests();
    
    if (result.success) {
      console.log('\n🎉 所有测试通过！环境检测功能改进效果良好。');
    } else {
      console.log(`\n⚠️ 部分测试失败，通过率: ${result.passRate}%`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n💥 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = EnvironmentServiceTester;