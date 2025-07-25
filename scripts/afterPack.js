exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const { platform } = packager;
  
  if (platform.name === 'mac') {
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    const appPath = path.join(appOutDir, `${packager.appInfo.productName}.app`);
    
    console.log('🔧 处理 macOS 应用包...');
    
    try {
      // 确保应用包有正确的权限
      execSync(`chmod -R 755 "${appPath}"`);
      console.log('✅ 设置应用权限');
      
      // 清除可能存在的扩展属性
      execSync(`xattr -cr "${appPath}"`);
      console.log('✅ 清除扩展属性');
      
      // 创建一个临时的代码签名（ad-hoc）
      // 这允许应用在 Gatekeeper 下显示"仍要打开"选项
      try {
        execSync(`codesign --force --deep --sign - "${appPath}"`);
        console.log('✅ 应用临时签名');
      } catch (e) {
        console.log('⚠️  临时签名失败（这是正常的）');
      }
      
    } catch (error) {
      console.error('处理应用包时出错:', error);
    }
  }
};