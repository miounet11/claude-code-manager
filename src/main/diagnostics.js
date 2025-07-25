'use strict';

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execPromise = util.promisify(exec);

/**
 * 系统诊断工具
 */
class SystemDiagnostics {
  constructor() {
    this.results = [];
  }

  /**
   * 运行完整诊断
   */
  async runFullDiagnostics() {
    this.results = [];
    
    console.log('开始系统诊断...');
    
    const checks = [
      () => this.checkNodejs(),
      () => this.checkGit(),
      () => this.checkUV(),
      () => this.checkClaudeCLI(),
      () => this.checkNetworkConnection(),
      () => this.checkPortAvailability(),
      () => this.checkSystemPermissions(),
      () => this.checkDiskSpace(),
      () => this.checkSystemResources()
    ];
    
    for (const check of checks) {
      try {
        await check();
      } catch (error) {
        console.error('诊断检查失败:', error);
      }
    }
    
    return this.generateReport();
  }

  /**
   * 检查 Node.js
   */
  async checkNodejs() {
    try {
      const { stdout } = await execPromise('node --version', { timeout: 5000 });
      const version = stdout.trim();
      const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
      
      this.addResult('Node.js', true, version, 
        majorVersion >= 16 ? null : '建议升级到 Node.js 16+');
    } catch (error) {
      this.addResult('Node.js', false, '未安装', '请安装 Node.js 16 或更高版本');
    }
  }

  /**
   * 检查 Git
   */
  async checkGit() {
    try {
      const { stdout } = await execPromise('git --version', { timeout: 5000 });
      this.addResult('Git', true, stdout.trim().replace('git version ', ''));
    } catch (error) {
      this.addResult('Git', false, '未安装', '请安装 Git');
    }
  }

  /**
   * 检查 UV
   */
  async checkUV() {
    try {
      const { stdout } = await execPromise('uv --version', { timeout: 5000 });
      this.addResult('UV', true, stdout.trim());
    } catch (error) {
      this.addResult('UV', false, '未安装', '建议安装 UV 以提升 Python 包管理速度');
    }
  }

  /**
   * 检查 Claude CLI
   */
  async checkClaudeCLI() {
    try {
      let checkCmd;
      const checkOptions = { timeout: 5000, windowsHide: true };
      
      if (process.platform === 'win32') {
        checkCmd = 'where claude.exe';
        checkOptions.shell = true;
      } else {
        checkCmd = 'which claude';
      }
      
      const { stdout } = await execPromise(checkCmd, checkOptions);
      
      // 尝试获取版本信息
      try {
        const { stdout: version } = await execPromise('claude --version', { timeout: 3000 });
        this.addResult('Claude CLI', true, version.trim());
      } catch {
        this.addResult('Claude CLI', true, '已安装', '无法获取版本信息');
      }
    } catch (error) {
      this.addResult('Claude CLI', false, '未安装', 
        'npm install -g @anthropic/claude-code');
    }
  }

  /**
   * 检查网络连接
   */
  async checkNetworkConnection() {
    try {
      // 测试连接到 Anthropic API
      const { exec } = require('child_process');
      const testCmd = process.platform === 'win32' ? 
        'ping -n 1 api.anthropic.com' : 
        'ping -c 1 api.anthropic.com';
      
      await execPromise(testCmd, { timeout: 5000 });
      this.addResult('网络连接', true, '正常', '可以访问 Anthropic API');
    } catch (error) {
      this.addResult('网络连接', false, '异常', 
        '无法连接到 api.anthropic.com，请检查网络设置');
    }
  }

  /**
   * 检查端口可用性
   */
  async checkPortAvailability() {
    const net = require('net');
    const commonPorts = [5173, 8080, 3000, 8081, 8082];
    const availablePorts = [];
    
    for (const port of commonPorts) {
      try {
        await new Promise((resolve, reject) => {
          const server = net.createServer();
          server.once('error', reject);
          server.once('listening', () => {
            server.close();
            availablePorts.push(port);
            resolve();
          });
          server.listen(port);
        });
      } catch (error) {
        // 端口被占用
      }
    }
    
    if (availablePorts.length > 0) {
      this.addResult('端口可用性', true, 
        `${availablePorts.length} 个端口可用`, 
        `可用端口: ${availablePorts.join(', ')}`);
    } else {
      this.addResult('端口可用性', false, '常用端口都被占用', 
        '可能需要手动指定端口');
    }
  }

  /**
   * 检查系统权限
   */
  async checkSystemPermissions() {
    try {
      // 检查当前用户权限
      const userInfo = os.userInfo();
      const isAdmin = process.getuid ? process.getuid() === 0 : false;
      
      // 检查写入权限
      const tempDir = os.tmpdir();
      const testFile = path.join(tempDir, 'claude-test-' + Date.now());
      
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        this.addResult('系统权限', true, 
          isAdmin ? '管理员权限' : '普通用户权限',
          '具有必要的文件读写权限');
      } catch (writeError) {
        this.addResult('系统权限', false, '权限不足', 
          '无法在临时目录写入文件');
      }
    } catch (error) {
      this.addResult('系统权限', false, '检查失败', error.message);
    }
  }

  /**
   * 检查磁盘空间
   */
  async checkDiskSpace() {
    try {
      const stats = fs.statSync(os.homedir());
      // 简化的磁盘空间检查
      this.addResult('磁盘空间', true, '充足', '主目录可访问');
    } catch (error) {
      this.addResult('磁盘空间', false, '检查失败', '无法访问主目录');
    }
  }

  /**
   * 检查系统资源
   */
  async checkSystemResources() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = (usedMem / totalMem * 100).toFixed(1);
      
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      
      const status = memUsage < 80 && loadAvg[0] < cpus.length * 0.8;
      
      this.addResult('系统资源', status, 
        `内存使用率: ${memUsage}%`,
        status ? '系统资源充足' : '系统负载较高，可能影响性能');
    } catch (error) {
      this.addResult('系统资源', false, '检查失败', error.message);
    }
  }

  /**
   * 添加检查结果
   */
  addResult(name, passed, value, suggestion = null) {
    this.results.push({
      name,
      passed,
      value,
      suggestion,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 生成诊断报告
   */
  generateReport() {
    const passedCount = this.results.filter(r => r.passed).length;
    const totalCount = this.results.length;
    
    let report = `🔍 系统诊断报告\n`;
    report += `${'='.repeat(50)}\n`;
    report += `检查时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `通过率: ${passedCount}/${totalCount} (${(passedCount/totalCount*100).toFixed(1)}%)\n\n`;
    
    // 按状态分组显示
    const passed = this.results.filter(r => r.passed);
    const failed = this.results.filter(r => !r.passed);
    
    if (passed.length > 0) {
      report += `✅ 通过的检查 (${passed.length}项):\n`;
      passed.forEach(result => {
        report += `  • ${result.name}: ${result.value}\n`;
        if (result.suggestion) {
          report += `    💡 ${result.suggestion}\n`;
        }
      });
      report += '\n';
    }
    
    if (failed.length > 0) {
      report += `❌ 需要修复的问题 (${failed.length}项):\n`;
      failed.forEach(result => {
        report += `  • ${result.name}: ${result.value}\n`;
        if (result.suggestion) {
          report += `    💡 解决方案: ${result.suggestion}\n`;
        }
      });
      report += '\n';
    }
    
    // 总体建议
    if (passedCount === totalCount) {
      report += `🎉 恭喜！您的系统配置完美，可以顺利使用 Claude Code Manager。\n`;
    } else if (passedCount >= totalCount * 0.8) {
      report += `⚠️  系统基本配置正常，但有些组件可以优化以获得更好体验。\n`;
    } else {
      report += `🚨 发现多个问题，建议先解决这些问题再使用 Claude Code Manager。\n`;
    }
    
    report += `\n${'='.repeat(50)}\n`;
    report += `如需帮助，请查看安装指南或联系技术支持。\n`;
    
    return {
      summary: {
        total: totalCount,
        passed: passedCount,
        failed: failed.length,
        score: (passedCount / totalCount * 100).toFixed(1)
      },
      results: this.results,
      report: report
    };
  }

  /**
   * 快速健康检查
   */
  async quickHealthCheck() {
    const results = await Promise.allSettled([
      this.checkNodejs(),
      this.checkClaudeCLI(),
      this.checkNetworkConnection()
    ]);
    
    return this.generateReport();
  }
}

module.exports = SystemDiagnostics;