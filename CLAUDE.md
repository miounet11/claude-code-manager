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
npm run prebuild        # 预构建步骤
npm run update-version  # 更新版本号
npm run clear-cache     # 清理缓存

# Windows 构建
npm run build:windows   # 构建 Windows 版本
npm run dev:windows     # Windows 开发模式

# 代码质量
npm run lint            # ESLint 检查（src/**/*.js）
npm run test:core       # 运行核心功能测试脚本
npm run test:config     # 测试配置增强功能
npm run precommit       # 提交前测试核心功能

# 测试功能
node test/test-new-features.js        # 测试 v4.1.0 新功能
node test/test-update-flow.js         # 测试更新流程
node test/test-update-logic.js        # 测试更新逻辑
node test/test-config-save-and-apply.js # 测试配置保存和应用
node test/test-claude-detection.js    # 测试 Claude 检测
node test/test-environment-detection.js # 测试环境检测
node test/test-dynamic-path-finding.js # 测试动态路径查找
node test/test-restore-default-config.js # 测试恢复默认配置

# Git Flow 分支管理
./scripts/init-git-flow.sh           # 初始化分支结构
./scripts/git-flow-helper.sh help    # 查看分支管理帮助
./scripts/git-flow-helper.sh feature <name>  # 创建功能分支
./scripts/git-flow-helper.sh release <version> # 创建发布分支
./scripts/git-flow-helper.sh hotfix <name>    # 创建热修复分支
./scripts/git-flow-helper.sh finish  # 完成当前分支
./scripts/git-flow-helper.sh status  # 查看分支状态
./scripts/git-flow-helper.sh clean   # 清理已合并的分支
./scripts/git-flow-helper.sh sync    # 同步所有分支
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
│   ├── analytics-integration.js # 使用统计和分析服务（v4.2.1）
│   └── ipc-controller-simple.js # IPC 通信中心
├── pty-manager.js             # 终端会话管理（node-pty）
├── updater.js                 # 自动更新管理（v4.2.1）
└── analytics.js               # 智能分析系统（v4.2.1）

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
  - `analytics:*` - 使用统计（v4.2.1 新增）
  - `update:*` - 自动更新（v4.2.1 新增）

## 关键实现

### 终端系统
- **多会话管理**：PtySessionManager 维护多个独立终端
- **数据流**：pty 进程 → IPC → xterm.js 渲染
- **命令历史**：本地存储在 localStorage
- **终端实现**：src/main/pty-manager.js:23 处理所有终端会话

### 代理服务器
- **端口**：默认 8118，自动递增避免冲突
- **认证处理**：自动转换 Bearer Token、API Key 格式
- **统计功能**：实时 Token 计数和费用计算
- **错误处理**：智能错误识别和解决方案提示
- **动态路由**：支持 `/proxy/:service/:model/*` 格式
- **格式转换**：自动在不同 AI 服务 API 格式间转换
- **核心实现**：src/main/services/proxy-server.js:45 处理所有代理请求

### 配置管理
- **存储位置**：`~/Library/Application Support/miaoda/`
- **加密存储**：使用 electron-store 的加密功能
- **测试连接**：支持配置验证和延迟测试
- **配置向导**：分步骤引导用户完成配置
- **服务预设**：内置 7+ AI 服务的预配置
- **配置服务**：src/main/services/config-service.js:15 管理所有配置

### 智能分析系统（v4.2.1）
- **使用分析**：跟踪 API 调用、模型使用、Token 消耗
- **智能报告**：生成每日/每周/每月使用报告
- **成本优化**：基于使用模式的成本优化建议
- **实现位置**：src/main/analytics.js:25

### 自动更新系统（v4.2.1）
- **智能检查**：根据使用频率调整检查间隔
- **静默更新**：后台下载，提示重启安装
- **版本管理**：支持稳定版和测试版通道
- **实现位置**：src/main/updater.js:35

## 支持的 AI 服务

### 云端服务
- **OpenAI** - GPT-4、GPT-3.5 等模型
- **Anthropic Claude** - Claude 3 Opus、Sonnet、Haiku
- **Google Gemini** - Gemini Pro、Pro Vision
- **Groq Cloud** - 超快速推理，支持 Llama 2、Mixtral
- **Perplexity AI** - 实时搜索增强的 AI

### 本地服务
- **Ollama** - 运行 Llama、Mistral、CodeLlama 等开源模型
- **LM Studio** - 图形化本地模型管理工具
- **LocalAI** - 兼容 OpenAI API 的本地推理服务

### 动态路由使用
v4.1.0 支持通过 URL 动态指定服务和模型：
```
http://localhost:8118/proxy/{service}/{model}/v1/chat/completions
```

示例：
- OpenAI GPT-4: `/proxy/openai/gpt-4/v1/chat/completions`
- Claude Opus: `/proxy/claude/claude-3-opus/v1/messages`
- Ollama Llama2: `/proxy/ollama/llama2/api/chat`

## 新增功能说明

### v4.4.5 - 当前版本
- 基于 v4.2.1 功能集
- 完善的测试套件
- Git Flow 分支管理工具
- 支持多种测试脚本

### v4.2.0 - 配置管理增强（2024-01-28）
- **保存并启用**：配置管理中一键保存、切换配置并启动 Claude
- **恢复默认配置**：快速恢复官方 Claude Code 默认设置
- **动态路径检测**：移除用户特定路径，使用动态检测
- **跨架构支持**：完美支持 Intel 和 Apple Silicon (M1-M4) Mac
- **Windows 同步更新**：Windows 版本已同步所有新功能

### v4.2.1 - 智能分析与自动更新
- **智能分析**：收集使用数据，生成优化建议
- **自动更新**：后台检查和下载更新
- **性能优化**：基于使用模式的性能调优
- **统计面板**：可视化的使用统计展示

### v4.1.0 - Universal Bridge
- **服务注册表** (src/main/services/service-registry.js)
- **格式转换器** (src/main/services/format-converter.js)
- **本地模型支持** (src/main/services/local-model-service.js)
- **配置向导** (src/renderer/components/ConfigWizard.js)
- **本地模型管理** (src/renderer/components/LocalModelManager.js)

## 开发注意事项

### 环境变量
- macOS 应用需要手动获取系统 PATH：`/usr/libexec/path_helper -s`
- 代理服务通过环境变量传递：`ANTHROPIC_API_URL`、`ANTHROPIC_API_KEY`
- 环境检测服务：src/main/services/environment-service.js:35

### 错误处理
- 使用 `error-service.js` 提供友好错误提示
- 错误日志保存在 `~/.miaoda/error.log`
- 支持生成错误报告

### 分支管理
- 遵循 Git Flow 策略（使用 `scripts/git-flow-helper.sh` 工具）
- 主要分支：
  - `main` - 生产环境代码
  - `develop` - 开发分支
- 支持分支类型：
  - `feature/*` - 功能开发
  - `release/*` - 版本发布
  - `hotfix/*` - 紧急修复
- Windows 版本使用独立分支 `feature/windows-support`

### 调试技巧
- 终端问题：检查 `pty-manager.js` 和 `xterm-terminal.js` 的日志
- IPC 问题：在 `ipc-controller-simple.js` 添加日志
- 代理问题：访问 `http://localhost:8118/health` 检查状态
- 格式转换：在 format-converter.js 中启用详细日志
- 更新问题：检查 updater.js 的日志输出

### GitHub Actions
- macOS 构建：`.github/workflows/build-macos.yml`
- Windows 构建：`.github/workflows/build-windows.yml`
- 触发方式：创建标签 (v* 或 windows-v*) 或手动触发

### Windows 版本特殊处理
- 使用独立配置文件 `package-windows.json`
- 专用源码目录 `src-windows/`
- ConPTY 支持：`src-windows/main/services/conpty.js`
- 环境适配：`src-windows/main/services/windows-env.js`

### 测试脚本说明
- **test-new-features.js** - 测试服务注册表、格式转换器、本地模型服务、动态路由
- **test-config-save-and-apply.js** - 测试配置保存并应用功能
- **test-claude-detection.js** - 测试 Claude CLI 检测功能
- **test-environment-detection.js** - 测试环境检测和修复功能
- **test-update-flow.js** - 测试自动更新流程
- **test-update-logic.js** - 测试更新逻辑（版本比较、通道管理等）