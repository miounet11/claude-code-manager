#!/usr/bin/env node

/**
 * 最终 Windows 构建解决方案
 * 使用 @electron/packager 并跳过 Wine 依赖
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎯 最终 Windows 构建解决方案');
console.log('==========================');
console.log('');

async function main() {
    try {
        // 1. 安装最新的 @electron/packager
        console.log('📦 安装最新的 @electron/packager...');
        try {
            execSync('npm install --save-dev @electron/packager@18.3.3', { stdio: 'inherit' });
            console.log('✅ @electron/packager 安装完成');
        } catch (error) {
            console.log('⚠️ 安装警告，继续使用现有版本');
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

        // 4. 使用编程方式调用 packager 以避免 Wine 问题
        console.log('🔨 使用编程方式构建 Windows 版本...');
        
        const packager = require('@electron/packager');
        
        const options = {
            dir: '.',
            name: appName,
            platform: 'win32',
            arch: 'x64',
            out: 'dist',
            overwrite: true,
            prune: true,
            asar: false, // 不使用 asar 打包
            // 跳过需要 Wine 的选项
            // icon: undefined,
            // win32metadata: undefined,
            ignore: [
                /node_modules\/(electron-builder|@electron\/packager|electron-packager)/,
                /dist/,
                /scripts/,
                /\.git/,
                /README\.md/,
                /docs/,
                /\.github/
            ]
        };

        console.log('🚀 开始打包...');
        console.log('选项:', JSON.stringify(options, null, 2));
        console.log('');

        const appPaths = await packager(options);
        
        console.log('✅ 基础打包完成！');
        console.log('生成的路径:', appPaths);

        if (appPaths && appPaths.length > 0) {
            const appPath = appPaths[0];
            console.log(`📁 应用目录: ${appPath}`);

            // 5. 创建 ZIP 压缩包
            console.log('📦 创建 ZIP 压缩包...');
            const zipName = `${appName}-${version}-win64-portable.zip`;
            
            try {
                // 使用 Node.js 内置的 zip 功能替代外部命令
                const archiver = require('archiver');
                const output = fs.createWriteStream(path.join('dist', zipName));
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', () => {
                    const stats = fs.statSync(path.join('dist', zipName));
                    const size = (stats.size / 1024 / 1024).toFixed(1);
                    console.log(`✅ 创建压缩包: dist/${zipName} (${size} MB)`);
                });

                archive.pipe(output);
                archive.directory(appPath, false);
                archive.finalize();

            } catch (error) {
                // 如果没有 archiver，使用系统命令
                try {
                    execSync(`cd "${appPath}" && zip -r "../${zipName}" .`, { stdio: 'inherit' });
                    console.log(`✅ 创建压缩包: dist/${zipName}`);
                } catch (zipError) {
                    console.log('⚠️ ZIP 压缩失败，但应用文件已生成');
                }
            }

            // 6. 显示结果
            console.log('');
            console.log('🎉 Windows 版本构建完成！');
            console.log('');
            console.log('📦 生成的文件:');
            
            // 显示文件信息
            if (fs.existsSync(appPath)) {
                const files = fs.readdirSync(appPath);
                const exeFiles = files.filter(f => f.endsWith('.exe'));
                
                exeFiles.forEach(file => {
                    const filePath = path.join(appPath, file);
                    const stats = fs.statSync(filePath);
                    const size = (stats.size / 1024 / 1024).toFixed(1);
                    console.log(`- ${file} (${size} MB) - 主程序`);
                });

                // 显示其他重要文件
                const importantFiles = files.filter(f => 
                    f.includes('resources') || f.includes('locales') || f.endsWith('.dll')
                );
                
                if (importantFiles.length > 0) {
                    console.log('- 支持文件:', importantFiles.slice(0, 3).join(', '));
                    if (importantFiles.length > 3) {
                        console.log(`  (还有 ${importantFiles.length - 3} 个文件)`);
                    }
                }
            }

            const zipPath = path.join('dist', zipName);
            if (fs.existsSync(zipPath)) {
                const stats = fs.statSync(zipPath);
                const size = (stats.size / 1024 / 1024).toFixed(1);
                console.log(`- ${zipName} (${size} MB) - 便携版压缩包`);
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
            console.log(`   2. 双击 ${appName}.exe 启动应用`);
            console.log('   3. 这是便携版，无需安装，可直接运行');
            console.log('   4. 如需在其他 Windows 电脑使用，复制整个文件夹即可');

            console.log('');
            console.log('✅ Windows exe 文件生成成功！');

        } else {
            throw new Error('未能生成应用文件');
        }

    } catch (error) {
        console.error('❌ 构建失败:', error.message);
        console.log('');
        console.log('🔍 错误分析:');
        if (error.message.includes('wine')) {
            console.log('- Wine 相关错误，这在 macOS 上是常见问题');
            console.log('- 建议使用 GitHub Actions 或 Windows 环境进行构建');
        } else if (error.message.includes('Cannot find module')) {
            console.log('- 缺少依赖模块，请检查 node_modules');
            console.log('- 尝试运行: npm install');
        }
        
        console.log('');
        console.log('💡 替代方案:');
        console.log('1. 使用 GitHub Actions 自动构建');
        console.log('2. 在 Windows 系统中构建');
        console.log('3. 使用虚拟机或云服务');
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };