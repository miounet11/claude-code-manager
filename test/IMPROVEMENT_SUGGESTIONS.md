# Miaoda 项目改进建议

基于测试结果和代码分析，以下是详细的改进建议：

## 1. 代理服务器改进

### 当前问题
- 请求转发返回 400 错误
- 动态路由模式缺少默认配置
- 单例模式限制了某些测试场景

### 建议的修改

#### 1.1 修复请求体转发问题

在 `src/main/services/proxy-server.js` 中：

```javascript
// 在 onProxyReq 中确保请求体正确转发
onProxyReq: (proxyReq, req, res) => {
  // 如果有请求体，需要重新写入
  if (req.body) {
    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
    proxyReq.end();
  }
  
  // 其他头部设置...
}
```

#### 1.2 改进动态路由模式

```javascript
// 为动态模式提供默认配置
if (this.isDynamicMode) {
  // 设置一个占位符 target，实际 target 会在路由处理器中动态设置
  proxyOptions.target = 'http://localhost';
  proxyOptions.router = (req) => {
    // 从请求路径中解析实际的目标服务
    const match = req.path.match(/^\/proxy\/([^\/]+)\/([^\/]+)\/(.*)/);
    if (match) {
      const service = serviceRegistry.get(match[1]);
      if (service) {
        return service.baseUrl;
      }
    }
    return null;
  };
}
```

#### 1.3 支持测试模式的多实例

```javascript
class ProxyServer extends EventEmitter {
  // 添加静态方法创建新实例（仅用于测试）
  static createTestInstance() {
    return new ProxyServer();
  }
}

// 导出时保持向后兼容
const defaultInstance = new ProxyServer();
defaultInstance.ProxyServer = ProxyServer; // 用于测试
module.exports = defaultInstance;
```

## 2. 终端模块改进

### 当前问题
- node-pty 构建问题
- 错误处理不够友好

### 建议的修改

#### 2.1 改进 node-pty 加载和错误处理

```javascript
// 在 pty-manager.js 中
let pty = null;
let ptyAvailable = false;

try {
  pty = require('node-pty');
  ptyAvailable = true;
} catch (e) {
  console.warn('node-pty 不可用，将使用标准进程模式');
  console.warn('运行 "npm rebuild node-pty" 以启用完整终端功能');
}

// 提供更好的错误信息
if (!ptyAvailable && options.requirePty) {
  throw new Error(
    'PTY 功能不可用。请运行 "npm rebuild node-pty" 或 "npm install --build-from-source node-pty"'
  );
}
```

#### 2.2 添加构建脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps",
    "rebuild-pty": "npm rebuild node-pty --build-from-source"
  }
}
```

## 3. 测试架构改进

### 3.1 创建测试助手模块

创建 `test/helpers/module-loader.js`：

```javascript
/**
 * 统一处理单例和类的加载
 */
function loadModule(modulePath) {
  const module = require(modulePath);
  
  // 检查是否是单例模式
  if (module.constructor && module.constructor.name !== 'Object') {
    // 是实例，尝试获取类
    if (module.constructor) {
      return {
        instance: module,
        Class: module.constructor,
        isSingleton: true
      };
    }
  }
  
  // 是类或普通导出
  return {
    instance: null,
    Class: module,
    isSingleton: false
  };
}

module.exports = { loadModule };
```

### 3.2 改进 Electron 模拟

创建 `test/helpers/electron-mock.js`：

```javascript
class MockWebContents extends EventEmitter {
  constructor() {
    super();
    this.session = {
      clearCache: () => Promise.resolve()
    };
  }
  
  send(channel, ...args) {
    this.emit(channel, ...args);
  }
  
  reload() {
    this.emit('did-finish-load');
  }
}

class MockBrowserWindow {
  constructor() {
    this.webContents = new MockWebContents();
    this._isDestroyed = false;
  }
  
  isDestroyed() {
    return this._isDestroyed;
  }
  
  close() {
    this._isDestroyed = true;
  }
}

module.exports = {
  MockWebContents,
  MockBrowserWindow,
  setupElectronMock() {
    // 设置全局 Electron 模拟
  }
};
```

## 4. 新增测试用例

### 4.1 分析系统测试

创建 `test/test-analytics.js`：

```javascript
/**
 * 测试分析系统
 */
async function testAnalytics() {
  // 测试数据收集
  // 测试报告生成
  // 测试隐私保护
}
```

### 4.2 缓存管理测试

创建 `test/test-cache-manager.js`：

```javascript
/**
 * 测试缓存管理
 */
async function testCacheManager() {
  // 测试缓存清理
  // 测试缓存统计
  // 测试选择性清理
}
```

## 5. 性能优化建议

### 5.1 优化环境检测

缓存环境检测结果：

```javascript
class EnvironmentService {
  constructor() {
    this._cachedPath = null;
    this._cacheExpiry = 5 * 60 * 1000; // 5分钟
    this._lastCheck = 0;
  }
  
  async getSystemPath() {
    const now = Date.now();
    if (this._cachedPath && (now - this._lastCheck) < this._cacheExpiry) {
      return this._cachedPath;
    }
    
    // 执行实际检测...
    this._cachedPath = path;
    this._lastCheck = now;
    return path;
  }
}
```

### 5.2 并行测试执行

修改 `test/run-all-tests.js`：

```javascript
// 识别可以并行运行的测试
const parallelTests = [
  'test-new-features.js',
  'test-update-logic.js',
  'test-dynamic-path-finding.js'
];

// 并行执行
const parallelResults = await Promise.all(
  parallelTests.map(test => runTest(test))
);
```

## 6. 文档改进

### 6.1 添加测试指南

创建 `test/README.md`：

```markdown
# Miaoda 测试指南

## 运行测试

### 运行所有测试
npm run test:all

### 运行特定测试
node test/test-proxy-server.js

### 修复常见问题

#### node-pty 构建错误
npm rebuild node-pty

#### 清理并重新安装
rm -rf node_modules
npm install
npm rebuild
```

### 6.2 添加故障排除文档

在主 README 中添加故障排除部分。

## 7. CI/CD 集成建议

### 7.1 添加 GitHub Actions 测试工作流

创建 `.github/workflows/test.yml`：

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
        node: [18, 20]
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node }}
    
    - run: npm ci
    - run: npm rebuild
    - run: npm test
```

## 实施优先级

1. **高优先级**（立即修复）
   - 修复代理服务器请求转发问题
   - 修复动态路由配置问题
   - 添加 node-pty 构建说明

2. **中优先级**（下个版本）
   - 改进测试架构
   - 添加缺失的测试用例
   - 性能优化

3. **低优先级**（长期改进）
   - CI/CD 集成
   - 完整的集成测试套件
   - 测试覆盖率报告

这些改进将显著提升项目的稳定性、可测试性和开发体验。