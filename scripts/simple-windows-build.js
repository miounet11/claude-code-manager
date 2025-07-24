#!/usr/bin/env node

/**
 * 简化的 Windows 构建方案
 * 不依赖 Wine，生成基础的 Windows 版本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 简化 Windows 构建方案');
console.log('=======================');
console.log('');

async function main() {
    try {
        // 1. 确保安装了 electron-packager
        console.log('📦 检查 electron-packager...');
        try {
            execSync('npm list electron-packager', { stdio: 'ignore' });
            console.log('✅ electron-packager 已安装');
        } catch {
            console.log('🔧 安装 electron-packager...');
            execSync('npm install --save-dev electron-packager@17.1.1', { stdio: 'inherit' });
        }

        // 2. 获取项目信息
        const pkg = require('../package.json');
        const appName = pkg.build.productName || pkg.name;
        const version = pkg.version;

        console.log(`📋 项目信息:`);
        console.log(`   - 应用名称: ${appName}`);
        console.log(`   - 版本: ${version}`);
        console.log('');

        // 3. 清理旧的构建
        const distDir = 'dist';
        if (fs.existsSync(distDir)) {
            console.log('🧹 清理旧的构建文件...');
            fs.rmSync(distDir, { recursive: true, force: true });
        }

        // 4. 使用 electron-packager 构建（不包含图标和元数据）
        console.log('🔨 开始构建 Windows 版本...');
        
        const packagerArgs = [
            'npx electron-packager',
            '.',
            `"${appName}"`,
            '--platform=win32',
            '--arch=x64',
            '--out=dist',
            '--overwrite',
            '--prune=true',
            '--ignore="node_modules/(electron-builder|electron-packager)"',
            '--ignore="dist"',
            '--ignore="scripts"',
            '--ignore="\\.git"',
            '--ignore="README\\.md"',
            '--ignore="docs"'
        ];

        const command = packagerArgs.join(' ');
        console.log('执行命令:', command);
        console.log('');

        execSync(command, { stdio: 'inherit' });

        console.log('');
        console.log('✅ 基础打包完成！');

        // 5. 查找生成的目录
        const distContents = fs.readdirSync(distDir);
        const appDir = distContents.find(name => 
            name.includes(appName) && name.includes('win32')
        );

        if (!appDir) {
            throw new Error('未找到生成的应用目录');
        }

        const appPath = path.join(distDir, appDir);
        console.log(`📁 应用目录: ${appPath}`);

        // 6. 创建 ZIP 压缩包
        console.log('📦 创建 ZIP 压缩包...');
        const zipName = `${appName}-${version}-win64-portable.zip`;
        
        try {
            // 使用系统的 zip 命令
            execSync(`cd "${appPath}" && zip -r "../${zipName}" .`, { stdio: 'inherit' });
            console.log(`✅ 创建压缩包: dist/${zipName}`);
        } catch (error) {
            console.log('⚠️ ZIP 压缩失败，但应用文件已生成');
        }

        // 7. 显示结果
        console.log('');
        console.log('🎉 Windows 版本构建完成！');
        console.log('');
        console.log('📦 生成的文件:');
        
        // 显示文件信息
        if (fs.existsSync(appPath)) {
            const exeFiles = fs.readdirSync(appPath).filter(f => f.endsWith('.exe'));
            exeFiles.forEach(file => {
                const filePath = path.join(appPath, file);
                const stats = fs.statSync(filePath);
                const size = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`- ${file} (${size} MB)`);
            });
        }

        const zipPath = path.join(distDir, zipName);
        if (fs.existsSync(zipPath)) {
            const stats = fs.statSync(zipPath);
            const size = (stats.size / 1024 / 1024).toFixed(1);
            console.log(`- ${zipName} (${size} MB)`);
        }

        console.log('');
        console.log('📁 文件位置:');
        console.log(`   - 应用目录: ${appPath}`);
        if (fs.existsSync(zipPath)) {
            console.log(`   - 压缩包: ${zipPath}`);
        }

        console.log('');
        console.log('💡 使用说明:');
        console.log('   1. 解压 ZIP 文件到任意目录');
        console.log(`   2. 运行 ${appName}.exe 启动应用`);
        console.log('   3. 这是便携版，不需要安装');

        console.log('');
        console.log('✅ Windows 版本构建成功完成！');

    } catch (error) {
        console.error('❌ 构建失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };