# GitHub Release 创建指南

## Release 信息
- **Tag**: v4.1.0
- **Title**: Miaoda v4.1.0 - Universal AI Service Bridge 🌉
- **Target**: main

## Release 内容（复制以下内容到 GitHub Release）

---

## 🎉 重大更新

Miaoda 4.1.0 带来了革命性的"Universal Bridge"功能，将应用从 Claude 专用工具升级为通用 AI 服务聚合平台！

## ✨ 新功能

### 🔄 动态路由系统
- 运行时切换不同 AI 服务，无需重启应用
- 智能路由格式：`/proxy/{service}/{model}/v1/chat/completions`
- 支持传统配置模式，向后兼容

### 🔀 API 格式转换器
- 自动转换不同服务之间的 API 格式
- 支持 Claude ↔ OpenAI ↔ Gemini ↔ Ollama 互转
- 透明处理，无需修改客户端代码

### 🤖 多服务支持
内置 7+ AI 服务预设：
- **OpenAI** - GPT-4、GPT-3.5 等模型
- **Anthropic Claude** - Claude 3 Opus、Sonnet、Haiku
- **Google Gemini** - Gemini Pro、Pro Vision
- **Groq Cloud** - 超快速推理
- **Perplexity AI** - 实时搜索增强
- **Ollama** - 本地运行开源模型
- **LM Studio** - 图形化本地模型管理

### 🎯 配置向导
- 分步骤引导配置各种 AI 服务
- 自动检测本地模型服务
- 一键测试连接可用性

### 🦙 本地模型集成
- 完整支持 Ollama、LM Studio、LocalAI
- 自动发现运行中的本地服务
- 模型管理功能（下载、删除、查看）

### 🖱️ UI 改进
- 新增"配置向导"按钮
- 新增"本地模型"管理入口
- 优化了配置管理界面

## 🔧 改进

- 优化了配置管理界面
- 增强了错误处理和日志记录
- 提升了性能和稳定性
- 修复了环境检测相关问题

## 📦 下载

### macOS Intel 芯片
- `Miaoda-4.1.0.dmg` - DMG 安装包
- `Miaoda-4.1.0-mac.zip` - ZIP 压缩包

### macOS Apple Silicon (M1/M2/M3)
- `Miaoda-4.1.0-arm64.dmg` - DMG 安装包
- `Miaoda-4.1.0-arm64-mac.zip` - ZIP 压缩包

## 🚀 快速开始

1. 下载对应架构的安装包
2. 运行 Miaoda
3. 使用配置向导选择 AI 服务
4. 开始使用！

## 💡 使用示例

### 动态路由
```bash
# 使用 OpenAI GPT-4
http://localhost:8118/proxy/openai/gpt-4/v1/chat/completions

# 使用 Claude Opus
http://localhost:8118/proxy/claude/claude-3-opus/v1/messages

# 使用本地 Ollama
http://localhost:8118/proxy/ollama/llama2/api/chat
```

## 🆕 Windows 版本（预告）

我们已经开始开发独立的 Windows 版本：
- 原生 Windows 体验（Fluent Design）
- PowerShell 和 Windows Terminal 集成
- ConPTY 终端支持
- 预计在下个版本发布

## 📝 完整更新日志

查看 [CHANGELOG.md](https://github.com/miounet11/claude-code-manager/blob/main/CHANGELOG.md) 了解详细更新内容。

## 🙏 致谢

感谢所有用户的反馈和建议，让 Miaoda 变得更好！

---

## 手动创建 Release 步骤：

1. 访问 https://github.com/miounet11/claude-code-manager/releases/new
2. 选择标签：v4.1.0
3. Release title: Miaoda v4.1.0 - Universal AI Service Bridge 🌉
4. 复制上面的内容到描述框
5. 上传构建好的文件（如果有）：
   - Miaoda-4.1.0.dmg
   - Miaoda-4.1.0-arm64.dmg
   - Miaoda-4.1.0-mac.zip
   - Miaoda-4.1.0-arm64-mac.zip
6. 选择"Set as the latest release"
7. 点击"Publish release"