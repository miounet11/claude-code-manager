# Miaoda 统计上报和更新检查功能说明

## 概述

从 v4.1.0 版本开始，Miaoda 已经激活了以下两个重要功能：

1. **用户行为统计上报** - 帮助我们了解用户使用习惯，改进产品体验
2. **自动更新检查** - 让用户及时获得最新版本和功能

## 统计上报功能

### 收集的数据

我们仅收集匿名的使用统计数据，**不会收集任何个人隐私信息**：

#### 基础信息
- 匿名用户 ID（随机生成）
- 匿名设备 ID（基于硬件信息生成的哈希值）
- 应用版本号
- 操作系统平台（macOS/Windows）

#### 使用统计
- 每日启动次数
- 使用时长
- 页面访问次数（终端、配置、本地模型等）
- 功能使用频率（新建终端、保存配置、切换模型等）

#### 不会收集的信息
- ❌ 用户输入的任何内容
- ❌ API 密钥或认证信息
- ❌ 文件路径或文件内容
- ❌ IP 地址或地理位置
- ❌ 系统用户名或真实身份信息

### 数据用途

收集的数据仅用于：
- 了解功能使用频率，优化产品设计
- 分析使用模式，改进用户体验
- 监控应用稳定性，及时修复问题
- 统计版本分布，制定升级策略

### 上报机制

- **上报时机**：
  - 应用启动后 5 秒（上报历史数据）
  - 每天凌晨 2 点（定时上报前一天数据）
  - 应用退出前（上报当前会话数据）

- **上报地址**：`https://api.iclaudecode.cn/api/analytics/batch`

- **数据保存**：本地最多保存 7 天的统计数据，上报成功后自动清理

### 隐私保护承诺

1. **数据匿名化**：所有 ID 都是随机生成，无法追溯到具体用户
2. **数据最小化**：只收集改进产品必需的数据
3. **数据安全**：使用 HTTPS 加密传输
4. **用户控制**：后续版本将提供关闭统计的选项

## 更新检查功能

### 工作原理

1. **自动检查**：
   - 应用启动 10 秒后进行首次检查
   - 之后每 30 分钟检查一次
   - 静默检查，不会打扰用户

2. **手动检查**：
   - 通过系统托盘菜单的"检查更新"选项
   - 会显示检查结果对话框

3. **检查地址**：`https://api.iclaudecode.cn/updates.json`

### 更新类型

#### 可选更新
- 显示更新对话框，用户可以选择：
  - 立即更新
  - 稍后提醒
  - 跳过此版本

#### 强制更新
- 重要安全更新或重大 bug 修复
- 必须更新才能继续使用
- 一般用于紧急情况

### 更新流程

1. **发现新版本**：显示版本信息和更新内容
2. **下载更新**：在默认浏览器中打开下载链接
3. **手动安装**：下载完成后，用户手动安装新版本

### 版本信息

更新检查会获取以下信息：
- 最新版本号
- 发布日期
- 更新说明（中英文）
- 下载链接（根据系统架构自动选择）
- 文件大小和校验和

## 后端对接要求

### 统计上报接口

请参考 `docs/API_ANALYTICS_SPEC.md` 文档实现：
- 批量数据接收接口
- 数据存储和聚合
- 健康检查接口

### 更新检查接口

请参考 `docs/API_UPDATE_CHECK_SPEC.md` 文档实现：
- 版本信息 JSON 文件
- 下载服务器配置
- CDN 加速支持

## 开发者说明

### 添加统计跟踪点

在需要跟踪的地方使用 `analyticsIntegration`：

```javascript
const analyticsIntegration = require('./services/analytics-integration');

// 跟踪页面访问
analyticsIntegration.trackPageView('settings');

// 跟踪功能使用
analyticsIntegration.trackFeatureUse('export_config');

// 跟踪特定类型的操作
analyticsIntegration.trackTerminalAction('create');
analyticsIntegration.trackConfigAction('save');
analyticsIntegration.trackProxyRequest('openai', 'gpt-4');
```

### 测试环境变量

```bash
# 自定义统计上报地址
export MIAODA_API_BASE_URL=https://test-api.example.com

# 自定义更新检查地址
export MIAODA_UPDATE_CHECK_URL=https://test-api.example.com/updates.json

# 启动应用
npm run dev
```

## 常见问题

### Q: 如何确认统计功能正常工作？
A: 在开发者工具的 Console 中会看到相关日志：
- "准备上报 X 条数据"
- "成功上报 X 条数据"

### Q: 如何测试更新功能？
A: 可以通过系统托盘菜单手动触发"检查更新"

### Q: 统计数据存储在哪里？
A: 存储在 `~/Library/Application Support/miaoda/analytics.json`

### Q: 如何临时禁用这些功能？
A: 目前需要修改代码，后续版本会提供用户设置选项

## 未来计划

1. **用户设置**：
   - 添加开关选项，允许用户关闭统计
   - 提供数据删除功能

2. **增强功能**：
   - 支持增量更新
   - 添加更详细的使用分析
   - 支持 A/B 测试

3. **透明度**：
   - 在应用内显示收集的数据
   - 提供数据导出功能

## 相关文档

- [统计上报接口规范](docs/API_ANALYTICS_SPEC.md)
- [更新检查接口规范](docs/API_UPDATE_CHECK_SPEC.md)
- [隐私政策](PRIVACY_POLICY.md)（待创建）