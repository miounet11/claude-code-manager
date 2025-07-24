#!/bin/bash

echo "🔴 超级强制清理脚本"
echo "===================="

# 1. 先杀死所有守护进程
echo "步骤 1: 杀死所有守护进程..."
ps aux | grep -E "(miaoda-guardian|bash.*miaoda)" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# 2. 删除守护脚本文件（这样就无法重启了）
echo "步骤 2: 删除守护脚本..."
rm -f /var/folders/*/T/miaoda-guardian.sh 2>/dev/null
rm -f /var/folders/*/*/T/miaoda-guardian.sh 2>/dev/null
rm -f /tmp/miaoda-guardian.sh 2>/dev/null

# 3. 删除所有临时文件
echo "步骤 3: 删除临时文件..."
rm -f /var/folders/*/T/.miaoda* 2>/dev/null
rm -f /var/folders/*/*/T/.miaoda* 2>/dev/null
rm -f /var/folders/*/T/miaoda* 2>/dev/null
rm -f /var/folders/*/*/T/miaoda* 2>/dev/null
rm -f /tmp/miaoda* 2>/dev/null
rm -f /tmp/.miaoda* 2>/dev/null

# 4. 杀死所有 Electron 进程
echo "步骤 4: 杀死 Electron 进程..."
pkill -9 -f "Electron.*newcode" 2>/dev/null
pkill -9 -f "electron.*newcode" 2>/dev/null
pkill -9 -f "Miaoda" 2>/dev/null
pkill -9 -f "miaoda" 2>/dev/null

# 5. 清理应用支持目录
echo "步骤 5: 清理应用数据..."
rm -rf "$HOME/Library/Application Support/miaoda/Singleton*" 2>/dev/null
rm -rf "$HOME/Library/Application Support/Electron/Singleton*" 2>/dev/null
rm -f "$HOME/Library/Logs/miaoda*" 2>/dev/null

# 6. 清理启动项
echo "步骤 6: 清理启动项..."
rm -f "$HOME/Library/LaunchAgents/com.miaoda.*" 2>/dev/null
rm -f "/Library/LaunchDaemons/com.miaoda.*" 2>/dev/null

# 7. 再次强制杀死所有相关进程
echo "步骤 7: 最终清理..."
ps aux | grep -i miaoda | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# 8. 创建一个临时的禁用标记
echo "步骤 8: 创建禁用标记..."
touch /tmp/MIAODA_DISABLED

echo "
✅ 清理完成！

如果进程仍在重启，请：
1. 运行: sudo ./force-kill-all.sh (使用管理员权限)
2. 或者重启电脑

要安全地开发，使用：
./dev-safe.sh
"