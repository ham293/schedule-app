# 用 GitHub Actions 云端编译 APK（不用装 Android Studio / 不用谷歌源）

适合：**人在国内、谷歌下载源被墙、不想装 2GB Android Studio** 的你。

> 原理：GitHub 的编译服务器自带 **Android SDK + JDK**。你只需把项目推到 GitHub，它在云端自动编译出 `.apk`，你下载后发给朋友即可。全程**不碰谷歌下载源**。

---

## 第 1 步：注册 GitHub（免费）
打开 [github.com](https://github.com)（国内一般可访问）→ 注册账号。

## 第 2 步：新建仓库并上传这个项目文件夹
1. GitHub 右上角 **+ → New repository** → 名称随意（如 `schedule-app`）→ **Create**（选 Public 即可）。
2. 进入仓库 → **Add file → Upload files** → 把 `D:\ds haness\schedule-app` 里的内容**拖进来上传**（会提示一些大文件被 `.gitignore` 忽略，正常）：
   - 必须上传：`index.html`、`manifest.webmanifest`、`sw.js`、`css/`、`js/`、`icons/`、`api/`、`apk/`、`.github/workflows/build-apk.yml`、`.gitignore`。
   - **不要**传：`node_modules`、`apk/android`、`.vercel`（已被 `.gitignore` 忽略）。
3. 点 **Commit changes**。

## 第 3 步：触发云端编译
1. 仓库顶部标签 **Actions**。
2. 左侧 **Build APK** → 右侧 **Run workflow** → **Run workflow**。
3. 等约 3–5 分钟（第一次会久些），点进这个 run 看绿色 ✔。

## 第 4 步：下载 APK
- 该 run 页面最下方 **Artifacts → schedule-app-apk** → 下载（得到一个 `.zip`，里面是 `app-debug.apk`）。
- 解压出来就是 `app-debug.apk`。

## 第 5 步：发给朋友（安卓）
把 `app-debug.apk` 用微信/QQ发给朋友 → 点击安装 → 允许「未知来源/外部来源」→ 桌面出现「日程管家」图标。

## 朋友使用
- 打开就有全部功能（批量解析通知、自动生成表格、声音+震动提醒）。
- **App 关闭也能到点提醒**：用的是**原生本地通知**，不需要服务器、不需要网络、不限地区。

---

## 如果以后改了网页版怎么重新编译
在项目里改了 `index.html` / `js` / `css` 后，重新把 `index.html`、`js/`、`css/`、`icons/`、`manifest.webmanifest`、`sw.js` 更新到 GitHub 仓库（上传覆盖），再去 **Actions → Run workflow** 重新编译，下载新的 APK。

---

## 备选：国内镜像装 Android Studio（本地编译）
如果你更愿意本地编译，可用**国内镜像**装 Android Studio（官网被墙）：
- 搜索「Android Studio 下载 国内镜像」，或用 **阿里云/腾讯云** 提供的 **Android SDK 镜像**（配置 `sdkmanager` 走镜像）。
- 装好后按 `APK打包指南.md` 走：打开 `apk\android` → Build → Build APK(s)。
  （本地版我现在已生成了完整的 `apk\android` 工程。）

> 提示：GitHub Actions 那条路**更省事**（不用装安卓环境、不碰谷歌），推荐用那个。
