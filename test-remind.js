/**
 * 后端定时提醒逻辑自测（不打真实推送服务）。
 * 运行：node test-remind.js
 */
const lib = require('./api/_lib');

function pad(n) { return String(n).padStart(2, '0'); }
function dstr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function tstr(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

(async () => {
  // 先在内存里种入订阅与日程
  const subs = [{ endpoint: 'https://push.example/a', keys: { p256dh: 'x', auth: 'y' } }];
  const now = Date.now();
  const align = (t) => new Date(Math.floor(t / 60000) * 60000); // 对齐到分钟（与客户端 HH:MM 一致）
  const due = align(now + 20 * 60000);         // 20 分钟后开始（remind 30 已进入窗口）
  const later = align(now + 3 * 3600 * 1000);  // 3 小时后，未到窗口
  const past = align(now - 60 * 60000);         // 已开始

  const schedules = [
    { id: 'a', title: '开会', date: dstr(due), time: tstr(due), remind: 30, ts: due.getTime(), notified: false, done: false },
    { id: 'b', title: '太早', date: dstr(later), time: tstr(later), remind: 30, ts: later.getTime(), notified: false, done: false },
    { id: 'c', title: '已提醒', date: dstr(due), time: tstr(due), remind: 30, ts: due.getTime(), notified: true, done: false },
    { id: 'd', title: '已完成', date: dstr(due), time: tstr(due), remind: 30, ts: due.getTime(), notified: false, done: true },
    { id: 'e', title: '不提醒', date: dstr(due), time: tstr(due), remind: 0, ts: due.getTime(), notified: false, done: false },
  ];

  await lib.setJSON('subs', subs);
  await lib.setJSON('schedules', schedules);

  // 打桩：不真正联网，只记录
  const sent = [];
  lib.webpush.sendNotification = async (sub, payload) => { sent.push(payload); };

  const remind = require('./api/remind');
  let status = 0;
  const fakeRes = { writeHead(c) { status = c; }, end(b) { this.body = JSON.parse(b); } };
  await remind({}, fakeRes);

  const result = fakeRes.body;
  const after = await lib.getJSON('schedules', []);
  const byId = Object.fromEntries(after.map(s => [s.id, s]));

  const checks = [
    [result.sent === 1, `只应推送 1 条，实际 ${result.sent}`],
    [byId.a.notified === true, 'a 应被标记已提醒'],
    [byId.b.notified === false, 'b（未到窗口）不应标记'],
    [byId.c.notified === true, 'c（已提醒过）保持已提醒，不重复推'],
    [byId.d.notified === false, 'd（已完成）不应标记'],
    [byId.e.notified === false, 'e（不提醒）不应标记'],
    [sent.length === 1, `发送 payload 数应为 1，实际 ${sent.length}`],
  ];

  let ok = true;
  for (const [pass, msg] of checks) {
    console.log((pass ? 'PASS ' : 'FAIL ') + msg);
    if (!pass) ok = false;
  }

  // 模拟“已提醒过的日程在下次 sync 时保持 notified”
  const sync = require('./api/sync');
  const fakeRes2 = { writeHead() {}, end(b) { this.body = JSON.parse(b); } };
  const updated = after.map(s => ({ id: s.id, title: s.title, date: s.date, time: s.time, remind: s.remind, done: s.done }));
  await sync({ body: updated }, fakeRes2);
  const afterSync = await lib.getJSON('schedules', []);
  const a2 = afterSync.find(s => s.id === 'a');
  console.log((a2 && a2.notified === true ? 'PASS ' : 'FAIL ') + 'sync 后 a 仍保持已提醒（不重复推）');

  console.log(ok ? '\n===== 全部通过 =====' : '\n===== 存在失败 =====');
  process.exit(ok ? 0 : 1);
})();
