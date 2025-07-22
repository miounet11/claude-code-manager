# 创建 GitHub Release 指南

## 步骤说明

1. **访问 Releases 页面**
   - 打开：https://github.com/miounet11/claude-code-manager/releases
   - 点击右上角的 "Draft a new release" 按钮

2. **填写 Release 信息**
   - **Choose a tag**: 创建新标签 `v2.0.1`
   - **Release title**: `Miaoda v2.0.1 - AI 编程神器`
   - **Describe this release**: 复制 `RELEASE_NOTES_v2.0.1.md` 的全部内容

3. **上传安装包文件**
   在 "Attach binaries" 区域，拖拽或选择以下文件：
   - macOS 版本：`Miaoda-2.0.1-arm64.dmg`
   - Windows 版本：`Miaoda Setup 2.0.1.exe`

4. **发布设置**
   - ✅ 勾选 "Set as the latest release"
   - 点击 "Publish release" 按钮

## 文件信息确认

### macOS 版本
- 文件名：`Miaoda-2.0.1-arm64.dmg`
- 大小：363 MB
- SHA256：`53f6af9f77dc1d5423520cf88f8e51b0790c030a9c69ad115bde073266054a59`

### Windows 版本  
- 文件名：`Miaoda Setup 2.0.1.exe`
- 大小：272 MB
- SHA256：`6b89a9185532a8a3ee95e08cec59ee0e3c2419132dd6a842b2b3f5754ffda6da`

## 注意事项

1. 确保文件名与 Release Notes 中的链接一致
2. 发布后，用户就可以在 Release 页面看到下载按钮
3. GitHub 会自动为每个文件生成下载链接

## 更新 README

发布后，更新 README.md 中的下载链接：
```markdown
### 🌟 三步安装，改变人生！

#### 第一步：下载神器
👉 [**点击这里下载最新版本**](https://github.com/miounet11/claude-code-manager/releases/latest) 👈

或直接下载：
- 🍎 [macOS 版本](https://github.com/miounet11/claude-code-manager/releases/download/v2.0.1/Miaoda-2.0.1-arm64.dmg)
- 🪟 [Windows 版本](https://github.com/miounet11/claude-code-manager/releases/download/v2.0.1/Miaoda-Setup-2.0.1.exe)
```