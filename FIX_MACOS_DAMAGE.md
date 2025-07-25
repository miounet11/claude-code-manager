# 修复 macOS "已损坏" 错误

## 问题原因
这是因为应用没有经过 Apple 的公证，macOS 的 Gatekeeper 安全机制会阻止应用运行。

## 解决方法

### 方法 1：使用终端命令（推荐）
1. 打开终端
2. 运行以下命令：
   ```bash
   # 移除隔离属性
   sudo xattr -cr /Applications/Miaoda.app
   
   # 或者如果应用在其他位置
   sudo xattr -cr ~/Downloads/Miaoda.app
   ```

### 方法 2：系统偏好设置
1. 打开"系统偏好设置" → "安全性与隐私"
2. 点击左下角的锁并输入密码
3. 在"通用"标签下，点击"仍要打开"

### 方法 3：右键打开
1. 在 Finder 中找到 Miaoda.app
2. 按住 Control 键点击应用（或右键点击）
3. 选择"打开"
4. 在弹出的对话框中再次点击"打开"

### 方法 4：临时允许任何来源（不推荐）
```bash
# 允许任何来源的应用
sudo spctl --master-disable

# 使用后记得重新启用
sudo spctl --master-enable
```

## 永久解决方案

### 开发者签名（未来版本）
我们正在申请 Apple 开发者账号，未来版本将会：
1. 使用开发者证书签名
2. 通过 Apple 公证
3. 无需手动处理即可直接运行

### 当前版本的快速修复脚本
将以下内容保存为 `fix-miaoda.sh` 并运行：

```bash
#!/bin/bash
echo "修复 Miaoda 应用..."
sudo xattr -cr /Applications/Miaoda.app
echo "✅ 修复完成！现在可以正常打开 Miaoda 了。"
```

运行方法：
```bash
chmod +x fix-miaoda.sh
./fix-miaoda.sh
```