# Miaoda 3.0.2 - 修复终端和架构优化

## 🐛 Bug 修复
- **修复终端空白问题**
  - 解决了终端页面加载后显示空白的问题
  - 修复了模块加载错误（XTerminal 和 TerminalTabs 的全局引用）
  - 修复了事件处理器中的全局对象引用

- **修复 PTY 会话管理**
  - 实现了完整的多会话 PTY 管理器
  - 修复了渲染进程和主进程之间的 IPC 通信
  - 支持会话 ID 的正确传递和处理
  - 终端现在能正确连接到本地 shell

- **修复自动执行 Claude 命令**
  - 终端初始化后会自动执行 claude 命令（如果配置了 API key）
  - 修复了命令执行时的会话 ID 传递问题

## 🔧 技术改进
- **代码质量提升**
  - 修复了所有 ESLint 错误（33 个问题全部解决）
  - 清理了内存泄漏（事件监听器和定时器）
  - 合并了冗余的环境检测文件
  - 实现了安全的 IPC 处理器管理机制

- **架构优化**
  - 添加了全局错误处理中间件
  - 错误自动记录到日志文件
  - 改进了资源释放机制

## 📦 下载说明
请在 GitHub Release 页面下载对应版本：
- **Miaoda-3.0.2-arm64.dmg** - Apple Silicon (M1/M2/M3)
- **Miaoda-3.0.2.dmg** - Intel Mac
- **Miaoda-3.0.2-arm64-mac.zip** - Apple Silicon (压缩包)
- **Miaoda-3.0.2-mac.zip** - Intel Mac (压缩包)

## 📋 文件列表
需要上传的文件（位于 dist 目录）：
- `dist/Miaoda-3.0.2-arm64.dmg`
- `dist/Miaoda-3.0.2.dmg`
- `dist/Miaoda-3.0.2-arm64-mac.zip`
- `dist/Miaoda-3.0.2-mac.zip`