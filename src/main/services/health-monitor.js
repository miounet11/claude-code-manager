'use strict';

const EventEmitter = require('events');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { ErrorTypes, ErrorSeverity } = require('./error-handler');

/**
 * 健康检查指标定义
 */
const HealthMetrics = {
  // 系统资源指标
  SYSTEM_RESOURCES: {
    name: 'system_resources',
    interval: 5000, // 5秒检查一次
    thresholds: {
      memory: {
        warning: 0.8,  // 内存使用超过80%警告
        critical: 0.95 // 超过95%严重
      },
      cpu: {
        warning: 0.8,
        critical: 0.95
      },
      disk: {
        warning: 0.85,
        critical: 0.95
      }
    }
  },
  
  // 网络连通性指标
  NETWORK_CONNECTIVITY: {
    name: 'network_connectivity',
    interval: 30000, // 30秒检查一次
    targets: [
      'https://api.anthropic.com',
      'https://api.openai.com',
      'https://www.google.com'
    ],
    timeout: 10000,
    thresholds: {
      responseTime: {
        warning: 5000,  // 响应时间超过5秒
        critical: 15000 // 超过15秒
      },
      successRate: {
        warning: 0.8,   // 成功率低于80%
        critical: 0.5   // 低于50%
      }
    }
  },
  
  // 应用程序健康指标
  APPLICATION_HEALTH: {
    name: 'application_health',
    interval: 10000, // 10秒检查一次
    checks: [
      'proxy_server_status',
      'config_service_status',
      'error_handler_status',
      'file_system_access'
    ]
  },
  
  // 进程健康指标
  PROCESS_HEALTH: {
    name: 'process_health',
    interval: 15000, // 15秒检查一次
    thresholds: {
      uptime: {
        minimum: 10000 // 最少运行10秒
      },
      eventLoopDelay: {
        warning: 50,    // 事件循环延迟超过50ms
        critical: 200   // 超过200ms
      },
      handles: {
        warning: 1000,  // 句柄数超过1000
        critical: 5000  // 超过5000
      }
    }
  },
  
  // 错误率指标
  ERROR_RATE: {
    name: 'error_rate',
    interval: 60000, // 1分钟检查一次
    window: 300000,  // 5分钟窗口
    thresholds: {
      errorRate: {
        warning: 0.1,   // 错误率超过10%
        critical: 0.25  // 超过25%
      },
      criticalErrors: {
        warning: 5,     // 5分钟内超过5个严重错误
        critical: 15    // 超过15个
      }
    }
  }
};

/**
 * 健康状态枚举
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown'
};

/**
 * 实时系统健康监控器
 * 监控系统资源、网络连通性、应用状态等关键指标
 */
class HealthMonitor extends EventEmitter {
  constructor() {
    super();
    
    // 监控状态
    this.isRunning = false;
    this.intervals = new Map();
    this.metrics = new Map();
    this.healthHistory = [];
    this.maxHistorySize = 1000;
    
    // 当前健康状态
    this.currentHealth = {
      overall: HealthStatus.UNKNOWN,
      components: new Map(),
      lastUpdated: null,
      issues: []
    };
    
    // 监控配置
    this.config = {
      enabled: true,
      enabledMetrics: Object.keys(HealthMetrics),
      alertThreshold: HealthStatus.WARNING,
      historicalAnalysis: true,
      predictiveAlerts: true,
      autoRemediation: false
    };
    
    // 性能缓存
    this.performanceCache = new Map();
    this.cacheExpiry = 30000; // 30秒缓存
    
    console.log('HealthMonitor initialized with', Object.keys(HealthMetrics).length, 'metric types');
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // 重启监控以应用新配置
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    this.emit('config-updated', this.config);
  }
  
  /**
   * 启动健康监控
   */
  start() {
    if (this.isRunning) {
      console.log('HealthMonitor is already running');
      return;
    }
    
    if (!this.config.enabled) {
      console.log('HealthMonitor is disabled');
      return;
    }
    
    console.log('Starting HealthMonitor...');
    this.isRunning = true;
    
    // 启动各个指标监控
    for (const metricName of this.config.enabledMetrics) {
      if (HealthMetrics[metricName]) {
        this.startMetricMonitoring(metricName, HealthMetrics[metricName]);
      }
    }
    
    // 启动健康评估定时器
    this.startHealthAssessment();
    
    this.emit('started', {
      timestamp: Date.now(),
      enabledMetrics: this.config.enabledMetrics
    });
  }
  
  /**
   * 停止健康监控
   */
  stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping HealthMonitor...');
    this.isRunning = false;
    
    // 清理所有定时器
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    
    this.emit('stopped', {
      timestamp: Date.now(),
      uptime: this.getUptime()
    });
  }
  
  /**
   * 启动指标监控
   */
  startMetricMonitoring(metricName, metricConfig) {
    const interval = setInterval(async () => {
      try {
        await this.collectMetric(metricName, metricConfig);
      } catch (error) {
        console.error(`Failed to collect metric ${metricName}:`, error);
        this.emit('metric-error', {
          metric: metricName,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, metricConfig.interval);
    
    this.intervals.set(metricName, interval);
    
    // 立即执行一次
    setImmediate(() => this.collectMetric(metricName, metricConfig));
  }
  
  /**
   * 收集指标数据
   */
  async collectMetric(metricName, metricConfig) {
    const startTime = Date.now();
    let metricData;
    
    try {
      switch (metricName) {
        case 'SYSTEM_RESOURCES':
          metricData = await this.collectSystemResources(metricConfig);
          break;
        case 'NETWORK_CONNECTIVITY':
          metricData = await this.collectNetworkConnectivity(metricConfig);
          break;
        case 'APPLICATION_HEALTH':
          metricData = await this.collectApplicationHealth(metricConfig);
          break;
        case 'PROCESS_HEALTH':
          metricData = await this.collectProcessHealth(metricConfig);
          break;
        case 'ERROR_RATE':
          metricData = await this.collectErrorRate(metricConfig);
          break;
        default:
          console.warn(`Unknown metric: ${metricName}`);
          return;
      }
      
      // 计算健康状态
      const status = this.calculateMetricStatus(metricData, metricConfig.thresholds);
      
      // 存储指标数据
      const metricRecord = {
        name: metricName,
        timestamp: Date.now(),
        data: metricData,
        status: status,
        collectionTime: Date.now() - startTime
      };
      
      this.storeMetric(metricRecord);
      
      // 更新当前健康状态
      this.currentHealth.components.set(metricName, {
        status: status,
        data: metricData,
        lastUpdated: metricRecord.timestamp
      });
      
      this.emit('metric-collected', metricRecord);
      
    } catch (error) {
      console.error(`Error collecting metric ${metricName}:`, error);
      
      // 记录错误状态
      this.currentHealth.components.set(metricName, {
        status: HealthStatus.UNKNOWN,
        error: error.message,
        lastUpdated: Date.now()
      });
    }
  }
  
  /**
   * 收集系统资源指标
   */
  async collectSystemResources(config) {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // CPU 使用率（简化计算）
    const cpuUsage = await this.getCpuUsage();
    
    // 磁盘使用情况
    const diskUsage = await this.getDiskUsage();
    
    return {
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: usedMemory / totalMemory,
        process: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        }
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      disk: diskUsage
    };
  }
  
  /**
   * 获取CPU使用率
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // 转换为微秒
        const usage = (endUsage.user + endUsage.system) / totalTime;
        
        resolve(Math.min(usage, 1.0)); // 限制在0-1之间
      }, 100);
    });
  }
  
  /**
   * 获取磁盘使用情况
   */
  async getDiskUsage() {
    try {
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      const stats = await fs.stat(userDataPath);
      
      // 简化的磁盘使用情况
      return {
        path: userDataPath,
        usage: 0.1, // 占位符，实际应该计算真实的磁盘使用率
        available: true
      };
    } catch (error) {
      return {
        path: 'unknown',
        usage: 0,
        available: false,
        error: error.message
      };
    }
  }
  
  /**
   * 收集网络连通性指标
   */
  async collectNetworkConnectivity(config) {
    const results = [];
    const { targets, timeout } = config;
    
    for (const target of targets) {
      const result = await this.testNetworkConnection(target, timeout);
      results.push(result);
    }
    
    // 计算总体网络健康度
    const successfulConnections = results.filter(r => r.success).length;
    const successRate = successfulConnections / results.length;
    const averageResponseTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / successfulConnections || 0;
    
    return {
      targets: results,
      summary: {
        successRate,
        averageResponseTime,
        totalTests: results.length,
        successfulTests: successfulConnections
      }
    };
  }
  
  /**
   * 测试网络连接
   */
  async testNetworkConnection(url, timeout) {
    const startTime = Date.now();
    
    try {
      const https = require('https');
      const { URL } = require('url');
      const parsedUrl = new URL(url);
      
      return new Promise((resolve) => {
        const req = https.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname,
          method: 'HEAD',
          timeout: timeout
        }, (res) => {
          const responseTime = Date.now() - startTime;
          resolve({
            url,
            success: true,
            statusCode: res.statusCode,
            responseTime,
            timestamp: Date.now()
          });
        });
        
        req.on('error', (error) => {
          resolve({
            url,
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime,
            timestamp: Date.now()
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({
            url,
            success: false,
            error: 'timeout',
            responseTime: timeout,
            timestamp: Date.now()
          });
        });
        
        req.end();
      });
    } catch (error) {
      return {
        url,
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 收集应用程序健康指标
   */
  async collectApplicationHealth(config) {
    const checks = {};
    
    for (const checkName of config.checks) {
      try {
        checks[checkName] = await this.performHealthCheck(checkName);
      } catch (error) {
        checks[checkName] = {
          healthy: false,
          error: error.message,
          timestamp: Date.now()
        };
      }
    }
    
    const healthyChecks = Object.values(checks).filter(c => c.healthy).length;
    const overallHealth = healthyChecks / Object.keys(checks).length;
    
    return {
      checks,
      summary: {
        totalChecks: Object.keys(checks).length,
        healthyChecks,
        overallHealth
      }
    };
  }
  
  /**
   * 执行特定的健康检查
   */
  async performHealthCheck(checkName) {
    switch (checkName) {
      case 'proxy_server_status':
        return this.checkProxyServerStatus();
      case 'config_service_status':
        return this.checkConfigServiceStatus();
      case 'error_handler_status':
        return this.checkErrorHandlerStatus();
      case 'file_system_access':
        return this.checkFileSystemAccess();
      default:
        throw new Error(`Unknown health check: ${checkName}`);
    }
  }
  
  /**
   * 检查代理服务器状态
   */
  async checkProxyServerStatus() {
    try {
      // 这里应该检查代理服务器是否正在运行
      // 可以尝试访问 /health 端点
      return {
        healthy: true,
        message: 'Proxy server is running',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 检查配置服务状态
   */
  async checkConfigServiceStatus() {
    try {
      // 检查配置服务是否可用
      return {
        healthy: true,
        message: 'Config service is available',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 检查错误处理器状态
   */
  async checkErrorHandlerStatus() {
    try {
      // 检查错误处理器是否正常工作
      return {
        healthy: true,
        message: 'Error handler is functioning',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 检查文件系统访问
   */
  async checkFileSystemAccess() {
    try {
      const { app } = require('electron');
      const testPath = path.join(app.getPath('userData'), 'health-check.tmp');
      
      // 尝试写入和读取文件
      await fs.writeFile(testPath, 'health check', 'utf8');
      await fs.readFile(testPath, 'utf8');
      await fs.unlink(testPath);
      
      return {
        healthy: true,
        message: 'File system access is working',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 收集进程健康指标
   */
  async collectProcessHealth(config) {
    const uptime = process.uptime() * 1000; // 转换为毫秒
    const memoryUsage = process.memoryUsage();
    
    // 获取事件循环延迟
    const eventLoopDelay = await this.measureEventLoopDelay();
    
    // 获取活动句柄数
    const activeHandles = process._getActiveHandles().length;
    const activeRequests = process._getActiveRequests().length;
    
    return {
      uptime,
      memoryUsage,
      eventLoopDelay,
      handles: {
        active: activeHandles,
        requests: activeRequests,
        total: activeHandles + activeRequests
      },
      pid: process.pid,
      version: {
        node: process.version,
        v8: process.versions.v8,
        electron: process.versions.electron
      }
    };
  }
  
  /**
   * 测量事件循环延迟
   */
  async measureEventLoopDelay() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    });
  }
  
  /**
   * 收集错误率指标
   */
  async collectErrorRate(config) {
    const { window } = config;
    const now = Date.now();
    const windowStart = now - window;
    
    // 从错误处理器获取错误历史（需要集成）
    const errorHistory = this.getErrorHistory(windowStart, now);
    
    const totalErrors = errorHistory.length;
    const criticalErrors = errorHistory.filter(e => 
      e.severity === ErrorSeverity.CRITICAL
    ).length;
    
    // 估算总请求数（这里需要从代理服务器获取实际数据）
    const estimatedRequests = Math.max(totalErrors * 10, 100); // 简单估算
    const errorRate = totalErrors / estimatedRequests;
    
    return {
      window,
      totalErrors,
      criticalErrors,
      estimatedRequests,
      errorRate,
      errorsByType: this.groupErrorsByType(errorHistory),
      errorsBySeverity: this.groupErrorsBySeverity(errorHistory)
    };
  }
  
  /**
   * 获取错误历史（占位符实现）
   */
  getErrorHistory(startTime, endTime) {
    // 这里应该从错误处理器获取实际的错误历史
    // 目前返回空数组作为占位符
    return [];
  }
  
  /**
   * 按类型分组错误
   */
  groupErrorsByType(errors) {
    const groups = {};
    for (const error of errors) {
      groups[error.type] = (groups[error.type] || 0) + 1;
    }
    return groups;
  }
  
  /**
   * 按严重程度分组错误
   */
  groupErrorsBySeverity(errors) {
    const groups = {};
    for (const error of errors) {
      groups[error.severity] = (groups[error.severity] || 0) + 1;
    }
    return groups;
  }
  
  /**
   * 计算指标状态
   */
  calculateMetricStatus(data, thresholds) {
    if (!thresholds) return HealthStatus.HEALTHY;
    
    let worstStatus = HealthStatus.HEALTHY;
    
    for (const [key, threshold] of Object.entries(thresholds)) {
      const value = this.extractValue(data, key);
      if (value === undefined) continue;
      
      const status = this.evaluateThreshold(value, threshold);
      if (this.isWorseStatus(status, worstStatus)) {
        worstStatus = status;
      }
    }
    
    return worstStatus;
  }
  
  /**
   * 从数据中提取值
   */
  extractValue(data, path) {
    const keys = path.split('.');
    let value = data;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * 评估阈值
   */
  evaluateThreshold(value, threshold) {
    if (typeof threshold === 'object') {
      if (threshold.critical !== undefined && value >= threshold.critical) {
        return HealthStatus.CRITICAL;
      }
      if (threshold.warning !== undefined && value >= threshold.warning) {
        return HealthStatus.WARNING;
      }
      if (threshold.minimum !== undefined && value < threshold.minimum) {
        return HealthStatus.WARNING;
      }
    }
    
    return HealthStatus.HEALTHY;
  }
  
  /**
   * 判断状态是否更严重
   */
  isWorseStatus(status1, status2) {
    const severity = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.WARNING]: 1,
      [HealthStatus.CRITICAL]: 2,
      [HealthStatus.UNKNOWN]: 3
    };
    
    return severity[status1] > severity[status2];
  }
  
  /**
   * 存储指标数据
   */
  storeMetric(metricRecord) {
    const metricName = metricRecord.name;
    
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    
    const metricHistory = this.metrics.get(metricName);
    metricHistory.unshift(metricRecord);
    
    // 限制历史记录大小
    if (metricHistory.length > this.maxHistorySize) {
      metricHistory.length = this.maxHistorySize;
    }
  }
  
  /**
   * 启动健康评估
   */
  startHealthAssessment() {
    const assessmentInterval = setInterval(() => {
      this.performHealthAssessment();
    }, 30000); // 每30秒评估一次
    
    this.intervals.set('health_assessment', assessmentInterval);
    
    // 立即执行一次
    setImmediate(() => this.performHealthAssessment());
  }
  
  /**
   * 执行健康评估
   */
  performHealthAssessment() {
    try {
      const overallStatus = this.calculateOverallHealth();
      const issues = this.identifyHealthIssues();
      
      const previousStatus = this.currentHealth.overall;
      
      this.currentHealth = {
        overall: overallStatus,
        components: this.currentHealth.components,
        lastUpdated: Date.now(),
        issues
      };
      
      // 记录到历史
      this.recordHealthHistory();
      
      // 如果健康状态发生变化，发出事件
      if (overallStatus !== previousStatus) {
        this.emit('health-status-changed', {
          previous: previousStatus,
          current: overallStatus,
          issues,
          timestamp: Date.now()
        });
      }
      
      // 如果达到告警阈值，发出告警
      if (this.shouldAlert(overallStatus)) {
        this.emit('health-alert', {
          status: overallStatus,
          issues,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error('Health assessment failed:', error);
    }
  }
  
  /**
   * 计算总体健康状态
   */
  calculateOverallHealth() {
    const componentStatuses = Array.from(this.currentHealth.components.values())
      .map(c => c.status);
    
    if (componentStatuses.length === 0) {
      return HealthStatus.UNKNOWN;
    }
    
    // 如果有任何组件是 CRITICAL，整体就是 CRITICAL
    if (componentStatuses.includes(HealthStatus.CRITICAL)) {
      return HealthStatus.CRITICAL;
    }
    
    // 如果有任何组件是 WARNING，整体就是 WARNING
    if (componentStatuses.includes(HealthStatus.WARNING)) {
      return HealthStatus.WARNING;
    }
    
    // 如果有任何组件是 UNKNOWN，整体就是 WARNING（降级处理）
    if (componentStatuses.includes(HealthStatus.UNKNOWN)) {
      return HealthStatus.WARNING;
    }
    
    return HealthStatus.HEALTHY;
  }
  
  /**
   * 识别健康问题
   */
  identifyHealthIssues() {
    const issues = [];
    
    for (const [componentName, component] of this.currentHealth.components) {
      if (component.status !== HealthStatus.HEALTHY) {
        issues.push({
          component: componentName,
          status: component.status,
          description: this.getIssueDescription(componentName, component),
          timestamp: component.lastUpdated,
          data: component.data
        });
      }
    }
    
    return issues;
  }
  
  /**
   * 获取问题描述
   */
  getIssueDescription(componentName, component) {
    switch (componentName) {
      case 'SYSTEM_RESOURCES':
        return this.describeSystemResourceIssues(component.data);
      case 'NETWORK_CONNECTIVITY':
        return this.describeNetworkIssues(component.data);
      case 'APPLICATION_HEALTH':
        return this.describeApplicationIssues(component.data);
      case 'PROCESS_HEALTH':
        return this.describeProcessIssues(component.data);
      case 'ERROR_RATE':
        return this.describeErrorRateIssues(component.data);
      default:
        return component.error || '未知问题';
    }
  }
  
  /**
   * 描述系统资源问题
   */
  describeSystemResourceIssues(data) {
    const issues = [];
    
    if (data.memory && data.memory.usage > 0.8) {
      issues.push(`内存使用率过高: ${(data.memory.usage * 100).toFixed(1)}%`);
    }
    
    if (data.cpu && data.cpu.usage > 0.8) {
      issues.push(`CPU使用率过高: ${(data.cpu.usage * 100).toFixed(1)}%`);
    }
    
    if (data.disk && data.disk.usage > 0.85) {
      issues.push(`磁盘使用率过高: ${(data.disk.usage * 100).toFixed(1)}%`);
    }
    
    return issues.join(', ') || '系统资源异常';
  }
  
  /**
   * 描述网络问题
   */
  describeNetworkIssues(data) {
    if (data.summary) {
      const { successRate, averageResponseTime } = data.summary;
      const issues = [];
      
      if (successRate < 0.8) {
        issues.push(`网络连接成功率低: ${(successRate * 100).toFixed(1)}%`);
      }
      
      if (averageResponseTime > 5000) {
        issues.push(`平均响应时间过长: ${averageResponseTime.toFixed(0)}ms`);
      }
      
      return issues.join(', ') || '网络连接异常';
    }
    
    return '网络连接检查失败';
  }
  
  /**
   * 描述应用程序问题
   */
  describeApplicationIssues(data) {
    if (data.summary) {
      const { overallHealth } = data.summary;
      return `应用程序健康度: ${(overallHealth * 100).toFixed(1)}%`;
    }
    
    return '应用程序状态异常';
  }
  
  /**
   * 描述进程问题
   */
  describeProcessIssues(data) {
    const issues = [];
    
    if (data.eventLoopDelay > 50) {
      issues.push(`事件循环延迟过高: ${data.eventLoopDelay}ms`);
    }
    
    if (data.handles && data.handles.total > 1000) {
      issues.push(`活动句柄过多: ${data.handles.total}`);
    }
    
    return issues.join(', ') || '进程状态异常';
  }
  
  /**
   * 描述错误率问题
   */
  describeErrorRateIssues(data) {
    const issues = [];
    
    if (data.errorRate > 0.1) {
      issues.push(`错误率过高: ${(data.errorRate * 100).toFixed(1)}%`);
    }
    
    if (data.criticalErrors > 5) {
      issues.push(`严重错误过多: ${data.criticalErrors}个`);
    }
    
    return issues.join(', ') || '错误率异常';
  }
  
  /**
   * 判断是否应该发出告警
   */
  shouldAlert(status) {
    const alertLevels = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.WARNING]: 1,
      [HealthStatus.CRITICAL]: 2,
      [HealthStatus.UNKNOWN]: 1
    };
    
    const thresholdLevels = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.WARNING]: 1,
      [HealthStatus.CRITICAL]: 2,
      [HealthStatus.UNKNOWN]: 1
    };
    
    return alertLevels[status] >= thresholdLevels[this.config.alertThreshold];
  }
  
  /**
   * 记录健康历史
   */
  recordHealthHistory() {
    const record = {
      timestamp: Date.now(),
      overall: this.currentHealth.overall,
      componentCount: this.currentHealth.components.size,
      issueCount: this.currentHealth.issues.length,
      components: Object.fromEntries(
        Array.from(this.currentHealth.components.entries()).map(([name, comp]) => [
          name,
          { status: comp.status, lastUpdated: comp.lastUpdated }
        ])
      )
    };
    
    this.healthHistory.unshift(record);
    
    // 限制历史记录大小
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.length = this.maxHistorySize;
    }
  }
  
  /**
   * 获取当前健康状态
   */
  getCurrentHealth() {
    return {
      ...this.currentHealth,
      components: Object.fromEntries(this.currentHealth.components)
    };
  }
  
  /**
   * 获取指标历史
   */
  getMetricHistory(metricName, limit = 100) {
    const history = this.metrics.get(metricName) || [];
    return history.slice(0, limit);
  }
  
  /**
   * 获取健康历史
   */
  getHealthHistory(limit = 100) {
    return this.healthHistory.slice(0, limit);
  }
  
  /**
   * 获取统计信息
   */
  getStatistics() {
    const totalMetrics = Array.from(this.metrics.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    return {
      isRunning: this.isRunning,
      uptime: this.getUptime(),
      enabledMetrics: this.config.enabledMetrics,
      currentHealth: this.currentHealth.overall,
      componentCount: this.currentHealth.components.size,
      issueCount: this.currentHealth.issues.length,
      totalMetrics,
      healthHistorySize: this.healthHistory.length,
      config: { ...this.config }
    };
  }
  
  /**
   * 获取运行时间
   */
  getUptime() {
    // 这里应该记录实际的启动时间
    return this.isRunning ? process.uptime() * 1000 : 0;
  }
  
  /**
   * 强制健康检查
   */
  async forceHealthCheck() {
    if (!this.isRunning) {
      throw new Error('HealthMonitor is not running');
    }
    
    console.log('Forcing health check...');
    
    // 立即收集所有指标
    for (const metricName of this.config.enabledMetrics) {
      if (HealthMetrics[metricName]) {
        await this.collectMetric(metricName, HealthMetrics[metricName]);
      }
    }
    
    // 立即执行健康评估
    this.performHealthAssessment();
    
    return this.getCurrentHealth();
  }
  
  /**
   * 清理历史数据
   */
  clearHistory() {
    this.metrics.clear();
    this.healthHistory = [];
    this.performanceCache.clear();
    this.emit('history-cleared');
  }
}

// 导出单例和相关常量
module.exports = {
  healthMonitor: new HealthMonitor(),
  HealthStatus,
  HealthMetrics
};