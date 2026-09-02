# 日程管家 · APK 打包指南（发给安卓朋友）

给朋友一个**能直接安装、不依赖任何域名/服务器**的安卓 App（离线也能用，App 关闭也能到点提醒）。

> 说明：**安卓工程已经帮你生成好了**（位于 `apk\android`），你只需在自己电脑装一次 **Android Studio** 编译出 `.apk` 即可。

---

## 0) 前提
- 电脑装 **Node.js**（已有）
- 电脑装 **Android Studio**（含 Android SDK + JDK）：https://developer.android.com/studio

## 1) 用 Android Studio 打开工程
1. 打开 Android Studio → **Open** → 选择目录：`D:\ds haness\schedule-app\apk\android`
2. 等右下角 **Gradle 同步**完成（第一次会自动下载 Gradle/依赖，**较慢，耐心等**）。

## 2) 生成 APK（二选一）

**方法一（图形界面，推荐）**
菜单 **Build → Build APK(s)** → 完成后点通知里的 **locate** 找到文件。

**方法二（命令行）**
在终端：
```
cd "D:\ds haness\schedule-app\apk\android"
gradlew.bat assembleDebug
```

生成的文件位置：
```
D:\ds haness\schedule-app\apk\android\app\build\outputs\apk\debug\app-debug.apk
```

## 3) 发给朋友（安卓）
把 `app-debug.apk` 通过微信/QQ/网盘发给朋友 → 朋友点击安装：
- 首次会提示「**未知来源/外部来源**」，允许 → 安装 → 桌面出现 **日程管家** 图标。

## 4) 朋友使用
- 打开 App → 粘贴通知/手动添加日程 → 自动生成表格。
- 添加后 App 会**自动安排原生本地通知**：到点（提前 30 分钟）弹出提醒（**含声音+震动**），**App 关闭也能收到**。
- 无需任何服务器、无需网络、不受域名/地区限制。

---

## 5) 以后改了网页版怎么重新打 APK
重新把最新网页资源同步进安卓工程，再重新 Build：
```
cd "D:\ds haness\schedule-app\apk"
powershell -ExecutionPolicy Bypass -File build.ps1
```
（build.ps1 会重新复制网页资源 → 同步 → 更新安卓工程；然后在 Android Studio 里重新 Build APK）

> 也可以只同步：`cd apk && npx cap sync android`，再回 Android Studio 重新 Build。

---

## 目录说明
```
apk/
├─ package.json          # Capacitor 依赖
├─ capacitor.config.json # 应用名/appId/webDir 配置
├─ build.ps1             # 一键：复制资源+添加平台+同步
├─ www/                  # 复制的网页资源（自动生成）
└─ android/              # 【已生成】安卓工程，用 Android Studio 打开
```

> 注意：`apk/`（含 node_modules、android）是**本地打包用的工作区**，**不要**上传到 Vercel（已在 `.vercelignore` 排除），也**不要**放进发给朋友的发布包 zip 里（体积大）。
