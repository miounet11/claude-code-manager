# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Miaoda 是一个专为 Claude Code (claude.ai/code) 设计的 macOS 桌面管理工具，使用 Electron 框架构建，提供了 VSCode 风格的终端体验和便捷的配置管理功能。

## 常用命令

### 开发与运行
```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建 macOS 应用
npm run build
npm run dist

# 运行代码检查
npm run lint
```

### 类型检查
项目中没有 TypeScript，但使用了 ESLint 进行代码质量检查。

## 架构概述

### 主要目录结构
- `src/main/` - Electron 主进程代码
  - `index.js` - 主进程入口文件
  - `pty-manager.js` - 终端会话管理器
  - `services/` - 核心服务模块
    - `environment-service.js` - 环境检测服务
    - `config-service.js` - 配置管理服务
    - `ipc-controller-simple.js` - IPC 通信控制器
- `src/renderer/` - 渲染进程代码
  - `xterm-terminal.js` - xterm.js 终端实现
  - `terminal-tabs.js` - 多标签终端管理
  - `components/` - UI 组件
- `src/preload/` - 预加载脚本

### 核心技术栈
- **Electron 30.0.0** - 跨平台桌面应用框架
- **xterm.js 5.3.0** - 终端渲染引擎（与 VSCode 相同）
- **node-pty 1.0.0** - 提供真实的终端环境
- **electron-store 8.2.0** - 配置存储

### 关键实现细节

1. **终端实现**
   - 使用 xterm.js 渲染终端界面
   - 通过 node-pty 创建真实的 shell 进程
   - IPC 通信连接主进程和渲染进程的终端数据

2. **多终端管理**
   - PtyManager 类管理所有终端会话
   - 支持创建、切换、关闭多个独立终端
   - 每个终端维护独立的 pty 进程

3. **环境检测**
   - EnvironmentService 负责检测系统环境
   - 检测 Claude CLI、Python、Node.js 等依赖
   - 自动合并系统 PATH 确保命令可用

4. **IPC 通信**
   - 使用 Electron IPC 进行进程间通信
   - ipc-controller-simple.js 集中管理所有 IPC 处理器
   - 避免重复注册导致的问题

## 开发注意事项

1. **终端相关开发**
   - 修改终端功能时需同时考虑 pty-manager.js（主进程）和 xterm-terminal.js（渲染进程）
   - 终端数据通过 IPC 传输，注意性能优化

2. **环境变量处理**
   - macOS 应用中需要特别处理 PATH 环境变量
   - 使用 `/usr/libexec/path_helper -s` 获取系统 PATH

3. **代码风格**
   - 使用 ESLint 规则（2空格缩进，单引号，Unix换行符）
   - 遵循现有代码风格，特别是 ES6+ 语法使用

4. **调试技巧**
   - 开发模式会开启 DevTools
   - 终端相关问题查看 console 日志
   - IPC 通信问题检查事件名称是否匹配