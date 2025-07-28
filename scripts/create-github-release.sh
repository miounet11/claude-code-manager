#!/bin/bash

# GitHub Release 创建脚本（手动方式）
# 用于在没有 GitHub CLI 的情况下指导用户创建 Release

VERSION="v4.5.1"
REPO="miounet11/claude-code-manager"

echo "📦 手动创建 GitHub Release 步骤："
echo ""
echo "1. 打开 GitHub Release 创建页面："
echo "   https://github.com/${REPO}/releases/new"
echo ""
echo "2. 填写以下信息："
echo "   - Choose a tag: ${VERSION}"
echo "   - Release title: Miaoda ${VERSION} - Developer Experience Enhancement"
echo "   - 勾选 'Set as the latest release'"
echo ""
echo "3. 在描述框中粘贴以下内容："
echo "-----------------------------------"
cat << 'EOF'
# Miaoda v4.5.1 Release Notes

🎉 **发布日期**: 2025-07-28  
📌 **版本代号**: Developer Experience Enhancement

## 🎯 主要更新

这个版本专注于改进开发者体验，通过完善项目文档和测试体系，让开发者能够更快速、更准确地理解和贡献代码。

## ✨ 新功能与改进

### 📚 文档增强

#### 完善的 CLAUDE.md
- **全面的命令参考**：添加了所有可用命令的详细说明，包括构建、测试、分支管理等
- **测试脚本文档**：详细说明了 8 个测试脚本的功能和使用方法
- **AI 服务指南**：完整列出支持的云端和本地 AI 服务
- **动态路由示例**：提供了清晰的 API 路由使用示例

### 🧪 测试体系

- **完整的测试覆盖**：
  - `test-new-features.js` - 测试 v4.1.0 新功能
  - `test-config-save-and-apply.js` - 测试配置管理
  - `test-claude-detection.js` - 测试 Claude CLI 检测
  - `test-environment-detection.js` - 测试环境检测
  - `test-update-flow.js` - 测试自动更新流程
  - `test-update-logic.js` - 测试更新逻辑
  - `test-dynamic-path-finding.js` - 测试动态路径
  - `test-restore-default-config.js` - 测试配置恢复

### 🛠 开发工具

- **Git Flow 增强**：完善了分支管理工具的使用说明
- **版本管理优化**：改进了版本更新和发布流程
- **清晰的架构说明**：提供了带行号引用的代码架构图

## 📦 安装指南

### 下载预编译版本

从 [GitHub Releases](https://github.com/miounet11/claude-code-manager/releases/tag/v4.5.1) 下载：

- **macOS (Intel)**: `Miaoda-4.5.1-x64.dmg`
- **macOS (Apple Silicon)**: `Miaoda-4.5.1-arm64.dmg`

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager

# 切换到发布标签
git checkout v4.5.1

# 安装依赖
npm install

# 构建应用
npm run build
```

## 🔧 技术细节

### 版本信息
- 基于 Electron 30.0.0
- Node.js 16+ 兼容
- 支持 macOS 10.13+

### 主要依赖更新
- 所有依赖保持稳定版本
- 无破坏性变更

## 🙏 致谢

感谢所有贡献者和用户的反馈，让 Miaoda 变得更好！

特别感谢：
- Claude AI - 提供强大的 AI 助手能力
- Electron 社区 - 提供优秀的桌面应用框架
- 所有测试和反馈的用户

## 📝 下一步计划

- 继续优化 Windows 版本
- 增加更多 AI 服务支持
- 改进用户界面体验
- 增强性能和稳定性

---

**下载链接**: https://github.com/miounet11/claude-code-manager/releases/tag/v4.5.1  
**问题反馈**: https://github.com/miounet11/claude-code-manager/issues  
**项目主页**: https://github.com/miounet11/claude-code-manager

Made with ❤️ by Miaoda Team
EOF
echo "-----------------------------------"
echo ""
echo "4. 上传以下文件："
echo "   - dist/Miaoda-4.5.1.dmg"
echo "   - dist/Miaoda-4.5.1-mac.zip"
echo "   - dist/Miaoda-4.5.1-arm64.dmg"
echo "   - dist/Miaoda-4.5.1-arm64-mac.zip"
echo ""
echo "5. 点击 'Publish release' 发布"
echo ""
echo "本地文件信息："
ls -lh dist/Miaoda-4.5.1* 2>/dev/null || echo "未找到构建文件"