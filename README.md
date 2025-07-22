# Miaoda - Claude Code Manager

专业的 Claude Code 部署和管理工具，提供图形化界面来管理 Claude Code 的配置和环境。

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

### 🚀 核心功能
- **环境检查**: 自动检测 Node.js、Git、UV、Claude Code 等依赖
- **配置管理**: 支持多配置存储、切换和导入导出
- **一键启动**: 保存配置后自动启动 Claude Code
- **终端集成**: 内置终端，实时显示 Claude Code 输出
- **代理服务**: 自动配置代理服务器，支持自定义 API

### 📊 数据统计
- 自动收集使用数据（匿名）
- 本地数据聚合，批量上报
- 支持会话统计、功能使用统计等

### 🔄 自动更新
- 应用启动时自动检查更新
- 支持强制更新和可选更新
- 多平台下载支持

### 🎨 界面设计
- PuTTY 风格黑色主题
- 简洁高效的操作界面
- 响应式布局设计

## 安装使用

### 下载安装包

从 [Releases](https://github.com/your-username/miaoda/releases) 页面下载对应平台的安装包：

- **macOS**: 下载 `.dmg` 文件
- **Windows**: 下载 `.exe` 安装包或便携版

### 从源码构建

#### 环境要求
- Node.js 16+
- Git
- npm 或 yarn

#### 安装依赖
```bash
git clone https://github.com/your-username/miaoda.git
cd miaoda
npm install
```

#### 开发模式
```bash
npm run dev
```

#### 构建应用

macOS:
```bash
npm run dist-mac
```

Windows:
```bash
npm run dist-win
```

所有平台:
```bash
npm run dist-all
```

## 使用说明

### 1. 环境检查
启动应用后会自动检查系统环境，缺少的依赖会显示安装按钮。

### 2. 创建配置
1. 点击"新建配置"
2. 填写配置信息：
   - 配置名称
   - API URL
   - API Key
   - 模型选择
   - 代理端口
3. 点击"保存配置"自动启动 Claude Code

### 3. 管理配置
- **单击配置**: 选择并编辑配置
- **双击配置**: 直接启动 Claude Code
- **导入/导出**: 支持配置文件的导入导出

### 4. 使用终端
- 支持标准输入输出
- 支持复制粘贴
- Ctrl+C 停止运行（终端获得焦点时）

## 开发指南

### 项目结构
```
miaoda/
├── src/
│   ├── main/              # 主进程代码
│   │   ├── index.js       # 主进程入口
│   │   ├── config.js      # 配置管理
│   │   ├── environment.js # 环境检查
│   │   ├── analytics.js   # 数据统计
│   │   ├── updater.js     # 自动更新
│   │   └── claude-runner.js # Claude Code 运行器
│   ├── renderer/          # 渲染进程代码
│   │   ├── index.html     # 主界面
│   │   ├── renderer.js    # 渲染进程逻辑
│   │   └── styles.css     # 样式文件
│   └── preload/           # 预加载脚本
│       └── preload.js     # 安全桥接
├── assets/                # 静态资源
├── .github/               # GitHub Actions
└── package.json           # 项目配置
```

### 技术栈
- **框架**: Electron
- **UI**: 原生 HTML/CSS/JavaScript
- **终端**: 自定义实现
- **存储**: electron-store
- **打包**: electron-builder

### 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## API 接入

本应用支持数据统计上报，详见 [API接入文档](API接入文档.md)。

### 数据统计端点
- 健康检查: `GET /api/analytics/health`
- 批量上报: `POST /api/analytics/batch`
- 统计查询: `GET /api/stats/overview`

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- [Electron](https://electronjs.org/)
- [electron-builder](https://www.electron.build/)
- [Claude Code](https://claude.ai/code)

## 联系方式

- 问题反馈: [GitHub Issues](https://github.com/your-username/miaoda/issues)
- 技术支持: support@miaoda.com

---

Made with ❤️ by Miaoda Team