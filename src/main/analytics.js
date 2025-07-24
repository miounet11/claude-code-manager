'use strict';

// const { app } = require('electron'); // 未使用
const Store = require('electron-store');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

const analyticsStore = new Store({ name: 'analytics' });
const API_BASE_URL = process.env.MIAODA_API_BASE_URL || 'https://api.iclaudecode.cn';

class Analytics {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionData = {};
    this.sessionStartTime = null;
    this.lastActiveTime = null;
  }

  // 获取或创建用户ID
  getOrCreateUserId() {
    let userId = analyticsStore.get('userId');
    if (!userId) {
      userId = 'user_' + crypto.randomBytes(8).toString('hex');
      analyticsStore.set('userId', userId);
    }
    return userId;
  }

  // 获取或创建设备ID
  getOrCreateDeviceId() {
    let deviceId = analyticsStore.get('deviceId');
    if (!deviceId) {
      const machineId = crypto.createHash('md5')
        .update(os.hostname() + os.platform() + os.arch())
        .digest('hex');
      deviceId = 'device_' + machineId.substring(0, 12);
      analyticsStore.set('deviceId', deviceId);
    }
    return deviceId;
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
    
    this.saveDailyData(today, dailyData);
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
            platform: process.platform,
            app_name: 'Miaoda'
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
      console.log('没有需要上报的数据');
      return;
    }

    console.log(`准备上报 ${reports.length} 条数据`);
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        reports: reports,
        client_time: new Date().toISOString()
      });

      const apiUrl = new URL(API_BASE_URL);
      const options = {
        hostname: apiUrl.hostname,
        path: '/api/analytics/batch',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
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
              console.log(`成功上报 ${result.success_count} 条数据`);
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
        console.error('上报数据失败:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // 设置自动上报
  setupAutoUpload() {
    // 应用启动时检查并上报
    setTimeout(() => {
      this.uploadReports().catch(error => {
        console.error('自动上报失败:', error);
      });
    }, 5000);

    // 每天凌晨2点上报
    const scheduleUpload = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      
      const timeout = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        this.uploadReports().catch(error => {
          console.error('定时上报失败:', error);
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
}

module.exports = Analytics;