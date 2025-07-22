#!/bin/bash

echo "🚀 快速安装 Miaoda 依赖"
echo "======================="

# 检查是否已安装 Electron
if [ -d "node_modules/electron" ]; then
    echo "✅ Electron 已安装"
    echo "🎯 启动应用..."
    npm start
else
    echo "📦 正在安装最小依赖..."
    
    # 只安装必需的依赖
    echo "安装 Electron..."
    npm install electron@28.0.0 --no-save --registry=https://registry.npmmirror.com
    
    echo "安装 electron-store..."
    npm install electron-store@8.1.0 --no-save --registry=https://registry.npmmirror.com
    
    echo ""
    echo "✅ 安装完成！"
    echo "🎯 启动应用..."
    npm start
fi