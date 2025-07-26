'use strict';

/**
 * 模拟更新服务器
 * 用于测试更新检查功能
 */

const http = require('http');
const path = require('path');

// 模拟的更新信息
const updateInfo = {
  version: "4.2.0",
  versionCode: 420,
  versionName: "v4.2.0",
  releaseDate: "2024-01-28",
  forceUpdate: false,  // 改为 true 测试强制更新
  minVersion: "3.0.0",
  updateMessage: {
    zh: "发现新版本 v4.2.0，建议更新以获得更好的体验。",
    en: "New version v4.2.0 is available. Update recommended for better experience."
  },
  releaseNotes: {
    zh: "1. 新增 AI 模型热切换功能\n2. 优化终端性能，响应速度提升 50%\n3. 修复已知问题，提升稳定性\n4. 新增深色主题支持",
    en: "1. Added AI model hot-switching\n2. Terminal performance improved by 50%\n3. Bug fixes and stability improvements\n4. Added dark theme support"
  },
  downloads: {
    macos: {
      x64: {
        url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-4.2.0.dmg",
        size: 85983232,
        sha256: "sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
        filename: "Miaoda-4.2.0.dmg"
      },
      arm64: {
        url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-4.2.0-arm64.dmg",
        size: 82313216,
        sha256: "sha256:b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7",
        filename: "Miaoda-4.2.0-arm64.dmg"
      }
    },
    windows: {
      x64: {
        url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-Setup-4.2.0-x64.exe",
        size: 78643200,
        sha256: "sha256:c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8",
        filename: "Miaoda-Setup-4.2.0-x64.exe"
      },
      x86: {
        url: "https://github.com/miounet11/claude-code-manager/releases/download/v4.2.0/Miaoda-Setup-4.2.0-x86.exe",
        size: 76546048,
        sha256: "sha256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9",
        filename: "Miaoda-Setup-4.2.0-x86.exe"
      }
    }
  },
  changelog: {
    zh: "https://github.com/miounet11/claude-code-manager/blob/main/CHANGELOG_ZH.md",
    en: "https://github.com/miounet11/claude-code-manager/blob/main/CHANGELOG.md"
  },
  announcement: {
    show: true,
    title: {
      zh: "重要通知",
      en: "Important Notice"
    },
    content: {
      zh: "Miaoda 5.0 即将发布，带来全新的 AI 体验！",
      en: "Miaoda 5.0 is coming soon with brand new AI experience!"
    },
    link: "https://miaoda.app/announcement"
  }
};

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/updates.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(updateInfo, null, 2));
    console.log('✅ 返回更新信息');
  } else if (req.url === '/api/analytics/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "healthy",
      service: "analytics",
      version: "1.0.0",
      server_time: new Date().toISOString()
    }));
    console.log('✅ 返回健康检查');
  } else if (req.url === '/api/analytics/batch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📊 收到统计数据:');
        console.log(`  - 报告数量: ${data.reports?.length || 0}`);
        if (data.reports?.[0]) {
          console.log(`  - 用户 ID: ${data.reports[0].user_id}`);
          console.log(`  - 设备 ID: ${data.reports[0].device_id}`);
          console.log(`  - 日期: ${data.reports[0].date}`);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: "ok",
          success_count: data.reports?.length || 0,
          failed_count: 0,
          message: "数据上报成功",
          server_time: new Date().toISOString()
        }));
        console.log('✅ 统计数据处理成功');
      } catch (e) {
        console.error('❌ 处理统计数据失败:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: "error",
          message: "请求数据格式错误",
          error_code: "INVALID_REQUEST"
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = 8889;

server.listen(PORT, () => {
  console.log('🚀 模拟更新服务器已启动');
  console.log(`📡 监听地址: http://localhost:${PORT}`);
  console.log('');
  console.log('📌 可用的端点:');
  console.log(`  - GET  http://localhost:${PORT}/updates.json        - 更新信息`);
  console.log(`  - GET  http://localhost:${PORT}/api/analytics/health - 健康检查`);
  console.log(`  - POST http://localhost:${PORT}/api/analytics/batch  - 统计上报`);
  console.log('');
  console.log('💡 测试方法:');
  console.log('1. 修改 updateInfo.forceUpdate = true 测试强制更新');
  console.log('2. 修改 updateInfo.version 测试不同版本');
  console.log('3. 在应用中设置环境变量:');
  console.log(`   export MIAODA_UPDATE_CHECK_URL=http://localhost:${PORT}/updates.json`);
  console.log(`   export MIAODA_API_BASE_URL=http://localhost:${PORT}`);
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});