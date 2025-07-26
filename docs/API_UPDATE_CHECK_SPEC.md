# Miaoda 更新检查接口规范

## 概述

本文档定义了 Miaoda 应用的版本更新检查接口规范。后端需要实现这个接口来提供版本信息和下载链接。

## 基础信息

- **基础 URL**: `https://api.iclaudecode.cn`
- **更新信息文件**: `/updates.json`
- **数据格式**: JSON
- **字符编码**: UTF-8
- **缓存策略**: 建议 CDN 缓存 5 分钟

## 接口定义

### 1. 更新信息接口

#### 请求

- **URL**: `/updates.json`
- **方法**: `GET`
- **无需认证**

#### 响应格式

```json
{
  "version": "4.2.0",
  "versionCode": 420,
  "versionName": "v4.2.0",
  "releaseDate": "2024-01-28",
  "forceUpdate": false,
  "minVersion": "3.0.0",
  "updateMessage": {
    "zh": "发现新版本 v4.2.0，建议更新以获得更好的体验。",
    "en": "New version v4.2.0 is available. Update recommended for better experience."
  },
  "releaseNotes": {
    "zh": "1. 新增 AI 模型热切换功能\n2. 优化终端性能，响应速度提升 50%\n3. 修复已知问题，提升稳定性\n4. 新增深色主题支持",
    "en": "1. Added AI model hot-switching\n2. Terminal performance improved by 50%\n3. Bug fixes and stability improvements\n4. Added dark theme support"
  },
  "downloads": {
    "macos": {
      "x64": {
        "url": "https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-4.2.0.dmg",
        "size": 85983232,
        "sha256": "sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
        "filename": "Miaoda-4.2.0.dmg"
      },
      "arm64": {
        "url": "https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-4.2.0-arm64.dmg",
        "size": 82313216,
        "sha256": "sha256:b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7",
        "filename": "Miaoda-4.2.0-arm64.dmg"
      }
    },
    "windows": {
      "x64": {
        "url": "https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-Setup-4.2.0-x64.exe",
        "size": 78643200,
        "sha256": "sha256:c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8",
        "filename": "Miaoda-Setup-4.2.0-x64.exe"
      },
      "x86": {
        "url": "https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-Setup-4.2.0-x86.exe",
        "size": 76546048,
        "sha256": "sha256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9",
        "filename": "Miaoda-Setup-4.2.0-x86.exe"
      }
    }
  },
  "changelog": {
    "zh": "https://github.com/miounet11/claude-code-manager/blob/main/CHANGELOG_ZH.md",
    "en": "https://github.com/miounet11/claude-code-manager/blob/main/CHANGELOG.md"
  },
  "announcement": {
    "show": false,
    "title": {
      "zh": "重要通知",
      "en": "Important Notice"
    },
    "content": {
      "zh": "Miaoda 5.0 即将发布，敬请期待！",
      "en": "Miaoda 5.0 is coming soon!"
    },
    "link": "https://miaoda.app/announcement"
  }
}
```

## 字段说明

### 根字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 是 | 最新版本号，格式：主版本.次版本.修订号 |
| versionCode | number | 是 | 版本代码，用于版本比较（递增整数） |
| versionName | string | 是 | 显示版本名称，通常带 v 前缀 |
| releaseDate | string | 是 | 发布日期，格式：YYYY-MM-DD |
| forceUpdate | boolean | 是 | 是否强制更新 |
| minVersion | string | 否 | 最低支持版本，低于此版本强制更新 |
| updateMessage | object | 是 | 更新提示消息（多语言） |
| releaseNotes | object | 是 | 版本更新说明（多语言） |
| downloads | object | 是 | 各平台下载信息 |
| changelog | object | 否 | 完整更新日志链接 |
| announcement | object | 否 | 公告信息 |

### downloads 对象结构

每个平台包含不同架构的下载信息：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 下载链接（HTTPS） |
| size | number | 是 | 文件大小（字节） |
| sha256 | string | 是 | SHA256 校验和，格式：sha256:十六进制值 |
| filename | string | 是 | 文件名 |

## 版本比较逻辑

客户端使用以下逻辑判断是否需要更新：

1. **版本号比较**: 按照语义化版本规则比较
   - 主版本号 > 次版本号 > 修订号
   - 例如：4.2.0 > 4.1.9 > 4.1.0

2. **强制更新判断**:
   - 如果 `forceUpdate` 为 `true`，强制更新
   - 如果当前版本 < `minVersion`，强制更新
   - 否则为可选更新

3. **跳过版本**: 
   - 用户可以选择跳过某个版本
   - 客户端会记录跳过的版本号
   - 跳过的版本不再提示，除非是强制更新

## 多版本管理

后端可以维护多个版本的更新信息，根据客户端版本返回不同的更新策略：

### 示例：渐进式发布

```json
{
  "versions": [
    {
      "targetVersions": ["4.0.0", "4.0.1", "4.0.2"],
      "updateTo": "4.1.0",
      "forceUpdate": false
    },
    {
      "targetVersions": ["3.0.0", "3.0.1", "3.0.2", "3.0.3"],
      "updateTo": "4.0.0",
      "forceUpdate": true,
      "message": "3.x 版本即将停止支持，请尽快升级"
    }
  ]
}
```

## 下载服务器要求

1. **HTTPS 支持**: 所有下载链接必须使用 HTTPS
2. **断点续传**: 支持 HTTP Range 请求
3. **CDN 加速**: 建议使用 CDN 加速下载
4. **镜像服务器**: 可以提供多个下载源

### 下载链接格式建议

```
https://download.iclaudecode.cn/miaoda/{version}/{filename}
https://mirror1.iclaudecode.cn/miaoda/{version}/{filename}
https://mirror2.iclaudecode.cn/miaoda/{version}/{filename}
```

## 灰度发布支持

可以通过客户端特征进行灰度发布：

```json
{
  "grayRelease": {
    "enabled": true,
    "percentage": 10,
    "whitelist": ["user_a1b2c3d4", "user_e5f6g7h8"],
    "blacklist": [],
    "regions": ["CN", "US"]
  }
}
```

## 错误处理

客户端在以下情况会静默失败（不提示用户）：

1. 网络连接失败
2. 返回的 JSON 格式错误
3. 版本号格式不正确
4. 下载链接无效

## 安全考虑

1. **签名验证**: 
   - 提供文件的 SHA256 校验和
   - 客户端下载后验证文件完整性

2. **HTTPS 强制**:
   - 所有 API 和下载链接必须使用 HTTPS
   - 防止中间人攻击

3. **版本回滚保护**:
   - 不允许更新到低于当前版本的版本
   - 防止降级攻击

## 监控指标

建议后端监控以下指标：

1. **更新检查频率**: 每日/每小时检查次数
2. **版本分布**: 各版本用户数量和占比
3. **更新成功率**: 开始更新 vs 完成更新
4. **下载速度**: 平均下载速度和完成时间
5. **错误率**: 下载失败、校验失败等

## 测试方法

### 1. 测试更新检查

```bash
# 获取更新信息
curl https://api.iclaudecode.cn/updates.json

# 模拟特定版本检查（通过 User-Agent）
curl -H "User-Agent: Miaoda/4.0.0 (darwin)" \
     https://api.iclaudecode.cn/updates.json
```

### 2. 测试下载

```bash
# 测试下载链接
curl -I https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-4.2.0.dmg

# 测试断点续传
curl -H "Range: bytes=0-1024" \
     https://download.iclaudecode.cn/miaoda/v4.2.0/Miaoda-4.2.0.dmg
```

## 版本历史管理

建议后端保存所有历史版本信息：

```json
{
  "history": [
    {
      "version": "4.2.0",
      "releaseDate": "2024-01-28",
      "downloads": { ... },
      "active": true
    },
    {
      "version": "4.1.0",
      "releaseDate": "2024-01-15",
      "downloads": { ... },
      "active": true
    },
    {
      "version": "4.0.0",
      "releaseDate": "2024-01-01",
      "downloads": { ... },
      "active": false,
      "endOfLife": "2024-06-01"
    }
  ]
}
```

## 国际化支持

支持的语言代码：
- `zh` - 简体中文
- `en` - 英语
- `ja` - 日语（后续支持）
- `ko` - 韩语（后续支持）

客户端会根据系统语言自动选择对应的文本。

## 后续扩展

1. **增量更新**: 支持差分包更新，减少下载量
2. **静默更新**: 后台下载，下次启动时安装
3. **回滚机制**: 更新失败时自动回滚
4. **P2P 下载**: 通过 P2P 技术加速下载