'use strict';

const { app, dialog, shell } = require('electron');
const https = require('https');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const UPDATE_CHECK_URL = process.env.MIAODA_UPDATE_CHECK_URL || 'https://api.iclaudecode.cn/updates.json';
const CURRENT_VERSION = app.getVersion();

class Updater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateInfo = null;
    this.downloadProgress = 0;
  }

  // 检查更新
  async checkForUpdates(silent = false) {
    try {
      console.log('检查更新...');
      const updateInfo = await this.fetchUpdateInfo();
      
      if (this.isUpdateAvailable(updateInfo)) {
        this.updateInfo = updateInfo;
        
        if (updateInfo.forceUpdate) {
          // 强制更新
          this.showForceUpdateDialog(updateInfo);
        } else if (!silent) {
          // 可选更新
          this.showUpdateDialog(updateInfo);
        }
        
        return true;
      } else if (!silent) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '已经是最新版本',
          detail: `当前版本: ${CURRENT_VERSION}`,
          buttons: ['确定']
        });
      }
      
      return false;
    } catch (error) {
      console.error('检查更新失败:', error);
      if (!silent) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: '检查更新失败',
          message: '无法连接到更新服务器',
          detail: error.message,
          buttons: ['确定']
        });
      }
      return false;
    }
  }

  // 获取更新信息
  fetchUpdateInfo() {
    return new Promise((resolve, reject) => {
      https.get(UPDATE_CHECK_URL, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
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

  // 判断是否有更新
  isUpdateAvailable(updateInfo) {
    return this.compareVersions(updateInfo.version, CURRENT_VERSION) > 0;
  }

  // 比较版本号
  compareVersions(v1, v2) {
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

  // 显示强制更新对话框
  showForceUpdateDialog(updateInfo) {
    const message = updateInfo.updateMessage?.zh || '发现新版本，需要更新后才能继续使用。';
    const releaseNotes = updateInfo.releaseNotes?.zh || '';
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '需要更新',
      message: message,
      detail: `新版本: ${updateInfo.versionName}\n\n更新内容:\n${releaseNotes}`,
      buttons: ['立即更新', '退出程序'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        this.downloadAndOpen(updateInfo);
      } else {
        app.quit();
      }
    });
  }

  // 显示可选更新对话框
  showUpdateDialog(updateInfo) {
    const message = updateInfo.updateMessage?.zh || '发现新版本，建议更新以获得更好的体验。';
    const releaseNotes = updateInfo.releaseNotes?.zh || '';
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: message,
      detail: `新版本: ${updateInfo.versionName}\n当前版本: v${CURRENT_VERSION}\n\n更新内容:\n${releaseNotes}`,
      buttons: ['立即更新', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        this.downloadAndOpen(updateInfo);
      } else if (result.response === 2) {
        // 记录跳过的版本
        this.skipVersion(updateInfo.version);
      }
    });
  }

  // 获取下载URL
  getDownloadUrl(updateInfo) {
    const platform = process.platform;
    const arch = process.arch;
    
    if (platform === 'darwin') {
      // macOS
      if (arch === 'arm64') {
        return updateInfo.downloads.macos.arm64.url;
      } else {
        return updateInfo.downloads.macos.x64.url;
      }
    } else if (platform === 'win32') {
      // Windows
      if (arch === 'x64') {
        return updateInfo.downloads.windows.x64.url;
      } else {
        return updateInfo.downloads.windows.x86.url;
      }
    }
    
    throw new Error('不支持的平台');
  }

  // 下载并打开更新
  async downloadAndOpen(updateInfo) {
    try {
      const downloadUrl = this.getDownloadUrl(updateInfo);
      
      // 直接在浏览器中打开下载链接
      shell.openExternal(downloadUrl);
      
      // 显示提示
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '下载更新',
        message: '更新下载已开始',
        detail: '下载完成后，请手动安装新版本。',
        buttons: ['确定']
      });
      
    } catch (error) {
      dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        title: '下载失败',
        message: '无法下载更新',
        detail: error.message,
        buttons: ['确定']
      });
    }
  }

  // 下载文件（备用方法，用于后续实现应用内下载）
  async downloadFile(url, savePath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(savePath);
      
      https.get(url, (response) => {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          file.write(chunk);
          
          if (onProgress && totalSize) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });
        
        response.on('end', () => {
          file.end();
          resolve();
        });
        
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  // 验证文件校验和
  async verifyChecksum(filePath, expectedChecksum) {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    const actualChecksum = `sha256:${hash.digest('hex')}`;
    return actualChecksum === expectedChecksum;
  }

  // 跳过版本
  skipVersion(version) {
    const Store = require('electron-store');
    const store = new Store();
    const skippedVersions = store.get('skippedVersions', []);
    if (!skippedVersions.includes(version)) {
      skippedVersions.push(version);
      store.set('skippedVersions', skippedVersions);
    }
  }

  // 设置自动检查更新
  setupAutoCheck() {
    // 应用启动后延迟检查
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 10000); // 10秒后

    // 每隔30分钟检查一次
    setInterval(() => {
      this.checkForUpdates(true);
    }, 30 * 60 * 1000);
  }
}

module.exports = Updater;