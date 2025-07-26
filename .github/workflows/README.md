# Miaoda GitHub Actions 构建工作流

我们使用 GitHub Actions 自动构建 macOS 和 Windows 版本。

## 📋 工作流文件

### 1. `build-macos.yml` - macOS 版本构建
- 构建 Intel (x64) 和 Apple Silicon (arm64) 版本
- 生成 DMG 和 ZIP 格式
- 自动创建 Release 草稿

### 2. `build-windows.yml` - Windows 版本构建  
- 构建 64位 (x64) 和 32位 (ia32) 版本
- 生成 NSIS、MSI（仅64位）和 ZIP 格式
- 使用独立的 Windows 代码库 (src-windows/)

## 🚀 触发方式

### macOS 构建

#### 1. 创建版本标签
```bash
git tag v4.2.0
git push origin v4.2.0
```

#### 2. 手动触发
1. 访问 [Actions](https://github.com/miounet11/claude-code-manager/actions)
2. 选择 "Build macOS Version"
3. 点击 "Run workflow"
4. 输入版本号

### Windows 构建

#### 1. 创建 Windows 标签
```bash
git tag windows-v1.0.0
# 或
git tag v1.0.0-windows
git push origin windows-v1.0.0
```

#### 2. 推送到 Windows 分支
推送代码到 `feature/windows-support` 分支会自动触发构建

#### 3. 手动触发
1. 访问 [Actions](https://github.com/miounet11/claude-code-manager/actions)
2. 选择 "Build Windows Version"
3. 点击 "Run workflow"
4. 输入版本号

## 📦 构建产物

### macOS
- `Miaoda-{version}.dmg` - Intel DMG 安装包
- `Miaoda-{version}-arm64.dmg` - Apple Silicon DMG 安装包
- `Miaoda-{version}-mac.zip` - Intel 压缩包
- `Miaoda-{version}-arm64-mac.zip` - Apple Silicon 压缩包

### Windows
- `Miaoda-{version}-x64.exe` - 64位 NSIS 安装程序
- `Miaoda-{version}-x64.msi` - 64位 MSI 企业部署包
- `Miaoda-{version}-x64.zip` - 64位便携版
- `Miaoda-{version}-ia32.exe` - 32位 NSIS 安装程序
- `Miaoda-{version}-ia32.zip` - 32位便携版

## 🔧 配置文件

### macOS
- 使用主项目的 `package.json`
- 构建配置在 `package.json` 的 `build` 字段

### Windows
- 使用 `package-windows.json`
- 构建配置在 `electron-builder-windows.json`
- 代码在 `src-windows/` 目录

## 📝 发布流程

1. **自动创建 Release 草稿**
   - 标签推送会自动创建 Release 草稿
   - 包含所有构建产物
   - 需要手动编辑和发布

2. **手动发布步骤**
   - 编辑 Release 描述
   - 添加更新日志
   - 选择是否为预发布版本
   - 点击发布

## 🛠️ 维护说明

### 添加新的构建目标
1. 编辑对应的工作流文件
2. 在 `matrix` 中添加新目标
3. 更新构建命令

### 修改构建配置
- macOS: 编辑 `package.json` 的 `build` 部分
- Windows: 编辑 `electron-builder-windows.json`

### 调试构建问题
1. 查看 Actions 运行日志
2. 下载构建产物进行测试
3. 在本地复现构建环境

## 💡 最佳实践

1. **版本号管理**
   - macOS: 使用 `v` 前缀（如 `v4.2.0`）
   - Windows: 使用 `windows-v` 前缀（如 `windows-v1.0.0`）

2. **分支策略**
   - `main`: macOS 稳定版本
   - `feature/windows-support`: Windows 开发版本
   - `develop`: 开发分支

3. **测试构建**
   - 先手动触发测试构建
   - 验证无误后再创建标签发布

## ⚠️ 注意事项

1. **签名问题**
   - 当前未配置代码签名
   - 用户可能看到安全警告

2. **构建时间**
   - 完整构建需要 10-20 分钟
   - Windows 构建通常更慢

3. **存储限制**
   - 构建产物保留 30 天
   - 定期清理旧的构建