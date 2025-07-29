# 构建原生模块指南

## node-pty 模块

Miaoda 使用 `node-pty` 提供真正的终端体验。这是一个原生模块，需要在安装后编译。

### 自动构建

正常情况下，运行 `npm install` 时会自动构建原生模块。

### 手动构建

如果自动构建失败，可以手动重新构建：

```bash
# 重新构建所有原生模块
npm rebuild

# 或只重建 node-pty
npm rebuild node-pty
```

### Electron 环境构建

对于 Electron 应用，需要使用 electron-rebuild：

```bash
# 安装 electron-rebuild
npm install --save-dev electron-rebuild

# 重建原生模块
./node_modules/.bin/electron-rebuild

# 或使用 npm script
npm run rebuild
```

### 常见问题

1. **构建失败**
   - 确保安装了构建工具：
     - macOS: Xcode Command Line Tools (`xcode-select --install`)
     - Windows: windows-build-tools (`npm install --global windows-build-tools`)
     - Linux: build-essential (`sudo apt-get install build-essential`)

2. **架构不匹配**
   - 确保为正确的架构构建：
     ```bash
     # 查看当前架构
     node -p process.arch
     
     # 为特定架构构建
     npm rebuild --arch=x64
     ```

3. **Electron 版本不匹配**
   - 确保使用正确的 Electron 版本：
     ```bash
     # 查看 Electron 版本
     ./node_modules/.bin/electron --version
     
     # 为特定版本重建
     ./node_modules/.bin/electron-rebuild -v 22.0.0
     ```

### 降级处理

如果 node-pty 构建持续失败，应用会自动降级到标准进程模式，虽然功能有限但仍可使用。

### 测试原生模块

运行终端模块测试：

```bash
node test/test-terminal-module.js
```

如果看到 "PTY 创建失败（可能使用标准进程模式）" 的警告，说明 node-pty 未正确构建。