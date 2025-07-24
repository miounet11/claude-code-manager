@echo off
REM Miaoda 强制退出脚本 (Windows)
REM 用于在进程保护启用时强制结束应用

echo 🛑 Miaoda 强制退出脚本
echo ========================

REM 查找 Miaoda 进程
tasklist | findstr /i "Miaoda" >nul
if errorlevel 1 (
    echo ❌ 未找到 Miaoda 进程
    exit /b 1
)

echo 找到以下 Miaoda 进程:
tasklist | findstr /i "Miaoda"

echo.
echo 尝试正常终止进程...

REM 尝试正常终止
taskkill /IM Miaoda.exe /F >nul 2>&1

REM 等待1秒
timeout /t 1 /nobreak >nul

REM 检查进程是否还在运行
tasklist | findstr /i "Miaoda" >nul
if errorlevel 1 (
    echo ✅ 所有 Miaoda 进程已成功终止
) else (
    echo ⚠️ 部分进程仍在运行，尝试强制终止...
    
    REM 获取进程ID并强制终止
    for /f "tokens=2" %%i in ('tasklist ^| findstr /i "Miaoda"') do (
        echo 强制终止进程 %%i
        taskkill /PID %%i /F /T >nul 2>&1
    )
    
    echo ✅ 强制终止完成
)

REM 清理临时文件
echo.
echo 清理临时文件...
del /F /Q "%TEMP%\.miaoda_heartbeat" 2>nul
del /F /Q "%TEMP%\watchdog_*.js" 2>nul

echo ✅ 清理完成
pause