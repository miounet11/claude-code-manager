'use strict';

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const EventEmitter = require('events');
const crypto = require('crypto');
const serviceRegistry = require('./service-registry');
const formatConverter = require('./format-converter');

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
  }

  /**
   * 启动代理服务器
   */
  async start(config) {
    if (this.isRunning) {
      throw new Error('代理服务器已在运行');
    }

    // 动态路由模式可以没有固定配置
    const isDynamicMode = !config || config.mode === 'dynamic';

    if (!isDynamicMode && (!config || !config.apiUrl || !config.apiKey)) {
      throw new Error('配置不完整');
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
          model: config.model
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
      const proxyOptions = {
        target: config.apiUrl,
        changeOrigin: true,
        secure: true,
        timeout: 120000, // 2分钟超时
        proxyTimeout: 120000,
        
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
        onError: (err, req, res) => {
          console.error('代理错误:', err);
          this.emit('error', {
            id: req.requestId,
            error: err.message,
            timestamp: new Date()
          });

          res.status(502).json({
            error: '代理服务器错误',
            message: err.message,
            requestId: req.requestId
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
      this.server = this.app.listen(this.port, 'localhost', () => {
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
          url: `http://localhost:${this.port}`
        });
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用，尝试下一个
          this.port++;
          this.server.close();
          this.start(config).then(resolve).catch(reject);
        } else {
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
        return res.status(401).json({
          error: 'API Key required',
          message: 'Please provide API key in header or query parameter'
        });
      }

      // 获取服务配置
      const service = serviceRegistry.get(serviceId);
      if (!service) {
        return res.status(404).json({
          error: 'Service not found',
          message: `Unknown service: ${serviceId}`,
          availableServices: serviceRegistry.getServiceList()
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

      // 发起请求
      const response = await this.forwardRequest({
        url: targetUrl,
        method: req.method,
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(convertedBody)
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
      res.status(500).json({
        error: 'Proxy error',
        message: error.message
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
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
}

// 导出单例
module.exports = new ProxyServer();