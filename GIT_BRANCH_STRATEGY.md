# Miaoda Git 分支策略指南

## 概述

采用 Git Flow 的简化版本，适合 Miaoda 这样的中小型项目，既保证代码质量，又不会过于复杂。

## 分支结构

```
main (主分支)
├── develop (开发分支)
├── feature/* (功能分支)
├── release/* (发布分支)
├── hotfix/* (热修复分支)
└── experimental/* (实验性功能分支)
```

## 核心分支

### 1. main（主分支）
- **用途**：生产环境代码，永远保持稳定可发布状态
- **保护规则**：
  - 禁止直接推送
  - 必须通过 PR 合并
  - 合并前必须通过所有测试
- **标签**：每次发布打 tag（如 v4.0.0）

### 2. develop（开发分支）
- **用途**：集成最新开发功能，下一个版本的基础
- **更新方式**：
  - 功能分支完成后合并到此
  - 定期同步 main 的修复
- **要求**：保持可编译运行状态

## 功能分支

### 3. feature/* （功能分支）
- **命名规范**：`feature/功能描述`
- **示例**：
  - `feature/multi-language-support`
  - `feature/api-rate-limiting`
  - `feature/terminal-themes`
- **生命周期**：
  ```bash
  # 创建功能分支
  git checkout -b feature/api-rate-limiting develop
  
  # 开发完成后合并回 develop
  git checkout develop
  git merge --no-ff feature/api-rate-limiting
  
  # 删除功能分支
  git branch -d feature/api-rate-limiting
  ```

### 4. release/* （发布分支）
- **命名规范**：`release/版本号`
- **示例**：`release/4.1.0`
- **用途**：
  - 发布前的最终测试
  - 小 bug 修复
  - 版本号更新
  - 文档完善
- **流程**：
  ```bash
  # 从 develop 创建
  git checkout -b release/4.1.0 develop
  
  # 完成后合并到 main 和 develop
  git checkout main
  git merge --no-ff release/4.1.0
  git tag -a v4.1.0 -m "Release version 4.1.0"
  
  git checkout develop
  git merge --no-ff release/4.1.0
  ```

### 5. hotfix/* （热修复分支）
- **命名规范**：`hotfix/问题描述`
- **示例**：`hotfix/proxy-crash-fix`
- **用途**：紧急修复生产环境问题
- **流程**：
  ```bash
  # 从 main 创建
  git checkout -b hotfix/proxy-crash-fix main
  
  # 修复后合并到 main 和 develop
  git checkout main
  git merge --no-ff hotfix/proxy-crash-fix
  git tag -a v4.0.1 -m "Hotfix version 4.0.1"
  
  git checkout develop
  git merge --no-ff hotfix/proxy-crash-fix
  ```

### 6. experimental/* （实验性分支）
- **用途**：探索性开发，不确定是否会合并
- **示例**：
  - `experimental/ai-code-completion`
  - `experimental/p2p-sync`
- **特点**：可能长期存在，可能被废弃

## 版本号规范

遵循语义化版本（Semantic Versioning）：

```
主版本号.次版本号.修订号
MAJOR.MINOR.PATCH
```

- **MAJOR**：不兼容的 API 修改
- **MINOR**：向下兼容的功能新增
- **PATCH**：向下兼容的问题修正

示例：
- `4.0.0` → `4.1.0`：新增功能（如多语言支持）
- `4.1.0` → `4.1.1`：修复 bug
- `4.1.1` → `5.0.0`：重大架构变更

## 实践指南

### 日常开发流程

1. **开始新功能**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/new-feature
   ```

2. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   git push origin feature/new-feature
   ```

3. **创建 Pull Request**
   - 目标分支：develop
   - 填写 PR 模板
   - 请求代码审查

4. **合并后清理**
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d feature/new-feature
   ```

### 发布流程

1. **准备发布**
   ```bash
   git checkout -b release/4.1.0 develop
   # 更新版本号
   # 运行测试
   # 更新文档
   ```

2. **完成发布**
   ```bash
   git checkout main
   git merge --no-ff release/4.1.0
   git tag -a v4.1.0 -m "Release version 4.1.0"
   git push origin main --tags
   ```

3. **同步到开发分支**
   ```bash
   git checkout develop
   git merge --no-ff release/4.1.0
   git push origin develop
   ```

## 提交信息规范

使用约定式提交（Conventional Commits）：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**：
```bash
feat(proxy): 添加请求重试机制

- 实现指数退避算法
- 最多重试 3 次
- 添加重试配置选项

Closes #123
```

## 分支保护规则

### main 分支
- 禁止直接推送
- 需要 PR 审查
- 必须通过 CI/CD 测试
- 需要最新的 develop 分支

### develop 分支
- 禁止强制推送
- 建议 PR 审查
- 自动运行测试

## 协作建议

1. **保持分支简洁**
   - 一个分支只做一件事
   - 及时合并已完成的分支
   - 定期清理过期分支

2. **频繁同步**
   ```bash
   # 在功能分支上定期同步 develop
   git checkout feature/my-feature
   git pull origin develop
   ```

3. **代码审查**
   - 所有代码通过 PR 合并
   - 至少一人审查
   - 运行自动化测试

4. **冲突解决**
   - 在功能分支上解决冲突
   - 保持提交历史清晰
   - 必要时使用 rebase

## 常用命令

```bash
# 查看所有分支
git branch -a

# 清理已合并的本地分支
git branch --merged | grep -v "\*\|main\|develop" | xargs -n 1 git branch -d

# 查看分支图
git log --graph --pretty=oneline --abbrev-commit

# 交互式 rebase（整理提交）
git rebase -i HEAD~3
```

## 应急处理

### 错误合并到 main
```bash
# 回滚最后一次合并
git checkout main
git revert -m 1 HEAD
git push origin main
```

### 需要紧急修复
```bash
# 创建热修复分支
git checkout -b hotfix/critical-fix main
# 修复并测试
git checkout main
git merge --no-ff hotfix/critical-fix
git tag -a v4.0.1 -m "Emergency fix"
git push origin main --tags
```

## 下一步行动

1. **初始化分支结构**
   ```bash
   # 创建 develop 分支
   git checkout -b develop main
   git push origin develop
   
   # 设置默认分支为 develop（在 GitHub 设置中）
   ```

2. **配置分支保护**
   - 在 GitHub 仓库设置中配置分支保护规则
   - 启用 PR 审查要求

3. **团队培训**
   - 确保所有开发者理解分支策略
   - 提供分支操作指南

4. **工具集成**
   - 配置 CI/CD 自动化测试
   - 设置分支命名检查
   - 集成代码质量工具

## 收益

采用这个分支策略后，你将获得：

1. **清晰的开发流程**：每个人都知道在哪里工作
2. **稳定的主分支**：生产代码始终可靠
3. **并行开发**：多个功能可以同时进行
4. **快速修复**：紧急问题可以立即处理
5. **版本追踪**：清晰的版本历史和发布记录
6. **降低风险**：新功能不会影响稳定版本
7. **更好的协作**：明确的合并流程和代码审查

记住：分支策略是为了帮助开发，而不是阻碍开发。根据项目实际情况灵活调整！