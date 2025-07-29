'use strict';

/**
 * 综合测试运行器
 * 运行所有测试并生成测试报告
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const testFiles = [
  // 现有测试
  'test-new-features.js',
  'test-config-save-and-apply.js',
  'test-claude-detection.js',
  'test-environment-detection.js',
  'test-dynamic-path-finding.js',
  'test-restore-default-config.js',
  'test-update-flow.js',
  'test-update-logic.js',
  // 新增测试
  'test-proxy-server.js',
  'test-terminal-module.js',
  'test-integration.js'
];

const testResults = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

console.log('🚀 Miaoda 综合测试套件\n');
console.log(`📋 准备运行 ${testFiles.length} 个测试文件...\n`);

/**
 * 运行单个测试文件
 */
async function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`▶️  运行测试: ${testFile}`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();
    const testPath = path.join(__dirname, testFile);
    
    // 检查文件是否存在
    fs.access(testPath).then(() => {
      const child = spawn('node', [testPath], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        process.stdout.write(str);
      });

      child.stderr.on('data', (data) => {
        const str = data.toString();
        errorOutput += str;
        process.stderr.write(str);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const passed = code === 0;
        
        // 分析输出以获取详细统计
        const passCount = (output.match(/✅/g) || []).length;
        const failCount = (output.match(/❌/g) || []).length;
        const warnCount = (output.match(/⚠️/g) || []).length;

        const result = {
          file: testFile,
          passed,
          duration,
          exitCode: code,
          stats: {
            pass: passCount,
            fail: failCount,
            warn: warnCount
          },
          output,
          errorOutput
        };

        testResults.push(result);
        totalTests++;
        
        if (passed) {
          passedTests++;
          console.log(`\n✅ 测试通过 (耗时: ${duration}ms)\n`);
        } else {
          failedTests++;
          console.log(`\n❌ 测试失败 (退出码: ${code}, 耗时: ${duration}ms)\n`);
        }

        resolve(result);
      });
    }).catch(() => {
      // 文件不存在
      console.log(`⚠️  测试文件不存在: ${testFile}\n`);
      const result = {
        file: testFile,
        passed: false,
        skipped: true,
        error: '文件不存在'
      };
      testResults.push(result);
      skippedTests++;
      resolve(result);
    });
  });
}

/**
 * 生成测试报告
 */
async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试报告总结');
  console.log('='.repeat(80) + '\n');

  console.log(`总测试文件数: ${totalTests}`);
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`⚠️  跳过: ${skippedTests}`);
  console.log(`成功率: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0}%\n`);

  console.log('详细结果:');
  console.log('-'.repeat(80));
  console.log('测试文件'.padEnd(35) + '状态'.padEnd(10) + '耗时'.padEnd(10) + '统计');
  console.log('-'.repeat(80));

  for (const result of testResults) {
    const status = result.skipped ? '⚠️  跳过' : (result.passed ? '✅ 通过' : '❌ 失败');
    const duration = result.duration ? `${result.duration}ms` : '-';
    const stats = result.stats ? 
      `✅:${result.stats.pass} ❌:${result.stats.fail} ⚠️:${result.stats.warn}` : 
      '-';
    
    console.log(
      result.file.padEnd(35) + 
      status.padEnd(10) + 
      duration.padEnd(10) + 
      stats
    );
  }

  console.log('-'.repeat(80));

  // 生成 HTML 报告
  const htmlReport = await generateHTMLReport();
  const reportPath = path.join(__dirname, 'test-report.html');
  await fs.writeFile(reportPath, htmlReport);
  console.log(`\n📄 HTML 测试报告已生成: ${reportPath}`);

  // 如果有失败的测试，显示失败详情
  const failedResults = testResults.filter(r => !r.passed && !r.skipped);
  if (failedResults.length > 0) {
    console.log('\n❌ 失败测试详情:');
    console.log('='.repeat(80));
    
    for (const failed of failedResults) {
      console.log(`\n文件: ${failed.file}`);
      console.log(`退出码: ${failed.exitCode}`);
      if (failed.errorOutput) {
        console.log('错误输出:');
        console.log(failed.errorOutput.substring(0, 500));
      }
    }
  }

  return passedTests === totalTests - skippedTests;
}

/**
 * 生成 HTML 报告
 */
async function generateHTMLReport() {
  const timestamp = new Date().toLocaleString('zh-CN');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Miaoda 测试报告 - ${timestamp}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            margin: 0;
            color: #333;
        }
        .summary {
            display: flex;
            gap: 20px;
            margin-top: 20px;
        }
        .summary-item {
            flex: 1;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            text-align: center;
        }
        .summary-item.passed { background: #d4edda; color: #155724; }
        .summary-item.failed { background: #f8d7da; color: #721c24; }
        .summary-item.skipped { background: #fff3cd; color: #856404; }
        .test-results {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-skip { color: #ffc107; }
        .details {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Miaoda 测试报告</h1>
        <p>生成时间：${timestamp}</p>
        <div class="summary">
            <div class="summary-item">
                <h3>${totalTests}</h3>
                <p>总测试数</p>
            </div>
            <div class="summary-item passed">
                <h3>${passedTests}</h3>
                <p>通过</p>
            </div>
            <div class="summary-item failed">
                <h3>${failedTests}</h3>
                <p>失败</p>
            </div>
            <div class="summary-item skipped">
                <h3>${skippedTests}</h3>
                <p>跳过</p>
            </div>
        </div>
    </div>

    <div class="test-results">
        <h2>测试详情</h2>
        <table>
            <thead>
                <tr>
                    <th>测试文件</th>
                    <th>状态</th>
                    <th>耗时</th>
                    <th>统计</th>
                </tr>
            </thead>
            <tbody>
                ${testResults.map(result => `
                <tr>
                    <td>${result.file}</td>
                    <td class="${result.skipped ? 'status-skip' : (result.passed ? 'status-pass' : 'status-fail')}">
                        ${result.skipped ? '⚠️ 跳过' : (result.passed ? '✅ 通过' : '❌ 失败')}
                    </td>
                    <td>${result.duration ? result.duration + 'ms' : '-'}</td>
                    <td>${result.stats ? 
                        `✅:${result.stats.pass} ❌:${result.stats.fail} ⚠️:${result.stats.warn}` : 
                        '-'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>

    ${failedTests > 0 ? `
    <div class="test-results" style="margin-top: 20px;">
        <h2>❌ 失败测试详情</h2>
        ${testResults.filter(r => !r.passed && !r.skipped).map(result => `
        <div style="margin-bottom: 20px;">
            <h3>${result.file}</h3>
            <p>退出码: ${result.exitCode}</p>
            ${result.errorOutput ? `
            <div class="details">
                <pre>${result.errorOutput}</pre>
            </div>` : ''}
        </div>`).join('')}
    </div>` : ''}
</body>
</html>`;
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now();

  // 依次运行所有测试
  for (const testFile of testFiles) {
    await runTest(testFile);
  }

  // 生成报告
  const allPassed = await generateReport();
  
  const totalDuration = Date.now() - startTime;
  console.log(`\n⏱️  总耗时: ${(totalDuration / 1000).toFixed(2)}秒\n`);

  if (allPassed) {
    console.log('🎉 所有测试通过！\n');
    process.exit(0);
  } else {
    console.log('❌ 存在失败的测试，请查看上面的详细信息。\n');
    process.exit(1);
  }
}

// 运行测试
main().catch(error => {
  console.error('测试运行器错误:', error);
  process.exit(1);
});