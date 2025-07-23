class WelcomeGuide {
  constructor() {
    this.currentStep = 0;
    this.steps = [
      {
        title: '欢迎使用 Miaoda',
        content: 'Miaoda 是一个强大的 AI 对话工具，让我们开始设置吧！',
        highlight: null,
        action: null
      },
      {
        title: '环境检查',
        content: '首先，我们需要检查您的系统环境是否满足要求。',
        highlight: '#env-status',
        action: 'checkEnvironment'
      },
      {
        title: '选择 AI 模型',
        content: '选择一个预设的 AI 配置，或创建您自己的配置。',
        highlight: '#config-selector',
        action: 'selectConfig'
      },
      {
        title: '开始对话',
        content: '点击"启动 Claude"按钮，开始与 AI 对话！',
        highlight: '#start-button',
        action: 'startClaude'
      }
    ];
    this.overlay = null;
    this.guideModal = null;
  }

  async start() {
    // 检查是否首次使用
    const hasSeenGuide = await window.electronAPI.getConfig('hasSeenGuide');
    if (hasSeenGuide) return;

    this.createOverlay();
    this.showStep(0);
  }

  createOverlay() {
    // 创建半透明遮罩
    this.overlay = document.createElement('div');
    this.overlay.className = 'guide-overlay';
    this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9998;
            display: none;
        `;

    // 创建引导模态框
    this.guideModal = document.createElement('div');
    this.guideModal.className = 'guide-modal';
    this.guideModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--putty-bg);
            border: 2px solid var(--putty-green);
            border-radius: 8px;
            padding: 30px;
            max-width: 500px;
            z-index: 9999;
            color: var(--putty-green);
            font-family: 'Courier New', monospace;
        `;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.guideModal);
  }

  showStep(stepIndex) {
    if (stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[stepIndex];
    this.currentStep = stepIndex;

    // 更新模态框内容
    this.guideModal.innerHTML = `
            <h2 style="margin-bottom: 20px; font-size: 24px;">${step.title}</h2>
            <p style="margin-bottom: 30px; line-height: 1.6;">${step.content}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #666;">步骤 ${stepIndex + 1} / ${this.steps.length}</span>
                <div>
                    ${stepIndex > 0 ? '<button id="guide-prev" class="guide-button">上一步</button>' : ''}
                    <button id="guide-next" class="guide-button">
                        ${stepIndex === this.steps.length - 1 ? '完成' : '下一步'}
                    </button>
                    <button id="guide-skip" class="guide-button" style="margin-left: 10px;">跳过引导</button>
                </div>
            </div>
        `;

    // 添加按钮样式
    const style = document.createElement('style');
    style.textContent = `
            .guide-button {
                background: var(--putty-green);
                color: var(--putty-bg);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-family: inherit;
                font-weight: bold;
                transition: opacity 0.2s;
            }
            .guide-button:hover {
                opacity: 0.8;
            }
            .highlight-element {
                position: relative;
                z-index: 10000 !important;
                box-shadow: 0 0 0 4px rgba(0, 255, 0, 0.5);
                border-radius: 4px;
            }
        `;
    if (!document.querySelector('#guide-styles')) {
      style.id = 'guide-styles';
      document.head.appendChild(style);
    }

    // 显示遮罩
    this.overlay.style.display = 'block';

    // 高亮元素
    if (step.highlight) {
      this.highlightElement(step.highlight);
    }

    // 绑定事件
    this.bindEvents();

    // 执行步骤动作
    if (step.action && window.guideActions && window.guideActions[step.action]) {
      window.guideActions[step.action]();
    }
  }

  highlightElement(selector) {
    // 移除之前的高亮
    document.querySelectorAll('.highlight-element').forEach(el => {
      el.classList.remove('highlight-element');
    });

    // 添加新高亮
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('highlight-element');
            
      // 创建指向箭头
      const rect = element.getBoundingClientRect();
      const arrow = document.createElement('div');
      arrow.className = 'guide-arrow';
      arrow.style.cssText = `
                position: fixed;
                top: ${rect.top - 30}px;
                left: ${rect.left + rect.width / 2}px;
                width: 0;
                height: 0;
                border-left: 15px solid transparent;
                border-right: 15px solid transparent;
                border-top: 20px solid var(--putty-green);
                z-index: 10001;
                animation: bounce 1s infinite;
            `;
            
      // 添加动画
      if (!document.querySelector('#guide-arrow-animation')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'guide-arrow-animation';
        animStyle.textContent = `
                    @keyframes bounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-10px); }
                    }
                `;
        document.head.appendChild(animStyle);
      }
            
      document.body.appendChild(arrow);
      setTimeout(() => arrow.remove(), 3000);
    }
  }

  bindEvents() {
    const prevBtn = document.querySelector('#guide-prev');
    const nextBtn = document.querySelector('#guide-next');
    const skipBtn = document.querySelector('#guide-skip');

    if (prevBtn) {
      prevBtn.onclick = () => this.showStep(this.currentStep - 1);
    }

    if (nextBtn) {
      nextBtn.onclick = () => this.showStep(this.currentStep + 1);
    }

    if (skipBtn) {
      skipBtn.onclick = () => this.complete();
    }
  }

  async complete() {
    // 保存已查看状态
    await window.electronAPI.setConfig('hasSeenGuide', true);
        
    // 清理
    if (this.overlay) this.overlay.remove();
    if (this.guideModal) this.guideModal.remove();
    document.querySelectorAll('.highlight-element').forEach(el => {
      el.classList.remove('highlight-element');
    });

    // 触发完成事件
    window.dispatchEvent(new CustomEvent('guideComplete'));
  }
}

// 定义引导动作
window.guideActions = {
  checkEnvironment: () => {
    // 触发环境检查
    if (window.checkEnvironment) {
      window.checkEnvironment();
    }
  },
  selectConfig: () => {
    // 聚焦到配置选择器
    const configSelector = document.querySelector('#config-selector');
    if (configSelector) {
      configSelector.focus();
    }
  },
  startClaude: () => {
    // 准备启动
    const startButton = document.querySelector('#start-button');
    if (startButton) {
      startButton.classList.add('pulse-animation');
    }
  }
};

// 导出引导类
window.WelcomeGuide = WelcomeGuide;