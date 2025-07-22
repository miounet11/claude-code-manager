# Miaoda 功能特性列表

## 已实现功能

### 核心功能
- ✅ **环境检查** - 自动检测 Node.js、Git、UV、Claude Code 安装状态
- ✅ **一键安装** - 自动安装缺失的依赖（UV、Claude Code）
- ✅ **配置管理** - 创建、编辑、删除多个 API 配置
- ✅ **配置验证** - 验证配置的有效性（URL 格式、端口范围等）
- ✅ **Claude Code 启动** - 一键启动 Claude Code 并连接到指定 API
- ✅ **代理服务** - 内置 HTTP 代理转发请求到自定义 API

### 界面功能
- ✅ **PuTTY 风格界面** - 经典黑色主题，专业简洁
- ✅ **集成终端** - 内置终端显示命令输出和交互
- ✅ **ANSI 颜色支持** - 终端支持彩色输出
- ✅ **状态栏更新** - 实时显示操作状态和时间戳
- ✅ **响应式布局** - 自适应窗口大小

### 配置功能
- ✅ **多配置支持** - 保存和管理多个 API 配置
- ✅ **配置导出** - 导出所有配置到 JSON 文件
- ✅ **配置导入** - 从 JSON 文件导入配置
- ✅ **安全存储** - 使用 electron-store 安全保存配置
- ✅ **一键恢复** - 恢复到官方默认设置

### 用户体验
- ✅ **启动脚本** - 提供 macOS/Linux (.sh) 和 Windows (.bat) 启动脚本
- ✅ **错误处理** - 完善的错误提示和异常处理
- ✅ **操作反馈** - 所有操作都有明确的状态反馈
- ✅ **终端交互** - 支持在终端中输入命令
- ✅ **复制功能** - 支持复制终端内容

### 技术特性
- ✅ **跨平台支持** - 支持 macOS、Windows、Linux
- ✅ **模块化设计** - 清晰的代码结构和模块划分
- ✅ **安全隔离** - 主进程和渲染进程严格隔离
- ✅ **无外部依赖** - 使用简单终端替代 xterm.js，减少依赖

## 使用方法

### 快速开始
1. 运行启动脚本：
   - macOS/Linux: `./start.sh`
   - Windows: `start.bat`

2. 或手动启动：
   ```bash
   npm install
   npm start
   ```

### 创建配置
1. 点击"新建配置"按钮
2. 填写配置信息：
   - 配置名称：自定义名称
   - API URL：你的 API 端点
   - API Key：你的认证密钥
   - 模型：选择使用的模型
   - 代理端口：默认 8082

3. 保存配置

### 启动 Claude Code
1. 选择一个已保存的配置
2. 点击"启动 [配置名称]"按钮
3. Claude Code 将在终端中启动

### 管理配置
- **导出配置**：将所有配置导出为 JSON 文件备份
- **导入配置**：从 JSON 文件恢复配置
- **恢复默认**：清除所有自定义配置

## 项目结构
```
miaoda/
├── src/
│   ├── main/              # 主进程
│   │   ├── index.js       # 应用入口
│   │   ├── environment.js # 环境检查
│   │   ├── installer.js   # 依赖安装
│   │   └── claude-runner.js # Claude Code 管理
│   ├── renderer/          # 渲染进程
│   │   ├── index.html     # 主界面
│   │   ├── styles.css     # 样式
│   │   ├── renderer.js    # 界面逻辑
│   │   ├── simple-terminal.js # 终端实现
│   │   └── terminal.css   # 终端样式
│   └── preload/           # 预加载脚本
│       └── preload.js     # API 桥接
├── assets/                # 资源文件
├── start.sh              # macOS/Linux 启动脚本
├── start.bat             # Windows 启动脚本
├── package.json          # 项目配置
└── README.md             # 项目说明
```

## 开发说明

### 技术栈
- Electron 28.0.0
- Node.js 16+
- 原生 JavaScript (无框架)
- electron-store (配置存储)

### 开发命令
```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 构建应用
npm run dist-mac  # macOS
npm run dist      # 所有平台
```

### 代码规范
- ESLint 配置已包含
- 使用 ES6+ 语法
- 严格模式
- 模块化设计