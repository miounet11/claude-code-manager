'use strict';

/**
 * 简单的 xterm.js 终端实现
 * 仅用于显示和基本交互
 */
class SimpleXterm {
  constructor() {
    this.xterm = null;
    this.container = null;
    this.isReady = false;
    this.inputHandler = null;
  }

  /**
   * 初始化终端
   */
  async initialize(container) {
    if (!container) {
      console.error('SimpleXterm: 容器元素不存在');
      return false;
    }

    this.container = container;

    try {
      // 创建 xterm 实例（使用基本配置）
      if (!window.XTerminal) {
        throw new Error('xterm.js 未加载');
      }

      // 使用保存的 xterm.js Terminal
      this.xterm = new window.XTerminal({
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4'
        },
        cursorBlink: true
      });

      // 打开终端
      this.xterm.open(container);

      // 设置输入处理
      this.xterm.onData((data) => {
        if (this.inputHandler) {
          this.inputHandler(data);
        }
      });

      this.isReady = true;
      console.log('SimpleXterm: 初始化成功');
      return true;

    } catch (error) {
      console.error('SimpleXterm: 初始化失败', error);
      return false;
    }
  }

  /**
   * 写入文本
   */
  write(text) {
    if (this.xterm) {
      this.xterm.write(text);
    }
  }

  /**
   * 写入一行
   */
  writeln(text = '') {
    if (this.xterm) {
      this.xterm.writeln(text);
    }
  }

  /**
   * 清空终端
   */
  clear() {
    if (this.xterm) {
      this.xterm.clear();
    }
  }

  /**
   * 获取焦点
   */
  focus() {
    if (this.xterm) {
      this.xterm.focus();
    }
  }

  /**
   * 设置输入处理器
   */
  onInput(handler) {
    this.inputHandler = handler;
  }

  /**
   * 获取选中文本
   */
  getSelection() {
    if (this.xterm && this.xterm.getSelection) {
      return this.xterm.getSelection();
    }
    return '';
  }

  /**
   * 销毁终端
   */
  dispose() {
    if (this.xterm) {
      this.xterm.dispose();
    }
    this.xterm = null;
    this.isReady = false;
  }
}

// 导出
window.SimpleXterm = SimpleXterm;