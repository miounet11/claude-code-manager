# 模型选择指南

## 支持的模型

Miaoda 支持多种 Claude 模型，您可以从预设列表选择或手动输入自定义模型名称。

### 预设模型列表

#### 最新模型
- **claude-3-7-sonnet-20250219** - Claude 3.7 Sonnet（推荐）
  - 最新的 Sonnet 模型，性能和速度平衡
  - 适合大多数任务

- **claude-3-7-sonnet-20250219-thinking** - Claude 3.7 Sonnet (Thinking)
  - 带有思考过程的 Sonnet 模型
  - 适合需要详细推理的任务

#### 高级模型
- **grok-3claude-sonnet-4-20250514** - Grok 3 Claude Sonnet 4
  - 增强版 Sonnet 模型
  - 更强的推理能力

- **claude-opus-4-20250514** - Claude Opus 4
  - 最强大的模型
  - 适合复杂任务和创意工作

#### 经典模型
- **claude-3-opus-20240229** - Claude 3 Opus (Legacy)
  - 经典的 Opus 模型
  - 稳定可靠

- **claude-3-sonnet-20240229** - Claude 3 Sonnet (Legacy)
  - 经典的 Sonnet 模型
  - 速度快，适合常规任务

- **claude-3-haiku-20240307** - Claude 3 Haiku
  - 最快的模型
  - 适合简单任务和快速响应

## 如何选择模型

### 使用预设模型
1. 在"配置管理"中创建或编辑配置
2. 点击"模型"输入框
3. 从下拉列表中选择合适的模型
4. 保存配置

### 手动输入模型
1. 在"模型"输入框中直接输入模型名称
2. 支持任何有效的模型标识符
3. 适用于：
   - 测试新发布的模型
   - 使用特殊版本的模型
   - 使用第三方 API 提供的模型

## 模型选择建议

### 根据任务选择
- **日常对话**: claude-3-7-sonnet-20250219
- **编程助手**: claude-3-7-sonnet-20250219-thinking
- **创意写作**: claude-opus-4-20250514
- **快速查询**: claude-3-haiku-20240307

### 根据性能需求
- **最佳性能**: claude-opus-4-20250514
- **平衡选择**: claude-3-7-sonnet-20250219
- **最快响应**: claude-3-haiku-20240307

### 根据成本考虑
- **经济实惠**: claude-3-haiku-20240307
- **性价比高**: claude-3-7-sonnet-20250219
- **不计成本**: claude-opus-4-20250514

## 免费体验模型

免费体验账户默认使用：
- **claude-3-7-sonnet-20250219**
- 每日 100万 token 限额
- 性能优秀，适合体验各项功能

## 注意事项

1. **模型可用性**
   - 某些模型可能需要特定的 API 权限
   - 新模型可能需要等待官方支持

2. **API 兼容性**
   - 确保您的 API Key 支持所选模型
   - 不同 API 端点可能支持不同的模型集

3. **模型更新**
   - Claude 会定期发布新模型
   - 旧模型可能会被弃用
   - 建议定期查看官方文档

## 自定义模型

如果您使用第三方 API 或私有部署，可以手动输入任何模型标识符：

```
例如：
- custom-claude-model-v1
- enterprise-claude-opus
- my-fine-tuned-model
```

只要 API 端点支持该模型，Miaoda 就可以正常使用。

## 故障排除

### 模型不可用
- 检查 API Key 权限
- 确认模型名称拼写正确
- 查看 API 端点是否支持该模型

### 响应错误
- 尝试切换到其他模型
- 检查 API 配额
- 查看错误信息了解具体原因

---

有关最新的模型信息，请访问 [Claude 官方文档](https://docs.anthropic.com/claude/docs/models)