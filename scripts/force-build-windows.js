#!/usr/bin/env node

/**
 * 强制本机构建 Windows 版本
 * 绕过 Wine 架构问题的解决方案
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 强制 Windows 构建解决方案');
console.log('================================');
console.log('');

// 1. 禁用代码签名和图标设置来避免 Wine 依赖
function createBypassConfig() {
    const pkg = require('../package.json');
    
    // 创建临时的构建配置，跳过需要 Wine 的步骤
    const tempConfig = {
        ...pkg,
        build: {
            ...pkg.build,
            win: {
                target: [
                    {
                        target: "nsis",
                        arch: ["x64"]
                    },
                    {
                        target: "zip", 
                        arch: ["x64"]
                    }
                ],
                // 移除图标设置以避免 rcedit.exe 调用
                // icon: undefined
            },
            nsis: {
                ...pkg.build.nsis,
                // 禁用图标相关设置
                installerIcon: undefined,
                uninstallerIcon: undefined,
                installerHeaderIcon: undefined
            },
            // 禁用代码签名
            forceCodeSigning: false,
            // 跳过应用程序图标处理
            electronVersion: "28.3.3"
        }
    };
    
    // 写入临时配置文件
    fs.writeFileSync('package-temp.json', JSON.stringify(tempConfig, null, 2));
    console.log('✅ 创建临时构建配置 (跳过 Wine 依赖项)');
}

// 2. 使用环境变量强制跳过问题步骤
function setBypassEnvironment() {
    process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';
    process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = '1'; // 最快压缩
    process.env.BUILD_WIN32_FROM_DARWIN = 'true';
    process.env.SKIP_DIST_VALIDATION = 'true';
    
    console.log('✅ 设置绕过环境变量');
}

// 3. 修改 electron-builder 配置以避免 Wine
function patchElectronBuilder() {
    try {
        // 尝试安装 electron-builder 的替代方案
        console.log('📦 检查并安装必要依赖...');
        
        try {
            execSync('npm list electron-packager', { stdio: 'ignore' });
        } catch {
            console.log('安装 electron-packager 作为备用方案...');
            execSync('npm install --save-dev electron-packager@17.1.1', { stdio: 'inherit' });
        }
        
        console.log('✅ 依赖检查完成');
    } catch (error) {
        console.log('⚠️ 依赖安装警告:', error.message);
    }
}

// 4. 创建仅打包的构建脚本
function buildWithElectronPackager() {
    console.log('🔨 使用 electron-packager 构建...');
    
    const version = require('../package.json').version;
    const appName = require('../package.json').build.productName;
    
    try {
        // 使用 electron-packager 进行基础打包
        const packagerCmd = [
            'npx electron-packager',
            '.',
            `"${appName}"`,
            '--platform=win32',
            '--arch=x64',
            '--out=dist',
            '--overwrite',
            `--app-version=${version}`,
            '--prune=true',
            '--ignore="node_modules/(electron-builder|electron-packager)"'
        ].join(' ');
        
        console.log('执行命令:', packagerCmd);
        execSync(packagerCmd, { stdio: 'inherit' });
        
        console.log('✅ 基础打包完成');
        return true;
    } catch (error) {
        console.log('❌ electron-packager 构建失败:', error.message);
        return false;
    }
}

// 5. 创建简单的 ZIP 打包
function createZipPackage() {
    console.log('📦 创建 ZIP 打包...');
    
    const version = require('../package.json').version;
    const appName = require('../package.json').build.productName;
    
    try {
        // 查找打包后的目录
        const distDir = 'dist';
        const appDirs = fs.readdirSync(distDir).filter(name => 
            name.includes(appName) && name.includes('win32')
        );
        
        if (appDirs.length === 0) {
            throw new Error('未找到打包后的应用目录');
        }
        
        const appDir = path.join(distDir, appDirs[0]);
        const zipName = `${appName}-${version}-win.zip`;
        
        // 使用系统的 zip 命令
        const zipCmd = `cd "${appDir}" && zip -r "../${zipName}" .`;
        execSync(zipCmd, { stdio: 'inherit' });
        
        console.log(`✅ 创建 ZIP 包: dist/${zipName}`);
        return true;
    } catch (error) {
        console.log('❌ ZIP 打包失败:', error.message);
        return false;
    }
}

// 6. 尝试强制 electron-builder 构建
function forceElectronBuilder() {
    console.log('🚀 尝试强制 electron-builder 构建...');
    
    try {
        // 使用临时配置文件
        const builderCmd = 'npx electron-builder --config package-temp.json --win --x64 --publish=never';
        console.log('执行命令:', builderCmd);
        
        execSync(builderCmd, { 
            stdio: 'inherit',
            env: {
                ...process.env,
                ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true',
                DEBUG: 'electron-builder'
            }
        });
        
        console.log('✅ electron-builder 强制构建成功');
        return true;
    } catch (error) {
        console.log('⚠️ electron-builder 构建遇到问题，继续使用备用方案...');
        console.log('错误详情:', error.message);
        return false;
    }
}

// 7. 清理临时文件
function cleanup() {
    try {
        if (fs.existsSync('package-temp.json')) {
            fs.unlinkSync('package-temp.json');
        }
        console.log('✅ 清理临时文件');
    } catch (error) {
        console.log('⚠️ 清理警告:', error.message);
    }
}

// 主执行流程
async function main() {
    try {
        console.log('开始强制构建 Windows 版本...');
        console.log('');
        
        // 设置绕过环境
        setBypassEnvironment();
        
        // 创建绕过配置
        createBypassConfig();
        
        // 安装必要依赖
        patchElectronBuilder();
        
        console.log('');
        console.log('🎯 尝试多种构建方法...');
        console.log('');
        
        // 方法1: 尝试强制 electron-builder
        let success = forceElectronBuilder();
        
        if (!success) {
            console.log('');
            console.log('📋 方法1失败，尝试方法2...');
            
            // 方法2: 使用 electron-packager
            success = buildWithElectronPackager();
            
            if (success) {
                // 创建 ZIP 包
                createZipPackage();
            }
        }
        
        // 清理
        cleanup();
        
        if (success) {
            console.log('');
            console.log('🎉 Windows 版本构建完成！');
            console.log('');
            console.log('📦 查看构建结果:');
            
            // 显示构建结果
            if (fs.existsSync('dist')) {
                const files = fs.readdirSync('dist').filter(f => 
                    f.includes('win') || f.endsWith('.exe')
                );
                files.forEach(file => {
                    const stats = fs.statSync(path.join('dist', file));
                    const size = (stats.size / 1024 / 1024).toFixed(1);
                    console.log(`- ${file} (${size} MB)`);
                });
            }
        } else {
            console.log('');
            console.log('❌ 所有构建方法都失败了');
            console.log('💡 建议使用 GitHub Actions 或 Windows 环境进行构建');
        }
        
    } catch (error) {
        console.error('💥 构建过程发生错误:', error.message);
        cleanup();
        process.exit(1);
    }
}

// 运行
if (require.main === module) {
    main();
}

module.exports = { main };