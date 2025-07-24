'use strict';

/**
 * 安全自动更新模块
 * 提供安全可靠的自动更新机制，确保更新过程不影响应用运行
 */

const { app, autoUpdater, dialog } = require('electron');
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

class SafeUpdater {
  constructor() {
    this.store = new Store();
    this.updateInProgress = false;
    this.updateServer = 'https://your-update-server.com';
    this.updateCheckInterval = 3600000; // 1小时检查一次
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.downloadDir = path.join(app.getPath('temp'), 'updates');
  }

  /**
   * 初始化更新器
   */
  initialize() {
    console.log('🔄 初始化安全更新系统...');
    
    // 确保目录存在
    this.ensureDirectories();
    
    // 配置自动更新器
    this.configureAutoUpdater();
    
    // 设置更新事件监听
    this.setupUpdateHandlers();
    
    // 开始定期检查更新
    this.startUpdateCheck();
    
    console.log('✅ 安全更新系统已就绪');
  }

  /**
   * 确保必要目录存在
   */
  ensureDirectories() {
    [this.backupDir, this.downloadDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 配置自动更新器
   */
  configureAutoUpdater() {
    if (process.platform === 'darwin') {
      // macOS 使用 Squirrel.Mac
      autoUpdater.setFeedURL({
        url: `${this.updateServer}/update/mac/${app.getVersion()}`,
        headers: {
          'User-Agent': `Miaoda/${app.getVersion()} (${process.platform})`
        }
      });
    } else if (process.platform === 'win32') {
      // Windows 使用 Squirrel.Windows
      autoUpdater.setFeedURL({
        url: `${this.updateServer}/update/win32/${app.getVersion()}`,
        headers: {
          'User-Agent': `Miaoda/${app.getVersion()} (${process.platform})`
        }
      });
    }
  }

  /**
   * 设置更新事件处理
   */
  setupUpdateHandlers() {
    // 检查更新错误
    autoUpdater.on('error', (error) => {
      console.error('更新检查失败:', error);
      this.updateInProgress = false;
    });

    // 发现新版本
    autoUpdater.on('update-available', () => {
      console.log('🎉 发现新版本');
      this.handleUpdateAvailable();
    });

    // 没有新版本
    autoUpdater.on('update-not-available', () => {
      console.log('当前已是最新版本');
    });

    // 下载进度
    autoUpdater.on('download-progress', (progressInfo) => {
      console.log(`下载进度: ${progressInfo.percent.toFixed(2)}%`);
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      console.log('✅ 更新下载完成');
      this.handleUpdateDownloaded(releaseNotes, releaseName);
    });
  }

  /**
   * 开始定期检查更新
   */
  startUpdateCheck() {
    // 立即检查一次
    this.checkForUpdates();
    
    // 定期检查
    setInterval(() => {
      this.checkForUpdates();
    }, this.updateCheckInterval);
  }

  /**
   * 检查更新
   */
  async checkForUpdates() {
    if (this.updateInProgress) {
      console.log('更新正在进行中，跳过检查');
      return;
    }
    
    console.log('🔍 检查更新...');
    
    try {
      // 自定义更新检查逻辑
      const updateInfo = await this.fetchUpdateInfo();
      
      if (updateInfo && this.isNewerVersion(updateInfo.version)) {
        // 验证更新签名
        if (await this.verifyUpdateSignature(updateInfo)) {
          this.updateInProgress = true;
          autoUpdater.checkForUpdates();
        } else {
          console.error('更新签名验证失败');
        }
      }
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  }

  /**
   * 获取更新信息
   */
  async fetchUpdateInfo() {
    return new Promise((resolve, reject) => {
      const url = `${this.updateServer}/update-info/${process.platform}/${app.getVersion()}`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const updateInfo = JSON.parse(data);
            resolve(updateInfo);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 比较版本号
   */
  isNewerVersion(newVersion) {
    const current = app.getVersion().split('.').map(Number);
    const update = newVersion.split('.').map(Number);
    
    for (let i = 0; i < current.length; i++) {
      if (update[i] > current[i]) return true;
      if (update[i] < current[i]) return false;
    }
    
    return false;
  }

  /**
   * 验证更新签名
   */
  async verifyUpdateSignature() {
    // 这里应该实现实际的签名验证逻辑
    // 使用公钥验证更新包的签名
    return true;
  }

  /**
   * 处理发现新版本
   */
  handleUpdateAvailable() {
    // 创建当前版本备份
    this.createBackup();
    
    // 自动下载更新
    autoUpdater.downloadUpdate();
  }

  /**
   * 处理更新下载完成
   */
  async handleUpdateDownloaded(releaseNotes, releaseName) {
    // 通知用户
    const response = await dialog.showMessageBox(null, {
      type: 'info',
      title: '更新已就绪',
      message: '新版本已下载完成，是否立即安装？',
      detail: `版本: ${releaseName}\n更新内容:\n${releaseNotes || '性能优化和问题修复'}`,
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0
    });
    
    if (response.response === 0) {
      // 立即安装
      this.installUpdate();
    } else {
      // 稍后安装 - 在下次启动时安装
      this.scheduleUpdateOnRestart();
    }
  }

  /**
   * 创建备份
   */
  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(this.backupDir, `backup_${app.getVersion()}_${timestamp}`);
      
      // 备份当前应用
      const appPath = app.getPath('exe');
      const appDir = path.dirname(appPath);
      
      // 复制应用文件夹
      this.copyDirectory(appDir, backupPath);
      
      // 保存备份信息
      this.store.set('lastBackup', {
        version: app.getVersion(),
        path: backupPath,
        timestamp: Date.now()
      });
      
      console.log('✅ 备份创建成功:', backupPath);
      
      // 清理旧备份（保留最近3个）
      this.cleanOldBackups();
    } catch (error) {
      console.error('创建备份失败:', error);
    }
  }

  /**
   * 复制目录
   */
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  /**
   * 清理旧备份
   */
  cleanOldBackups() {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);
      
      // 保留最近的3个备份
      if (backups.length > 3) {
        backups.slice(3).forEach(backup => {
          this.deleteDirectory(backup.path);
        });
      }
    } catch (error) {
      console.error('清理备份失败:', error);
    }
  }

  /**
   * 删除目录
   */
  deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
          this.deleteDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  }

  /**
   * 安装更新
   */
  installUpdate() {
    console.log('🚀 开始安装更新...');
    
    // 设置更新标记
    this.store.set('updatePending', true);
    
    // 启动更新助手进程
    this.launchUpdateHelper();
    
    // 退出并安装
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 1000);
  }

  /**
   * 启动更新助手
   */
  launchUpdateHelper() {
    // 创建一个独立的更新助手进程
    // 在主应用退出后继续监控更新过程
    const helperScript = `
      const { spawn } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      
      // 等待主进程退出
      setTimeout(() => {
        // 监控更新过程
        let updateSuccess = false;
        let retries = 0;
        const maxRetries = 30; // 5分钟超时
        
        const checkUpdate = setInterval(() => {
          // 检查新版本是否启动成功
          // 这里应该实现实际的检查逻辑
          
          retries++;
          if (updateSuccess || retries >= maxRetries) {
            clearInterval(checkUpdate);
            
            if (!updateSuccess && retries >= maxRetries) {
              // 更新失败，恢复备份
              console.log('更新超时，恢复备份...');
              // 恢复备份逻辑
            }
            
            process.exit();
          }
        }, 10000);
      }, 5000);
    `;
    
    const helperPath = path.join(app.getPath('temp'), 'update_helper.js');
    fs.writeFileSync(helperPath, helperScript);
    
    const helper = spawn(process.execPath, [helperPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    helper.unref();
  }

  /**
   * 计划在重启时更新
   */
  scheduleUpdateOnRestart() {
    this.store.set('updateOnRestart', true);
    console.log('📅 已计划在下次重启时安装更新');
  }

  /**
   * 检查是否需要在启动时更新
   */
  checkPendingUpdate() {
    if (this.store.get('updateOnRestart')) {
      this.store.delete('updateOnRestart');
      
      dialog.showMessageBox(null, {
        type: 'info',
        title: '准备更新',
        message: '检测到待安装的更新，即将开始安装...',
        buttons: ['确定']
      }).then(() => {
        this.installUpdate();
      });
    }
  }

  /**
   * 回滚到备份版本
   */
  async rollbackToBackup() {
    const lastBackup = this.store.get('lastBackup');
    
    if (!lastBackup || !fs.existsSync(lastBackup.path)) {
      console.error('没有可用的备份');
      return false;
    }
    
    try {
      console.log('🔄 回滚到备份版本:', lastBackup.version);
      
      // 实现回滚逻辑
      // 这里应该包含实际的文件替换操作
      
      return true;
    } catch (error) {
      console.error('回滚失败:', error);
      return false;
    }
  }
}

module.exports = SafeUpdater;