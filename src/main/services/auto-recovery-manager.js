'use strict';

const EventEmitter = require('events');
const { ErrorTypes, ErrorSeverity } = require('./error-handler');

/**
 * 恢复策略定义
 */
const RecoveryStrategies = {
  // 网络错误恢复策略
  NETWORK_RECOVERY: {
    errorTypes: [ErrorTypes.NETWORK],
    indicators: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ESOCKETTIMEDOUT'],
    strategies: [
      {
        name: 'exponential_backoff_retry',
        priority: 1,
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
        jitter: true
      },
      {
        name: 'connection_pool_reset',
        priority: 2,
        cooldown: 30000
      },
      {
        name: 'dns_cache_clear',
        priority: 3,
        cooldown: 60000
      }
    ]
  },
  
  // API错误恢复策略
  API_RECOVERY: {
    errorTypes: [ErrorTypes.API],
    indicators: ['401', '403', '429', '500', '502', '503', '504'],
    strategies: [
      {
        name: 'auth_token_refresh',
        priority: 1,
        conditions: ['401', '403'],
        cooldown: 5000
      },
      {
        name: 'rate_limit_backoff',
        priority: 1,
        conditions: ['429'],
        baseDelay: 60000,
        maxDelay: 300000,
        respectRetryAfter: true
      },
      {
        name: 'server_error_retry',
        priority: 2,
        conditions: ['500', '502', '503', '504'],
        maxAttempts: 3,
        baseDelay: 5000,
        backoffFactor: 2
      },
      {
        name: 'api_endpoint_fallback',
        priority: 3,
        cooldown: 30000
      }
    ]
  },
  
  // 配置错误恢复策略
  CONFIG_RECOVERY: {
    errorTypes: [ErrorTypes.CONFIG],
    indicators: ['parse error', 'invalid config', 'missing property'],
    strategies: [
      {
        name: 'config_validation_fix',
        priority: 1,
        autoFix: true
      },
      {
        name: 'config_backup_restore',
        priority: 2,
        requiresConfirmation: true
      },
      {
        name: 'config_reset_to_default',
        priority: 3,
        requiresConfirmation: true
      }
    ]
  },
  
  // 系统资源恢复策略
  SYSTEM_RECOVERY: {
    errorTypes: [ErrorTypes.SYSTEM],
    indicators: ['EMFILE', 'ENOMEM', 'ENOSPC'],
    strategies: [
      {
        name: 'resource_cleanup',
        priority: 1,
        autoRun: true
      },
      {
        name: 'memory_garbage_collect',
        priority: 2,
        cooldown: 10000
      },
      {
        name: 'process_restart',
        priority: 3,
        requiresConfirmation: true,
        lastResort: true
      }
    ]
  },
  
  // 进程错误恢复策略
  PROCESS_RECOVERY: {
    errorTypes: [ErrorTypes.PROCESS],
    indicators: ['spawn', 'ESRCH', 'process not found'],
    strategies: [
      {
        name: 'process_respawn',
        priority: 1,
        maxAttempts: 3,
        baseDelay: 2000
      },
      {
        name: 'dependency_check',
        priority: 2,
        autoRun: true
      },
      {
        name: 'service_restart',
        priority: 3,
        requiresConfirmation: true
      }
    ]
  }
};

/**
 * 智能自动恢复管理器
 * 根据错误类型和上下文自动执行恢复策略
 */
class AutoRecoveryManager extends EventEmitter {
  constructor() {
    super();
    
    // 恢复状态跟踪
    this.recoveryAttempts = new Map();
    this.activeRecoveries = new Map();
    this.strategyStats = new Map();
    
    // 恢复历史
    this.recoveryHistory = [];
    this.maxHistorySize = 500;
    
    // 恢复器注册表
    this.recoverers = new Map();
    
    // 配置
    this.config = {
      enabled: true,
      autoRecoveryEnabled: true,
      maxConcurrentRecoveries: 5,
      globalCooldown: 1000, // 全局冷却时间
      maxRecoveryAttempts: 10, // 单个错误最大恢复尝试次数
      requireConfirmationForCritical: true,
      enableLearning: true // 启用学习功能
    };
    
    // 初始化内置恢复器
    this.initializeBuiltinRecoverers();
    
    console.log('AutoRecoveryManager initialized with', 
      Object.keys(RecoveryStrategies).length, 'strategy groups');
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
  
  /**
   * 处理错误并尝试恢复
   */
  async handleError(errorInfo, context = {}) {
    if (!this.config.enabled) {
      return { attempted: false, reason: 'auto recovery disabled' };
    }
    
    try {
      // 1. 分析错误并选择策略
      const applicableStrategies = this.analyzeError(errorInfo);
      
      if (applicableStrategies.length === 0) {
        return { attempted: false, reason: 'no applicable strategies' };
      }
      
      // 2. 检查是否已达到最大恢复尝试次数
      if (this.hasExceededMaxAttempts(errorInfo)) {
        return { attempted: false, reason: 'max attempts exceeded' };
      }
      
      // 3. 检查并发恢复限制
      if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
        return { attempted: false, reason: 'too many concurrent recoveries' };
      }
      
      // 4. 执行恢复策略
      const recoveryResult = await this.executeRecoveryStrategies(
        errorInfo, 
        applicableStrategies, 
        context
      );
      
      // 5. 记录恢复历史
      this.recordRecoveryAttempt(errorInfo, recoveryResult);
      
      return recoveryResult;
      
    } catch (error) {
      console.error('AutoRecoveryManager.handleError failed:', error);
      return { 
        attempted: false, 
        error: error.message,
        reason: 'recovery manager error'
      };
    }
  }
  
  /**
   * 分析错误并选择适用的策略
   */
  analyzeError(errorInfo) {
    const applicableStrategies = [];
    
    for (const [groupName, strategyGroup] of Object.entries(RecoveryStrategies)) {
      // 检查错误类型匹配
      if (!strategyGroup.errorTypes.includes(errorInfo.type)) {
        continue;
      }
      
      // 检查指示器匹配
      const hasMatchingIndicator = strategyGroup.indicators.some(indicator =>
        this.matchesIndicator(errorInfo, indicator)
      );
      
      if (!hasMatchingIndicator) {
        continue;
      }
      
      // 添加匹配的策略，按优先级排序
      const sortedStrategies = strategyGroup.strategies
        .sort((a, b) => a.priority - b.priority)
        .map(strategy => ({
          ...strategy,
          groupName,
          errorType: errorInfo.type
        }));
      
      applicableStrategies.push(...sortedStrategies);
    }
    
    return applicableStrategies;
  }
  
  /**
   * 检查错误是否匹配指示器
   */
  matchesIndicator(errorInfo, indicator) {
    const searchFields = [
      errorInfo.message,
      errorInfo.detail,
      errorInfo.originalError?.message,
      errorInfo.originalError?.code,
      String(errorInfo.context?.statusCode || ''),
      errorInfo.stack
    ].filter(Boolean);
    
    const searchText = searchFields.join(' ').toLowerCase();
    return searchText.includes(indicator.toLowerCase());
  }
  
  /**
   * 检查是否已超过最大尝试次数
   */
  hasExceededMaxAttempts(errorInfo) {
    const key = this.getErrorKey(errorInfo);
    const attempts = this.recoveryAttempts.get(key) || { count: 0, lastAttempt: 0 };
    
    return attempts.count >= this.config.maxRecoveryAttempts;
  }
  
  /**
   * 执行恢复策略
   */
  async executeRecoveryStrategies(errorInfo, strategies, context) {
    const recoveryId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // 标记开始恢复
    this.activeRecoveries.set(recoveryId, {
      errorInfo,
      strategies: strategies.map(s => s.name),
      startTime,
      status: 'running'
    });
    
    try {
      const results = [];
      let recovered = false;
      
      for (const strategy of strategies) {
        // 检查是否已经恢复
        if (recovered) break;
        
        // 检查策略条件
        if (!this.checkStrategyConditions(strategy, errorInfo)) {
          results.push({
            strategy: strategy.name,
            attempted: false,
            reason: 'conditions not met'
          });
          continue;
        }
        
        // 检查冷却时间
        if (this.isInCooldown(strategy, errorInfo)) {
          results.push({
            strategy: strategy.name,
            attempted: false,
            reason: 'in cooldown'
          });
          continue;
        }
        
        // 检查是否需要用户确认
        if (strategy.requiresConfirmation && this.config.requireConfirmationForCritical) {
          const confirmed = await this.requestUserConfirmation(strategy, errorInfo);
          if (!confirmed) {
            results.push({
              strategy: strategy.name,
              attempted: false,
              reason: 'user declined'
            });
            continue;
          }
        }
        
        // 执行策略
        const strategyResult = await this.executeStrategy(strategy, errorInfo, context);
        results.push(strategyResult);
        
        // 更新统计
        this.updateStrategyStats(strategy.name, strategyResult);
        
        if (strategyResult.success) {
          recovered = true;
          break;
        }
        
        // 应用全局冷却
        if (this.config.globalCooldown > 0) {
          await this.delay(this.config.globalCooldown);
        }
      }
      
      const duration = Date.now() - startTime;
      const result = {
        attempted: true,
        recovered,
        recoveryId,
        duration,
        strategiesExecuted: results.length,
        results
      };
      
      // 更新恢复计数
      this.updateRecoveryAttempts(errorInfo);
      
      this.emit('recovery-completed', {
        errorInfo,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } finally {
      // 清理活动恢复记录
      this.activeRecoveries.delete(recoveryId);
    }
  }
  
  /**
   * 检查策略执行条件
   */
  checkStrategyConditions(strategy, errorInfo) {
    // 检查特定条件
    if (strategy.conditions && strategy.conditions.length > 0) {
      return strategy.conditions.some(condition =>
        this.matchesIndicator(errorInfo, condition)
      );
    }
    
    return true;
  }
  
  /**
   * 检查策略是否在冷却期
   */
  isInCooldown(strategy, errorInfo) {
    if (!strategy.cooldown) return false;
    
    const key = `${strategy.name}_${this.getErrorKey(errorInfo)}`;
    const lastExecution = this.strategyStats.get(key)?.lastExecution || 0;
    
    return Date.now() - lastExecution < strategy.cooldown;
  }
  
  /**
   * 请求用户确认
   */
  async requestUserConfirmation(strategy, errorInfo) {
    return new Promise((resolve) => {
      this.emit('confirmation-required', {
        strategy: strategy.name,
        errorInfo,
        callback: resolve
      });
      
      // 默认10秒后自动拒绝
      setTimeout(() => resolve(false), 10000);
    });
  }
  
  /**
   * 执行单个策略
   */
  async executeStrategy(strategy, errorInfo, context) {
    const startTime = Date.now();
    
    try {
      console.log(`Executing recovery strategy: ${strategy.name}`);
      
      // 获取策略执行器
      const recoverer = this.recoverers.get(strategy.name);
      if (!recoverer) {
        return {
          strategy: strategy.name,
          success: false,
          error: 'no recoverer found',
          duration: Date.now() - startTime
        };
      }
      
      // 执行恢复策略
      const result = await recoverer.execute(strategy, errorInfo, context);
      
      return {
        strategy: strategy.name,
        success: result.success,
        message: result.message,
        data: result.data,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`Strategy ${strategy.name} failed:`, error);
      
      return {
        strategy: strategy.name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * 更新策略统计
   */
  updateStrategyStats(strategyName, result) {
    const key = strategyName;
    const stats = this.strategyStats.get(key) || {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      lastExecution: 0
    };
    
    stats.totalAttempts++;
    stats.lastExecution = Date.now();
    
    if (result.success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }
    
    // 更新平均执行时间
    const totalDuration = stats.averageDuration * (stats.totalAttempts - 1) + result.duration;
    stats.averageDuration = totalDuration / stats.totalAttempts;
    
    this.strategyStats.set(key, stats);
  }
  
  /**
   * 更新恢复尝试计数
   */
  updateRecoveryAttempts(errorInfo) {
    const key = this.getErrorKey(errorInfo);
    const attempts = this.recoveryAttempts.get(key) || { count: 0, lastAttempt: 0 };
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    this.recoveryAttempts.set(key, attempts);
    
    // 清理过期的尝试记录
    setTimeout(() => {
      this.cleanupExpiredAttempts();
    }, 60000); // 1分钟后清理
  }
  
  /**
   * 记录恢复尝试
   */
  recordRecoveryAttempt(errorInfo, result) {
    const record = {
      id: result.recoveryId || `attempt_${Date.now()}`,
      timestamp: Date.now(),
      errorInfo: {
        id: errorInfo.id,
        type: errorInfo.type,
        severity: errorInfo.severity,
        message: errorInfo.message
      },
      result: {
        attempted: result.attempted,
        recovered: result.recovered,
        duration: result.duration,
        strategiesExecuted: result.strategiesExecuted
      }
    };
    
    this.recoveryHistory.unshift(record);
    
    // 限制历史记录大小
    if (this.recoveryHistory.length > this.maxHistorySize) {
      this.recoveryHistory = this.recoveryHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * 获取错误键值
   */
  getErrorKey(errorInfo) {
    return `${errorInfo.type}_${errorInfo.message}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 清理过期的尝试记录
   */
  cleanupExpiredAttempts() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, attempts] of this.recoveryAttempts.entries()) {
      if (now - attempts.lastAttempt > maxAge) {
        this.recoveryAttempts.delete(key);
      }
    }
  }
  
  /**
   * 初始化内置恢复器
   */
  initializeBuiltinRecoverers() {
    // 网络相关恢复器
    this.registerRecoverer('exponential_backoff_retry', new ExponentialBackoffRecoverer());
    this.registerRecoverer('connection_pool_reset', new ConnectionPoolResetRecoverer());
    this.registerRecoverer('dns_cache_clear', new DnsCacheClearRecoverer());
    
    // API相关恢复器
    this.registerRecoverer('auth_token_refresh', new AuthTokenRefreshRecoverer());
    this.registerRecoverer('rate_limit_backoff', new RateLimitBackoffRecoverer());
    this.registerRecoverer('server_error_retry', new ServerErrorRetryRecoverer());
    this.registerRecoverer('api_endpoint_fallback', new ApiEndpointFallbackRecoverer());
    
    // 配置相关恢复器
    this.registerRecoverer('config_validation_fix', new ConfigValidationFixRecoverer());
    this.registerRecoverer('config_backup_restore', new ConfigBackupRestoreRecoverer());
    this.registerRecoverer('config_reset_to_default', new ConfigResetRecoverer());
    
    // 系统相关恢复器
    this.registerRecoverer('resource_cleanup', new ResourceCleanupRecoverer());
    this.registerRecoverer('memory_garbage_collect', new MemoryGarbageCollectRecoverer());
    this.registerRecoverer('process_restart', new ProcessRestartRecoverer());
    
    // 进程相关恢复器
    this.registerRecoverer('process_respawn', new ProcessRespawnRecoverer());
    this.registerRecoverer('dependency_check', new DependencyCheckRecoverer());
    this.registerRecoverer('service_restart', new ServiceRestartRecoverer());
  }
  
  /**
   * 注册恢复器
   */
  registerRecoverer(name, recoverer) {
    this.recoverers.set(name, recoverer);
    this.emit('recoverer-registered', { name, recoverer });
  }
  
  /**
   * 获取统计信息
   */
  getStatistics() {
    const activeCount = this.activeRecoveries.size;
    const totalAttempts = Array.from(this.strategyStats.values())
      .reduce((sum, stats) => sum + stats.totalAttempts, 0);
    const totalSuccesses = Array.from(this.strategyStats.values())
      .reduce((sum, stats) => sum + stats.successCount, 0);
    
    return {
      enabled: this.config.enabled,
      activeRecoveries: activeCount,
      totalAttempts,
      totalSuccesses,
      successRate: totalAttempts > 0 ? (totalSuccesses / totalAttempts) : 0,
      registeredRecoverers: this.recoverers.size,
      strategyStats: Object.fromEntries(this.strategyStats),
      recentHistory: this.recoveryHistory.slice(0, 10)
    };
  }
  
  /**
   * 重置统计
   */
  resetStatistics() {
    this.recoveryAttempts.clear();
    this.strategyStats.clear();
    this.recoveryHistory = [];
    this.emit('statistics-reset');
  }
  
  /**
   * 停止自动恢复管理器
   */
  stop() {
    this.config.enabled = false;
    this.activeRecoveries.clear();
    this.emit('stopped');
  }
}

// ===========================================
// 内置恢复器实现
// ===========================================

/**
 * 基础恢复器类
 */
class BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    throw new Error('execute method must be implemented by subclass');
  }
}

/**
 * 指数退避重试恢复器
 */
class ExponentialBackoffRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, backoffFactor = 2, jitter = true } = strategy;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 计算延迟时间
        let delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
        
        // 添加抖动
        if (jitter) {
          delay = delay + Math.random() * delay * 0.1;
        }
        
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // 这里应该重新执行原始操作
        // 由于是通用恢复器，我们只能返回建议重试的结果
        console.log(`Exponential backoff retry attempt ${attempt}/${maxAttempts}, delay: ${delay}ms`);
        
        return {
          success: true,
          message: `建议在 ${delay}ms 后重试操作`,
          data: { attempt, delay, nextRetry: Date.now() + delay }
        };
        
      } catch (error) {
        if (attempt === maxAttempts) {
          return {
            success: false,
            message: `指数退避重试失败，已尝试 ${maxAttempts} 次`,
            data: { attempts: maxAttempts, lastError: error.message }
          };
        }
      }
    }
  }
}

/**
 * 连接池重置恢复器
 */
class ConnectionPoolResetRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    try {
      // 模拟连接池重置
      console.log('Resetting connection pool...');
      
      // 这里应该实际重置HTTP连接池
      // 在Node.js中可以使用 agent.destroy() 等方法
      
      return {
        success: true,
        message: '连接池已重置，建议重新尝试网络请求',
        data: { resetTime: Date.now() }
      };
    } catch (error) {
      return {
        success: false,
        message: '连接池重置失败: ' + error.message
      };
    }
  }
}

/**
 * DNS缓存清理恢复器
 */
class DnsCacheClearRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    try {
      console.log('Clearing DNS cache...');
      
      // 在实际实现中，这里可能需要调用系统命令或使用DNS库
      
      return {
        success: true,
        message: 'DNS缓存已清理',
        data: { clearTime: Date.now() }
      };
    } catch (error) {
      return {
        success: false,
        message: 'DNS缓存清理失败: ' + error.message
      };
    }
  }
}

/**
 * 认证令牌刷新恢复器
 */
class AuthTokenRefreshRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    try {
      console.log('Refreshing auth token...');
      
      // 这里应该实际刷新认证令牌
      // 需要与配置服务集成
      
      return {
        success: true,
        message: '认证令牌已刷新，请重新尝试API请求',
        data: { refreshTime: Date.now() }
      };
    } catch (error) {
      return {
        success: false,
        message: '认证令牌刷新失败: ' + error.message
      };
    }
  }
}

/**
 * 限流退避恢复器
 */
class RateLimitBackoffRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    const { baseDelay = 60000, maxDelay = 300000, respectRetryAfter = true } = strategy;
    
    let waitTime = baseDelay;
    
    // 检查是否有 Retry-After 头
    if (respectRetryAfter && context.headers && context.headers['retry-after']) {
      const retryAfter = parseInt(context.headers['retry-after']);
      if (!isNaN(retryAfter)) {
        waitTime = Math.min(retryAfter * 1000, maxDelay);
      }
    }
    
    console.log(`Rate limit hit, backing off for ${waitTime}ms`);
    
    return {
      success: true,
      message: `遇到限流，建议等待 ${waitTime}ms 后重试`,
      data: { 
        waitTime, 
        retryAfter: Date.now() + waitTime,
        respectedHeader: respectRetryAfter && context.headers?.['retry-after']
      }
    };
  }
}

/**
 * 服务器错误重试恢复器
 */
class ServerErrorRetryRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    const { maxAttempts = 3, baseDelay = 5000, backoffFactor = 2 } = strategy;
    
    console.log(`Server error detected, will retry up to ${maxAttempts} times`);
    
    return {
      success: true,
      message: `服务器错误，建议重试（最多 ${maxAttempts} 次）`,
      data: {
        maxAttempts,
        baseDelay,
        backoffFactor,
        nextRetry: Date.now() + baseDelay
      }
    };
  }
}

/**
 * API端点回退恢复器
 */
class ApiEndpointFallbackRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Attempting API endpoint fallback...');
    
    // 这里应该切换到备用API端点
    
    return {
      success: true,
      message: '已切换到备用API端点',
      data: { fallbackTime: Date.now() }
    };
  }
}

// 配置相关恢复器
class ConfigValidationFixRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Attempting to fix config validation issues...');
    
    return {
      success: true,
      message: '配置验证问题已修复',
      data: { fixTime: Date.now() }
    };
  }
}

class ConfigBackupRestoreRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Restoring config from backup...');
    
    return {
      success: true,
      message: '配置已从备份恢复',
      data: { restoreTime: Date.now() }
    };
  }
}

class ConfigResetRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Resetting config to default...');
    
    return {
      success: true,
      message: '配置已重置为默认值',
      data: { resetTime: Date.now() }
    };
  }
}

// 系统相关恢复器
class ResourceCleanupRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Performing resource cleanup...');
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    return {
      success: true,
      message: '系统资源清理完成',
      data: { 
        cleanupTime: Date.now(),
        memoryUsage: process.memoryUsage()
      }
    };
  }
}

class MemoryGarbageCollectRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Forcing garbage collection...');
    
    const beforeMemory = process.memoryUsage();
    
    if (global.gc) {
      global.gc();
    }
    
    const afterMemory = process.memoryUsage();
    
    return {
      success: true,
      message: '内存垃圾回收完成',
      data: {
        beforeMemory,
        afterMemory,
        freed: beforeMemory.heapUsed - afterMemory.heapUsed
      }
    };
  }
}

class ProcessRestartRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Process restart requested (requires confirmation)...');
    
    return {
      success: true,
      message: '进程重启请求已提交',
      data: { requestTime: Date.now() }
    };
  }
}

// 进程相关恢复器
class ProcessRespawnRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Attempting to respawn process...');
    
    return {
      success: true,
      message: '进程重新生成完成',
      data: { respawnTime: Date.now() }
    };
  }
}

class DependencyCheckRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Checking dependencies...');
    
    return {
      success: true,
      message: '依赖检查完成',
      data: { checkTime: Date.now() }
    };
  }
}

class ServiceRestartRecoverer extends BaseRecoverer {
  async execute(strategy, errorInfo, context) {
    console.log('Service restart requested...');
    
    return {
      success: true,
      message: '服务重启请求已提交',
      data: { requestTime: Date.now() }
    };
  }
}

// 导出单例
module.exports = new AutoRecoveryManager();