#!/bin/bash

# Miaoda 强制退出脚本
# 用于在进程保护启用时强制结束应用

echo "🛑 Miaoda 强制退出脚本"
echo "========================"

# 查找 Miaoda 进程
PIDS=$(pgrep -f "Miaoda|miaoda")

if [ -z "$PIDS" ]; then
    echo "❌ 未找到 Miaoda 进程"
    exit 1
fi

echo "找到以下 Miaoda 进程:"
ps aux | grep -E "Miaoda|miaoda" | grep -v grep

echo ""
echo "尝试发送 SIGUSR2 信号（调试终止信号）..."

# 对每个进程发送 SIGUSR2
for PID in $PIDS; do
    echo "发送 SIGUSR2 到进程 $PID"
    kill -USR2 $PID 2>/dev/null
done

# 等待1秒
sleep 1

# 检查进程是否还在运行
REMAINING_PIDS=$(pgrep -f "Miaoda|miaoda")

if [ -z "$REMAINING_PIDS" ]; then
    echo "✅ 所有 Miaoda 进程已成功终止"
else
    echo "⚠️ 部分进程仍在运行，尝试强制终止..."
    
    # 强制杀死剩余进程
    for PID in $REMAINING_PIDS; do
        echo "强制终止进程 $PID"
        kill -9 $PID 2>/dev/null
    done
    
    echo "✅ 强制终止完成"
fi

# 清理临时文件
echo ""
echo "清理临时文件..."
rm -f /tmp/.miaoda_heartbeat 2>/dev/null
rm -f /tmp/watchdog_*.js 2>/dev/null

echo "✅ 清理完成"