# 跨平台构建指南

## 在 macOS 上构建 Windows 版本

### 方法 1：使用 Wine（可能有兼容性问题）

```bash
# 安装 Wine
brew install --cask wine-stable

# 或者使用 wine-crossover
brew install --cask wine-crossover

# 然后构建
npm run dist-win
```

⚠️ **注意**：在 Apple Silicon (M1/M2/M3) 上，Wine 可能无法正常工作。

### 方法 2：使用 GitHub Actions（推荐）

创建 `.github/workflows/build.yml`：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dist-mac
      - uses: actions/upload-artifact@v3
        with:
          name: mac-build
          path: dist/*.dmg

  build-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dist-win
      - uses: actions/upload-artifact@v3
        with:
          name: win-build
          path: dist/*.exe

  release:
    needs: [build-mac, build-win]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    steps:
      - uses: actions/download-artifact@v3
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            mac-build/*.dmg
            win-build/*.exe
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 方法 3：使用 Docker（本地构建）

```bash
# 创建 Dockerfile.windows
FROM electronuserland/builder:wine

WORKDIR /app
COPY . .
RUN npm install
RUN npm run dist-win

# 构建
docker build -f Dockerfile.windows -t miaoda-win-builder .
docker run --rm -v $(pwd)/dist:/app/dist miaoda-win-builder
```

### 方法 4：只构建 macOS 版本

如果暂时无法构建 Windows 版本，可以：

1. 先只发布 macOS 版本
2. 在 Release Notes 中说明 Windows 版本稍后提供
3. 请有 Windows 环境的协作者帮助构建

```bash
# 只构建 macOS 版本
npm run dist-mac
```

## 推荐方案

对于您的情况，我建议：

1. **立即发布**：先用已有的文件创建 Release
2. **设置 CI/CD**：配置 GitHub Actions 自动构建
3. **未来发布**：通过 GitHub Actions 自动构建全平台版本

这样可以：
- 避免本地环境配置问题
- 确保构建环境一致性
- 自动化发布流程
- 支持所有平台