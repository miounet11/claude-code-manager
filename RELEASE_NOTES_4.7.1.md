# v4.7.1 - Quality Assurance & Bug Fixes

## 🎯 主要更新
修复测试中发现的所有关键问题，提升应用稳定性和可靠性。

## 🐛 修复
- **代理服务器修复**：
  - 修复动态路由模式下的请求转发错误（400 错误）
  - 修正请求体处理配置问题
  - 添加缺失的请求计数功能
  - 修复统计信息字段名不一致问题

- **终端模块修复**：
  - 修复 PtyManager 的 resize 方法返回值
  - 添加 destroy 清理方法防止内存泄漏
  - 改进 node-pty 降级处理逻辑

- **IPC 通信修复**：
  - 添加缺失的 window.electronAPI.startProxy 方法
  - 修复 preload.js 中缺少的 showSuccess 方法
  - 完善 proxy:start/stop/status 处理器

## ✨ 新功能
- **测试体系**：
  - 添加完整的测试套件（代理、终端、集成测试）
  - 生成详细的测试报告（HTML 和 Markdown 格式）
  - 添加测试运行器和覆盖率统计

## 📝 文档改进
- 添加原生模块构建指南（docs/BUILD_NATIVE_MODULES.md）
- 添加架构设计文档（docs/ARCHITECTURE.md）
- 添加测试修复总结（test/TEST_FIX_SUMMARY.md）

## 🛠 架构优化
- 统一模块导出方式（明确单例模式使用）
- 改进错误处理和日志记录
- 优化测试助手以支持不同的模块模式

## 🧪 测试结果
- 所有核心功能测试通过
- 代理服务器、终端管理、配置管理功能正常
- 测试覆盖率提升到 72.73%

## 📦 下载
请在 GitHub Actions 构建完成后下载对应平台的安装包：
- **macOS (Intel)**: `Miaoda-4.7.1-x64.dmg`
- **macOS (Apple Silicon)**: `Miaoda-4.7.1-arm64.dmg`

## 📋 完整更新日志
请查看 [CHANGELOG.md](CHANGELOG.md) 了解详细更新内容。

---
🤖 Generated with [Claude Code](https://claude.ai/code)