'use strict';

/**
 * 系统托盘管理模块
 * 实现应用最小化到系统托盘，隐藏运行
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class SystemTray {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
    this.isHidden = false;
    this.contextMenu = null;
    
    this.createTray();
    this.bindEvents();
  }

  /**
   * 创建系统托盘
   */
  createTray() {
    console.log('🔄 创建系统托盘...');
    
    try {
      // 创建托盘图标
      const iconPath = this.getTrayIconPath();
      const trayIcon = nativeImage.createFromPath(iconPath);
      
      // 调整图标大小适配系统托盘
      if (process.platform === 'darwin') {
        trayIcon.setTemplateImage(true);
      }
      
      this.tray = new Tray(trayIcon);
      
      // 设置托盘提示文本
      this.tray.setToolTip('Miaoda - Claude Code 管理器');
      
      // 创建上下文菜单
      this.createContextMenu();
      
      // 设置托盘点击事件
      this.setupTrayEvents();
      
      console.log('✅ 系统托盘创建成功');
      
    } catch (error) {
      console.error('❌ 系统托盘创建失败:', error);
    }
  }

  /**
   * 获取托盘图标路径
   */
  getTrayIconPath() {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return path.join(__dirname, '../../assets/tray-icon-mac.png');
    } else if (platform === 'win32') {
      return path.join(__dirname, '../../assets/tray-icon-win.ico');
    } else {
      return path.join(__dirname, '../../assets/tray-icon-linux.png');
    }
  }

  /**
   * 创建上下文菜单
   */
  createContextMenu() {
    this.contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showMainWindow()
      },
      {
        label: '隐藏主窗口',
        click: () => this.hideMainWindow()
      },
      { type: 'separator' },
      {
        label: '保活状态',
        submenu: [
          {
            label: '🟢 进程守护: 已启用',
            enabled: false
          },
          {
            label: '🟢 开机启动: 已启用',
            enabled: false
          },
          {
            label: '🟢 端口管理: 已启用',
            enabled: false
          }
        ]
      },
      { type: 'separator' },
      {
        label: '设置',
        submenu: [
          {
            label: '保护级别',
            submenu: [
              {
                label: '最高保护',
                type: 'radio',
                checked: true,
                click: () => this.setProtectionLevel('maximum')
              },
              {
                label: '中等保护',
                type: 'radio',
                click: () => this.setProtectionLevel('moderate')
              },
              {
                label: '最低保护',
                type: 'radio',
                click: () => this.setProtectionLevel('minimum')
              }
            ]
          },
          {
            label: '启动时隐藏',
            type: 'checkbox',
            checked: false,
            click: (menuItem) => this.toggleStartHidden(menuItem.checked)
          }
        ]
      },
      { type: 'separator' },
      {
        label: '关于 Miaoda',
        click: () => this.showAbout()
      },
      {
        label: '退出',
        click: () => this.quitApplication()
      }
    ]);
    
    this.tray.setContextMenu(this.contextMenu);
  }

  /**
   * 设置托盘事件
   */
  setupTrayEvents() {
    // 单击托盘图标
    this.tray.on('click', () => {
      if (this.isHidden) {
        this.showMainWindow();
      } else {
        this.hideMainWindow();
      }
    });

    // 双击托盘图标
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    // 右键点击（Windows和Linux）
    this.tray.on('right-click', () => {
      this.tray.popUpContextMenu(this.contextMenu);
    });
  }

  /**
   * 显示主窗口
   */
  showMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // macOS特殊处理
      if (process.platform === 'darwin') {
        app.dock.show();
      }
      
      this.isHidden = false;
      this.updateContextMenu();
      
      console.log('👁️ 主窗口已显示');
    }
  }

  /**
   * 隐藏主窗口
   */
  hideMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
      
      // macOS特殊处理
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      
      this.isHidden = true;
      this.updateContextMenu();
      
      console.log('👁️‍🗨️ 主窗口已隐藏到系统托盘');
      
      // 显示隐藏通知
      this.showHideNotification();
    }
  }

  /**
   * 显示隐藏通知
   */
  showHideNotification() {
    if (this.tray) {
      this.tray.displayBalloon({
        title: 'Miaoda',
        content: '应用已最小化到系统托盘，点击托盘图标可重新显示',
        icon: this.getTrayIconPath()
      });
    }
  }

  /**
   * 更新上下文菜单
   */
  updateContextMenu() {
    const template = this.contextMenu.items.map(item => {
      if (item.label === '显示主窗口') {
        return { ...item, enabled: this.isHidden };
      } else if (item.label === '隐藏主窗口') {
        return { ...item, enabled: !this.isHidden };
      }
      return item;
    });
    
    this.contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(this.contextMenu);
  }

  /**
   * 设置保护级别
   */
  setProtectionLevel(level) {
    console.log(`🔧 通过托盘设置保护级别: ${level}`);
    
    // 发送事件到主进程
    if (this.mainWindow) {
      this.mainWindow.webContents.send('protection-level-changed', level);
    }
    
    // 更新托盘状态显示
    this.updateProtectionStatus(level);
  }

  /**
   * 更新保护状态显示
   */
  updateProtectionStatus(level) {
    const statusMap = {
      maximum: '🔴 最高保护',
      moderate: '🟡 中等保护',
      minimum: '🟢 最低保护'
    };
    
    const status = statusMap[level] || '🟢 最低保护';
    
    // 更新托盘提示文本
    this.tray.setToolTip(`Miaoda - ${status}`);
  }

  /**
   * 切换启动时隐藏
   */
  toggleStartHidden(enabled) {
    console.log(`🔧 启动时隐藏: ${enabled ? '启用' : '禁用'}`);
    
    // 发送事件到主进程
    if (this.mainWindow) {
      this.mainWindow.webContents.send('start-hidden-changed', enabled);
    }
  }

  /**
   * 显示关于对话框
   */
  showAbout() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('show-about');
    }
  }

  /**
   * 退出应用程序
   */
  quitApplication() {
    console.log('🚪 用户通过托盘退出应用');
    
    // 显示确认对话框
    const { dialog } = require('electron');
    const choice = dialog.showMessageBoxSync(this.mainWindow, {
      type: 'question',
      buttons: ['退出', '取消'],
      defaultId: 1,
      title: '确认退出',
      message: '确定要退出 Miaoda 吗？',
      detail: '退出后将无法继续管理 Claude Code'
    });
    
    if (choice === 0) {
      // 用户选择退出
      this.forceQuit();
    }
  }

  /**
   * 强制退出应用程序
   */
  forceQuit() {
    console.log('🚪 强制退出应用');
    
    // 设置强制退出标志
    global.forceQuit = true;
    
    // 销毁托盘
    if (this.tray) {
      this.tray.destroy();
    }
    
    // 退出应用
    app.quit();
  }

  /**
   * 绑定应用事件
   */
  bindEvents() {
    // 监听窗口事件
    if (this.mainWindow) {
      // 注意：窗口关闭事件已在主进程中处理
      
      this.mainWindow.on('minimize', (event) => {
        // 最小化时隐藏到托盘
        event.preventDefault();
        this.hideMainWindow();
      });
    }

    // 监听应用激活事件（macOS）
    app.on('activate', () => {
      if (this.isHidden) {
        this.showMainWindow();
      }
    });

    // 监听应用退出前事件
    app.on('before-quit', (event) => {
      if (this.isHidden) {
        // 如果应用隐藏在托盘中，询问是否真的要退出
        const { dialog } = require('electron');
        
        const choice = dialog.showMessageBoxSync(null, {
          type: 'question',
          buttons: ['退出', '取消'],
          defaultId: 1,
          title: '确认退出',
          message: '确定要退出 Miaoda 吗？',
          detail: '退出后保活机制将停止工作'
        });

        if (choice === 1) {
          event.preventDefault();
        }
      }
    });
  }

  /**
   * 更新托盘状态
   */
  updateStatus(status) {
    if (!this.tray) return;
    
    // 更新保活状态显示
    const statusItems = [
      `${status.processGuardian ? '🟢' : '🔴'} 进程守护: ${status.processGuardian ? '已启用' : '已禁用'}`,
      `${status.autoLaunch ? '🟢' : '🔴'} 开机启动: ${status.autoLaunch ? '已启用' : '已禁用'}`,
      `${status.portManager ? '🟢' : '🔴'} 端口管理: ${status.portManager ? '已启用' : '已禁用'}`
    ];
    
    // 重建上下文菜单以更新状态
    const template = [
      {
        label: '显示主窗口',
        click: () => this.showMainWindow(),
        enabled: this.isHidden
      },
      {
        label: '隐藏主窗口',
        click: () => this.hideMainWindow(),
        enabled: !this.isHidden
      },
      { type: 'separator' },
      {
        label: '保活状态',
        submenu: statusItems.map(item => ({
          label: item,
          enabled: false
        }))
      },
      { type: 'separator' },
      {
        label: '设置',
        submenu: [
          {
            label: '保护级别',
            submenu: [
              {
                label: '最高保护',
                type: 'radio',
                checked: status.protectionLevel === 'maximum',
                click: () => this.setProtectionLevel('maximum')
              },
              {
                label: '中等保护',
                type: 'radio',
                checked: status.protectionLevel === 'moderate',
                click: () => this.setProtectionLevel('moderate')
              },
              {
                label: '最低保护',
                type: 'radio',
                checked: status.protectionLevel === 'minimum',
                click: () => this.setProtectionLevel('minimum')
              }
            ]
          },
          {
            label: '启动时隐藏',
            type: 'checkbox',
            checked: status.startHidden || false,
            click: (menuItem) => this.toggleStartHidden(menuItem.checked)
          }
        ]
      },
      { type: 'separator' },
      {
        label: '关于 Miaoda',
        click: () => this.showAbout()
      },
      {
        label: '退出',
        click: () => this.quitApplication()
      }
    ];
    
    this.contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(this.contextMenu);
  }

  /**
   * 销毁托盘
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('🗑️ 系统托盘已销毁');
    }
  }

  /**
   * 获取托盘状态
   */
  getStatus() {
    return {
      isCreated: !!this.tray,
      isHidden: this.isHidden,
      platform: process.platform
    };
  }
}

module.exports = SystemTray;