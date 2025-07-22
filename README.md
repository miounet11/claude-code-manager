# Miaoda - Claude Code Manager

专业的 Claude Code 部署和管理工具，提供图形化界面管理 Claude Code 配置和环境。

## 功能特性

- 🔍 **智能环境检查** - 自动检测系统环境和依赖
- ⚡ **一键安装部署** - 自动安装 UV、Claude Code 和代理服务
- 💾 **多配置管理** - 支持保存和管理多个 API 配置
- 🖥 **集成终端** - 内置终端显示 Claude Code 运行状态
- 🎨 **PuTTY 风格界面** - 经典的黑色主题，专业简洁
- 🔄 **一键恢复** - 快速恢复到官方默认设置

## 系统要求

- macOS 10.14 或更高版本
- Node.js 16.0 或更高版本
- Git 2.0 或更高版本

## 快速开始

### 开发环境

```bash
# 克隆项目
git clone <repository-url>
cd miaoda

# 安装依赖
npm install

# 启动应用（开发模式）
npm start
```

### 构建应用

```bash
# 构建 Mac 应用
npm run dist-mac

# 构建的应用将在 dist 目录中
```

## 使用说明

### 1. 环境检查
- 启动应用后，点击"检查环境"按钮
- 查看各个依赖的安装状态
- 对于未安装的依赖，可以点击"安装"按钮

### 2. 创建配置
- 点击"新建配置"按钮
- 填写配置名称、API URL、API Key 等信息
- 选择使用的模型
- 设置代理端口（默认 8082）

### 3. 启动服务
- 保存配置后，点击"启动终端"按钮
- 应用会自动安装代理服务并启动 Claude Code
- 在新的终端窗口中使用 Claude Code

### 4. 管理配置
- 支持创建多个配置
- 可以编辑、删除已保存的配置
- 配置数据安全存储在本地

### 5. 恢复设置
- 点击"恢复官方设置"可以清除所有代理配置
- 恢复到 Claude Code 的默认设置

## 项目结构

```
miaoda/
├── src/
│   ├── main/              # 主进程代码
│   │   ├── index.js       # 主进程入口
│   │   ├── environment.js # 环境检查
│   │   ├── installer.js   # 依赖安装
│   │   └── claude-runner.js # Claude Code 运行器
│   ├── renderer/          # 渲染进程代码
│   │   ├── index.html     # 主界面
│   │   ├── styles.css     # 样式文件
│   │   └── renderer.js    # 渲染进程逻辑
│   └── preload/           # 预加载脚本
│       └── preload.js     # 安全桥接
├── assets/                # 静态资源
│   └── icon.svg          # 应用图标
├── package.json          # 项目配置
└── README.md             # 项目说明
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **xterm.js** - 终端模拟器
- **electron-store** - 本地数据存储
- **electron-builder** - 应用打包工具

## 开发指南

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循项目的代码风格指南
- 提交前运行 `npm run lint`

### 调试
- 开发模式下会自动打开开发者工具
- 使用 `console.log` 在主进程和渲染进程中调试
- 查看终端输出了解运行状态

## 常见问题

### Q: 应用无法启动？
A: 请确保已安装 Node.js 16+ 并运行 `npm install`

### Q: 环境检查失败？
A: 确保系统 PATH 中包含必要的命令行工具

### Q: 代理连接失败？
A: 检查防火墙设置，确保代理端口未被占用

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 致谢

- Electron 团队提供的优秀框架
- xterm.js 提供的终端模拟器
- Claude Code 团队的支持

---

Made with ❤️ by Miaoda Team