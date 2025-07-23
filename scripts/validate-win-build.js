#!/usr/bin/env node

/**
 * Windows 构建配置验证脚本
 * 用于验证 Windows 构建所需的配置和资源文件
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Windows 构建配置验证');
console.log('=' .repeat(50));

let hasErrors = false;

function checkFile(filePath, description) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`✅ ${description}: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
        return true;
    } else {
        console.log(`❌ ${description}: ${filePath} - 文件不存在`);
        hasErrors = true;
        return false;
    }
}

function validatePackageJson() {
    console.log('\n📦 package.json 配置验证');
    console.log('-'.repeat(30));
    
    try {
        const pkg = require(path.join(process.cwd(), 'package.json'));
        
        // 检查基本信息
        console.log(`✅ 应用名称: ${pkg.build?.productName || '未设置'}`);
        console.log(`✅ 应用ID: ${pkg.build?.appId || '未设置'}`);
        console.log(`✅ 版本: ${pkg.version}`);
        
        // 检查 Windows 配置
        if (pkg.build?.win) {
            console.log('✅ Windows 构建配置存在');
            console.log(`   - 目标格式: ${pkg.build.win.target?.map(t => t.target).join(', ')}`);
            console.log(`   - 支持架构: ${pkg.build.win.target?.map(t => t.arch?.join(', ')).join(', ')}`);
            console.log(`   - 图标文件: ${pkg.build.win.icon}`);
        } else {
            console.log('❌ Windows 构建配置缺失');
            hasErrors = true;
        }
        
        // 检查 NSIS 配置
        if (pkg.build?.nsis) {
            console.log('✅ NSIS 安装程序配置存在');
            console.log(`   - 单击安装: ${pkg.build.nsis.oneClick ? '是' : '否'}`);
            console.log(`   - 允许选择安装目录: ${pkg.build.nsis.allowToChangeInstallationDirectory ? '是' : '否'}`);
            console.log(`   - 创建桌面快捷方式: ${pkg.build.nsis.createDesktopShortcut ? '是' : '否'}`);
        } else {
            console.log('❌ NSIS 配置缺失');
            hasErrors = true;
        }
        
        // 检查构建脚本
        const scripts = pkg.scripts || {};
        const requiredScripts = ['dist-win', 'dist-win-portable', 'dist-all'];
        
        console.log('\n🔧 构建脚本验证');
        console.log('-'.repeat(20));
        
        requiredScripts.forEach(script => {
            if (scripts[script]) {
                console.log(`✅ ${script}: ${scripts[script]}`);
            } else {
                console.log(`❌ ${script}: 脚本不存在`);
                hasErrors = true;
            }
        });
        
    } catch (error) {
        console.log(`❌ 读取 package.json 失败: ${error.message}`);
        hasErrors = true;
    }
}

function validateAssets() {
    console.log('\n🎨 资源文件验证');
    console.log('-'.repeat(20));
    
    // Windows 必需的资源文件
    const requiredAssets = [
        { path: 'assets/icon.ico', desc: 'Windows 图标文件' },
        { path: 'assets/icon.png', desc: '通用图标文件' },
        { path: 'assets/icon.icns', desc: 'macOS 图标文件' }
    ];
    
    requiredAssets.forEach(asset => {
        checkFile(asset.path, asset.desc);
    });
}

function validateDependencies() {
    console.log('\n📚 依赖项验证');
    console.log('-'.repeat(15));
    
    try {
        const pkg = require(path.join(process.cwd(), 'package.json'));
        const devDeps = pkg.devDependencies || {};
        
        const requiredDeps = [
            'electron',
            'electron-builder'
        ];
        
        requiredDeps.forEach(dep => {
            if (devDeps[dep]) {
                console.log(`✅ ${dep}: ${devDeps[dep]}`);
            } else {
                console.log(`❌ ${dep}: 依赖项缺失`);
                hasErrors = true;
            }
        });
        
    } catch (error) {
        console.log(`❌ 验证依赖项失败: ${error.message}`);
        hasErrors = true;
    }
}

function validateEnvironment() {
    console.log('\n🌍 环境验证');
    console.log('-'.repeat(12));
    
    console.log(`✅ Node.js 版本: ${process.version}`);
    console.log(`✅ 平台: ${process.platform}`);
    console.log(`✅ 架构: ${process.arch}`);
    console.log(`✅ 工作目录: ${process.cwd()}`);
    
    if (process.platform === 'win32') {
        console.log('✅ 当前在 Windows 环境，可以直接构建 Windows 版本');
    } else {
        console.log('⚠️  当前不在 Windows 环境，需要使用 GitHub Actions 构建 Windows 版本');
    }
}

// 执行验证
validateEnvironment();
validatePackageJson();
validateAssets();
validateDependencies();

// 输出结果
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.log('❌ 验证失败，请修复上述问题后重试');
    console.log('\n💡 建议：');
    console.log('1. 确保所有必需的资源文件存在');
    console.log('2. 检查 package.json 中的构建配置');
    console.log('3. 在 Windows 环境或 GitHub Actions 中进行实际构建测试');
    process.exit(1);
} else {
    console.log('✅ Windows 构建配置验证通过！');
    console.log('\n🚀 下一步：');
    console.log('1. 在 Windows 环境中运行: npm run dist-win');
    console.log('2. 或使用 GitHub Actions 自动构建');
    console.log('3. 或推送标签触发自动发布');
    process.exit(0);
}