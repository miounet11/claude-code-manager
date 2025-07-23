# Miaoda 部署和发布指南

## 🚀 快速发布流程

### 自动化发布（推荐）

1. **更新版本号**
   ```bash
   # 在 package.json 中更新版本号到目标版本
   npm version patch  # 或 minor, major
   ```

2. **推送标签触发自动构建**
   ```bash
   git tag v2.0.5
   git push origin v2.0.5
   ```

3. **GitHub Actions 自动处理**
   - 自动构建所有平台版本 (Windows, macOS, Linux)
   - 自动创建 GitHub Release
   - 自动上传所有构建产物

### 手动构建（备用方案）

#### macOS/Linux 系统
```bash
# 使用构建脚本
./scripts/build-release.sh

# 或手动构建
npm ci
npm run dist-mac    # macOS 版本
npm run dist-all    # 所有支持的平台
```

#### Windows 系统
```cmd
REM 使用批处理脚本（推荐）
scripts\build-release.bat

REM 或手动构建
npm ci
npm run dist-win          REM 构建 Windows 版本（NSIS + 便携版）
npm run dist-win-portable REM 仅构建便携版

REM 验证构建配置
node scripts\validate-win-build.js
```

## 📦 构建配置

### 支持的平台和架构

| 平台 | 架构 | 输出格式 |
|------|------|----------|
| macOS | x64, arm64 | .dmg, .zip |
| Windows | x64, ia32 | .exe (NSIS), .zip (便携版) |
| Linux | x64 | .AppImage, .deb |

### 构建产物说明

#### macOS
- `Miaoda-{version}.dmg` - Intel Mac 安装包
- `Miaoda-{version}-arm64.dmg` - Apple Silicon 安装包
- `Miaoda-{version}-mac.zip` - Intel Mac 压缩包
- `Miaoda-{version}-arm64-mac.zip` - Apple Silicon 压缩包

#### Windows
- `Miaoda-Setup-{version}.exe` - Windows NSIS 安装程序（推荐）
- `Miaoda-{version}-win.zip` - Windows 便携版（免安装）
- 支持架构：x64（64位）、ia32（32位）
- 安装程序特性：
  - 支持自定义安装目录
  - 自动创建桌面和开始菜单快捷方式
  - 完整的卸载支持

#### Linux
- `Miaoda-{version}.AppImage` - 通用 Linux 应用
- `miaoda_{version}_amd64.deb` - Debian/Ubuntu 包

## 🔧 GitHub Actions 工作流

### 触发条件
- 推送以 `v` 开头的标签 (如 `v2.0.5`)
- 手动触发 (workflow_dispatch)

### 构建矩阵
```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest, ubuntu-latest]
```

### 工作流程

#### 构建阶段
1. **代码检出** - 获取源代码
2. **环境设置** - 安装 Node.js 18
3. **依赖安装** - 运行 `npm ci`
4. **平台构建** - 并行构建三个平台：
   - **Windows**: 在 `windows-latest` 上构建 NSIS 安装包和便携版
   - **macOS**: 在 `macos-latest` 上构建 DMG 和 ZIP 文件
   - **Linux**: 在 `ubuntu-latest` 上构建 AppImage 和 DEB 包
5. **产物上传** - 上传构建结果为 artifacts（保留 90 天）

#### 发布阶段（仅标签推送时）
6. **下载产物** - 下载所有平台的构建结果
7. **整理文件** - 统一整理到发布目录
8. **生成说明** - 自动生成发布说明和下载指南
9. **创建发布** - 自动创建 GitHub Release 并上传所有文件

## 📋 发布检查清单

### 发布前检查
- [ ] 代码已提交并推送到主分支
- [ ] 版本号已更新在 `package.json` 中
- [ ] 发布说明已准备 (`RELEASE_NOTES_v{version}.md`)
- [ ] 所有测试通过
- [ ] 本地构建测试成功

### 发布步骤
- [ ] 创建并推送版本标签
- [ ] 确认 GitHub Actions 构建成功
- [ ] 验证 Release 页面的构建产物
- [ ] 测试下载的安装包
- [ ] 更新相关文档

### 发布后检查
- [ ] 所有平台的安装包都可正常下载
- [ ] 应用启动和基本功能正常
- [ ] Release 说明准确完整
- [ ] 版本号标识正确

## 🛠️ 故障排除

### 常见问题

#### 1. macOS 代码签名警告
```
skipped macOS application code signing
```
**解决方案**: 这是正常现象，开发环境不需要代码签名。生产发布建议配置 Apple Developer 证书。

#### 2. GitHub Actions 构建失败
- 检查 Actions 日志中的具体错误信息
- 确认 `package.json` 配置正确
- 验证依赖是否兼容所有平台

#### 3. Windows 构建在 macOS 上失败
- Windows 版本需要在 Windows 环境或 GitHub Actions 中构建
- 本地 macOS 只构建 macOS 版本

#### 4. 图标文件缺失
- 确保 `assets/` 目录包含所需图标文件
- macOS: `icon.icns`
- Windows: `icon.ico`
- Linux: `icon.png`

## 🔗 相关资源

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [项目仓库](https://github.com/miounet11/claude-code-manager)
- [发布页面](https://github.com/miounet11/claude-code-manager/releases)

## 🪟 Windows 版本构建详解

### Windows 构建特点
- **多架构支持**: 同时构建 x64 和 ia32 版本
- **双重格式**: NSIS 安装包 + 便携版 ZIP
- **完整功能**: 桌面快捷方式、开始菜单、卸载程序
- **用户友好**: 支持自定义安装目录

### 构建验证
在构建前，可以运行验证脚本检查配置：
```bash
node scripts/validate-win-build.js
```

### 输出文件说明
| 文件名 | 格式 | 用途 | 推荐用户 |
|--------|------|------|----------|
| `Miaoda-Setup-{version}.exe` | NSIS 安装包 | 完整安装体验 | 普通用户 |
| `Miaoda-{version}-win.zip` | 便携版 | 免安装使用 | 高级用户 |

### 部署最佳实践
1. **优先使用 GitHub Actions**: 确保环境一致性
2. **测试多架构**: 验证 x64 和 ia32 版本
3. **检查安装体验**: 测试安装、运行、卸载流程
4. **验证数字签名**: 生产环境建议配置代码签名

## 📞 支持

如果遇到构建或发布问题，请：
1. 查看 GitHub Actions 的构建日志
2. 运行 `node scripts/validate-win-build.js` 检查配置
3. 检查本文档的故障排除部分
4. 在项目仓库创建 Issue 寻求帮助