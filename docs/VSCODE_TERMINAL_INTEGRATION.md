# VSCode 终端完美复刻实现

## 🎯 目标实现

完美复刻 VSCode 的终端体验，包括：
- 真实的 Shell 环境
- ANSI 颜色支持
- 完整的快捷键
- 流畅的滚动
- 链接识别
- 搜索功能

## 🛠️ 技术栈

### 前端
- **xterm.js** - VSCode 同款终端库
- **xterm-addon-fit** - 自适应大小
- **xterm-addon-search** - 搜索功能
- **xterm-addon-web-links** - 链接识别

### 后端
- **node-pty** - 伪终端支持（可选）
- **child_process** - 备选方案

## 📋 使用方法

### 1. 直接使用独立终端页面

```javascript
// 在主窗口中加载
mainWindow.loadFile('src/renderer/terminal-vscode.html');
```

### 2. 集成到现有应用

替换现有终端实现：

```javascript
// 在终端面板中使用 iframe
<iframe 
  src="terminal-vscode.html" 
  style="width: 100%; height: 100%; border: none;"
></iframe>
```

## 🎨 VSCode 主题配色

```javascript
theme: {
  background: '#1e1e1e',     // VSCode 深色背景
  foreground: '#cccccc',     // 默认文字颜色
  cursor: '#aeafad',         // 光标颜色
  selection: 'rgba(255, 255, 255, 0.3)',  // 选中颜色
  
  // ANSI 颜色完全匹配 VSCode
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  
  // 亮色版本
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
}
```

## ⚡ 功能特性

### 1. 真实 Shell
- macOS: 默认使用 zsh
- Windows: 使用 cmd.exe
- Linux: 使用 bash

### 2. 快捷键
- **Ctrl/Cmd + C** - 复制选中文本
- **Ctrl/Cmd + V** - 粘贴
- **Ctrl/Cmd + F** - 搜索
- **Ctrl + C** - 中断进程（无选中时）

### 3. 自动功能
- 窗口大小自适应
- 链接点击打开
- 平滑滚动
- 选词双击

### 4. Claude 集成
- 自动设置环境变量
- 配置 API Key 后自动启动 Claude
- 支持代理设置

## 🔧 配置选项

### 字体设置
```javascript
fontFamily: '"Cascadia Code", "SF Mono", Monaco, Menlo, Consolas, monospace',
fontSize: 14,
lineHeight: 1.2,
letterSpacing: 0
```

### 性能优化
```javascript
scrollback: 10000,          // 历史行数
smoothScrollDuration: 125,  // 平滑滚动时间
fastScrollModifier: 'alt'   // 快速滚动修饰键
```

## 📊 与原版对比

| 功能 | VSCode 终端 | 我们的实现 |
|------|------------|-----------|
| xterm.js | ✅ | ✅ |
| node-pty | ✅ | ✅ (可选) |
| 主题配色 | ✅ | ✅ (完全一致) |
| 快捷键 | ✅ | ✅ |
| 搜索 | ✅ | ✅ |
| 链接识别 | ✅ | ✅ |
| 分屏 | ✅ | ❌ (可扩展) |
| 终端配置 | ✅ | ✅ |

## 🚀 性能优化

1. **Canvas 渲染**
   - 使用 Canvas 而非 DOM
   - 大幅提升渲染性能

2. **延迟加载**
   - CDN 加载 xterm.js
   - 按需加载插件

3. **内存管理**
   - 限制滚动缓冲区
   - 自动清理旧数据

## 🐛 已知问题

1. **Windows 中文乱码**
   - 解决：设置正确的编码
   ```javascript
   process.stdout.setEncoding('utf8');
   ```

2. **node-pty 编译问题**
   - 备选：使用标准 spawn
   - 影响：无法完全模拟 TTY

## 🔮 扩展建议

1. **多标签支持**
   - 像 VSCode 一样支持多个终端标签

2. **分屏功能**
   - 水平/垂直分割终端

3. **主题系统**
   - 支持更多主题切换

4. **配置持久化**
   - 保存字体、颜色等设置

通过这个实现，用户可以获得与 VSCode 几乎一模一样的终端体验！