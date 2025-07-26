'use strict';

const Store = require('electron-store');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const analyticsStore = new Store({ name: 'analytics' });
const API_BASE_URL = process.env.MIAODA_API_BASE_URL || 'https://api.iclaudecode.cn';

/**
 * Windows 版本统计分析类
 * 针对 Windows 平台优化的数据收集和上报
 */
class WindowsAnalytics {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionData = {};
    this.sessionStartTime = null;
    this.lastActiveTime = null;
    this.windowsVersion = this.getWindowsVersion();
  }

  // 获取或创建用户ID
  getOrCreateUserId() {
    let userId = analyticsStore.get('userId');
    if (!userId) {
      userId = 'winuser_' + crypto.randomBytes(8).toString('hex');
      analyticsStore.set('userId', userId);
    }
    return userId;
  }

  // 获取或创建设备ID (Windows 优化)
  getOrCreateDeviceId() {
    let deviceId = analyticsStore.get('deviceId');
    if (!deviceId) {
      // Windows 特有的设备标识
      const machineInfo = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.type(),
        process.env.PROCESSOR_IDENTIFIER || '',
        process.env.COMPUTERNAME || ''
      ].join('|');
      
      const machineId = crypto.createHash('md5')
        .update(machineInfo)
        .digest('hex');
      deviceId = 'windevice_' + machineId.substring(0, 12);
      analyticsStore.set('deviceId', deviceId);
    }
    return deviceId;
  }

  // 获取 Windows 版本信息
  getWindowsVersion() {
    try {
      const release = os.release();
      const version = os.version ? os.version() : '';
      
      // Windows 版本映射
      const windowsVersionMap = {
        '10.0': 'Windows 10/11',
        '6.3': 'Windows 8.1',
        '6.2': 'Windows 8',
        '6.1': 'Windows 7'
      };
      
      const majorMinor = release.split('.').slice(0, 2).join('.');
      const windowsName = windowsVersionMap[majorMinor] || `Windows ${release}`;
      
      return {
        release: release,
        version: version,
        name: windowsName,
        arch: os.arch(),
        platform: 'win32'
      };
    } catch (error) {
      return {
        release: 'unknown',
        version: 'unknown',
        name: 'Windows',
        arch: os.arch(),
        platform: 'win32'
      };
    }
  }

  // 开始新会话
  startSession() {
    this.sessionStartTime = new Date();
    this.lastActiveTime = new Date();
    
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    
    dailyData.session_count = (dailyData.session_count || 0) + 1;
    if (!dailyData.first_open_time) {
      dailyData.first_open_time = this.formatTime(this.sessionStartTime);
    }
    
    // Windows 特有信息
    dailyData.windows_version = this.windowsVersion.name;
    dailyData.windows_release = this.windowsVersion.release;
    
    this.saveDailyData(today, dailyData);
    
    console.log('🪟 Windows Analytics: 会话已开始');
  }

  // 记录页面访问
  trackPageView(pageName) {
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    
    if (!dailyData.page_views) {
      dailyData.page_views = {};
    }
    
    dailyData.page_views[pageName] = (dailyData.page_views[pageName] || 0) + 1;
    this.saveDailyData(today, dailyData);
    this.updateActiveTime();
  }

  // 记录功能使用
  trackFeatureUse(featureName) {
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    
    if (!dailyData.features_used) {
      dailyData.features_used = {};
    }
    
    dailyData.features_used[featureName] = (dailyData.features_used[featureName] || 0) + 1;
    this.saveDailyData(today, dailyData);
    this.updateActiveTime();
  }

  // 记录 Windows 特有功能
  trackWindowsFeature(featureName, details = {}) {
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    
    if (!dailyData.windows_features) {
      dailyData.windows_features = {};
    }
    
    dailyData.windows_features[featureName] = (dailyData.windows_features[featureName] || 0) + 1;
    
    // 保存详细信息
    if (Object.keys(details).length > 0) {
      if (!dailyData.windows_details) {
        dailyData.windows_details = {};
      }
      dailyData.windows_details[featureName] = details;
    }
    
    this.saveDailyData(today, dailyData);
    this.updateActiveTime();
  }

  // 记录终端类型使用
  trackTerminalType(terminalType) {
    this.trackWindowsFeature('terminal_type', { type: terminalType });
  }

  // 记录 PowerShell 版本
  trackPowerShellVersion(version) {
    this.trackWindowsFeature('powershell_version', { version: version });
  }

  // 结束会话
  endSession() {
    if (!this.sessionStartTime) return;
    
    const sessionDuration = Math.floor((new Date() - this.sessionStartTime) / 1000);
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    
    dailyData.total_duration = (dailyData.total_duration || 0) + sessionDuration;
    dailyData.last_active_time = this.formatTime(new Date());
    
    this.saveDailyData(today, dailyData);
    this.sessionStartTime = null;
    
    console.log('🪟 Windows Analytics: 会话已结束，时长:', sessionDuration, '秒');
  }

  // 更新最后活跃时间
  updateActiveTime() {
    this.lastActiveTime = new Date();
    const today = this.getTodayKey();
    const dailyData = this.getDailyData(today);
    dailyData.last_active_time = this.formatTime(this.lastActiveTime);
    this.saveDailyData(today, dailyData);
  }

  // 获取今天的key
  getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  // 格式化时间
  formatTime(date) {
    return date.toTimeString().split(' ')[0];
  }

  // 获取每日数据
  getDailyData(date) {
    const data = analyticsStore.get(`daily_${date}`, {});
    return {
      session_count: 0,
      total_duration: 0,
      page_views: {},
      features_used: {},
      windows_features: {},
      windows_details: {},
      ...data
    };
  }

  // 保存每日数据
  saveDailyData(date, data) {
    analyticsStore.set(`daily_${date}`, data);
  }

  // 收集未上报的数据
  collectUnreportedData() {
    const reports = [];
    const reportedDates = analyticsStore.get('reported_dates', []);
    const allKeys = Object.keys(analyticsStore.store);
    
    for (const key of allKeys) {
      if (key.startsWith('daily_') && !key.includes('reported')) {
        const date = key.replace('daily_', '');
        if (!reportedDates.includes(date) && date !== this.getTodayKey()) {
          const dailyData = analyticsStore.get(key);
          reports.push({
            user_id: this.userId,
            device_id: this.deviceId,
            date: date,
            summary: dailyData,
            app_version: require('electron').app.getVersion(),
            platform: 'win32',
            windows_version: this.windowsVersion,
            app_name: 'Miaoda-Windows'
          });
        }
      }
    }
    
    return reports;
  }

  // 批量上报数据
  async uploadReports() {
    const reports = this.collectUnreportedData();
    
    if (reports.length === 0) {
      console.log('🪟 Windows Analytics: 没有需要上报的数据');
      return;
    }

    console.log(`🪟 Windows Analytics: 准备上报 ${reports.length} 条数据`);
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        reports: reports,
        client_time: new Date().toISOString(),
        client_platform: 'windows'
      });

      const apiUrl = new URL(API_BASE_URL);
      const options = {
        hostname: apiUrl.hostname,
        path: '/api/analytics/batch',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'Miaoda-Windows/' + require('electron').app.getVersion()
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.status === 'ok') {
              // 标记已上报
              const reportedDates = analyticsStore.get('reported_dates', []);
              reports.forEach(report => {
                reportedDates.push(report.date);
                // 可选：删除已上报的数据
                analyticsStore.delete(`daily_${report.date}`);
              });
              analyticsStore.set('reported_dates', reportedDates);
              console.log(`🪟 Windows Analytics: 成功上报 ${result.success_count} 条数据`);
              resolve(result);
            } else {
              reject(new Error(result.message || '上报失败'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('🪟 Windows Analytics: 上报数据失败:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // 设置自动上报 (Windows 优化)
  setupAutoUpload() {
    // 应用启动时检查并上报 (延迟更长，避免影响启动)
    setTimeout(() => {
      this.uploadReports().catch(error => {
        console.error('🪟 Windows Analytics: 自动上报失败:', error);
      });
    }, 8000); // Windows 延迟 8 秒

    // 每天凌晨3点上报 (Windows 用户习惯)
    const scheduleUpload = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(3, 0, 0, 0); // 凌晨3点
      
      const timeout = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        this.uploadReports().catch(error => {
          console.error('🪟 Windows Analytics: 定时上报失败:', error);
        });
        scheduleUpload(); // 递归设置下一次
      }, timeout);
    };
    
    scheduleUpload();
  }

  // 健康检查
  async checkHealth() {
    return new Promise((resolve, reject) => {
      https.get(`${API_BASE_URL}/api/analytics/health`, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  // 获取统计摘要
  getStatsSummary() {
    const today = this.getTodayKey();
    const todayData = this.getDailyData(today);
    
    return {
      userId: this.userId,
      deviceId: this.deviceId,
      windowsVersion: this.windowsVersion,
      todayStats: todayData,
      sessionActive: !!this.sessionStartTime,
      sessionDuration: this.sessionStartTime ? 
        Math.floor((new Date() - this.sessionStartTime) / 1000) : 0
    };
  }
}

module.exports = WindowsAnalytics;