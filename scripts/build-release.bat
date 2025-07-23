@echo off
REM Miaoda Windows 构建脚本
REM 使用方法: scripts\build-release.bat

echo 🚀 开始构建 Miaoda Windows 版本

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 npm 是否可用
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 npm
    pause
    exit /b 1
)

echo 📦 安装依赖...
call npm ci
if errorlevel 1 (
    echo ❌ 安装依赖失败
    pause
    exit /b 1
)

echo 🔨 构建 Windows 版本...
call npm run dist-win
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo ✅ 构建完成！
echo.
echo 📂 构建产物：
dir dist\*.exe dist\*.zip 2>nul

echo.
echo 🎯 下一步：
echo 1. 检查 dist 目录中的构建产物
echo 2. 创建 Git 标签并推送以触发自动发布
echo 3. 访问 GitHub Actions 查看构建状态
echo.
echo 📖 发布说明文档: RELEASE_NOTES_v2.0.5.md
echo 🔗 仓库地址: https://github.com/miounet11/claude-code-manager

pause