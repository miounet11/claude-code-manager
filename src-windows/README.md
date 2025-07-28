# Miaoda for Windows

## 概述

这是 Miaoda 的 Windows 专用版本，针对 Windows 平台进行了特别优化。

## Windows 特性

### 1. ConPTY 终端支持
- 使用 Windows ConPTY API 提供原生终端体验
- 支持 Windows 命令提示符 (cmd.exe) 和 PowerShell
- 完美支持 Windows 终端颜色和字符编码

### 2. Windows 路径处理
- 自动适配 Windows 路径分隔符
- 支持 UNC 路径
- 智能检测 npm 全局安装路径（AppData\Roaming\npm）

### 3. 系统集成
- Windows 系统托盘支持
- 原生 Windows 通知
- 深色模式自动检测（Windows 10/11）

### 4. 特定命令工具
- 使用 `where` 代替 `which` 命令
- 使用 `taskkill` 管理进程
- 支持 `.cmd` 和 `.exe` 文件扩展名

## 安装要求

### 系统要求
- Windows 10 版本 1903 或更高版本（用于 ConPTY 支持）
- Windows 11 全版本支持

### 依赖项
- Node.js 16.0.0 或更高版本
- npm 7.0.0 或更高版本
- Git for Windows（可选）

## 快速开始

1. **安装 Node.js**
   ```powershell
   # 使用 winget
   winget install OpenJS.NodeJS
   
   # 或者从 nodejs.org 下载安装包
   ```

2. **安装 Claude CLI**
   ```powershell
   npm install -g @anthropic-ai/claude-code
   ```

3. **启动 Miaoda**
   - 双击 `Miaoda.exe`
   - 或者从开始菜单启动

## 配置管理

### 保存并启用功能
1. 打开配置管理器
2. 编辑或创建配置
3. 点击“保存并启用” - 一键切换配置并启动 Claude

### 恢复默认配置
- 点击“恢复默认”按钮可快速恢复官方 Claude Code 配置
- 不会删除您的现有配置

## 文件路径

### 配置文件位置
```
C:\Users\%USERNAME%\AppData\Roaming\miaoda\
├── config.json
├── miaoda-configs-windows.json
└── logs\
```

### NPM 全局包路径
```
C:\Users\%USERNAME%\AppData\Roaming\npm\
└── claude.cmd
```

## 常见问题

### 1. 找不到 Claude CLI
- 确保 `%APPDATA%\npm` 在系统 PATH 中
- 重启应用或电脑以刷新环境变量

### 2. ConPTY 不可用
- 更新到 Windows 10 版本 1903 或更高
- 检查 Windows 更新

### 3. 终端乱码
- 确保使用 UTF-8 编码
- 在 Windows 设置中启用 "Beta: 使用 Unicode UTF-8 提供全球语言支持"

## 开发说明

### 构建 Windows 版本
```bash
# 安装依赖
npm install

# 开发模式
npm run dev:windows

# 构建生产版本
npm run build:windows
```

### Windows 特定代码
- 所有 Windows 特定代码位于 `src-windows/` 目录
- 使用 ConPTY 替代 node-pty
- 针对 Windows 路径和命令进行了特殊处理

### 测试
```bash
# 运行 Windows 特定测试
npm run test:windows
```

## 更新日志

### v4.2.0 (2024-01-28)
- ✨ 添加 "保存并启用" 功能
- ✨ 添加 "恢复默认配置" 功能
- 🔧 修复 Windows 路径检测问题
- 🔧 优化 npm 全局路径检测
- 📊 添加统计分析和自动更新检查

## 贡献指南

欢迎提交 Windows 特定的问题和改进建议。

## 许可证

MIT License