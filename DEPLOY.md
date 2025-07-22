# GitHub 部署指南

## 第一步：创建 GitHub 仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - Repository name: `miaoda`
   - Description: `专业的 Claude Code 部署和管理工具`
   - 选择 Public 或 Private
   - 不要勾选 "Initialize this repository with a README"
4. 点击 "Create repository"

## 第二步：推送代码到 GitHub

复制 GitHub 提供的仓库地址，然后在终端执行：

```bash
# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/YOUR_USERNAME/miaoda.git

# 推送代码到 GitHub
git push -u origin main
```

如果使用 SSH：
```bash
git remote add origin git@github.com:YOUR_USERNAME/miaoda.git
git push -u origin main
```

## 第三步：创建发布版本

### 方法 1：通过 GitHub 网页创建

1. 在 GitHub 仓库页面，点击右侧的 "Releases"
2. 点击 "Create a new release"
3. 点击 "Choose a tag"，输入版本号（如 `v2.0.0`）
4. 填写发布信息：
   - Release title: `Miaoda v2.0.0`
   - 描述新功能和改进
5. 点击 "Publish release"

### 方法 2：通过命令行创建

```bash
# 创建标签
git tag -a v2.0.0 -m "Release version 2.0.0"

# 推送标签到 GitHub
git push origin v2.0.0
```

## 第四步：自动构建

推送标签后，GitHub Actions 会自动：
1. 在 macOS 上构建 DMG 和 ZIP 文件
2. 在 Windows 上构建 EXE 安装包
3. 创建 Release 并上传构建产物

## 第五步：查看构建状态

1. 在仓库页面点击 "Actions" 标签
2. 查看 "Build and Release" 工作流的执行状态
3. 等待构建完成（通常需要 10-20 分钟）

## 第六步：下载发布版本

构建完成后：
1. 返回 "Releases" 页面
2. 在最新的 Release 下可以看到：
   - macOS 版本：`.dmg` 和 `.zip` 文件
   - Windows 版本：`.exe` 安装包

## 常用命令

### 更新版本号
```bash
# 修改 package.json 中的版本号
npm version patch  # 2.0.0 -> 2.0.1
npm version minor  # 2.0.0 -> 2.1.0
npm version major  # 2.0.0 -> 3.0.0
```

### 创建新版本并发布
```bash
# 1. 更新版本号
npm version minor

# 2. 提交更改
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"

# 3. 创建标签
git tag v$(node -p "require('./package.json').version")

# 4. 推送到 GitHub
git push origin main --tags
```

## 故障排除

### 如果构建失败

1. 检查 Actions 日志查看错误信息
2. 常见问题：
   - 图标文件缺失或格式错误
   - 依赖安装失败
   - 构建配置错误

### 如果需要手动触发构建

1. 进入 "Actions" 页面
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 选择分支并运行

## 更新配置

### 修改自动更新服务器

编辑 `src/main/updater.js` 中的：
```javascript
const UPDATE_CHECK_URL = 'https://api.iclaudecode.cn/updates.json';
```

### 修改数据统计服务器

编辑 `src/main/analytics.js` 中的：
```javascript
const API_BASE_URL = 'https://api.iclaudecode.cn';
```

## 安全提醒

- 不要在代码中硬编码 API Key
- 使用 GitHub Secrets 存储敏感信息
- 定期更新依赖以修复安全漏洞