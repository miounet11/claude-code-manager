#!/bin/bash

echo "=== 测试 Claude 代理功能 ==="

# 测试基本的 Claude 消息转换
echo "1. 测试基本消息转换："
curl -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "Say hello in Chinese"}
    ]
  }' 2>/dev/null | jq .

echo -e "\n2. 测试模型映射 (haiku -> small_model)："
curl -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 50,
    "messages": [
      {"role": "user", "content": "Test"}
    ]
  }' 2>/dev/null | jq .

echo -e "\n3. 测试无效 API Key："
curl -X POST http://localhost:8082/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 50,
    "messages": [
      {"role": "user", "content": "Test"}
    ]
  }' 2>/dev/null | jq .

echo -e "\n4. 测试 models 端点："
curl -X GET http://localhost:8082/v1/models \
  -H "x-api-key: test-key" 2>/dev/null | jq .
