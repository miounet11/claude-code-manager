#!/bin/bash

echo "开始构建 Miaoda 多平台版本..."

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist

# macOS 构建
echo "构建 macOS 版本..."
npm run dist-mac

# Windows 构建（需要在 macOS 上安装 wine）
echo "构建 Windows 版本..."
# npm run build -- --win

echo "构建完成！"
echo "输出文件在 dist 目录"

# 列出所有生成的文件
echo ""
echo "生成的文件："
ls -la dist/