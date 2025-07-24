# 🚀 Windows 快速启动指南

## 问题症状

如果您在Windows系统下遇到以下任一问题：

❌ **错误信息：** `Error invoking remote method 'check-environment': Error: No handler registered for 'check-environment'`

❌ **环境检验失效：** 点击"检查环境"按钮无响应或报错

❌ **代理失效：** 代理配置无法正常工作

## 🔧 一键修复

### 步骤1：下载并运行修复脚本

**方式A：使用批处理文件（推荐新手）**
1. 右键点击 `scripts/windows-fix.bat`
2. 选择"以管理员身份运行"
3. 等待修复完成

**方式B：使用PowerShell脚本（推荐）**
1. 右键点击开始菜单，选择"Windows PowerShell (管理员)"
2. 导航到项目目录
3. 执行：`.\scripts\windows-fix.ps1 -All`

### 步骤2：重启应用
修复完成后，重新启动Claude Code应用即可。

## 📋 修复内容

✅ **IPC通信修复** - 解决环境检查功能无响应问题

✅ **环境检测增强** - 改进Windows下的命令检测逻辑

✅ **编码优化** - 修复中文显示乱码问题

✅ **启动优化** - 改进Claude Code启动机制

✅ **权限处理** - 优化管理员权限相关功能

## 🆘 如果修复失败

### 手动检查清单

1. **确认Node.js安装**
   ```cmd
   node --version
   ```

2. **确认Claude Code安装**
   ```cmd
   claude --version
   ```
   如果未安装：`npm install -g @anthropic/claude-code`

3. **检查环境变量PATH**
   确保 `%APPDATA%\npm` 在系统PATH中

4. **以管理员身份运行**
   确保以管理员权限运行所有命令

### 联系支持

如果问题仍然存在，请提供：
- Windows版本信息
- Node.js版本
- 错误截图
- 修复脚本的输出日志

---

**🎉 修复完成后，您的Claude Code将完美运行在Windows系统上！**