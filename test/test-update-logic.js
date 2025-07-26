'use strict';

/**
 * 测试更新逻辑（不需要 Electron 环境）
 */

const https = require('https');
const http = require('http');

// 从 updater.js 提取版本比较逻辑
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

// 判断是否有更新
function isUpdateAvailable(updateInfo, currentVersion) {
  return compareVersions(updateInfo.version, currentVersion) > 0;
}

// 获取下载 URL
function getDownloadUrl(updateInfo, platform = 'darwin', arch = 'x64') {
  if (platform === 'darwin') {
    return updateInfo.downloads?.macos?.[arch]?.url;
  } else if (platform === 'win32') {
    if (arch === 'x64') {
      return updateInfo.downloads?.windows?.x64?.url;
    } else {
      return updateInfo.downloads?.windows?.x86?.url;
    }
  }
  return null;
}

// 测试版本比较
function testVersionComparison() {
  console.log('🧪 测试版本比较功能...');
  
  const testCases = [
    ['4.2.0', '4.1.0', 1, '新版本 > 当前版本'],
    ['4.1.0', '4.2.0', -1, '当前版本 < 新版本'],
    ['4.1.0', '4.1.0', 0, '版本相同'],
    ['5.0.0', '4.9.9', 1, '主版本号升级'],
    ['4.1.1', '4.1.0', 1, '修订号升级'],
    ['4.2.0', '4.1.9', 1, '次版本号升级'],
  ];
  
  let passed = 0;
  for (const [v1, v2, expected, desc] of testCases) {
    const result = compareVersions(v1, v2);
    const pass = result === expected;
    console.log(`  ${pass ? '✅' : '❌'} ${v1} vs ${v2} = ${result} (期望: ${expected}) - ${desc}`);
    if (pass) passed++;
  }
  
  console.log(`📊 版本比较测试: ${passed}/${testCases.length} 通过\n`);
  return passed === testCases.length;
}

// 测试更新检查
async function testUpdateCheck() {
  console.log('🧪 测试更新检查功能...');
  
  const currentVersion = '4.1.0';
  
  try {
    const updateInfo = await fetchUpdateInfo('http://localhost:8889/updates.json');
    console.log(`📦 获取到版本信息: ${updateInfo.versionName}`);
    
    const hasUpdate = isUpdateAvailable(updateInfo, currentVersion);
    console.log(`🔍 是否有更新: ${hasUpdate ? '是' : '否'}`);
    
    if (hasUpdate) {
      console.log(`📝 更新类型: ${updateInfo.forceUpdate ? '强制更新' : '可选更新'}`);
      console.log(`📄 更新说明: ${updateInfo.releaseNotes.zh.split('\n')[0]}...`);
      
      // 测试下载链接
      const downloadUrl = getDownloadUrl(updateInfo, process.platform, process.arch);
      console.log(`🔗 下载链接: ${downloadUrl}`);
      
      // 验证下载链接
      if (downloadUrl) {
        const linkValid = await testDownloadLink(downloadUrl);
        console.log(`🌐 下载链接有效性: ${linkValid ? '有效' : '无效'}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ 更新检查失败:', error.message);
    return false;
  }
}

// 获取更新信息
function fetchUpdateInfo(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const updateInfo = JSON.parse(data);
          resolve(updateInfo);
        } catch (error) {
          reject(new Error('解析更新信息失败'));
        }
      });
    }).on('error', reject);
  });
}

// 测试下载链接
function testDownloadLink(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// 测试统计上报
async function testAnalyticsReporting() {
  console.log('📊 测试统计上报功能...');
  
  const testData = {
    reports: [{
      user_id: "user_test123456789",
      device_id: "device_test123456",
      date: "2024-01-26",
      app_version: "4.1.0",
      platform: "darwin",
      app_name: "Miaoda",
      summary: {
        session_count: 1,
        total_duration: 300,
        page_views: { "terminal": 5, "config": 2 },
        features_used: { "new_terminal": 1, "proxy_request": 10 }
      }
    }],
    client_time: new Date().toISOString()
  };
  
  try {
    const result = await postAnalyticsData('http://localhost:8889/api/analytics/batch', testData);
    console.log(`✅ 统计上报成功: ${result.message}`);
    console.log(`📈 成功处理: ${result.success_count} 条记录`);
    return true;
  } catch (error) {
    console.error('❌ 统计上报失败:', error.message);
    return false;
  }
}

// 发送统计数据
function postAnalyticsData(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.status === 'ok') {
            resolve(result);
          } else {
            reject(new Error(result.message || '上报失败'));
          }
        } catch (error) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 主测试函数
async function runTests() {
  console.log('🧪 Miaoda 更新功能逻辑测试');
  console.log('='.repeat(50));
  
  const results = {
    versionComparison: false,
    updateCheck: false,
    analyticsReporting: false
  };
  
  // 测试版本比较
  results.versionComparison = testVersionComparison();
  
  // 测试更新检查
  results.updateCheck = await testUpdateCheck();
  console.log();
  
  // 测试统计上报
  results.analyticsReporting = await testAnalyticsReporting();
  console.log();
  
  // 汇总结果
  console.log('📊 测试结果汇总:');
  console.log(`  版本比较: ${results.versionComparison ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  更新检查: ${results.updateCheck ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  统计上报: ${results.analyticsReporting ? '✅ 通过' : '❌ 失败'}`);
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 总体结果: ${totalPassed}/${totalTests} 测试通过`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 所有测试通过！更新功能逻辑正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查相关功能。');
  }
}

// 运行测试
runTests().catch(console.error);