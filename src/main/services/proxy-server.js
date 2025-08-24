'use strict';

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const EventEmitter = require('events');
const crypto = require('crypto');
const serviceRegistry = require('./service-registry');
const formatConverter = require('./format-converter');
const { errorHandler, ErrorTypes, ErrorSeverity } = require('./error-handler');

// 智能错误处理系统组件
const errorPredictor = require('./error-predictor');
const autoRecoveryManager = require('./auto-recovery-manager');
const { healthMonitor } = require('./health-monitor');
const contextAnalyzer = require('./context-analyzer');

/**
 * API 代理服务器
 * 拦截并转发 Claude CLI 的请求到第三方 API
 */
class ProxyServer extends EventEmitter {
  constructor() {
    super();
    this.app = null;
    this.server = null;
    this.port = 8118; // 默认代理端口
    this.isRunning = false;
    this.requestCount = 0;
    this.totalTokens = 0;
    this.statistics = {
      requests: [],
      totalCost: 0,
      startTime: null
    };
    
    // 智能错误处理系统状态
    this.intelligentErrorHandling = {
      enabled: true,
      predictionEnabled: true,
      autoRecoveryEnabled: true,
      healthMonitoringEnabled: true,
      contextAnalysisEnabled: true
    };
    
    // 初始化智能错误处理系统
    this.initializeIntelligentErrorHandling();
  }

  /**
   * 设置 Claude -> OpenAI 转换路由
   * 支持：/v1/messages（流/非流）到 OpenAI /v1/chat/completions
   */
  setupClaudeToOpenAIRoutes(config) {
    const expressJson = express.json({ limit: '50mb' });
    this.app.post('/v1/messages', expressJson, async (req, res) => {
      try {
        // 校验客户端提供的 Anthropic API Key（如果配置了 expectedAnthropicApiKey）
        if (config.expectedAnthropicApiKey) {
          const provided = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
          if (!provided || provided !== config.expectedAnthropicApiKey) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid ANTHROPIC_API_KEY' });
          }
        }

        const isStreaming = req.query.stream === 'true' || req.body?.stream === true;
        const sourceFormat = 'claude';
        const targetFormat = 'openai';

        // 模型映射：根据 claude 模型名包含 haiku/sonnet/opus 来映射
        const incomingModel = req.body?.model || '';
        let mappedModel = incomingModel;
        const lower = String(incomingModel).toLowerCase();
        if (lower.includes('haiku')) mappedModel = config.smallModel || 'gpt-4o-mini';
        else if (lower.includes('sonnet')) mappedModel = config.middleModel || config.bigModel || 'gpt-4o';
        else if (lower.includes('opus')) mappedModel = config.bigModel || 'gpt-4o';

        // 转换请求
        const converted = await formatConverter.convertRequest(sourceFormat, targetFormat, {
          ...(req.body || {}),
          model: mappedModel
        });

        // 转发到 OpenAI 兼容提供方
        const response = await this.forwardRequest({
          url: `${config.openaiBaseUrl.replace(/\/$/, '')}/chat/completions`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`
          },
          body: JSON.stringify(converted)
        });

        // 转换响应回 Claude 格式
        const convertedRes = await formatConverter.convertResponse(targetFormat, sourceFormat, response.data);
        res.status(response.status).json(convertedRes);
      } catch (error) {
        console.error('Claude->OpenAI 转换错误:', error);
        res.status(502).json({ error: 'Proxy conversion error', message: error.message });
      }
    });
  }

  /**
   * 启动代理服务器
   */
  async start(config) {
    if (this.isRunning) {
      const error = new Error('代理服务器已在运行');
      await errorHandler.handle({
        type: ErrorTypes.SYSTEM,
        severity: ErrorSeverity.WARNING,
        error,
        message: '代理服务器已在运行',
        context: { port: this.port }
      });
      throw error;
    }

    // 动态路由模式可以没有固定配置
    const isDynamicMode = !config || config.mode === 'dynamic';

    if (!isDynamicMode && (!config || !config.apiUrl || !config.apiKey)) {
      const error = new Error('配置不完整');
      await errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '代理服务器配置不完整',
        detail: '缺少必要的 apiUrl 或 apiKey 配置',
        suggestion: '请检查配置文件或使用配置向导完成设置',
        actions: ['打开配置', '使用动态路由模式']
      });
      throw error;
    }

    this.app = express();
    this.config = config;
    this.isDynamicMode = isDynamicMode;
    
    // 请求体解析中间件
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.text({ limit: '50mb' }));

    // 日志中间件
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      
      req.requestId = requestId;
      req.startTime = startTime;

      // 记录请求
      this.emit('request', {
        id: requestId,
        method: req.method,
        path: req.path,
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date()
      });

      // 响应完成后记录
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.emit('response', {
          id: requestId,
          status: res.statusCode,
          duration,
          timestamp: new Date()
        });
      });

      next();
    });

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        requests: this.requestCount,
        config: {
          target: config.apiUrl,
          model: config.model,
          openaiBaseUrl: config.openaiBaseUrl,
          bigModel: config.bigModel,
          middleModel: config.middleModel,
          smallModel: config.smallModel
        }
      });
    });

    // 统计信息端点
    this.app.get('/stats', (req, res) => {
      res.json(this.getStatistics());
    });

    // 动态路由处理
    if (this.isDynamicMode) {
      // 动态路由: /proxy/:service/:model/*
      this.app.use('/proxy/:service/:model/*', this.handleDynamicRoute.bind(this));
      
      // 兼容旧路由
      this.app.use('/v1/*', this.handleLegacyRoute.bind(this));
    } else {
      // 传统代理模式 - 只在非动态模式下创建代理中间件
      // 如果提供了 OPENAI_BASE_URL，则启用 Claude->OpenAI 转换路由
      if (config.openaiBaseUrl && config.openaiApiKey) {
        this.setupClaudeToOpenAIRoutes(config);
      }

      const proxyOptions = {
        target: config.apiUrl,
        changeOrigin: true,
        secure: true,
        timeout: config.requestTimeout || 120000,
        proxyTimeout: config.requestTimeout || 120000,
        
        // 配置请求体重写
        selfHandleResponse: false,
        
        // 请求预处理
        onProxyReq: (proxyReq, req, res) => {
          // 移除原始认证头
          proxyReq.removeHeader('authorization');
          proxyReq.removeHeader('x-api-key');
          
          // 设置新的认证信息
          if (config.apiKey.startsWith('Bearer ')) {
            proxyReq.setHeader('Authorization', config.apiKey);
          } else if (config.apiKey.startsWith('sk-')) {
            proxyReq.setHeader('x-api-key', config.apiKey);
          } else {
            proxyReq.setHeader('Authorization', `Bearer ${config.apiKey}`);
          }

          // 设置其他必要的头
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Accept', 'application/json');
          
          // 如果有请求体，需要重写
          if (req.body) {
            try {
              let bodyData = req.body;
              
              // 如果配置了自定义模型，修改请求体
              if (config.model) {
                const body = typeof bodyData === 'string' ? JSON.parse(bodyData) : bodyData;
                if (body && typeof body === 'object') {
                  body.model = config.model;
                  bodyData = body;
                }
              }
              
              // 将请求体写入代理请求
              const bodyStr = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
              proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyStr));
              proxyReq.write(bodyStr);
              proxyReq.end();
            } catch (e) {
              console.error('修改请求体失败:', e);
              // 如果失败，仍然转发原始请求体
              const originalBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
              proxyReq.setHeader('Content-Length', Buffer.byteLength(originalBody));
              proxyReq.write(originalBody);
              proxyReq.end();
            }
          }

          // 记录请求详情
          this.logRequest(req, config);
        },

        // 响应预处理
        onProxyRes: (proxyRes, req, res) => {
          // 记录响应
          let responseData = '';
          proxyRes.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          proxyRes.on('end', () => {
            try {
              const data = JSON.parse(responseData);
              // 统计 token 使用
              if (data.usage) {
                this.updateTokenUsage(data.usage, config);
              }
            } catch (e) {
              // 忽略解析错误
            }
          });

          // 添加自定义响应头
          proxyRes.headers['X-Proxy-By'] = 'Miaoda';
          proxyRes.headers['X-Request-Id'] = req.requestId;
        },

        // 错误处理
        onError: async (err, req, res) => {
          console.error('代理错误:', err);
          
          // 分析错误类型
          let errorType = ErrorTypes.NETWORK;
          let severity = ErrorSeverity.ERROR;
          let suggestion = '请稍后重试';
          let statusCode = 502;
          
          if (err.code === 'ECONNREFUSED') {
            errorType = ErrorTypes.NETWORK;
            suggestion = '目标服务器拒绝连接，请检查 API URL 是否正确';
            statusCode = 503;
          } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
            errorType = ErrorTypes.NETWORK;
            suggestion = '请求超时，请检查网络连接或稍后重试';
            statusCode = 504;
          } else if (err.code === 'ENOTFOUND') {
            errorType = ErrorTypes.NETWORK;
            suggestion = '无法解析目标服务器地址，请检查 API URL';
            statusCode = 502;
          } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            errorType = ErrorTypes.API;
            suggestion = '认证失败，请检查 API Key 是否正确';
            statusCode = 401;
          } else if (err.message?.includes('429') || err.message?.includes('rate limit')) {
            errorType = ErrorTypes.API;
            severity = ErrorSeverity.WARNING;
            suggestion = '请求频率过高，请稍后重试';
            statusCode = 429;
          }
          
          // 使用错误处理系统
          await errorHandler.handle({
            type: errorType,
            severity: severity,
            error: err,
            message: '代理请求失败',
            detail: err.message,
            suggestion: suggestion,
            context: {
              requestId: req.requestId,
              method: req.method,
              path: req.path,
              targetUrl: this.config?.apiUrl
            }
          });
          
          this.emit('error', {
            id: req.requestId,
            error: err.message,
            errorType,
            timestamp: new Date()
          });

          res.status(statusCode).json({
            error: '代理服务器错误',
            message: err.message,
            suggestion: suggestion,
            requestId: req.requestId,
            errorCode: err.code
          });
        }
      };

      // 创建代理中间件
      const proxy = createProxyMiddleware(proxyOptions);

      // 应用代理到所有 /v1/* 路径
      this.app.use('/v1', proxy);
      
      // 捕获所有其他请求
      this.app.use('*', proxy);
    }

    // 启动服务器
    return new Promise((resolve, reject) => {
      const host = config.serverHost || 'localhost';
      const port = typeof config.serverPort === 'number' ? config.serverPort : this.port;
      this.port = port; // 覆盖默认端口
      this.server = this.app.listen(port, host, () => {
        this.isRunning = true;
        this.statistics.startTime = new Date();
        
        this.emit('started', {
          port: this.port,
          target: config.apiUrl,
          timestamp: new Date()
        });

        resolve({
          success: true,
          port: this.port,
          url: `http://${host}:${this.port}`
        });
      });

      this.server.on('error', async (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，尝试下一个
          console.log(`端口 ${this.port} 被占用，尝试端口 ${this.port + 1}`);
          
          await errorHandler.handle({
            type: ErrorTypes.SYSTEM,
            severity: ErrorSeverity.INFO,
            error: err,
            message: `端口 ${this.port} 被占用`,
            detail: `自动切换到端口 ${this.port + 1}`,
            context: { 
              oldPort: this.port,
              newPort: this.port + 1,
              silent: true  // 不需要通知用户
            }
          });
          
          this.port++;
          this.server.close();
          this.start(config).then(resolve).catch(reject);
        } else {
          // 其他服务器错误
          await errorHandler.handle({
            type: ErrorTypes.SYSTEM,
            severity: ErrorSeverity.CRITICAL,
            error: err,
            message: '代理服务器启动失败',
            detail: err.message,
            suggestion: '请检查系统权限或联系技术支持',
            context: { port: this.port }
          });
          reject(err);
        }
      });
    });
  }

  /**
   * 停止代理服务器
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return { success: true, message: '代理服务器未在运行' };
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.app = null;
        this.server = null;
        
        this.emit('stopped', {
          statistics: this.getStatistics(),
          timestamp: new Date()
        });

        resolve({
          success: true,
          message: '代理服务器已停止'
        });
      });
    });
  }

  /**
   * 记录请求
   */
  logRequest(req, config) {
    this.requestCount++;
    
    const logEntry = {
      id: req.requestId,
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      model: config.model,
      headers: this.sanitizeHeaders(req.headers)
    };

    // 限制历史记录数量
    if (this.statistics.requests.length > 1000) {
      this.statistics.requests.shift();
    }
    
    this.statistics.requests.push(logEntry);
  }

  /**
   * 更新 Token 使用统计
   */
  updateTokenUsage(usage, config) {
    const tokens = usage.total_tokens || 0;
    this.totalTokens += tokens;

    // 计算费用（根据模型定价）
    const cost = this.calculateCost(tokens, config.model);
    this.statistics.totalCost += cost;

    this.emit('usage', {
      tokens,
      cost,
      totalTokens: this.totalTokens,
      totalCost: this.statistics.totalCost,
      timestamp: new Date()
    });
  }

  /**
   * 计算费用
   */
  calculateCost(tokens, model) {
    // 定价表（美元/1K tokens）
    const pricing = {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-3-7-sonnet-20250219': { input: 0.003, output: 0.015 }
    };

    const modelPricing = pricing[model] || pricing['claude-3-sonnet-20240229'];
    // 简化计算，假设输入输出各占一半
    const avgPrice = (modelPricing.input + modelPricing.output) / 2;
    return (tokens / 1000) * avgPrice;
  }

  /**
   * 清理敏感头信息
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***';
      }
    });

    return sanitized;
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const uptime = this.statistics.startTime 
      ? Date.now() - this.statistics.startTime.getTime() 
      : 0;

    return {
      totalRequests: this.requestCount,  // 使用 totalRequests 以保持向后兼容
      requestCount: this.requestCount,
      totalTokens: this.totalTokens,
      totalCost: this.statistics.totalCost.toFixed(4),
      uptime: Math.floor(uptime / 1000), // 秒
      averageTokensPerRequest: this.requestCount > 0 
        ? Math.floor(this.totalTokens / this.requestCount) 
        : 0,
      recentRequests: this.statistics.requests.slice(-10).reverse()
    };
  }

  /**
   * 获取代理 URL
   */
  getProxyUrl() {
    return this.isRunning ? `http://localhost:${this.port}` : null;
  }

  /**
   * 处理动态路由请求
   */
  async handleDynamicRoute(req, res) {
    try {
      // 解析路由参数
      const { service: serviceId, model } = req.params;
      const apiPath = req.params[0] || '';
      
      // 从请求头或查询参数获取 API Key
      const apiKey = req.headers['x-api-key'] || 
                     req.headers['authorization']?.replace('Bearer ', '') ||
                     req.query.key;

      if (!apiKey) {
        await errorHandler.handle({
          type: ErrorTypes.API,
          severity: ErrorSeverity.WARNING,
          message: '缺少 API Key',
          detail: '请在请求头或查询参数中提供 API Key',
          suggestion: '添加 Authorization 头或 x-api-key 头，或在 URL 中添加 ?key=YOUR_KEY',
          context: {
            requestId: req.requestId,
            service: serviceId,
            model
          }
        });
        
        return res.status(401).json({
          error: 'API Key required',
          message: 'Please provide API key in header or query parameter',
          suggestion: 'Add Authorization or x-api-key header, or add ?key=YOUR_KEY to URL'
        });
      }

      // 获取服务配置
      const service = serviceRegistry.get(serviceId);
      if (!service) {
        const availableServices = serviceRegistry.getServiceList();
        
        await errorHandler.handle({
          type: ErrorTypes.VALIDATION,
          severity: ErrorSeverity.WARNING,
          message: '未知的 AI 服务',
          detail: `服务 "${serviceId}" 不存在`,
          suggestion: `请使用以下可用服务之一: ${availableServices.join(', ')}`,
          context: {
            requestId: req.requestId,
            requestedService: serviceId,
            availableServices
          }
        });
        
        return res.status(404).json({
          error: 'Service not found',
          message: `Unknown service: ${serviceId}`,
          availableServices: availableServices,
          suggestion: `Try one of these: ${availableServices.join(', ')}`
        });
      }

      // 记录请求
      this.requestCount++;  // 增加请求计数
      this.emit('dynamic-request', {
        service: serviceId,
        model,
        path: apiPath,
        timestamp: new Date()
      });

      // 构建目标 URL
      const targetUrl = serviceRegistry.buildUrl(serviceId, 'chat', { model });
      
      // 获取认证头
      const authHeaders = serviceRegistry.getAuthHeaders(serviceId, apiKey);

      // 检测并转换请求格式
      const sourceFormat = formatConverter.detectRequestFormat(req.body);
      const targetFormat = service.format;
      
      let convertedBody = req.body;
      if (sourceFormat !== targetFormat) {
        convertedBody = await formatConverter.convertRequest(
          sourceFormat, 
          targetFormat, 
          req.body
        );
      }

      // 设置模型
      if (model && convertedBody) {
        convertedBody.model = model;
      }

      // 发起请求（带重试机制）
      const response = await this.forwardRequestWithRetry({
        url: targetUrl,
        method: req.method,
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(convertedBody)
      }, {
        maxRetries: service.maxRetries || 3,
        retryDelay: service.retryDelay || 1000
      });

      // 转换响应格式
      let responseData = response.data;
      if (sourceFormat !== targetFormat) {
        responseData = await formatConverter.convertResponse(
          targetFormat,
          sourceFormat,
          response.data
        );
      }

      // 更新统计
      if (responseData.usage) {
        this.updateTokenUsage(responseData.usage, { model, service: serviceId });
      }

      res.status(response.status).json(responseData);
    } catch (error) {
      console.error('动态路由错误:', error);
      
      // 分析错误类型并提供有用的反馈
      let errorType = ErrorTypes.UNKNOWN;
      let severity = ErrorSeverity.ERROR;
      let statusCode = 500;
      let suggestion = '请稍后重试';
      
      if (error.code === 'ECONNREFUSED') {
        errorType = ErrorTypes.NETWORK;
        statusCode = 503;
        suggestion = `无法连接到 ${serviceId} 服务，请检查服务是否正常运行`;
      } else if (error.code === 'ETIMEDOUT') {
        errorType = ErrorTypes.NETWORK;
        statusCode = 504;
        suggestion = '请求超时，请检查网络连接或稍后重试';
      } else if (error.message?.includes('format')) {
        errorType = ErrorTypes.VALIDATION;
        statusCode = 400;
        suggestion = '请求格式转换失败，请检查请求内容';
      } else if (error.response?.status === 401) {
        errorType = ErrorTypes.API;
        statusCode = 401;
        suggestion = '认证失败，请检查 API Key 是否有效';
      } else if (error.response?.status === 429) {
        errorType = ErrorTypes.API;
        severity = ErrorSeverity.WARNING;
        statusCode = 429;
        suggestion = '请求频率超限，请稍后重试';
      }
      
      await errorHandler.handle({
        type: errorType,
        severity: severity,
        error: error,
        message: '动态路由处理失败',
        detail: error.message,
        suggestion: suggestion,
        context: {
          requestId: req.requestId,
          service: serviceId,
          model: model,
          path: apiPath,
          statusCode: error.response?.status
        }
      });
      
      res.status(statusCode).json({
        error: 'Proxy error',
        message: error.message,
        suggestion: suggestion,
        requestId: req.requestId,
        service: serviceId,
        errorCode: error.code
      });
    }
  }

  /**
   * 处理旧版路由（兼容性）
   */
  async handleLegacyRoute(req, res) {
    // 使用默认配置处理
    if (!this.config) {
      return res.status(503).json({
        error: 'No default configuration',
        message: 'Please use dynamic routing: /proxy/:service/:model/*'
      });
    }

    // 使用原有的代理逻辑
    // ... 现有的代理逻辑
  }

  /**
   * 带重试机制的请求转发
   */
  async forwardRequestWithRetry(options, retryConfig = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ESOCKETTIMEDOUT'],
      retryableStatuses = [502, 503, 504]
    } = retryConfig;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.forwardRequest(options);
        
        // 检查是否需要重试的状态码
        if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
          console.log(`请求失败 (状态码: ${response.status})，${attempt}/${maxRetries} 次尝试，${retryDelay}ms 后重试...`);
          
          await errorHandler.handle({
            type: ErrorTypes.NETWORK,
            severity: ErrorSeverity.INFO,
            message: '请求失败，正在重试',
            detail: `状态码: ${response.status}，尝试 ${attempt}/${maxRetries}`,
            context: {
              url: options.url,
              attempt,
              maxRetries,
              statusCode: response.status,
              silent: true
            }
          });
          
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // 检查是否是可重试的错误
        if (retryableErrors.includes(error.code) && attempt < maxRetries) {
          console.log(`请求失败 (${error.code})，${attempt}/${maxRetries} 次尝试，${retryDelay}ms 后重试...`);
          
          await errorHandler.handle({
            type: ErrorTypes.NETWORK,
            severity: ErrorSeverity.INFO,
            message: '网络错误，正在重试',
            detail: `错误代码: ${error.code}，尝试 ${attempt}/${maxRetries}`,
            context: {
              url: options.url,
              attempt,
              maxRetries,
              errorCode: error.code,
              silent: true
            }
          });
          
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        
        // 不可重试的错误，直接抛出
        throw error;
      }
    }
    
    // 所有重试都失败
    await errorHandler.handle({
      type: ErrorTypes.NETWORK,
      severity: ErrorSeverity.ERROR,
      error: lastError,
      message: '请求失败，已达到最大重试次数',
      detail: `尝试了 ${maxRetries} 次后仍然失败`,
      suggestion: '请检查网络连接或稍后再试',
      context: {
        url: options.url,
        maxRetries,
        lastError: lastError.message
      }
    });
    
    throw lastError;
  }

  /**
   * 转发请求
   */
  async forwardRequest(options) {
    const https = require('https');
    const http = require('http');
    const url = new URL(options.url);
    const isHttps = url.protocol === 'https:';

    return new Promise((resolve, reject) => {
      const client = isHttps ? https : http;
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method,
        headers: options.headers
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: jsonData
            });
          } catch (e) {
            // 如果响应不是 JSON，返回原始数据
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: data
              });
            } else {
              // 错误响应，尝试解析错误信息
              const errorInfo = {
                status: res.statusCode,
                headers: res.headers,
                data: {
                  error: 'Response parse error',
                  message: data || `HTTP ${res.statusCode} ${res.statusMessage}`,
                  originalResponse: data.substring(0, 500) // 限制长度
                }
              };
              resolve(errorInfo);
            }
          }
        });
      });

      req.on('error', (error) => {
        // 增强错误信息
        error.url = options.url;
        error.method = options.method;
        reject(error);
      });
      
      // 设置请求超时
      req.setTimeout(120000, () => {
        req.destroy();
        const timeoutError = new Error('Request timeout after 120 seconds');
        timeoutError.code = 'ETIMEDOUT';
        timeoutError.url = options.url;
        reject(timeoutError);
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
  
  /**
   * 初始化智能错误处理系统
   */
  initializeIntelligentErrorHandling() {
    if (!this.intelligentErrorHandling.enabled) {
      console.log('Intelligent error handling is disabled');
      return;
    }
    
    console.log('Initializing intelligent error handling system...');
    
    try {
      // 1. 设置错误预测器
      if (this.intelligentErrorHandling.predictionEnabled) {
        this.setupErrorPredictor();
      }
      
      // 2. 设置自动恢复管理器
      if (this.intelligentErrorHandling.autoRecoveryEnabled) {
        this.setupAutoRecoveryManager();
      }
      
      // 3. 设置健康监控器
      if (this.intelligentErrorHandling.healthMonitoringEnabled) {
        this.setupHealthMonitor();
      }
      
      // 4. 设置上下文分析器
      if (this.intelligentErrorHandling.contextAnalysisEnabled) {
        this.setupContextAnalyzer();
      }
      
      // 5. 设置智能错误处理流程
      this.setupIntelligentErrorFlow();
      
      console.log('Intelligent error handling system initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize intelligent error handling:', error);
      // 降级到基础错误处理
      this.intelligentErrorHandling.enabled = false;
    }
  }
  
  /**
   * 设置错误预测器
   */
  setupErrorPredictor() {
    // 监听错误事件，向错误预测器提供数据
    this.on('error', (error) => {
      if (errorPredictor && typeof errorPredictor.recordError === 'function') {
        errorPredictor.recordError(error);
      }
    });
    
    // 监听预测事件
    errorPredictor.on('prediction', (prediction) => {
      console.log('Error prediction generated:', {
        type: prediction.type,
        confidence: prediction.confidence,
        prediction: prediction.prediction
      });
      
      // 发出预测事件供其他组件使用
      this.emit('error-prediction', prediction);
      
      // 如果预测风险等级较高，主动触发预防措施
      if (prediction.riskLevel === 'critical' && prediction.confidence > 0.8) {
        this.handleHighRiskPrediction(prediction);
      }
    });
  }
  
  /**
   * 设置自动恢复管理器
   */
  setupAutoRecoveryManager() {
    // 监听恢复完成事件
    autoRecoveryManager.on('recovery-completed', (result) => {
      console.log('Auto recovery completed:', {
        recovered: result.recovered,
        strategiesExecuted: result.strategiesExecuted,
        duration: result.duration
      });
      
      this.emit('auto-recovery-completed', result);
    });
    
    // 监听确认请求事件
    autoRecoveryManager.on('confirmation-required', (request) => {
      console.log('Recovery confirmation required:', request.strategy);
      
      // 这里可以实现用户确认逻辑
      // 目前自动同意非关键恢复策略
      const autoApprove = !request.strategy.includes('restart') && 
                         !request.strategy.includes('reset');
      
      setTimeout(() => {
        request.callback(autoApprove);
      }, 1000);
    });
  }
  
  /**
   * 设置健康监控器
   */
  setupHealthMonitor() {
    // 启动健康监控
    healthMonitor.start();
    
    // 监听健康状态变化
    healthMonitor.on('health-status-changed', (status) => {
      console.log('Health status changed:', {
        previous: status.previous,
        current: status.current,
        issues: status.issues.length
      });
      
      this.emit('health-status-changed', status);
      
      // 如果健康状态恶化，触发预防措施
      if (status.current === 'critical') {
        this.handleCriticalHealthStatus(status);
      }
    });
    
    // 监听健康告警
    healthMonitor.on('health-alert', (alert) => {
      console.log('Health alert triggered:', {
        status: alert.status,
        issues: alert.issues.length
      });
      
      this.emit('health-alert', alert);
    });
  }
  
  /**
   * 设置上下文分析器
   */
  setupContextAnalyzer() {
    // 监听分析完成事件
    contextAnalyzer.on('analysis-completed', (result) => {
      console.log('Context analysis completed:', {
        confidence: result.confidence,
        riskLevel: result.insights.summary.riskLevel,
        primaryFactors: result.insights.summary.primaryFactors
      });
      
      this.emit('context-analysis-completed', result);
    });
  }
  
  /**
   * 设置智能错误处理流程
   */
  setupIntelligentErrorFlow() {
    // 重写错误处理器的处理方法以集成智能功能
    const originalHandle = errorHandler.handle.bind(errorHandler);
    
    errorHandler.handle = async (errorInfo) => {
      try {
        // 1. 首先执行原始错误处理
        await originalHandle(errorInfo);
        
        // 2. 如果启用了智能处理，执行增强处理
        if (this.intelligentErrorHandling.enabled) {
          await this.handleErrorIntelligently(errorInfo);
        }
        
      } catch (error) {
        console.error('Error in intelligent error handling:', error);
        // 确保原始错误处理仍然执行
        await originalHandle(errorInfo);
      }
    };
  }
  
  /**
   * 智能错误处理
   */
  async handleErrorIntelligently(errorInfo) {
    const startTime = Date.now();
    console.log(`Starting intelligent error handling for: ${errorInfo.message}`);
    
    try {
      // 1. 上下文分析
      let contextAnalysis = null;
      if (this.intelligentErrorHandling.contextAnalysisEnabled) {
        try {
          contextAnalysis = await contextAnalyzer.analyzeContext(errorInfo, {
            proxyServerState: this.getProxyServerState(),
            requestContext: this.getCurrentRequestContext()
          });
        } catch (error) {
          console.error('Context analysis failed:', error);
        }
      }
      
      // 2. 尝试自动恢复
      let recoveryResult = null;
      if (this.intelligentErrorHandling.autoRecoveryEnabled) {
        try {
          recoveryResult = await autoRecoveryManager.handleError(errorInfo, {
            contextAnalysis,
            proxyServer: this
          });
        } catch (error) {
          console.error('Auto recovery failed:', error);
        }
      }
      
      // 3. 记录错误到预测器
      if (this.intelligentErrorHandling.predictionEnabled) {
        try {
          errorPredictor.recordError({
            ...errorInfo,
            contextAnalysis,
            recoveryResult,
            proxyServerState: this.getProxyServerState()
          });
        } catch (error) {
          console.error('Error prediction recording failed:', error);
        }
      }
      
      // 4. 生成智能错误报告
      const report = this.generateIntelligentErrorReport(
        errorInfo,
        contextAnalysis,
        recoveryResult
      );
      
      console.log(`Intelligent error handling completed in ${Date.now() - startTime}ms:`, {
        contextAnalyzed: !!contextAnalysis,
        recoveryAttempted: !!recoveryResult,
        recovered: recoveryResult?.recovered || false
      });
      
      // 发出智能处理完成事件
      this.emit('intelligent-error-handled', {
        errorInfo,
        contextAnalysis,
        recoveryResult,
        report,
        duration: Date.now() - startTime
      });
      
      return report;
      
    } catch (error) {
      console.error('Intelligent error handling failed:', error);
      return null;
    }
  }
  
  /**
   * 处理高风险预测
   */
  async handleHighRiskPrediction(prediction) {
    console.log('Handling high risk prediction:', prediction.prediction);
    
    try {
      // 基于预测类型采取预防措施
      switch (prediction.type) {
        case 'pattern':
          await this.handlePatternBasedPrediction(prediction);
          break;
        case 'ml':
          await this.handleMLBasedPrediction(prediction);
          break;
        case 'temporal':
          await this.handleTemporalPrediction(prediction);
          break;
        case 'system':
          await this.handleSystemHealthPrediction(prediction);
          break;
      }
      
    } catch (error) {
      console.error('Failed to handle high risk prediction:', error);
    }
  }
  
  /**
   * 处理模式基础预测
   */
  async handlePatternBasedPrediction(prediction) {
    // 根据预测的模式采取预防措施
    if (prediction.pattern === 'NETWORK_INSTABILITY') {
      console.log('Detected network instability prediction, adjusting timeouts');
      // 可以调整网络超时设置
    } else if (prediction.pattern === 'API_RATE_LIMITING') {
      console.log('Detected rate limiting prediction, implementing backoff');
      // 可以预防性地实施退避策略
    }
  }
  
  /**
   * 处理机器学习预测
   */
  async handleMLBasedPrediction(prediction) {
    console.log('Handling ML-based prediction with confidence:', prediction.confidence);
    // 可以根据ML预测调整系统参数
  }
  
  /**
   * 处理时序预测
   */
  async handleTemporalPrediction(prediction) {
    console.log('Handling temporal prediction:', prediction.prediction);
    // 可以基于时间趋势调整监控频率
  }
  
  /**
   * 处理系统健康预测
   */
  async handleSystemHealthPrediction(prediction) {
    console.log('Handling system health prediction:', prediction.prediction);
    
    // 触发强制健康检查
    if (healthMonitor.isRunning) {
      try {
        await healthMonitor.forceHealthCheck();
      } catch (error) {
        console.error('Failed to force health check:', error);
      }
    }
  }
  
  /**
   * 处理关键健康状态
   */
  async handleCriticalHealthStatus(status) {
    console.log('Handling critical health status with issues:', status.issues.length);
    
    try {
      // 尝试自动缓解关键健康问题
      for (const issue of status.issues) {
        if (issue.component === 'SYSTEM_RESOURCES') {
          // 触发资源清理
          if (global.gc) {
            global.gc();
          }
        } else if (issue.component === 'NETWORK_CONNECTIVITY') {
          // 重置网络连接
          console.log('Network connectivity issue detected, implementing recovery');
        }
      }
      
    } catch (error) {
      console.error('Failed to handle critical health status:', error);
    }
  }
  
  /**
   * 获取代理服务器状态
   */
  getProxyServerState() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      requestCount: this.requestCount,
      totalTokens: this.totalTokens,
      uptime: this.statistics.startTime ? Date.now() - this.statistics.startTime.getTime() : 0,
      statistics: this.getStatistics()
    };
  }
  
  /**
   * 获取当前请求上下文
   */
  getCurrentRequestContext() {
    return {
      activeRequests: this.statistics.requests?.length || 0,
      recentRequests: this.statistics.requests?.slice(-5) || [],
      timestamp: Date.now()
    };
  }
  
  /**
   * 生成智能错误报告
   */
  generateIntelligentErrorReport(errorInfo, contextAnalysis, recoveryResult) {
    const report = {
      timestamp: Date.now(),
      errorSummary: {
        id: errorInfo.id,
        type: errorInfo.type,
        severity: errorInfo.severity,
        message: errorInfo.message
      },
      analysis: {
        contextAnalyzed: !!contextAnalysis,
        confidence: contextAnalysis?.confidence || 0,
        riskLevel: contextAnalysis?.insights?.summary?.riskLevel || 'unknown',
        primaryFactors: contextAnalysis?.insights?.summary?.primaryFactors || []
      },
      recovery: {
        attempted: !!recoveryResult,
        recovered: recoveryResult?.recovered || false,
        strategiesExecuted: recoveryResult?.strategiesExecuted || 0,
        duration: recoveryResult?.duration || 0
      },
      recommendations: [
        ...(contextAnalysis?.insights?.recommendations || []),
        ...(recoveryResult?.results?.map(r => r.strategy) || [])
      ]
    };
    
    return report;
  }
  
  /**
   * 获取智能错误处理统计
   */
  getIntelligentErrorHandlingStats() {
    const stats = {
      enabled: this.intelligentErrorHandling.enabled,
      components: {
        errorPredictor: {
          enabled: this.intelligentErrorHandling.predictionEnabled,
          stats: errorPredictor.getStatistics ? errorPredictor.getStatistics() : {}
        },
        autoRecoveryManager: {
          enabled: this.intelligentErrorHandling.autoRecoveryEnabled,
          stats: autoRecoveryManager.getStatistics ? autoRecoveryManager.getStatistics() : {}
        },
        healthMonitor: {
          enabled: this.intelligentErrorHandling.healthMonitoringEnabled,
          stats: healthMonitor.getStatistics ? healthMonitor.getStatistics() : {}
        },
        contextAnalyzer: {
          enabled: this.intelligentErrorHandling.contextAnalysisEnabled,
          stats: contextAnalyzer.getStatistics ? contextAnalyzer.getStatistics() : {}
        }
      }
    };
    
    return stats;
  }
  
  /**
   * 更新智能错误处理配置
   */
  updateIntelligentErrorHandlingConfig(newConfig) {
    this.intelligentErrorHandling = {
      ...this.intelligentErrorHandling,
      ...newConfig
    };
    
    // 通知各个组件配置更新
    if (errorPredictor.updateConfig) {
      errorPredictor.updateConfig(newConfig.errorPredictor || {});
    }
    
    if (autoRecoveryManager.updateConfig) {
      autoRecoveryManager.updateConfig(newConfig.autoRecoveryManager || {});
    }
    
    if (healthMonitor.updateConfig) {
      healthMonitor.updateConfig(newConfig.healthMonitor || {});
    }
    
    if (contextAnalyzer.updateConfig) {
      contextAnalyzer.updateConfig(newConfig.contextAnalyzer || {});
    }
    
    console.log('Intelligent error handling configuration updated');
    this.emit('intelligent-config-updated', this.intelligentErrorHandling);
  }
}

// 导出单例
module.exports = new ProxyServer();