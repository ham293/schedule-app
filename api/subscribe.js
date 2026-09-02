/** 保存/更新浏览器的推送订阅 */
const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) {
      return lib.json(res, 400, { ok: false, error: 'invalid subscription' });
    }
    const subs = await lib.getJSON('subs', []);
    const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
    if (idx >= 0) subs[idx] = sub;
    else subs.push(sub);
    await lib.setJSON('subs', subs);
    lib.json(res, 200, { ok: true, count: subs.length });
  } catch (e) {
    lib.json(res, 500, { ok: false, error: String(e && (e.message || e)) });
  }
};
