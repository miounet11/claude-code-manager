# Miaoda 缓存解决方案

## 问题背景

在 Electron 应用开发过程中，JavaScript 文件缓存是一个常见问题。即使代码已更新，应用仍可能加载旧版本的 JS 文件，导致：
- 新功能无法生效
- Bug 修复未能应用
- 开发调试困难

## 解决方案架构

我们实施了一个多层次的缓存防护策略：

### 1. 主进程缓存管理 (`src/main/services/cache-manager.js`)

- **自动缓存清理**：应用启动时检测版本变化，自动清理所有缓存
- **开发模式优化**：开发环境下始终清理缓存
- **HTTP 请求拦截**：为所有本地文件请求添加防缓存头
- **版本追踪**：记录应用版本，检测更新

### 2. 开发环境配置 (`src/main/services/dev-cache-config.js`)

在开发模式下通过 Chromium 命令行参数彻底禁用缓存：
```javascript
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
```

### 3. 动态版本管理

#### 3.1 构建时版本生成 (`scripts/update-version.js`)
- 每次构建前自动生成新的版本号
- 创建 `version.json` 文件包含构建信息
- 更新 `package.json` 中的构建信息

#### 3.2 运行时版本管理 (`src/renderer/utils/version-manager.js`)
- 动态加载脚本时自动添加版本参数
- 提供统一的模块导入接口
- 支持版本更新检测

### 4. 渲染进程防缓存

#### 4.1 HTML 文件
```javascript
// 动态加载主脚本并添加版本号
const scriptVersion = new Date().getTime();
import(`./App.js?v=${scriptVersion}`);
```

#### 4.2 App.js 动态导入
```javascript
// 使用版本管理器加载组件
const { Sidebar } = await this.importModule('./components/Sidebar.js');
```

### 5. 用户界面集成

在环境检测面板添加"清理缓存"按钮，用户可以：
- 手动清理所有缓存
- 查看当前版本信息
- 选择是否重新加载应用

## 使用指南

### 开发时

1. **自动模式**：使用 `npm run dev` 启动，缓存自动禁用
2. **手动清理**：运行 `npm run clear-cache` 清理所有缓存
3. **界面清理**：点击环境面板的"清理缓存"按钮

### 构建时

构建命令已集成版本更新：
```bash
npm run build    # 自动更新版本号
npm run dist     # 自动更新版本号
```

### 用户使用

用户在遇到缓存问题时可以：
1. 打开环境检测面板（侧边栏 > 环境状态 > 查看详情）
2. 点击"清理缓存"按钮
3. 选择重新加载应用

## 技术细节

### 缓存位置

不同平台的缓存位置：
- **macOS**: `~/Library/Caches/miaoda/`
- **Windows**: `%APPDATA%\miaoda\Cache\`
- **Linux**: `~/.cache/miaoda/`

### 版本文件

- `src/renderer/version.json` - 构建版本信息
- `build-info.json` - 构建号追踪
- `app-version.json` - 应用版本记录（用户数据目录）

### IPC 命令

- `cache:clear` - 清理所有缓存
- `cache:get-stats` - 获取缓存统计
- `cache:reload-window` - 重新加载窗口

## 故障排除

### 缓存仍然存在？

1. 确保使用了最新的构建
2. 检查是否有其他 Electron 实例在运行
3. 手动删除缓存目录
4. 重启计算机（极端情况）

### 开发时缓存问题

1. 确保使用 `npm run dev` 而不是 `npm start`
2. 打开开发者工具，禁用缓存选项
3. 使用 Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows) 强制刷新

## 最佳实践

1. **版本控制**：确保 `version.json` 和 `build-info.json` 不被提交到 Git
2. **定期清理**：开发时定期运行清理脚本
3. **测试验证**：每次重大更新后测试缓存清理功能
4. **用户教育**：在帮助文档中说明缓存清理功能

## 未来改进

1. 自动检测需要清理缓存的情况
2. 提供更细粒度的缓存控制
3. 添加缓存使用统计和分析
4. 实现智能缓存策略（保留必要缓存）

---

通过这套完整的缓存解决方案，我们确保了 Miaoda 应用始终加载最新的代码，提供稳定可靠的用户体验。