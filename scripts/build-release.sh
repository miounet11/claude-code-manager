#!/bin/bash

# Miaoda 跨平台构建脚本
# 支持 macOS, Linux 系统构建所有平台版本

set -e  # 遇到错误时退出

echo "========================================"
echo "Miaoda 跨平台构建脚本"
echo "========================================"
echo

# 检查 Node.js 环境
echo "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js"
    echo "安装方法:"
    echo "  macOS: brew install node"
    echo "  Ubuntu: sudo apt install nodejs npm"
    echo "  或访问: https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "错误: npm 不可用，请检查 Node.js 安装"
    exit 1
fi

echo "Node.js 版本: $(node --version)"
echo "npm 版本: $(npm --version)"
echo "环境检查通过"
echo

# 显示当前系统信息
echo "当前系统: $(uname -s)"
echo "架构: $(uname -m)"
echo

# 清理旧的构建产物
echo "清理旧的构建产物..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "已清理 dist 目录"
fi

# 安装依赖
echo "安装项目依赖..."
npm ci
echo "依赖安装完成"
echo

# 构建选项
echo "可选择的构建目标:"
echo "  1) 仅构建当前平台"
echo "  2) 构建所有平台 (macOS, Windows, Linux)"
echo "  3) 仅构建 Windows 版本"
echo "  4) 仅构建 macOS 版本"
echo "  5) 仅构建 Linux 版本"
echo

# 如果有参数，直接使用；否则提示用户选择
if [ $# -eq 0 ]; then
    read -p "请选择构建目标 (1-5): " choice
else
    choice=$1
fi

case $choice in
    1)
        echo "构建当前平台版本..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            npm run dist-mac
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            npm run build -- --linux
        else
            echo "不支持的系统类型: $OSTYPE"
            exit 1
        fi
        ;;
    2)
        echo "构建所有平台版本..."
        echo "注意: Windows 版本需要在 Windows 系统或 CI 环境中构建"
        npm run dist-all
        ;;
    3)
        echo "构建 Windows 版本..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "警告: 在 macOS 上无法构建 Windows 版本"
            echo "建议在 Windows 系统或 GitHub Actions 中构建"
            exit 1
        fi
        npm run dist-win
        ;;
    4)
        echo "构建 macOS 版本..."
        npm run dist-mac
        ;;
    5)
        echo "构建 Linux 版本..."
        npm run build -- --linux
        ;;
    *)
        echo "无效的选择: $choice"
        exit 1
        ;;
esac

echo
echo "========================================"
echo "构建完成！"
echo "========================================"
echo

# 显示构建产物
if [ -d "dist" ]; then
    echo "构建产物位置: dist/"
    echo
    echo "生成的文件:"
    ls -la dist/ | grep -E '\.(dmg|zip|exe|AppImage|deb)$' || echo "未找到构建产物"
    echo
    
    # 计算文件大小
    echo "文件大小统计:"
    du -h dist/* 2>/dev/null || echo "无法计算文件大小"
    echo
fi

echo "构建完成！可以在 dist 目录找到安装包"

# 如果是在 CI 环境中，输出更多信息
if [ "$CI" = "true" ]; then
    echo
    echo "CI 环境检测到，输出详细信息:"
    echo "工作目录: $(pwd)"
    echo "构建时间: $(date)"
    echo "Git 提交: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
fi