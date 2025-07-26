'use strict';

/**
 * 使用统计组件
 * 显示 API 使用情况和费用追踪
 */
class UsageStats {
  constructor() {
    this.container = null;
    this.modalElement = null;
    this.statistics = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      sessions: [],
      dailyUsage: {}
    };
    this.chartInterval = null;
  }

  /**
   * 显示统计面板
   */
  async show(container) {
    this.container = container;
    
    // 加载统计数据
    await this.loadStatistics();
    
    // 创建模态窗口
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal usage-stats';
    this.modalElement.innerHTML = this.render();
    
    // 添加到容器
    this.container.appendChild(this.modalElement);
    
    // 绑定事件
    this.bindEvents();
    
    // 显示动画
    requestAnimationFrame(() => {
      this.modalElement.classList.add('show');
    });

    // 开始实时更新
    this.startRealtimeUpdate();
  }

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      // 从代理服务器获取统计
      const proxyStats = await window.electronAPI.invoke('proxy:stats');
      if (proxyStats) {
        this.statistics = {
          ...this.statistics,
          ...proxyStats
        };
      }

      // 从本地存储加载历史数据
      const savedStats = localStorage.getItem('usage-statistics');
      if (savedStats) {
        const historyStats = JSON.parse(savedStats);
        this.statistics.sessions = historyStats.sessions || [];
        this.statistics.dailyUsage = historyStats.dailyUsage || {};
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  /**
   * 渲染内容
   */
  render() {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = this.statistics.dailyUsage[today] || { tokens: 0, cost: 0, requests: 0 };

    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>使用统计</h2>
          <button class="btn-close" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          <!-- 概览卡片 -->
          <div class="stats-overview">
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <div class="stat-value">${this.formatNumber(this.statistics.totalRequests)}</div>
                <div class="stat-label">总请求数</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">🔤</div>
              <div class="stat-content">
                <div class="stat-value">${this.formatNumber(this.statistics.totalTokens)}</div>
                <div class="stat-label">总 Token 数</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">💰</div>
              <div class="stat-content">
                <div class="stat-value">$${this.statistics.totalCost.toFixed(4)}</div>
                <div class="stat-label">总费用</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">📅</div>
              <div class="stat-content">
                <div class="stat-value">${this.formatNumber(todayUsage.tokens)}</div>
                <div class="stat-label">今日 Token</div>
              </div>
            </div>
          </div>

          <!-- 使用趋势图表 -->
          <div class="stats-chart-section">
            <h3>使用趋势（最近7天）</h3>
            <div class="chart-container">
              <canvas id="usage-chart" width="600" height="200"></canvas>
            </div>
          </div>

          <!-- 最近请求 -->
          <div class="recent-requests-section">
            <h3>最近请求</h3>
            <div class="request-list">
              ${this.renderRecentRequests()}
            </div>
          </div>

          <!-- 费用分析 -->
          <div class="cost-analysis-section">
            <h3>费用分析</h3>
            <div class="cost-breakdown">
              ${this.renderCostBreakdown()}
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-export-stats">
            <i class="icon icon-export"></i>
            导出报表
          </button>
          <button class="btn btn-secondary" id="btn-clear-stats">
            <i class="icon icon-trash"></i>
            清除统计
          </button>
          <button class="btn" data-action="close">关闭</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染最近请求
   */
  renderRecentRequests() {
    const recentRequests = this.statistics.recentRequests || [];
    
    if (recentRequests.length === 0) {
      return '<div class="empty-state">暂无请求记录</div>';
    }

    return recentRequests.slice(0, 10).map(req => `
      <div class="request-item">
        <div class="request-time">${new Date(req.timestamp).toLocaleString()}</div>
        <div class="request-info">
          <span class="request-method">${req.method}</span>
          <span class="request-path">${req.path}</span>
          <span class="request-model">${req.model || 'unknown'}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染费用分析
   */
  renderCostBreakdown() {
    const models = {};
    const sessions = this.statistics.sessions || [];

    // 按模型统计
    sessions.forEach(session => {
      const model = session.model || 'unknown';
      if (!models[model]) {
        models[model] = { tokens: 0, cost: 0, count: 0 };
      }
      models[model].tokens += session.tokens || 0;
      models[model].cost += session.cost || 0;
      models[model].count += 1;
    });

    return Object.entries(models).map(([model, stats]) => `
      <div class="cost-item">
        <div class="cost-model">${model}</div>
        <div class="cost-details">
          <span>请求: ${stats.count}</span>
          <span>Token: ${this.formatNumber(stats.tokens)}</span>
          <span class="cost-amount">$${stats.cost.toFixed(4)}</span>
        </div>
      </div>
    `).join('') || '<div class="empty-state">暂无费用数据</div>';
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 关闭按钮
    this.modalElement.querySelectorAll('[data-action="close"]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // 导出统计
    const exportBtn = this.modalElement.querySelector('#btn-export-stats');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportStatistics());
    }

    // 清除统计
    const clearBtn = this.modalElement.querySelector('#btn-clear-stats');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearStatistics());
    }

    // 绘制图表
    this.drawChart();
  }

  /**
   * 绘制使用趋势图表
   */
  drawChart() {
    const canvas = this.modalElement.querySelector('#usage-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const days = this.getLast7Days();
    const data = days.map(day => this.statistics.dailyUsage[day] || { tokens: 0 });

    // 简单的柱状图实现
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / days.length * 0.8;
    const maxTokens = Math.max(...data.map(d => d.tokens), 1);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#007acc';

    data.forEach((dayData, index) => {
      const barHeight = (dayData.tokens / maxTokens) * (height - 40);
      const x = index * (width / days.length) + (width / days.length - barWidth) / 2;
      const y = height - barHeight - 20;

      ctx.fillRect(x, y, barWidth, barHeight);
      
      // 标签
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(days[index].slice(5), x + barWidth / 2, height - 5);
      
      // 数值
      if (dayData.tokens > 0) {
        ctx.fillText(this.formatNumber(dayData.tokens), x + barWidth / 2, y - 5);
      }
      
      ctx.fillStyle = '#007acc';
    });
  }

  /**
   * 获取最近7天日期
   */
  getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  }

  /**
   * 导出统计数据
   */
  async exportStatistics() {
    const exportData = {
      exportDate: new Date().toISOString(),
      statistics: this.statistics,
      summary: {
        totalRequests: this.statistics.totalRequests,
        totalTokens: this.statistics.totalTokens,
        totalCost: this.statistics.totalCost,
        averageTokensPerRequest: this.statistics.totalRequests > 0 
          ? Math.floor(this.statistics.totalTokens / this.statistics.totalRequests) 
          : 0
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miaoda-usage-stats-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 清除统计数据
   */
  async clearStatistics() {
    const confirm = await window.electronAPI.showConfirm(
      '确认清除',
      '确定要清除所有统计数据吗？此操作不可恢复。'
    );

    if (!confirm) return;

    try {
      // 清除本地存储
      localStorage.removeItem('usage-statistics');
      
      // 重置数据
      this.statistics = {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        sessions: [],
        dailyUsage: {}
      };

      // 更新视图
      this.updateView();
    } catch (error) {
      window.electronAPI.showError('清除失败', error.message);
    }
  }

  /**
   * 开始实时更新
   */
  startRealtimeUpdate() {
    this.chartInterval = setInterval(() => {
      this.loadStatistics().then(() => {
        this.updateView();
      });
    }, 5000); // 每5秒更新一次
  }

  /**
   * 更新视图
   */
  updateView() {
    const newContent = this.render();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newContent;
    
    // 更新主要内容
    const modalBody = this.modalElement.querySelector('.modal-body');
    const newModalBody = tempDiv.querySelector('.modal-body');
    if (modalBody && newModalBody) {
      modalBody.innerHTML = newModalBody.innerHTML;
      this.drawChart();
    }
  }

  /**
   * 格式化数字
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * 关闭统计面板
   */
  close() {
    if (!this.modalElement) return;

    // 停止实时更新
    if (this.chartInterval) {
      clearInterval(this.chartInterval);
      this.chartInterval = null;
    }
    
    // 隐藏动画
    this.modalElement.classList.remove('show');
    
    // 移除元素
    setTimeout(() => {
      if (this.modalElement) {
        this.modalElement.remove();
        this.modalElement = null;
      }
    }, 300);
  }
}

module.exports = { UsageStats };