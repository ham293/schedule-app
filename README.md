# 日程管家（移动端 PWA + 真·推送提醒）

一个可在手机上使用的日程整理工具：根据输入的日程**自动生成表格**，并在开始前**提前 30 分钟弹出提醒**。开启推送后，**即使关闭页面/App，也能收到提醒**。

- 移动端优先、清爽界面，也可在电脑上使用
- 日程保存在手机浏览器本地（localStorage），无需账号
- PWA「添加到主屏幕」，可像原生 App 一样使用
- 后端：Vercel Serverless + 每分钟定时任务 + Web Push，仅依赖 `web-push`

---

## 功能

1. **一键录入（自然语言）**：如 `明天下午3点 开会`、`周五晚上8点 聚餐`、`下周一上午9点 部门例会`、`X月X号`、`X点半` 等自动识别日期与时间。
2. **手动填写**：日期、开始时间、备注、提前提醒（30 / 10 / 60 分钟 / 不提醒）。
3. **自动生成表格**：列表视图按日期分组、显示倒计时与状态；表格视图自动生成「日期/时间/事项/提醒/状态」五行表格，今日高亮。
4. **提前 30 分钟推送提醒**：可标记完成、编辑、删除。

---

## 提醒的两种模式

| 模式 | 原理 | 效果 |
| --- | --- | --- |
| **本地提醒**（默认，零配置） | 页面打开时每 20 秒检查一次，到点用浏览器通知 | 页面开着时能提醒 |
| **推送提醒**（推荐，需部署 + 授权） | 浏览器订阅 Web Push → 日程同步到后端 → Vercel 每分钟定时任务在进入提醒窗口时向下推送 | **页面/App 关闭也能收到** |

> 手机浏览器通知需要 **HTTPS 或 localhost**。直接用局域网 IP（`http://192.168.x.x`）访问时，浏览器会禁用通知。因此手机端推荐用下方方式 A 部署。

---

## 桌面预览（电脑，零配置）

在 `schedule-app` 目录运行：

```bash
npm run dev        # 等价于 node server-local.js
```

浏览器打开 `http://localhost:8099`（本地通知可开启，推送需真实订阅与推送服务）。

> 也可用任意静态服务器：`npx serve .` 或 `python -m http.server 8099`。

---

## 部署到 Vercel（推荐，打开 App 关闭也能收提醒）

### 1) 一键部署到 Vercel

**方式一（CLI，最省事）**
```bash
# 进入项目目录
cd schedule-app

# 首次会提示登录 Vercel 账号（浏览器打开完成授权）
npx vercel

# 生产部署（正式域名）
npx vercel --prod
```

**方式二（网页导入）**
登录 [vercel.com](https://vercel.com) → New Project → 把整个 `schedule-app` 文件夹上传或从 Git 仓库导入（保持 `manifest.webmanifest`、`sw.js`、`vercel.json` 在根目录）。

部署完成后会得到一个 `https://你的项目.vercel.app` 地址。

### 2) 配置 Vercel KV（持久化，必需）

Serverless 函数是无状态的，必须用 KV 来存订阅与日程，否则定时任务无法跨调用读取数据：

1. 进入 Vercel 项目 → **Storage** → **Create Database** → 选 **Vercel KV**（Upstash Redis）→ 创建并 **Connect** 到本项目。
2. Connect 后 Vercel 会自动注入 `KV_REST_API_URL` 与 `KV_REST_API_TOKEN`，后端即会自动读写 KV，无需改代码。

### 3) 可选：VAPID 密钥

代码已内置一套可用密钥（开箱即用）。要换成自己的，在项目 **Settings → Environment Variables** 添加：
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`（如 `mailto:you@example.com`）

生成密钥：`npm run gen:vapid` 或使用任意 VAPID 生成工具。

### 4) 手机开启推送

1. 手机浏览器打开 `https://你的项目.vercel.app`
2. 地址栏 → **添加到主屏幕 / 安装应用**
3. 首次添加日程时允许「通知」权限（界面右上角铃铛可查看/开启权限）
4. App 会自动订阅推送并把日程同步给后端
5. 之后**关闭 App / 锁屏也能收到提前 30 分钟的推送提醒**

> 说明：日程在「添加/修改时」同步到后端，因此请保持网络可用；届时由 Vercel cron 每分钟检查并推送。

---

## 目录结构

```
schedule-app/
├─ index.html               # 主界面
├─ manifest.webmanifest     # PWA 清单
├─ sw.js                    # Service Worker（离线缓存 + 推送通知 + 通知点击）
├─ vercel.json              # Vercel 定时任务配置（每分钟触发 /api/remind）
├─ package.json             # 依赖（web-push）与脚本
├─ css/style.css            # 样式（移动端优先）
├─ js/
│  ├─ nlparse.js            # 中文自然语言时间解析
│  └─ app.js                # 应用逻辑 + 推送订阅/日程同步
├─ api/                     # Vercel Serverless 函数
│  ├─ _lib.js               # 共享库（Web Push + KV 存取 + 响应工具）
│  ├─ vapid-public.js       # 返回 VAPID 公钥
│  ├─ subscribe.js          # 保存浏览器推送订阅
│  ├─ sync.js               # 前端同步日程到后端
│  └─ remind.js             # 定时任务：进入提醒窗口则推送
├─ server-local.js          # 本地开发服务器（内存存储）
├─ test-remind.js           # 定时提醒逻辑自测（不真正联网）
└─ icons/                   # 应用图标（含 make_icons.py）
```

### 本地脚本
```bash
npm run dev          # 本地服务器 http://localhost:8099
npm run gen:vapid    # 生成一组 VAPID 密钥
node test-remind.js  # 跑后端提醒逻辑自测
```

---

## 自定义

- 改提醒默认值：`index.html` 中 `#fRemind` 的 `value="30"`。
- 改主题色：`css/style.css` 中 `:root` 的 `--brand` / `--brand-2`。
- 重新生成图标：`cd icons && python make_icons.py`。
