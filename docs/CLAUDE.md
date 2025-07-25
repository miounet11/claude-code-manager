# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 构建命令

- `npm run start` - 启动应用程序
- `npm run dev` - 以开发模式启动（启用开发者工具）
- `npm run build` - 构建应用程序
- `npm run dist-mac` - 构建 macOS 版本
- `npm run dist-win` - 构建 Windows 版本
- `npm run dist-linux` - 构建 Linux 版本
- `npm run lint` - 运行 ESLint 代码检查

## 项目架构

这是一个 Electron 应用程序，用于管理和部署 Claude Code。

### 核心模块结构

- **主进程 (src/main/)**
  - `index.js` - 应用入口，管理窗口生命周期和 IPC 通信
  - `claude-runner.js` - 核心功能：管理 Claude 进程的启动、停止和状态监控
  - `installer.js` - 处理 Claude CLI 的安装和版本管理
  - `process-guardian.js` - 监控和管理子进程，确保稳定性
  - `system-tray.js` - 系统托盘功能实现

- **渲染进程 (src/renderer/)**
  - `renderer.js` - UI 交互逻辑，处理用户操作和状态更新
  - `xterm-terminal.js` - 终端实现，显示 Claude 输出

- **预加载脚本 (src/preload/)**
  - `preload.js` - 安全桥接主进程和渲染进程的通信

### IPC 通信模式

应用使用 Electron 的 IPC 机制进行进程间通信：
- 渲染进程通过 `window.electronAPI` 调用主进程功能
- 主进程通过 `webContents.send()` 向渲染进程发送事件
- 关键通道：`claude:start`, `claude:stop`, `claude:status`, `terminal:data`

### 状态管理

- 使用 `electron-store` 持久化配置
- 主要配置项：`claudePort`, `autoStart`, `alwaysOnTop`, `shortcuts`
- 进程状态通过事件驱动更新 UI

### 代码规范

- 使用 ES6+ 语法，严格模式
- 2 空格缩进，单引号，必须分号
- 优先使用 const 和箭头函数
- 模块化设计，每个文件负责单一功能

## 开发注意事项

1. 修改主进程代码后需要重启应用
2. 修改渲染进程代码后可以通过刷新窗口（Cmd+R）查看效果
3. 所有与系统交互的功能必须在主进程中实现
4. 终端输出通过 xterm.js 处理，注意编码和性能
5. 构建前确保运行 `npm run lint` 检查代码规范