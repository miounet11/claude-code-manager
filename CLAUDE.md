# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Miaoda 是一个通用的 AI 服务聚合平台，最初为 Claude Code (claude.ai/code) 设计，现已升级为支持多种 AI 服务提供商的统一接口。使用 Electron 框架构建，提供了 VSCode 风格的终端体验、智能的 API 格式转换、动态路由和本地模型支持。

## 常用命令

```bash
# 开发环境
npm install              # 安装依赖
npm run dev             # 开发模式运行（自动开启 DevTools）

# 构建打包
npm run build           # 构建 macOS 应用（所有架构）
npm run dist            # 同上，构建并生成分发包

# 代码质量
npm run lint            # ESLint 检查（src/**/*.js）

# Git Flow 分支管理
./scripts/init-git-flow.sh        # 初始化分支结构
./scripts/git-flow-helper.sh help # 查看分支管理帮助
```

## 核心架构

### 进程架构
```
主进程 (src/main/)
├── index.js                    # 应用入口，窗口管理
├── services/
│   ├── proxy-server.js        # API 代理服务器（支持动态路由）
│   ├── service-registry.js    # AI 服务注册表（7+ 预设服务）
│   ├── format-converter.js    # API 格式转换器
│   ├── local-model-service.js # 本地模型服务管理
│   ├── claude-service.js      # Claude CLI 进程管理
│   ├── config-service.js      # 配置存储管理（electron-store）
│   ├── environment-service.js # 环境检测（PATH、依赖）
│   └── ipc-controller-simple.js # IPC 通信中心
└── pty-manager.js             # 终端会话管理（node-pty）

渲染进程 (src/renderer/)
├── xterm-terminal.js          # 终端 UI（xterm.js）
├── components/
│   ├── ConfigManager.js       # 配置管理界面
│   ├── ConfigWizard.js        # 配置向导（4步引导）
│   ├── LocalModelManager.js   # 本地模型管理
│   └── UsageStats.js         # 使用统计组件
└── App.js                     # 主应用组件
```

### API 代理工作流

#### 传统模式（向后兼容）
```
Claude CLI → 本地代理服务器(:8118) → 配置的 API
              ↓
          认证转换
          请求记录
          Token 统计
```

#### 动态路由模式（v4.1.0 新增）
```
客户端 → /proxy/:service/:model/* → 服务注册表
           ↓                          ↓
       格式检测                    目标服务
           ↓                          ↓
       格式转换 ←─────────────── API 响应
           ↓
       统一响应
```

### IPC 通信模式
- 所有 IPC 处理器集中在 `ipc-controller-simple.js`
- 使用 `registerHandler` 和 `registerListener` 避免重复注册
- 主要通道：
  - `config:*` - 配置管理
  - `claude:*` - Claude CLI 控制
  - `proxy:*` - 代理服务器
  - `terminal:*` - 终端管理
  - `local-models:*` - 本地模型（v4.1.0 新增）

## 关键实现

### 终端系统
- **多会话管理**：PtySessionManager 维护多个独立终端
- **数据流**：pty 进程 → IPC → xterm.js 渲染
- **命令历史**：本地存储在 localStorage

### 代理服务器
- **端口**：默认 8118，自动递增避免冲突
- **认证处理**：自动转换 Bearer Token、API Key 格式
- **统计功能**：实时 Token 计数和费用计算
- **错误处理**：智能错误识别和解决方案提示
- **动态路由**：支持 `/proxy/:service/:model/*` 格式
- **格式转换**：自动在不同 AI 服务 API 格式间转换

### 配置管理
- **存储位置**：`~/Library/Application Support/miaoda/`
- **加密存储**：使用 electron-store 的加密功能
- **测试连接**：支持配置验证和延迟测试
- **配置向导**：分步骤引导用户完成配置
- **服务预设**：内置 7+ AI 服务的预配置

## 新增功能说明（v4.1.0）

### 服务注册表
- 预设 OpenAI、Claude、Gemini、Groq、Ollama 等服务
- 统一的服务发现和认证接口
- 支持自定义服务添加

### 格式转换器
- 自动检测 API 请求/响应格式
- 支持双向转换（如 Claude ↔ OpenAI）
- 可扩展的转换器架构

### 本地模型支持
- Ollama：自动检测、模型拉取/删除
- LM Studio：通过 OpenAI 兼容接口
- LocalAI：Docker 或二进制部署

## 开发注意事项

### 环境变量
- macOS 应用需要手动获取系统 PATH：`/usr/libexec/path_helper -s`
- 代理服务通过环境变量传递：`ANTHROPIC_API_URL`、`ANTHROPIC_API_KEY`

### 错误处理
- 使用 `error-service.js` 提供友好错误提示
- 错误日志保存在 `~/.miaoda/error.log`
- 支持生成错误报告

### 分支管理
- 遵循 Git Flow 策略（详见 GIT_BRANCH_STRATEGY.md）
- 功能开发在 `feature/*` 分支
- 紧急修复使用 `hotfix/*` 分支
- 版本发布通过 `release/*` 分支

### 调试技巧
- 终端问题：检查 `pty-manager.js` 和 `xterm-terminal.js` 的日志
- IPC 问题：在 `ipc-controller-simple.js` 添加日志
- 代理问题：访问 `http://localhost:8118/health` 检查状态