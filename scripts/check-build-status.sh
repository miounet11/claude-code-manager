#!/bin/bash

# GitHub Actions 构建状态监控脚本

REPO="miounet11/claude-code-manager"
API_URL="https://api.github.com/repos/$REPO/actions/runs"

echo "🔍 检查 GitHub Actions 构建状态..."
echo "仓库: $REPO"
echo "时间: $(date)"
echo "========================================"

# 获取最新的构建信息
LATEST_RUN=$(curl -s "$API_URL?per_page=1")

# 提取关键信息
STATUS=$(echo "$LATEST_RUN" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
CONCLUSION=$(echo "$LATEST_RUN" | grep -o '"conclusion":"[^"]*"' | head -1 | cut -d'"' -f4)
WORKFLOW_NAME=$(echo "$LATEST_RUN" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
CREATED_AT=$(echo "$LATEST_RUN" | grep -o '"created_at":"[^"]*"' | head -1 | cut -d'"' -f4)
HTML_URL=$(echo "$LATEST_RUN" | grep -o '"html_url":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "📋 最新构建信息:"
echo "- 工作流: $WORKFLOW_NAME"
echo "- 状态: $STATUS"
echo "- 结果: $CONCLUSION"
echo "- 开始时间: $CREATED_AT"
echo "- 查看地址: $HTML_URL"
echo

# 根据状态显示不同信息
case "$STATUS" in
    "queued")
        echo "⏳ 构建已排队，等待开始..."
        ;;
    "in_progress")
        echo "🔄 构建正在进行中..."
        echo "💡 提示: 可以访问上面的链接查看实时日志"
        ;;
    "completed")
        if [ "$CONCLUSION" = "success" ]; then
            echo "✅ 构建成功完成！"
            echo "🎉 Windows exe 文件已生成"
            echo "📦 查看发布页面: https://github.com/$REPO/releases"
        elif [ "$CONCLUSION" = "failure" ]; then
            echo "❌ 构建失败"
            echo "🔍 请查看构建日志了解详细错误信息"
            echo "🔗 日志地址: $HTML_URL"
        elif [ "$CONCLUSION" = "cancelled" ]; then
            echo "⚠️ 构建被取消"
        else
            echo "❓ 构建状态未知: $CONCLUSION"
        fi
        ;;
    *)
        echo "❓ 未知状态: $STATUS"
        ;;
esac

echo
echo "🔄 要持续监控构建状态，请重新运行此脚本"
echo "📱 或访问 GitHub Actions 页面查看实时进度"