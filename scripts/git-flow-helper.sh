#!/bin/bash

# Miaoda Git Flow 辅助脚本

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 显示帮助信息
show_help() {
    echo "Miaoda Git Flow 辅助工具"
    echo ""
    echo "用法: ./git-flow-helper.sh [命令] [参数]"
    echo ""
    echo "命令:"
    echo "  feature <name>    创建新功能分支"
    echo "  release <version> 创建发布分支"
    echo "  hotfix <name>     创建热修复分支"
    echo "  finish            完成当前分支（合并并删除）"
    echo "  status            查看分支状态"
    echo "  clean             清理已合并的分支"
    echo "  sync              同步所有分支"
    echo ""
    echo "示例:"
    echo "  ./git-flow-helper.sh feature api-v2"
    echo "  ./git-flow-helper.sh release 4.1.0"
    echo "  ./git-flow-helper.sh finish"
}

# 获取当前分支类型
get_branch_type() {
    local branch=$1
    if [[ $branch == feature/* ]]; then
        echo "feature"
    elif [[ $branch == release/* ]]; then
        echo "release"
    elif [[ $branch == hotfix/* ]]; then
        echo "hotfix"
    elif [[ $branch == "main" ]]; then
        echo "main"
    elif [[ $branch == "develop" ]]; then
        echo "develop"
    else
        echo "unknown"
    fi
}

# 创建功能分支
create_feature() {
    local name=$1
    if [ -z "$name" ]; then
        echo -e "${RED}错误：请提供功能分支名称${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}创建功能分支: feature/$name${NC}"
    git checkout develop
    git pull origin develop
    git checkout -b "feature/$name"
    echo -e "${GREEN}✓ 功能分支创建成功${NC}"
    echo ""
    echo "开始开发你的功能！"
    echo "完成后运行: ./git-flow-helper.sh finish"
}

# 创建发布分支
create_release() {
    local version=$1
    if [ -z "$version" ]; then
        echo -e "${RED}错误：请提供版本号${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}创建发布分支: release/$version${NC}"
    git checkout develop
    git pull origin develop
    git checkout -b "release/$version"
    
    # 更新版本号
    echo -e "${YELLOW}更新 package.json 版本号...${NC}"
    if [ -f "package.json" ]; then
        # macOS 和 Linux 兼容的 sed 命令
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/\"version\": \".*\"/\"version\": \"$version\"/" package.json
        else
            sed -i "s/\"version\": \".*\"/\"version\": \"$version\"/" package.json
        fi
        git add package.json
        git commit -m "chore: bump version to $version"
    fi
    
    echo -e "${GREEN}✓ 发布分支创建成功${NC}"
    echo ""
    echo "请进行以下操作："
    echo "1. 运行完整测试"
    echo "2. 更新 CHANGELOG.md"
    echo "3. 修复发现的问题"
    echo "4. 完成后运行: ./git-flow-helper.sh finish"
}

# 创建热修复分支
create_hotfix() {
    local name=$1
    if [ -z "$name" ]; then
        echo -e "${RED}错误：请提供修复分支名称${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}创建热修复分支: hotfix/$name${NC}"
    git checkout main
    git pull origin main
    git checkout -b "hotfix/$name"
    echo -e "${GREEN}✓ 热修复分支创建成功${NC}"
    echo ""
    echo "修复问题后运行: ./git-flow-helper.sh finish"
}

# 完成当前分支
finish_branch() {
    local current_branch=$(git branch --show-current)
    local branch_type=$(get_branch_type "$current_branch")
    
    case $branch_type in
        feature)
            echo -e "${GREEN}完成功能分支: $current_branch${NC}"
            git checkout develop
            git pull origin develop
            git merge --no-ff "$current_branch" -m "Merge $current_branch"
            git push origin develop
            git branch -d "$current_branch"
            echo -e "${GREEN}✓ 功能分支已合并到 develop${NC}"
            ;;
            
        release)
            local version=$(echo "$current_branch" | sed 's/release\///')
            echo -e "${GREEN}完成发布分支: $current_branch${NC}"
            
            # 合并到 main
            git checkout main
            git pull origin main
            git merge --no-ff "$current_branch" -m "Release version $version"
            git tag -a "v$version" -m "Release version $version"
            git push origin main --tags
            
            # 合并回 develop
            git checkout develop
            git pull origin develop
            git merge --no-ff "$current_branch" -m "Merge $current_branch back to develop"
            git push origin develop
            
            git branch -d "$current_branch"
            echo -e "${GREEN}✓ 版本 $version 发布成功${NC}"
            ;;
            
        hotfix)
            echo -e "${GREEN}完成热修复分支: $current_branch${NC}"
            
            # 合并到 main
            git checkout main
            git pull origin main
            git merge --no-ff "$current_branch" -m "Hotfix: $current_branch"
            
            # 获取新版本号
            read -p "请输入修复版本号 (如 4.0.1): " version
            git tag -a "v$version" -m "Hotfix version $version"
            git push origin main --tags
            
            # 合并回 develop
            git checkout develop
            git pull origin develop
            git merge --no-ff "$current_branch" -m "Merge $current_branch to develop"
            git push origin develop
            
            git branch -d "$current_branch"
            echo -e "${GREEN}✓ 热修复已完成${NC}"
            ;;
            
        *)
            echo -e "${RED}错误：当前分支不是功能/发布/热修复分支${NC}"
            exit 1
            ;;
    esac
}

# 查看分支状态
show_status() {
    echo -e "${BLUE}=== Miaoda 分支状态 ===${NC}"
    echo ""
    
    echo -e "${YELLOW}主要分支:${NC}"
    git branch -a | grep -E "(main|develop)" | sed 's/remotes\/origin\//  /'
    
    echo ""
    echo -e "${YELLOW}功能分支:${NC}"
    git branch -a | grep "feature/" | sed 's/remotes\/origin\//  /'
    
    echo ""
    echo -e "${YELLOW}发布分支:${NC}"
    git branch -a | grep "release/" | sed 's/remotes\/origin\//  /'
    
    echo ""
    echo -e "${YELLOW}热修复分支:${NC}"
    git branch -a | grep "hotfix/" | sed 's/remotes\/origin\//  /'
    
    echo ""
    echo -e "${YELLOW}当前分支:${NC} $(git branch --show-current)"
    
    # 显示最近的标签
    echo ""
    echo -e "${YELLOW}最近的版本标签:${NC}"
    git tag --sort=-version:refname | head -5 | sed 's/^/  /'
}

# 清理已合并的分支
clean_branches() {
    echo -e "${YELLOW}清理已合并的本地分支...${NC}"
    
    # 获取已合并到当前分支的分支列表
    local merged_branches=$(git branch --merged | grep -v "\*\|main\|develop")
    
    if [ -z "$merged_branches" ]; then
        echo "没有需要清理的分支"
    else
        echo "以下分支将被删除："
        echo "$merged_branches"
        read -p "确认删除？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$merged_branches" | xargs -n 1 git branch -d
            echo -e "${GREEN}✓ 清理完成${NC}"
        fi
    fi
}

# 同步所有分支
sync_branches() {
    echo -e "${YELLOW}同步所有分支...${NC}"
    
    # 获取所有远程更新
    git fetch --all --prune
    
    # 同步 main
    git checkout main
    git pull origin main
    
    # 同步 develop
    git checkout develop
    git pull origin develop
    
    echo -e "${GREEN}✓ 同步完成${NC}"
}

# 主函数
main() {
    # 检查是否在 git 仓库中
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}错误：当前目录不是 git 仓库${NC}"
        exit 1
    fi
    
    case "$1" in
        feature)
            create_feature "$2"
            ;;
        release)
            create_release "$2"
            ;;
        hotfix)
            create_hotfix "$2"
            ;;
        finish)
            finish_branch
            ;;
        status)
            show_status
            ;;
        clean)
            clean_branches
            ;;
        sync)
            sync_branches
            ;;
        help|--help|-h|"")
            show_help
            ;;
        *)
            echo -e "${RED}未知命令: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"