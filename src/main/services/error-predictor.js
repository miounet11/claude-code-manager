'use strict';

const EventEmitter = require('events');
const { ErrorTypes, ErrorSeverity } = require('./error-handler');

/**
 * 错误模式定义
 */
const ErrorPatterns = {
  // 网络错误模式
  NETWORK_INSTABILITY: {
    type: ErrorTypes.NETWORK,
    indicators: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
    threshold: 3, // 3次相同错误触发预测
    timeWindow: 300000, // 5分钟内
    prediction: '网络不稳定，可能即将出现更严重的连接问题'
  },
  
  // API限流模式
  API_RATE_LIMITING: {
    type: ErrorTypes.API,
    indicators: ['429', 'rate limit', 'quota exceeded'],
    threshold: 2,
    timeWindow: 60000, // 1分钟内
    prediction: 'API请求频率过高，可能触发限流保护'
  },
  
  // 配置错误模式
  CONFIG_CORRUPTION: {
    type: ErrorTypes.CONFIG,
    indicators: ['parse error', 'invalid config', 'missing property'],
    threshold: 2,
    timeWindow: 30000, // 30秒内
    prediction: '配置文件可能损坏，建议检查或重置配置'
  },
  
  // 系统资源不足模式
  RESOURCE_EXHAUSTION: {
    type: ErrorTypes.SYSTEM,
    indicators: ['EMFILE', 'ENOMEM', 'ENOSPC'],
    threshold: 1, // 这类错误出现一次就要警惕
    timeWindow: 600000, // 10分钟内
    prediction: '系统资源不足，可能导致应用不稳定'
  },
  
  // 进程异常模式
  PROCESS_INSTABILITY: {
    type: ErrorTypes.PROCESS,
    indicators: ['spawn', 'ESRCH', 'process not found'],
    threshold: 2,
    timeWindow: 120000, // 2分钟内
    prediction: '进程管理出现异常，可能影响功能正常运行'
  }
};

/**
 * 智能错误预测器
 * 通过分析历史错误数据和实时模式，预测潜在的错误风险
 */
class ErrorPredictor extends EventEmitter {
  constructor() {
    super();
    
    // 错误历史数据
    this.errorHistory = [];
    this.maxHistorySize = 1000;
    
    // 模式匹配状态
    this.patternState = new Map();
    
    // 预测缓存（避免重复预测）
    this.predictionCache = new Map();
    this.cacheExpiry = 300000; // 5分钟缓存过期
    
    // 机器学习特征
    this.featureExtractor = new FeatureExtractor();
    this.riskScorer = new RiskScorer();
    
    // 配置
    this.config = {
      enabled: true,
      minConfidence: 0.7, // 最小置信度阈值
      maxPredictions: 10, // 最大同时预测数量
      analysisInterval: 30000, // 30秒分析一次
      enableMachineLearning: true
    };
    
    // 启动定期分析
    this.startPeriodicAnalysis();
    
    console.log('ErrorPredictor initialized with', Object.keys(ErrorPatterns).length, 'patterns');
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
  
  /**
   * 记录错误（从错误处理器接收）
   */
  recordError(errorInfo) {
    if (!this.config.enabled) return;
    
    try {
      // 添加到历史记录
      const errorRecord = {
        ...errorInfo,
        recordedAt: Date.now(),
        features: this.featureExtractor.extract(errorInfo)
      };
      
      this.errorHistory.unshift(errorRecord);
      
      // 限制历史记录大小
      if (this.errorHistory.length > this.maxHistorySize) {
        this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
      }
      
      // 立即分析新错误
      this.analyzeError(errorRecord);
      
      this.emit('error-recorded', errorRecord);
      
    } catch (error) {
      console.error('ErrorPredictor.recordError failed:', error);
      // 不抛出错误，避免影响主流程
    }
  }
  
  /**
   * 分析单个错误
   */
  analyzeError(errorRecord) {
    // 1. 模式匹配分析
    this.performPatternAnalysis(errorRecord);
    
    // 2. 机器学习分析（如果启用）
    if (this.config.enableMachineLearning) {
      this.performMLAnalysis(errorRecord);
    }
    
    // 3. 时序分析
    this.performTemporalAnalysis(errorRecord);
  }
  
  /**
   * 模式匹配分析
   */
  performPatternAnalysis(errorRecord) {
    const now = Date.now();
    
    for (const [patternName, pattern] of Object.entries(ErrorPatterns)) {
      // 检查是否匹配模式指示器
      const matches = pattern.indicators.some(indicator => 
        this.matchesIndicator(errorRecord, indicator)
      );
      
      if (!matches) continue;
      
      // 获取或创建模式状态
      let state = this.patternState.get(patternName);
      if (!state) {
        state = {
          occurrences: [],
          lastPrediction: 0,
          confidence: 0
        };
        this.patternState.set(patternName, state);
      }
      
      // 记录新的发生
      state.occurrences.push({
        timestamp: now,
        errorId: errorRecord.id,
        severity: errorRecord.severity
      });
      
      // 清理过期记录
      state.occurrences = state.occurrences.filter(
        occ => now - occ.timestamp <= pattern.timeWindow
      );
      
      // 检查是否达到阈值
      if (state.occurrences.length >= pattern.threshold) {
        this.generatePatternPrediction(patternName, pattern, state);
      }
    }
  }
  
  /**
   * 检查错误是否匹配指示器
   */
  matchesIndicator(errorRecord, indicator) {
    const searchFields = [
      errorRecord.message,
      errorRecord.detail,
      errorRecord.originalError?.message,
      errorRecord.originalError?.code,
      String(errorRecord.context?.statusCode || '')
    ].filter(Boolean);
    
    const searchText = searchFields.join(' ').toLowerCase();
    return searchText.includes(indicator.toLowerCase());
  }
  
  /**
   * 生成模式预测
   */
  generatePatternPrediction(patternName, pattern, state) {
    const now = Date.now();
    
    // 避免重复预测（5分钟内）
    if (now - state.lastPrediction < 300000) {
      return;
    }
    
    // 计算置信度
    const baseConfidence = Math.min(state.occurrences.length / pattern.threshold, 1.0);
    const timeDecay = this.calculateTimeDecay(state.occurrences, pattern.timeWindow);
    const severityWeight = this.calculateSeverityWeight(state.occurrences);
    
    const confidence = baseConfidence * timeDecay * severityWeight;
    
    if (confidence < this.config.minConfidence) {
      return;
    }
    
    // 生成预测
    const prediction = {
      id: `pred_${patternName}_${now}`,
      timestamp: now,
      type: 'pattern',
      pattern: patternName,
      confidence: confidence,
      riskLevel: this.calculateRiskLevel(confidence, pattern.type),
      prediction: pattern.prediction,
      evidence: state.occurrences.slice(-3), // 最近3个证据
      recommendations: this.generateRecommendations(patternName, pattern)
    };
    
    state.lastPrediction = now;
    state.confidence = confidence;
    
    this.emitPrediction(prediction);
  }
  
  /**
   * 机器学习分析
   */
  performMLAnalysis(errorRecord) {
    try {
      // 使用简化的风险评分算法
      const riskScore = this.riskScorer.calculateRisk(
        errorRecord,
        this.getRecentHistory(300000) // 最近5分钟的历史
      );
      
      if (riskScore.score > 0.8) {
        const prediction = {
          id: `ml_pred_${Date.now()}`,
          timestamp: Date.now(),
          type: 'ml',
          confidence: riskScore.confidence,
          riskLevel: riskScore.level,
          prediction: riskScore.prediction,
          factors: riskScore.factors,
          recommendations: riskScore.recommendations
        };
        
        this.emitPrediction(prediction);
      }
    } catch (error) {
      console.error('ML analysis failed:', error);
    }
  }
  
  /**
   * 时序分析
   */
  performTemporalAnalysis(errorRecord) {
    const recent = this.getRecentHistory(600000); // 最近10分钟
    
    if (recent.length < 5) return; // 数据不足
    
    // 分析错误频率趋势
    const trend = this.analyzeTrend(recent);
    
    if (trend.isIncreasing && trend.acceleration > 0.5) {
      const prediction = {
        id: `temporal_pred_${Date.now()}`,
        timestamp: Date.now(),
        type: 'temporal',
        confidence: Math.min(trend.acceleration, 0.95),
        riskLevel: 'medium',
        prediction: '错误频率正在快速增加，系统可能即将出现严重问题',
        trend: trend,
        recommendations: [
          '监控系统资源使用情况',
          '检查最近的配置更改',
          '考虑降低请求频率'
        ]
      };
      
      this.emitPrediction(prediction);
    }
  }
  
  /**
   * 计算时间衰减
   */
  calculateTimeDecay(occurrences, timeWindow) {
    if (occurrences.length === 0) return 0;
    
    const now = Date.now();
    const weights = occurrences.map(occ => {
      const age = now - occ.timestamp;
      return Math.exp(-age / (timeWindow * 0.5)); // 半衰期为时间窗口的一半
    });
    
    return weights.reduce((sum, w) => sum + w, 0) / weights.length;
  }
  
  /**
   * 计算严重程度权重
   */
  calculateSeverityWeight(occurrences) {
    const severityScores = {
      [ErrorSeverity.INFO]: 0.2,
      [ErrorSeverity.WARNING]: 0.5,
      [ErrorSeverity.ERROR]: 0.8,
      [ErrorSeverity.CRITICAL]: 1.0
    };
    
    const totalWeight = occurrences.reduce((sum, occ) => {
      return sum + (severityScores[occ.severity] || 0.5);
    }, 0);
    
    return Math.min(totalWeight / occurrences.length, 1.0);
  }
  
  /**
   * 计算风险等级
   */
  calculateRiskLevel(confidence, errorType) {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  }
  
  /**
   * 生成建议
   */
  generateRecommendations(patternName, pattern) {
    const baseRecommendations = {
      NETWORK_INSTABILITY: [
        '检查网络连接稳定性',
        '验证目标服务器状态',
        '考虑增加重试机制',
        '检查防火墙和代理设置'
      ],
      API_RATE_LIMITING: [
        '减少API请求频率',
        '实施请求缓存策略',
        '检查API配额使用情况',
        '考虑升级API套餐'
      ],
      CONFIG_CORRUPTION: [
        '备份当前配置',
        '验证配置文件完整性',
        '恢复到上次正常的配置',
        '重新运行配置向导'
      ],
      RESOURCE_EXHAUSTION: [
        '监控系统资源使用',
        '清理临时文件',
        '检查内存泄漏',
        '考虑重启应用'
      ],
      PROCESS_INSTABILITY: [
        '检查进程权限',
        '验证依赖程序状态',
        '重启相关服务',
        '检查系统日志'
      ]
    };
    
    return baseRecommendations[patternName] || [
      '查看详细日志',
      '联系技术支持',
      '重启应用'
    ];
  }
  
  /**
   * 发出预测事件
   */
  emitPrediction(prediction) {
    // 缓存预测（避免重复）
    const cacheKey = `${prediction.type}_${prediction.pattern || 'general'}`;
    const cached = this.predictionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return; // 避免重复预测
    }
    
    this.predictionCache.set(cacheKey, prediction);
    
    // 清理过期缓存
    setTimeout(() => {
      this.predictionCache.delete(cacheKey);
    }, this.cacheExpiry);
    
    console.log('ErrorPredictor: Generated prediction:', {
      type: prediction.type,
      confidence: prediction.confidence,
      riskLevel: prediction.riskLevel,
      prediction: prediction.prediction
    });
    
    this.emit('prediction', prediction);
  }
  
  /**
   * 获取最近历史
   */
  getRecentHistory(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.errorHistory.filter(error => error.recordedAt >= cutoff);
  }
  
  /**
   * 分析趋势
   */
  analyzeTrend(errors) {
    if (errors.length < 3) {
      return { isIncreasing: false, acceleration: 0 };
    }
    
    // 按时间分桶统计
    const buckets = this.createTimeBuckets(errors, 60000); // 1分钟桶
    const counts = buckets.map(bucket => bucket.length);
    
    // 计算趋势
    const isIncreasing = this.isIncreasingTrend(counts);
    const acceleration = this.calculateAcceleration(counts);
    
    return { isIncreasing, acceleration, buckets: counts };
  }
  
  /**
   * 创建时间桶
   */
  createTimeBuckets(errors, bucketSize) {
    const now = Date.now();
    const buckets = [];
    const bucketCount = Math.ceil(600000 / bucketSize); // 10分钟内的桶数
    
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = now - (i + 1) * bucketSize;
      const bucketEnd = now - i * bucketSize;
      
      const bucketErrors = errors.filter(error => 
        error.recordedAt >= bucketStart && error.recordedAt < bucketEnd
      );
      
      buckets.unshift(bucketErrors);
    }
    
    return buckets;
  }
  
  /**
   * 判断是否为递增趋势
   */
  isIncreasingTrend(counts) {
    if (counts.length < 3) return false;
    
    let increasing = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] > counts[i - 1]) {
        increasing++;
      }
    }
    
    return increasing >= counts.length / 2;
  }
  
  /**
   * 计算加速度
   */
  calculateAcceleration(counts) {
    if (counts.length < 3) return 0;
    
    const recent = counts.slice(-3);
    const acceleration = (recent[2] - recent[1]) - (recent[1] - recent[0]);
    
    return Math.max(0, acceleration / Math.max(recent[1], 1));
  }
  
  /**
   * 开始定期分析
   */
  startPeriodicAnalysis() {
    this.analysisTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.analysisInterval);
  }
  
  /**
   * 执行定期分析
   */
  performPeriodicAnalysis() {
    if (!this.config.enabled) return;
    
    try {
      // 清理过期数据
      this.cleanupExpiredData();
      
      // 全局趋势分析
      this.performGlobalAnalysis();
      
      // 发出统计事件
      this.emit('analysis-completed', {
        timestamp: Date.now(),
        historySize: this.errorHistory.length,
        activePatterns: this.patternState.size,
        cachedPredictions: this.predictionCache.size
      });
      
    } catch (error) {
      console.error('Periodic analysis failed:', error);
    }
  }
  
  /**
   * 清理过期数据
   */
  cleanupExpiredData() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    // 清理历史记录
    this.errorHistory = this.errorHistory.filter(
      error => now - error.recordedAt <= maxAge
    );
    
    // 清理模式状态
    for (const [patternName, state] of this.patternState.entries()) {
      state.occurrences = state.occurrences.filter(
        occ => now - occ.timestamp <= maxAge
      );
      
      if (state.occurrences.length === 0) {
        this.patternState.delete(patternName);
      }
    }
  }
  
  /**
   * 全局分析
   */
  performGlobalAnalysis() {
    const recent = this.getRecentHistory(1800000); // 最近30分钟
    
    if (recent.length === 0) return;
    
    // 分析系统健康度
    const healthScore = this.calculateSystemHealth(recent);
    
    if (healthScore < 0.3) {
      const prediction = {
        id: `system_health_${Date.now()}`,
        timestamp: Date.now(),
        type: 'system',
        confidence: 0.9,
        riskLevel: 'critical',
        prediction: '系统健康度严重下降，建议立即检查',
        healthScore: healthScore,
        recommendations: [
          '检查系统资源使用情况',
          '查看最近的错误日志',
          '考虑重启应用或服务',
          '联系技术支持'
        ]
      };
      
      this.emitPrediction(prediction);
    }
  }
  
  /**
   * 计算系统健康度
   */
  calculateSystemHealth(errors) {
    if (errors.length === 0) return 1.0;
    
    const severityWeights = {
      [ErrorSeverity.INFO]: 0.1,
      [ErrorSeverity.WARNING]: 0.3,
      [ErrorSeverity.ERROR]: 0.7,
      [ErrorSeverity.CRITICAL]: 1.0
    };
    
    const totalWeight = errors.reduce((sum, error) => {
      return sum + (severityWeights[error.severity] || 0.5);
    }, 0);
    
    const averageWeight = totalWeight / errors.length;
    const frequencyFactor = Math.min(errors.length / 100, 1.0); // 基于频率的影响
    
    return Math.max(0, 1.0 - (averageWeight * 0.7 + frequencyFactor * 0.3));
  }
  
  /**
   * 获取预测历史
   */
  getPredictionHistory() {
    return Array.from(this.predictionCache.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * 获取统计信息
   */
  getStatistics() {
    return {
      enabled: this.config.enabled,
      totalErrors: this.errorHistory.length,
      activePatterns: this.patternState.size,
      cachedPredictions: this.predictionCache.size,
      recentPredictions: Array.from(this.predictionCache.values()).length,
      config: { ...this.config }
    };
  }
  
  /**
   * 重置预测器
   */
  reset() {
    this.errorHistory = [];
    this.patternState.clear();
    this.predictionCache.clear();
    this.emit('reset');
  }
  
  /**
   * 停止预测器
   */
  stop() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    this.emit('stopped');
  }
}

/**
 * 特征提取器
 */
class FeatureExtractor {
  extract(errorInfo) {
    return {
      type: errorInfo.type,
      severity: errorInfo.severity,
      hasStack: !!errorInfo.stack,
      messageLength: errorInfo.message?.length || 0,
      hasContext: !!errorInfo.context && Object.keys(errorInfo.context).length > 0,
      platform: errorInfo.system?.platform,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };
  }
}

/**
 * 风险评分器
 */
class RiskScorer {
  calculateRisk(errorInfo, recentHistory) {
    let score = 0;
    let confidence = 0.5;
    const factors = [];
    
    // 基于错误类型的基础分数
    const typeScores = {
      [ErrorTypes.CRITICAL]: 0.9,
      [ErrorTypes.SYSTEM]: 0.8,
      [ErrorTypes.NETWORK]: 0.6,
      [ErrorTypes.API]: 0.5,
      [ErrorTypes.CONFIG]: 0.7,
      [ErrorTypes.VALIDATION]: 0.3
    };
    
    score += typeScores[errorInfo.type] || 0.4;
    
    // 基于频率的分数
    const recentSimilar = recentHistory.filter(h => 
      h.type === errorInfo.type || 
      h.message === errorInfo.message
    );
    
    if (recentSimilar.length > 0) {
      const frequency = recentSimilar.length / 10; // 假设最大10个相似错误
      score += Math.min(frequency * 0.3, 0.5);
      factors.push(`相似错误频率: ${recentSimilar.length}`);
    }
    
    // 基于严重程度的调整
    const severityMultipliers = {
      [ErrorSeverity.INFO]: 0.2,
      [ErrorSeverity.WARNING]: 0.5,
      [ErrorSeverity.ERROR]: 0.8,
      [ErrorSeverity.CRITICAL]: 1.2
    };
    
    score *= severityMultipliers[errorInfo.severity] || 0.8;
    
    // 置信度计算
    confidence = Math.min(0.3 + recentSimilar.length * 0.1, 0.95);
    
    // 生成预测文本
    let prediction = '系统可能出现进一步问题';
    let level = 'low';
    
    if (score > 0.8) {
      prediction = '高风险：系统可能即将出现严重故障';
      level = 'critical';
    } else if (score > 0.6) {
      prediction = '中等风险：建议密切监控系统状态';
      level = 'high';
    } else if (score > 0.4) {
      prediction = '存在潜在风险，建议检查相关组件';
      level = 'medium';
    }
    
    return {
      score,
      confidence,
      level,
      prediction,
      factors,
      recommendations: this.generateMLRecommendations(score, errorInfo)
    };
  }
  
  generateMLRecommendations(score, errorInfo) {
    const recommendations = [];
    
    if (score > 0.8) {
      recommendations.push('立即检查系统状态');
      recommendations.push('准备应急恢复方案');
    }
    
    if (errorInfo.type === ErrorTypes.NETWORK) {
      recommendations.push('检查网络连接');
      recommendations.push('验证目标服务状态');
    }
    
    if (errorInfo.type === ErrorTypes.API) {
      recommendations.push('检查API配额和限制');
      recommendations.push('验证API密钥有效性');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('查看详细日志');
      recommendations.push('监控后续错误');
    }
    
    return recommendations;
  }
}

// 导出单例
module.exports = new ErrorPredictor();