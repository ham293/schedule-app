# 日程管家 B方案：把原生全屏闹钟插件注入已生成的安卓工程。
# 前提：已执行 npx @capacitor/cli add android（android/ 已存在）。
# 作用：复制插件 Java、铃声/图标、改 AndroidManifest、写 MainActivity。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $PSScriptRoot

# 1) 复制插件 Java 到工程包目录
$pkgDir = 'android\app\src\main\java\com\schedule\b'
New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null
Copy-Item 'native\AlarmPlugin.java','native\AlarmReceiver.java','native\AlarmActivity.java' -Destination $pkgDir -Force

# 2) 铃声 + 图标
New-Item -ItemType Directory -Force -Path 'android\app\src\main\res\raw' | Out-Null
Copy-Item "$root\apk\res-raw\schedule_alarm.wav" -Destination 'android\app\src\main\res\raw\schedule_alarm.wav' -Force
New-Item -ItemType Directory -Force -Path 'android\app\src\main\res\drawable' | Out-Null
Copy-Item "$root\apk\res-drawable\ic_stat_icon.xml" -Destination 'android\app\src\main\res\drawable\ic_stat_icon.xml' -Force

# 3) AndroidManifest：加权限 + 组件
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
    [System.IO.File]::WriteAllText($manifest, $m, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "  已写入 AndroidManifest 权限与组件"
  } else {
    Write-Host "  AndroidManifest 已含组件，跳过"
  }
}

# 4) 覆盖 MainActivity（含 registerPlugin）
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
[System.IO.File]::WriteAllText($main, $mainContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "  已写入 MainActivity（注册 AlarmPlugin）"
Write-Host "  B方案插件注入完成。"
