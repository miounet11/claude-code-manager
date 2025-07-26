# 🎉 Miaoda v4.1.0 正式发布 - Universal AI Service Bridge

我们很高兴地宣布 Miaoda 4.1.0 版本正式发布！这是一个里程碑版本，将 Miaoda 从 Claude 专用工具升级为**通用 AI 服务聚合平台**。

## 🚀 重大更新：Universal Bridge（通用桥接）

### 🔄 动态路由系统
- **运行时切换** - 无需重启即可切换不同的 AI 服务
- **智能路由** - 自动识别并转发到正确的 AI 服务
- **统一接口** - 使用相同的 API 访问所有 AI 服务

### 🔀 API 格式转换器
- **双向转换** - Claude ↔ OpenAI ↔ Gemini ↔ Ollama
- **透明处理** - 自动转换请求和响应格式
- **兼容性强** - 支持 Function Calling、流式响应等高级特性

### 🤖 支持 7+ AI 服务

#### 云端服务
- **OpenAI** - GPT-4、GPT-4 Turbo、GPT-3.5
- **Anthropic Claude** - Claude 3 Opus、Sonnet、Haiku
- **Google Gemini** - Gemini Pro、Pro Vision
- **Groq Cloud** - 超快速推理（Llama 2、Mixtral）
- **Perplexity AI** - 实时搜索增强的 AI

#### 本地服务
- **Ollama** - 运行 Llama、Mistral、CodeLlama 等开源模型
- **LM Studio** - 图形化本地模型管理
- **LocalAI** - 兼容 OpenAI API 的本地推理

### 🎯 配置向导（新功能）
- **分步引导** - 4 个简单步骤完成配置
- **自动检测** - 自动发现本地运行的 AI 服务
- **连接测试** - 配置前验证服务可用性
- **模型选择** - 动态获取可用模型列表

### 🦙 本地模型管理器（新功能）
- **服务检测** - 自动检测 Ollama、LM Studio、LocalAI
- **模型管理** - 查看、下载、删除本地模型
- **实时进度** - 模型下载进度实时显示
- **一键切换** - 快速切换不同的本地模型

## 💡 使用示例

### 动态路由使用
```bash
# 使用 OpenAI GPT-4
http://localhost:8118/proxy/openai/gpt-4/v1/chat/completions

# 使用 Claude Opus
http://localhost:8118/proxy/claude/claude-3-opus/v1/messages

# 使用本地 Ollama
http://localhost:8118/proxy/ollama/llama2/api/chat
```

### 配置向导
1. 点击侧边栏的"配置向导"按钮
2. 选择 AI 服务提供商
3. 输入 API Key（本地服务无需）
4. 选择模型并测试连接

## 🛠️ 技术改进
- 模块化架构设计
- 服务注册表模式
- 事件驱动的本地模型检测
- 优化的错误处理和日志

## 📦 安装和升级

### macOS 用户
- **Intel**: [Miaoda-4.1.0.dmg](https://github.com/yourusername/miaoda/releases/download/v4.1.0/Miaoda-4.1.0.dmg)
- **Apple Silicon**: [Miaoda-4.1.0-arm64.dmg](https://github.com/yourusername/miaoda/releases/download/v4.1.0/Miaoda-4.1.0-arm64.dmg)

### 从旧版本升级
1. 下载新版本安装包
2. 关闭旧版本 Miaoda
3. 安装新版本（会自动保留配置）
4. 使用配置向导探索新功能

## 🎯 下一步计划

### Windows 版本（开发中）
- 独立的 Windows 版本正在开发
- 原生 Windows 体验（Fluent Design）
- PowerShell 和 Windows Terminal 集成
- 预计下个版本发布

### 更多功能
- 批量 API 请求支持
- 使用统计分析
- 自定义模型参数模板
- 插件系统

## 🙏 致谢

感谢社区的反馈和建议，特别感谢：
- 建议多服务支持的用户们
- 测试本地模型功能的开发者
- 提供 API 兼容性反馈的伙伴

## 📝 完整更新日志

详见 [CHANGELOG.md](https://github.com/yourusername/miaoda/blob/main/CHANGELOG.md)

---

**立即下载体验 Miaoda 4.1.0，开启您的 AI 服务聚合之旅！**

如有问题或建议，欢迎在 [GitHub Issues](https://github.com/yourusername/miaoda/issues) 提交反馈。