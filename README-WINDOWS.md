# Miaoda Windows 版本

专为 Windows 10/11 设计的 AI 服务聚合平台，提供原生 Windows 体验。

## 🎯 特性

### Windows 原生体验
- **Windows Terminal 集成** - 支持 PowerShell Core、PowerShell、CMD
- **ConPTY 支持** - 真实的终端体验，完美支持颜色和交互
- **Fluent Design** - 遵循 Windows 11 设计语言
- **系统托盘** - 后台运行，快速访问

### Windows 专属功能
- **UAC 兼容** - 无需管理员权限即可运行
- **Windows 路径处理** - 正确处理盘符和反斜杠
- **注册表集成** - 深度系统集成（计划中）
- **WSL 支持** - 与 Windows Subsystem for Linux 集成（计划中）

## 📦 安装

### 系统要求
- Windows 10 1803 或更高版本
- Windows 11（推荐）
- 64位或32位系统均可

### 下载安装
1. 从 [Releases](https://github.com/miaoda-team/miaoda-windows/releases) 下载最新版本
2. 选择适合您系统的版本：
   - `Miaoda-1.0.0-x64.exe` - 64位系统
   - `Miaoda-1.0.0-ia32.exe` - 32位系统
   - `Miaoda-1.0.0-x64.msi` - 企业部署版本

### 安装方式

#### NSIS 安装包（推荐）
- 双击 `.exe` 文件
- 选择安装目录
- 完成安装

#### MSI 安装包（企业用户）
- 支持组策略部署
- 支持静默安装：`msiexec /i Miaoda-1.0.0-x64.msi /quiet`

## 🚀 使用指南

### 首次启动
1. 启动 Miaoda
2. 系统会自动检测环境
3. 如果缺少依赖，按照提示安装

### 环境配置
Windows 版本会自动检测：
- Node.js
- Python
- Git
- Claude CLI
- PowerShell 版本
- Windows Terminal（如果已安装）

### 终端使用
- 默认使用 PowerShell（如果安装了 PowerShell Core 会优先使用）
- 支持多标签终端
- 支持自定义 Shell

## 🛠️ 开发

### 从源码运行
```powershell
# 克隆仓库
git clone https://github.com/miaoda-team/miaoda-windows.git
cd miaoda-windows

# 安装依赖
npm install

# 开发模式运行
npm run dev:windows
```

### 构建
```powershell
# 构建 Windows 版本
npm run build:windows
```

### 项目结构
```
src-windows/
├── main/               # 主进程（Windows 专用）
│   ├── services/       # Windows 服务
│   │   ├── windows-env.js    # 环境检测
│   │   └── conpty.js         # 终端实现
│   └── index.js        # 主进程入口
├── renderer/           # 渲染进程
│   └── styles/         # Windows 样式
└── preload/            # 预加载脚本
```

## 🔧 故障排除

### 终端显示问题
- 确保系统已启用 UTF-8 支持
- 在 PowerShell 中运行：`chcp 65001`

### 环境变量问题
- Miaoda 会自动检测系统 PATH
- 如果找不到命令，检查环境变量设置

### 权限问题
- Miaoda 不需要管理员权限
- 如果遇到权限问题，检查安装目录权限

## 📝 版本差异

### 与 macOS 版本的区别
1. **技术实现**
   - Windows: ConPTY + PowerShell
   - macOS: Unix PTY + Bash/Zsh

2. **UI 设计**
   - Windows: Fluent Design
   - macOS: macOS 原生设计

3. **功能重点**
   - Windows: 企业集成、PowerShell 支持
   - macOS: Unix 工具链、开发者体验

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

Windows 版本的开发重点：
- Windows 11 新特性支持
- 企业功能增强
- WSL 2 集成
- Microsoft Store 发布

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件