#!/bin/bash

echo "启动 Miaoda 开发模式..."
echo "清理可能的缓存..."

# 清理 Electron 缓存
rm -rf ~/.electron
rm -rf ~/Library/Caches/electron

# 设置环境变量以显示更多调试信息
export ELECTRON_ENABLE_LOGGING=1
export NODE_ENV=development

# 启动应用
echo "启动应用..."
npm run dev