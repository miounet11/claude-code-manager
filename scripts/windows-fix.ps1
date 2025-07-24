# Windows Claude Code 修复脚本
# 解决Windows平台下的环境检测和启动问题

param(
    [switch]$InstallDependencies,
    [switch]$FixEncoding,
    [switch]$CheckEnvironment,
    [switch]$All
)

Write-Host "🔧 Claude Code Windows 修复工具" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 检查管理员权限
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# 修复编码问题
function Fix-Encoding {
    Write-Host "🔤 修复编码问题..." -ForegroundColor Yellow
    
    # 设置控制台编码为UTF-8
    chcp 65001 | Out-Null
    
    # 设置PowerShell编码
    $PSDefaultParameterValues['*:Encoding'] = 'utf8'
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    
    Write-Host "✅ 编码设置完成" -ForegroundColor Green
}

# 检查环境
function Check-Environment {
    Write-Host "🔍 检查环境..." -ForegroundColor Yellow
    
    $results = @{}
    
    # 检查Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            $results.nodejs = @{ installed = $true; version = $nodeVersion }
            Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
        } else {
            throw "未找到"
        }
    } catch {
        $results.nodejs = @{ installed = $false; error = "未安装" }
        Write-Host "❌ Node.js: 未安装" -ForegroundColor Red
    }
    
    # 检查Git
    try {
        $gitVersion = git --version 2>$null
        if ($gitVersion) {
            $results.git = @{ installed = $true; version = $gitVersion }
            Write-Host "✅ Git: $gitVersion" -ForegroundColor Green
        } else {
            throw "未找到"
        }
    } catch {
        $results.git = @{ installed = $false; error = "未安装" }
        Write-Host "❌ Git: 未安装" -ForegroundColor Red
    }
    
    # 检查UV
    try {
        $uvVersion = uv --version 2>$null
        if ($uvVersion) {
            $results.uv = @{ installed = $true; version = $uvVersion }
            Write-Host "✅ UV: $uvVersion" -ForegroundColor Green
        } else {
            throw "未找到"
        }
    } catch {
        $results.uv = @{ installed = $false; error = "未安装" }
        Write-Host "❌ UV: 未安装" -ForegroundColor Red
    }
    
    # 检查Claude Code
    try {
        $claudeVersion = claude --version 2>$null
        if ($claudeVersion) {
            $results.claude = @{ installed = $true; version = $claudeVersion }
            Write-Host "✅ Claude Code: $claudeVersion" -ForegroundColor Green
        } else {
            throw "未找到"
        }
    } catch {
        $results.claude = @{ installed = $false; error = "未安装" }
        Write-Host "❌ Claude Code: 未安装" -ForegroundColor Red
    }
    
    return $results
}

# 安装依赖
function Install-Dependencies {
    Write-Host "📦 安装依赖..." -ForegroundColor Yellow
    
    # 检查是否需要管理员权限
    if (-not (Test-Administrator)) {
        Write-Host "⚠️  建议以管理员身份运行以避免权限问题" -ForegroundColor Yellow
    }
    
    # 安装Node.js (如果未安装)
    try {
        node --version | Out-Null
        Write-Host "✅ Node.js 已安装" -ForegroundColor Green
    } catch {
        Write-Host "❌ Node.js 未安装，请访问 https://nodejs.org 下载安装" -ForegroundColor Red
    }
    
    # 安装Claude Code
    try {
        Write-Host "🔄 正在安装 Claude Code..." -ForegroundColor Yellow
        npm install -g @anthropic/claude-code
        Write-Host "✅ Claude Code 安装完成" -ForegroundColor Green
    } catch {
        Write-Host "❌ Claude Code 安装失败: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 尝试以管理员身份运行: npm install -g @anthropic/claude-code" -ForegroundColor Yellow
    }
    
    # 安装UV (可选)
    try {
        Write-Host "🔄 正在安装 UV..." -ForegroundColor Yellow
        # 使用官方推荐的安装方法
        $uvInstaller = Invoke-WebRequest -Uri "https://astral.sh/uv/install.ps1" -UseBasicParsing
        Invoke-Expression $uvInstaller.Content
        Write-Host "✅ UV 安装完成" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  UV 安装失败，可手动安装: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 修复PATH环境变量
function Fix-PathEnvironment {
    Write-Host "🛠️  修复PATH环境变量..." -ForegroundColor Yellow
    
    $nodeModulesPath = "$env:APPDATA\npm"
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    
    if ($currentPath -notlike "*$nodeModulesPath*") {
        Write-Host "📁 添加npm全局模块路径到PATH: $nodeModulesPath" -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$nodeModulesPath", "User")
        $env:PATH = "$env:PATH;$nodeModulesPath"
        Write-Host "✅ PATH环境变量已更新" -ForegroundColor Green
    } else {
        Write-Host "✅ PATH环境变量正常" -ForegroundColor Green
    }
}

# 主函数
function Main {
    if ($All -or $FixEncoding) {
        Fix-Encoding
    }
    
    if ($All -or $CheckEnvironment) {
        $results = Check-Environment
        Write-Host "`n📊 环境检查结果:" -ForegroundColor Cyan
        $results | ConvertTo-Json -Depth 3 | Write-Host
    }
    
    if ($All -or $InstallDependencies) {
        Install-Dependencies
        Fix-PathEnvironment
    }
    
    Write-Host "`n🎉 修复完成！请重新启动Claude Code应用。" -ForegroundColor Green
    Write-Host "💡 如果问题仍然存在，请尝试重新启动PowerShell或计算机。" -ForegroundColor Yellow
}

# 显示帮助
if (-not ($InstallDependencies -or $FixEncoding -or $CheckEnvironment -or $All)) {
    Write-Host @"
用法:
  .\windows-fix.ps1 -All                    # 执行所有修复
  .\windows-fix.ps1 -CheckEnvironment       # 仅检查环境
  .\windows-fix.ps1 -InstallDependencies    # 仅安装依赖
  .\windows-fix.ps1 -FixEncoding           # 仅修复编码

示例:  .\windows-fix.ps1 -All
"@ -ForegroundColor Yellow
} else {
    Main
}