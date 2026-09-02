# 日程管家 APK 构建脚本（在 apk 目录运行）
# 作用：把上级目录的网页资源复制到 www -> 安装依赖 -> 添加安卓平台 -> 同步
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $PSScriptRoot

Write-Host "==> 1/4 复制网页资源到 www ..."
if (Test-Path www) { Remove-Item -Recurse -Force www }
New-Item -ItemType Directory -Force -Path www | Out-Null
Copy-Item "$root\index.html", "$root\manifest.webmanifest", "$root\sw.js" -Destination www
Copy-Item "$root\css", "$root\js", "$root\icons" -Recurse -Destination www
Remove-Item (Join-Path www 'icons\make_icons.py') -ErrorAction SilentlyContinue

Write-Host "==> 2/4 安装依赖（若未装）..."
if (-not (Test-Path node_modules)) { npm install }

Write-Host "==> 3/4 添加安卓平台（若未添加）..."
if (-not (Test-Path android)) { npx cap add android }

Write-Host "==> 4/4 同步网页资源与插件..."
npx cap sync android

Write-Host ""
Write-Host "已经生成安卓工程：$PSScriptRoot\android"
Write-Host "接下来：用 Android Studio 打开 apk\android，点击 Build > Build APK(s) 生成 apk。"
Write-Host "生成的 apk 在 apk\android\app\build\outputs\apk\debug\app-debug.apk"
