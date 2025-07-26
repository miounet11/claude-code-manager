# claude_proxy 项目借鉴与改进方案

## 项目对比

### claude_proxy 优势
1. **动态路由** - URL 中指定服务，无需重启
2. **Serverless 部署** - 基于 Cloudflare Workers
3. **格式转换** - Claude ↔ OpenAI 格式互转
4. **极简配置** - 一个脚本搞定所有设置

### Miaoda 现有优势
1. **原生桌面体验** - Electron 应用，功能更丰富
2. **完整终端集成** - VSCode 风格的终端
3. **使用统计** - Token 使用和费用追踪
4. **多配置管理** - 支持多个配置切换

## 可借鉴的改进方案

### 1. 动态路由功能
```javascript
// 在 proxy-server.js 中实现动态路由
class ProxyServer {
  async handleDynamicRoute(req, res) {
    // 从 URL 解析目标服务
    // 示例: /proxy/openai/gpt-4/v1/messages
    const [, , service, model, ...path] = req.path.split('/');
    
    const targetUrl = this.getServiceUrl(service);
    const actualModel = model || this.getDefaultModel(service);
    
    // 动态转发请求
    this.forwardRequest(req, res, {
      target: targetUrl,
      model: actualModel
    });
  }
}
```

### 2. 多服务支持扩展
```javascript
// config-service.js 增加预设服务
const PRESET_SERVICES = {
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    keyFormat: 'Bearer'
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1',
    models: ['llama2-70b-4096', 'mixtral-8x7b-32768'],
    keyFormat: 'Bearer'
  },
  gemini: {
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com',
    models: ['gemini-pro', 'gemini-pro-vision'],
    keyFormat: 'API-Key'
  },
  ollama: {
    name: 'Ollama (Local)',
    url: 'http://localhost:11434',
    models: ['llama2', 'codellama', 'mistral'],
    keyFormat: 'none'
  }
};
```

### 3. 智能格式转换器
```javascript
// 新增 format-converter.js
class FormatConverter {
  // Claude 到 OpenAI 格式转换
  claudeToOpenAI(request) {
    return {
      model: request.model,
      messages: this.convertMessages(request.messages),
      functions: this.convertTools(request.tools),
      temperature: request.temperature,
      max_tokens: request.max_tokens
    };
  }
  
  // OpenAI 到 Claude 格式转换
  openAIToClaude(request) {
    return {
      model: request.model,
      messages: this.convertMessages(request.messages),
      tools: this.convertFunctions(request.functions),
      temperature: request.temperature,
      max_tokens: request.max_tokens
    };
  }
}
```

### 4. 快速配置向导
```javascript
// 新增配置向导组件
class ConfigWizard {
  async start() {
    const steps = [
      this.selectService,     // 选择 AI 服务
      this.configureAuth,     // 配置认证
      this.testConnection,    // 测试连接
      this.saveConfig        // 保存配置
    ];
    
    for (const step of steps) {
      await step();
    }
  }
}
```

### 5. URL 模板系统
```javascript
// 支持自定义 URL 模板
class URLTemplateManager {
  templates = {
    'openai-compatible': '{base_url}/v1/chat/completions',
    'anthropic': '{base_url}/v1/messages',
    'google': '{base_url}/v1beta/models/{model}:generateContent',
    'custom': '{base_url}/{custom_path}'
  };
  
  buildURL(service, config) {
    const template = this.templates[service.type];
    return this.interpolate(template, config);
  }
}
```

### 6. 请求中间件系统
```javascript
// 灵活的中间件处理
class RequestMiddleware {
  constructor() {
    this.middlewares = [];
  }
  
  use(middleware) {
    this.middlewares.push(middleware);
  }
  
  async process(req, res, next) {
    // 认证中间件
    this.use(authMiddleware);
    // 格式转换中间件
    this.use(formatMiddleware);
    // 限流中间件
    this.use(rateLimitMiddleware);
    // 日志中间件
    this.use(loggingMiddleware);
  }
}
```

### 7. 本地模型支持
```javascript
// 支持 Ollama 等本地模型
class LocalModelSupport {
  async detectLocalModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models;
    } catch (e) {
      return [];
    }
  }
  
  async runLocalModel(model, prompt) {
    // 直接调用本地模型
  }
}
```

## 实施计划

### Phase 1: 核心功能增强（v4.1.0）
- [ ] 实现动态路由机制
- [ ] 添加格式转换器
- [ ] 扩展服务预设列表

### Phase 2: 用户体验优化（v4.2.0）
- [ ] 配置向导 UI
- [ ] URL 模板管理
- [ ] 快速服务切换

### Phase 3: 高级功能（v4.3.0）
- [ ] 本地模型集成
- [ ] 中间件系统
- [ ] 批量请求处理

## 技术优势对比

| 功能 | claude_proxy | Miaoda | 改进后的 Miaoda |
|------|-------------|---------|----------------|
| 部署方式 | Serverless | 桌面应用 | 桌面应用 + 可选云端 |
| 动态路由 | ✅ | ❌ | ✅ |
| 格式转换 | ✅ | ❌ | ✅ |
| 使用统计 | ❌ | ✅ | ✅ |
| 终端集成 | ❌ | ✅ | ✅ |
| 多服务支持 | ✅ | 部分 | ✅ |
| 配置管理 | 简单 | 完善 | 更完善 |

## 总结

通过借鉴 claude_proxy 的创新设计，Miaoda 可以：
1. 提供更灵活的 AI 服务切换能力
2. 支持更多的 AI 服务提供商
3. 简化用户配置流程
4. 保持桌面应用的优势同时获得云服务的灵活性

这将使 Miaoda 成为一个真正的"AI 服务聚合器"，而不仅仅是 Claude 的代理工具。