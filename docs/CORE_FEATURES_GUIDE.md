# Miaoda 3.0.1 核心功能使用指南

## 新增核心功能

### 1. 环境自动安装

在环境检测面板中，如果检测到 Claude CLI 或 UV 未安装，会显示"安装"按钮：

- **Claude CLI**: 点击安装按钮会自动下载并安装 Claude 命令行工具
- **UV (Python)**: 点击安装按钮会自动安装 Python 包管理器

安装过程：
1. 点击"安装"按钮
2. 按钮会显示"安装中..."
3. 安装完成后会自动刷新环境状态
4. 如果安装失败，会在终端显示错误信息

### 2. Claude Code 代理设置

在配置管理面板中，新增了代理设置功能：

1. 进入"配置管理"面板
2. 选择或创建一个配置
3. 在"代理设置"字段中输入代理地址（例如：http://proxy.example.com:8080）
4. 点击"保存"按钮

代理设置会在以下场景生效：
- 在系统终端中打开 Claude 时
- 通过应用内终端运行 Claude 时（后续实现）

### 3. 系统终端集成

新增"在系统终端中打开"功能，可以直接在系统终端中启动 Claude：

1. 确保已经配置好 API Key 和其他设置
2. 在终端面板中，点击"在系统终端中打开"按钮
3. 系统会自动：
   - 设置环境变量（ANTHROPIC_API_KEY、ANTHROPIC_API_URL、代理等）
   - 打开系统终端（macOS Terminal、Windows CMD、Linux 终端）
   - 自动执行 `claude` 命令

支持的平台：
- **macOS**: 使用 Terminal.app
- **Windows**: 使用 cmd.exe
- **Linux**: 支持 gnome-terminal、konsole、xterm

### 4. 配置持久化

所有配置现在都会保存到本地：

- 配置文件位置：`~/Library/Application Support/miaoda/claude-configs.json`（macOS）
- 自动保存和加载配置
- 支持多配置管理
- 配置包含：名称、API Key、API URL、模型选择、代理设置

## 使用流程

### 快速开始

1. **环境准备**
   - 打开应用，进入"环境检测"面板
   - 检查所有依赖是否已安装
   - 如果 Claude CLI 未安装，点击"安装"按钮

2. **配置设置**
   - 切换到"配置管理"面板
   - 创建新配置或编辑默认配置
   - 输入您的 Anthropic API Key
   - （可选）配置代理设置
   - 点击"保存"

3. **启动 Claude**
   - 方式一：在"终端"面板点击"在系统终端中打开"
   - 方式二：点击"启动 Claude"使用内置终端（模拟）

### 高级功能

#### 多配置管理
- 可以创建多个配置文件（例如：工作配置、个人配置）
- 轻松切换不同的 API Key 和设置
- 每个配置独立保存

#### 环境变量设置
打开系统终端时，会自动设置以下环境变量：
- `ANTHROPIC_API_KEY`: 您的 API 密钥
- `ANTHROPIC_API_URL`: API 端点（默认：https://api.anthropic.com）
- `HTTP_PROXY` / `HTTPS_PROXY`: 代理设置（如果配置）

## 故障排除

### Claude CLI 安装失败
- 确保有网络连接
- macOS/Linux 需要 curl 命令
- Windows 需要 npm 已安装
- 可以手动安装：访问 https://claude.ai/cli

### 系统终端无法打开
- 确保系统终端应用存在
- macOS: 需要 Terminal.app
- Windows: 需要 cmd.exe
- Linux: 需要 gnome-terminal、konsole 或 xterm 之一

### 代理设置不生效
- 检查代理格式是否正确（http://host:port）
- 确保代理服务器可访问
- 某些企业代理可能需要认证

## 下一步计划

- 完整的 Claude CLI 集成到内置终端
- 实时日志和错误处理
- 更多模型选项支持
- 批量任务处理功能