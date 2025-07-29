# Miaoda 架构文档

## 模块设计原则

### 服务层（单例模式）

所有 `src/main/services/` 下的服务模块都采用单例模式，导出实例而非类：

```javascript
// ✅ 正确的服务模块导出方式
class ConfigService {
  // ... 实现
}

module.exports = new ConfigService();
```

**原因**：
1. 服务在整个应用生命周期中只需要一个实例
2. 避免状态管理的复杂性
3. 简化依赖注入和测试

### 使用服务模块

```javascript
// ✅ 正确使用方式
const configService = require('./services/config-service');
configService.addConfig(config);

// ❌ 错误使用方式
const ConfigService = require('./services/config-service');
const configService = new ConfigService();
```

## 主要服务模块

### 核心服务
- **config-service.js** - 配置管理（单例）
- **proxy-server.js** - 代理服务器（单例）
- **claude-service.js** - Claude CLI 管理（单例）
- **environment-service.js** - 环境检测（单例）
- **ipc-controller-simple.js** - IPC 通信控制（单例）

### 辅助服务
- **format-converter.js** - API 格式转换（单例）
- **service-registry.js** - AI 服务注册表（单例）
- **local-model-service.js** - 本地模型管理（单例）
- **error-service.js** - 错误处理（单例）
- **cache-manager.js** - 缓存管理（单例）

## 测试架构

### 测试导入模式

测试文件应直接使用导出的实例：

```javascript
// test/test-example.js
const configService = require('../src/main/services/config-service');
const proxyServer = require('../src/main/services/proxy-server');

// 直接使用实例方法
const config = configService.getCurrentConfig();
await proxyServer.start(config);
```

### 模拟 Electron 环境

某些测试需要模拟 Electron 环境：

```javascript
// 模拟 electron 模块
require('module')._cache[require.resolve('electron')] = {
  exports: {
    app: mockApp,
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    shell: mockShell
  }
};
```

## 进程通信

### 主进程服务初始化

```javascript
// src/main/index.js
const ipcController = require('./services/ipc-controller-simple');
const proxyServer = require('./services/proxy-server');

app.whenReady().then(() => {
  createWindow();
  ipcController.initialize(mainWindow);
});
```

### IPC 通道命名规范

- `config:*` - 配置相关操作
- `claude:*` - Claude CLI 控制
- `proxy:*` - 代理服务器操作
- `terminal:*` - 终端管理
- `local-models:*` - 本地模型管理
- `analytics:*` - 使用统计
- `update:*` - 自动更新

## 错误处理

所有服务都应该返回一致的错误格式：

```javascript
{
  success: false,
  error: '错误描述',
  code: 'ERROR_CODE', // 可选
  details: {} // 可选的详细信息
}
```

## 内存管理

### 资源清理

服务应提供清理方法：

```javascript
class ProxyServer {
  destroy() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
```

### 事件监听器管理

避免内存泄漏：

```javascript
// 使用 once 而非 on
emitter.once('event', handler);

// 或在清理时移除监听器
cleanup() {
  emitter.removeListener('event', this.handler);
}
```

## 性能优化

### 懒加载

某些重量级模块应该懒加载：

```javascript
let pty;
try {
  pty = require('node-pty'); // 仅在需要时加载
} catch (e) {
  // 降级处理
}
```

### 缓存策略

使用 cache-manager 服务进行统一缓存管理：

```javascript
const cacheManager = require('./services/cache-manager');
const cached = await cacheManager.get('key');
if (!cached) {
  const data = await fetchData();
  await cacheManager.set('key', data);
}
```