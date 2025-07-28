'use strict';

/**
 * 测试动态路径查找功能
 */

const environmentService = require('../src/main/services/environment-service');
const claudeService = require('../src/main/services/claude-service');
const { execSync } = require('child_process');

console.log('🧪 测试动态路径查找功能...\n');

async function testDynamicPathFinding() {
  console.log('📋 系统信息：');
  console.log('- 平台:', process.platform);
  console.log('- 架构:', process.arch);
  console.log('- Node 版本:', process.version);
  console.log('- PATH:', process.env.PATH);
  console.log();
  
  // 1. 测试动态获取 npm 信息
  console.log('1️⃣ 动态获取 npm 信息...');
  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    console.log('✅ npm prefix:', npmPrefix);
    
    // npm bin -g 已被废弃，直接使用 prefix/bin
    const npmBin = `${npmPrefix}/bin`;
    console.log('✅ npm 全局 bin 目录:', npmBin);
    
    // 检查该目录是否存在
    const fs = require('fs');
    if (fs.existsSync(npmBin)) {
      const files = fs.readdirSync(npmBin);
      console.log(`✅ 在 npm bin 目录中找到 ${files.length} 个文件`);
      if (files.includes('claude')) {
        console.log('✅ 找到 claude 命令');
      }
    }
  } catch (e) {
    console.log('❌ 无法获取 npm 信息:', e.message);
  }
  
  // 2. 测试动态获取 Node.js 路径
  console.log('\n2️⃣ 动态获取 Node.js 路径...');
  try {
    const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
    console.log('✅ Node.js 路径:', nodePath);
    
    const path = require('path');
    const nodeDir = path.dirname(nodePath);
    console.log('✅ Node.js bin 目录:', nodeDir);
  } catch (e) {
    console.log('❌ 无法获取 Node.js 路径:', e.message);
  }
  
  // 3. 测试环境服务的动态路径功能
  console.log('\n3️⃣ 测试环境服务的动态路径功能...');
  const searchPaths = await environmentService.getSearchPaths('claude');
  console.log('搜索路径数量:', searchPaths.length);
  console.log('前 10 个路径:');
  searchPaths.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p}`);
  });
  
  // 4. 测试 Claude CLI 查找
  console.log('\n4️⃣ 测试 Claude CLI 查找...');
  const claudePath = await claudeService.findClaudePath();
  if (claudePath) {
    console.log('✅ 找到 Claude CLI:', claudePath);
    
    // 验证路径是否正确
    try {
      const version = execSync(`"${claudePath}" --version`, { encoding: 'utf8' }).trim();
      console.log('✅ Claude 版本:', version);
    } catch (e) {
      console.log('⚠️  无法执行 Claude CLI');
    }
  } else {
    console.log('❌ 未找到 Claude CLI');
  }
  
  // 5. 测试环境检测
  console.log('\n5️⃣ 完整环境检测...');
  const envCheck = await environmentService.checkCommand('claude');
  console.log('检测结果:', JSON.stringify(envCheck, null, 2));
}

// 运行测试
testDynamicPathFinding().then(() => {
  console.log('\n✨ 测试完成！');
}).catch(error => {
  console.error('❌ 测试失败:', error);
});