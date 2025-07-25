'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const environmentService = require('./environment-service');
const installerService = require('./installer-service');
const configService = require('./config-service');
const claudeService = require('./claude-service');

/**
 * IPC 控制器 - 统一管理所有 IPC 通信
 */
class IPCController {
  constructor() {
    this.mainWindow = null;
  }

  /**
   * 初始化所有 IPC 处理器
   */
  initialize(mainWindow) {
    this.mainWindow = mainWindow;
    
    // 环境相关
    this.setupEnvironmentHandlers();
    
    // 安装相关
    this.setupInstallerHandlers();
    
    // 配置相关
    this.setupConfigHandlers();
    
    // Claude 相关
    this.setupClaudeHandlers();
    
    // 通用处理器
    this.setupGeneralHandlers();
  }

  /**
   * 环境检测相关处理器
   */
  setupEnvironmentHandlers() {
    // 检查环境
    ipcMain.handle('env:check', async () => {
      return await environmentService.checkAll();
    });

    // 开始定期检查
    ipcMain.handle('env:start-periodic-check', async (event, interval) => {
      environmentService.startPeriodicCheck((result) => {
        this.sendToRenderer('env:status-update', result);
      }, interval);
      return { success: true };
    });

    // 停止定期检查
    ipcMain.handle('env:stop-periodic-check', async () => {
      environmentService.stopPeriodicCheck();
      return { success: true };
    });
  }

  /**
   * 安装相关处理器
   */
  setupInstallerHandlers() {
    // 安装单个依赖
    ipcMain.handle('install:dependency', async (event, dependency) => {
      return await installerService.install(dependency, (progress) => {
        this.sendToRenderer('install:progress', progress);
      });
    });

    // 批量安装
    ipcMain.handle('install:multiple', async (event, dependencies) => {
      return await installerService.installMultiple(dependencies, (progress) => {
        this.sendToRenderer('install:progress', progress);
      });
    });

    // 取消安装
    ipcMain.handle('install:cancel', async () => {
      installerService.cancel();
      return { success: true };
    });
  }

  /**
   * 配置相关处理器
   */
  setupConfigHandlers() {
    // 获取所有配置
    ipcMain.handle('config:get-all', async () => {
      return configService.getAllConfigs();
    });

    // 获取当前配置
    ipcMain.handle('config:get-current', async () => {
      return configService.getCurrentConfig();
    });

    // 添加配置
    ipcMain.handle('config:add', async (event, config) => {
      return configService.addConfig(config);
    });

    // 更新配置
    ipcMain.handle('config:update', async (event, id, updates) => {
      return configService.updateConfig(id, updates);
    });

    // 删除配置
    ipcMain.handle('config:delete', async (event, id) => {
      return configService.deleteConfig(id);
    });

    // 设置当前配置
    ipcMain.handle('config:set-current', async (event, id) => {
      const config = configService.setCurrentConfig(id);
      this.sendToRenderer('config:current-changed', config);
      return config;
    });

    // 验证配置
    ipcMain.handle('config:validate', async (event, config) => {
      return configService.validateConfig(config);
    });

    // 导入配置
    ipcMain.handle('config:import', async (event, configData) => {
      return configService.importConfig(configData);
    });

    // 导出配置
    ipcMain.handle('config:export', async (event, id) => {
      return configService.exportConfig(id);
    });

    // 复制配置
    ipcMain.handle('config:duplicate', async (event, id) => {
      return configService.duplicateConfig(id);
    });
  }

  /**
   * Claude 相关处理器
   */
  setupClaudeHandlers() {
    // 启动 Claude
    ipcMain.handle('claude:start', async (event, config) => {
      // 先检查环境
      const envStatus = await environmentService.checkAll();
      const ready = envStatus.summary.ready;
      
      if (!ready) {
        throw new Error('环境未就绪：' + envStatus.summary.message);
      }

      return await claudeService.start(config || configService.getCurrentConfig(), ready);
    });

    // 停止 Claude
    ipcMain.handle('claude:stop', async () => {
      return claudeService.stop();
    });

    // 重启 Claude
    ipcMain.handle('claude:restart', async () => {
      return await claudeService.restart();
    });

    // 获取状态
    ipcMain.handle('claude:status', async () => {
      return claudeService.getStatus();
    });

    // 发送输入
    ipcMain.on('claude:input', (event, data) => {
      try {
        claudeService.sendInput(data);
      } catch (error) {
        this.sendToRenderer('claude:error', { message: error.message });
      }
    });

    // 监听 Claude 事件
    claudeService.on('output', (data) => {
      this.sendToRenderer('claude:output', data);
    });

    claudeService.on('error', (error) => {
      this.sendToRenderer('claude:error', error);
    });

    claudeService.on('exit', (info) => {
      this.sendToRenderer('claude:exit', info);
    });

    claudeService.on('starting', (info) => {
      this.sendToRenderer('claude:starting', info);
    });

    claudeService.on('started', (info) => {
      this.sendToRenderer('claude:started', info);
    });

    claudeService.on('stopping', () => {
      this.sendToRenderer('claude:stopping');
    });
  }

  /**
   * 通用处理器
   */
  setupGeneralHandlers() {
    // 获取应用版本
    ipcMain.handle('app:version', () => {
      return require('electron').app.getVersion();
    });

    // 获取系统信息
    ipcMain.handle('app:system-info', async () => {
      return await environmentService.getSystemInfo();
    });

    // 打开外部链接
    ipcMain.handle('app:open-external', async (event, url) => {
      const { shell } = require('electron');
      await shell.openExternal(url);
      return { success: true };
    });

    // 显示错误对话框
    ipcMain.handle('app:show-error', async (event, title, message) => {
      const { dialog } = require('electron');
      dialog.showErrorBox(title, message);
      return { success: true };
    });

    // 窗口控制
    ipcMain.on('window:minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.on('window:maximize', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize();
        } else {
          this.mainWindow.maximize();
        }
      }
    });

    ipcMain.on('window:close', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });

    ipcMain.on('app:quit', () => {
      require('electron').app.quit();
    });

    // 文件对话框
    ipcMain.handle('dialog:select-file', async (event, options) => {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(this.mainWindow, options);
      return result;
    });

    ipcMain.handle('dialog:save-file', async (event, options) => {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(this.mainWindow, options);
      return result;
    });
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 停止所有服务
    environmentService.stopPeriodicCheck();
    claudeService.stop();
    
    // 移除所有监听器
    ipcMain.removeAllListeners();
  }
}

// 导出单例
module.exports = new IPCController();