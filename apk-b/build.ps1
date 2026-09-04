# 日程管家 B方案 APK 构建脚本（在 apk-b 目录运行）
# 会把网页资源复制到 www、生成安卓工程、并注入【原生全屏闹钟插件】。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $PSScriptRoot

Write-Host "==> 1/5 复制网页资源 -> www ..."
if (Test-Path www) { Remove-Item -Recurse -Force www }
New-Item -ItemType Directory -Force -Path www | Out-Null
Copy-Item "$root\index.html", "$root\manifest.webmanifest", "$root\sw.js" -Destination www
Copy-Item "$root\css", "$root\js", "$root\icons" -Recurse -Destination www
Remove-Item (Join-Path www 'icons\make_icons.py') -ErrorAction SilentlyContinue

Write-Host "==> 2/5 安装依赖 ..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install 失败，exit=$LASTEXITCODE" }

Write-Host "==> 3/5 添加安卓平台 ..."
if (-not (Test-Path android)) {
  node node_modules/@capacitor/cli/bin/capacitor add android
  if ($LASTEXITCODE -ne 0) { throw "cap add android 失败，exit=$LASTEXITCODE" }
}

Write-Host "==> 4/5 注入原生全屏闹钟插件 ..."
$pkgDir = 'android\app\src\main\java\com\schedule\b'
New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null
Copy-Item 'native\AlarmPlugin.java','native\AlarmReceiver.java','native\AlarmActivity.java' -Destination $pkgDir -Force

# 保证 res（铃声/图标）：注意 cap add android 生成的工程里可能没有 res\raw，先建目录
New-Item -ItemType Directory -Force -Path 'android\app\src\main\res\raw' | Out-Null
Copy-Item "$root\apk\res-raw\schedule_alarm.wav" -Destination 'android\app\src\main\res\raw\schedule_alarm.wav' -Force
New-Item -ItemType Directory -Force -Path 'android\app\src\main\res\drawable' | Out-Null
Copy-Item "$root\apk\res-drawable\ic_stat_icon.xml" -Destination 'android\app\src\main\res\drawable\ic_stat_icon.xml' -Force

# 改 AndroidManifest.xml：加权限 + 组件
$manifest = 'android\app\src\main\AndroidManifest.xml'
if (Test-Path $manifest) {
  $m = Get-Content -Raw $manifest
  $perms = @(
    '<uses-permission android:name="android.permission.WAKE_LOCK"/>',
    '<uses-permission android:name="android.permission.VIBRATE"/>',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
    '<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>',
    '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>'
  ) -join "`n`n"
  if ($m -notmatch 'AlarmReceiver') {
    $m = $m -replace '(<application)', "`n`n$perms`n`n`$1"
    $comps = @(
      '<receiver android:name=".AlarmReceiver" android:exported="false"/>',
      '<activity android:name=".AlarmActivity" android:showWhenLocked="true" android:turnScreenOn="true" android:launchMode="singleTask" android:excludeFromRecents="true"/>'
    ) -join "`n"
    if ($m -match '</application>') {
      $m = $m -replace '(</application>)', "$comps`n`n`$1"
    }
    Set-Content -Path $manifest -Value $m -Encoding UTF8
  }
}

# 直接写入含插件注册的 MainActivity（默认工程没有 onCreate，需整个替换）
$main = 'android\app\src\main\java\com\schedule\b\MainActivity.java'
$mainContent = @'
package com.schedule.b;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AlarmPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
'@
Set-Content -Path $main -Value $mainContent -Encoding UTF8

Write-Host "==> 5/5 同步 ..."
node node_modules/@capacitor/cli/bin/capacitor sync android
if ($LASTEXITCODE -ne 0) { throw "cap sync android 失败，exit=$LASTEXITCODE" }

Write-Host ""
Write-Host "完成！用 Android Studio 打开 $PSScriptRoot\android 并 Build APK。"
Write-Host "到点会弹出全屏闹钟（锁屏/前台其它 App 上也能显示），点「知道了」关闭。"
Write-Host "注意：需在手机设置里授予「显示在其他应用上层/悬浮窗」权限，并允许通知。"
