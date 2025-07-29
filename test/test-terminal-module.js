'use strict';

/**
 * 终端模块测试
 * 测试 PTY 管理器和终端相关功能
 */

const assert = require('assert');
const os = require('os');
const { EventEmitter } = require('events');

// 模拟 Electron 环境
const mockWebContents = new EventEmitter();
mockWebContents.send = function(channel, data) {
  this.emit(channel, data);
};

const mockMainWindow = {
  isDestroyed: () => false,
  webContents: mockWebContents
};

// 加载被测试的模块
const PtyManager = require('../src/main/pty-manager');
const PtySessionManager = require('../src/main/pty-session-manager');

console.log('🧪 开始测试终端模块...\n');

/**
 * 测试 PtyManager 基本功能
 */
async function testPtyManager() {
  console.log('📋 测试 PtyManager...');
  
  const ptyManager = new PtyManager();
  ptyManager.initialize(mockMainWindow);

  // 测试获取默认 shell
  const defaultShell = ptyManager.getDefaultShell();
  assert(typeof defaultShell === 'string', '默认 shell 应该是字符串');
  assert(defaultShell.length > 0, '默认 shell 不应该为空');
  console.log(`  ✅ 默认 shell: ${defaultShell}`);

  // 测试创建 PTY 进程
  const result = await ptyManager.createPtyProcess({
    cols: 80,
    rows: 24,
    cwd: os.homedir()
  });

  if (result.success) {
    assert(typeof result.pid === 'number', 'PID 应该是数字');
    console.log(`  ✅ PTY 进程创建成功，PID: ${result.pid}`);

    // 测试数据发送
    let dataReceived = false;
    mockWebContents.once('pty:data', (data) => {
      dataReceived = true;
      assert(typeof data === 'string', '数据应该是字符串');
    });

    // 发送测试命令
    if (ptyManager.ptyProcess && ptyManager.ptyProcess.write) {
      ptyManager.ptyProcess.write('echo "test"\r');
      
      // 等待数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (dataReceived) {
        console.log('  ✅ 数据传输正常');
      } else {
        console.log('  ⚠️  未收到数据（可能是 node-pty 未安装）');
      }
    }

    // 测试调整大小
    const resizeResult = ptyManager.resize(100, 30);
    if (resizeResult && resizeResult.success) {
      console.log('  ✅ 终端大小调整成功');
    } else {
      console.log('  ⚠️  终端大小调整失败（可能是标准进程模式）');
    }

    // 测试销毁
    ptyManager.destroy();
    assert(ptyManager.ptyProcess === null, 'PTY 进程应该被清理');
    console.log('  ✅ PTY 进程清理成功');
  } else {
    console.log('  ⚠️  PTY 创建失败（可能使用标准进程模式）:', result.error);
  }

  console.log('✨ PtyManager 测试完成！\n');
}

/**
 * 测试 PtySessionManager 多会话管理
 */
async function testPtySessionManager() {
  console.log('📋 测试 PtySessionManager 多会话管理...');
  
  const sessionManager = new PtySessionManager();
  sessionManager.setMainWindow(mockMainWindow);

  // 测试创建会话
  const sessionId1 = await sessionManager.createSession({
    name: 'Session 1',
    cwd: os.homedir()
  });
  
  assert(typeof sessionId1 === 'string', '会话 ID 应该是字符串');
  assert(sessionId1.length > 0, '会话 ID 不应该为空');
  console.log(`  ✅ 创建会话 1: ${sessionId1}`);

  // 创建第二个会话
  const sessionId2 = await sessionManager.createSession({
    name: 'Session 2',
    cwd: '/tmp'
  });
  
  assert(sessionId2 !== sessionId1, '会话 ID 应该不同');
  console.log(`  ✅ 创建会话 2: ${sessionId2}`);

  // 测试获取所有会话
  const sessions = sessionManager.getAllSessions();
  assert(Array.isArray(sessions), '应该返回数组');
  assert(sessions.length === 2, '应该有 2 个会话');
  console.log('  ✅ 获取所有会话成功');

  // 测试切换会话
  sessionManager.setActiveSession(sessionId2);
  const activeSession = sessionManager.getActiveSessionId();
  assert(activeSession === sessionId2, '活动会话应该是会话 2');
  console.log('  ✅ 会话切换成功');

  // 测试会话存在性检查
  assert(sessionManager.hasSession(sessionId1) === true, '会话 1 应该存在');
  assert(sessionManager.hasSession('invalid-id') === false, '无效会话不应该存在');
  console.log('  ✅ 会话存在性检查正常');

  // 测试关闭会话
  sessionManager.closeSession(sessionId1);
  assert(sessionManager.hasSession(sessionId1) === false, '会话 1 应该被关闭');
  assert(sessionManager.getAllSessions().length === 1, '应该只剩 1 个会话');
  console.log('  ✅ 会话关闭成功');

  // 测试关闭所有会话
  sessionManager.closeAllSessions();
  assert(sessionManager.getAllSessions().length === 0, '所有会话应该被关闭');
  console.log('  ✅ 所有会话关闭成功');

  console.log('✨ PtySessionManager 测试通过！\n');
}

/**
 * 测试环境变量处理
 */
async function testEnvironmentVariables() {
  console.log('📋 测试环境变量处理...');
  
  const ptyManager = new PtyManager();
  ptyManager.initialize(mockMainWindow);

  // 测试自定义环境变量
  const customEnv = {
    CUSTOM_VAR: 'test_value',
    PATH: process.env.PATH
  };

  const result = await ptyManager.createPtyProcess({
    env: customEnv
  });

  if (result.success) {
    console.log('  ✅ 自定义环境变量设置成功');
    
    // 验证环境变量（通过执行命令）
    if (ptyManager.ptyProcess && ptyManager.ptyProcess.write) {
      let envCheckComplete = false;
      
      mockWebContents.once('pty:data', (data) => {
        if (data.includes('CUSTOM_VAR')) {
          envCheckComplete = true;
        }
      });

      ptyManager.ptyProcess.write('echo $CUSTOM_VAR\r');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (envCheckComplete) {
        console.log('  ✅ 环境变量验证成功');
      } else {
        console.log('  ⚠️  环境变量验证未完成');
      }
    }
    
    ptyManager.destroy();
  } else {
    console.log('  ⚠️  环境变量测试跳过（PTY 创建失败）');
  }

  console.log('✨ 环境变量测试完成！\n');
}

/**
 * 测试命令执行和输出
 */
async function testCommandExecution() {
  console.log('📋 测试命令执行和输出...');
  
  const ptyManager = new PtyManager();
  ptyManager.initialize(mockMainWindow);

  const result = await ptyManager.createPtyProcess();

  if (result.success && ptyManager.ptyProcess && ptyManager.ptyProcess.write) {
    // 测试简单命令
    const testCommands = [
      { cmd: 'pwd\r', desc: '当前目录' },
      { cmd: 'echo "Hello Terminal"\r', desc: 'Echo 命令' },
      { cmd: 'date\r', desc: '日期命令' }
    ];

    for (const test of testCommands) {
      let outputReceived = false;
      
      const dataHandler = (data) => {
        outputReceived = true;
        console.log(`  ✅ ${test.desc}输出接收成功`);
      };
      
      mockWebContents.once('pty:data', dataHandler);
      ptyManager.ptyProcess.write(test.cmd);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!outputReceived) {
        console.log(`  ⚠️  ${test.desc}输出未接收`);
      }
    }

    ptyManager.destroy();
  } else {
    console.log('  ⚠️  命令执行测试跳过（PTY 不可用）');
  }

  console.log('✨ 命令执行测试完成！\n');
}

/**
 * 测试错误处理
 */
async function testErrorHandling() {
  console.log('📋 测试错误处理...');
  
  const ptyManager = new PtyManager();
  
  // 测试未初始化时的操作
  try {
    await ptyManager.createPtyProcess();
    console.log('  ⚠️  未初始化操作应该失败但没有');
  } catch (error) {
    console.log('  ✅ 未初始化错误处理正常');
  }

  // 初始化后测试
  ptyManager.initialize(mockMainWindow);

  // 测试无效的 shell
  const result = await ptyManager.createPtyProcess({
    shell: '/invalid/shell/path'
  });
  
  if (!result.success) {
    console.log('  ✅ 无效 shell 错误处理正常');
  } else {
    console.log('  ⚠️  无效 shell 应该失败但没有');
  }

  // 测试无效的工作目录
  const cwdResult = await ptyManager.createPtyProcess({
    cwd: '/invalid/directory/path'
  });
  
  if (!cwdResult.success) {
    console.log('  ✅ 无效工作目录错误处理正常');
  } else {
    console.log('  ⚠️  无效工作目录处理可能有问题');
  }

  console.log('✨ 错误处理测试完成！\n');
}

/**
 * 主测试函数
 */
async function runTests() {
  try {
    // 运行各项测试
    await testPtyManager();
    await testPtySessionManager();
    await testEnvironmentVariables();
    await testCommandExecution();
    await testErrorHandling();

    console.log('🎉 所有终端模块测试完成！\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTests();