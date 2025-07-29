# v4.7.2 - Critical Bug Fix

## 🎯 紧急修复

本版本紧急修复了用户反馈的严重问题，确保配置管理功能正常使用。

## 🐛 问题修复

### appendChild 错误修复
- **问题**：点击"保存并启动代理"时出现 `Cannot read properties of null (reading 'appendChild')` 错误
- **原因**：app-full.html 中使用 alert() 函数导致的兼容性问题
- **解决**：将所有 alert() 调用替换为 Electron 的对话框 API

### 具体改进
1. 替换了 15 个 alert() 调用
2. 使用 window.electronAPI.showError/showSuccess 显示消息
3. 确保错误提示正确显示
4. 恢复配置保存和启动功能

## 📝 文档更新
- 添加错误修复文档：`agentdocs/fix-appendchild-error.md`
- 创建产品分析报告：`agentdocs/product-analysis-v471.md`
- 添加测试验证脚本：`test/test-config-save-fix.js`

## 🧪 测试验证
- 所有 alert 调用已成功替换
- preload.js API 定义完整
- IPC 处理器正常工作
- 配置保存功能恢复正常

## 📦 下载
- **macOS (Intel)**: `Miaoda-4.7.2-x64.dmg`
- **macOS (Apple Silicon)**: `Miaoda-4.7.2-arm64.dmg`

## 🙏 致谢
感谢用户及时反馈问题，帮助我们快速定位并修复了这个关键错误。

---
🤖 Generated with [Claude Code](https://claude.ai/code)