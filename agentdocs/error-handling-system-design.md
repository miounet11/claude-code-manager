# 统一错误处理系统设计文档

## 概述
为了提升 Miaoda 应用的稳定性和用户体验，我们需要设计并实现一个统一的错误处理系统。

## 当前问题

### 1. 错误处理方式不一致
- app-full.html 使用 alert()
- 主应用使用 console.error()
- 部分组件使用自定义错误提示
- 缺乏统一的错误日志记录

### 2. 用户体验不佳
- 错误信息不友好
- 缺少错误恢复建议
- 没有错误上下文信息
- 无法追踪错误历史

### 3. 开发调试困难
- 错误信息分散
- 缺少错误分类
- 没有错误统计
- 难以重现问题

## 设计目标

1. **统一性** - 所有错误通过同一系统处理
2. **友好性** - 提供清晰的用户提示
3. **可追踪** - 完整的错误日志和堆栈
4. **可恢复** - 提供错误恢复建议
5. **可扩展** - 易于添加新的错误类型

## 系统架构

### 1. 错误分类
```javascript
const ErrorTypes = {
  NETWORK: 'network',        // 网络错误
  CONFIG: 'config',          // 配置错误
  VALIDATION: 'validation',  // 验证错误
  SYSTEM: 'system',         // 系统错误
  PERMISSION: 'permission',  // 权限错误
  UNKNOWN: 'unknown'        // 未知错误
};

const ErrorSeverity = {
  INFO: 'info',       // 信息提示
  WARNING: 'warning', // 警告
  ERROR: 'error',     // 错误
  CRITICAL: 'critical' // 严重错误
};
```

### 2. 错误处理器
```javascript
class ErrorHandler {
  constructor() {
    this.handlers = new Map();
    this.logger = new ErrorLogger();
    this.notifier = new ErrorNotifier();
  }
  
  // 注册错误处理器
  register(type, handler) {
    this.handlers.set(type, handler);
  }
  
  // 处理错误
  handle(error) {
    // 1. 分类错误
    const errorInfo = this.classify(error);
    
    // 2. 记录日志
    this.logger.log(errorInfo);
    
    // 3. 通知用户
    this.notifier.notify(errorInfo);
    
    // 4. 执行特定处理
    const handler = this.handlers.get(errorInfo.type);
    if (handler) {
      handler(errorInfo);
    }
    
    // 5. 上报统计
    this.report(errorInfo);
  }
}
```

### 3. 错误通知系统
```javascript
class ErrorNotifier {
  notify(errorInfo) {
    switch (errorInfo.severity) {
      case ErrorSeverity.INFO:
        this.showInfo(errorInfo);
        break;
      case ErrorSeverity.WARNING:
        this.showWarning(errorInfo);
        break;
      case ErrorSeverity.ERROR:
        this.showError(errorInfo);
        break;
      case ErrorSeverity.CRITICAL:
        this.showCritical(errorInfo);
        break;
    }
  }
  
  showError(errorInfo) {
    // 使用 Electron 对话框
    window.electronAPI.showError(
      errorInfo.title,
      errorInfo.message,
      {
        detail: errorInfo.detail,
        buttons: errorInfo.actions
      }
    );
  }
}
```

### 4. 错误日志系统
```javascript
class ErrorLogger {
  constructor() {
    this.logFile = path.join(app.getPath('userData'), 'error.log');
  }
  
  log(errorInfo) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: errorInfo.type,
      severity: errorInfo.severity,
      message: errorInfo.message,
      stack: errorInfo.stack,
      context: errorInfo.context,
      system: {
        platform: process.platform,
        version: app.getVersion(),
        electron: process.versions.electron
      }
    };
    
    // 写入日志文件
    this.writeToFile(logEntry);
    
    // 保存到内存（最近100条）
    this.saveToMemory(logEntry);
  }
}
```

## 实施计划

### 第一阶段：基础架构（1-2天）
1. 创建 ErrorHandler 核心类
2. 实现基本的错误分类系统
3. 集成 Electron 对话框 API
4. 创建错误日志记录器

### 第二阶段：集成改造（3-4天）
1. 替换现有的错误处理代码
2. 为每个模块添加错误处理
3. 统一错误消息格式
4. 添加错误恢复建议

### 第三阶段：高级功能（2-3天）
1. 实现错误统计和报告
2. 添加错误重现功能
3. 创建错误查看器 UI
4. 实现错误自动上报（可选）

## 使用示例

### 1. 基本错误处理
```javascript
try {
  await saveConfig(config);
} catch (error) {
  ErrorHandler.handle({
    type: ErrorTypes.CONFIG,
    severity: ErrorSeverity.ERROR,
    message: '配置保存失败',
    detail: error.message,
    actions: ['重试', '取消'],
    context: { config }
  });
}
```

### 2. 网络错误处理
```javascript
const response = await fetch(url).catch(error => {
  ErrorHandler.handle({
    type: ErrorTypes.NETWORK,
    severity: ErrorSeverity.ERROR,
    message: '网络请求失败',
    detail: `无法连接到 ${url}`,
    suggestion: '请检查网络连接或代理设置',
    error
  });
});
```

### 3. 验证错误处理
```javascript
function validateConfig(config) {
  if (!config.apiKey) {
    ErrorHandler.handle({
      type: ErrorTypes.VALIDATION,
      severity: ErrorSeverity.WARNING,
      message: '配置验证失败',
      detail: 'API Key 不能为空',
      field: 'apiKey'
    });
    return false;
  }
  return true;
}
```

## 错误消息规范

### 1. 用户友好的消息
- ❌ "Error: ECONNREFUSED 127.0.0.1:8080"
- ✅ "无法连接到代理服务器，请检查服务是否正在运行"

### 2. 提供解决方案
- ❌ "配置无效"
- ✅ "配置无效：API Key 格式不正确，应以 'sk-' 开头"

### 3. 避免技术术语
- ❌ "Null pointer exception in appendChild"
- ✅ "页面加载出现问题，请刷新重试"

## 监控和分析

### 1. 错误统计
- 按类型统计错误频率
- 识别高频错误
- 跟踪错误趋势

### 2. 性能影响
- 监控错误处理耗时
- 避免错误处理影响性能
- 异步处理非关键错误

### 3. 用户影响
- 统计受影响用户数
- 记录错误恢复率
- 收集用户反馈

## 总结

通过实施统一的错误处理系统，我们可以：
1. 提升应用稳定性
2. 改善用户体验
3. 简化问题诊断
4. 加快问题修复

这个系统将成为 Miaoda 应用质量保证的重要组成部分。