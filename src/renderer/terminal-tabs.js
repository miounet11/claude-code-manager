/**
 * 多标签终端管理器
 * 支持像 VSCode 一样的多终端标签
 */

class TerminalTabs {
  constructor(container) {
    this.container = container;
    this.terminals = new Map(); // terminalId -> XTerminal
    this.activeTerminalId = null;
    this.nextTerminalId = 1;
    
    this.initializeUI();
  }

  /**
   * 初始化 UI
   */
  initializeUI() {
    this.container.innerHTML = `
      <div class="terminal-tabs-container">
        <div class="terminal-tabs-header">
          <div class="terminal-tabs-list" id="terminal-tabs-list"></div>
          <div class="terminal-tabs-actions">
            <button class="terminal-tab-action" title="新建终端 (Ctrl+T)" onclick="terminalTabs.createNewTerminal()">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="terminal-tab-action" title="分割终端" onclick="terminalTabs.splitTerminal()">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="2" y="2" width="5" height="12" fill="none" stroke="currentColor" stroke-width="1"/>
                <rect x="9" y="2" width="5" height="12" fill="none" stroke="currentColor" stroke-width="1"/>
              </svg>
            </button>
            <button class="terminal-tab-action" title="清空当前终端 (Ctrl+K)" onclick="terminalTabs.clearActiveTerminal()">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M3 3h10v1H3zM4 5h8v8H4z" opacity="0.5"/>
                <path fill="currentColor" d="M6 7h4v1H6zM6 9h4v1H6z"/>
              </svg>
            </button>
            <button class="terminal-tab-action" title="终端设置" onclick="terminalTabs.showSettings()">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM8 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
                <path fill="currentColor" d="M8 1a.5.5 0 0 1 .5.5v1.05a5.5 5.5 0 0 1 1.5.46l.74-.74a.5.5 0 0 1 .71.71l-.74.74c.23.47.4.97.46 1.5H12.5a.5.5 0 0 1 0 1h-1.33a5.5 5.5 0 0 1-.46 1.5l.74.74a.5.5 0 0 1-.71.71l-.74-.74a5.5 5.5 0 0 1-1.5.46V12.5a.5.5 0 0 1-1 0v-1.33a5.5 5.5 0 0 1-1.5-.46l-.74.74a.5.5 0 0 1-.71-.71l.74-.74a5.5 5.5 0 0 1-.46-1.5H1.5a.5.5 0 0 1 0-1h1.33c.06-.53.23-1.03.46-1.5l-.74-.74a.5.5 0 0 1 .71-.71l.74.74a5.5 5.5 0 0 1 1.5-.46V1.5A.5.5 0 0 1 8 1z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="terminal-tabs-content" id="terminal-tabs-content"></div>
      </div>
    `;
    
    // 添加样式
    this.addStyles();
    
    // 创建第一个终端
    this.createNewTerminal();
    
    // 添加全局快捷键
    this.setupGlobalShortcuts();
  }
  
  /**
   * 设置全局快捷键
   */
  setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + T 新建终端
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        this.createNewTerminal();
      }
      
      // Ctrl/Cmd + W 关闭当前终端
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (this.activeTerminalId) {
          this.closeTerminal(this.activeTerminalId);
        }
      }
      
      // Ctrl/Cmd + 数字键切换终端
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const terminalIds = Array.from(this.terminals.keys());
        if (index < terminalIds.length) {
          this.switchToTerminal(terminalIds[index]);
        }
      }
    });
  }

  /**
   * 添加样式
   */
  addStyles() {
    if (!document.getElementById('terminal-tabs-styles')) {
      const style = document.createElement('style');
      style.id = 'terminal-tabs-styles';
      style.textContent = `
        .terminal-tabs-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
        }
        
        .terminal-tabs-header {
          display: flex;
          align-items: center;
          background: #252526;
          border-bottom: 1px solid #3e3e42;
          min-height: 35px;
        }
        
        .terminal-tabs-list {
          flex: 1;
          display: flex;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: thin;
        }
        
        .terminal-tabs-list::-webkit-scrollbar {
          height: 3px;
        }
        
        .terminal-tabs-list::-webkit-scrollbar-thumb {
          background: #424242;
        }
        
        .terminal-tab {
          display: flex;
          align-items: center;
          padding: 0 12px;
          height: 35px;
          background: transparent;
          border: none;
          color: #969696;
          cursor: pointer;
          white-space: nowrap;
          border-right: 1px solid #3e3e42;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: relative;
        }
        
        .terminal-tab:hover {
          background: #2a2d2e;
        }
        
        .terminal-tab.active {
          background: #1e1e1e;
          color: #cccccc;
        }
        
        .terminal-tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: #007acc;
        }
        
        .terminal-tab-title {
          margin-right: 8px;
        }
        
        .terminal-tab-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 3px;
          opacity: 0.7;
        }
        
        .terminal-tab-close:hover {
          background: #424242;
          opacity: 1;
        }
        
        .terminal-tabs-actions {
          display: flex;
          align-items: center;
          padding: 0 8px;
        }
        
        .terminal-tab-action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          color: #969696;
          cursor: pointer;
          border-radius: 3px;
        }
        
        .terminal-tab-action:hover {
          background: #2a2d2e;
          color: #cccccc;
        }
        
        .terminal-tabs-content {
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        
        .terminal-pane {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: none;
        }
        
        .terminal-pane.active {
          display: block;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * 创建新终端
   */
  async createNewTerminal(name = null) {
    const terminalId = `terminal-${this.nextTerminalId++}`;
    const terminalName = name || `终端 ${this.terminals.size + 1}`;
    
    // 创建标签
    const tabsListEl = document.getElementById('terminal-tabs-list');
    const tab = document.createElement('button');
    tab.className = 'terminal-tab';
    tab.id = `tab-${terminalId}`;
    tab.draggable = true;
    tab.innerHTML = `
      <span class="terminal-tab-title" contenteditable="false" ondblclick="terminalTabs.renameTerminal('${terminalId}')">${terminalName}</span>
      <span class="terminal-tab-close" onclick="event.stopPropagation(); terminalTabs.closeTerminal('${terminalId}')">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path fill="currentColor" d="M7.71 6.29l3.15-3.15a1 1 0 0 0-1.42-1.41L6.29 4.88 3.14 1.73a1 1 0 0 0-1.41 1.42l3.15 3.14-3.15 3.15a1 1 0 0 0 1.41 1.42l3.15-3.15 3.15 3.15a1 1 0 0 0 1.42-1.41z"/>
        </svg>
      </span>
    `;
    tab.onclick = () => this.switchToTerminal(terminalId);
    
    // 添加拖拽事件
    tab.ondragstart = (e) => this.handleDragStart(e, terminalId);
    tab.ondragover = (e) => this.handleDragOver(e);
    tab.ondrop = (e) => this.handleDrop(e, terminalId);
    
    // 添加右键菜单
    tab.oncontextmenu = (e) => this.showContextMenu(e, terminalId);
    
    tabsListEl.appendChild(tab);
    
    // 创建终端容器
    const contentEl = document.getElementById('terminal-tabs-content');
    const pane = document.createElement('div');
    pane.className = 'terminal-pane';
    pane.id = `pane-${terminalId}`;
    contentEl.appendChild(pane);
    
    // 创建终端实例
    const terminal = new XTerminal(pane);
    await terminal.initialize();
    this.terminals.set(terminalId, terminal);
    
    // 切换到新终端
    this.switchToTerminal(terminalId);
    
    return terminalId;
  }

  /**
   * 切换到指定终端
   */
  switchToTerminal(terminalId) {
    // 更新标签状态
    document.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.getElementById(`tab-${terminalId}`).classList.add('active');
    
    // 更新面板状态
    document.querySelectorAll('.terminal-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    document.getElementById(`pane-${terminalId}`).classList.add('active');
    
    // 更新当前终端
    this.activeTerminalId = terminalId;
    
    // 聚焦终端
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.focus();
    }
  }

  /**
   * 关闭终端
   */
  closeTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(terminalId);
    }
    
    // 移除标签和面板
    document.getElementById(`tab-${terminalId}`)?.remove();
    document.getElementById(`pane-${terminalId}`)?.remove();
    
    // 如果关闭的是当前终端，切换到另一个
    if (this.activeTerminalId === terminalId) {
      const remainingTerminals = Array.from(this.terminals.keys());
      if (remainingTerminals.length > 0) {
        this.switchToTerminal(remainingTerminals[0]);
      } else {
        // 如果没有终端了，创建一个新的
        this.createNewTerminal();
      }
    }
  }

  /**
   * 分割终端（预留功能）
   */
  splitTerminal() {
    // TODO: 实现终端分割功能
    console.log('终端分割功能开发中...');
  }

  /**
   * 获取当前活动终端
   */
  getActiveTerminal() {
    return this.terminals.get(this.activeTerminalId);
  }

  /**
   * 清空当前终端
   */
  clearActiveTerminal() {
    const terminal = this.getActiveTerminal();
    if (terminal) {
      terminal.clear();
    }
  }
  
  /**
   * 重命名终端
   */
  renameTerminal(terminalId) {
    const tab = document.getElementById(`tab-${terminalId}`);
    const titleEl = tab.querySelector('.terminal-tab-title');
    
    titleEl.contentEditable = true;
    titleEl.focus();
    
    // 选中文本
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    // 保存名称
    const saveTitle = () => {
      titleEl.contentEditable = false;
      const newTitle = titleEl.textContent.trim();
      if (!newTitle) {
        titleEl.textContent = '终端';
      }
    };
    
    titleEl.onblur = saveTitle;
    titleEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveTitle();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        titleEl.contentEditable = false;
      }
    };
  }
  
  /**
   * 拖拽开始
   */
  handleDragStart(e, terminalId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('terminalId', terminalId);
    e.target.style.opacity = '0.5';
  }
  
  /**
   * 拖拽经过
   */
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  
  /**
   * 拖拽放下
   */
  handleDrop(e, targetTerminalId) {
    e.preventDefault();
    const sourceTerminalId = e.dataTransfer.getData('terminalId');
    
    if (sourceTerminalId !== targetTerminalId) {
      const sourceTab = document.getElementById(`tab-${sourceTerminalId}`);
      const targetTab = document.getElementById(`tab-${targetTerminalId}`);
      const tabsList = document.getElementById('terminal-tabs-list');
      
      // 交换位置
      const allTabs = Array.from(tabsList.children);
      const sourceIndex = allTabs.indexOf(sourceTab);
      const targetIndex = allTabs.indexOf(targetTab);
      
      if (sourceIndex < targetIndex) {
        tabsList.insertBefore(sourceTab, targetTab.nextSibling);
      } else {
        tabsList.insertBefore(sourceTab, targetTab);
      }
    }
    
    // 恢复透明度
    document.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.style.opacity = '1';
    });
  }
  
  /**
   * 显示右键菜单
   */
  showContextMenu(e, terminalId) {
    e.preventDefault();
    
    // 移除旧菜单
    const oldMenu = document.querySelector('.terminal-context-menu');
    if (oldMenu) oldMenu.remove();
    
    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'terminal-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 4px 0;
      min-width: 150px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      z-index: 9999;
      font-size: 12px;
    `;
    
    const menuItems = [
      { label: '新建终端', action: () => this.createNewTerminal() },
      { label: '重命名', action: () => this.renameTerminal(terminalId) },
      { label: '复制终端', action: () => this.duplicateTerminal(terminalId) },
      { divider: true },
      { label: '清空', action: () => this.clearTerminal(terminalId) },
      { label: '关闭', action: () => this.closeTerminal(terminalId) },
      { label: '关闭其他', action: () => this.closeOtherTerminals(terminalId) },
      { label: '关闭所有', action: () => this.closeAllTerminals() }
    ];
    
    menuItems.forEach(item => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: #3e3e42; margin: 4px 0;';
        menu.appendChild(divider);
      } else {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.style.cssText = `
          padding: 6px 20px;
          cursor: pointer;
          color: #cccccc;
        `;
        menuItem.onmouseover = () => menuItem.style.background = '#2a2d2e';
        menuItem.onmouseout = () => menuItem.style.background = 'transparent';
        menuItem.onclick = () => {
          item.action();
          menu.remove();
        };
        menu.appendChild(menuItem);
      }
    });
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
  
  /**
   * 复制终端
   */
  async duplicateTerminal(terminalId) {
    const tab = document.getElementById(`tab-${terminalId}`);
    const title = tab.querySelector('.terminal-tab-title').textContent;
    await this.createNewTerminal(`${title} (副本)`);
  }
  
  /**
   * 清空指定终端
   */
  clearTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.clear();
    }
  }
  
  /**
   * 关闭其他终端
   */
  closeOtherTerminals(keepTerminalId) {
    const terminalIds = Array.from(this.terminals.keys());
    terminalIds.forEach(id => {
      if (id !== keepTerminalId) {
        this.closeTerminal(id);
      }
    });
  }
  
  /**
   * 关闭所有终端
   */
  closeAllTerminals() {
    const terminalIds = Array.from(this.terminals.keys());
    terminalIds.forEach(id => this.closeTerminal(id));
  }
  
  /**
   * 显示终端设置
   */
  showSettings() {
    // 移除旧的设置对话框
    const oldDialog = document.querySelector('.terminal-settings-dialog');
    if (oldDialog) oldDialog.remove();
    
    // 创建设置对话框
    const dialog = document.createElement('div');
    dialog.className = 'terminal-settings-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1e1e1e;
      border: 1px solid #3e3e42;
      border-radius: 8px;
      padding: 20px;
      min-width: 400px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      z-index: 10000;
      color: #cccccc;
      font-size: 13px;
    `;
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: normal;">终端设置</h3>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">字体大小</label>
        <input type="range" id="font-size-slider" min="10" max="20" value="12" style="width: 100%;">
        <span id="font-size-value" style="float: right; margin-top: -20px;">12px</span>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">字体系列</label>
        <select id="font-family-select" style="width: 100%; background: #252526; border: 1px solid #3e3e42; color: #cccccc; padding: 5px;">
          <option value='"Cascadia Code", "SF Mono", Monaco, Menlo, Consolas, monospace'>Cascadia Code (默认)</option>
          <option value='"SF Mono", Monaco, Menlo, Consolas, monospace'>SF Mono</option>
          <option value='Monaco, Menlo, Consolas, monospace'>Monaco</option>
          <option value='Consolas, "Courier New", monospace'>Consolas</option>
          <option value='monospace'>系统等宽字体</option>
        </select>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">光标样式</label>
        <select id="cursor-style-select" style="width: 100%; background: #252526; border: 1px solid #3e3e42; color: #cccccc; padding: 5px;">
          <option value="block">方块 (█)</option>
          <option value="underline">下划线 (_)</option>
          <option value="bar">竖线 (|)</option>
        </select>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label>
          <input type="checkbox" id="cursor-blink-checkbox" checked>
          光标闪烁
        </label>
      </div>
      
      <div style="text-align: right;">
        <button onclick="terminalTabs.applySettings()" style="
          background: #007acc;
          border: none;
          color: white;
          padding: 6px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        ">应用</button>
        <button onclick="document.querySelector('.terminal-settings-dialog').remove()" style="
          background: #252526;
          border: 1px solid #3e3e42;
          color: #cccccc;
          padding: 6px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">取消</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 实时预览字体大小
    const slider = document.getElementById('font-size-slider');
    const valueDisplay = document.getElementById('font-size-value');
    slider.oninput = () => {
      valueDisplay.textContent = slider.value + 'px';
    };
  }
  
  /**
   * 应用设置
   */
  applySettings() {
    const fontSize = parseInt(document.getElementById('font-size-slider').value);
    const fontFamily = document.getElementById('font-family-select').value;
    const cursorStyle = document.getElementById('cursor-style-select').value;
    const cursorBlink = document.getElementById('cursor-blink-checkbox').checked;
    
    // 应用到所有终端
    this.terminals.forEach(terminal => {
      if (terminal.terminal) {
        terminal.terminal.options.fontSize = fontSize;
        terminal.terminal.options.fontFamily = fontFamily;
        terminal.terminal.options.cursorStyle = cursorStyle;
        terminal.terminal.options.cursorBlink = cursorBlink;
        
        // 重新适应大小
        if (terminal.fitAddon) {
          terminal.fitAddon.fit();
        }
      }
    });
    
    // 保存设置（可以使用 localStorage）
    localStorage.setItem('terminal-settings', JSON.stringify({
      fontSize,
      fontFamily,
      cursorStyle,
      cursorBlink
    }));
    
    // 关闭对话框
    document.querySelector('.terminal-settings-dialog').remove();
  }
}

// 导出
window.TerminalTabs = TerminalTabs;