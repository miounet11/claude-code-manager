# Git Flow 快速参考卡

## 🚀 快速开始

```bash
# 初始化 Git Flow
chmod +x scripts/init-git-flow.sh
./scripts/init-git-flow.sh

# 使用辅助工具
chmod +x scripts/git-flow-helper.sh
./scripts/git-flow-helper.sh help
```

## 📋 常见场景

### 1. 开发新功能（如：添加暗黑模式）

```bash
# 创建功能分支
./scripts/git-flow-helper.sh feature dark-mode

# 或手动操作
git checkout develop
git checkout -b feature/dark-mode

# 开发...
git add .
git commit -m "feat: 实现暗黑模式切换功能"
git commit -m "style: 优化暗黑模式下的配色方案"

# 完成功能
./scripts/git-flow-helper.sh finish
```

### 2. 修复紧急 Bug（如：代理服务器崩溃）

```bash
# 创建热修复分支
./scripts/git-flow-helper.sh hotfix proxy-crash

# 修复 bug
git add src/main/services/proxy-server.js
git commit -m "fix: 修复代理服务器空指针异常"

# 完成修复（会提示输入版本号，如 4.0.1）
./scripts/git-flow-helper.sh finish
```

### 3. 准备新版本发布（如：4.1.0）

```bash
# 创建发布分支
./scripts/git-flow-helper.sh release 4.1.0

# 更新文档
echo "## v4.1.0\n- 新增：xxx\n- 优化：xxx" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: 更新 4.1.0 版本说明"

# 运行测试
npm test
npm run build

# 完成发布
./scripts/git-flow-helper.sh finish
```

### 4. 实验性功能（如：AI 代码补全）

```bash
# 创建实验分支
git checkout -b experimental/ai-completion develop

# 长期开发...
# 可能会定期从 develop 同步
git pull origin develop

# 如果实验成功，转为正式功能
git checkout develop
git checkout -b feature/ai-completion
git merge experimental/ai-completion
```

## 🔧 日常操作

### 查看分支状态
```bash
./scripts/git-flow-helper.sh status

# 或使用 git 命令
git branch -a                          # 查看所有分支
git log --graph --oneline -10         # 查看分支图
```

### 同步代码
```bash
# 同步所有分支
./scripts/git-flow-helper.sh sync

# 手动同步当前分支
git pull origin $(git branch --show-current)
```

### 清理分支
```bash
# 清理已合并的分支
./scripts/git-flow-helper.sh clean

# 删除远程已删除的分支引用
git remote prune origin
```

## 📊 分支命名示例

### 功能分支
- `feature/multi-language` - 多语言支持
- `feature/api-v2` - API 2.0 版本
- `feature/terminal-split` - 终端分屏功能
- `feature/cloud-sync` - 云同步功能

### 修复分支
- `hotfix/memory-leak` - 内存泄漏修复
- `hotfix/config-save-error` - 配置保存错误
- `hotfix/terminal-freeze` - 终端卡死问题

### 发布分支
- `release/4.1.0` - 4.1.0 版本发布
- `release/4.2.0-beta` - 4.2.0 测试版

## 💡 最佳实践

### 提交信息模板
```bash
# 功能
feat(proxy): 添加请求超时配置选项

# 修复
fix(terminal): 修复中文输入法导致的显示问题

# 文档
docs: 更新 API 代理配置说明

# 性能
perf(stats): 优化统计数据的计算算法

# 重构
refactor(config): 简化配置管理逻辑
```

### 合并策略
```bash
# 功能分支合并到 develop（保留历史）
git merge --no-ff feature/xxx

# 紧急修复可以快进合并
git merge hotfix/xxx

# 复杂功能可以 squash 合并
git merge --squash feature/complex-feature
```

### 冲突解决
```bash
# 在功能分支上解决与 develop 的冲突
git checkout feature/my-feature
git pull origin develop
# 解决冲突...
git add .
git commit -m "merge: 解决与 develop 分支的冲突"
```

## 🚨 紧急情况处理

### 误删分支恢复
```bash
# 查找删除的分支
git reflog
# 找到分支的最后 commit SHA
git checkout -b recovered-branch <SHA>
```

### 撤销合并
```bash
# 撤销最近的合并
git revert -m 1 HEAD
```

### 紧急回滚
```bash
# 回滚到上一个版本
git checkout main
git reset --hard v4.0.0
git push --force-with-lease origin main
```

## 📱 GUI 工具推荐

1. **SourceTree** - 免费，直观的分支可视化
2. **GitKraken** - 强大的 Git Flow 支持
3. **Tower** - macOS 原生体验
4. **GitHub Desktop** - 简单易用

## 🔗 快捷命令别名

添加到 `~/.gitconfig`：

```ini
[alias]
    # 快速切换分支
    co = checkout
    br = branch
    
    # 查看美化的日志
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit
    
    # 查看分支状态
    bs = branch -vv
    
    # 快速提交
    cm = commit -m
    
    # 开始功能
    feature = "!f() { git checkout -b feature/$1 develop; }; f"
    
    # 完成功能
    finish-feature = "!f() { git checkout develop && git merge --no-ff $(git branch --show-current); }; f"
```

## 📞 需要帮助？

1. 查看完整文档：`cat GIT_BRANCH_STRATEGY.md`
2. 运行帮助命令：`./scripts/git-flow-helper.sh help`
3. 查看 Git 状态：`git status`
4. 查看分支图：`git log --graph --oneline`

记住：**分支是廉价的，多创建分支，保持 main 稳定！**