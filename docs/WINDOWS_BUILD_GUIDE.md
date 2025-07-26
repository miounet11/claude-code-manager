# Windows 版本 GitHub Actions 构建指南

## 🚀 自动构建 Windows 版本

我们已经配置了 GitHub Actions 来自动构建 Windows 独立版本。这样您不需要 Windows 机器也能构建 Windows 版本！

## 📋 使用方法

### 方法 1：手动触发构建（推荐）

1. 访问 [Actions 页面](https://github.com/miounet11/claude-code-manager/actions)
2. 点击左侧的 "Build Windows Standalone Version"
3. 点击右侧的 "Run workflow"
4. 填写参数：
   - **Version number**: 版本号（如 `1.0.0`）
   - **Build 32-bit version**: 是否构建 32 位版本
   - **Build MSI installer**: 是否构建 MSI 安装包
5. 点击 "Run workflow" 开始构建

### 方法 2：推送代码自动触发

当您推送代码到 `feature/windows-support` 分支，并且修改了以下文件时会自动触发构建：
- `src-windows/**` 目录下的任何文件
- `package-windows.json`
- `electron-builder-windows.json`

### 方法 3：创建版本标签

创建符合格式的标签会自动触发构建和发布：
```bash
git tag windows-v1.0.0
git push origin windows-v1.0.0
```

## 📦 构建产物

构建完成后，会生成以下文件：

### 64 位版本
- `Miaoda-{version}-x64.exe` - NSIS 安装程序（推荐）
- `Miaoda-{version}-x64.msi` - MSI 企业部署包
- `Miaoda-{version}-x64.zip` - 便携版

### 32 位版本
- `Miaoda-{version}-ia32.exe` - NSIS 安装程序
- `Miaoda-{version}-ia32.zip` - 便携版

## 🔧 配置说明

### 构建配置文件

1. **`.github/workflows/build-windows-standalone.yml`**
   - GitHub Actions 工作流配置
   - 定义构建步骤和发布流程

2. **`package-windows.json`**
   - Windows 版本的 package.json
   - 包含 Windows 特定的依赖和脚本

3. **`electron-builder-windows.json`**
   - Electron Builder 配置
   - 定义安装包格式、图标、签名等

### 自定义构建

如需修改构建配置，编辑相应的文件：

```json
// electron-builder-windows.json
{
  "win": {
    "target": [
      {"target": "nsis", "arch": ["x64", "ia32"]},
      {"target": "msi", "arch": ["x64"]}
    ]
  }
}
```

## 🎯 构建步骤详解

1. **环境准备**
   - 使用 Windows Server 2022 虚拟机
   - 安装 Node.js 20
   - 缓存 Electron 和依赖

2. **代码准备**
   - 切换到 Windows 版本的 package.json
   - 更新版本号
   - 验证图标文件

3. **构建过程**
   - 使用 electron-builder 构建
   - 同时构建多种格式
   - 生成自动更新文件

4. **测试验证**
   - 验证安装包完整性
   - 检查文件大小
   - （可选）运行安装测试

5. **发布流程**
   - 上传构建产物
   - 创建 GitHub Release
   - 生成下载链接

## 📊 查看构建状态

1. 访问 [Actions 页面](https://github.com/miounet11/claude-code-manager/actions)
2. 查看构建进度和日志
3. 构建完成后下载产物

## 🐛 故障排除

### 构建失败常见原因

1. **缺少 Windows 图标**
   - 确保 `assets/icon.ico` 文件存在
   - 图标必须是有效的 .ico 格式

2. **依赖安装失败**
   - 检查 package-windows.json 中的依赖
   - 确保所有依赖都支持 Windows

3. **架构不匹配**
   - node-pty 等原生模块需要正确的架构
   - Actions 会自动处理，但本地构建需注意

### 本地测试构建

如果需要在本地测试：
```powershell
# 使用 Windows 配置
Copy-Item package-windows.json package.json -Force

# 安装依赖
npm install

# 构建
npx electron-builder --config electron-builder-windows.json

# 恢复原始配置
git checkout package.json
```

## 🚀 发布到用户

1. **下载构建产物**
   - 从 Actions 运行记录下载
   - 或从 Release 页面下载

2. **测试安装包**
   - 在 Windows 10/11 上测试
   - 验证所有功能正常

3. **发布 Release**
   - 编辑 GitHub Release
   - 添加更新说明
   - 发布给用户

## 💡 最佳实践

1. **版本管理**
   - Windows 版本独立编号
   - 使用 `windows-v` 前缀区分

2. **定期构建**
   - 每次重要更新后构建
   - 保持构建环境更新

3. **用户反馈**
   - 收集 Windows 用户反馈
   - 针对 Windows 特性优化

---

通过 GitHub Actions，您可以轻松构建和发布 Windows 版本，无需本地 Windows 环境！