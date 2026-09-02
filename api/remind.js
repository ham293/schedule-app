/**
 * 定时任务（vercel.json cron 每分钟触发）：
 * 遍历已同步的日程，凡进入「提前 remind 分钟」提醒窗口的，向所有订阅推送一条通知，并标记已提醒。
 */
const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    const subs = await lib.getJSON('subs', []);
    const schedules = await lib.getJSON('schedules', []);
    if (!subs.length || !schedules.length) {
      return lib.json(res, 200, { ok: true, sent: 0 });
    }

    const now = Date.now();
    let changed = false;
    let sent = 0;
    const deadEndpoints = [];

    for (const s of schedules) {
      if (s.done || s.notified || !(s.remind > 0)) continue;
      const target = s.ts - s.remind * 60000;
      if (now >= target && now < s.ts) {
        const payload = JSON.stringify({
          title: '⏰ 日程提醒：马上开始',
          body: `${s.title}${s.location ? '（' + s.location + '）' : ''} · ${s.date} ${s.time}`,
          tag: 'remind-' + s.id,
          url: './index.html',
        });
        let ok = false;
        for (const sub of subs) {
          try {
            await lib.webpush.sendNotification(sub, payload);
            sent++;
            ok = true;
          } catch (e) {
            const code = e.statusCode;
            if (code === 404 || code === 410) deadEndpoints.push(sub.endpoint);
          }
        }
        // 仅当至少成功推送一条才标记已提醒；窗口期内（约30分钟）未成功会由 cron 每分钟重试
        if (ok) { s.notified = true; s.notifiedAt = now; changed = true; }
      }
    }

    if (deadEndpoints.length) await lib.pruneSubs(subs, deadEndpoints);
    if (changed) await lib.setJSON('schedules', schedules);

    lib.json(res, 200, { ok: true, sent, pruned: deadEndpoints.length });
  } catch (e) {
    lib.json(res, 500, { ok: false, error: String(e && (e.message || e)) });
  }
};
