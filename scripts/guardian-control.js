#!/usr/bin/env node
'use strict';

/**
 * 保活机制环境控制脚本
 * 用于在开发和生产环境之间切换保活功能
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

class GuardianEnvironmentController {
  constructor() {
    this.homeDir = os.homedir();
    this.launchAgentsDir = path.join(this.homeDir, 'Library/LaunchAgents');
    this.tempDir = os.tmpdir();
    this.disableMarker = '/tmp/MIAODA_DISABLED';
    
    this.launchAgents = [
      'com.miaoda.autostart.plist',
      'com.miaoda.guardian.plist'
    ];
    
    this.guardianScript = path.join(this.tempDir, 'miaoda-guardian.sh');
  }

  /**
   * 开发模式：禁用所有保活机制
   */
  async enableDevelopmentMode() {
    console.log('🔧 启用开发模式 - 禁用所有保活机制...');
    
    try {
      // 1. 创建禁用标记
      fs.writeFileSync(this.disableMarker, 'Development mode enabled');
      console.log('✅ 已创建禁用标记文件');
      
      // 2. 停止并禁用 LaunchAgent 服务
      for (const agent of this.launchAgents) {
        const agentPath = path.join(this.launchAgentsDir, agent);
        const disabledPath = `${agentPath}.disabled`;
        
        // 卸载服务
        await this.execCommand(`launchctl unload ${agentPath}`, true);
        
        // 重命名为禁用状态
        if (fs.existsSync(agentPath)) {
          fs.renameSync(agentPath, disabledPath);
          console.log(`✅ 已禁用 ${agent}`);
        }
      }
      
      // 3. 禁用守护脚本
      if (fs.existsSync(this.guardianScript)) {
        fs.renameSync(this.guardianScript, `${this.guardianScript}.disabled`);
        console.log('✅ 已禁用守护脚本');
      }
      
      // 4. 终止相关进程
      await this.killGuardianProcesses();
      
      console.log('🎉 开发模式已启用，所有保活机制已禁用');
      
    } catch (error) {
      console.error('❌ 启用开发模式失败:', error.message);
      throw error;
    }
  }

  /**
   * 生产模式：启用所有保活机制
   */
  async enableProductionMode() {
    console.log('🚀 启用生产模式 - 激活所有保活机制...');
    
    try {
      // 1. 删除禁用标记
      if (fs.existsSync(this.disableMarker)) {
        fs.unlinkSync(this.disableMarker);
        console.log('✅ 已删除禁用标记文件');
      }
      
      // 2. 恢复并启用 LaunchAgent 服务
      for (const agent of this.launchAgents) {
        const agentPath = path.join(this.launchAgentsDir, agent);
        const disabledPath = `${agentPath}.disabled`;
        
        // 恢复文件
        if (fs.existsSync(disabledPath)) {
          fs.renameSync(disabledPath, agentPath);
          console.log(`✅ 已恢复 ${agent}`);
          
          // 加载服务
          await this.execCommand(`launchctl load ${agentPath}`, true);
          console.log(`✅ 已启用 ${agent}`);
        }
      }
      
      // 3. 恢复守护脚本
      const disabledScript = `${this.guardianScript}.disabled`;
      if (fs.existsSync(disabledScript)) {
        fs.renameSync(disabledScript, this.guardianScript);
        console.log('✅ 已恢复守护脚本');
      }
      
      console.log('🎉 生产模式已启用，所有保活机制已激活');
      
    } catch (error) {
      console.error('❌ 启用生产模式失败:', error.message);
      throw error;
    }
  }

  /**
   * 检查当前状态
   */
  async checkStatus() {
    console.log('📊 检查保活机制状态...\n');
    
    const status = {
      mode: fs.existsSync(this.disableMarker) ? 'development' : 'production',
      disableMarker: fs.existsSync(this.disableMarker),
      launchAgents: {},
      guardianScript: {
        active: fs.existsSync(this.guardianScript),
        disabled: fs.existsSync(`${this.guardianScript}.disabled`)
      },
      processes: []
    };
    
    // 检查 LaunchAgent 状态
    for (const agent of this.launchAgents) {
      const agentPath = path.join(this.launchAgentsDir, agent);
      const disabledPath = `${agentPath}.disabled`;
      
      status.launchAgents[agent] = {
        active: fs.existsSync(agentPath),
        disabled: fs.existsSync(disabledPath)
      };
    }
    
    // 检查相关进程
    try {
      const processes = await this.execCommand('ps aux | grep -i miaoda | grep -v grep', true);
      status.processes = processes.split('\n').filter(line => line.trim());
    } catch (e) {
      // 没有相关进程
    }
    
    // 输出状态报告
    console.log(`当前模式: ${status.mode === 'development' ? '🔧 开发模式' : '🚀 生产模式'}`);
    console.log(`禁用标记: ${status.disableMarker ? '✅ 存在' : '❌ 不存在'}`);
    console.log('\nLaunchAgent 状态:');
    for (const [agent, state] of Object.entries(status.launchAgents)) {
      console.log(`  ${agent}: ${state.active ? '✅ 激活' : (state.disabled ? '🔒 禁用' : '❓ 未知')}`);
    }
    console.log(`\n守护脚本: ${status.guardianScript.active ? '✅ 激活' : (status.guardianScript.disabled ? '🔒 禁用' : '❓ 未知')}`);
    console.log(`相关进程: ${status.processes.length} 个`);
    
    if (status.processes.length > 0) {
      console.log('\n运行中的进程:');
      status.processes.forEach(proc => console.log(`  ${proc}`));
    }
    
    return status;
  }

  /**
   * 终止守护进程
   */
  async killGuardianProcesses() {
    try {
      const processes = await this.execCommand('ps aux | grep -i miaoda | grep -v grep', true);
      const lines = processes.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 1) {
          const pid = parts[1];
          try {
            process.kill(parseInt(pid), 'SIGTERM');
            console.log(`✅ 已终止进程 ${pid}`);
          } catch (e) {
            // 进程可能已经结束
          }
        }
      }
    } catch (e) {
      // 没有相关进程
    }
  }

  /**
   * 执行命令
   */
  execCommand(command, ignoreError = false) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error && !ignoreError) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

// CLI 接口
async function main() {
  const controller = new GuardianEnvironmentController();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'dev':
      case 'development':
        await controller.enableDevelopmentMode();
        break;
        
      case 'prod':
      case 'production':
        await controller.enableProductionMode();
        break;
        
      case 'status':
      case 'check':
        await controller.checkStatus();
        break;
        
      default:
        console.log(`
🛡️ 保活机制环境控制工具

用法:
  node scripts/guardian-control.js <命令>

命令:
  dev, development    启用开发模式（禁用所有保活机制）
  prod, production    启用生产模式（激活所有保活机制）
  status, check       检查当前状态

示例:
  node scripts/guardian-control.js dev     # 切换到开发模式
  node scripts/guardian-control.js prod    # 切换到生产模式
  node scripts/guardian-control.js status  # 查看当前状态
        `);
    }
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GuardianEnvironmentController;