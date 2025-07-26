#!/bin/bash

# Miaoda Git Flow 初始化脚本

echo "======================================"
echo "Miaoda Git Flow 分支初始化"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}错误：当前目录不是 git 仓库${NC}"
    exit 1
fi

# 获取当前分支
current_branch=$(git branch --show-current)
echo -e "当前分支: ${YELLOW}$current_branch${NC}"
echo ""

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}警告：有未提交的更改，请先提交或暂存${NC}"
    echo "运行 'git status' 查看更改"
    exit 1
fi

# 确保在 main 分支上
if [ "$current_branch" != "main" ]; then
    echo -e "${YELLOW}切换到 main 分支...${NC}"
    git checkout main
    git pull origin main
fi

# 创建 develop 分支
if git show-ref --verify --quiet refs/heads/develop; then
    echo -e "${YELLOW}develop 分支已存在${NC}"
    git checkout develop
    git pull origin develop
else
    echo -e "${GREEN}创建 develop 分支...${NC}"
    git checkout -b develop
    git push -u origin develop
    echo -e "${GREEN}✓ develop 分支创建成功${NC}"
fi

echo ""
echo "======================================"
echo "分支结构初始化完成！"
echo "======================================"
echo ""
echo "当前分支结构："
git branch -a | grep -E "(main|develop)" | sed 's/remotes\/origin\///'
echo ""
echo "下一步操作建议："
echo ""
echo "1. 在 GitHub 上设置分支保护规则："
echo "   - 访问: https://github.com/miounet11/claude-code-manager/settings/branches"
echo "   - 为 main 分支添加保护规则"
echo "   - 为 develop 分支添加保护规则"
echo ""
echo "2. 开始新功能开发："
echo "   git checkout develop"
echo "   git checkout -b feature/your-feature-name"
echo ""
echo "3. 常用命令："
echo "   - 创建功能分支: git checkout -b feature/xxx develop"
echo "   - 创建发布分支: git checkout -b release/x.x.x develop"
echo "   - 创建修复分支: git checkout -b hotfix/xxx main"
echo ""
echo "4. 查看分支策略文档："
echo "   cat GIT_BRANCH_STRATEGY.md"
echo ""

# 创建示例功能分支（可选）
read -p "是否创建一个示例功能分支？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}创建示例功能分支...${NC}"
    git checkout -b feature/example-branch
    echo "# 示例功能" > EXAMPLE_FEATURE.md
    git add EXAMPLE_FEATURE.md
    git commit -m "feat: 添加示例功能文件"
    echo -e "${GREEN}✓ 示例分支创建成功${NC}"
    echo ""
    echo "你现在在 feature/example-branch 分支上"
    echo "可以开始开发了！"
    echo ""
    echo "完成开发后，使用以下命令合并："
    echo "  git checkout develop"
    echo "  git merge --no-ff feature/example-branch"
    echo "  git branch -d feature/example-branch"
fi

echo ""
echo -e "${GREEN}Git Flow 初始化完成！${NC}"