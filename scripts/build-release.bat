@echo off
REM Miaoda Windows 构建脚本
REM 用于在 Windows 系统上构建应用程序

echo ========================================
echo Miaoda Windows 版本构建脚本
echo ========================================
echo.

REM 检查 Node.js 是否安装
echo 检查 Node.js 环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 npm 是否可用
echo 检查 npm 环境...
npm --version >nul 2>&1
if errorlevel 1 (
    echo 错误: npm 不可用，请检查 Node.js 安装
    pause
    exit /b 1
)

echo Node.js 和 npm 环境检查通过
echo.

REM 清理旧的构建产物
echo 清理旧的构建产物...
if exist "dist" (
    rmdir /s /q "dist"
    echo 已清理 dist 目录
)

REM 安装依赖
echo 安装项目依赖...
call npm ci
if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)
echo 依赖安装完成
echo.

REM 构建 Windows 版本
echo 开始构建 Windows 版本...
echo 支持的架构: x64, ia32
echo 输出格式: NSIS 安装包, 便携版
echo.

call npm run dist-win
if errorlevel 1 (
    echo 错误: Windows 版本构建失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo Windows 版本构建完成！
echo ========================================
echo.

REM 显示构建产物
echo 构建产物位置: dist\
if exist "dist" (
    echo.
    echo 生成的文件:
    dir /b "dist\*.exe" 2>nul
    dir /b "dist\*.zip" 2>nul
    echo.
)

echo 构建完成，可以在 dist 目录找到安装包
echo 按任意键退出...
pause >nul