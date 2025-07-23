# 📦 安装包上传步骤

## 1. 下载现有安装包

您需要先从当前存储位置下载这两个文件：

### macOS 版本
- 文件名：`Miaoda-2.0.1-arm64.dmg`
- 大小：363 MB
- SHA256：`53f6af9f77dc1d5423520cf88f8e51b0790c030a9c69ad115bde073266054a59`

### Windows 版本
- 文件名：`Miaoda Setup 2.0.1.exe`
- 大小：272 MB
- SHA256：`6b89a9185532a8a3ee95e08cec59ee0e3c2419132dd6a842b2b3f5754ffda6da`

## 2. 创建 GitHub Release

1. 访问：https://github.com/miounet11/claude-code-manager/releases
2. 点击 **"Draft a new release"** 按钮
3. 填写信息：
   - **Choose a tag**: 点击 "Create new tag"，输入 `v2.0.1`
   - **Target**: 保持默认 (main)
   - **Release title**: `Miaoda v2.0.1 - AI 编程神器`
   - **Describe this release**: 复制 `RELEASE_NOTES_v2.0.1.md` 的全部内容

## 3. 上传安装包

在页面底部的 **"Attach binaries by dropping them here or selecting them"** 区域：
1. 点击选择文件或拖拽文件
2. 上传 `Miaoda-2.0.1-arm64.dmg`
3. 上传 `Miaoda Setup 2.0.1.exe`
4. 等待文件上传完成（可能需要几分钟）

## 4. 发布

1. ✅ 确保勾选 **"Set as the latest release"**
2. 点击 **"Publish release"** 按钮

## 5. 验证

发布后检查：
- 访问 https://github.com/miounet11/claude-code-manager/releases
- 确认能看到下载按钮
- 测试下载链接是否正常
- README 中的直接下载链接应该自动生效

## 🎯 重要提示

- 文件名必须与 README 中的链接完全一致
- 上传大文件时请保持网络稳定
- GitHub 会自动生成下载统计
- 发布后用户就能直接下载了

## 📝 备用方案

如果文件太大上传困难，可以考虑：
1. 使用 GitHub Actions 自动构建和发布
2. 使用 Git LFS 存储大文件
3. 提供其他下载镜像（如国内 CDN）