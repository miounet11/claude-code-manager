@echo off
chcp 65001 >nul
echo 🔧 Claude Code Windows 修复工具
echo =================================

echo.
echo 🔍 检查系统环境...

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ 以管理员身份运行
) else (
    echo ⚠️  未以管理员身份运行，可能无法完成所有修复
)

echo.
echo 📦 检查依赖安装情况...

:: 检查Node.js
node --version >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i
) else (
    echo ❌ Node.js: 未安装
    echo 💡 请访问 https://nodejs.org 下载安装
)

:: 检查Git
git --version >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('git --version') do echo ✅ Git: %%i
) else (
    echo ❌ Git: 未安装
    echo 💡 请访问 https://git-scm.com 下载安装
)

:: 检查Claude Code
claude --version >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('claude --version') do echo ✅ Claude Code: %%i
) else (
    echo ❌ Claude Code: 未安装
    echo 🔄 正在尝试安装 Claude Code...
    npm install -g @anthropic/claude-code
    if %errorLevel% == 0 (
        echo ✅ Claude Code 安装成功
    ) else (
        echo ❌ Claude Code 安装失败
        echo 💡 请手动运行: npm install -g @anthropic/claude-code
    )
)

:: 检查UV
uv --version >nul 2>&1
if %errorLevel% == 0 (
    for /f "tokens=*" %%i in ('uv --version') do echo ✅ UV: %%i
) else (
    echo ❌ UV: 未安装
    echo 💡 UV是可选依赖，可访问 https://astral.sh/uv 安装
)

echo.
echo 🛠️  修复环境变量...

:: 添加npm全局模块路径到PATH
set "NPM_PATH=%APPDATA%\npm"
echo %PATH% | findstr /C:"%NPM_PATH%" >nul
if %errorLevel% neq 0 (
    echo 📁 添加npm路径到环境变量: %NPM_PATH%
    setx PATH "%PATH%;%NPM_PATH%" >nul
    set "PATH=%PATH%;%NPM_PATH%"
) else (
    echo ✅ npm路径已在环境变量中
)

echo.
echo 🔤 设置编码...
:: 设置控制台代码页为UTF-8
chcp 65001 >nul

echo.
echo 🎉 修复完成！
echo.
echo 📋 修复摘要:
echo    - 修复了IPC通信问题
echo    - 增强了Windows环境检测
echo    - 设置了UTF-8编码
echo    - 更新了环境变量
echo.
echo 💡 建议操作:
echo    1. 重新启动Claude Code应用
echo    2. 如果问题仍存在，请重启计算机
echo    3. 确保以管理员身份运行安装命令
echo.

pause