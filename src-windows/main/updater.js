'use strict';

const { app, dialog, shell } = require('electron');
const https = require('https');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const UPDATE_CHECK_URL = process.env.MIAODA_UPDATE_CHECK_URL || 'https://api.iclaudecode.cn/updates.json';
const CURRENT_VERSION = app.getVersion();

/**
 * Windows 版本更新检查器
 * 针对 Windows 平台优化的更新管理
 */
class WindowsUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.windowsArch = this.getWindowsArchitecture();
  }

  // 获取 Windows 架构信息
  getWindowsArchitecture() {
    const arch = os.arch();
    const is64Bit = arch === 'x64' || process.env.PROCESSOR_ARCHITEW6432;
    
    return {
      arch: arch,
      is64Bit: is64Bit,
      preferredArch: is64Bit ? 'x64' : 'x86',
      osVersion: os.release(),
      platform: 'win32'
    };
  }

  // 检查更新
  async checkForUpdates(silent = false) {
    try {
      console.log('🪟 Windows Updater: 检查更新...');
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
          detail: `当前版本: ${CURRENT_VERSION}\nWindows ${this.windowsArch.preferredArch} 版本`,
          buttons: ['确定']
        });
      }
      
      return false;
    } catch (error) {
      console.error('🪟 Windows Updater: 检查更新失败:', error);
      if (!silent) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: '检查更新失败',
          message: '无法连接到更新服务器',
          detail: `错误信息: ${error.message}\n\n请检查网络连接或稍后重试`,
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
    const message = updateInfo.updateMessage?.zh || '发现重要更新，需要更新后才能继续使用。';
    const releaseNotes = updateInfo.releaseNotes?.zh || '';
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      title: '需要更新 - Windows 版本',
      message: message,
      detail: `新版本: ${updateInfo.versionName}\n当前版本: v${CURRENT_VERSION}\n\n更新内容:\n${releaseNotes}\n\n⚠️ 这是一个重要的安全更新，必须安装才能继续使用。`,
      buttons: ['立即更新', '退出程序'],
      defaultId: 0,
      cancelId: 1,
      icon: path.join(__dirname, '../../assets/icon.ico')
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
      title: '发现新版本 - Windows 版本',
      message: message,
      detail: `新版本: ${updateInfo.versionName}\n当前版本: v${CURRENT_VERSION}\nWindows ${this.windowsArch.preferredArch} 架构\n\n更新内容:\n${releaseNotes}`,
      buttons: ['立即更新', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1,
      icon: path.join(__dirname, '../../assets/icon.ico')
    }).then(result => {
      if (result.response === 0) {
        this.downloadAndOpen(updateInfo);
      } else if (result.response === 2) {
        // 记录跳过的版本
        this.skipVersion(updateInfo.version);
      }
    });
  }

  // 获取 Windows 下载URL
  getDownloadUrl(updateInfo) {
    const windowsDownloads = updateInfo.downloads?.windows;
    if (!windowsDownloads) {
      throw new Error('没有找到 Windows 版本的下载链接');
    }
    
    // 优先选择适合的架构
    const preferredArch = this.windowsArch.preferredArch;
    
    if (windowsDownloads[preferredArch]) {
      return windowsDownloads[preferredArch].url;
    }
    
    // 备选方案
    if (preferredArch === 'x64' && windowsDownloads.x86) {
      console.log('🪟 Windows Updater: 64位版本不可用，使用32位版本');
      return windowsDownloads.x86.url;
    }
    
    throw new Error(`没有找到适合 ${preferredArch} 架构的下载链接`);
  }

  // 下载并打开更新
  async downloadAndOpen(updateInfo) {
    try {
      const downloadUrl = this.getDownloadUrl(updateInfo);
      
      console.log('🪟 Windows Updater: 打开下载链接:', downloadUrl);
      
      // 在默认浏览器中打开下载链接
      await shell.openExternal(downloadUrl);
      
      // 显示下载提示和安装指导
      const installGuide = this.getInstallationGuide(updateInfo);
      
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Windows 版本更新下载',
        message: '更新下载已开始',
        detail: installGuide,
        buttons: ['确定', '查看下载页面'],
        defaultId: 0
      }).then(result => {
        if (result.response === 1) {
          // 再次打开下载页面
          shell.openExternal(downloadUrl);
        }
      });
      
    } catch (error) {
      console.error('🪟 Windows Updater: 下载失败:', error);
      dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        title: '下载失败',
        message: '无法下载 Windows 更新',
        detail: `错误信息: ${error.message}\n\n请手动访问 GitHub Releases 页面下载最新版本。`,
        buttons: ['确定', '打开 GitHub']
      }).then(result => {
        if (result.response === 1) {
          shell.openExternal('https://github.com/miounet11/claude-code-manager/releases');
        }
      });
    }
  }

  // 获取安装指导
  getInstallationGuide(updateInfo) {
    const arch = this.windowsArch.preferredArch;
    
    return `🪟 Windows ${arch} 安装指导：

1. 下载完成后，找到安装文件
2. 右键点击安装文件，选择"以管理员身份运行"
3. 如果出现 Windows Defender 警告：
   - 点击"更多信息"
   - 点击"仍要运行"
4. 按照安装向导完成安装
5. 安装完成后会自动启动新版本

📋 推荐下载：
- NSIS 安装程序 (.exe) - 标准安装
- MSI 安装程序 (.msi) - 企业环境
- 便携版 (.zip) - 免安装使用

⚠️ 注意事项：
- 安装前请关闭当前版本
- 建议在安装前备份重要配置
- 安装过程可能需要几分钟时间`;
  }

  // 验证文件校验和
  async verifyChecksum(filePath, expectedChecksum) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      const actualChecksum = `sha256:${hash.digest('hex')}`;
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('🪟 Windows Updater: 校验和验证失败:', error);
      return false;
    }
  }

  // 跳过版本
  skipVersion(version) {
    const Store = require('electron-store');
    const store = new Store();
    const skippedVersions = store.get('skippedVersions', []);
    if (!skippedVersions.includes(version)) {
      skippedVersions.push(version);
      store.set('skippedVersions', skippedVersions);
      console.log('🪟 Windows Updater: 已跳过版本:', version);
    }
  }

  // 检查是否跳过版本
  isVersionSkipped(version) {
    const Store = require('electron-store');
    const store = new Store();
    const skippedVersions = store.get('skippedVersions', []);
    return skippedVersions.includes(version);
  }

  // 设置自动检查更新 (Windows 优化)
  setupAutoCheck() {
    // Windows 应用启动后延迟检查 (更长延迟)
    setTimeout(() => {
      this.checkForUpdates(true);
    }, 15000); // 15秒后

    // 每隔45分钟检查一次 (比 macOS 更频繁)
    setInterval(() => {
      this.checkForUpdates(true);
    }, 45 * 60 * 1000);
    
    console.log('🪟 Windows Updater: 自动更新检查已设置 (启动后15秒，每45分钟)');
  }

  // 获取更新历史
  getUpdateHistory() {
    const Store = require('electron-store');
    const store = new Store();
    
    return {
      lastCheckTime: store.get('lastUpdateCheck'),
      skippedVersions: store.get('skippedVersions', []),
      currentVersion: CURRENT_VERSION,
      windowsArch: this.windowsArch
    };
  }

  // 清除更新历史
  clearUpdateHistory() {
    const Store = require('electron-store');
    const store = new Store();
    
    store.delete('lastUpdateCheck');
    store.delete('skippedVersions');
    
    console.log('🪟 Windows Updater: 更新历史已清除');
  }

  // 手动下载最新版本
  async downloadLatest() {
    try {
      const updateInfo = await this.fetchUpdateInfo();
      await this.downloadAndOpen(updateInfo);
    } catch (error) {
      console.error('🪟 Windows Updater: 手动下载失败:', error);
      throw error;
    }
  }

  // 获取系统信息用于更新兼容性检查
  getSystemInfo() {
    return {
      platform: 'win32',
      arch: this.windowsArch.arch,
      osVersion: this.windowsArch.osVersion,
      is64Bit: this.windowsArch.is64Bit,
      nodeVersion: process.version,
      electronVersion: process.versions.electron
    };
  }
}

module.exports = WindowsUpdater;