#!/bin/bash

echo "🛑 强制终止所有 Miaoda 相关进程..."

# 1. 杀死所有 Electron 相关进程
echo "正在终止 Electron 进程..."
pkill -9 -f "electron.*newcode" 2>/dev/null
pkill -9 -f "Electron.*miaoda" 2>/dev/null
pkill -9 -f "node.*newcode" 2>/dev/null

# 2. 杀死所有保活守护进程
echo "正在终止保活守护进程..."
pkill -9 -f "miaoda-guardian" 2>/dev/null
pkill -9 -f "miaoda-backup" 2>/dev/null
pkill -9 -f "miaoda-protector" 2>/dev/null

# 3. 清理所有临时文件
echo "清理临时文件..."
rm -f /var/folders/*/T/miaoda-guardian.sh 2>/dev/null
rm -f /var/folders/*/T/miaoda-*.sh 2>/dev/null
rm -f /tmp/miaoda-* 2>/dev/null

# 4. 清理应用数据中的锁文件
echo "清理锁文件..."
rm -rf "$HOME/Library/Application Support/miaoda/Singleton*" 2>/dev/null
rm -rf "$HOME/Library/Application Support/Electron/Singleton*" 2>/dev/null

# 5. 杀死所有 node-pty 进程
echo "终止 node-pty 进程..."
pkill -9 -f "zsh.*node-pty" 2>/dev/null

# 6. 等待一下
sleep 1

# 7. 再次强制杀死（确保彻底清理）
echo "二次清理..."
ps aux | grep -E "(miaoda|electron.*newcode|node.*newcode)" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# 8. 检查是否还有残留进程
remaining=$(ps aux | grep -E "(miaoda|electron.*newcode)" | grep -v grep | wc -l)
if [ $remaining -eq 0 ]; then
    echo "✅ 所有进程已清理完成！"
else
    echo "⚠️ 仍有 $remaining 个进程在运行"
    echo "残留进程："
    ps aux | grep -E "(miaoda|electron.*newcode)" | grep -v grep
fi

echo "
💡 如果进程仍在重启，请尝试：
1. 注销当前用户账号并重新登录
2. 或者重启电脑
"