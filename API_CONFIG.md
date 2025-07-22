# API 配置说明

本应用支持自定义 API 服务器配置。

## 环境变量配置

创建 `.env` 文件（参考 `.env.example`）并设置以下变量：

```bash
# API 服务器地址
MIAODA_API_BASE_URL=https://your-api-server.com

# 更新检查地址
MIAODA_UPDATE_CHECK_URL=https://your-api-server.com/updates.json
```

## 功能说明

### 数据统计（可选）
如果配置了 API 服务器，应用会收集匿名使用数据用于改进产品。您可以通过设置环境变量禁用此功能：

```bash
MIAODA_DISABLE_ANALYTICS=true
```

### 自动更新（可选）
应用支持自动检查更新。您可以通过设置环境变量禁用此功能：

```bash
MIAODA_DISABLE_AUTO_UPDATE=true
```

## 自建服务器

如果您想搭建自己的 API 服务器，需要实现以下接口：

1. **更新检查接口**
   - `GET /updates.json`
   - 返回格式参考 `updates.json`

2. **数据统计接口**（可选）
   - `POST /api/analytics/batch`
   - 接收匿名使用数据

## 隐私说明

- 所有数据都是匿名的
- 不收集任何个人隐私信息
- 用户可以随时禁用数据收集

## 开源协议

本项目基于 MIT 协议开源，您可以自由修改和分发。