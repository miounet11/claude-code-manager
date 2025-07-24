# Windows 部署修复指南

## 问题概述

Win版本Claude Code存在以下问题：
1. **IPC通信错误**: `Error invoking remote method 'check-environment': Error: No handler registered for 'check-environment'`
2. **环境检验失效**: Windows下环境检测功能无法正常工作
3. **代理失效**: 代理配置在Windows环境下不生效

## 解决方案

### 🔧 自动修复

#### 方式一：PowerShell脚本（推荐）
```powershell
# 以管理员身份运行PowerShell，然后执行：
.\scripts\windows-fix.ps1 -All
```

#### 方式二：批处理文件
```cmd
# 以管理员身份运行cmd，然后执行：
.\scripts\windows-fix.bat
```

### 🛠️ 手动修复

#### 1. 修复IPC通信问题
问题：主进程中缺少`check-environment`处理器注册

**已修复的文件：**
- `src/main/index.js` - 添加了缺失的IPC处理器

```javascript
// 环境检查 - 修复缺失的IPC处理器
ipcMain.handle('check-environment', async () => {
  try {
    console.log('收到环境检查请求...');
    const { checkEnvironment } = require('./environment');
    const result = await checkEnvironment();
    console.log('环境检查完成，返回结果:', result);
    return result;
  } catch (error) {
    console.error('环境检查失败:', error);
    return { 
      error: error.message,
      nodejs: { installed: false, error: '检查失败' },
      git: { installed: false, error: '检查失败' },
      uv: { installed: false, error: '检查失败' },
      claude: { installed: false, error: '检查失败' }
    };
  }
});
```

#### 2. 增强Windows环境检测
问题：Windows下命令检测逻辑不完善，存在编码和权限问题

**已修复的文件：**
- `src/main/environment.js` - 改进了Windows兼容性

**主要改进：**
- 智能命令检测（自动添加.exe扩展名）
- 增加超时时间到10秒
- 处理编码问题（设置UTF-8环境变量）
- 更好的错误处理和权限检测
- 支持权限不足和超时的具体错误信息

#### 3. 修复Claude启动问题
问题：Windows下启动命令不兼容，存在编码问题

**已修复的文件：**
- `src/main/claude-runner.js` - 改进了Windows启动逻辑

**主要改进：**
- 优先使用PowerShell而非cmd（更好的Unicode支持）
- 改进的命令检测逻辑
- 设置UTF-8编码页
- 更详细的错误提示和安装指导

## 🚀 部署流程

### 开发环境部署
1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd claude-code
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **运行修复脚本**
   ```powershell
   # PowerShell（推荐）
   .\scripts\windows-fix.ps1 -All
   
   # 或批处理
   .\scripts\windows-fix.bat
   ```

4. **启动应用**
   ```bash
   npm start
   ```

### 生产环境部署
1. **构建应用**
   ```bash
   npm run build:win
   ```

2. **创建安装包**
   ```bash
   npm run dist:win
   ```

3. **分发修复脚本**
   - 将`scripts/windows-fix.bat`包含在安装包中
   - 在安装后自动运行修复脚本

## 🔍 问题排查

### 常见问题及解决方案

#### 问题1：环境检查超时
**症状：** 检查环境时显示"检查超时，可能需要管理员权限"
**解决：**
1. 以管理员身份运行应用
2. 检查Windows Defender是否阻止了命令执行
3. 确保PATH环境变量正确设置

#### 问题2：Claude Code未找到
**症状：** 显示"Claude Code 未安装或不在系统路径中"
**解决：**
1. 安装Claude Code：`npm install -g @anthropic/claude-code`
2. 检查npm全局安装路径：`npm config get prefix`
3. 将npm全局路径添加到系统PATH

#### 问题3：编码问题
**症状：** 输出显示乱码或问号
**解决：**
1. 设置控制台编码：`chcp 65001`
2. 使用PowerShell代替cmd
3. 设置环境变量：`set LANG=en_US.UTF-8`

#### 问题4：权限问题
**症状：** "Access is denied" 或 "权限不足"
**解决：**
1. 以管理员身份运行PowerShell/cmd
2. 检查执行策略：`Get-ExecutionPolicy`
3. 如需要，设置执行策略：`Set-ExecutionPolicy RemoteSigned`

## 📋 环境要求

### 最低要求
- Windows 10 或更高版本
- Node.js 16.x 或更高版本
- PowerShell 5.1 或更高版本

### 推荐配置
- Windows 11
- Node.js 18.x LTS
- PowerShell 7.x
- 管理员权限

## 🧪 测试验证

### 功能测试清单
- [ ] 环境检查功能正常
- [ ] Node.js检测正确
- [ ] Git检测正确
- [ ] Claude Code检测正确
- [ ] UV检测正确（可选）
- [ ] Claude Code启动成功
- [ ] 终端显示正常（无乱码）
- [ ] 配置保存和加载正常

### 测试脚本
```powershell
# 运行完整测试
.\scripts\windows-fix.ps1 -CheckEnvironment
```

## 📞 技术支持

如果修复脚本无法解决问题，请提供以下信息：
1. Windows版本信息
2. Node.js版本
3. 错误日志和截图
4. 执行`.\scripts\windows-fix.ps1 -CheckEnvironment`的输出

## 🔄 更新日志

### v1.0.0 (2025-01-23)
- 修复IPC通信问题
- 增强Windows环境检测
- 改进Claude启动逻辑
- 添加自动修复脚本
- 完善错误处理和用户提示

---

## 📝 开发者注意事项

### 代码修改摘要
1. **src/main/index.js**: 添加`check-environment` IPC处理器
2. **src/main/environment.js**: 增强Windows命令检测逻辑
3. **src/main/claude-runner.js**: 改进Windows启动命令
4. **scripts/**: 添加Windows修复脚本

### 测试覆盖
- Windows 10/11兼容性测试
- PowerShell/cmd兼容性测试
- 不同Node.js版本兼容性测试
- 权限相关功能测试

### 未来改进
- [ ] 集成自动更新机制
- [ ] 添加更详细的日志系统
- [ ] 支持更多终端类型
- [ ] 改进代理配置检测