'use strict';

/**
 * Windows 统计分析集成服务
 * 为 Windows 版本提供统一的统计跟踪功能
 */
class WindowsAnalyticsIntegration {
  constructor() {
    this.analytics = null;
  }

  /**
   * 初始化统计分析
   * @param {WindowsAnalytics} analyticsInstance - Windows Analytics 实例
   */
  initialize(analyticsInstance) {
    this.analytics = analyticsInstance;
    console.log('🪟 Windows Analytics Integration: 统计集成已初始化');
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
   * 跟踪终端相关操作 (Windows 优化)
   * @param {string} action - 操作类型
   * @param {string} terminalType - 终端类型 (powershell/cmd/wt)
   */
  trackTerminalAction(action, terminalType = null) {
    const featureName = `terminal_${action}`;
    this.trackFeatureUse(featureName);
    
    // Windows 特有的终端类型跟踪
    if (terminalType && this.analytics) {
      this.analytics.trackTerminalType(terminalType);
    }
  }

  /**
   * 跟踪 PowerShell 相关操作
   * @param {string} action - 操作类型
   * @param {object} details - 详细信息
   */
  trackPowerShellAction(action, details = {}) {
    const featureName = `powershell_${action}`;
    this.trackFeatureUse(featureName);
    
    if (this.analytics && details.version) {
      this.analytics.trackPowerShellVersion(details.version);
    }
  }

  /**
   * 跟踪 Windows Terminal 操作
   * @param {string} action - 操作类型
   */
  trackWindowsTerminalAction(action) {
    this.trackFeatureUse(`windows_terminal_${action}`);
    if (this.analytics) {
      this.analytics.trackWindowsFeature('windows_terminal', { action });
    }
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
   * 跟踪错误 (Windows 优化)
   * @param {string} errorType - 错误类型
   * @param {string} context - 错误上下文
   * @param {object} windowsDetails - Windows 特有的错误详情
   */
  trackError(errorType, context, windowsDetails = {}) {
    const featureName = `error_${errorType}`;
    this.trackFeatureUse(featureName);
    
    if (this.analytics && Object.keys(windowsDetails).length > 0) {
      this.analytics.trackWindowsFeature('error_details', {
        type: errorType,
        context: context,
        ...windowsDetails
      });
    }
    
    console.log(`🪟 Windows Analytics: 错误跟踪 - ${errorType} in ${context}`, windowsDetails);
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
   * 跟踪更新检查 (Windows 优化)
   * @param {string} result - 检查结果 (checked, available, updated, skipped)
   * @param {object} updateDetails - 更新详情
   */
  trackUpdateCheck(result, updateDetails = {}) {
    const featureName = `update_${result}`;
    this.trackFeatureUse(featureName);
    
    if (this.analytics && Object.keys(updateDetails).length > 0) {
      this.analytics.trackWindowsFeature('update_check', {
        result: result,
        ...updateDetails
      });
    }
  }

  /**
   * 跟踪 Windows 系统集成功能
   * @param {string} feature - 功能名称
   * @param {object} details - 详细信息
   */
  trackWindowsIntegration(feature, details = {}) {
    this.trackFeatureUse(`windows_integration_${feature}`);
    
    if (this.analytics) {
      this.analytics.trackWindowsFeature('system_integration', {
        feature: feature,
        ...details
      });
    }
  }

  /**
   * 跟踪安装/卸载操作
   * @param {string} action - install/uninstall/update
   * @param {object} details - 安装详情
   */
  trackInstallAction(action, details = {}) {
    this.trackFeatureUse(`install_${action}`);
    
    if (this.analytics) {
      this.analytics.trackWindowsFeature('install_action', {
        action: action,
        ...details
      });
    }
  }

  /**
   * 跟踪性能指标
   * @param {string} metric - 指标名称
   * @param {number} value - 指标值
   * @param {string} unit - 单位
   */
  trackPerformance(metric, value, unit = 'ms') {
    this.trackFeatureUse(`performance_${metric}`);
    
    if (this.analytics) {
      this.analytics.trackWindowsFeature('performance_metric', {
        metric: metric,
        value: value,
        unit: unit,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 跟踪用户设置更改
   * @param {string} setting - 设置名称
   * @param {any} value - 设置值
   */
  trackSettingChange(setting, value) {
    this.trackFeatureUse(`setting_${setting}`);
    
    if (this.analytics) {
      this.analytics.trackWindowsFeature('setting_change', {
        setting: setting,
        valueType: typeof value
      });
    }
  }

  /**
   * 批量跟踪多个事件
   * @param {Array} events - 事件数组
   */
  trackBatch(events) {
    events.forEach(event => {
      if (event.type === 'pageView') {
        this.trackPageView(event.name);
      } else if (event.type === 'feature') {
        this.trackFeatureUse(event.name);
      } else if (event.type === 'error') {
        this.trackError(event.errorType, event.context, event.details);
      }
    });
  }

  /**
   * 获取统计摘要
   * @returns {object} 统计摘要
   */
  getStatsSummary() {
    if (this.analytics && typeof this.analytics.getStatsSummary === 'function') {
      return this.analytics.getStatsSummary();
    }
    return null;
  }

  /**
   * 手动触发数据上报
   * @returns {Promise} 上报结果
   */
  async uploadReports() {
    if (this.analytics && typeof this.analytics.uploadReports === 'function') {
      return await this.analytics.uploadReports();
    }
    return Promise.resolve();
  }

  /**
   * 检查服务健康状态
   * @returns {Promise} 健康状态
   */
  async checkHealth() {
    if (this.analytics && typeof this.analytics.checkHealth === 'function') {
      return await this.analytics.checkHealth();
    }
    return Promise.resolve({ status: 'unknown' });
  }
}

// 创建单例实例
const windowsAnalyticsIntegration = new WindowsAnalyticsIntegration();

module.exports = windowsAnalyticsIntegration;