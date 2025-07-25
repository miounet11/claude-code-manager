'use strict';

const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

/**
 * 配置管理服务 - 负责管理所有配置
 */
class ConfigService {
  constructor() {
    this.store = new Store({
      name: 'miaoda-configs',
      defaults: {
        configs: [],
        currentConfigId: null
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
   * 复制配置
   */
  duplicateConfig(id) {
    const config = this.getAllConfigs().find(c => c.id === id);
    if (!config) {
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
}

// 导出单例
module.exports = new ConfigService();