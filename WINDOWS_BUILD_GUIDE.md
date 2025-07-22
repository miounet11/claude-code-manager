
# Windows 构建指南

## 在 macOS 上构建 Windows 版本

### 方法 1：使用 electron-builder (推荐)
1. 确保已安装 Wine:
   ```bash
   brew install --cask wine-stable
   ```

2. 构建 Windows 版本:
   ```bash
   npm run dist-win
   ```

### 方法 2：在 Windows 系统上构建
1. 在 Windows 系统上克隆项目
2. 安装依赖:
   ```bash
   npm install
   ```
3. 构建:
   ```bash
   npm run dist-win
   ```

### 方法 3：使用 GitHub Actions 或 CI/CD
创建 .github/workflows/build.yml 文件来自动构建多平台版本

## 图标要求
- Windows: icon.ico (至少包含 256x256 尺寸)
- macOS: icon.icns
- Linux: icon.png (1024x1024)

## 注意事项
- 确保 assets/icon.ico 文件至少包含 256x256 的图标
- Windows 版本需要代码签名以避免安全警告
- 建议使用专业工具创建图标文件
