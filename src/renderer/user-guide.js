'use strict';

/**
 * 用户引导系统
 * 提供新手引导、功能提示和交互式教程
 */
class UserGuide {
  constructor() {
    this.currentStep = 0;
    this.isActive = false;
    this.hasSeenGuide = localStorage.getItem('hasSeenGuide') === 'true';
    this.tooltips = new Map();
    this.guideBubble = null;
  }

  /**
   * 初始化引导系统
   */
  init() {
    // 添加引导样式
    this.injectStyles();
    
    // 检查是否需要显示首次使用引导
    if (!this.hasSeenGuide) {
      // 延迟一点时间，等待页面完全加载
      setTimeout(() => {
        this.startFirstTimeGuide();
      }, 1000);
    }
    
    // 设置功能提示
    this.setupTooltips();
    
    // 监听帮助按钮
    this.setupHelpButton();
  }

  /**
   * 注入引导样式
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 引导遮罩层 */
      .guide-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .guide-overlay.active {
        opacity: 1;
        pointer-events: all;
      }
      
      /* 高亮区域 */
      .guide-highlight {
        position: absolute;
        border: 2px solid #007acc;
        border-radius: 6px;
        box-shadow: 0 0 0 4px rgba(0, 122, 204, 0.3), 0 0 20px rgba(0, 122, 204, 0.5);
        transition: all 0.3s ease;
        pointer-events: none;
      }
      
      /* 引导气泡 */
      .guide-bubble {
        position: absolute;
        background: #fff;
        color: #333;
        padding: 20px;
        border-radius: 8px;
        max-width: 320px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
      }
      
      .guide-bubble.active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .guide-bubble h3 {
        margin: 0 0 10px 0;
        color: #007acc;
        font-size: 18px;
      }
      
      .guide-bubble p {
        margin: 0 0 15px 0;
        line-height: 1.5;
        font-size: 14px;
      }
      
      .guide-bubble-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .guide-steps {
        font-size: 12px;
        color: #666;
      }
      
      .guide-buttons {
        display: flex;
        gap: 8px;
      }
      
      .guide-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .guide-btn-skip {
        background: #e0e0e0;
        color: #666;
      }
      
      .guide-btn-skip:hover {
        background: #d0d0d0;
      }
      
      .guide-btn-next {
        background: #007acc;
        color: white;
      }
      
      .guide-btn-next:hover {
        background: #005a9e;
      }
      
      /* 指示箭头 */
      .guide-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
      }
      
      .guide-arrow-top {
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 10px 10px 0 10px;
        border-color: #fff transparent transparent transparent;
      }
      
      .guide-arrow-bottom {
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 0 10px 10px 10px;
        border-color: transparent transparent #fff transparent;
      }
      
      .guide-arrow-left {
        right: -10px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 10px 0 10px 10px;
        border-color: transparent transparent transparent #fff;
      }
      
      .guide-arrow-right {
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 10px 10px 10px 0;
        border-color: transparent #fff transparent transparent;
      }
      
      /* 工具提示 */
      .guide-tooltip {
        position: absolute;
        background: #333;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .guide-tooltip.active {
        opacity: 1;
      }
      
      .guide-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: #333;
      }
      
      /* 脉冲动画 */
      @keyframes guide-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(0, 122, 204, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(0, 122, 204, 0);
        }
      }
      
      .guide-pulse {
        animation: guide-pulse 2s infinite;
      }
      
      /* 帮助按钮 */
      .guide-help-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #007acc;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        transition: all 0.3s ease;
      }
      
      .guide-help-btn:hover {
        background: #005a9e;
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 开始首次使用引导
   */
  startFirstTimeGuide() {
    this.isActive = true;
    this.currentStep = 0;
    
    // 创建遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'guide-overlay';
    document.body.appendChild(this.overlay);
    
    // 创建高亮框
    this.highlight = document.createElement('div');
    this.highlight.className = 'guide-highlight';
    document.body.appendChild(this.highlight);
    
    // 显示遮罩
    setTimeout(() => {
      this.overlay.classList.add('active');
    }, 100);
    
    // 定义引导步骤
    this.steps = [
      {
        element: '#environment-status',
        title: '欢迎使用 Claude Code Manager！',
        content: '这里显示您的系统环境状态。绿色表示组件已安装，红色表示需要安装。',
        position: 'right'
      },
      {
        element: '#check-env-btn',
        title: '环境检查',
        content: '点击这个按钮可以重新检查系统环境，确保所有依赖都已正确安装。',
        position: 'right'
      },
      {
        element: '#new-config-btn',
        title: '创建配置',
        content: '点击这里创建新的 API 配置。您可以配置不同的 AI 模型和服务。',
        position: 'right'
      },
      {
        element: '#terminal',
        title: '终端区域',
        content: '这里显示所有操作的输出信息。您可以输入命令与系统交互，输入 "help" 查看可用命令。',
        position: 'left'
      },
      {
        element: '#status-indicator',
        title: '状态指示器',
        content: '这里实时显示 Claude 的运行状态。绿色表示运行中，灰色表示已停止。',
        position: 'bottom'
      }
    ];
    
    // 显示第一步
    this.showStep(0);
  }

  /**
   * 显示引导步骤
   */
  showStep(stepIndex) {
    if (stepIndex >= this.steps.length) {
      this.endGuide();
      return;
    }
    
    const step = this.steps[stepIndex];
    const element = document.querySelector(step.element);
    
    if (!element) {
      // 如果元素不存在，跳到下一步
      this.showStep(stepIndex + 1);
      return;
    }
    
    // 高亮目标元素
    this.highlightElement(element);
    
    // 显示引导气泡
    this.showGuideBubble(element, step);
  }

  /**
   * 高亮元素
   */
  highlightElement(element) {
    const rect = element.getBoundingClientRect();
    
    this.highlight.style.left = `${rect.left - 4}px`;
    this.highlight.style.top = `${rect.top - 4}px`;
    this.highlight.style.width = `${rect.width + 8}px`;
    this.highlight.style.height = `${rect.height + 8}px`;
    
    // 添加脉冲效果
    this.highlight.classList.add('guide-pulse');
  }

  /**
   * 显示引导气泡
   */
  showGuideBubble(element, step) {
    // 移除旧的气泡
    if (this.guideBubble) {
      this.guideBubble.remove();
    }
    
    // 创建新气泡
    this.guideBubble = document.createElement('div');
    this.guideBubble.className = 'guide-bubble';
    
    // 创建标题
    const h3 = document.createElement('h3');
    h3.textContent = step.title;
    
    // 创建内容
    const p = document.createElement('p');
    p.textContent = step.content;
    
    // 创建页脚
    const footer = document.createElement('div');
    footer.className = 'guide-bubble-footer';
    
    const stepsSpan = document.createElement('span');
    stepsSpan.className = 'guide-steps';
    stepsSpan.textContent = `步骤 ${this.currentStep + 1} / ${this.steps.length}`;
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'guide-buttons';
    
    const skipBtn = document.createElement('button');
    skipBtn.className = 'guide-btn guide-btn-skip';
    skipBtn.textContent = '跳过';
    skipBtn.addEventListener('click', () => window.userGuide.endGuide());
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'guide-btn guide-btn-next';
    nextBtn.textContent = this.currentStep < this.steps.length - 1 ? '下一步' : '完成';
    nextBtn.addEventListener('click', () => window.userGuide.nextStep());
    
    buttonsDiv.appendChild(skipBtn);
    buttonsDiv.appendChild(nextBtn);
    
    footer.appendChild(stepsSpan);
    footer.appendChild(buttonsDiv);
    
    // 创建箭头
    const arrow = document.createElement('div');
    arrow.className = `guide-arrow guide-arrow-${step.position}`;
    
    // 组装气泡
    this.guideBubble.appendChild(h3);
    this.guideBubble.appendChild(p);
    this.guideBubble.appendChild(footer);
    this.guideBubble.appendChild(arrow);
    
    document.body.appendChild(this.guideBubble);
    
    // 定位气泡
    this.positionBubble(element, step.position);
    
    // 显示气泡
    setTimeout(() => {
      this.guideBubble.classList.add('active');
    }, 100);
  }

  /**
   * 定位气泡
   */
  positionBubble(element, position) {
    const rect = element.getBoundingClientRect();
    const bubbleRect = this.guideBubble.getBoundingClientRect();
    
    switch (position) {
      case 'right':
        this.guideBubble.style.left = `${rect.right + 20}px`;
        this.guideBubble.style.top = `${rect.top + (rect.height - bubbleRect.height) / 2}px`;
        break;
      case 'left':
        this.guideBubble.style.left = `${rect.left - bubbleRect.width - 20}px`;
        this.guideBubble.style.top = `${rect.top + (rect.height - bubbleRect.height) / 2}px`;
        break;
      case 'top':
        this.guideBubble.style.left = `${rect.left + (rect.width - bubbleRect.width) / 2}px`;
        this.guideBubble.style.top = `${rect.top - bubbleRect.height - 20}px`;
        break;
      case 'bottom':
        this.guideBubble.style.left = `${rect.left + (rect.width - bubbleRect.width) / 2}px`;
        this.guideBubble.style.top = `${rect.bottom + 20}px`;
        break;
    }
  }

  /**
   * 下一步
   */
  nextStep() {
    this.currentStep++;
    this.showStep(this.currentStep);
  }

  /**
   * 结束引导
   */
  endGuide() {
    this.isActive = false;
    
    // 淡出效果
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    if (this.guideBubble) {
      this.guideBubble.classList.remove('active');
    }
    
    // 移除元素
    setTimeout(() => {
      if (this.overlay) this.overlay.remove();
      if (this.highlight) this.highlight.remove();
      if (this.guideBubble) this.guideBubble.remove();
    }, 300);
    
    // 标记已看过引导
    localStorage.setItem('hasSeenGuide', 'true');
    this.hasSeenGuide = true;
    
    // 显示提示
    if (window.terminal) {
      window.terminal.writeln('\n\x1b[32m✅ 引导完成！如需再次查看，请点击右下角的帮助按钮。\x1b[0m\n');
    }
  }

  /**
   * 设置工具提示
   */
  setupTooltips() {
    // 为重要按钮添加提示
    const tooltipConfigs = [
      { selector: '#start-claude-btn', text: '启动 Claude Code' },
      { selector: '#stop-claude-btn', text: '停止 Claude Code' },
      { selector: '#clear-terminal-btn', text: '清空终端内容' },
      { selector: '#fullscreen-terminal-btn', text: '全屏显示终端' },
      { selector: '#export-config-btn', text: '导出当前配置' },
      { selector: '#import-config-btn', text: '导入配置文件' }
    ];
    
    tooltipConfigs.forEach(config => {
      const element = document.querySelector(config.selector);
      if (element) {
        this.addTooltip(element, config.text);
      }
    });
  }

  /**
   * 添加工具提示
   */
  addTooltip(element, text) {
    let tooltip = null;
    
    element.addEventListener('mouseenter', (e) => {
      if (this.isActive) return; // 引导进行中不显示提示
      
      tooltip = document.createElement('div');
      tooltip.className = 'guide-tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);
      
      const rect = element.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
      
      setTimeout(() => {
        tooltip.classList.add('active');
      }, 10);
    });
    
    element.addEventListener('mouseleave', () => {
      if (tooltip) {
        tooltip.classList.remove('active');
        setTimeout(() => {
          tooltip.remove();
        }, 200);
      }
    });
  }

  /**
   * 设置帮助按钮
   */
  setupHelpButton() {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'guide-help-btn';
    helpBtn.innerHTML = '?';
    helpBtn.title = '查看使用引导';
    
    helpBtn.addEventListener('click', () => {
      this.startFirstTimeGuide();
    });
    
    document.body.appendChild(helpBtn);
  }

  /**
   * 显示功能提示
   */
  showFeatureTip(feature, message) {
    const element = document.querySelector(feature);
    if (!element) return;
    
    // 创建提示气泡
    const tip = document.createElement('div');
    tip.className = 'guide-bubble';
    tip.innerHTML = `
      <p style="margin: 0; font-size: 14px;">${message}</p>
    `;
    
    document.body.appendChild(tip);
    
    // 定位
    const rect = element.getBoundingClientRect();
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.bottom + 10}px`;
    
    // 显示
    setTimeout(() => {
      tip.classList.add('active');
    }, 100);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      tip.classList.remove('active');
      setTimeout(() => tip.remove(), 300);
    }, 3000);
  }
}

// 创建全局实例
window.userGuide = new UserGuide();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserGuide;
}