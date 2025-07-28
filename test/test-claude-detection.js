'use strict';

/**
 * 测试 Claude CLI 检测和安装功能
 */

const environmentService = require('../src/main/services/environment-service');
const installerService = require('../src/main/services/installer-service');

console.log('🧪 开始测试 Claude CLI 检测和安装功能...\n');

async function testEnvironmentDetection() {
  console.log('📋 测试环境检测...');
  
  try {
    // 1. 检查所有环境
    const result = await environmentService.checkAll();
    console.log('\n环境检测结果:');
    console.log(JSON.stringify(result, null, 2));
    
    // 2. 特别检查 Claude
    console.log('\n特别关注 Claude CLI:');
    const claudeInfo = result.dependencies.claude;
    if (claudeInfo.installed) {
      console.log(`✅ Claude CLI 已安装`);
      console.log(`   版本: ${claudeInfo.version || '未知'}`);
      console.log(`   路径: ${claudeInfo.path || '未知'}`);
    } else {
      console.log(`❌ Claude CLI 未检测到`);
      console.log(`   错误: ${claudeInfo.error || '未知错误'}`);
    }
    
    // 3. 获取诊断信息
    console.log('\n\n📊 获取详细诊断信息...');
    const diagnostics = await environmentService.getDiagnostics();
    console.log('系统 PATH:', diagnostics.paths.PATH);
    console.log('NPM 前缀:', diagnostics.paths.npm);
    
    // 4. 如果 Claude 未安装，尝试修复路径
    if (!claudeInfo.installed) {
      console.log('\n\n🔧 尝试修复 Claude 路径...');
      const fixResult = await environmentService.fixClaudePath();
      console.log('修复结果:', fixResult);
      
      // 重新检查
      if (fixResult.success) {
        console.log('\n重新检查环境...');
        const recheckResult = await environmentService.checkCommand('claude');
        console.log('重新检查结果:', recheckResult);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testInstallationCommands() {
  console.log('\n\n📦 测试安装命令...');
  
  // 测试 npm 包名是否正确
  const { execSync } = require('child_process');
  
  try {
    console.log('\n1. 检查 @anthropic-ai/claude-code 包信息:');
    const npmInfo = execSync('npm view @anthropic-ai/claude-code', { encoding: 'utf8' });
    console.log('包信息获取成功');
    
  } catch (error) {
    console.log('❌ 无法获取包信息，可能是网络问题或包名错误');
    console.log('错误:', error.message);
  }
  
  try {
    console.log('\n2. 检查全局安装的 npm 包:');
    const globalPackages = execSync('npm list -g --depth=0', { encoding: 'utf8' });
    const hasClaudeCode = globalPackages.includes('@anthropic-ai/claude-code');
    console.log(hasClaudeCode ? '✅ @anthropic-ai/claude-code 已全局安装' : '❌ @anthropic-ai/claude-code 未安装');
    
  } catch (error) {
    console.log('无法列出全局包');
  }
}

async function suggestSolutions() {
  console.log('\n\n💡 解决方案建议:');
  console.log('1. 确保 Node.js 和 npm 已正确安装');
  console.log('2. 使用以下命令安装 Claude CLI:');
  console.log('   npm install -g @anthropic-ai/claude-code');
  console.log('3. 如果遇到权限问题，使用:');
  console.log('   sudo npm install -g @anthropic-ai/claude-code');
  console.log('4. 或者修改 npm 全局目录:');
  console.log('   mkdir ~/.npm-global');
  console.log('   npm config set prefix "~/.npm-global"');
  console.log('   echo \'export PATH=~/.npm-global/bin:$PATH\' >> ~/.bashrc');
  console.log('   source ~/.bashrc');
  console.log('   npm install -g @anthropic-ai/claude-code');
}

// 运行测试
async function runTests() {
  await testEnvironmentDetection();
  await testInstallationCommands();
  await suggestSolutions();
  console.log('\n\n✨ 测试完成！');
}

runTests();