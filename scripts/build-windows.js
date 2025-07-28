#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️  Miaoda Windows 构建脚本');
console.log('========================\n');

// 检查平台
if (process.platform !== 'win32' && !process.env.FORCE_BUILD) {
  console.warn('⚠️  警告: 您正在非 Windows 平台上构建 Windows 版本');
  console.warn('   这可能会导致某些平台特定功能无法正常工作');
  console.warn('   使用 FORCE_BUILD=1 环境变量强制构建\n');
  
  if (!process.env.FORCE_BUILD) {
    process.exit(1);
  }
}

// 步骤 1: 清理旧的构建文件
console.log('📦 步骤 1: 清理旧的构建文件...');
const distPath = path.join(__dirname, '..', 'dist-windows');
if (fs.existsSync(distPath)) {
  if (process.platform === 'win32') {
    execSync(`rmdir /s /q "${distPath}"`, { stdio: 'inherit' });
  } else {
    execSync(`rm -rf "${distPath}"`, { stdio: 'inherit' });
  }
}

// 步骤 2: 安装依赖
console.log('\n📦 步骤 2: 检查依赖...');
try {
  execSync('npm list electron', { stdio: 'pipe' });
  console.log('✅ 依赖已安装');
} catch {
  console.log('📥 安装依赖...');
  execSync('npm install', { stdio: 'inherit' });
}

// 步骤 3: 准备构建资源
console.log('\n📦 步骤 3: 准备构建资源...');

// 确保 Windows 图标存在
const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.error('❌ 错误: Windows 图标文件不存在: assets/icon.ico');
  console.log('   请确保已创建 Windows 图标文件 (.ico 格式)');
  process.exit(1);
}

// 创建临时的 package.json（使用 Windows 版本的配置）
console.log('\n📦 步骤 4: 创建 Windows 专用 package.json...');
const originalPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const windowsPackage = JSON.parse(fs.readFileSync('package-windows.json', 'utf8'));

// 合并依赖
windowsPackage.dependencies = {
  ...originalPackage.dependencies,
  ...windowsPackage.dependencies
};

// 备份原始 package.json
fs.writeFileSync('package.json.backup', JSON.stringify(originalPackage, null, 2));

// 写入 Windows 版本的 package.json
fs.writeFileSync('package.json', JSON.stringify(windowsPackage, null, 2));

// 步骤 5: 运行构建
console.log('\n📦 步骤 5: 开始构建 Windows 版本...\n');

try {
  // 设置环境变量
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    CSC_IDENTITY_AUTO_DISCOVERY: 'false' // 禁用代码签名自动发现
  };

  // 使用 Windows 专用的构建配置
  execSync('electron-builder --config electron-builder-windows.json', {
    stdio: 'inherit',
    env: env
  });

  console.log('\n✅ 构建成功！');
  
  // 显示构建产物
  console.log('\n📁 构建产物:');
  const files = fs.readdirSync(distPath);
  files.forEach(file => {
    const stats = fs.statSync(path.join(distPath, file));
    const size = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   - ${file} (${size} MB)`);
  });

} catch (error) {
  console.error('\n❌ 构建失败:', error.message);
  process.exit(1);
} finally {
  // 恢复原始 package.json
  console.log('\n📦 恢复原始 package.json...');
  fs.writeFileSync('package.json', JSON.stringify(originalPackage, null, 2));
  fs.unlinkSync('package.json.backup');
}

console.log('\n🎉 Windows 版本构建完成！');
console.log('📁 输出目录: dist-windows/');

// 提示后续步骤
console.log('\n📝 后续步骤:');
console.log('1. 测试安装包');
console.log('2. 在 Windows 10/11 上进行兼容性测试');
console.log('3. 准备发布到 GitHub Releases');
console.log('\n💡 提示: 使用 "npm run test-windows" 运行 Windows 版本测试');