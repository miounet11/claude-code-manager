#!/bin/bash

# Docker Windows 构建解决方案
# 在本机使用 Docker 容器构建 Windows 版本

echo "🐳 Docker Windows 构建解决方案"
echo "================================"
echo

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker"
    echo "请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    echo "❌ 错误: Docker 未运行"
    echo "请先启动 Docker Desktop"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo

# 创建 Dockerfile
cat > Dockerfile.windows << 'EOF'
# 使用 Windows Server Core 作为基础镜像
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# 设置工作目录
WORKDIR C:\app

# 安装 Node.js
RUN powershell -Command \
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-win-x64.msi' -OutFile 'nodejs.msi'; \
    Start-Process msiexec.exe -Wait -ArgumentList '/i nodejs.msi /quiet'; \
    Remove-Item nodejs.msi

# 安装 Python (构建依赖)
RUN powershell -Command \
    Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.0/python-3.11.0-amd64.exe' -OutFile 'python.exe'; \
    Start-Process python.exe -Wait -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1'; \
    Remove-Item python.exe

# 安装 Visual Studio Build Tools
RUN powershell -Command \
    Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile 'vs_buildtools.exe'; \
    Start-Process vs_buildtools.exe -Wait -ArgumentList '--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows10SDK.19041'; \
    Remove-Item vs_buildtools.exe

# 设置环境变量
ENV npm_config_msvs_version=2022
ENV npm_config_target_platform=win32
ENV npm_config_target_arch=x64

# 复制项目文件
COPY package*.json ./
COPY src ./src
COPY assets ./assets

# 安装依赖并构建
RUN npm ci && npm run dist-win

# 构建完成，文件将在 dist 目录
CMD ["cmd"]
EOF

echo "✅ 创建 Windows Docker 配置"

# 检查是否支持 Windows 容器
if docker version --format '{{.Server.Os}}' | grep -q windows; then
    echo "✅ 检测到 Windows 容器支持"
    
    # 构建 Docker 镜像
    echo "🔨 开始构建 Windows 容器..."
    docker build -f Dockerfile.windows -t miaoda-windows-builder .
    
    # 运行容器并复制构建结果
    echo "🚀 运行构建容器..."
    CONTAINER_ID=$(docker run -d miaoda-windows-builder)
    
    # 等待构建完成
    docker wait $CONTAINER_ID
    
    # 复制构建结果
    echo "📦 复制构建结果..."
    docker cp $CONTAINER_ID:C:/app/dist ./dist-windows
    
    # 清理容器
    docker rm $CONTAINER_ID
    
    echo "✅ Windows 版本构建完成！"
    echo "📁 构建文件位于: ./dist-windows/"
    
else
    echo "⚠️ 当前 Docker 不支持 Windows 容器"
    echo "💡 尝试切换到 Windows 容器模式"
    echo "   或使用 Linux 容器的替代方案..."
    
    # 使用 Linux 容器 + Wine 的方案
    cat > Dockerfile.wine << 'EOF'
FROM ubuntu:22.04

# 安装基础依赖
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    software-properties-common \
    build-essential \
    python3 \
    python3-pip

# 安装 Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# 安装 Wine (最新版本)
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y wine64 wine32 winetricks

# 配置 Wine
ENV WINEARCH=win64
ENV WINEPREFIX=/root/.wine
RUN winecfg

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY package*.json ./
COPY src ./src/
COPY assets ./assets/

# 安装依赖
RUN npm ci

# 尝试构建 Windows 版本
RUN npm run dist-win || true

CMD ["bash"]
EOF

    echo "🔨 使用 Linux + Wine 容器构建..."
    docker build -f Dockerfile.wine -t miaoda-wine-builder .
    
    # 运行容器
    CONTAINER_ID=$(docker run -d miaoda-wine-builder sleep 3600)
    
    # 进入容器执行构建
    docker exec $CONTAINER_ID bash -c "cd /app && npm run dist-win"
    
    # 复制结果
    docker cp $CONTAINER_ID:/app/dist ./dist-wine
    
    # 清理
    docker rm -f $CONTAINER_ID
    
    echo "✅ Wine 构建尝试完成"
    echo "📁 检查构建文件: ./dist-wine/"
fi

# 清理临时文件
rm -f Dockerfile.windows Dockerfile.wine

echo
echo "🎯 构建完成！请检查以下目录中的文件："
echo "- ./dist-windows/ (Windows 容器构建)"
echo "- ./dist-wine/ (Wine 构建)"
echo