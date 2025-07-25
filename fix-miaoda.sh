#!/bin/bash

echo "🔧 Miaoda 修复工具"
echo "=================="
echo ""

# 检查是否以管理员权限运行
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  需要管理员权限，正在重新运行..."
    sudo "$0" "$@"
    exit
fi

# 常见的 Miaoda 安装位置
APP_PATHS=(
    "/Applications/Miaoda.app"
    "$HOME/Applications/Miaoda.app"
    "$HOME/Downloads/Miaoda.app"
    "$HOME/Desktop/Miaoda.app"
)

# 查找 Miaoda.app
FOUND=false
for APP_PATH in "${APP_PATHS[@]}"; do
    if [ -d "$APP_PATH" ]; then
        echo "✅ 找到 Miaoda: $APP_PATH"
        echo "🔧 正在修复..."
        
        # 移除所有扩展属性
        xattr -cr "$APP_PATH"
        
        # 设置正确的权限
        chmod -R 755 "$APP_PATH"
        
        # 移除特定的隔离属性
        xattr -d com.apple.quarantine "$APP_PATH" 2>/dev/null
        xattr -d com.apple.quarantine "$APP_PATH/Contents/MacOS/Miaoda" 2>/dev/null
        
        # 重新签名（使用临时签名）
        codesign --force --deep --sign - "$APP_PATH" 2>/dev/null || true
        
        echo "✅ 修复完成！"
        FOUND=true
        break
    fi
done

if [ "$FOUND" = false ]; then
    echo "❌ 未找到 Miaoda.app"
    echo ""
    echo "请输入 Miaoda.app 的完整路径："
    read -r CUSTOM_PATH
    
    if [ -d "$CUSTOM_PATH" ]; then
        echo "🔧 正在修复..."
        xattr -cr "$CUSTOM_PATH"
        xattr -d com.apple.quarantine "$CUSTOM_PATH" 2>/dev/null
        echo "✅ 修复完成！"
    else
        echo "❌ 路径无效"
        exit 1
    fi
fi

echo ""
echo "🎉 现在可以正常打开 Miaoda 了！"
echo ""
echo "提示：如果仍然无法打开，请尝试："
echo "1. 右键点击 Miaoda.app"
echo "2. 按住 Control 键点击"
echo "3. 选择'打开'"
echo "4. 在弹出的对话框中点击'打开'"