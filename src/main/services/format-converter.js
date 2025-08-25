'use strict';

/**
 * API 格式转换器
 * 在不同 AI 服务的 API 格式之间进行转换
 */
class FormatConverter {
  constructor() {
    // 注册转换器
    this.converters = new Map();
    this.registerDefaultConverters();
  }

  /**
   * 注册默认转换器
   */
  registerDefaultConverters() {
    // Claude → OpenAI
    this.registerConverter('claude', 'openai', {
      request: this.claudeToOpenAIRequest.bind(this),
      // 将 Claude 响应转换为 OpenAI 响应（用于反向路径）
      response: this.claudeToOpenAIResponse.bind(this)
    });

    // OpenAI → Claude
    this.registerConverter('openai', 'claude', {
      request: this.openAIToClaudeRequest.bind(this),
      // 将 OpenAI 响应转换为 Claude 响应（代理主路径使用）
      response: this.openAIToClaudeResponse.bind(this)
    });

    // Gemini → OpenAI
    this.registerConverter('gemini', 'openai', {
      request: this.geminiToOpenAIRequest.bind(this),
      response: this.openAIToGeminiResponse.bind(this)
    });

    // OpenAI → Gemini
    this.registerConverter('openai', 'gemini', {
      request: this.openAIToGeminiRequest.bind(this),
      response: this.geminiToOpenAIResponse.bind(this)
    });

    // Ollama → OpenAI
    this.registerConverter('ollama', 'openai', {
      request: this.ollamaToOpenAIRequest.bind(this),
      response: this.openAIToOllamaResponse.bind(this)
    });
  }

  /**
   * 注册转换器
   */
  registerConverter(from, to, converter) {
    const key = `${from}->${to}`;
    this.converters.set(key, converter);
  }

  /**
   * 转换请求
   */
  async convertRequest(from, to, request) {
    // 相同格式无需转换
    if (from === to) return request;

    const key = `${from}->${to}`;
    const converter = this.converters.get(key);
    
    if (!converter) {
      console.warn(`无转换器: ${key}，尝试通用转换`);
      return this.genericRequestConvert(from, to, request);
    }

    return await converter.request(request);
  }

  /**
   * 转换响应
   */
  async convertResponse(from, to, response) {
    // 相同格式无需转换
    if (from === to) return response;

    const key = `${from}->${to}`;
    const converter = this.converters.get(key);
    
    if (!converter) {
      console.warn(`无转换器: ${key}，尝试通用转换`);
      return this.genericResponseConvert(from, to, response);
    }

    return await converter.response(response);
  }

  /**
   * Claude 请求 → OpenAI 请求
   */
  claudeToOpenAIRequest(request) {
    const converted = {
      model: request.model || 'gpt-3.5-turbo',
      messages: this.convertClaudeMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      stream: request.stream || false
    };

    // 转换工具/函数
    if (request.tools) {
      converted.functions = request.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }));
    }

    // 转换系统提示
    if (request.system) {
      converted.messages.unshift({
        role: 'system',
        content: request.system
      });
    }

    return converted;
  }

  /**
   * OpenAI 请求 → Claude 请求
   */
  openAIToClaudeRequest(request) {
    const messages = [...(request.messages || [])];
    let system = null;

    // 提取系统消息
    const systemIndex = messages.findIndex(m => m.role === 'system');
    if (systemIndex !== -1) {
      system = messages[systemIndex].content;
      messages.splice(systemIndex, 1);
    }

    const converted = {
      model: request.model || 'claude-3-sonnet-20240229',
      messages: this.convertOpenAIMessages(messages),
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature,
      stream: request.stream || false
    };

    if (system) {
      converted.system = system;
    }

    // 转换函数/工具
    if (request.functions) {
      converted.tools = request.functions.map(func => ({
        name: func.name,
        description: func.description,
        input_schema: func.parameters
      }));
    }

    return converted;
  }

  /**
   * Gemini 请求 → OpenAI 请求
   */
  geminiToOpenAIRequest(request) {
    const messages = [];
    
    // Gemini 使用 contents 数组
    if (request.contents) {
      request.contents.forEach(content => {
        messages.push({
          role: content.role === 'model' ? 'assistant' : content.role,
          content: content.parts?.map(p => p.text).join('\n') || ''
        });
      });
    }

    return {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: request.generationConfig?.temperature,
      max_tokens: request.generationConfig?.maxOutputTokens,
      stream: false
    };
  }

  /**
   * OpenAI 请求 → Gemini 请求
   */
  openAIToGeminiRequest(request) {
    const contents = [];
    
    request.messages?.forEach(message => {
      // Gemini 不支持 system 角色，合并到第一个用户消息
      if (message.role === 'system') {
        if (contents.length === 0 || contents[0].role !== 'user') {
          contents.unshift({
            role: 'user',
            parts: [{ text: message.content }]
          });
        } else {
          contents[0].parts.unshift({ text: message.content + '\n\n' });
        }
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : message.role,
          parts: [{ text: message.content }]
        });
      }
    });

    return {
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens,
        topP: 0.95,
        topK: 64
      }
    };
  }

  /**
   * Ollama 请求 → OpenAI 请求
   */
  ollamaToOpenAIRequest(request) {
    const messages = [];
    
    if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    } else if (request.messages) {
      messages.push(...request.messages);
    }

    return {
      model: request.model || 'gpt-3.5-turbo',
      messages,
      temperature: request.options?.temperature,
      max_tokens: request.options?.num_predict,
      stream: request.stream || false
    };
  }

  /**
   * OpenAI 响应 → Claude 响应 (完全匹配 claude-code-proxy 格式)
   */
  openAIToClaudeResponse(response) {
    try {
      if (typeof response === 'string') {
        try { response = JSON.parse(response); } catch { response = {}; }
      }

      // 提取响应数据
      const choices = response.choices || [];
      if (choices.length === 0) {
        return {
          id: response.id || `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
          model: response.model || 'unknown',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: response.usage?.prompt_tokens || 0,
            output_tokens: response.usage?.completion_tokens || 0
          }
        };
      }

      const choice = choices[0];
      const message = choice.message || {};

      // 构建 Claude 内容块
      const contentBlocks = [];

      // 添加文本内容
      const textContent = message.content;
      if (textContent !== null && textContent !== undefined && textContent !== '') {
        contentBlocks.push({ type: 'text', text: textContent });
      }

      // 添加工具调用
      const toolCalls = message.tool_calls || [];
      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          const functionData = toolCall.function || {};
          let arguments_obj = {};
          try {
            arguments_obj = JSON.parse(functionData.arguments || '{}');
          } catch (e) {
            arguments_obj = { raw_arguments: functionData.arguments || '' };
          }

          contentBlocks.push({
            type: 'tool_use',
            id: toolCall.id || `tool_${Date.now()}`,
            name: functionData.name || '',
            input: arguments_obj
          });
        }
      }

      // 确保至少有一个内容块
      if (contentBlocks.length === 0) {
        contentBlocks.push({ type: 'text', text: '' });
      }

      // 映射完成原因
      const finishReason = choice.finish_reason || 'stop';
      const stopReason = {
        'stop': 'end_turn',
        'length': 'max_tokens',
        'tool_calls': 'tool_use',
        'function_call': 'tool_use'
      }[finishReason] || 'end_turn';

      // 构建 Claude 响应 (完全匹配原格式)
      return {
        id: response.id || `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: response.model || 'unknown',
        content: contentBlocks,
        stop_reason: stopReason,
        stop_sequence: null,
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0
        }
      };

    } catch (e) {
      console.error('Error converting OpenAI to Claude response:', e);
      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: 'unknown',
        content: [{ type: 'text', text: '' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    }
  }

  /**
   * Claude 响应 → OpenAI 响应
   */
  claudeToOpenAIResponse(response) {
    const message = {
      role: 'assistant',
      content: ''
    };

    // 处理内容
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      
      message.content = textContent;

      // 处理工具使用
      const toolUse = response.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        message.function_call = {
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input)
        };
      }
    }

    return {
      id: response.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now() / 1000,
      model: response.model,
      choices: [{
        index: 0,
        message,
        finish_reason: response.stop_reason || 'stop'
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * 转换 Claude 消息格式
   */
  convertClaudeMessages(messages) {
    return (messages || []).map(msg => {
      const role = msg?.role || 'user';
      const contentField = msg?.content;
      // 1) 字符串内容
      if (typeof contentField === 'string') {
        return { role, content: contentField };
      }
      // 2) 数组内容（Claude 新格式）
      if (Array.isArray(contentField)) {
        const textParts = contentField
          .filter(c => c && c.type === 'text')
          .map(c => c.text || '')
          .join('\n');
        return { role, content: textParts };
      }
      // 3) 对象或缺省：尝试提取 text 字段或使用空串
      const text = (contentField && typeof contentField === 'object' && 'text' in contentField)
        ? String(contentField.text || '')
        : (typeof msg?.text === 'string' ? msg.text : '');
      return { role, content: text };
    });
  }

  /**
   * 转换 OpenAI 消息格式
   */
  convertOpenAIMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: typeof msg.content === 'string' 
        ? [{ type: 'text', text: msg.content }]
        : msg.content
    }));
  }

  /**
   * 通用请求转换
   */
  genericRequestConvert(from, to, request) {
    console.log(`通用转换: ${from} → ${to}`);
    
    // 尝试提取通用字段
    const genericRequest = {
      messages: request.messages || [],
      temperature: request.temperature,
      max_tokens: request.max_tokens || request.maxTokens || 4096,
      stream: request.stream || false
    };

    // 根据目标格式调整
    if (to === 'openai') {
      genericRequest.model = request.model || 'gpt-3.5-turbo';
    } else if (to === 'claude') {
      genericRequest.model = request.model || 'claude-3-sonnet-20240229';
    }

    return genericRequest;
  }

  /**
   * 通用响应转换
   */
  genericResponseConvert(from, to, response) {
    console.log(`通用响应转换: ${from} → ${to}`);
    
    // 尝试返回最基本的格式
    if (to === 'openai') {
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: this.extractContent(response)
          }
        }]
      };
    }

    return response;
  }

  /**
   * 提取响应内容
   */
  extractContent(response) {
    // 尝试各种可能的内容位置
    if (typeof response === 'string') return response;
    if (response.content) return response.content;
    if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
    if (response.content?.[0]?.text) return response.content[0].text;
    if (response.response) return response.response;
    
    return JSON.stringify(response);
  }

  /**
   * 检测请求格式
   */
  detectRequestFormat(request) {
    // Claude 格式特征
    if (request.messages && request.messages[0]?.content?.[0]?.type) {
      return 'claude';
    }
    
    // Gemini 格式特征
    if (request.contents) {
      return 'gemini';
    }
    
    // Ollama 格式特征
    if (request.prompt && !request.messages) {
      return 'ollama';
    }
    
    // 默认 OpenAI 格式
    return 'openai';
  }

  /**
   * OpenAI 响应 → Gemini 响应
   */
  openAIToGeminiResponse(response) {
    return {
      candidates: [{
        content: {
          parts: [{
            text: response.choices?.[0]?.message?.content || ''
          }],
          role: 'model'
        },
        finishReason: response.choices?.[0]?.finish_reason || 'STOP',
        index: 0
      }],
      promptFeedback: {
        safetyRatings: []
      }
    };
  }

  /**
   * Gemini 响应 → OpenAI 响应
   */
  geminiToOpenAIResponse(response) {
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.map(p => p.text).join('\n') || '';
    
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now() / 1000,
      model: 'gpt-3.5-turbo',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: candidate?.finishReason?.toLowerCase() || 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * OpenAI 响应 → Ollama 响应
   */
  openAIToOllamaResponse(response) {
    return {
      model: response.model || 'llama2',
      created_at: new Date().toISOString(),
      response: response.choices?.[0]?.message?.content || '',
      done: true,
      context: [],
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: response.usage?.prompt_tokens || 0,
      eval_count: response.usage?.completion_tokens || 0,
      eval_duration: 0
    };
  }

  /**
   * 检测响应格式
   */
  detectResponseFormat(response) {
    // Claude 格式特征
    if (response.type === 'message' && response.content?.[0]?.type) {
      return 'claude';
    }
    
    // OpenAI 格式特征
    if (response.choices && response.object === 'chat.completion') {
      return 'openai';
    }
    
    // Gemini 格式特征
    if (response.candidates) {
      return 'gemini';
    }
    
    // Ollama 格式特征
    if (response.response !== undefined && response.model) {
      return 'ollama';
    }
    
    return 'unknown';
  }
}

// 导出单例
module.exports = new FormatConverter();