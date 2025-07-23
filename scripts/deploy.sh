#!/bin/bash

# Miaoda 快速部署脚本
# 提供多种部署选项的统一入口

set -e

echo "🚀 Miaoda 部署工具"
echo "=================="
echo

# 显示当前版本
VERSION=$(node -p "require('./package.json').version")
echo "当前版本: v$VERSION"
echo "当前平台: $(uname -s)"
echo

# 显示菜单
echo "请选择部署方式:"
echo "1) 🔍 验证构建配置"
echo "2) 🏗️  本地构建当前平台"
echo "3) 🌍 本地构建所有平台"
echo "4) 🪟 验证 Windows 构建配置"
echo "5) 🏷️  创建版本标签并触发自动构建"
echo "6) 📋 显示构建状态"
echo "7) 🧹 清理构建产物"
echo "0) 退出"
echo

read -p "请输入选择 (0-7): " choice

case $choice in
    1)
        echo "🔍 验证构建配置..."
        echo "检查 package.json 配置..."
        node -e "
            const pkg = require('./package.json');
            console.log('✅ 应用名称:', pkg.build.productName);
            console.log('✅ 版本:', pkg.version);
            console.log('✅ Windows 配置:', pkg.build.win ? '存在' : '缺失');
            console.log('✅ macOS 配置:', pkg.build.mac ? '存在' : '缺失');
            console.log('✅ Linux 配置:', pkg.build.linux ? '存在' : '缺失');
        "
        
        echo "检查资源文件..."
        for file in "assets/icon.ico" "assets/icon.icns" "assets/icon.png"; do
            if [ -f "$file" ]; then
                echo "✅ $file"
            else
                echo "❌ $file (缺失)"
            fi
        done
        ;;
        
    2)
        echo "🏗️ 本地构建当前平台..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "检测到 macOS，构建 macOS 版本..."
            npm run dist-mac
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "检测到 Linux，构建 Linux 版本..."
            npm run build -- --linux
        elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            echo "检测到 Windows，构建 Windows 版本..."
            npm run dist-win
        else
            echo "⚠️ 未识别的系统类型: $OSTYPE"
        fi
        ;;
        
    3)
        echo "🌍 本地构建所有平台..."
        echo "⚠️ 注意: Windows 版本在非 Windows 系统上可能构建失败"
        npm run dist-all
        ;;
        
    4)
        echo "🪟 验证 Windows 构建配置..."
        if [ -f "scripts/validate-win-build.js" ]; then
            node scripts/validate-win-build.js
        else
            echo "❌ 验证脚本不存在"
        fi
        ;;
        
    5)
        echo "🏷️ 创建版本标签..."
        echo "当前版本: v$VERSION"
        read -p "确认创建标签 v$VERSION 并推送? (y/N): " confirm
        
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo "创建标签..."
            git tag "v$VERSION"
            
            echo "推送标签..."
            git push origin "v$VERSION"
            
            echo "✅ 标签已推送，GitHub Actions 将自动开始构建"
            echo "🔗 查看构建状态: https://github.com/miounet11/claude-code-manager/actions"
        else
            echo "已取消"
        fi
        ;;
        
    6)
        echo "📋 显示构建状态..."
        if [ -d "dist" ]; then
            echo "构建产物目录存在:"
            ls -la dist/
            echo
            echo "文件大小:"
            du -h dist/* 2>/dev/null || echo "无构建产物"
        else
            echo "无构建产物目录"
        fi
        
        echo
        echo "最近的 Git 标签:"
        git tag --sort=-creatordate | head -5 || echo "无标签"
        ;;
        
    7)
        echo "🧹 清理构建产物..."
        if [ -d "dist" ]; then
            rm -rf dist
            echo "✅ 已清理 dist 目录"
        else
            echo "dist 目录不存在"
        fi
        
        if [ -d "node_modules/.cache" ]; then
            rm -rf node_modules/.cache
            echo "✅ 已清理缓存"
        fi
        ;;
        
    0)
        echo "👋 再见!"
        exit 0
        ;;
        
    *)
        echo "❌ 无效选择: $choice"
        exit 1
        ;;
esac

echo
echo "✅ 操作完成"
echo
echo "💡 提示:"
echo "- 使用 GitHub Actions 进行跨平台构建"
echo "- Windows 版本需要在 Windows 环境或 CI 中构建"
echo "- 查看详细文档: docs/DEPLOYMENT_GUIDE.md"