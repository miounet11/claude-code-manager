# Miaoda 真实终端功能指南

## 概述

Miaoda 现在支持完整的真实终端功能，使用 node-pty 提供真实的系统 shell 访问。这意味着您可以在 Miaoda 中运行任何命令行程序，就像在原生终端中一样。

## 真实终端特性

1. **原生 Shell 支持**
   - Windows: PowerShell 或 CMD
   - macOS/Linux: bash、zsh 或用户默认 shell

2. **完整的终端功能**
   - 运行任何命令行程序
   - 支持交互式程序（vim、nano、htop 等）
   - 完整的 ANSI 颜色和格式支持
   - 正确的终端大小调整
   - 信号处理（Ctrl+C、Ctrl+D 等）

3. **集成功能**
   - 特殊命令拦截（menu、help、claude 等）
   - 与 Claude Code 无缝集成
   - 智能命令补全
   - 历史记录

## 使用说明

### 启动应用后

在真实终端模式下，您会看到：
```
欢迎使用 Miaoda 真实终端！
输入 menu 显示欢迎菜单，输入 help 查看帮助
```

### 特殊命令

以下命令会被 Miaoda 拦截并特殊处理：

- `menu` - 显示欢迎菜单
- `help` - 显示帮助信息
- `claude` - 启动 Claude Code
- `config` - 显示配置管理信息
- `env` - 检查环境
- `clear` - 清空终端
- `exit` - 退出应用

其他所有命令都会直接传递给系统 shell。

### 在欢迎菜单中

当显示欢迎菜单时，终端会切换到菜单模式。按照菜单提示操作，完成后会自动返回到终端模式。

## 安装依赖

首次使用前，请运行：
```bash
npm install
```

这会安装 node-pty 和其他必要的依赖。

## 故障排除

### 终端创建失败

如果真实终端创建失败，应用会自动降级到模拟终端模式。可能的原因：

1. node-pty 未正确安装
2. 系统权限不足
3. Shell 路径配置错误

### Windows 特殊说明

在 Windows 上，node-pty 需要编译原生模块。如果遇到问题：

1. 确保安装了 Visual Studio Build Tools
2. 运行 `npm install --global windows-build-tools`
3. 重新安装 node-pty：`npm rebuild node-pty`

### macOS 特殊说明

在 macOS 上，如果遇到权限问题：

1. 检查终端应用的系统权限
2. 在"系统偏好设置 > 安全性与隐私 > 隐私"中授予必要权限

## 技术架构

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   xterm.js      │────▶│  Electron IPC    │────▶│   node-pty   │
│  (前端显示)     │◀────│   (通信桥梁)     │◀────│  (真实终端)  │
└─────────────────┘     └──────────────────┘     └──────────────┘
         │                                                 │
         │                                                 │
         └────────────── 命令拦截器 ──────────────────────┘
                    (处理特殊命令)
```

## 开发说明

### 主要文件

- `src/main/terminal-pty.js` - 真实终端管理器
- `src/renderer/terminal.js` - 终端前端实现
- `src/renderer/terminal-commands.js` - 命令拦截器
- `src/preload/preload.js` - IPC 通信接口

### 扩展命令

要添加新的特殊命令，在 `terminal-commands.js` 中：

```javascript
this.registerCommand('mycommand', () => {
  this.terminal.writeln('执行我的命令');
  // 您的命令逻辑
});
```

### 调试

启用调试日志：
```bash
npm run dev
```

查看终端进程信息：
- 在控制台中查看 PID 和状态
- 使用系统工具监控子进程

## 安全说明

真实终端功能提供了完整的系统访问权限。请注意：

1. 只运行您信任的命令
2. 谨慎处理敏感信息
3. 定期更新依赖以修复安全漏洞

## 未来改进

- [ ] 终端分屏功能
- [ ] 终端主题自定义
- [ ] SSH 远程连接支持
- [ ] 终端会话持久化