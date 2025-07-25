# 真实终端集成实现

## 🎯 目标

将内置终端从模拟响应改为真实调用本地 Claude CLI，提供真正的 Claude 对话体验。

## 🔧 技术实现

### 1. 跨平台终端管理器

创建了 `TerminalManager` 类，统一处理 macOS 和 Windows 的差异：

```javascript
// src/main/terminal-manager.js
class TerminalManager {
  - 自动检测操作系统
  - Windows: 使用 cmd.exe
  - macOS/Linux: 使用默认 shell
  - 优先使用 node-pty（如果可用）
  - 退回到标准 spawn 方式
}
```

### 2. 主要功能

#### 启动 Claude CLI
- 设置环境变量（API Key、URL、代理）
- 创建子进程运行 `claude` 命令
- 实时捕获输出并发送到前端

#### 数据通信
- 用户输入 → 通过 IPC → 写入 Claude 进程
- Claude 输出 → 捕获 → 通过 IPC → 显示在终端

#### 进程管理
- 优雅关闭（发送 exit 命令）
- 强制终止（kill 进程）
- Windows 特殊处理（taskkill）

### 3. 平台差异处理

#### Windows
```javascript
// 启动命令
spawn('cmd', ['/c', 'claude'])

// 终止进程
spawn('taskkill', ['/F', '/PID', pid])
```

#### macOS/Linux
```javascript
// 直接启动
spawn('claude', [])

// 终止进程
process.kill(pid)
```

### 4. 前端集成

#### 原始输出处理
```javascript
// 保留终端原始格式
if (data.type === 'raw') {
  const rawDiv = document.createElement('div');
  rawDiv.style.whiteSpace = 'pre-wrap';
  rawDiv.textContent = data.text;
  output.appendChild(rawDiv);
}
```

#### 输入发送
```javascript
// 用户按 Enter 后
window.electronAPI.sendClaudeInput(text);
```

## 📋 使用流程

1. 用户点击"启动 Claude"
2. 系统检查配置（API Key 等）
3. 启动 Claude CLI 进程
4. 显示 Claude 的真实输出
5. 用户输入问题
6. 系统将输入发送给 Claude
7. 显示 Claude 的真实回复

## ⚡ 优势

1. **真实体验**：看到 Claude CLI 的原始输出
2. **实时交互**：无延迟的真实对话
3. **完整功能**：支持 Claude 的所有功能
4. **跨平台**：Windows 和 macOS 都能正常工作

## 🐛 已知问题和解决方案

### 1. Claude CLI 未安装
- 错误：`spawn claude ENOENT`
- 解决：引导用户安装 Claude CLI

### 2. API Key 未设置
- 错误：认证失败
- 解决：检查配置中的 API Key

### 3. 编码问题
- Windows 可能出现中文乱码
- 已设置 UTF-8 编码处理

### 4. node-pty 依赖
- 可选依赖，不可用时自动退回
- 提供更好的终端体验（如果可用）

## 🔮 后续优化

1. **ANSI 转义序列**
   - 支持彩色输出
   - 支持光标控制

2. **终端尺寸调整**
   - 动态调整列宽和行高
   - 响应窗口大小变化

3. **会话管理**
   - 保存对话历史
   - 恢复上次会话

4. **错误恢复**
   - 自动重连
   - 错误重试机制

## 📝 测试要点

1. **基本功能**
   - 启动 Claude
   - 发送消息
   - 接收回复
   - 停止 Claude

2. **跨平台**
   - macOS 测试
   - Windows 测试
   - 中文支持

3. **边界情况**
   - Claude 未安装
   - 网络断开
   - API 限额

通过这个真实终端集成，用户现在可以在 Miaoda 中获得与直接使用 Claude CLI 完全一样的体验！