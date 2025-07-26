'use strict';

const { dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * 错误处理服务
 * 提供友好的错误提示和解决方案
 */
class ErrorService {
  constructor() {
    this.errorLog = [];
    this.solutions = this.loadSolutions();
    this.logFile = path.join(os.homedir(), '.miaoda', 'error.log');
  }

  /**
   * 加载错误解决方案
   */
  loadSolutions() {
    return {
      'ECONNREFUSED': {
        title: '连接被拒绝',
        message: 'API 服务器拒绝连接，请检查：',
        solutions: [
          '1. API 地址是否正确',
          '2. 网络连接是否正常',
          '3. 防火墙或代理设置',
          '4. API 服务是否正常运行'
        ]
      },
      'ENOTFOUND': {
        title: '找不到服务器',
        message: '无法解析 API 服务器地址，请检查：',
        solutions: [
          '1. API 地址拼写是否正确',
          '2. DNS 设置是否正常',
          '3. 网络连接是否可用'
        ]
      },
      'ETIMEDOUT': {
        title: '请求超时',
        message: 'API 请求超时，可能的原因：',
        solutions: [
          '1. 网络速度过慢',
          '2. API 服务器响应缓慢',
          '3. 请求数据量过大',
          '4. 尝试增加超时时间'
        ]
      },
      'UNAUTHORIZED': {
        title: '认证失败',
        message: 'API Key 无效或已过期',
        solutions: [
          '1. 检查 API Key 是否正确',
          '2. 确认 API Key 未过期',
          '3. 验证 API Key 权限',
          '4. 尝试重新生成 API Key'
        ]
      },
      'RATE_LIMIT': {
        title: '请求频率限制',
        message: '请求频率过高，被服务器限制',
        solutions: [
          '1. 减少请求频率',
          '2. 等待一段时间后重试',
          '3. 检查 API 配额限制',
          '4. 考虑升级 API 套餐'
        ]
      },
      'INSUFFICIENT_QUOTA': {
        title: '配额不足',
        message: 'API 使用配额已耗尽',
        solutions: [
          '1. 检查当前使用量',
          '2. 等待配额重置',
          '3. 购买更多配额',
          '4. 优化 Token 使用'
        ]
      },
      'MODEL_NOT_FOUND': {
        title: '模型不存在',
        message: '请求的模型不可用',
        solutions: [
          '1. 检查模型名称拼写',
          '2. 确认模型是否支持',
          '3. 查看可用模型列表',
          '4. 使用默认模型'
        ]
      },
      'PROXY_ERROR': {
        title: '代理错误',
        message: '代理服务器连接失败',
        solutions: [
          '1. 检查代理设置',
          '2. 验证代理服务器状态',
          '3. 尝试直连',
          '4. 更换代理服务器'
        ]
      },
      'INVALID_CONFIG': {
        title: '配置无效',
        message: '当前配置存在问题',
        solutions: [
          '1. 检查所有必填项',
          '2. 验证 URL 格式',
          '3. 测试 API 连接',
          '4. 使用默认配置'
        ]
      },
      'CLAUDE_NOT_FOUND': {
        title: 'Claude CLI 未安装',
        message: '系统中未找到 Claude 命令行工具',
        solutions: [
          '1. 运行环境检测',
          '2. 使用一键安装功能',
          '3. 手动安装 Claude CLI',
          '4. 检查 PATH 环境变量'
        ]
      }
    };
  }

  /**
   * 处理错误
   */
  async handleError(error, context = {}) {
    // 记录错误
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message,
      code: error.code,
      stack: error.stack,
      context
    };
    
    this.errorLog.push(errorRecord);
    await this.saveErrorLog(errorRecord);

    // 获取解决方案
    const solution = this.getSolution(error);
    
    // 显示错误对话框
    const response = await this.showErrorDialog(solution, error);
    
    return {
      handled: true,
      solution,
      userAction: response
    };
  }

  /**
   * 获取错误解决方案
   */
  getSolution(error) {
    // 根据错误代码查找
    if (error.code && this.solutions[error.code]) {
      return this.solutions[error.code];
    }

    // 根据错误消息匹配
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return this.solutions['UNAUTHORIZED'];
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return this.solutions['RATE_LIMIT'];
    }
    
    if (errorMessage.includes('timeout')) {
      return this.solutions['ETIMEDOUT'];
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('insufficient')) {
      return this.solutions['INSUFFICIENT_QUOTA'];
    }
    
    if (errorMessage.includes('model')) {
      return this.solutions['MODEL_NOT_FOUND'];
    }
    
    if (errorMessage.includes('proxy')) {
      return this.solutions['PROXY_ERROR'];
    }

    // 默认解决方案
    return {
      title: '未知错误',
      message: error.message,
      solutions: [
        '1. 检查网络连接',
        '2. 验证配置信息',
        '3. 查看错误日志',
        '4. 联系技术支持'
      ]
    };
  }

  /**
   * 显示错误对话框
   */
  async showErrorDialog(solution, error) {
    const buttons = ['重试', '查看日志', '忽略'];
    const defaultId = 0;
    const cancelId = 2;

    const detail = `
${solution.message}

建议解决方案：
${solution.solutions.join('\n')}

错误详情：
${error.message}
${error.code ? `错误代码: ${error.code}` : ''}
    `.trim();

    const response = await dialog.showMessageBox({
      type: 'error',
      title: solution.title,
      message: solution.title,
      detail,
      buttons,
      defaultId,
      cancelId
    });

    switch (response.response) {
      case 0: // 重试
        return 'retry';
      case 1: // 查看日志
        await this.openErrorLog();
        return 'view_log';
      case 2: // 忽略
        return 'ignore';
    }
  }

  /**
   * 保存错误日志
   */
  async saveErrorLog(errorRecord) {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      const logEntry = JSON.stringify(errorRecord) + '\n';
      await fs.appendFile(this.logFile, logEntry);
    } catch (e) {
      console.error('保存错误日志失败:', e);
    }
  }

  /**
   * 打开错误日志
   */
  async openErrorLog() {
    const { shell } = require('electron');
    try {
      await shell.openPath(this.logFile);
    } catch (e) {
      dialog.showErrorBox('打开失败', `无法打开日志文件: ${e.message}`);
    }
  }

  /**
   * 获取最近的错误
   */
  getRecentErrors(limit = 10) {
    return this.errorLog.slice(-limit).reverse();
  }

  /**
   * 清除错误日志
   */
  async clearErrorLog() {
    this.errorLog = [];
    try {
      await fs.unlink(this.logFile);
    } catch (e) {
      // 文件可能不存在
    }
  }

  /**
   * 生成错误报告
   */
  async generateErrorReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      version: require('electron').app.getVersion(),
      errors: this.errorLog,
      systemInfo: {
        node: process.version,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        v8: process.versions.v8
      }
    };

    const reportPath = path.join(os.homedir(), '.miaoda', `error-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }
}

// 导出单例
module.exports = new ErrorService();