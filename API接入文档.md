# iClaudeCode Analytics API 接入文档

## 概述

iClaudeCode Analytics API 是一个轻量级的客户端行为统计服务，支持客户端本地聚合数据后批量上报，降低服务器计算压力和网络流量消耗。

- **API基础地址**: `https://api.iclaudecode.cn`
- **支持协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8

## 快速开始

### 1. 健康检查

```bash
GET /api/analytics/health
```

响应示例：
```json
{
    "status": "ok",
    "server_time": "2024-01-20T10:30:00",
    "version": "1.0.0"
}
```

### 2. 数据上报接口

#### 批量上报统计数据

```bash
POST /api/analytics/batch
Content-Type: application/json
```

请求参数：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reports | Array | 是 | 统计数据数组，最多100条 |
| client_time | String | 否 | 客户端时间 (ISO 8601格式) |

单条报告数据结构：

```json
{
    "user_id": "user_123456",
    "device_id": "device_abc123",
    "date": "2024-01-20",
    "summary": {
        "session_count": 5,
        "total_duration": 3600,
        "page_views": {
            "home": 10,
            "profile": 3,
            "settings": 1
        },
        "features_used": {
            "search": 15,
            "share": 2,
            "purchase": 1
        },
        "first_open_time": "09:00:00",
        "last_active_time": "22:30:00"
    }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | String | 是 | 用户唯一标识 |
| device_id | String | 否 | 设备唯一标识 |
| date | String | 是 | 统计日期 (YYYY-MM-DD) |
| summary | Object | 是 | 统计汇总数据 |
| summary.session_count | Integer | 是 | 当日会话次数 |
| summary.total_duration | Integer | 是 | 总使用时长(秒) |
| summary.page_views | Object | 否 | 页面访问统计 |
| summary.features_used | Object | 否 | 功能使用统计 |
| summary.first_open_time | String | 否 | 首次打开时间 (HH:MM:SS) |
| summary.last_active_time | String | 否 | 最后活跃时间 (HH:MM:SS) |

完整请求示例：

```json
{
    "reports": [
        {
            "user_id": "user_123456",
            "device_id": "device_abc123",
            "date": "2024-01-19",
            "summary": {
                "session_count": 3,
                "total_duration": 1800,
                "page_views": {
                    "home": 5,
                    "profile": 2
                },
                "features_used": {
                    "search": 8
                },
                "first_open_time": "10:30:00",
                "last_active_time": "18:45:00"
            }
        },
        {
            "user_id": "user_123456",
            "device_id": "device_abc123",
            "date": "2024-01-20",
            "summary": {
                "session_count": 5,
                "total_duration": 3600,
                "page_views": {
                    "home": 10,
                    "profile": 3,
                    "settings": 1
                },
                "features_used": {
                    "search": 15,
                    "share": 2,
                    "purchase": 1
                },
                "first_open_time": "09:00:00",
                "last_active_time": "22:30:00"
            }
        }
    ],
    "client_time": "2024-01-21T00:05:00Z"
}
```

响应示例：

```json
{
    "status": "ok",
    "success_count": 2,
    "errors": null
}
```

错误响应示例：

```json
{
    "status": "ok",
    "success_count": 1,
    "errors": [
        {
            "report": "2024-01-19",
            "error": "Duplicate entry"
        }
    ]
}
```

## 统计查询接口

### 1. 获取DAU (每日活跃用户)

```bash
GET /api/stats/dau?date=2024-01-20
```

参数：
- `date` (可选): 查询日期，格式 YYYY-MM-DD，默认为当天

响应示例：
```json
{
    "date": "2024-01-20",
    "dau": 15234
}
```

### 2. 获取留存率

```bash
GET /api/stats/retention?days=7
```

参数：
- `days` (可选): 查询天数，默认7天

响应示例：
```json
{
    "retention_data": [
        {
            "cohort_date": "2024-01-14",
            "cohort_size": 1000,
            "retention": {
                "day_1": 65.5,
                "day_2": 45.2,
                "day_3": 38.7,
                "day_7": 25.3
            }
        }
    ]
}
```

### 3. 获取统计概览

```bash
GET /api/stats/overview
```

响应示例：
```json
{
    "today": {
        "dau": 15234,
        "avg_duration": 1856.45,
        "avg_sessions": 3.2
    },
    "yesterday": {
        "dau": 14890
    },
    "dau_change": 2.31
}
```

## 客户端集成示例

### JavaScript/React Native

```javascript
class AnalyticsClient {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.localStorage = window.localStorage || AsyncStorage;
    }

    // 收集当天数据
    async collectDailyData() {
        const today = new Date().toISOString().split('T')[0];
        const key = `analytics_${today}`;
        const data = await this.localStorage.getItem(key);
        return data ? JSON.parse(data) : this.initDailyData();
    }

    // 批量上报
    async uploadReports() {
        const reports = await this.collectUnreportedData();
        
        if (reports.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/analytics/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reports: reports,
                    client_time: new Date().toISOString()
                })
            });

            const result = await response.json();
            
            if (result.status === 'ok') {
                // 标记已上报
                await this.markAsReported(reports);
            }
            
            return result;
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    // 设置定时上报
    setupAutoUpload() {
        // 每天凌晨2点上报
        const scheduleUpload = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(2, 0, 0, 0);
            
            const timeout = tomorrow.getTime() - now.getTime();
            
            setTimeout(() => {
                this.uploadReports();
                scheduleUpload(); // 递归设置下一次
            }, timeout);
        };
        
        scheduleUpload();
        
        // App启动时检查并上报
        this.uploadReports();
    }
}
```

### iOS/Swift

```swift
class AnalyticsClient {
    private let apiUrl: String
    private let userDefaults = UserDefaults.standard
    
    init(apiUrl: String) {
        self.apiUrl = apiUrl
    }
    
    func uploadReports() async throws {
        let reports = collectUnreportedData()
        guard !reports.isEmpty else { return }
        
        let url = URL(string: "\(apiUrl)/api/analytics/batch")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "reports": reports,
            "client_time": ISO8601DateFormatter().string(from: Date())
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(UploadResponse.self, from: data)
        
        if response.status == "ok" {
            markAsReported(reports)
        }
    }
}
```

### Android/Kotlin

```kotlin
class AnalyticsClient(private val apiUrl: String) {
    private val sharedPrefs = context.getSharedPreferences("analytics", Context.MODE_PRIVATE)
    
    suspend fun uploadReports() {
        val reports = collectUnreportedData()
        if (reports.isEmpty()) return
        
        try {
            val response = httpClient.post("$apiUrl/api/analytics/batch") {
                contentType(ContentType.Application.Json)
                setBody(BatchUploadRequest(
                    reports = reports,
                    clientTime = Instant.now().toString()
                ))
            }
            
            val result = response.body<UploadResponse>()
            if (result.status == "ok") {
                markAsReported(reports)
            }
        } catch (e: Exception) {
            Log.e("Analytics", "Upload failed", e)
        }
    }
}
```

## 最佳实践

### 1. 数据上报策略

- **定时上报**: 建议每天凌晨2-4点上报前一天数据
- **启动检查**: App启动时检查是否有未上报的历史数据
- **网络恢复**: 监听网络状态，恢复时尝试上报
- **批量上报**: 积累多天数据一次性上报，减少请求次数

### 2. 数据准确性

- **时间校准**: 使用服务器时间校准客户端时间偏差
- **去重处理**: 服务端会自动处理重复数据，同一用户同一天的数据只保留一份
- **数据验证**: 上报前在客户端进行基础验证

### 3. 性能优化

- **异步处理**: 统计和上报都应该在后台线程进行
- **数据压缩**: 可以考虑对大量数据进行压缩
- **缓存策略**: 合理设置本地缓存大小，避免占用过多存储

### 4. 安全建议

- **HTTPS传输**: 必须使用HTTPS协议传输数据
- **数据签名**: 可以添加简单的签名验证（联系后端获取签名密钥）
- **频率限制**: 客户端应该限制上报频率，避免恶意请求

## 错误处理

### HTTP状态码

- `200`: 请求成功
- `400`: 请求参数错误
- `429`: 请求过于频繁
- `500`: 服务器内部错误

### 错误响应格式

```json
{
    "status": "error",
    "message": "错误描述信息"
}
```

### 常见错误

1. **数据格式错误**
   - 确保日期格式为 YYYY-MM-DD
   - 确保必填字段都有值
   - 确保数值类型字段不是字符串

2. **重复数据**
   - 同一用户同一天的数据只能上报一次
   - 如需更新，请联系后端支持

3. **请求过大**
   - 单次请求最多100条记录
   - 请求体大小不超过10MB

## 联系支持

如有问题或需要帮助，请联系：
- 技术支持邮箱: support@iclaudecode.cn
- API状态页面: https://status.iclaudecode.cn