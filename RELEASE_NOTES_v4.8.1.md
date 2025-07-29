# Miaoda v4.8.1 Release Notes

## 🚀 版本概览

**发布日期**: 2025-07-29  
**版本类型**: Bug修复和稳定性改进  
**适用平台**: macOS (Intel & Apple Silicon)

## 🐛 重要修复

### 1. 修复启动时的关键错误
- ✅ 修复IPC处理器重复注册导致的 "Attempted to register a second handler" 错误
- ✅ 解决智能错误处理系统的循环依赖问题
- ✅ 修复错误通知器中的 undefined 读取错误
- ✅ 确保基础IPC处理器（app:version、env:check、config:get-all）正常工作

### 2. 稳定性改进
- 🔧 暂时禁用智能错误处理系统的自动集成，避免启动冲突
- 🔧 优化错误处理模块之间的依赖关系
- 🔧 改进缓存管理策略，提升开发模式稳定性

## 🎯 轻量化重构计划启动

从v4.8.1开始，我们将逐步进行轻量化重构，目标是：
- 降低系统复杂度（从8.5/10降至5.0/10）
- 减少代码量40%（从25,230行减至15,000行）
- 提升维护效率和开发体验

## 💻 技术细节

### 修复的关键文件
- `src/main/services/ipc-controller-simple.js` - 修复重复注册问题
- `src/main/services/error-notifier.js` - 解决循环依赖
- `src/main/services/error-handler.js` - 默认禁用智能集成

### 已知问题
- 智能错误处理功能暂时处于禁用状态，后续版本将重新设计并启用

## 📦 安装说明

### macOS
```bash
# 下载对应架构的安装包
# Intel Mac: Miaoda-4.8.1-x64.dmg
# Apple Silicon: Miaoda-4.8.1-arm64.dmg

# 或使用 Homebrew（即将支持）
brew install miaoda
```

## 🙏 致谢

感谢所有用户的反馈和支持。您的问题报告帮助我们快速定位并修复了这些关键错误。

## 📞 问题反馈

如遇到问题，请通过以下方式反馈：
- GitHub Issues: https://github.com/miounet11/claude-code-manager/issues
- 邮箱: support@miaoda.app

---

**下一版本预告**: v4.9.0 将完成第一阶段轻量化重构，移除过度复杂的智能错误处理系统，预计性能提升30%。