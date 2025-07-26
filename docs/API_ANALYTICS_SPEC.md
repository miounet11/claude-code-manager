# Miaoda 统计上报接口规范

## 概述

本文档定义了 Miaoda 应用的用户行为统计数据上报接口规范。后端需要实现这些接口来接收和处理客户端上报的统计数据。

## 基础信息

- **基础 URL**: `https://api.iclaudecode.cn`
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: 暂无（后续可添加 API Key）

## 接口定义

### 1. 批量上报接口

用于批量上报用户的每日使用数据。

#### 请求

- **URL**: `/api/analytics/batch`
- **方法**: `POST`
- **Content-Type**: `application/json`

#### 请求体格式

```json
{
  "reports": [
    {
      "user_id": "user_a1b2c3d4e5f6g7h8",
      "device_id": "device_1234567890ab",
      "date": "2024-01-26",
      "app_version": "4.1.0",
      "platform": "darwin",
      "app_name": "Miaoda",
      "summary": {
        "session_count": 5,
        "total_duration": 3600,
        "first_open_time": "09:30:15",
        "last_active_time": "18:45:30",
        "page_views": {
          "terminal": 15,
          "config": 3,
          "local_models": 2
        },
        "features_used": {
          "new_terminal": 5,
          "config_save": 2,
          "model_switch": 8,
          "proxy_request": 120
        }
      }
    }
  ],
  "client_time": "2024-01-27T02:00:00.000Z"
}
```

#### 字段说明

##### reports 数组中的每个对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户唯一标识，格式：`user_` + 16位十六进制字符串 |
| device_id | string | 是 | 设备唯一标识，格式：`device_` + 12位十六进制字符串 |
| date | string | 是 | 统计日期，格式：YYYY-MM-DD |
| app_version | string | 是 | 应用版本号，如 "4.1.0" |
| platform | string | 是 | 操作系统平台：darwin(macOS), win32(Windows), linux |
| app_name | string | 是 | 应用名称，固定为 "Miaoda" |
| summary | object | 是 | 每日统计摘要数据 |

##### summary 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_count | number | 是 | 当日启动次数 |
| total_duration | number | 是 | 当日总使用时长（秒） |
| first_open_time | string | 否 | 当日首次打开时间，格式：HH:mm:ss |
| last_active_time | string | 否 | 当日最后活跃时间，格式：HH:mm:ss |
| page_views | object | 否 | 页面访问统计，key为页面名称，value为访问次数 |
| features_used | object | 否 | 功能使用统计，key为功能名称，value为使用次数 |

##### 主要页面名称

- `terminal` - 终端页面
- `config` - 配置管理
- `config_wizard` - 配置向导
- `local_models` - 本地模型管理
- `usage_stats` - 使用统计

##### 主要功能名称

- `new_terminal` - 新建终端
- `close_terminal` - 关闭终端
- `config_save` - 保存配置
- `config_test` - 测试配置
- `model_switch` - 切换模型
- `proxy_request` - 代理请求
- `local_model_pull` - 拉取本地模型
- `local_model_delete` - 删除本地模型

#### 响应

##### 成功响应 (200 OK)

```json
{
  "status": "ok",
  "success_count": 1,
  "failed_count": 0,
  "message": "数据上报成功",
  "server_time": "2024-01-27T02:00:05.123Z"
}
```

##### 部分成功响应 (200 OK)

```json
{
  "status": "partial",
  "success_count": 3,
  "failed_count": 1,
  "failed_items": [
    {
      "index": 2,
      "reason": "数据格式错误"
    }
  ],
  "message": "部分数据上报成功",
  "server_time": "2024-01-27T02:00:05.123Z"
}
```

##### 失败响应 (400/500)

```json
{
  "status": "error",
  "message": "请求数据格式错误",
  "error_code": "INVALID_REQUEST"
}
```

### 2. 健康检查接口

用于检查统计服务是否正常运行。

#### 请求

- **URL**: `/api/analytics/health`
- **方法**: `GET`

#### 响应 (200 OK)

```json
{
  "status": "healthy",
  "service": "analytics",
  "version": "1.0.0",
  "server_time": "2024-01-27T02:00:00.000Z"
}
```

## 数据处理建议

### 1. 数据存储

建议后端按以下方式组织数据：

```sql
-- 用户表
CREATE TABLE users (
  user_id VARCHAR(32) PRIMARY KEY,
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  total_sessions INT,
  total_duration BIGINT
);

-- 设备表
CREATE TABLE devices (
  device_id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32),
  platform VARCHAR(16),
  first_seen TIMESTAMP,
  last_seen TIMESTAMP
);

-- 每日统计表
CREATE TABLE daily_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(32),
  device_id VARCHAR(32),
  date DATE,
  app_version VARCHAR(16),
  session_count INT,
  total_duration INT,
  first_open_time TIME,
  last_active_time TIME,
  page_views JSONB,
  features_used JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 数据聚合

建议实现以下聚合维度：

- **用户维度**: 活跃用户数、新增用户数、留存率
- **时间维度**: 日活、周活、月活、使用时长分布
- **功能维度**: 功能使用频率、页面访问深度
- **版本维度**: 各版本用户分布、版本升级率

### 3. 重复数据处理

- 使用 `user_id + date` 作为唯一键
- 如果收到重复数据，更新而不是插入
- 保留最新的上报数据

### 4. 数据清理

- 建议保留最近 90 天的明细数据
- 超过 90 天的数据可以聚合后存档
- 异常数据（如使用时长超过 24 小时）需要过滤

## 隐私保护

1. **数据匿名化**
   - user_id 和 device_id 都是随机生成的，不包含真实用户信息
   - 不收集任何个人隐私信息（如 IP 地址、地理位置等）

2. **数据最小化**
   - 只收集应用改进所需的必要数据
   - 不收集用户输入的内容或 API 密钥等敏感信息

3. **用户控制**
   - 后续版本将添加用户关闭统计的选项
   - 用户可以请求删除其统计数据

## 性能要求

1. **响应时间**: < 500ms
2. **并发支持**: 至少支持 1000 QPS
3. **可用性**: 99.9% SLA
4. **数据延迟**: 实时处理，最多 5 分钟延迟

## 错误码定义

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| INVALID_REQUEST | 400 | 请求格式错误 |
| INVALID_JSON | 400 | JSON 解析失败 |
| MISSING_FIELD | 400 | 缺少必填字段 |
| RATE_LIMITED | 429 | 请求频率超限 |
| SERVER_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务暂时不可用 |

## 后续扩展

1. **实时统计**: 支持 WebSocket 实时上报
2. **自定义事件**: 支持上报自定义事件
3. **用户分群**: 支持按用户行为分群
4. **A/B 测试**: 支持功能 A/B 测试数据收集

## 测试数据

可以使用以下 curl 命令测试接口：

```bash
# 测试批量上报
curl -X POST https://api.iclaudecode.cn/api/analytics/batch \
  -H "Content-Type: application/json" \
  -d '{
    "reports": [{
      "user_id": "user_test123456789",
      "device_id": "device_test123456",
      "date": "2024-01-26",
      "app_version": "4.1.0",
      "platform": "darwin",
      "app_name": "Miaoda",
      "summary": {
        "session_count": 1,
        "total_duration": 300,
        "page_views": {"terminal": 5},
        "features_used": {"new_terminal": 1}
      }
    }],
    "client_time": "2024-01-26T10:00:00.000Z"
  }'

# 测试健康检查
curl https://api.iclaudecode.cn/api/analytics/health
```