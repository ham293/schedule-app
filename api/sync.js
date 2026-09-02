/** 前端把当前日程列表同步到后端，供定时任务判断何时推送 */
const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    const incoming = req.body;
    if (!Array.isArray(incoming)) {
      return lib.json(res, 400, { ok: false, error: 'expected array' });
    }
    const prev = await lib.getJSON('schedules', []);
    const prevMap = new Map(prev.map(s => [s.id, s]));

    const merged = incoming.map(it => {
      const ts = new Date(it.date + 'T' + it.time).getTime();
      const p = prevMap.get(it.id);
      // 仍是同一条且时间没变、且已提醒过，则保留已提醒状态，避免重复推送
      const notified = !!(p && p.ts === ts && p.notified);
      return {
        id: it.id,
        title: it.title,
        date: it.date,
        time: it.time,
        end: it.end || null,
        location: it.location || '',
        allDay: !!it.allDay,
        remind: it.remind || 0,
        ts,
        notified,
        notifiedAt: notified ? p.notifiedAt : null,
        done: !!it.done,
      };
    });

    await lib.setJSON('schedules', merged);
    lib.json(res, 200, { ok: true, count: merged.length });
  } catch (e) {
    lib.json(res, 500, { ok: false, error: String(e && (e.message || e)) });
  }
};
