# Miaoda - Universal AI Service Bridge

<div align="center">
  <img src="assets/logo.png" alt="Miaoda Logo" width="128">
  
  [![Version](https://img.shields.io/badge/version-4.5.1-blue.svg)](https://github.com/miounet11/claude-code-manager/releases)
  [![Platform](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/miounet11/claude-code-manager/releases)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
</div>

## 🚀 介绍

Miaoda 是一个通用的 AI 服务聚合平台，最初为 Claude Code (claude.ai/code) 设计，现已升级支持多种 AI 服务提供商。通过智能的 API 格式转换和动态路由，您可以使用统一的接口访问不同的 AI 服务。

### ✨ 主要特性

#### 🌉 v4.1.0 新功能 - "Universal Bridge"
- **🔄 动态路由系统** - 运行时切换不同 AI 服务，无需重启
- **🔀 API 格式转换** - 自动转换不同服务之间的 API 格式
- **🤖 多服务支持** - 内置 OpenAI、Claude、Gemini、Groq 等 7+ 服务
- **🦙 本地模型** - 完整支持 Ollama、LM Studio、LocalAI
- **🎯 配置向导** - 分步骤引导，轻松配置各种 AI 服务

#### 💻 核心功能
- **🖥️ VSCode 风格终端** - 使用 xterm.js 实现，完美复刻 VSCode 终端体验
- **📑 多终端标签** - 支持多个独立终端会话，可拖拽排序
- **🎨 主题定制** - 支持字体大小、样式、光标等自定义设置
- **🔧 配置管理** - 支持多配置文件，轻松切换不同的 API 设置
- **📊 使用统计** - 实时追踪 Token 使用量和费用
- **🍎 macOS 专用版** - 专为 macOS 平台深度优化

## 📦 安装

### 下载预编译版本

从 [Releases](https://github.com/miounet11/claude-code-manager/releases) 页面下载最新版本的 macOS 安装包：

- **macOS (Intel)**: `Miaoda-4.5.1-x64.dmg`
- **macOS (Apple Silicon)**: `Miaoda-4.5.1-arm64.dmg`

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/miaoda.git
cd miaoda

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建应用
npm run build

# 构建 macOS 版本
npm run build       # 构建所有架构
npm run dist        # 构建所有架构
```

## 🎯 快速开始

1. **启动应用** - 双击应用图标启动 Miaoda
2. **环境检测** - 应用会自动检测 Claude CLI 和依赖环境
3. **配置 API** - 使用配置向导或配置管理器设置 AI 服务
4. **开始使用** - 点击终端标签，输入 `claude` 开始对话

### 🆕 配置向导（推荐）

点击侧边栏的"配置向导"按钮，通过 4 个简单步骤完成配置：
1. **选择服务** - 从预设的 AI 服务中选择
2. **配置认证** - 输入 API Key（本地服务无需此步）
3. **选择模型** - 选择要使用的 AI 模型
4. **测试连接** - 验证配置是否正确

### 支持的 AI 服务

#### ☁️ 云端服务
- **OpenAI** - GPT-4、GPT-3.5 等模型
- **Anthropic Claude** - Claude 3 Opus、Sonnet、Haiku
- **Google Gemini** - Gemini Pro、Pro Vision
- **Groq Cloud** - 超快速推理，支持 Llama 2、Mixtral
- **Perplexity AI** - 实时搜索增强的 AI

#### 🖥️ 本地服务
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

## ⌨️ 快捷键

- `Ctrl/Cmd + T` - 新建终端
- `Ctrl/Cmd + W` - 关闭当前终端
- `Ctrl/Cmd + 1-9` - 快速切换终端
- `Ctrl/Cmd + K` - 清空当前终端
- `Ctrl/Cmd + C` - 复制选中文本
- `Ctrl/Cmd + V` - 粘贴

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **xterm.js** - 终端渲染引擎（与 VSCode 相同）
- **node-pty** - 提供真实的终端环境
- **Vue.js** - UI 框架（部分组件）

## 📝 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新详情。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Claude](https://claude.ai) - AI 助手
- [xterm.js](https://xtermjs.org/) - 终端组件
- [Electron](https://www.electronjs.org/) - 应用框架

---

<div align="center">
  Made with ❤️ by Miaoda Team
</div>