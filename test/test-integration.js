'use strict';

/**
 * 集成测试
 * 测试 IPC 通信、配置管理、Claude CLI 启动流程等集成功能
 */

const assert = require('assert');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 模拟 Electron 环境
const mockApp = {
  getVersion: () => '4.5.1',
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(os.homedir(), '.miaoda-test');
    }
    return os.homedir();
  }
};

const mockDialog = {
  showErrorBox: (title, message) => {
    console.log(`  📢 错误对话框: ${title} - ${message}`);
  }
};

const mockShell = {
  showItemInFolder: async (path) => {
    console.log(`  📂 打开文件夹: ${path}`);
    return true;
  }
};

// 模拟 ipcMain
const ipcMainHandlers = new Map();
const ipcMainListeners = new Map();

const mockIpcMain = {
  handle: (channel, handler) => {
    ipcMainHandlers.set(channel, handler);
  },
  on: (channel, listener) => {
    if (!ipcMainListeners.has(channel)) {
      ipcMainListeners.set(channel, []);
    }
    ipcMainListeners.get(channel).push(listener);
  },
  removeHandler: (channel) => {
    ipcMainHandlers.delete(channel);
  },
  removeAllListeners: (channel) => {
    if (channel) {
      ipcMainListeners.delete(channel);
    } else {
      ipcMainListeners.clear();
    }
  }
};

// 模拟 webContents
const mockWebContents = new EventEmitter();
mockWebContents.send = function(channel, ...args) {
  this.emit(channel, ...args);
};

const mockMainWindow = {
  isDestroyed: () => false,
  webContents: mockWebContents,
  minimize: () => console.log('  🪟 窗口最小化'),
  close: () => console.log('  🪟 窗口关闭')
};

// Mock electron 模块
require('module')._cache[require.resolve('electron')] = {
  exports: {
    app: mockApp,
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    shell: mockShell
  }
};

// 加载被测试的模块
const ipcControllerInstance = require('../src/main/services/ipc-controller-simple');
const ConfigService = require('../src/main/services/config-service');
const EnvironmentService = require('../src/main/services/environment-service');
const ClaudeService = require('../src/main/services/claude-service');
const ProxyServer = require('../src/main/services/proxy-server');

console.log('🧪 开始集成测试...\n');

/**
 * 测试 IPC 通信机制
 */
async function testIPCCommunication() {
  console.log('📋 测试 IPC 通信机制...');
  
  // 使用已导出的实例
  ipcControllerInstance.initialize(mockMainWindow);

  // 测试基本处理器
  try {
    // 测试版本获取
    const versionHandler = ipcMainHandlers.get('app:version');
    assert(versionHandler, '版本处理器应该存在');
    const version = await versionHandler();
    assert(version === '4.5.1', '版本应该正确');
    console.log('  ✅ 版本获取处理器正常');

    // 测试路径打开
    const pathHandler = ipcMainHandlers.get('app:open-path');
    assert(pathHandler, '路径打开处理器应该存在');
    const pathResult = await pathHandler(null, '/test/path');
    assert(pathResult === true, '路径打开应该成功');
    console.log('  ✅ 路径打开处理器正常');

    // 测试窗口控制监听器
    const minimizeListeners = ipcMainListeners.get('window:minimize');
    assert(minimizeListeners && minimizeListeners.length > 0, '最小化监听器应该存在');
    minimizeListeners[0](); // 触发最小化
    console.log('  ✅ 窗口控制监听器正常');

  } catch (error) {
    console.error('  ❌ IPC 通信测试失败:', error);
    throw error;
  }

  // 清理
  ipcControllerInstance.cleanup();
  console.log('✨ IPC 通信测试通过！\n');
}

/**
 * 测试配置管理功能
 */
async function testConfigManagement() {
  console.log('📋 测试配置管理功能...');
  
  // ConfigService 是单例，直接使用导入的实例
  const configService = ConfigService;
  const testConfigPath = path.join(os.tmpdir(), 'miaoda-test-config');
  
  // 创建测试配置目录
  await fs.mkdir(testConfigPath, { recursive: true });
  
  // 模拟存储路径
  configService.store.path = path.join(testConfigPath, 'config.json');

  try {
    // 测试保存配置
    const testConfig = {
      name: 'Test Config',
      apiUrl: 'https://api.test.com',
      apiKey: 'test-key-123',
      model: 'test-model'
    };
    
    configService.saveConfig(testConfig);
    console.log('  ✅ 配置保存成功');

    // 测试读取配置
    const savedConfigs = configService.getConfigs();
    assert(Array.isArray(savedConfigs), '配置列表应该是数组');
    assert(savedConfigs.length > 0, '应该有保存的配置');
    assert(savedConfigs[0].name === 'Test Config', '配置名称应该正确');
    console.log('  ✅ 配置读取成功');

    // 测试设置当前配置
    configService.setCurrentConfig(savedConfigs[0]);
    const currentConfig = configService.getCurrentConfig();
    assert(currentConfig.name === 'Test Config', '当前配置应该正确');
    console.log('  ✅ 当前配置设置成功');

    // 测试删除配置
    configService.deleteConfig(0);
    const remainingConfigs = configService.getConfigs();
    assert(remainingConfigs.length === savedConfigs.length - 1, '配置应该被删除');
    console.log('  ✅ 配置删除成功');

    // 测试恢复默认配置
    configService.restoreDefaults();
    const defaultConfigs = configService.getConfigs();
    assert(defaultConfigs.length > 0, '应该有默认配置');
    console.log('  ✅ 默认配置恢复成功');

  } catch (error) {
    console.error('  ❌ 配置管理测试失败:', error);
    throw error;
  } finally {
    // 清理测试文件
    await fs.rm(testConfigPath, { recursive: true, force: true });
  }

  console.log('✨ 配置管理测试通过！\n');
}

/**
 * 测试环境检测功能
 */
async function testEnvironmentDetection() {
  console.log('📋 测试环境检测功能...');
  
  const envService = EnvironmentService;

  try {
    // 测试 PATH 检测
    const systemPath = await envService.getSystemPath();
    assert(typeof systemPath === 'string', 'PATH 应该是字符串');
    assert(systemPath.length > 0, 'PATH 不应该为空');
    console.log('  ✅ 系统 PATH 检测成功');

    // 测试命令检测
    const commands = ['node', 'npm'];
    for (const cmd of commands) {
      const exists = await envService.commandExists(cmd);
      console.log(`  ${exists ? '✅' : '⚠️ '} 命令 '${cmd}' ${exists ? '存在' : '不存在'}`);
    }

    // 测试诊断功能
    const diagnostics = await envService.getDiagnostics();
    assert(typeof diagnostics === 'object', '诊断结果应该是对象');
    assert(diagnostics.platform, '应该包含平台信息');
    assert(diagnostics.nodeVersion, '应该包含 Node 版本');
    console.log('  ✅ 环境诊断功能正常');
    console.log(`  📊 平台: ${diagnostics.platform}`);
    console.log(`  📊 Node 版本: ${diagnostics.nodeVersion}`);

  } catch (error) {
    console.error('  ❌ 环境检测测试失败:', error);
    throw error;
  }

  console.log('✨ 环境检测测试通过！\n');
}

/**
 * 测试 Claude CLI 集成
 */
async function testClaudeIntegration() {
  console.log('📋 测试 Claude CLI 集成...');
  
  const claudeService = ClaudeService;
  const proxyServer = ProxyServer;

  try {
    // 测试 Claude 检测
    const isInstalled = await claudeService.checkClaudeInstalled();
    console.log(`  ${isInstalled ? '✅' : '⚠️ '} Claude CLI ${isInstalled ? '已安装' : '未安装'}`);

    if (isInstalled) {
      // 获取 Claude 版本
      const version = await claudeService.getClaudeVersion();
      if (version) {
        console.log(`  ✅ Claude 版本: ${version}`);
      }
    }

    // 测试启动配置生成
    const testConfig = {
      apiUrl: 'https://api.test.com',
      apiKey: 'test-key'
    };

    // 启动代理服务器
    await proxyServer.start(testConfig);
    
    const launchConfig = claudeService.prepareLaunchConfig(testConfig, proxyServer.port);
    assert(launchConfig.env.ANTHROPIC_API_URL, '应该设置 API URL 环境变量');
    assert(launchConfig.env.ANTHROPIC_API_KEY, '应该设置 API KEY 环境变量');
    assert(launchConfig.env.ANTHROPIC_API_URL.includes('8118'), '应该使用代理端口');
    console.log('  ✅ Claude 启动配置生成正常');

    // 停止代理服务器
    await proxyServer.stop();

  } catch (error) {
    console.error('  ❌ Claude 集成测试失败:', error);
    throw error;
  }

  console.log('✨ Claude 集成测试通过！\n');
}

/**
 * 测试完整的启动流程
 */
async function testCompleteStartupFlow() {
  console.log('📋 测试完整启动流程...');
  
  const configService = ConfigService;
  const claudeService = ClaudeService;
  const proxyServer = ProxyServer;
  const envService = EnvironmentService;

  try {
    // 1. 环境检查
    const envCheck = await envService.checkEnvironment();
    console.log('  ✅ 步骤 1: 环境检查完成');

    // 2. 加载配置
    const configs = configService.getConfigs();
    if (configs.length === 0) {
      configService.restoreDefaults();
    }
    const config = configs[0];
    console.log('  ✅ 步骤 2: 配置加载完成');

    // 3. 启动代理服务器
    await proxyServer.start(config);
    assert(proxyServer.isRunning, '代理服务器应该在运行');
    console.log(`  ✅ 步骤 3: 代理服务器启动在端口 ${proxyServer.port}`);

    // 4. 准备 Claude 启动
    const claudeInstalled = await claudeService.checkClaudeInstalled();
    if (claudeInstalled) {
      const launchConfig = claudeService.prepareLaunchConfig(config, proxyServer.port);
      assert(launchConfig.command, '应该有启动命令');
      console.log('  ✅ 步骤 4: Claude 启动准备完成');
    } else {
      console.log('  ⚠️  步骤 4: Claude 未安装，跳过启动准备');
    }

    // 5. 清理
    await proxyServer.stop();
    console.log('  ✅ 步骤 5: 清理完成');

  } catch (error) {
    console.error('  ❌ 启动流程测试失败:', error);
    if (proxyServer.isRunning) {
      await proxyServer.stop();
    }
    throw error;
  }

  console.log('✨ 完整启动流程测试通过！\n');
}

/**
 * 测试错误处理和恢复
 */
async function testErrorRecovery() {
  console.log('📋 测试错误处理和恢复...');
  
  const proxyServer = ProxyServer;
  const claudeService = ClaudeService;

  try {
    // 测试重复启动保护（单例模式）
    await proxyServer.start({ apiUrl: 'http://test.com', apiKey: 'key1' });
    
    try {
      await proxyServer.start({ apiUrl: 'http://test.com', apiKey: 'key2' });
      console.log('  ❌ 应该阻止重复启动');
      assert(false, '应该抛出重复启动错误');
    } catch (error) {
      assert(error.message.includes('已在运行'), '错误信息应该正确');
      console.log('  ✅ 重复启动保护正常');
    }
    
    await proxyServer.stop();

    // 测试进程清理
    claudeService.cleanup();
    assert(!claudeService.claudeProcess, 'Claude 进程应该被清理');
    console.log('  ✅ 进程清理正常');

  } catch (error) {
    console.error('  ❌ 错误恢复测试失败:', error);
    throw error;
  }

  console.log('✨ 错误处理测试通过！\n');
}

/**
 * 主测试函数
 */
async function runTests() {
  try {
    console.log('📌 测试环境准备...\n');
    
    // 运行各项集成测试
    await testIPCCommunication();
    await testConfigManagement();
    await testEnvironmentDetection();
    await testClaudeIntegration();
    await testCompleteStartupFlow();
    await testErrorRecovery();

    console.log('🎉 所有集成测试通过！\n');
    
    // 生成测试报告
    console.log('📊 测试报告总结：');
    console.log('  ✅ IPC 通信机制：正常');
    console.log('  ✅ 配置管理功能：正常');
    console.log('  ✅ 环境检测功能：正常');
    console.log('  ✅ Claude CLI 集成：正常');
    console.log('  ✅ 完整启动流程：正常');
    console.log('  ✅ 错误处理机制：正常');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 集成测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTests();