'use strict';

/**
 * 测试更新检查和升级流程
 * 
 * 使用方法：
 * 1. node test/test-update-flow.js check    - 测试更新检查
 * 2. node test/test-update-flow.js optional - 测试可选更新
 * 3. node test/test-update-flow.js force    - 测试强制更新
 */

const https = require('https');
const { app } = require('electron');

// 模拟的更新信息
const mockUpdateData = {
  optional: {
    version: "4.2.0",
    versionCode: 420,
    versionName: "v4.2.0",
    releaseDate: "2024-01-28",
    forceUpdate: false,
    updateMessage: {
      zh: "发现新版本 v4.2.0，建议更新以获得更好的体验。",
      en: "New version v4.2.0 is available. Update recommended for better experience."
    },
    releaseNotes: {
      zh: "1. 新增 AI 模型热切换功能\n2. 优化终端性能，响应速度提升 50%\n3. 修复已知问题，提升稳定性",
      en: "1. Added AI model hot-switching\n2. Terminal performance improved by 50%\n3. Bug fixes and stability improvements"
    },
    downloads: {
      macos: {
        x64: {
          url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-4.2.0.dmg",
          size: 85983232,
          sha256: "sha256:test123",
          filename: "Miaoda-4.2.0.dmg"
        },
        arm64: {
          url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-4.2.0-arm64.dmg",
          size: 82313216,
          sha256: "sha256:test456",
          filename: "Miaoda-4.2.0-arm64.dmg"
        }
      }
    }
  },
  force: {
    version: "5.0.0",
    versionCode: 500,
    versionName: "v5.0.0",
    releaseDate: "2024-01-28",
    forceUpdate: true,
    minVersion: "4.2.0",
    updateMessage: {
      zh: "发现重要更新，需要立即升级到 v5.0.0 才能继续使用。",
      en: "Critical update required. Please update to v5.0.0 to continue."
    },
    releaseNotes: {
      zh: "重要安全更新：\n1. 修复严重安全漏洞\n2. 升级核心依赖库\n3. 必须更新才能继续使用",
      en: "Critical security update:\n1. Fixed critical security vulnerabilities\n2. Updated core dependencies\n3. Update required to continue"
    },
    downloads: {
      macos: {
        x64: {
          url: "https://github.com/miounet11/claude-code-manager/releases/download/v5.0.0/Miaoda-5.0.0.dmg",
          size: 90000000,
          sha256: "sha256:test789",
          filename: "Miaoda-5.0.0.dmg"
        },
        arm64: {
          url: "https://github.com/miounet11/claude-code-manager/releases/download/v5.0.0/Miaoda-5.0.0-arm64.dmg",
          size: 88000000,
          sha256: "sha256:testabc",
          filename: "Miaoda-5.0.0-arm64.dmg"
        }
      }
    }
  }
};

// 创建本地测试服务器
function createTestServer(updateType) {
  const http = require('http');
  
  const server = http.createServer((req, res) => {
    console.log(`📥 收到请求: ${req.url}`);
    
    if (req.url === '/updates.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockUpdateData[updateType] || mockUpdateData.optional));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  server.listen(8888, () => {
    console.log('✅ 测试服务器启动在 http://localhost:8888');
  });
  
  return server;
}

// 测试 Updater 类
async function testUpdater(updateType) {
  console.log(`\n🧪 测试 ${updateType} 更新流程...\n`);
  
  // Mock Electron 环境
  if (!app.getVersion) {
    app.getVersion = () => '4.1.0';
  }
  
  // 设置测试环境变量
  process.env.MIAODA_UPDATE_CHECK_URL = 'http://localhost:8888/updates.json';
  
  // 创建测试服务器
  const server = createTestServer(updateType);
  
  try {
    // 加载 Updater 类
    const Updater = require('../src/main/updater');
    
    // Mock 主窗口
    const mockWindow = {
      webContents: {
        send: (channel, ...args) => {
          console.log(`📤 IPC 消息: ${channel}`, args);
        }
      }
    };
    
    // Mock dialog
    const { dialog, shell } = require('electron');
    
    // 记录 dialog 调用
    const dialogCalls = [];
    dialog.showMessageBox = async (window, options) => {
      console.log('\n📋 显示对话框:');
      console.log(`  标题: ${options.title}`);
      console.log(`  消息: ${options.message}`);
      if (options.detail) {
        console.log(`  详情: ${options.detail}`);
      }
      console.log(`  按钮: ${options.buttons.join(', ')}`);
      
      dialogCalls.push(options);
      
      // 模拟用户选择
      if (updateType === 'force') {
        console.log('  👤 用户选择: 立即更新');
        return { response: 0 }; // 立即更新
      } else {
        console.log('  👤 用户选择: 立即更新');
        return { response: 0 }; // 立即更新
      }
    };
    
    // Mock shell.openExternal
    shell.openExternal = (url) => {
      console.log(`\n🌐 打开外部链接: ${url}`);
      return Promise.resolve();
    };
    
    // 创建 Updater 实例
    const updater = new Updater(mockWindow);
    
    // 执行更新检查
    console.log('\n⏳ 开始检查更新...');
    const hasUpdate = await updater.checkForUpdates(false);
    
    // 验证结果
    console.log(`\n✅ 更新检查完成: ${hasUpdate ? '有新版本' : '已是最新'}`);
    
    // 检查对话框调用
    if (dialogCalls.length > 0) {
      console.log(`\n📊 对话框调用次数: ${dialogCalls.length}`);
      
      const lastDialog = dialogCalls[dialogCalls.length - 1];
      
      // 验证更新类型
      if (updateType === 'force' && !lastDialog.message.includes('需要更新')) {
        throw new Error('强制更新对话框消息不正确');
      }
      
      if (updateType === 'optional' && lastDialog.buttons.length !== 3) {
        throw new Error('可选更新应该有3个按钮选项');
      }
    }
    
    // 测试版本比较
    console.log('\n🔍 测试版本比较功能:');
    const testCases = [
      ['4.2.0', '4.1.0', 1],
      ['4.1.0', '4.2.0', -1],
      ['4.1.0', '4.1.0', 0],
      ['5.0.0', '4.9.9', 1],
    ];
    
    for (const [v1, v2, expected] of testCases) {
      const result = updater.compareVersions(v1, v2);
      const pass = result === expected;
      console.log(`  ${pass ? '✅' : '❌'} ${v1} vs ${v2} = ${result} (期望: ${expected})`);
    }
    
    // 测试自动检查设置
    console.log('\n⚙️  测试自动检查设置...');
    updater.setupAutoCheck();
    console.log('✅ 自动检查已设置（启动后10秒，每30分钟）');
    
    console.log('\n🎉 测试完成！\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  } finally {
    server.close();
  }
}

// 测试实际的更新检查 API
async function testRealAPI() {
  console.log('\n🌐 测试真实的更新检查 API...\n');
  
  const UPDATE_CHECK_URL = 'https://api.iclaudecode.cn/updates.json';
  
  return new Promise((resolve) => {
    https.get(UPDATE_CHECK_URL, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`响应头:`, res.headers);
      
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const updateInfo = JSON.parse(data);
            console.log('\n✅ API 响应成功:');
            console.log(JSON.stringify(updateInfo, null, 2));
          } catch (e) {
            console.log('❌ JSON 解析失败:', e.message);
          }
          resolve();
        });
      } else {
        console.log(`❌ API 返回错误状态码: ${res.statusCode}`);
        resolve();
      }
    }).on('error', (err) => {
      console.log('❌ 请求失败:', err.message);
      console.log('📝 注意: API 服务器可能尚未部署');
      resolve();
    });
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  
  console.log('='.repeat(60));
  console.log('🧪 Miaoda 更新功能测试');
  console.log('='.repeat(60));
  
  switch (command) {
    case 'check':
      await testRealAPI();
      break;
    case 'optional':
      await testUpdater('optional');
      break;
    case 'force':
      await testUpdater('force');
      break;
    default:
      console.log('用法:');
      console.log('  node test-update-flow.js check    - 测试真实 API');
      console.log('  node test-update-flow.js optional - 测试可选更新');
      console.log('  node test-update-flow.js force    - 测试强制更新');
  }
  
  process.exit(0);
}

// 运行测试
main().catch(console.error);