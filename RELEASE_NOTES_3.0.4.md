# Miaoda 3.0.4 发布说明

## 发布日期
2025-07-26

## 主要更新

### 🐛 彻底修复环境检测功能
经过深入分析和多轮测试，完全解决了打包后环境检测失效的问题。

#### 问题原因
- Electron 打包后的应用 PATH 环境变量被限制
- 仅包含系统基础路径 `/usr/bin:/bin:/usr/sbin:/sbin`
- 导致无法通过常规方式检测到 Node.js、Claude CLI 等工具

#### 解决方案
1. **多重检测机制**
   - 优先使用 `command -v` 命令（POSIX 标准）
   - 备用 `which` 命令
   - 直接尝试执行命令
   - 扫描常见安装路径

2. **完整路径检测**
   - 自动扫描以下路径：
     - `/usr/local/bin`
     - `/opt/homebrew/bin`
     - `~/Documents/claude code/node-v*/bin`
     - `~/.npm-global/bin`
     - `~/.local/bin`
     - `/Applications/Claude.app/Contents/Resources/bin`

3. **智能版本检测**
   - 使用完整路径执行版本命令
   - 对关键工具（node、claude、npm）特殊处理
   - 即使版本检测失败，文件存在即认为已安装

### 🔧 技术改进
- 参考 `Claude_code_proxy.sh` 的检测逻辑
- 优化了调试日志输出，减少干扰
- 提高了检测的准确性和可靠性
- 简化了代码结构，提高可维护性

### 📊 测试结果
在多种环境下测试通过：
- ✅ 开发环境（完整 PATH）
- ✅ 打包环境（受限 PATH）
- ✅ 不同安装路径的工具
- ✅ Apple Silicon 和 Intel Mac

## 升级建议
强烈建议所有用户升级到此版本，特别是遇到环境检测问题的用户。

## 下载地址
请从 GitHub Releases 页面下载对应版本：
- **Miaoda-3.0.4-arm64.dmg** - Apple Silicon (M1/M2/M3)
- **Miaoda-3.0.4.dmg** - Intel Mac
- **Miaoda-3.0.4-arm64-mac.zip** - Apple Silicon (压缩包)
- **Miaoda-3.0.4-mac.zip** - Intel Mac (压缩包)