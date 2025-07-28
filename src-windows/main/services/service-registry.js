'use strict';

/**
 * AI 服务注册表
 * 管理所有支持的 AI 服务配置
 */
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.initializeDefaultServices();
  }

  /**
   * 初始化默认服务
   */
  initializeDefaultServices() {
    // OpenAI
    this.register({
      id: 'openai',
      name: 'OpenAI',
      displayName: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      authType: 'bearer',
      authHeader: 'Authorization',
      authPrefix: 'Bearer',
      endpoints: {
        chat: '/v1/chat/completions',
        completion: '/v1/completions',
        embedding: '/v1/embeddings',
        models: '/v1/models'
      },
      models: [
        { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', context: 128000 },
        { id: 'gpt-4', name: 'GPT-4', context: 8192 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', context: 4096 },
        { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', context: 16384 }
      ],
      format: 'openai',
      streaming: true
    });

    // Anthropic Claude
    this.register({
      id: 'claude',
      name: 'Claude',
      displayName: 'Anthropic Claude',
      baseUrl: 'https://api.anthropic.com',
      authType: 'api-key',
      authHeader: 'x-api-key',
      authPrefix: '',
      endpoints: {
        chat: '/v1/messages',
        models: '/v1/models'
      },
      models: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', context: 200000 },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', context: 200000 },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', context: 200000 },
        { id: 'claude-2.1', name: 'Claude 2.1', context: 100000 },
        { id: 'claude-instant-1.2', name: 'Claude Instant', context: 100000 }
      ],
      format: 'claude',
      streaming: true,
      headers: {
        'anthropic-version': '2023-06-01'
      }
    });

    // Google Gemini
    this.register({
      id: 'gemini',
      name: 'Gemini',
      displayName: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      authType: 'api-key',
      authHeader: 'x-goog-api-key',
      authPrefix: '',
      endpoints: {
        chat: '/v1beta/models/{model}:generateContent',
        models: '/v1beta/models'
      },
      models: [
        { id: 'gemini-pro', name: 'Gemini Pro', context: 30720 },
        { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', context: 30720 }
      ],
      format: 'gemini',
      streaming: true
    });

    // Groq
    this.register({
      id: 'groq',
      name: 'Groq',
      displayName: 'Groq Cloud',
      baseUrl: 'https://api.groq.com/openai',
      authType: 'bearer',
      authHeader: 'Authorization',
      authPrefix: 'Bearer',
      endpoints: {
        chat: '/v1/chat/completions',
        models: '/v1/models'
      },
      models: [
        { id: 'llama2-70b-4096', name: 'LLaMA2 70B', context: 4096 },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', context: 32768 },
        { id: 'gemma-7b-it', name: 'Gemma 7B', context: 8192 }
      ],
      format: 'openai',
      streaming: true
    });

    // Ollama (本地)
    this.register({
      id: 'ollama',
      name: 'Ollama',
      displayName: 'Ollama (Local)',
      baseUrl: 'http://localhost:11434',
      authType: 'none',
      endpoints: {
        chat: '/api/chat',
        generate: '/api/generate',
        models: '/api/tags'
      },
      models: [], // 动态获取
      format: 'ollama',
      streaming: true,
      isLocal: true
    });

    // Perplexity
    this.register({
      id: 'perplexity',
      name: 'Perplexity',
      displayName: 'Perplexity AI',
      baseUrl: 'https://api.perplexity.ai',
      authType: 'bearer',
      authHeader: 'Authorization',
      authPrefix: 'Bearer',
      endpoints: {
        chat: '/chat/completions'
      },
      models: [
        { id: 'pplx-7b-online', name: 'Perplexity 7B Online', context: 4096 },
        { id: 'pplx-70b-online', name: 'Perplexity 70B Online', context: 4096 },
        { id: 'codellama-34b-instruct', name: 'CodeLlama 34B', context: 16384 }
      ],
      format: 'openai',
      streaming: true
    });

    // 自定义服务模板
    this.register({
      id: 'custom',
      name: 'Custom',
      displayName: '自定义服务',
      baseUrl: '',
      authType: 'custom',
      endpoints: {
        chat: '/v1/chat/completions'
      },
      models: [],
      format: 'openai',
      streaming: false,
      isTemplate: true
    });
  }

  /**
   * 注册服务
   */
  register(service) {
    this.services.set(service.id, service);
  }

  /**
   * 获取服务配置
   */
  get(serviceId) {
    return this.services.get(serviceId);
  }

  /**
   * 获取所有服务
   */
  getAll() {
    return Array.from(this.services.values());
  }

  /**
   * 获取服务列表（用于 UI）
   */
  getServiceList() {
    return this.getAll()
      .filter(s => !s.isTemplate)
      .map(s => ({
        id: s.id,
        name: s.displayName,
        baseUrl: s.baseUrl,
        isLocal: s.isLocal || false
      }));
  }

  /**
   * 获取服务的模型列表
   */
  async getModels(serviceId) {
    const service = this.get(serviceId);
    if (!service) return [];

    // Ollama 需要动态获取
    if (service.id === 'ollama' && service.isLocal) {
      return await this.fetchOllamaModels(service);
    }

    return service.models || [];
  }

  /**
   * 获取 Ollama 模型列表
   */
  async fetchOllamaModels(service) {
    try {
      const response = await fetch(`${service.baseUrl}${service.endpoints.models}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models?.map(model => ({
        id: model.name,
        name: model.name,
        context: model.context_length || 2048,
        size: model.size
      })) || [];
    } catch (error) {
      console.error('获取 Ollama 模型失败:', error);
      return [];
    }
  }

  /**
   * 构建请求 URL
   */
  buildUrl(serviceId, endpoint, params = {}) {
    const service = this.get(serviceId);
    if (!service) throw new Error(`未知服务: ${serviceId}`);

    let url = service.baseUrl + service.endpoints[endpoint];
    
    // 替换 URL 参数
    Object.keys(params).forEach(key => {
      url = url.replace(`{${key}}`, params[key]);
    });

    return url;
  }

  /**
   * 获取认证头
   */
  getAuthHeaders(serviceId, apiKey) {
    const service = this.get(serviceId);
    if (!service) return {};

    if (service.authType === 'none') return {};

    const headers = {};
    
    if (service.authType === 'bearer') {
      headers[service.authHeader] = `${service.authPrefix} ${apiKey}`.trim();
    } else if (service.authType === 'api-key') {
      headers[service.authHeader] = apiKey;
    }

    // 添加服务特定的头
    if (service.headers) {
      Object.assign(headers, service.headers);
    }

    return headers;
  }

  /**
   * 检查服务是否可用
   */
  async checkAvailability(serviceId, config) {
    try {
      const service = this.get(serviceId);
      if (!service) return false;

      // 本地服务检查
      if (service.isLocal) {
        const response = await fetch(service.baseUrl, { 
          method: 'HEAD',
          timeout: 1000 
        }).catch(() => null);
        return response?.ok || false;
      }

      // 远程服务需要 API Key
      return !!config.apiKey;
    } catch (error) {
      return false;
    }
  }

  /**
   * 导出服务配置（用于配置文件）
   */
  exportServiceConfig(serviceId) {
    const service = this.get(serviceId);
    if (!service) return null;

    return {
      service: service.id,
      name: service.displayName,
      baseUrl: service.baseUrl,
      authType: service.authType,
      format: service.format,
      models: service.models.map(m => m.id)
    };
  }
}

// 导出单例
module.exports = new ServiceRegistry();