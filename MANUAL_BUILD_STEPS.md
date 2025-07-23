# 手动构建和发布步骤

## 选项 1：重新触发 GitHub Actions（推荐）

由于已经修复了构建配置，您可以：

1. **删除并重新创建标签**
```bash
git tag -d v2.0.2
git push origin :refs/tags/v2.0.2
git tag v2.0.2 -m "Release v2.0.2"
git push origin v2.0.2
```

2. **或者手动触发工作流**
- 访问：https://github.com/miounet11/claude-code-manager/actions/workflows/build-release.yml
- 点击 "Run workflow"
- 输入版本号：v2.0.2
- 点击 "Run workflow" 开始构建

## 选项 2：下载已构建的文件

虽然 Actions 报错了，但 Windows 文件实际上已经构建成功。您可以：

1. 访问失败的 Actions 运行记录
2. 在页面底部找到 "Artifacts" 部分
3. 下载：
   - `win-build` - 包含 Windows 构建文件
   - `mac-build` - 包含 macOS 构建文件

## 选项 3：手动创建 Release

1. 访问：https://github.com/miounet11/claude-code-manager/releases/new
2. 选择标签：v2.0.2
3. 标题：Miaoda v2.0.2 - Claude Code 快捷命令与自动批准
4. 上传以下文件：

### macOS（本地已有）
- dist/Miaoda-2.0.2.dmg
- dist/Miaoda-2.0.2-mac.zip
- dist/Miaoda-2.0.2-arm64.dmg
- dist/Miaoda-2.0.2-arm64-mac.zip

### Windows（从 Actions Artifacts 下载）
- Miaoda Setup 2.0.2.exe（安装程序）
- Miaoda 2.0.2.exe（便携版）

## 发布说明内容

使用 `RELEASE_NOTES_v2.0.2.md` 文件中的内容。