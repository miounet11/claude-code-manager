# Miaoda - Claude Code Manager

[![版本](https://img.shields.io/badge/version-3.0.1-blue.svg)](https://github.com/yourusername/miaoda)
[![平台](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/yourusername/miaoda)

专业的 Claude Code 部署和管理工具，让您轻松运行和管理 Claude 命令行工具。

## 🎉 新版本 3.0.1

全新架构设计，带来更好的使用体验：
- 🏗️ **模块化架构** - 环境检测、配置管理、终端完全独立
- 🖥️ **纯净终端** - 专注于 Claude 交互，不再混杂系统命令
- 🔍 **实时检测** - 自动检测系统环境和依赖状态
- ⚙️ **可视化配置** - 直观的配置管理界面

## ✨ 特性

- 🚀 **一键启动** - 自动安装和管理 Claude CLI
- 💻 **集成终端** - 内置终端，直观显示 Claude 运行状态
- 🎯 **系统托盘** - 常驻系统托盘，随时访问
- 🔧 **灵活配置** - 支持自定义端口和启动参数
- 🌐 **跨平台** - 支持 macOS 和 Windows

## 📦 安装

### macOS
1. 下载对应您系统的版本：
   - Intel Mac: `Miaoda-x.x.x.dmg`
   - Apple Silicon: `Miaoda-x.x.x-arm64.dmg`
2. 双击 DMG 文件，将 Miaoda 拖到应用程序文件夹
3. 首次运行时，系统可能提示安全警告，请在系统偏好设置中允许运行

### Windows
1. 下载 `Miaoda-x.x.x-win.zip`
2. 解压到任意目录
3. 运行 `Miaoda.exe`

## 🚀 使用

### 免费体验
我们提供了免费体验功能，无需配置即可使用：
- 每日 100万 token 限额
- 预配置的 API Key 和端点
- 开箱即用，立即开始

### 快速开始
1. **启动应用**：双击 Miaoda 图标
2. **选择配置**：默认已选中"免费体验"配置
3. **开始使用**：点击"在系统终端中打开"
4. **开始对话**：在终端中与 Claude 对话

### 使用自己的 API Key
1. 进入"配置管理"
2. 点击"新建"创建配置
3. 输入您的 API Key
4. 保存并使用

## ⚙️ 配置

- **端口设置**：默认使用 7860 端口，可在设置中修改
- **开机启动**：可设置应用随系统启动
- **快捷键**：支持自定义全局快捷键

## 🛠️ 开发

### 环境要求
- Node.js 18+
- npm 或 yarn

### 开发命令
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建应用
npm run build

# 构建各平台版本
npm run dist-mac    # macOS
npm run dist-win    # Windows
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

Built with ❤️ by Miaoda Team