# 手动上传 Release 步骤

## 1. GitHub Actions 自动构建

当您推送标签时，GitHub Actions 会自动构建 Windows 版本。
查看构建进度：https://github.com/miounet11/claude-code-manager/actions

## 2. 手动创建 Release

如果需要手动创建 Release：

1. 访问：https://github.com/miounet11/claude-code-manager/releases/new
2. 选择标签：`v2.0.5`
3. 发布标题：`Miaoda v2.0.5 - 跨平台构建与自动化部署`
4. 发布说明：使用 `RELEASE_NOTES_v2.0.5.md` 的内容

## 3. 上传文件

### macOS 版本（本地已构建）
- `dist/Miaoda-2.0.5.dmg` - Intel Mac
- `dist/Miaoda-2.0.5-mac.zip` - Intel Mac ZIP
- `dist/Miaoda-2.0.5-arm64.dmg` - Apple Silicon
- `dist/Miaoda-2.0.5-arm64-mac.zip` - Apple Silicon ZIP

### Windows 版本（从 GitHub Actions 下载）
- `Miaoda-Setup-2.0.5.exe` - 安装程序
- `Miaoda-2.0.5-win.zip` - 便携版

## 4. 本地构建 Windows 版本（可选）

如果 GitHub Actions 构建失败，可以在 Windows 机器上本地构建：

```bash
# 在 Windows 上
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager
npm ci
npm run dist-win
```

构建产物在 `dist/` 目录中。