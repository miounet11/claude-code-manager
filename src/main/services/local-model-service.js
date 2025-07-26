'use strict';

const http = require('http');
const EventEmitter = require('events');

/**
 * 本地模型服务
 * 管理和检测本地运行的 AI 模型服务（如 Ollama）
 */
class LocalModelService extends EventEmitter {
  constructor() {
    super();
    
    // 支持的本地服务配置
    this.services = {
      ollama: {
        name: 'Ollama',
        baseUrl: 'http://localhost:11434',
        healthEndpoint: '/api/tags',
        modelsEndpoint: '/api/tags',
        chatEndpoint: '/api/chat',
        generateEndpoint: '/api/generate',
        pullEndpoint: '/api/pull'
      },
      lmstudio: {
        name: 'LM Studio',
        baseUrl: 'http://localhost:1234',
        healthEndpoint: '/v1/models',
        modelsEndpoint: '/v1/models',
        chatEndpoint: '/v1/chat/completions'
      },
      localai: {
        name: 'LocalAI',
        baseUrl: 'http://localhost:8080',
        healthEndpoint: '/v1/models',
        modelsEndpoint: '/v1/models',
        chatEndpoint: '/v1/chat/completions'
      }
    };
    
    // 检测状态缓存
    this.statusCache = new Map();
    this.checkInterval = null;
  }

  /**
   * 检测所有本地服务
   */
  async detectAll() {
    const results = {};
    
    for (const [id, config] of Object.entries(this.services)) {
      results[id] = await this.detectService(id);
    }
    
    return results;
  }

  /**
   * 检测特定服务
   */
  async detectService(serviceId) {
    const config = this.services[serviceId];
    if (!config) {
      return { available: false, error: 'Unknown service' };
    }
    
    try {
      // 尝试访问健康检查端点
      const response = await this.makeRequest({
        url: config.baseUrl + config.healthEndpoint,
        method: 'GET',
        timeout: 2000
      });
      
      if (response.status === 200) {
        // 获取模型列表
        const models = await this.getModels(serviceId);
        
        const result = {
          available: true,
          service: config.name,
          baseUrl: config.baseUrl,
          models: models,
          timestamp: new Date()
        };
        
        // 缓存结果
        this.statusCache.set(serviceId, result);
        
        // 发送事件
        this.emit('service-detected', {
          serviceId,
          ...result
        });
        
        return result;
      }
      
      return { available: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return {
        available: false,
        error: error.message || 'Connection failed'
      };
    }
  }

  /**
   * 获取模型列表
   */
  async getModels(serviceId) {
    const config = this.services[serviceId];
    if (!config) return [];
    
    try {
      const response = await this.makeRequest({
        url: config.baseUrl + config.modelsEndpoint,
        method: 'GET'
      });
      
      if (response.status !== 200) return [];
      
      const data = JSON.parse(response.data);
      
      // 根据不同服务解析模型列表
      switch (serviceId) {
        case 'ollama':
          return this.parseOllamaModels(data);
        case 'lmstudio':
        case 'localai':
          return this.parseOpenAIModels(data);
        default:
          return [];
      }
    } catch (error) {
      console.error(`获取 ${serviceId} 模型列表失败:`, error);
      return [];
    }
  }

  /**
   * 解析 Ollama 模型格式
   */
  parseOllamaModels(data) {
    if (!data.models || !Array.isArray(data.models)) return [];
    
    return data.models.map(model => ({
      id: model.name,
      name: model.name,
      size: this.formatSize(model.size),
      modified: model.modified_at,
      details: {
        families: model.details?.families,
        parameter_size: model.details?.parameter_size,
        quantization_level: model.details?.quantization_level
      }
    }));
  }

  /**
   * 解析 OpenAI 兼容格式
   */
  parseOpenAIModels(data) {
    if (!data.data || !Array.isArray(data.data)) return [];
    
    return data.data.map(model => ({
      id: model.id,
      name: model.id,
      created: new Date(model.created * 1000),
      owned_by: model.owned_by
    }));
  }

  /**
   * 拉取模型（仅 Ollama 支持）
   */
  async pullModel(modelName, onProgress) {
    const config = this.services.ollama;
    
    try {
      const response = await this.makeStreamRequest({
        url: config.baseUrl + config.pullEndpoint,
        method: 'POST',
        body: JSON.stringify({ name: modelName }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // 处理流式响应
      return new Promise((resolve, reject) => {
        let buffer = '';
        
        response.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留不完整的行
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (onProgress) {
                  onProgress(data);
                }
                
                if (data.status === 'success') {
                  resolve({ success: true });
                } else if (data.error) {
                  reject(new Error(data.error));
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });
        
        response.on('end', () => {
          resolve({ success: true });
        });
        
        response.on('error', reject);
      });
    } catch (error) {
      throw new Error(`拉取模型失败: ${error.message}`);
    }
  }

  /**
   * 删除模型（仅 Ollama 支持）
   */
  async deleteModel(modelName) {
    const config = this.services.ollama;
    
    try {
      const response = await this.makeRequest({
        url: config.baseUrl + '/api/delete',
        method: 'DELETE',
        body: JSON.stringify({ name: modelName }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.status === 200;
    } catch (error) {
      throw new Error(`删除模型失败: ${error.message}`);
    }
  }

  /**
   * 开始定期检测
   */
  startPeriodicDetection(interval = 30000) {
    this.stopPeriodicDetection();
    
    // 立即执行一次
    this.detectAll();
    
    // 设置定时器
    this.checkInterval = setInterval(() => {
      this.detectAll();
    }, interval);
  }

  /**
   * 停止定期检测
   */
  stopPeriodicDetection() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 获取缓存的状态
   */
  getCachedStatus(serviceId) {
    return this.statusCache.get(serviceId);
  }

  /**
   * 获取所有缓存状态
   */
  getAllCachedStatus() {
    const result = {};
    for (const [id, status] of this.statusCache) {
      result[id] = status;
    }
    return result;
  }

  /**
   * 发送 HTTP 请求
   */
  async makeRequest(options) {
    return new Promise((resolve, reject) => {
      const url = new URL(options.url);
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 5000
      };
      
      const req = http.request(reqOptions, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.abort();
        reject(new Error('Request timeout'));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * 发送流式请求
   */
  makeStreamRequest(options) {
    return new Promise((resolve, reject) => {
      const url = new URL(options.url);
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      
      const req = http.request(reqOptions, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(res);
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 测试与本地服务的连接
   */
  async testConnection(serviceId) {
    const config = this.services[serviceId];
    if (!config) {
      return {
        success: false,
        message: '未知的服务'
      };
    }
    
    const result = await this.detectService(serviceId);
    
    if (result.available) {
      return {
        success: true,
        message: `成功连接到 ${config.name}`,
        models: result.models || []
      };
    } else {
      return {
        success: false,
        message: `无法连接到 ${config.name}: ${result.error}`,
        hint: `请确保 ${config.name} 正在运行于 ${config.baseUrl}`
      };
    }
  }
}

// 导出单例
module.exports = new LocalModelService();