# 日程管家 · B方案（原生全屏闹钟）

> **与 A 方案分开的一套**。A 方案（`apk/`，LocalNotifications 锁屏+横幅提醒）保持可用；B 方案用**原生全屏闹钟插件**，尝试在「锁屏」和「前台正在用其它 App」时都能弹出全屏闹钟并一直响。
> 网页逻辑已做成：**B 包有 Alarm 插件就用它；A 包没有就自动退回 LocalNotifications**，两边互不影响。

---

## 它做什么
- 到点（提前 X 分钟）→ 触发 **AlarmManager** → 弹**全屏闹钟界面**（⏰ 标题 + 时间地点 + 一直响闹钟铃声 + 震动），锁屏/前台其它 App 上方也能显示。
- 点「知道了」关闭。

## 权限（B 方案需要，务必授予）
1. 通知权限（允许通知 + 悬浮横幅）。
2. **显示在其他应用上层 / 悬浮窗**（设置 → 应用 → 日程管家 → 权限 → 悬浮窗）。

---

## 如何打包 B 方案 APK

**方式一：本地 Android Studio**
```
cd "D:\ds haness\schedule-app\apk-b"
powershell -ExecutionPolicy Bypass -File build.ps1
```
然后 Android Studio 打开 `apk-b\android` → Build → Build APK(s) → 得到 `app-debug.apk`。

**方式二：GitHub Actions 云端**（可选，需要把改动的项目推到 GitHub 并加对应的 workflow）。当前只配了 A 方案（`apk/`）的云端编译；B 方案建议**本地编译**调试更直接。

---

## ⚠️ 风险与预期（务必先看）
1. **我没有安卓真机，无法编译/验证这套原生代码**，大概率首次编译会有几个小错（如 gradle、API 版本等），需要你在 Android Studio 里跑一次看报错、发我，我逐个修。
2. **华为对第三方 App 的「全屏闹钟」可能仍然限制**（很多机型默认只允许系统闹钟用全屏/悬浮）。B 方案**不一定**能在你的华为上突破前台压制，要做好心理准备。
3. 这是**实验性**代码，别指望一次就成。

---

## 测试要点
1. 加一条 1 分钟后开始的日程（提前 1 分钟提醒）。
2. 锁屏测试：到点应弹**全屏闹钟**并响铃。
3. **开另一个 App**（如微信/抖音）前台使用：到点看是否弹全屏闹钟。
4. 把结果（弹/不弹、报错）告诉我，我据此修。

---

## 文件
```
apk-b/
├─ package.json           # Capacitor 依赖（无 local-notifications，用自定义 Alarm 插件）
├─ capacitor.config.json  # appId com.schedule.b, webDir www
├─ build.ps1              # 复制网页+加平台+注入原生插件+同步
├─ native/
│  ├─ AlarmPlugin.java    # 调度 AlarmManager
│  ├─ AlarmReceiver.java  # 到点发全屏意图通知
│  ├─ AlarmActivity.java  # 全屏闹钟界面（响铃+震动）
│  ├─ manifest-additions.txt  # 要加进 AndroidManifest 的权限与组件
│  └─ MainActivity-patch.txt  # MainActivity 里注册插件的写法
└─ www/                   # 网页资源（build.ps1 自动生成）
```
