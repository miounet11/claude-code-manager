'use strict';

const { app } = require('electron');
const path = require('path');
const EventEmitter = require('events');

// 导入错误日志和通知器
const errorLogger = require('./error-logger');
const errorNotifier = require('./error-notifier');

/**
 * 错误类型枚举
 */
const ErrorTypes = {
  NETWORK: 'network',        // 网络错误
  CONFIG: 'config',          // 配置错误
  VALIDATION: 'validation',  // 验证错误
  SYSTEM: 'system',          // 系统错误
  PERMISSION: 'permission',  // 权限错误
  API: 'api',               // API 调用错误
  FILE: 'file',             // 文件操作错误
  PROCESS: 'process',       // 进程错误
  UNKNOWN: 'unknown'        // 未知错误
};

/**
 * 错误严重程度
 */
const ErrorSeverity = {
  INFO: 'info',         // 信息提示
  WARNING: 'warning',   // 警告
  ERROR: 'error',       // 错误
  CRITICAL: 'critical'  // 严重错误
};

/**
 * 统一错误处理器
 */
class ErrorHandler extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.logger = errorLogger;
    this.notifier = errorNotifier;
    
    // 智能错误处理集成 - 默认禁用以避免启动问题
    this.intelligentFeatures = {
      enabled: false,
      predictiveAnalysis: false,
      contextEnrichment: false,
      autoRecovery: false
    };
    
    // 设置全局错误处理
    this.setupGlobalHandlers();
    
    // 初始化智能错误处理集成
    this.initializeIntelligentIntegration();
  }
  
  /**
   * 初始化错误处理器
   */
  initialize(logger, notifier) {
    // 如果提供了新的日志器和通知器，使用它们
    if (logger) this.logger = logger;
    if (notifier) this.notifier = notifier;
    
    // 注册默认处理器
    this.registerDefaultHandlers();
    
    console.log('ErrorHandler initialized with logger and notifier');
  }
  
  /**
   * 设置全局错误处理
   */
  setupGlobalHandlers() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.handle({
        type: ErrorTypes.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        error,
        message: '发生未预期的系统错误',
        detail: error.message,
        stack: error.stack
      });
    });
    
    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.handle({
        type: ErrorTypes.SYSTEM,
        severity: ErrorSeverity.ERROR,
        error: reason,
        message: '异步操作失败',
        detail: reason?.message || String(reason)
      });
    });
  }
  
  /**
   * 注册默认处理器
   */
  registerDefaultHandlers() {
    // 网络错误处理器
    this.register(ErrorTypes.NETWORK, (errorInfo) => {
      errorInfo.suggestion = errorInfo.suggestion || '请检查网络连接和代理设置';
      errorInfo.actions = errorInfo.actions || ['重试', '查看帮助'];
    });
    
    // 配置错误处理器
    this.register(ErrorTypes.CONFIG, (errorInfo) => {
      errorInfo.suggestion = errorInfo.suggestion || '请检查配置项是否正确';
      errorInfo.actions = errorInfo.actions || ['打开配置', '恢复默认'];
    });
    
    // API 错误处理器
    this.register(ErrorTypes.API, (errorInfo) => {
      if (errorInfo.statusCode === 401) {
        errorInfo.message = 'API 认证失败';
        errorInfo.suggestion = '请检查 API Key 是否正确';
      } else if (errorInfo.statusCode === 429) {
        errorInfo.message = 'API 请求过于频繁';
        errorInfo.suggestion = '请稍后再试';
      }
    });
  }
  
  /**
   * 注册错误处理器
   */
  register(type, handler) {
    this.handlers.set(type, handler);
  }
  
  /**
   * 处理错误
   */
  async handle(errorInfo) {
    try {
      // 1. 标准化错误信息
      const normalizedError = this.normalize(errorInfo);
      
      // 2. 执行特定类型的处理器
      const handler = this.handlers.get(normalizedError.type);
      if (handler) {
        await handler(normalizedError);
      }
      
      // 3. 记录日志
      if (this.logger) {
        await this.logger.log(normalizedError);
      }
      
      // 4. 通知用户（如果需要）
      if (this.shouldNotifyUser(normalizedError)) {
        if (this.notifier) {
          await this.notifier.notify(normalizedError);
        }
      }
      
      // 5. 保存到历史
      this.saveToHistory(normalizedError);
      
      // 6. 发出事件
      this.emit('error', normalizedError);
      
      // 7. 统计上报（未来功能）
      // await this.report(normalizedError);
      
    } catch (handlingError) {
      // 错误处理本身出错，记录但不再处理
      console.error('Error in error handler:', handlingError);
    }
  }
  
  /**
   * 标准化错误信息
   */
  normalize(errorInfo) {
    const normalized = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: errorInfo.type || ErrorTypes.UNKNOWN,
      severity: errorInfo.severity || ErrorSeverity.ERROR,
      message: errorInfo.message || '发生错误',
      detail: errorInfo.detail || '',
      stack: errorInfo.stack || (errorInfo.error?.stack) || '',
      context: errorInfo.context || {},
      suggestion: errorInfo.suggestion || '',
      actions: errorInfo.actions || [],
      system: {
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node
      }
    };
    
    // 如果有原始错误对象
    if (errorInfo.error) {
      normalized.originalError = {
        name: errorInfo.error.name,
        message: errorInfo.error.message,
        code: errorInfo.error.code
      };
    }
    
    return normalized;
  }
  
  /**
   * 判断是否需要通知用户
   */
  shouldNotifyUser(errorInfo) {
    // INFO 级别默认不通知
    if (errorInfo.severity === ErrorSeverity.INFO) {
      return false;
    }
    
    // 可以在错误信息中指定 silent: true 来静默处理
    if (errorInfo.context?.silent) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 保存到历史记录
   */
  saveToHistory(errorInfo) {
    this.errorHistory.unshift(errorInfo);
    
    // 限制历史记录大小
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * 生成错误ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取错误历史
   */
  getHistory(filter = {}) {
    let history = [...this.errorHistory];
    
    // 按类型过滤
    if (filter.type) {
      history = history.filter(err => err.type === filter.type);
    }
    
    // 按严重程度过滤
    if (filter.severity) {
      history = history.filter(err => err.severity === filter.severity);
    }
    
    // 按时间范围过滤
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      history = history.filter(err => new Date(err.timestamp).getTime() >= sinceTime);
    }
    
    return history;
  }
  
  /**
   * 清除错误历史
   */
  clearHistory() {
    this.errorHistory = [];
    this.emit('history-cleared');
  }
  
  /**
   * 获取错误统计
   */
  getStatistics() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      bySeverity: {},
      recent24h: 0,
      recentHour: 0
    };
    
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    
    this.errorHistory.forEach(error => {
      // 按类型统计
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // 按严重程度统计
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // 时间统计
      const errorTime = new Date(error.timestamp).getTime();
      if (now - errorTime <= day) {
        stats.recent24h++;
      }
      if (now - errorTime <= hour) {
        stats.recentHour++;
      }
    });
    
    return stats;
  }
  
  /**
   * 初始化智能错误处理集成
   */
  initializeIntelligentIntegration() {
    if (!this.intelligentFeatures.enabled) {
      console.log('Intelligent error handling features are disabled');
      return;
    }
    
    console.log('Initializing intelligent error handling integration...');
    
    try {
      // 设置错误处理增强
      this.setupErrorEnhancement();
      
      // 设置预测分析集成
      if (this.intelligentFeatures.predictiveAnalysis) {
        this.setupPredictiveAnalysis();
      }
      
      // 设置上下文丰富化
      if (this.intelligentFeatures.contextEnrichment) {
        this.setupContextEnrichment();
      }
      
      console.log('Intelligent error handling integration initialized');
      
    } catch (error) {
      console.error('Failed to initialize intelligent integration:', error);
      this.intelligentFeatures.enabled = false;
    }
  }
  
  /**
   * 设置错误处理增强
   */
  setupErrorEnhancement() {
    // 增强错误信息的生成
    const originalNormalize = this.normalize.bind(this);
    
    this.normalize = (errorInfo) => {
      const normalized = originalNormalize(errorInfo);
      
      // 添加智能错误处理标记
      normalized.intelligentProcessing = {
        enabled: this.intelligentFeatures.enabled,
        timestamp: Date.now(),
        features: {
          predictiveAnalysis: this.intelligentFeatures.predictiveAnalysis,
          contextEnrichment: this.intelligentFeatures.contextEnrichment,
          autoRecovery: this.intelligentFeatures.autoRecovery
        }
      };
      
      // 添加错误指纹用于去重和分析
      normalized.fingerprint = this.generateErrorFingerprint(normalized);
      
      return normalized;
    };
  }
  
  /**
   * 设置预测分析集成
   */
  setupPredictiveAnalysis() {
    // 监听自身的错误事件，提供给预测系统
    this.on('error', (errorInfo) => {
      // 这里会被 proxy-server 中的错误预测器监听和处理
      console.log('Error event emitted for predictive analysis:', errorInfo.id);
    });
  }
  
  /**
   * 设置上下文丰富化
   */
  setupContextEnrichment() {
    // 增强错误上下文信息
    const originalHandle = this.handle.bind(this);
    
    this.handle = async (errorInfo) => {
      try {
        // 丰富错误上下文
        const enrichedErrorInfo = await this.enrichErrorContext(errorInfo);
        
        // 执行原始处理
        await originalHandle(enrichedErrorInfo);
        
      } catch (error) {
        console.error('Error in context enrichment:', error);
        // 降级到原始处理
        await originalHandle(errorInfo);
      }
    };
  }
  
  /**
   * 丰富错误上下文
   */
  async enrichErrorContext(errorInfo) {
    const enriched = { ...errorInfo };
    
    try {
      // 添加运行时上下文
      enriched.runtimeContext = {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: Date.now(),
        pid: process.pid
      };
      
      // 添加错误模式信息
      enriched.errorPattern = this.analyzeErrorPattern(errorInfo);
      
      // 添加相似错误信息
      enriched.similarErrors = this.findSimilarErrors(errorInfo);
      
      // 添加系统状态快照
      enriched.systemSnapshot = this.captureSystemSnapshot();
      
    } catch (error) {
      console.error('Failed to enrich error context:', error);
    }
    
    return enriched;
  }
  
  /**
   * 生成错误指纹
   */
  generateErrorFingerprint(errorInfo) {
    const crypto = require('crypto');
    
    // 使用错误类型、消息和关键上下文生成指纹
    const fingerprint_data = [
      errorInfo.type,
      errorInfo.message,
      errorInfo.stack ? errorInfo.stack.split('\n')[0] : '',
      errorInfo.system?.platform || '',
      errorInfo.context?.statusCode || ''
    ].join('|');
    
    return crypto.createHash('md5').update(fingerprint_data).digest('hex');
  }
  
  /**
   * 分析错误模式
   */
  analyzeErrorPattern(errorInfo) {
    const recentSimilar = this.errorHistory
      .filter(e => e.type === errorInfo.type)
      .slice(0, 10);
    
    return {
      frequency: recentSimilar.length,
      firstOccurrence: recentSimilar.length > 0 ? recentSimilar[recentSimilar.length - 1].timestamp : null,
      lastOccurrence: recentSimilar.length > 0 ? recentSimilar[0].timestamp : null,
      isRecurring: recentSimilar.length > 2
    };
  }
  
  /**
   * 查找相似错误
   */
  findSimilarErrors(errorInfo) {
    return this.errorHistory
      .filter(e => 
        e.type === errorInfo.type && 
        e.message === errorInfo.message
      )
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        context: e.context
      }));
  }
  
  /**
   * 捕获系统快照
   */
  captureSystemSnapshot() {
    const os = require('os');
    
    return {
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      uptime: os.uptime(),
      cpuCount: os.cpus().length,
      timestamp: Date.now()
    };
  }
  
  /**
   * 获取错误处理器增强统计
   */
  getEnhancedStatistics() {
    const baseStats = this.getStatistics();
    
    // 添加智能功能统计
    const intelligentStats = {
      ...baseStats,
      intelligentFeatures: {
        enabled: this.intelligentFeatures.enabled,
        predictiveAnalysis: this.intelligentFeatures.predictiveAnalysis,
        contextEnrichment: this.intelligentFeatures.contextEnrichment,
        autoRecovery: this.intelligentFeatures.autoRecovery
      },
      errorPatterns: this.getErrorPatternStats(),
      fingerprints: this.getUniqueErrorCount()
    };
    
    return intelligentStats;
  }
  
  /**
   * 获取错误模式统计
   */
  getErrorPatternStats() {
    const patterns = {};
    
    this.errorHistory.forEach(error => {
      const key = `${error.type}_${error.severity}`;
      if (!patterns[key]) {
        patterns[key] = {
          count: 0,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp
        };
      }
      
      patterns[key].count++;
      patterns[key].lastSeen = Math.max(patterns[key].lastSeen, error.timestamp);
      patterns[key].firstSeen = Math.min(patterns[key].firstSeen, error.timestamp);
    });
    
    return patterns;
  }
  
  /**
   * 获取唯一错误数量
   */
  getUniqueErrorCount() {
    const fingerprints = new Set();
    
    this.errorHistory.forEach(error => {
      if (error.fingerprint) {
        fingerprints.add(error.fingerprint);
      }
    });
    
    return fingerprints.size;
  }
  
  /**
   * 更新智能功能配置
   */
  updateIntelligentFeatures(config) {
    this.intelligentFeatures = {
      ...this.intelligentFeatures,
      ...config
    };
    
    console.log('Intelligent features configuration updated:', this.intelligentFeatures);
    this.emit('intelligent-config-updated', this.intelligentFeatures);
  }
}

// 导出单例
const errorHandler = new ErrorHandler();

module.exports = {
  errorHandler,
  ErrorTypes,
  ErrorSeverity
};