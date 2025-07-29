'use strict';

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const { ErrorTypes, ErrorSeverity } = require('./error-handler');

/**
 * 上下文分析规则定义
 */
const AnalysisRules = {
  // 环境上下文分析
  ENVIRONMENT_CONTEXT: {
    name: 'environment_context',
    factors: [
      'platform', 'arch', 'nodeVersion', 'electronVersion', 
      'totalMemory', 'availableMemory', 'cpuCores', 'osVersion'
    ],
    weight: 0.2
  },
  
  // 时间上下文分析
  TEMPORAL_CONTEXT: {
    name: 'temporal_context',
    factors: [
      'timeOfDay', 'dayOfWeek', 'timeSinceStart', 'errorFrequency',
      'recentActivity', 'sessionDuration'
    ],
    weight: 0.15
  },
  
  // 应用状态上下文
  APPLICATION_CONTEXT: {
    name: 'application_context',
    factors: [
      'proxyServerStatus', 'activeConnections', 'configurationState',
      'lastConfigChange', 'pendingRequests', 'cacheStatus'
    ],
    weight: 0.25
  },
  
  // 用户行为上下文
  USER_BEHAVIOR_CONTEXT: {
    name: 'user_behavior_context',
    factors: [
      'lastUserAction', 'actionSequence', 'usagePattern',
      'configChanges', 'errorAcknowledgments'
    ],
    weight: 0.2
  },
  
  // 技术栈上下文
  TECHNICAL_CONTEXT: {
    name: 'technical_context',
    factors: [
      'dependencyVersions', 'moduleLoading', 'processHealth',
      'networkConditions', 'fileSystemState'
    ],
    weight: 0.18
  }
};

/**
 * 上下文相关性权重
 */
const ContextRelevance = {
  [ErrorTypes.NETWORK]: {
    ENVIRONMENT_CONTEXT: 0.3,
    TEMPORAL_CONTEXT: 0.1,
    APPLICATION_CONTEXT: 0.4,
    USER_BEHAVIOR_CONTEXT: 0.1,
    TECHNICAL_CONTEXT: 0.1
  },
  [ErrorTypes.CONFIG]: {
    ENVIRONMENT_CONTEXT: 0.2,
    TEMPORAL_CONTEXT: 0.1,
    APPLICATION_CONTEXT: 0.3,
    USER_BEHAVIOR_CONTEXT: 0.3,
    TECHNICAL_CONTEXT: 0.1
  },
  [ErrorTypes.API]: {
    ENVIRONMENT_CONTEXT: 0.1,
    TEMPORAL_CONTEXT: 0.2,
    APPLICATION_CONTEXT: 0.5,
    USER_BEHAVIOR_CONTEXT: 0.1,
    TECHNICAL_CONTEXT: 0.1
  },
  [ErrorTypes.SYSTEM]: {
    ENVIRONMENT_CONTEXT: 0.4,
    TEMPORAL_CONTEXT: 0.1,
    APPLICATION_CONTEXT: 0.2,
    USER_BEHAVIOR_CONTEXT: 0.1,
    TECHNICAL_CONTEXT: 0.2
  },
  [ErrorTypes.PROCESS]: {
    ENVIRONMENT_CONTEXT: 0.3,
    TEMPORAL_CONTEXT: 0.1,
    APPLICATION_CONTEXT: 0.2,
    USER_BEHAVIOR_CONTEXT: 0.1,
    TECHNICAL_CONTEXT: 0.3
  }
};

/**
 * 智能上下文分析器
 * 分析错误发生时的系统、应用和用户上下文，提供深度洞察
 */
class ContextAnalyzer extends EventEmitter {
  constructor() {
    super();
    
    // 分析状态
    this.contextCache = new Map();
    this.analysisHistory = [];
    this.maxHistorySize = 500;
    
    // 上下文收集器
    this.contextCollectors = new Map();
    
    // 行为模式跟踪
    this.behaviorPatterns = new Map();
    this.anomalyDetector = new AnomalyDetector();
    
    // 配置
    this.config = {
      enabled: true,
      enableDeepAnalysis: true,
      cacheExpiry: 60000, // 1分钟缓存过期
      maxConcurrentAnalysis: 3,
      behaviorTrackingEnabled: true,
      anomalyDetectionEnabled: true,
      confidenceThreshold: 0.7
    };
    
    // 分析状态
    this.activeAnalysis = new Map();
    this.startTime = Date.now();
    
    // 初始化上下文收集器
    this.initializeContextCollectors();
    
    console.log('ContextAnalyzer initialized with', Object.keys(AnalysisRules).length, 'analysis rules');
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
  
  /**
   * 分析错误上下文
   */
  async analyzeContext(errorInfo, additionalContext = {}) {
    if (!this.config.enabled) {
      return { analyzed: false, reason: 'context analyzer disabled' };
    }
    
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // 检查并发分析限制
      if (this.activeAnalysis.size >= this.config.maxConcurrentAnalysis) {
        return { analyzed: false, reason: 'too many concurrent analyses' };
      }
      
      // 标记分析开始
      this.activeAnalysis.set(analysisId, {
        errorInfo,
        startTime,
        status: 'analyzing'
      });
      
      // 1. 收集全面的上下文信息
      const contextData = await this.collectContext(errorInfo, additionalContext);
      
      // 2. 执行多维度分析
      const analysisResults = await this.performMultiDimensionalAnalysis(
        errorInfo, 
        contextData
      );
      
      // 3. 识别异常模式
      const anomalies = this.config.anomalyDetectionEnabled 
        ? await this.detectAnomalies(contextData, errorInfo)
        : [];
      
      // 4. 生成行为洞察
      const behaviorInsights = this.config.behaviorTrackingEnabled
        ? await this.analyzeBehaviorPatterns(contextData, errorInfo)
        : [];
      
      // 5. 计算相关性和置信度
      const relevanceAnalysis = this.calculateRelevance(analysisResults, errorInfo);
      
      // 6. 生成建议和洞察
      const insights = this.generateInsights(
        analysisResults, 
        anomalies, 
        behaviorInsights, 
        relevanceAnalysis
      );
      
      const result = {
        analyzed: true,
        analysisId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        errorInfo: {
          id: errorInfo.id,
          type: errorInfo.type,
          severity: errorInfo.severity
        },
        contextData,
        analysisResults,
        anomalies,
        behaviorInsights,
        relevanceAnalysis,
        insights,
        confidence: this.calculateOverallConfidence(analysisResults, relevanceAnalysis)
      };
      
      // 7. 记录分析历史
      this.recordAnalysis(result);
      
      // 8. 更新行为模式
      if (this.config.behaviorTrackingEnabled) {
        this.updateBehaviorPatterns(contextData, errorInfo);
      }
      
      this.emit('analysis-completed', result);
      
      return result;
      
    } catch (error) {
      console.error('Context analysis failed:', error);
      
      return {
        analyzed: false,
        error: error.message,
        analysisId,
        duration: Date.now() - startTime
      };
      
    } finally {
      // 清理活动分析记录
      this.activeAnalysis.delete(analysisId);
    }
  }
  
  /**
   * 收集上下文信息
   */
  async collectContext(errorInfo, additionalContext) {
    const contextData = {
      timestamp: Date.now(),
      environment: await this.collectEnvironmentContext(),
      temporal: await this.collectTemporalContext(),
      application: await this.collectApplicationContext(),
      userBehavior: await this.collectUserBehaviorContext(errorInfo),
      technical: await this.collectTechnicalContext(),
      error: this.extractErrorContext(errorInfo),
      additional: additionalContext
    };
    
    return contextData;
  }
  
  /**
   * 收集环境上下文
   */
  async collectEnvironmentContext() {
    const cacheKey = 'environment_context';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    const context = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCores: os.cpus().length,
      osVersion: os.release(),
      hostname: os.hostname(),
      userInfo: os.userInfo(),
      networkInterfaces: this.sanitizeNetworkInterfaces(os.networkInterfaces()),
      environmentVars: this.sanitizeEnvironmentVars(process.env)
    };
    
    this.setCache(cacheKey, context, 300000); // 5分钟缓存
    return context;
  }
  
  /**
   * 收集时间上下文
   */
  async collectTemporalContext() {
    const now = Date.now();
    const date = new Date(now);
    
    return {
      timestamp: now,
      timeOfDay: date.getHours(),
      dayOfWeek: date.getDay(),
      date: date.toISOString().split('T')[0],
      timeSinceStart: now - this.startTime,
      sessionDuration: process.uptime() * 1000,
      timezone: date.getTimezoneOffset(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isBusinessHours: this.isBusinessHours(date),
      recentErrorCount: this.getRecentErrorCount(300000) // 5分钟内错误数
    };
  }
  
  /**
   * 收集应用程序上下文
   */
  async collectApplicationContext() {
    try {
      return {
        proxyServerStatus: await this.getProxyServerStatus(),
        configurationState: await this.getConfigurationState(),
        activeConnections: await this.getActiveConnections(),
        cacheStatus: await this.getCacheStatus(),
        pendingRequests: await this.getPendingRequests(),
        memoryUsage: process.memoryUsage(),
        moduleLoadTime: this.getModuleLoadTime(),
        lastConfigChange: this.getLastConfigChange()
      };
    } catch (error) {
      console.error('Failed to collect application context:', error);
      return { error: error.message };
    }
  }
  
  /**
   * 收集用户行为上下文
   */
  async collectUserBehaviorContext(errorInfo) {
    return {
      lastUserAction: this.getLastUserAction(),
      recentActionSequence: this.getRecentActionSequence(10),
      usagePattern: this.getUserUsagePattern(),
      configChanges: this.getRecentConfigChanges(3600000), // 1小时内配置变更
      errorAcknowledgments: this.getErrorAcknowledgments(),
      sessionActivity: this.getSessionActivity(),
      interactionFrequency: this.getInteractionFrequency()
    };
  }
  
  /**
   * 收集技术上下文
   */
  async collectTechnicalContext() {
    return {
      dependencyVersions: this.getDependencyVersions(),
      moduleLoadingStatus: this.getModuleLoadingStatus(),
      processHealth: this.getProcessHealth(),
      networkConditions: await this.getNetworkConditions(),
      fileSystemState: await this.getFileSystemState(),
      threadPoolInfo: this.getThreadPoolInfo(),
      gcInfo: this.getGCInfo()
    };
  }
  
  /**
   * 提取错误上下文
   */
  extractErrorContext(errorInfo) {
    return {
      id: errorInfo.id,
      type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      detail: errorInfo.detail,
      stack: errorInfo.stack ? errorInfo.stack.split('\n').slice(0, 5) : [], // 只保留前5行
      context: errorInfo.context,
      system: errorInfo.system,
      timestamp: errorInfo.timestamp,
      hasRetried: this.hasErrorBeenRetried(errorInfo),
      similarRecentErrors: this.findSimilarRecentErrors(errorInfo, 600000) // 10分钟内相似错误
    };
  }
  
  /**
   * 执行多维度分析
   */
  async performMultiDimensionalAnalysis(errorInfo, contextData) {
    const results = {};
    
    for (const [ruleName, rule] of Object.entries(AnalysisRules)) {
      try {
        const analysisResult = await this.analyzeContextDimension(
          rule, 
          contextData, 
          errorInfo
        );
        
        results[ruleName] = {
          ...analysisResult,
          weight: rule.weight,
          relevance: this.calculateDimensionRelevance(ruleName, errorInfo.type)
        };
        
      } catch (error) {
        console.error(`Failed to analyze dimension ${ruleName}:`, error);
        results[ruleName] = {
          success: false,
          error: error.message,
          weight: rule.weight,
          relevance: 0
        };
      }
    }
    
    return results;
  }
  
  /**
   * 分析上下文维度
   */
  async analyzeContextDimension(rule, contextData, errorInfo) {
    const relevantData = this.extractRelevantData(rule.factors, contextData);
    const patterns = this.identifyPatterns(relevantData, rule.name);
    const significance = this.calculateSignificance(relevantData, patterns, errorInfo);
    
    return {
      success: true,
      rule: rule.name,
      relevantData,
      patterns,
      significance,
      insights: this.generateDimensionInsights(rule.name, relevantData, patterns, significance)
    };
  }
  
  /**
   * 提取相关数据
   */
  extractRelevantData(factors, contextData) {
    const relevantData = {};
    
    for (const factor of factors) {
      const value = this.extractNestedValue(contextData, factor);
      if (value !== undefined) {
        relevantData[factor] = value;
      }
    }
    
    return relevantData;
  }
  
  /**
   * 提取嵌套值
   */
  extractNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  /**
   * 识别模式
   */
  identifyPatterns(data, dimensionName) {
    const patterns = [];
    
    // 基于维度类型识别不同的模式
    switch (dimensionName) {
      case 'environment_context':
        patterns.push(...this.identifyEnvironmentPatterns(data));
        break;
      case 'temporal_context':
        patterns.push(...this.identifyTemporalPatterns(data));
        break;
      case 'application_context':
        patterns.push(...this.identifyApplicationPatterns(data));
        break;
      case 'user_behavior_context':
        patterns.push(...this.identifyBehaviorPatterns(data));
        break;
      case 'technical_context':
        patterns.push(...this.identifyTechnicalPatterns(data));
        break;
    }
    
    return patterns;
  }
  
  /**
   * 识别环境模式
   */
  identifyEnvironmentPatterns(data) {
    const patterns = [];
    
    // 内存压力模式
    if (data.totalMemory && data.freeMemory) {
      const memoryUsage = 1 - (data.freeMemory / data.totalMemory);
      if (memoryUsage > 0.8) {
        patterns.push({
          type: 'memory_pressure',
          severity: memoryUsage > 0.95 ? 'critical' : 'warning',
          value: memoryUsage,
          description: `系统内存使用率高达 ${(memoryUsage * 100).toFixed(1)}%`
        });
      }
    }
    
    // 平台特定模式
    if (data.platform === 'darwin' && data.osVersion) {
      patterns.push({
        type: 'platform_specific',
        platform: 'macOS',
        version: data.osVersion,
        description: `运行在 macOS ${data.osVersion} 上`
      });
    }
    
    return patterns;
  }
  
  /**
   * 识别时间模式
   */
  identifyTemporalPatterns(data) {
    const patterns = [];
    
    // 工作时间外模式
    if (!data.isBusinessHours) {
      patterns.push({
        type: 'off_hours',
        timeOfDay: data.timeOfDay,
        description: '错误发生在非工作时间'
      });
    }
    
    // 高频错误模式
    if (data.recentErrorCount > 5) {
      patterns.push({
        type: 'high_frequency_errors',
        count: data.recentErrorCount,
        severity: data.recentErrorCount > 20 ? 'critical' : 'warning',
        description: `最近5分钟内发生了 ${data.recentErrorCount} 个错误`
      });
    }
    
    // 启动后短时间模式
    if (data.timeSinceStart < 60000) { // 1分钟内
      patterns.push({
        type: 'early_startup_error',
        timeSinceStart: data.timeSinceStart,
        description: '应用启动后不久发生错误'
      });
    }
    
    return patterns;
  }
  
  /**
   * 识别应用程序模式
   */
  identifyApplicationPatterns(data) {
    const patterns = [];
    
    // 内存泄漏模式
    if (data.memoryUsage) {
      const heapUsed = data.memoryUsage.heapUsed;
      const heapTotal = data.memoryUsage.heapTotal;
      
      if (heapUsed / heapTotal > 0.9) {
        patterns.push({
          type: 'memory_leak_suspect',
          heapUsage: heapUsed / heapTotal,
          description: 'JS堆内存使用率异常高，可能存在内存泄漏'
        });
      }
    }
    
    // 配置状态模式
    if (data.configurationState && data.configurationState.lastChange) {
      const timeSinceChange = Date.now() - data.configurationState.lastChange;
      if (timeSinceChange < 300000) { // 5分钟内
        patterns.push({
          type: 'recent_config_change',
          timeSinceChange,
          description: '错误发生在配置更改后不久'
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * 识别行为模式
   */
  identifyBehaviorPatterns(data) {
    const patterns = [];
    
    // 用户交互异常模式
    if (data.interactionFrequency && data.interactionFrequency < 0.1) {
      patterns.push({
        type: 'low_user_interaction',
        frequency: data.interactionFrequency,
        description: '用户交互频率异常低'
      });
    }
    
    // 配置频繁更改模式
    if (data.configChanges && data.configChanges.length > 3) {
      patterns.push({
        type: 'frequent_config_changes',
        changeCount: data.configChanges.length,
        description: '最近配置更改频繁'
      });
    }
    
    return patterns;
  }
  
  /**
   * 识别技术模式
   */
  identifyTechnicalPatterns(data) {
    const patterns = [];
    
    // 网络条件模式
    if (data.networkConditions && data.networkConditions.latency > 1000) {
      patterns.push({
        type: 'high_network_latency',
        latency: data.networkConditions.latency,
        description: `网络延迟过高: ${data.networkConditions.latency}ms`
      });
    }
    
    // 进程健康模式
    if (data.processHealth && data.processHealth.eventLoopDelay > 100) {
      patterns.push({
        type: 'event_loop_congestion',
        delay: data.processHealth.eventLoopDelay,
        description: `事件循环阻塞严重: ${data.processHealth.eventLoopDelay}ms`
      });
    }
    
    return patterns;
  }
  
  /**
   * 计算意义度
   */
  calculateSignificance(relevantData, patterns, errorInfo) {
    let significance = 0;
    
    // 基于模式数量和严重程度
    for (const pattern of patterns) {
      let patternWeight = 0.1;
      
      if (pattern.severity === 'critical') {
        patternWeight = 0.3;
      } else if (pattern.severity === 'warning') {
        patternWeight = 0.2;
      }
      
      significance += patternWeight;
    }
    
    // 基于数据完整性
    const dataCompleteness = Object.keys(relevantData).length / 10; // 假设最多10个因子
    significance *= Math.min(dataCompleteness, 1.0);
    
    return Math.min(significance, 1.0);
  }
  
  /**
   * 生成维度洞察
   */
  generateDimensionInsights(dimensionName, relevantData, patterns, significance) {
    const insights = [];
    
    // 基于模式生成洞察
    for (const pattern of patterns) {
      insights.push({
        type: 'pattern_insight',
        pattern: pattern.type,
        description: pattern.description,
        severity: pattern.severity || 'info',
        recommendation: this.generatePatternRecommendation(pattern)
      });
    }
    
    // 基于意义度生成洞察
    if (significance > 0.7) {
      insights.push({
        type: 'high_significance',
        significance,
        description: `${dimensionName} 与错误高度相关`,
        recommendation: '需要重点关注此维度的问题'
      });
    }
    
    return insights;
  }
  
  /**
   * 生成模式建议
   */
  generatePatternRecommendation(pattern) {
    const recommendations = {
      memory_pressure: '考虑增加系统内存或优化内存使用',
      memory_leak_suspect: '检查代码中的内存泄漏，特别是事件监听器和定时器',
      high_network_latency: '检查网络连接质量，考虑使用本地缓存',
      event_loop_congestion: '检查阻塞的同步操作，考虑使用异步方式',
      recent_config_change: '验证最近的配置更改是否正确',
      high_frequency_errors: '立即检查系统状态，可能需要紧急处理',
      early_startup_error: '检查应用初始化逻辑和依赖项',
      off_hours: '考虑是否有定时任务或外部系统在此时间段运行'
    };
    
    return recommendations[pattern.type] || '需要进一步调查此模式';
  }
  
  /**
   * 检测异常
   */
  async detectAnomalies(contextData, errorInfo) {
    return this.anomalyDetector.detect(contextData, errorInfo);
  }
  
  /**
   * 分析行为模式
   */
  async analyzeBehaviorPatterns(contextData, errorInfo) {
    const insights = [];
    
    // 分析用户行为异常
    const behaviorAnomalies = this.detectBehaviorAnomalies(contextData.userBehavior);
    insights.push(...behaviorAnomalies);
    
    // 分析系统使用模式
    const usagePatterns = this.analyzeUsagePatterns(contextData);
    insights.push(...usagePatterns);
    
    return insights;
  }
  
  /**
   * 检测行为异常
   */
  detectBehaviorAnomalies(behaviorData) {
    const anomalies = [];
    
    // 检测交互频率异常
    if (behaviorData.interactionFrequency) {
      const avgFrequency = this.getAverageInteractionFrequency();
      const deviation = Math.abs(behaviorData.interactionFrequency - avgFrequency) / avgFrequency;
      
      if (deviation > 0.5) {
        anomalies.push({
          type: 'interaction_frequency_anomaly',
          current: behaviorData.interactionFrequency,
          average: avgFrequency,
          deviation,
          description: '用户交互频率异常'
        });
      }
    }
    
    return anomalies;
  }
  
  /**
   * 分析使用模式
   */
  analyzeUsagePatterns(contextData) {
    const patterns = [];
    
    // 分析时间使用模式
    if (contextData.temporal) {
      const timePattern = this.analyzeTimeUsagePattern(contextData.temporal);
      if (timePattern) {
        patterns.push(timePattern);
      }
    }
    
    return patterns;
  }
  
  /**
   * 分析时间使用模式
   */
  analyzeTimeUsagePattern(temporalData) {
    // 简化的时间模式分析
    if (temporalData.isWeekend && temporalData.timeOfDay < 8) {
      return {
        type: 'weekend_early_usage',
        description: '周末早期使用模式',
        insight: '用户在周末早晨使用应用，可能是特殊需求'
      };
    }
    
    return null;
  }
  
  /**
   * 计算相关性
   */
  calculateRelevance(analysisResults, errorInfo) {
    const errorTypeRelevance = ContextRelevance[errorInfo.type] || {};
    const relevanceScores = {};
    let totalRelevance = 0;
    
    for (const [dimensionName, result] of Object.entries(analysisResults)) {
      const baseRelevance = errorTypeRelevance[dimensionName] || 0.1;
      const significanceBoost = result.significance || 0;
      const patternBoost = result.patterns ? result.patterns.length * 0.1 : 0;
      
      const relevanceScore = Math.min(
        baseRelevance + significanceBoost * 0.3 + patternBoost,
        1.0
      );
      
      relevanceScores[dimensionName] = relevanceScore;
      totalRelevance += relevanceScore * result.weight;
    }
    
    return {
      scores: relevanceScores,
      total: totalRelevance,
      normalized: totalRelevance / Object.keys(analysisResults).length
    };
  }
  
  /**
   * 计算维度相关性
   */
  calculateDimensionRelevance(dimensionName, errorType) {
    const relevanceMap = ContextRelevance[errorType];
    return relevanceMap ? relevanceMap[dimensionName] || 0.1 : 0.1;
  }
  
  /**
   * 生成洞察
   */
  generateInsights(analysisResults, anomalies, behaviorInsights, relevanceAnalysis) {
    const insights = {
      summary: this.generateSummaryInsight(analysisResults, relevanceAnalysis),
      detailed: this.generateDetailedInsights(analysisResults),
      anomalies: anomalies,
      behaviors: behaviorInsights,
      recommendations: this.generateRecommendations(analysisResults, anomalies),
      prioritizedActions: this.prioritizeActions(analysisResults, relevanceAnalysis)
    };
    
    return insights;
  }
  
  /**
   * 生成摘要洞察
   */
  generateSummaryInsight(analysisResults, relevanceAnalysis) {
    const highRelevanceDimensions = Object.entries(relevanceAnalysis.scores)
      .filter(([_, score]) => score > 0.6)
      .map(([dimension, _]) => dimension);
    
    const criticalPatterns = Object.values(analysisResults)
      .flatMap(result => result.patterns || [])
      .filter(pattern => pattern.severity === 'critical');
    
    return {
      primaryFactors: highRelevanceDimensions,
      criticalIssues: criticalPatterns.length,
      overallRelevance: relevanceAnalysis.normalized,
      confidence: this.calculateOverallConfidence(analysisResults, relevanceAnalysis),
      riskLevel: this.calculateRiskLevel(criticalPatterns.length, relevanceAnalysis.normalized)
    };
  }
  
  /**
   * 生成详细洞察
   */
  generateDetailedInsights(analysisResults) {
    const insights = [];
    
    for (const [dimensionName, result] of Object.entries(analysisResults)) {
      if (result.success && result.insights) {
        insights.push({
          dimension: dimensionName,
          insights: result.insights,
          significance: result.significance,
          patterns: result.patterns
        });
      }
    }
    
    return insights.sort((a, b) => (b.significance || 0) - (a.significance || 0));
  }
  
  /**
   * 生成建议
   */
  generateRecommendations(analysisResults, anomalies) {
    const recommendations = [];
    
    // 基于分析结果生成建议
    for (const result of Object.values(analysisResults)) {
      if (result.insights) {
        for (const insight of result.insights) {
          if (insight.recommendation) {
            recommendations.push({
              type: 'analysis_based',
              priority: insight.severity === 'critical' ? 'high' : 'medium',
              recommendation: insight.recommendation,
              source: insight.pattern || 'general_analysis'
            });
          }
        }
      }
    }
    
    // 基于异常生成建议
    for (const anomaly of anomalies) {
      recommendations.push({
        type: 'anomaly_based',
        priority: 'high',
        recommendation: `处理异常: ${anomaly.description}`,
        source: anomaly.type
      });
    }
    
    return recommendations;
  }
  
  /**
   * 优先级排序行动
   */
  prioritizeActions(analysisResults, relevanceAnalysis) {
    const actions = [];
    
    // 收集所有可能的行动
    for (const [dimensionName, result] of Object.entries(analysisResults)) {
      const relevance = relevanceAnalysis.scores[dimensionName] || 0;
      
      if (result.patterns) {
        for (const pattern of result.patterns) {
          actions.push({
            action: `处理 ${pattern.type} 模式`,
            priority: this.calculateActionPriority(pattern, relevance),
            dimension: dimensionName,
            pattern: pattern.type,
            description: pattern.description
          });
        }
      }
    }
    
    // 按优先级排序
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }
  
  /**
   * 计算行动优先级
   */
  calculateActionPriority(pattern, relevance) {
    let priority = relevance * 0.5;
    
    if (pattern.severity === 'critical') {
      priority += 0.4;
    } else if (pattern.severity === 'warning') {
      priority += 0.2;
    }
    
    return Math.min(priority, 1.0);
  }
  
  /**
   * 计算总体置信度
   */
  calculateOverallConfidence(analysisResults, relevanceAnalysis) {
    const successfulAnalyses = Object.values(analysisResults).filter(r => r.success);
    const completeness = successfulAnalyses.length / Object.keys(analysisResults).length;
    
    const avgSignificance = successfulAnalyses.reduce((sum, r) => 
      sum + (r.significance || 0), 0) / successfulAnalyses.length;
    
    return (completeness * 0.4 + avgSignificance * 0.3 + relevanceAnalysis.normalized * 0.3);
  }
  
  /**
   * 计算风险等级
   */
  calculateRiskLevel(criticalIssues, relevance) {
    if (criticalIssues > 2 || relevance > 0.8) return 'high';
    if (criticalIssues > 0 || relevance > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * 记录分析结果
   */
  recordAnalysis(result) {
    this.analysisHistory.unshift({
      id: result.analysisId,
      timestamp: result.timestamp,
      errorType: result.errorInfo.type,
      confidence: result.confidence,
      riskLevel: result.insights.summary.riskLevel,
      duration: result.duration
    });
    
    // 限制历史记录大小
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.length = this.maxHistorySize;
    }
  }
  
  /**
   * 更新行为模式
   */
  updateBehaviorPatterns(contextData, errorInfo) {
    const patternKey = `${errorInfo.type}_${contextData.temporal.timeOfDay}`;
    
    if (!this.behaviorPatterns.has(patternKey)) {
      this.behaviorPatterns.set(patternKey, {
        count: 0,
        contexts: []
      });
    }
    
    const pattern = this.behaviorPatterns.get(patternKey);
    pattern.count++;
    pattern.contexts.push({
      timestamp: Date.now(),
      context: {
        timeOfDay: contextData.temporal.timeOfDay,
        memoryUsage: contextData.application.memoryUsage,
        userActivity: contextData.userBehavior.interactionFrequency
      }
    });
    
    // 限制上下文历史
    if (pattern.contexts.length > 50) {
      pattern.contexts = pattern.contexts.slice(-50);
    }
  }
  
  // ========================================
  // 辅助方法实现
  // ========================================
  
  /**
   * 缓存相关方法
   */
  getFromCache(key) {
    const cached = this.contextCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
      return cached.data;
    }
    return null;
  }
  
  setCache(key, data, customExpiry = null) {
    this.contextCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: customExpiry || this.config.cacheExpiry
    });
  }
  
  /**
   * 工具方法
   */
  sanitizeNetworkInterfaces(interfaces) {
    // 移除敏感信息，只保留基本网络状态
    const sanitized = {};
    for (const [name, details] of Object.entries(interfaces)) {
      sanitized[name] = details.map(detail => ({
        family: detail.family,
        internal: detail.internal
      }));
    }
    return sanitized;
  }
  
  sanitizeEnvironmentVars(env) {
    // 只保留非敏感的环境变量
    const safe = {};
    const safeKeys = ['NODE_ENV', 'PLATFORM', 'ARCH', 'HOME', 'PATH'];
    
    for (const key of safeKeys) {
      if (env[key]) {
        safe[key] = key === 'PATH' ? 'REDACTED' : env[key];
      }
    }
    
    return safe;
  }
  
  isBusinessHours(date) {
    const hour = date.getHours();
    const day = date.getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }
  
  getRecentErrorCount(timeWindow) {
    // 这里应该从错误处理器获取实际数据
    return Math.floor(Math.random() * 10); // 模拟数据
  }
  
  // 占位符方法 - 实际实现需要与其他服务集成
  async getProxyServerStatus() {
    return { status: 'running', connections: 5 };
  }
  
  async getConfigurationState() {
    return { valid: true, lastChange: Date.now() - 600000 };
  }
  
  async getActiveConnections() {
    return 3;
  }
  
  async getCacheStatus() {
    return { size: 50, hitRate: 0.8 };
  }
  
  async getPendingRequests() {
    return 2;
  }
  
  getModuleLoadTime() {
    return 1500; // ms
  }
  
  getLastConfigChange() {
    return Date.now() - 1800000; // 30分钟前
  }
  
  getLastUserAction() {
    return { type: 'config_update', timestamp: Date.now() - 120000 };
  }
  
  getRecentActionSequence(count) {
    return []; // 模拟数据
  }
  
  getUserUsagePattern() {
    return 'normal';
  }
  
  getRecentConfigChanges(timeWindow) {
    return [];
  }
  
  getErrorAcknowledgments() {
    return [];
  }
  
  getSessionActivity() {
    return { active: true, lastActivity: Date.now() - 60000 };
  }
  
  getInteractionFrequency() {
    return 0.5; // 每秒0.5次交互
  }
  
  getDependencyVersions() {
    return { electron: process.versions.electron, node: process.version };
  }
  
  getModuleLoadingStatus() {
    return { loaded: 25, failed: 0 };
  }
  
  getProcessHealth() {
    return { healthy: true, eventLoopDelay: 5 };
  }
  
  async getNetworkConditions() {
    return { latency: 50, bandwidth: 'high' };
  }
  
  async getFileSystemState() {
    return { accessible: true, permissions: 'rw' };
  }
  
  getThreadPoolInfo() {
    return { size: 4, active: 1 };
  }
  
  getGCInfo() {
    return { lastGC: Date.now() - 30000, type: 'minor' };
  }
  
  hasErrorBeenRetried(errorInfo) {
    return false; // 模拟数据
  }
  
  findSimilarRecentErrors(errorInfo, timeWindow) {
    return []; // 模拟数据
  }
  
  getAverageInteractionFrequency() {
    return 0.3; // 模拟数据
  }
  
  /**
   * 初始化上下文收集器
   */
  initializeContextCollectors() {
    // 初始化各种上下文收集器
    console.log('Context collectors initialized');
  }
  
  /**
   * 获取统计信息
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      totalAnalyses: this.analysisHistory.length,
      activeAnalyses: this.activeAnalysis.size,
      behaviorPatterns: this.behaviorPatterns.size,
      cacheSize: this.contextCache.size,
      averageAnalysisTime: this.calculateAverageAnalysisTime(),
      config: { ...this.config }
    };
  }
  
  calculateAverageAnalysisTime() {
    if (this.analysisHistory.length === 0) return 0;
    
    const totalTime = this.analysisHistory
      .slice(0, 100) // 最近100次分析
      .reduce((sum, analysis) => sum + (analysis.duration || 0), 0);
    
    return totalTime / Math.min(this.analysisHistory.length, 100);
  }
  
  /**
   * 清理缓存和历史
   */
  cleanup() {
    const now = Date.now();
    
    // 清理过期缓存
    for (const [key, cached] of this.contextCache.entries()) {
      if (now - cached.timestamp > cached.expiry) {
        this.contextCache.delete(key);
      }
    }
    
    // 清理行为模式
    for (const [key, pattern] of this.behaviorPatterns.entries()) {
      pattern.contexts = pattern.contexts.filter(
        ctx => now - ctx.timestamp < 86400000 // 24小时
      );
      
      if (pattern.contexts.length === 0) {
        this.behaviorPatterns.delete(key);
      }
    }
  }
}

/**
 * 异常检测器
 */
class AnomalyDetector {
  detect(contextData, errorInfo) {
    const anomalies = [];
    
    // 检测内存异常
    if (contextData.application && contextData.application.memoryUsage) {
      const memoryAnomaly = this.detectMemoryAnomaly(contextData.application.memoryUsage);
      if (memoryAnomaly) {
        anomalies.push(memoryAnomaly);
      }
    }
    
    // 检测时间异常
    if (contextData.temporal) {
      const timeAnomaly = this.detectTimeAnomaly(contextData.temporal);
      if (timeAnomaly) {
        anomalies.push(timeAnomaly);
      }
    }
    
    return anomalies;
  }
  
  detectMemoryAnomaly(memoryUsage) {
    const heapUsed = memoryUsage.heapUsed;
    const heapTotal = memoryUsage.heapTotal;
    
    if (heapUsed / heapTotal > 0.95) {
      return {
        type: 'memory_anomaly',
        description: 'JS堆内存使用率异常高',
        severity: 'critical',
        value: heapUsed / heapTotal,
        threshold: 0.95
      };
    }
    
    return null;
  }
  
  detectTimeAnomaly(temporalData) {
    // 检测非正常时间的高频错误
    if (!temporalData.isBusinessHours && temporalData.recentErrorCount > 10) {
      return {
        type: 'time_anomaly',
        description: '非工作时间出现异常高频错误',
        severity: 'warning',
        value: temporalData.recentErrorCount,
        context: {
          timeOfDay: temporalData.timeOfDay,
          isWeekend: temporalData.isWeekend
        }
      };
    }
    
    return null;
  }
}

// 导出单例
module.exports = new ContextAnalyzer();