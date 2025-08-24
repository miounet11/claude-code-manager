'use strict';

const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const { errorHandler, ErrorTypes, ErrorSeverity } = require('./error-handler');

/**
 * 配置管理服务 - 负责管理所有配置
 */
class ConfigService {
  constructor() {
    this.store = new Store({
      name: 'miaoda-configs',
      defaults: {
        configs: [],
        currentConfigId: null,
        // 智能错误处理系统配置
        intelligentErrorHandling: {
          enabled: true,
          errorPredictor: {
            enabled: true,
            minConfidence: 0.7,
            maxPredictions: 10,
            analysisInterval: 30000
          },
          autoRecoveryManager: {
            enabled: true,
            autoRecoveryEnabled: true,
            maxConcurrentRecoveries: 5,
            maxRecoveryAttempts: 10,
            requireConfirmationForCritical: true
          },
          healthMonitor: {
            enabled: true,
            enabledMetrics: ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'],
            alertThreshold: 'WARNING'
          },
          contextAnalyzer: {
            enabled: true,
            enableDeepAnalysis: true,
            behaviorTrackingEnabled: true,
            anomalyDetectionEnabled: true,
            confidenceThreshold: 0.7
          },
          errorHandler: {
            predictiveAnalysis: true,
            contextEnrichment: true,
            autoRecovery: true
          }
        }
      }
    });

    // 初始化默认配置
    this.initDefaultConfigs();
  }

  /**
   * 初始化默认配置
   */
  initDefaultConfigs() {
    const configs = this.getAllConfigs();
    
    if (configs.length === 0) {
      // 添加免费测试配置
      this.addConfig({
        name: '免费测试 API',
        apiUrl: 'http://www.miaoda.vip/',
        apiKey: 'Bearer sk-3KnVMepAnyKTcUJcxxxxxxxxxxxxxxxx95AkD2Ad4802B3',
        model: 'claude-3-7-sonnet-20250219',
        isDefault: true
      });
    }
  }

  /**
   * 获取所有配置
   */
  getAllConfigs() {
    return this.store.get('configs', []);
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig() {
    const currentId = this.store.get('currentConfigId');
    if (!currentId) return null;
    
    const configs = this.getAllConfigs();
    return configs.find(c => c.id === currentId);
  }

  /**
   * 添加配置
   */
  addConfig(config) {
    const newConfig = {
      id: uuidv4(),
      name: config.name || '新配置',
      apiUrl: config.apiUrl || '',
      apiKey: config.apiKey || '',
      model: config.model || 'claude-3-opus-20240229',
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0,
      proxy: config.proxy || '',
      useInternalProxy: config.useInternalProxy === true ? true : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...config
    };

    const configs = this.getAllConfigs();
    configs.push(newConfig);
    
    this.store.set('configs', configs);
    
    // 如果是第一个配置或标记为默认，设置为当前配置
    if (configs.length === 1 || config.isDefault) {
      this.setCurrentConfig(newConfig.id);
    }

    return newConfig;
  }

  /**
   * 更新配置
   */
  updateConfig(id, updates) {
    const configs = this.getAllConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        message: '配置不存在',
        detail: `未找到 ID 为 ${id} 的配置`,
        context: { configId: id }
      });
      throw new Error('配置不存在');
    }

    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.store.set('configs', configs);
    return configs[index];
  }

  /**
   * 删除配置
   */
  deleteConfig(id) {
    const configs = this.getAllConfigs();
    const filtered = configs.filter(c => c.id !== id);
    
    this.store.set('configs', filtered);
    
    // 如果删除的是当前配置，切换到第一个配置
    if (this.store.get('currentConfigId') === id) {
      this.store.set('currentConfigId', filtered[0]?.id || null);
    }

    return true;
  }

  /**
   * 设置当前配置
   */
  setCurrentConfig(id) {
    const configs = this.getAllConfigs();
    const config = configs.find(c => c.id === id);
    
    if (!config) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        message: '配置不存在',
        detail: `未找到 ID 为 ${id} 的配置`,
        context: { configId: id, action: 'setCurrentConfig' }
      });
      throw new Error('配置不存在');
    }

    this.store.set('currentConfigId', id);
    return config;
  }

  /**
   * 导出配置
   */
  exportConfig(id) {
    const config = this.getAllConfigs().find(c => c.id === id);
    if (!config) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        message: '无法导出配置',
        detail: `配置 ID: ${id} 不存在`,
        suggestion: '请检查配置是否已被删除',
        context: { configId: id, action: 'export' }
      });
      throw new Error('配置不存在');
    }

    // 移除敏感信息的选项
    const { id: _, createdAt, updatedAt, ...exportData } = config;
    return exportData;
  }

  /**
   * 导入配置
   */
  importConfig(configData) {
    // 验证必要字段
    if (!configData.name || !configData.apiUrl || !configData.apiKey) {
      const missingFields = [];
      if (!configData.name) missingFields.push('名称');
      if (!configData.apiUrl) missingFields.push('API 地址');
      if (!configData.apiKey) missingFields.push('API Key');
      
      errorHandler.handle({
        type: ErrorTypes.VALIDATION,
        severity: ErrorSeverity.ERROR,
        message: '配置导入失败',
        detail: `缺少必要字段: ${missingFields.join(', ')}`,
        suggestion: '请检查导入文件是否完整',
        context: { configData, missingFields }
      });
      throw new Error('配置数据不完整');
    }

    return this.addConfig({
      ...configData,
      name: `${configData.name} (导入)`
    });
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('配置名称不能为空');
    }

    if (!config.apiUrl || config.apiUrl.trim() === '') {
      errors.push('API 地址不能为空');
    }

    if (!config.apiKey || config.apiKey.trim() === '') {
      errors.push('API Key 不能为空');
    }

    // 验证 URL 格式
    try {
      new URL(config.apiUrl);
    } catch {
      errors.push('API 地址格式不正确');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 测试配置连接
   */
  async testConnection(config) {
    try {
      const https = require('https');
      const http = require('http');
      const url = new URL(config.apiUrl);
      const isHttps = url.protocol === 'https:';
      
      // 构建测试请求
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      };

      // 设置认证头
      if (config.apiKey.startsWith('Bearer ')) {
        options.headers['Authorization'] = config.apiKey;
      } else if (config.apiKey.startsWith('sk-')) {
        options.headers['x-api-key'] = config.apiKey;
      } else {
        options.headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // 测试请求体
      const testBody = JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        messages: [{
          role: 'user',
          content: 'Hi'
        }],
        max_tokens: 10
      });

      return new Promise((resolve) => {
        const client = isHttps ? https : http;
        const req = client.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({
                success: true,
                message: '连接成功',
                latency: Date.now() - startTime
              });
            } else if (res.statusCode === 401) {
              resolve({
                success: false,
                message: 'API Key 无效或已过期'
              });
            } else if (res.statusCode === 403) {
              resolve({
                success: false,
                message: '无权限访问该 API'
              });
            } else if (res.statusCode === 429) {
              resolve({
                success: false,
                message: '请求频率过高，请稍后再试'
              });
            } else {
              resolve({
                success: false,
                message: `服务器返回错误: ${res.statusCode}`,
                details: data
              });
            }
          });
        });

        req.on('error', (error) => {
          errorHandler.handle({
            type: ErrorTypes.NETWORK,
            severity: ErrorSeverity.WARNING,
            message: '配置测试失败',
            detail: error.message,
            suggestion: '请检查网络连接和代理设置',
            context: { config, error: error.message, silent: true }
          });
          resolve({
            success: false,
            message: '网络连接失败',
            error: error.message
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            message: '连接超时'
          });
        });

        const startTime = Date.now();
        req.write(testBody);
        req.end();
      });
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.SYSTEM,
        severity: ErrorSeverity.ERROR,
        message: '配置测试异常',
        detail: error.message,
        stack: error.stack,
        context: { config, silent: true }
      });
      return {
        success: false,
        message: '测试失败',
        error: error.message
      };
    }
  }

  /**
   * 复制配置
   */
  duplicateConfig(id) {
    const config = this.getAllConfigs().find(c => c.id === id);
    if (!config) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        message: '无法复制配置',
        detail: `配置 ID: ${id} 不存在`,
        context: { configId: id, action: 'duplicate' }
      });
      throw new Error('配置不存在');
    }

    const { id: _, createdAt, updatedAt, ...configData } = config;
    
    return this.addConfig({
      ...configData,
      name: `${config.name} (副本)`
    });
  }

  /**
   * 获取配置统计
   */
  getStats() {
    const configs = this.getAllConfigs();
    const current = this.getCurrentConfig();
    
    return {
      total: configs.length,
      current: current?.name || '无',
      models: [...new Set(configs.map(c => c.model))],
      lastUpdated: configs.reduce((latest, config) => {
        return config.updatedAt > latest ? config.updatedAt : latest;
      }, '')
    };
  }
  
  // ========================================
  // 智能错误处理配置管理
  // ========================================
  
  /**
   * 获取智能错误处理配置
   */
  getIntelligentErrorHandlingConfig() {
    return this.store.get('intelligentErrorHandling', {
      enabled: true,
      errorPredictor: {
        enabled: true,
        minConfidence: 0.7,
        maxPredictions: 10,
        analysisInterval: 30000
      },
      autoRecoveryManager: {
        enabled: true,
        autoRecoveryEnabled: true,
        maxConcurrentRecoveries: 5,
        maxRecoveryAttempts: 10,
        requireConfirmationForCritical: true
      },
      healthMonitor: {
        enabled: true,
        enabledMetrics: ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'],
        alertThreshold: 'WARNING'
      },
      contextAnalyzer: {
        enabled: true,
        enableDeepAnalysis: true,
        behaviorTrackingEnabled: true,
        anomalyDetectionEnabled: true,
        confidenceThreshold: 0.7
      },
      errorHandler: {
        predictiveAnalysis: true,
        contextEnrichment: true,
        autoRecovery: true
      }
    });
  }
  
  /**
   * 更新智能错误处理配置
   */
  updateIntelligentErrorHandlingConfig(newConfig) {
    try {
      const currentConfig = this.getIntelligentErrorHandlingConfig();
      const updatedConfig = this.mergeConfig(currentConfig, newConfig);
      
      // 验证配置
      this.validateIntelligentErrorHandlingConfig(updatedConfig);
      
      // 保存配置
      this.store.set('intelligentErrorHandling', updatedConfig);
      
      console.log('Intelligent error handling configuration updated');
      
      return {
        success: true,
        config: updatedConfig,
        message: '智能错误处理配置已更新'
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '更新智能错误处理配置失败',
        detail: error.message,
        suggestion: '请检查配置项是否正确',
        context: { newConfig }
      });
      
      throw error;
    }
  }
  
  /**
   * 验证智能错误处理配置
   */
  validateIntelligentErrorHandlingConfig(config) {
    const errors = [];
    
    // 验证错误预测器配置
    if (config.errorPredictor) {
      if (config.errorPredictor.minConfidence < 0 || config.errorPredictor.minConfidence > 1) {
        errors.push('错误预测器最小置信度必须在 0-1 之间');
      }
      
      if (config.errorPredictor.maxPredictions < 1) {
        errors.push('错误预测器最大预测数量必须大于 0');
      }
      
      if (config.errorPredictor.analysisInterval < 5000) {
        errors.push('错误预测器分析间隔不能少于 5 秒');
      }
    }
    
    // 验证自动恢复管理器配置
    if (config.autoRecoveryManager) {
      if (config.autoRecoveryManager.maxConcurrentRecoveries < 1) {
        errors.push('最大并发恢复数量必须大于 0');
      }
      
      if (config.autoRecoveryManager.maxRecoveryAttempts < 1) {
        errors.push('最大恢复尝试次数必须大于 0');
      }
    }
    
    // 验证健康监控器配置
    if (config.healthMonitor) {
      const validMetrics = ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'];
      const invalidMetrics = config.healthMonitor.enabledMetrics?.filter(m => !validMetrics.includes(m));
      
      if (invalidMetrics && invalidMetrics.length > 0) {
        errors.push(`无效的健康监控指标: ${invalidMetrics.join(', ')}`);
      }
      
      const validThresholds = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
      if (config.healthMonitor.alertThreshold && !validThresholds.includes(config.healthMonitor.alertThreshold)) {
        errors.push('无效的告警阈值，必须是 INFO、WARNING、ERROR 或 CRITICAL 之一');
      }
    }
    
    // 验证上下文分析器配置
    if (config.contextAnalyzer) {
      if (config.contextAnalyzer.confidenceThreshold < 0 || config.contextAnalyzer.confidenceThreshold > 1) {
        errors.push('上下文分析器置信度阈值必须在 0-1 之间');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.join('; ')}`);
    }
  }
  
  /**
   * 深度合并配置对象
   */
  mergeConfig(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.mergeConfig(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * 重置智能错误处理配置为默认值
   */
  resetIntelligentErrorHandlingConfig() {
    try {
      const defaultConfig = {
        enabled: true,
        errorPredictor: {
          enabled: true,
          minConfidence: 0.7,
          maxPredictions: 10,
          analysisInterval: 30000
        },
        autoRecoveryManager: {
          enabled: true,
          autoRecoveryEnabled: true,
          maxConcurrentRecoveries: 5,
          maxRecoveryAttempts: 10,
          requireConfirmationForCritical: true
        },
        healthMonitor: {
          enabled: true,
          enabledMetrics: ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'],
          alertThreshold: 'WARNING'
        },
        contextAnalyzer: {
          enabled: true,
          enableDeepAnalysis: true,
          behaviorTrackingEnabled: true,
          anomalyDetectionEnabled: true,
          confidenceThreshold: 0.7
        },
        errorHandler: {
          predictiveAnalysis: true,
          contextEnrichment: true,
          autoRecovery: true
        }
      };
      
      this.store.set('intelligentErrorHandling', defaultConfig);
      
      console.log('Intelligent error handling configuration reset to defaults');
      
      return {
        success: true,
        config: defaultConfig,
        message: '智能错误处理配置已重置为默认值'
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '重置智能错误处理配置失败',
        detail: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * 启用或禁用智能错误处理
   */
  toggleIntelligentErrorHandling(enabled) {
    try {
      const config = this.getIntelligentErrorHandlingConfig();
      config.enabled = enabled;
      
      this.store.set('intelligentErrorHandling', config);
      
      console.log(`Intelligent error handling ${enabled ? 'enabled' : 'disabled'}`);
      
      return {
        success: true,
        enabled,
        message: `智能错误处理已${enabled ? '启用' : '禁用'}`
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '切换智能错误处理状态失败',
        detail: error.message,
        context: { enabled }
      });
      
      throw error;
    }
  }
  
  /**
   * 获取智能错误处理配置的预设模板
   */
  getIntelligentErrorHandlingPresets() {
    return {
      conservative: {
        name: '保守模式',
        description: '较低的自动化程度，更多用户确认',
        config: {
          enabled: true,
          errorPredictor: {
            enabled: true,
            minConfidence: 0.8,
            maxPredictions: 5,
            analysisInterval: 60000
          },
          autoRecoveryManager: {
            enabled: true,
            autoRecoveryEnabled: false,
            maxConcurrentRecoveries: 2,
            maxRecoveryAttempts: 3,
            requireConfirmationForCritical: true
          },
          healthMonitor: {
            enabled: true,
            enabledMetrics: ['SYSTEM_RESOURCES', 'APPLICATION_HEALTH'],
            alertThreshold: 'ERROR'
          },
          contextAnalyzer: {
            enabled: true,
            enableDeepAnalysis: false,
            behaviorTrackingEnabled: false,
            anomalyDetectionEnabled: false,
            confidenceThreshold: 0.8
          },
          errorHandler: {
            predictiveAnalysis: true,
            contextEnrichment: false,
            autoRecovery: false
          }
        }
      },
      
      balanced: {
        name: '平衡模式',
        description: '适度的自动化和监控，推荐设置',
        config: {
          enabled: true,
          errorPredictor: {
            enabled: true,
            minConfidence: 0.7,
            maxPredictions: 10,
            analysisInterval: 30000
          },
          autoRecoveryManager: {
            enabled: true,
            autoRecoveryEnabled: true,
            maxConcurrentRecoveries: 5,
            maxRecoveryAttempts: 10,
            requireConfirmationForCritical: true
          },
          healthMonitor: {
            enabled: true,
            enabledMetrics: ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'],
            alertThreshold: 'WARNING'
          },
          contextAnalyzer: {
            enabled: true,
            enableDeepAnalysis: true,
            behaviorTrackingEnabled: true,
            anomalyDetectionEnabled: true,
            confidenceThreshold: 0.7
          },
          errorHandler: {
            predictiveAnalysis: true,
            contextEnrichment: true,
            autoRecovery: true
          }
        }
      },
      
      aggressive: {
        name: '积极模式',
        description: '最大化自动化和智能功能',
        config: {
          enabled: true,
          errorPredictor: {
            enabled: true,
            minConfidence: 0.6,
            maxPredictions: 20,
            analysisInterval: 15000
          },
          autoRecoveryManager: {
            enabled: true,
            autoRecoveryEnabled: true,
            maxConcurrentRecoveries: 10,
            maxRecoveryAttempts: 15,
            requireConfirmationForCritical: false
          },
          healthMonitor: {
            enabled: true,
            enabledMetrics: ['SYSTEM_RESOURCES', 'NETWORK_CONNECTIVITY', 'APPLICATION_HEALTH', 'PROCESS_HEALTH', 'ERROR_RATE'],
            alertThreshold: 'INFO'
          },
          contextAnalyzer: {
            enabled: true,
            enableDeepAnalysis: true,
            behaviorTrackingEnabled: true,
            anomalyDetectionEnabled: true,
            confidenceThreshold: 0.6
          },
          errorHandler: {
            predictiveAnalysis: true,
            contextEnrichment: true,
            autoRecovery: true
          }
        }
      }
    };
  }
  
  /**
   * 应用智能错误处理预设配置
   */
  applyIntelligentErrorHandlingPreset(presetName) {
    try {
      const presets = this.getIntelligentErrorHandlingPresets();
      const preset = presets[presetName];
      
      if (!preset) {
        throw new Error(`未知的预设配置: ${presetName}`);
      }
      
      const result = this.updateIntelligentErrorHandlingConfig(preset.config);
      
      console.log(`Applied intelligent error handling preset: ${preset.name}`);
      
      return {
        ...result,
        preset: preset.name,
        message: `已应用 ${preset.name} 预设配置`
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '应用智能错误处理预设配置失败',
        detail: error.message,
        context: { presetName }
      });
      
      throw error;
    }
  }
  
  /**
   * 导出智能错误处理配置
   */
  exportIntelligentErrorHandlingConfig() {
    try {
      const config = this.getIntelligentErrorHandlingConfig();
      
      return {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        type: 'intelligent-error-handling-config',
        config
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '导出智能错误处理配置失败',
        detail: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * 导入智能错误处理配置
   */
  importIntelligentErrorHandlingConfig(importData) {
    try {
      // 验证导入数据格式
      if (!importData.config || importData.type !== 'intelligent-error-handling-config') {
        throw new Error('无效的智能错误处理配置文件格式');
      }
      
      // 应用导入的配置
      const result = this.updateIntelligentErrorHandlingConfig(importData.config);
      
      console.log('Intelligent error handling configuration imported successfully');
      
      return {
        ...result,
        importDate: importData.exportDate,
        message: '智能错误处理配置导入成功'
      };
      
    } catch (error) {
      errorHandler.handle({
        type: ErrorTypes.CONFIG,
        severity: ErrorSeverity.ERROR,
        error,
        message: '导入智能错误处理配置失败',
        detail: error.message,
        context: { importData }
      });
      
      throw error;
    }
  }
}

// 导出单例
module.exports = new ConfigService();