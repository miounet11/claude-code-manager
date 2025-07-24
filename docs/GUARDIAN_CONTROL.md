# 保活机制环境控制指南

## 概述

本文档说明如何在开发和生产环境中控制应用的保活机制。保活机制包括进程守护、自动重启、崩溃恢复等功能。

## 环境模式

### 🐛 开发模式 (Development Mode)
- **特点**: 所有保活机制被禁用
- **适用场景**: 日常开发、调试、测试
- **行为**: 
  - 进程保护关闭
  - 自动重启关闭
  - 防卸载保护关闭
  - 可以正常使用 Cmd+Q (Mac) 或 Alt+F4 (Windows) 退出

### 🚀 生产模式 (Production Mode)
- **特点**: 所有保活机制被激活
- **适用场景**: 最终用户部署、生产环境
- **行为**:
  - 进程保护开启
  - 自动重启开启
  - 防卸载保护启用
  - 系统级守护进程运行

## 使用方法

### 1. npm scripts 方式 (推荐)

```bash
# 开发模式运行
npm run dev

# 生产模式运行  
npm run prod

# 检查当前状态
npm run guardian:status

# 手动切换到开发模式
npm run guardian:dev

# 手动切换到生产模式
npm run guardian:prod
```

### 2. 直接使用脚本

```bash
# 切换到开发模式
node scripts/guardian-control.js dev

# 切换到生产模式
node scripts/guardian-control.js prod

# 检查当前状态
node scripts/guardian-control.js status
```

### 3. 打包构建

所有构建命令都会自动确保生产模式配置：

```bash
# 构建所有平台
npm run build

# 构建 macOS 版本
npm run dist-mac

# 构建 Windows 版本
npm run dist-win

# 构建 Linux 版本
npm run dist-linux
```

## 工作流程建议

### 开发阶段
1. 克隆代码后，首次运行：
   ```bash
   npm run dev
   ```

2. 日常开发时始终使用开发模式：
   ```bash
   npm run dev
   ```

3. 检查当前环境状态：
   ```bash
   npm run guardian:status
   ```

### 发布阶段
1. 打包前会自动切换到生产模式：
   ```bash
   npm run dist-mac  # 自动执行 prebuild
   ```

2. 打包完成后，切换回开发模式继续开发：
   ```bash
   npm run guardian:dev
   ```

## 环境检测机制

应用使用多层检测机制判断当前环境：

1. **禁用标记文件**: `/tmp/MIAODA_DISABLED`
2. **环境变量**: `NODE_ENV`
3. **命令行参数**: `--dev`, `--debug`
4. **LaunchAgent 状态**: macOS 自启动服务状态

## 状态检查

使用以下命令可以查看详细的环境状态：

```bash
npm run guardian:status
```

输出示例：
```
📊 检查保活机制状态...

当前模式: 🔧 开发模式
禁用标记: ✅ 存在

LaunchAgent 状态:
  com.miaoda.autostart.plist: 🔒 禁用
  com.miaoda.guardian.plist: 🔒 禁用

守护脚本: 🔒 禁用
相关进程: 0 个
```

## 故障排除

### 问题：应用在开发时不能正常退出
**解决方案**: 确保已切换到开发模式
```bash
npm run guardian:dev
```

### 问题：打包后的应用没有保活功能
**解决方案**: 确保使用了正确的构建命令
```bash
npm run dist-mac  # 而不是直接使用 electron-builder
```

### 问题：状态检查显示异常
**解决方案**: 手动重置环境
```bash
# 强制切换到开发模式
npm run guardian:dev
# 或强制切换到生产模式
npm run guardian:prod
```

## 文件结构

```
scripts/
├── guardian-control.js    # 环境控制主脚本
└── prebuild.js           # 打包前准备脚本

src/main/
├── index.js              # 主进程（包含环境判断逻辑）
├── process-guardian.js   # 进程守护模块
├── process-protection.js # 进程保护模块
└── crash-recovery.js     # 崩溃恢复模块
```

## 技术细节

### 开发模式触发条件
以下任一条件满足即进入开发模式：
- `NODE_ENV=development`
- 命令行包含 `--dev` 或 `--debug`
- 存在 `/tmp/MIAODA_DISABLED` 文件

### 生产模式触发条件
需要同时满足以下条件：
- `NODE_ENV=production`
- 不存在 `/tmp/MIAODA_DISABLED` 文件
- 未使用开发相关的命令行参数

### 保活组件
- **LaunchAgent**: macOS 系统级自启动服务
- **Guardian Script**: Shell 脚本守护进程
- **Process Protection**: 进程优先级和隐藏保护
- **Crash Recovery**: 应用崩溃后自动恢复

## 安全注意事项

1. **开发环境隔离**: 开发时保活机制被完全禁用，不会对系统造成干扰
2. **文件保护**: 配置文件只是重命名而非删除，可以安全恢复
3. **权限管理**: 只在必要时请求管理员权限
4. **清理机制**: 提供完整的清理和恢复功能

## 贡献指南

修改保活相关功能时，请确保：
1. 在两种模式下都进行测试
2. 更新相关文档
3. 保持向后兼容性
4. 添加适当的错误处理