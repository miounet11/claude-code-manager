# Windows 版本构建完整指南

## 🎯 概述

本指南详细说明如何为 Miaoda 项目构建 Windows 版本，包括本地构建和自动化构建两种方式。

## 🏗️ 构建架构

### 支持的架构
- **x64**: 64位 Windows 系统（推荐）
- **ia32**: 32位 Windows 系统（兼容性）

### 输出格式
- **NSIS 安装包**: `Miaoda-Setup-{version}.exe`
- **便携版**: `Miaoda-{version}-win.zip`

## 🔧 本地构建（Windows 环境）

### 环境要求
- Windows 10/11
- Node.js 18+
- npm 或 yarn
- Git

### 快速构建
```cmd
# 1. 克隆项目
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager

# 2. 安装依赖
npm install

# 3. 验证构建配置
node scripts\validate-win-build.js

# 4. 执行构建
scripts\build-release.bat
```

### 手动构建选项
```cmd
# 构建所有 Windows 版本（NSIS + 便携版）
npm run dist-win

# 仅构建便携版
npm run dist-win-portable

# 构建所有平台（需要对应环境）
npm run dist-all
```

## 🤖 自动化构建（GitHub Actions）

### 触发方式

#### 1. 标签推送（推荐）
```bash
# 创建并推送版本标签
git tag v2.0.6
git push origin v2.0.6
```

#### 2. 手动触发
1. 访问 [GitHub Actions](https://github.com/miounet11/claude-code-manager/actions)
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 输入版本号并运行

### 构建矩阵
```yaml
strategy:
  matrix:
    os: [windows-latest, macos-latest, ubuntu-latest]
```
- Windows 版本在 `windows-latest` 环境中构建
- 确保环境一致性和兼容性

## 📦 构建产物详解

### NSIS 安装包特性
- **完整安装体验**: 包含安装向导
- **自定义安装目录**: 用户可选择安装位置
- **快捷方式创建**: 自动创建桌面和开始菜单快捷方式
- **卸载程序**: 提供完整的卸载功能
- **版本信息**: 包含应用程序版本和元数据

### 便携版特性
- **免安装**: 解压即用
- **绿色软件**: 不修改系统注册表
- **配置独立**: 配置文件保存在应用目录
- **适合**: 需要便携使用的场景

## 🔍 构建验证

### 验证脚本使用
```cmd
node scripts\validate-win-build.js
```

### 验证内容
- ✅ 环境检查（Node.js、平台、架构）
- ✅ package.json 配置验证
- ✅ 资源文件检查（图标等）
- ✅ 依赖项验证
- ✅ 构建脚本完整性

### 手动验证
1. **文件完整性**: 确认生成的 exe 和 zip 文件
2. **安装测试**: 测试 NSIS 安装包的安装过程
3. **功能测试**: 验证应用程序基本功能
4. **卸载测试**: 测试完整卸载流程

## 🛠️ 故障排除

### 常见问题

#### 1. Wine 环境错误（macOS/Linux）
```
cannot execute cause=fork/exec .../wine64: bad CPU type in executable
```
**解决方案**: 
- 在 Windows 环境中构建
- 使用 GitHub Actions 自动构建

#### 2. 图标文件缺失
```
Error: ENOENT: no such file or directory, open 'assets/icon.ico'
```
**解决方案**:
```cmd
# 确保图标文件存在
dir assets\icon.ico
# 如果缺失，需要重新生成或复制图标文件
```

#### 3. 依赖项版本冲突
**解决方案**:
```cmd
# 清理 node_modules 和重新安装
rmdir /s node_modules
del package-lock.json
npm install
```

#### 4. 构建权限问题
**解决方案**:
- 以管理员权限运行 CMD
- 确保防病毒软件不阻止构建过程

### 调试模式
```cmd
# 启用详细日志
set DEBUG=electron-builder
npm run dist-win
```

## 📋 构建检查清单

### 构建前检查
- [ ] 验证 Node.js 版本 (18+)
- [ ] 确认所有依赖已安装
- [ ] 检查图标文件完整性
- [ ] 运行验证脚本
- [ ] 更新版本号

### 构建中监控
- [ ] 观察构建日志
- [ ] 检查无错误和警告
- [ ] 确认文件生成

### 构建后验证
- [ ] 测试安装包安装
- [ ] 验证应用程序启动
- [ ] 检查快捷方式创建
- [ ] 测试基本功能
- [ ] 验证卸载过程

## 🚀 发布流程

### 1. 准备发布
```bash
# 更新版本号
npm version patch  # 或 minor, major

# 提交更改
git add .
git commit -m "chore: bump version to v2.0.6"
git push
```

### 2. 创建发布
```bash
# 创建并推送标签
git tag v2.0.6
git push origin v2.0.6
```

### 3. 监控构建
1. 访问 [GitHub Actions](https://github.com/miounet11/claude-code-manager/actions)
2. 观察构建进度
3. 检查构建日志

### 4. 验证发布
1. 访问 [Releases 页面](https://github.com/miounet11/claude-code-manager/releases)
2. 确认文件已上传
3. 测试下载链接
4. 验证文件完整性

## 📊 性能优化

### 构建优化
```json
{
  "build": {
    "compression": "maximum",
    "nsis": {
      "differentialPackage": false
    }
  }
}
```

### 缓存策略
- GitHub Actions 自动缓存 npm 依赖
- 本地使用 `npm ci` 而非 `npm install`

## 🔐 安全考虑

### 代码签名（推荐用于生产）
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "${CERT_PASSWORD}"
    }
  }
}
```

### 病毒扫描
- 构建后进行病毒扫描
- 上传前验证文件安全性

## 📞 技术支持

如遇到构建问题：
1. 查看 [GitHub Actions 日志](https://github.com/miounet11/claude-code-manager/actions)
2. 运行本地验证脚本
3. 检查本指南的故障排除部分
4. 在 [GitHub Issues](https://github.com/miounet11/claude-code-manager/issues) 创建问题报告

---

*最后更新: 2025-07-23*