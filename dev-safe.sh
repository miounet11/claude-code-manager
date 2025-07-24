#!/bin/bash

echo "🚀 安全开发模式启动脚本"
echo "========================"

# 1. 先执行超级清理
echo "执行超级清理..."
./force-kill-all.sh

# 2. 确保禁用标记存在
echo "创建禁用标记..."
touch /tmp/MIAODA_DISABLED

# 3. 等待一下确保所有进程都停止了
echo "等待进程停止..."
sleep 2

# 4. 删除禁用标记（这样应用可以启动）
echo "删除禁用标记，准备启动..."
rm -f /tmp/MIAODA_DISABLED

# 5. 设置环境变量，完全禁用保活机制
export NODE_ENV=development
export DISABLE_GUARDIAN=true
export DISABLE_PROTECTION=true
export DISABLE_CRASH_RECOVERY=true

echo "
🛡️ 安全模式已启用：
- 保活机制：已禁用
- 进程保护：已禁用
- 崩溃恢复：已禁用
- 快速退出：Cmd+Shift+Q
"

# 6. 启动应用
echo "启动应用..."
npm run dev