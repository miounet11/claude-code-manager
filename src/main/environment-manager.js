'use strict';

const { checkEnvironment, getSystemInfo, setDebugMode } = require('./environment-v2');
const { installDependency, installMultipleDependencies } = require('./installer-v2');
const { app, dialog } = require('electron');

/**
 * 环境管理器 - 统一管理环境检测和依赖安装
 */
class EnvironmentManager {
  constructor() {
    this.debugMode = true;
    this.lastCheckResult = null;
    this.isChecking = false;
    this.isInstalling = false;
    
    // 开启调试模式
    setDebugMode(true);
  }
  
  /**
   * 检查所有环境
   */
  async checkAll() {
    if (this.isChecking) {
      console.log('[EnvironmentManager] 环境检查正在进行中...');
      return this.lastCheckResult;
    }
    
    this.isChecking = true;
    console.log('[EnvironmentManager] 开始检查所有环境...');
    
    try {
      const result = await checkEnvironment();
      this.lastCheckResult = result;
      
      // 添加系统信息用于调试
      if (this.debugMode) {
        const systemInfo = await getSystemInfo();
        console.log('[EnvironmentManager] 系统信息:', JSON.stringify(systemInfo, null, 2));
      }
      
      console.log('[EnvironmentManager] 环境检查完成:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[EnvironmentManager] 环境检查失败:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }
  
  /**
   * 安装单个依赖
   */
  async install(dependency) {
    if (this.isInstalling) {
      throw new Error('安装正在进行中，请稍后再试');
    }
    
    this.isInstalling = true;
    console.log(`[EnvironmentManager] 开始安装: ${dependency}`);
    
    try {
      const result = await installDependency(dependency);
      
      if (result.success) {
        console.log(`[EnvironmentManager] ${dependency} 安装成功`);
        
        // 安装成功后重新检查环境
        await this.checkAll();
      } else {
        console.log(`[EnvironmentManager] ${dependency} 安装失败:`, result.message);
        
        // 如果有手动安装说明，显示给用户
        if (result.details && result.details.instructions) {
          this.showInstallInstructions(dependency, result);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`[EnvironmentManager] 安装 ${dependency} 时出错:`, error);
      throw error;
    } finally {
      this.isInstalling = false;
    }
  }
  
  /**
   * 批量安装缺失的依赖
   */
  async installMissing(progressCallback) {
    if (!this.lastCheckResult) {
      await this.checkAll();
    }
    
    // 找出未安装的依赖
    const missing = [];
    for (const [key, value] of Object.entries(this.lastCheckResult)) {
      if (!value.installed) {
        missing.push(key);
      }
    }
    
    if (missing.length === 0) {
      console.log('[EnvironmentManager] 所有依赖已安装');
      return { success: true, message: '所有依赖已安装' };
    }
    
    console.log(`[EnvironmentManager] 需要安装的依赖: ${missing.join(', ')}`);
    
    // 调整安装顺序：Node.js 和 Git 需要手动安装
    const manualDeps = [];
    const autoDeps = [];
    
    for (const dep of missing) {
      if (dep === 'nodejs' || dep === 'git') {
        manualDeps.push(dep);
      } else {
        autoDeps.push(dep);
      }
    }
    
    // 如果有需要手动安装的依赖
    if (manualDeps.length > 0) {
      const results = {};
      
      for (const dep of manualDeps) {
        const result = await installDependency(dep);
        results[dep] = result;
        
        if (!result.success && result.details && result.details.instructions) {
          this.showInstallInstructions(dep, result);
        }
      }
      
      // 然后尝试自动安装其他依赖
      if (autoDeps.length > 0) {
        const autoResults = await installMultipleDependencies(autoDeps, progressCallback);
        Object.assign(results, autoResults);
      }
      
      return results;
    }
    
    // 只有自动安装的依赖
    return await installMultipleDependencies(missing, progressCallback);
  }
  
  /**
   * 显示手动安装说明
   */
  showInstallInstructions(dependency, result) {
    const instructions = result.details.instructions.join('\n');
    const message = `${dependency} 需要手动安装：\n\n${instructions}`;
    
    console.log(`[EnvironmentManager] 显示安装说明: ${dependency}`);
    
    // 如果有下载链接
    if (result.details.downloadUrl) {
      dialog.showMessageBox({
        type: 'info',
        title: `安装 ${dependency}`,
        message: message,
        buttons: ['打开下载页面', '稍后'],
        defaultId: 0
      }).then(response => {
        if (response.response === 0) {
          require('electron').shell.openExternal(result.details.downloadUrl);
        }
      });
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: `安装 ${dependency}`,
        message: message,
        buttons: ['确定']
      });
    }
  }
  
  /**
   * 获取环境状态摘要
   */
  getSummary() {
    if (!this.lastCheckResult) {
      return {
        ready: false,
        message: '环境未检查'
      };
    }
    
    const installed = [];
    const missing = [];
    
    for (const [key, value] of Object.entries(this.lastCheckResult)) {
      if (value.installed) {
        installed.push(key);
      } else {
        missing.push(key);
      }
    }
    
    if (missing.length === 0) {
      return {
        ready: true,
        message: '所有依赖已就绪',
        installed,
        missing
      };
    }
    
    return {
      ready: false,
      message: `缺少 ${missing.length} 个依赖`,
      installed,
      missing
    };
  }
  
  /**
   * 调试环境
   */
  async debug() {
    console.log('[EnvironmentManager] === 开始调试环境 ===');
    
    // 1. 系统信息
    const systemInfo = await getSystemInfo();
    console.log('[EnvironmentManager] 系统信息:', JSON.stringify(systemInfo, null, 2));
    
    // 2. 环境检查
    const envCheck = await this.checkAll();
    console.log('[EnvironmentManager] 环境检查结果:', JSON.stringify(envCheck, null, 2));
    
    // 3. 返回调试信息
    return {
      system: systemInfo,
      environment: envCheck,
      summary: this.getSummary()
    };
  }
}

// 创建单例
const environmentManager = new EnvironmentManager();

module.exports = environmentManager;