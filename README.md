# Miaoda - Claude Code Manager

<div align="center">
  <img src="assets/logo.png" alt="Miaoda Logo" width="128">
  
  [![Version](https://img.shields.io/badge/version-3.0.1-blue.svg)](https://github.com/yourusername/miaoda/releases)
  [![Platform](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/yourusername/miaoda/releases)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
</div>

## 🚀 介绍

Miaoda 是一款专为 Claude Code (claude.ai/code) 设计的 macOS 桌面管理工具，提供了完美的终端体验和便捷的配置管理功能。

### ✨ 主要特性

- **🖥️ VSCode 风格终端** - 使用 xterm.js 实现，完美复刻 VSCode 终端体验
- **📑 多终端标签** - 支持多个独立终端会话，可拖拽排序
- **🎨 主题定制** - 支持字体大小、样式、光标等自定义设置
- **🔧 配置管理** - 支持多配置文件，轻松切换不同的 API 设置
- **🆓 免费试用** - 内置免费试用功能，每日 100k token
- **🍎 macOS 专用版** - 专为 macOS 平台深度优化

## 📦 安装

### 下载预编译版本

从 [Releases](https://github.com/yourusername/miaoda/releases) 页面下载 macOS 安装包：

- **macOS (Intel)**: `Miaoda-3.0.1-x64.dmg`
- **macOS (Apple Silicon)**: `Miaoda-3.0.1-arm64.dmg`

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
3. **配置 API** - 在配置管理中设置你的 API Key 和 API URL
4. **开始使用** - 点击终端标签，输入 `claude` 开始对话

### 免费试用

如果你还没有 API Key，可以使用内置的免费试用功能：
- API URL: `http://www.miaoda.vip/`
- 模型: `claude-3-7-sonnet-20250219`
- 限制: 每日 100k token

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