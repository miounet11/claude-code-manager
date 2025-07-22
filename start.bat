@echo off
REM Miaoda 启动脚本 (Windows)

echo.
echo 🚀 启动 Miaoda - Claude Code Manager
echo ==================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js
    echo 请先安装 Node.js 16 或更高版本
    echo 访问 https://nodejs.org 下载安装
    pause
    exit /b 1
)

REM 显示 Node.js 版本
echo ✅ Node.js 版本:
node -v
echo.

REM 检查依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    
    if %errorlevel% neq 0 (
        echo ❌ 错误: 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖已安装
)

REM 启动应用
echo.
echo 🎯 正在启动 Miaoda...
echo ==================================
call npm start

pause