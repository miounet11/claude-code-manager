# Miaoda 驱动级保活机制部署指南

## 概述

Miaoda 现已集成强大的驱动级保活机制，确保应用程序在各种情况下都能保持稳定运行。该系统包含多重保护机制，模仿360等安全软件的保活策略。

## 功能特性

### 🛡️ 核心保活功能

- **进程守护系统** - 实时监控主进程，异常时自动重启
- **强制开机启动** - 多重启动机制确保开机自动运行
- **防卸载保护** - 360式多次挽留机制，防止恶意卸载
- **智能端口管理** - 自动分配可用端口，避免冲突
- **系统级权限管理** - 自动请求和管理管理员权限
- **系统托盘隐藏** - 最小化到系统托盘，隐藏运行
- **备份进程机制** - 启动多个备份进程，确保高可用性

### 🔒 保护级别

1. **最低保护** - 基础保护，不影响正常使用
2. **中等保护** - 平衡保护与性能
3. **最高保护** - 最强保护，防止一切卸载尝试

## 系统要求

### macOS
- macOS 10.14 或更高版本
- 管理员权限（可选，但推荐）
- 至少 100MB 可用磁盘空间

### Windows
- Windows 10 或更高版本
- 管理员权限（可选，但推荐）
- 至少 100MB 可用磁盘空间

### Linux
- Ubuntu 18.04 或更高版本（或其他主流发行版）
- sudo 权限
- 图形界面环境

## 安装部署

### 1. 标准安装

```bash
# 下载最新版本
curl -O https://github.com/miaoda-ai/miaoda/releases/latest/download/Miaoda-latest.dmg

# macOS 安装
open Miaoda-latest.dmg

# Windows 安装
./Miaoda-Setup.exe

# Linux 安装
sudo dpkg -i Miaoda-latest.deb
```

### 2. 启用保活机制

启动应用后，保活机制会自动初始化。如需手动启用：

1. 打开 Miaoda 应用
2. 在保活机制控制面板中点击"启用保活机制"
3. 根据提示授予管理员权限
4. 选择合适的保护级别

### 3. 权限配置

#### macOS 权限配置

```bash
# 授予完全磁盘访问权限
# 系统偏好设置 -> 安全性与隐私 -> 隐私 -> 完全磁盘访问权限
# 添加 Miaoda.app

# 授予辅助功能权限
# 系统偏好设置 -> 安全性与隐私 -> 隐私 -> 辅助功能
# 添加 Miaoda.app
```

#### Windows 权限配置

```batch
# 以管理员身份运行 PowerShell
# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 添加防火墙例外
New-NetFirewallRule -DisplayName "Miaoda" -Direction Inbound -Protocol TCP -LocalPort 8082-8086 -Action Allow
```

#### Linux 权限配置

```bash
# 添加用户到必要的组
sudo usermod -a -G sudo $USER

# 设置 systemd 服务权限
sudo systemctl daemon-reload
sudo systemctl enable miaoda-guardian
```

## 配置选项

### 环境变量

```bash
# 设置保护级别
MIAODA_PROTECTION_LEVEL=maximum  # minimum, moderate, maximum

# 设置端口范围
MIAODA_PORT_START=8082
MIAODA_PORT_END=8086

# 启用调试模式
MIAODA_DEBUG=true

# 设置日志级别
MIAODA_LOG_LEVEL=info  # error, warn, info, debug

# 禁用系统托盘
MIAODA_DISABLE_TRAY=false
```

### 配置文件

创建 `~/.miaoda/config.json`：

```json
{
  "guardian": {
    "enabled": true,
    "protectionLevel": "maximum",
    "autoStart": true,
    "systemTray": true,
    "backupProcesses": 2,
    "heartbeatInterval": 3000,
    "maxUninstallAttempts": 5
  },
  "ports": {
    "preferred": [8082, 8083, 8084, 8085, 8086],
    "autoDetect": true
  },
  "privileges": {
    "requestElevation": true,
    "remindInterval": 600000
  },
  "logging": {
    "level": "info",
    "file": "~/.miaoda/logs/guardian.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## 运行模式

### 1. 标准模式

正常启动，完整的保活机制：

```bash
./Miaoda
```

### 2. 备份模式

作为备份进程运行：

```bash
./Miaoda --backup-mode --backup-id=1
```

### 3. 提升权限模式

以管理员权限运行：

```bash
# macOS/Linux
sudo ./Miaoda --elevated

# Windows
# 右键 -> 以管理员身份运行
```

### 4. 调试模式

启用详细日志输出：

```bash
./Miaoda --dev --debug
```

## 监控和维护

### 查看运行状态

```bash
# 查看进程状态
ps aux | grep Miaoda

# 查看守护进程状态 (macOS)
launchctl list | grep com.miaoda

# 查看系统服务状态 (Linux)
systemctl status miaoda-guardian

# 查看任务计划状态 (Windows)
schtasks /query /tn "MiaodaAutoStart"
```

### 日志文件位置

- **macOS**: `~/Library/Logs/miaoda-guardian.log`
- **Windows**: `%TEMP%\miaoda-guardian.log`
- **Linux**: `~/.miaoda/logs/guardian.log`

### 性能监控

```bash
# 查看内存使用情况
top -p $(pgrep Miaoda)

# 查看网络连接
netstat -an | grep 808[2-6]

# 查看文件描述符使用
lsof -p $(pgrep Miaoda)
```

## 故障排除

### 常见问题

#### 1. 保活机制启动失败

**症状**: 显示"保活机制系统启动失败"

**解决方案**:
```bash
# 检查权限
ls -la ~/.miaoda/

# 重新授予权限
chmod -R 755 ~/.miaoda/

# 重启应用
pkill Miaoda && ./Miaoda
```

#### 2. 端口冲突

**症状**: 无法分配端口

**解决方案**:
```bash
# 查看端口占用
netstat -an | grep 8082

# 释放端口
sudo lsof -ti:8082 | xargs kill -9

# 修改端口配置
export MIAODA_PORT_START=9000
```

#### 3. 权限被拒绝

**症状**: "需要管理员权限才能启用保活机制"

**解决方案**:
```bash
# macOS
sudo ./Miaoda

# Linux
sudo -E ./Miaoda

# Windows - 以管理员身份运行命令提示符
runas /user:Administrator ./Miaoda.exe
```

#### 4. 卸载保护过于激进

**症状**: 无法正常卸载应用

**解决方案**:
```bash
# 临时禁用保护
export MIAODA_PROTECTION_LEVEL=minimum

# 或通过界面设置为最低保护级别
# 然后进行正常卸载流程
```

### 清理和卸载

#### 完全卸载步骤

1. **设置最低保护级别**
   - 打开应用设置
   - 将保护级别设置为"最低保护"
   - 等待 30 秒

2. **停用保活机制**
   ```bash
   # macOS
   launchctl unload ~/Library/LaunchAgents/com.miaoda.guardian.plist
   launchctl unload ~/Library/LaunchAgents/com.miaoda.autostart.plist
   
   # Linux
   sudo systemctl stop miaoda-guardian
   sudo systemctl disable miaoda-guardian
   
   # Windows
   schtasks /delete /tn "MiaodaAutoStart" /f
   ```

3. **删除应用文件**
   ```bash
   # macOS
   rm -rf /Applications/Miaoda.app
   rm -rf ~/Library/LaunchAgents/com.miaoda.*
   rm -rf ~/Library/Logs/miaoda*
   
   # Linux
   sudo apt remove miaoda
   rm -rf ~/.miaoda
   
   # Windows
   # 使用控制面板卸载程序
   ```

4. **清理注册表** (仅 Windows)
   ```batch
   reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Miaoda" /f
   reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "Miaoda" /f
   ```

## 安全考虑

### 数据保护

- 所有配置文件都经过加密存储
- API 密钥使用系统密钥链保护
- 日志文件不包含敏感信息

### 网络安全

- 仅使用本地端口进行通信
- 支持 HTTPS 连接
- 自动检测和阻止可疑连接

### 权限最小化

- 仅在必要时请求管理员权限
- 支持受限模式运行
- 用户可完全控制权限级别

## 技术支持

### 联系方式

- GitHub Issues: https://github.com/miaoda-ai/miaoda/issues
- 官方网站: https://miaoda.ai
- 邮件支持: support@miaoda.ai

### 问题报告

提交 bug 报告时请包含：

1. 操作系统版本
2. Miaoda 版本号
3. 错误日志文件
4. 复现步骤
5. 系统配置信息

### 贡献指南

欢迎贡献代码和文档：

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 发起 Pull Request

## 更新日志

### v2.0.4 (2025-01-23)

- ✅ 新增驱动级保活机制
- ✅ 实现360式防卸载保护
- ✅ 添加智能端口管理
- ✅ 支持系统托盘隐藏运行
- ✅ 增强权限管理系统
- ✅ 优化内存使用和性能

### 即将发布

- 🔄 云端配置同步
- 🔄 高级监控仪表板
- 🔄 插件系统支持
- 🔄 多语言界面

---

*本文档将持续更新，请关注最新版本。*