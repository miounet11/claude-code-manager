#!/bin/bash

# Miaoda 构建和发布脚本
# 使用方法: ./scripts/build-release.sh [版本号]

set -e

VERSION=${1:-$(node -p "require('./package.json').version")}
echo "🚀 开始构建 Miaoda v$VERSION"

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  检测到未提交的更改，请先提交或暂存更改"
    exit 1
fi

# 确保依赖是最新的
echo "📦 安装依赖..."
npm ci

# 构建所有平台版本（在 macOS 上只构建 macOS 版本）
echo "🔨 构建 macOS 版本..."
npm run dist-mac

# 显示构建结果
echo "✅ 构建完成！"
echo ""
echo "📂 构建产物："
ls -la dist/*.dmg dist/*.zip 2>/dev/null || true

echo ""
echo "🎯 下一步："
echo "1. 检查构建产物是否正确"
echo "2. 运行: git tag v$VERSION"
echo "3. 运行: git push origin v$VERSION"
echo "4. GitHub Actions 将自动构建其他平台版本并创建 Release"
echo ""
echo "📖 发布说明文档: RELEASE_NOTES_v$VERSION.md"
echo "🔗 仓库地址: https://github.com/miounet11/claude-code-manager"