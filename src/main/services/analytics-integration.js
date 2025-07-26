'use strict';

/**
 * 统计分析集成服务
 * 提供全局的统计跟踪功能
 */
class AnalyticsIntegration {
  constructor() {
    this.analytics = null;
  }

  /**
   * 初始化统计分析
   * @param {Analytics} analyticsInstance - Analytics 实例
   */
  initialize(analyticsInstance) {
    this.analytics = analyticsInstance;
  }

  /**
   * 跟踪页面访问
   * @param {string} pageName - 页面名称
   */
  trackPageView(pageName) {
    if (this.analytics) {
      this.analytics.trackPageView(pageName);
    }
  }

  /**
   * 跟踪功能使用
   * @param {string} featureName - 功能名称
   */
  trackFeatureUse(featureName) {
    if (this.analytics) {
      this.analytics.trackFeatureUse(featureName);
    }
  }

  /**
   * 跟踪终端相关操作
   * @param {string} action - 操作类型
   */
  trackTerminalAction(action) {
    const featureName = `terminal_${action}`;
    this.trackFeatureUse(featureName);
  }

  /**
   * 跟踪配置相关操作
   * @param {string} action - 操作类型
   */
  trackConfigAction(action) {
    const featureName = `config_${action}`;
    this.trackFeatureUse(featureName);
  }

  /**
   * 跟踪代理请求
   * @param {string} service - 服务名称
   * @param {string} model - 模型名称
   */
  trackProxyRequest(service, model) {
    this.trackFeatureUse('proxy_request');
    if (service && model) {
      this.trackFeatureUse(`proxy_${service}_${model}`);
    }
  }

  /**
   * 跟踪本地模型操作
   * @param {string} action - 操作类型
   * @param {string} service - 服务名称
   */
  trackLocalModelAction(action, service) {
    const featureName = `local_model_${action}`;
    this.trackFeatureUse(featureName);
    if (service) {
      this.trackFeatureUse(`local_model_${service}_${action}`);
    }
  }

  /**
   * 跟踪错误
   * @param {string} errorType - 错误类型
   * @param {string} context - 错误上下文
   */
  trackError(errorType, context) {
    const featureName = `error_${errorType}`;
    this.trackFeatureUse(featureName);
    console.log(`Analytics: Error tracked - ${errorType} in ${context}`);
  }

  /**
   * 跟踪 Claude CLI 操作
   * @param {string} action - 操作类型
   */
  trackClaudeAction(action) {
    const featureName = `claude_${action}`;
    this.trackFeatureUse(featureName);
  }

  /**
   * 跟踪更新检查
   * @param {string} result - 检查结果 (checked, available, updated, skipped)
   */
  trackUpdateCheck(result) {
    const featureName = `update_${result}`;
    this.trackFeatureUse(featureName);
  }
}

// 创建单例实例
const analyticsIntegration = new AnalyticsIntegration();

module.exports = analyticsIntegration;