/**
 * 中文日程自然语言解析
 * 支持：今天/明天/后天/昨天/周X/星期X/下周五/12月31日/3月5号
 * 时间：上午/下午/中午/晚上/凌晨 + X点 / X点半 / X点Y分 / X:Y
 *
 * 返回：{ dateStr, timeStr, title, error }
 *  dateStr  = 'YYYY-MM-DD'
 *  timeStr  = 'HH:MM'  或 null（未识别到时间）
 *  title    = 去掉日期时间关键词后的事项文字
 */
(function () {
  const WD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0, 七: 7 };

  // base: 未写数字时的默认小时；offset: 给了数字小时时需要加的小时数
  const PERIODS = [
    { kw: ['凌晨', '清晨'], base: 6, offset: 0 },
    { kw: ['上午', '早上', '早晨'], base: 9, offset: 0 },
    { kw: ['中午'], base: 12, offset: 12 },
    { kw: ['下午', '傍晚'], base: 15, offset: 12 },
    { kw: ['晚上', '夜里', '夜晚'], base: 20, offset: 12 },
  ];

  const CN_NUM = '零〇一二两三四五六七八九十';

  function cnNum(s) {
    const d = { 零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 两: 2, 贰: 2, 三: 3, 叁: 3, 四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陆: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9, 十: 10 };
    if (!s) return 0;
    if (s.length === 1) return d[s] || 0;
    const i = s.indexOf('十');
    if (i < 0) { let t = 0; for (const c of s) t += d[c] || 0; return t; }
    const tens = (i > 0 ? (d[s[i - 1]] || 1) : 1) * 10;
    const ones = i + 1 < s.length ? (d[s[i + 1]] || 0) : 0;
    return tens + ones;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateStr(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function findPeriod(text) {
    for (const p of PERIODS) {
      for (const kw of p.kw) {
        const idx = text.indexOf(kw);
        if (idx >= 0) return { kw, period: p, index: idx };
      }
    }
    return null;
  }

  function findHour(text) {
    // 优先带分钟的形式（兼容半角 : 和全角 ：）
    let m = /(\d{1,2})\s*[:：点时]\s*(\d{1,2})\s*分?/.exec(text);
    if (m) {
      let h = parseInt(m[1], 10);
      let min = parseInt(m[2], 10);
      const start = m.index, end = m.index + m[0].length;
      // 小时本身位置：若小时>12 可能是 24h 制（如 15:00）
      return { hour: h, minute: min, start, end, span: m[0], hourNumIdx: m.index + (m[0].indexOf(m[1])) };
    }
    m = /(\d{1,2})\s*点半/.exec(text);
    if (m) {
      return { hour: parseInt(m[1], 10), minute: 30, start: m.index, end: m.index + m[0].length, span: m[0], hourNumIdx: m.index };
    }
    m = /(\d{1,2})\s*[点时]/.exec(text);
    if (m) {
      const h = parseInt(m[1], 10);
      return { hour: h, minute: 0, start: m.index, end: m.index + m[0].length, span: m[0], hourNumIdx: m.index + (m[0].indexOf(m[1])) };
    }
    // 纯 24h "15:00" 已在前面覆盖；单独的冒号形式
    m = /([01]\d|2[0-3]):([0-5]\d)/.exec(text);
    if (m) {
      return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10), start: m.index, end: m.index + m[0].length, span: m[0], hourNumIdx: m.index };
    }
    return null;
  }

  function resolveDate(text, now) {
    now = now || new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayW = base.getDay(); // 0=周日

    // 相对词（优先）
    const rel = text.match(/大后天|后天|明天|今天|今晚|昨日|昨天/);
    if (rel) {
      const w = rel[0];
      const off = w === '大后天' ? 3 : w === '后天' ? 2 : w === '明天' ? 1 : w === '昨天' || w === '昨日' ? -1 : 0;
      const d = new Date(base); d.setDate(d.getDate() + off);
      return { dateStr: toDateStr(d), span: rel[0], spanOff: rel.index, off };
    }

    // "下周X" / "下个星期X"
    let m = text.match(/下(?:周|个星期|礼拜)([一二三四五六日天])/);
    if (m) {
      const target = WD[m[1]];
      if (target !== undefined) {
        let add = (target - todayW + 7) % 7; if (add === 0) add = 7;
        const d = new Date(base); d.setDate(d.getDate() + add);
        return { dateStr: toDateStr(d), span: m[0], spanOff: m.index };
      }
    }

    // "周X / 星期X / 礼拜X"（本周或未来最近一个）
    m = text.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      const target = WD[m[1]];
      if (target !== undefined) {
        let add = (target - todayW + 7) % 7; if (add === 0) add = 0; // 今天即今天
        const d = new Date(base); d.setDate(d.getDate() + add);
        return { dateStr: toDateStr(d), span: m[0], spanOff: m.index };
      }
    }

    // "12月31日" / "3月5号" / "12.31"
    m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
    if (m) {
      let mm = parseInt(m[1], 10), dd = parseInt(m[2], 10);
      let d = new Date(base.getFullYear(), mm - 1, dd);
      // 已过则视为明年
      if (d < base) d = new Date(base.getFullYear() + 1, mm - 1, dd);
      return { dateStr: toDateStr(d), span: m[0], spanOff: m.index };
    }

    return null;
  }

  function resolveTime(text, now) {
    // 若文本含 "全天/整天/一整天" -> 全天空
    if (/全天|整天|一整天/.test(text)) {
      return { timeStr: '09:00', allDay: true, span: null };
    }
    const period = findPeriod(text);
    const hour = findHour(text);

    let h, min = 0;
    if (hour) {
      h = hour.hour; min = hour.minute;
      // 24h 制（如 15:00）不调整
      const is24h = hour.span.indexOf(':') >= 0 && h >= 13;
      if (!is24h && period) {
        // 明确写了上午/下午/晚上等，对数字小时做偏移
        if (h < 12) h = h + period.period.offset;
      }
      // 无时段词的纯数字（如 9点 / 15:00）按 24h 理解
    } else if (period) {
      h = period.period.base; // 只写了「上午」「晚上」等，用默认小时
    } else {
      return { timeStr: null, allDay: false, span: null };
    }
    if (h >= 24) h = h % 24;
    const periodKw = period ? period.kw : null;
    return {
      timeStr: pad(h) + ':' + pad(min),
      allDay: false,
      periodKw,
      hourSpan: hour ? hour.span : null,
      hourStart: hour ? hour.start : -1,
      hourEnd: hour ? hour.end : -1,
    };
  }

  function parseQuick(raw, now) {
    if (!raw || !raw.trim()) return { error: '请输入日程内容' };
    let text = raw.trim();
    // 去掉首尾的介词
    text = text.replace(/^[，,是为要的]+/, '').trim();
    const titleCand = text;

    const dateInfo = resolveDate(text, now);
    const timeInfo = resolveTime(text, now);

    if (!dateInfo && !timeInfo) return { error: '没识别到时间，请试试「明天下午3点 开会」' };

    const dateStr = dateInfo ? dateInfo.dateStr : toDateStr(now);
    const timeStr = timeInfo && timeInfo.timeStr;

    // 提取标题：去掉已匹配的日期/时间关键词
    let t = text;
    const spans = [];
    if (dateInfo && dateInfo.span) spans.push([dateInfo.spanOff, dateInfo.spanOff + dateInfo.span.length]);
    if (timeInfo && timeInfo.periodKw) { const idx = text.indexOf(timeInfo.periodKw); if (idx >= 0) spans.push([idx, idx + timeInfo.periodKw.length]); }
    if (timeInfo && timeInfo.hourSpan) spans.push([timeInfo.hourStart, timeInfo.hourEnd]);
    spans.sort((a, b) => a[0] - b[0]);
    // 用分隔符切片
    let out = '';
    let last = 0;
    // 先标记每个字符是否删除
    const del = new Array(t.length).fill(false);
    for (const [s, e] of spans) for (let i = s; i < e; i++) del[i] = true;
    for (let i = 0; i < t.length; i++) if (!del[i]) out += t[i];
    out = out.replace(/[。，,、\s]+/g, ' ').trim();
    if (!out) out = titleCand.replace(/[。，,、\s]+/g, ' ').trim() || '日程';

    return {
      dateStr,
      timeStr: timeStr || '09:00',
      allDay: timeInfo && timeInfo.allDay ? true : false,
      title: out,
    };
  }

  // ---------- 批量解析（群通知 / 多天日程表 / 自由文本）----------
  // 例1：❗️9.3日程\n1.专业介绍会 时间：9:00-11:00 地点：教3-210\n2.入党启蒙 时间：14:00-15:20 地点：大讲堂中心报告厅\n@所有人
  // 例2（多天）：9.3日程\n…\n9.4日程\n…（自动按日期头分成对应日期）
  // 例3（无「时间：」）：专业介绍会 9:00-11:00 教3-210

  function makeDateStr(year, month, day, now) {
    let d = new Date(year, month - 1, day);
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d < t0) d = new Date(year + 1, month - 1, day); // 已过则顺延
    return toDateStr(d);
  }

  // 一行里提取「日期头」（9.3 / 9月4日 / 2025.9.3）；含「时间：」的事件行不当作日期行
  function lineDate(line, now) {
    if (/时间\s*[:：]/.test(line)) return null;
    let m = line.match(/(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/);
    if (m) { const y = +m[1], mo = +m[2], d = +m[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return toDateStr(new Date(y, mo - 1, d)); } // 明确年份，不自动顺延
    m = line.match(/(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*[日号]?(?=\s|日程|安排|通知|$|[!！])/);
    if (m) { const mo = +m[1], d = +m[2]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return makeDateStr(now.getFullYear(), mo, d, now); } // 无年份，用今年/明年
    return null;
  }

  // 解析单个时间片段：上午9点 / 下午2点半 / 9:30 / 15:20 / 九点 / 两点半 / 十点半
  function parseTimeToken(token, inheritPeriod) {
    token = (token || '').trim();
    const pd = findPeriod(token);
    const period = (pd && pd.period) || inheritPeriod || null;
    let h = null, m = 0, hasNum = false;
    let mt = token.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
    if (mt) { h = +mt[1]; m = +mt[2]; hasNum = true; }
    else if ((mt = token.match(/(\d{1,2})\s*点半/))) { h = +mt[1]; m = 30; hasNum = true; }
    else if ((mt = token.match(/(\d{1,2})\s*[点时]/))) { h = +mt[1]; m = 0; hasNum = true; }
    else if ((mt = token.match(new RegExp('([' + CN_NUM + ']+)\\s*点半')))) { h = cnNum(mt[1]); m = 30; hasNum = true; }
    else if ((mt = token.match(new RegExp('([' + CN_NUM + ']+)\\s*点')))) { h = cnNum(mt[1]); m = 0; hasNum = true; }
    if (h === null) { if (period) { h = period.base; } else return null; }
    const is24h = token.indexOf(':') >= 0 && h >= 13;
    if (!is24h && period && hasNum && h < 12) h = h + period.offset;
    if (h >= 24) h = h % 24;
    return { hour: h, minute: m };
  }

  // 解析时间段，返回 {start, end, allDay}；支持「起-止」「X点半」「X点」「全天/整天」
  function parseTimeRange(ts) {
    ts = (ts || '').trim();
    if (/全天|整天|一整天/.test(ts)) return { start: '09:00', end: null, allDay: true };
    const parts = ts.split(/[-~～至到]/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return null;
    const start = parseTimeToken(parts[0]);
    if (!start) return null;
    let end = null;
    if (parts.length > 1) {
      const inherit = (findPeriod(parts[0]) || {}).period || null;
      const e = parseTimeToken(parts[parts.length - 1], inherit);
      if (e) end = pad(e.hour) + ':' + pad(e.minute);
    }
    return { start: pad(start.hour) + ':' + pad(start.minute), end, allDay: false };
  }

  function cleanTitle(s) {
    return (s || '').replace(/^[\s❗❗️⚠️📢📌📍#@\-—・·.、，,]+/, '').trim();
  }

  // 没有「时间：」关键字、但行内含时钟时间的自由文本
  function parseFreeLine(line, currentDate, now) {
    // 先去编号前缀：1. / 1、 / 1) / （1） 等（若以时间开头如 11:00，则不去掉）
    if (!/^\s*\d{1,2}\s*[:：半点]/.test(line)) {
      const num = line.match(/^\s*[（(]?\d+[)）]?\s*[.、．)）]?\s*/);
      if (num) line = line.slice(num[0].length);
    }
    const hourRe = '(?:\\d{1,2}|[' + CN_NUM + ']+)';
    const m = line.match(new RegExp('(上午|下午|中午|晚上|傍晚|凌晨|早上|早晨|夜里|夜晚)?\\s*' + hourRe + '\\s*[:：点半时]\\s*\\d{0,2}\\s*半?\\s*(?:[-~～至到]\\s*(?:上午|下午|中午|晚上|傍晚|凌晨|早上|早晨|夜里|夜晚)?\\s*' + hourRe + '\\s*[:：点半时]\\s*\\d{0,2}\\s*半?)?'));
    if (!m || !m[0]) return null;
    const tr = parseTimeRange(m[0]);
    if (!tr) return null;
    let title = cleanTitle(line.slice(0, m.index));
    let after = line.slice(m.index + m[0].length).replace(/^[\s，,、]+/, '').replace(/[。，,、\s]+$/g, '').trim();
    let location = after;
    if (!title) { title = cleanupLocation(after); location = ''; }
    if (!title) title = '日程';
    return { title, date: currentDate || toDateStr(now), time: tr.start, end: tr.end || null, location, allDay: !!tr.allDay, remind: tr.allDay ? 0 : 30 };
  }

  function cleanupLocation(s) { return (s || '').replace(/[。，,、\s]+$/g, '').trim(); }

  // 结构化行：含「时间：」
  function parseEventLine(body, currentDate, now) {
    if (!/^\s*\d{1,2}\s*[:：半点]/.test(body)) {
      const num = body.match(/^\s*[（(]?\d+[)）]?\s*[.、．)）]?\s*/);
      if (num) body = body.slice(num[0].length);
    }
    const tIdx = body.search(/时间\s*[:：]/);
    if (tIdx < 0) return null;
    let title = cleanTitle(body.slice(0, tIdx));
    const rest = body.slice(tIdx);
    const timeRegion = rest.replace(/^时间\s*[:：]\s*/, '').split(/地点\s*[:：]/)[0].replace(/[\s，,、]+$/g, '').trim();
    const tr = parseTimeRange(timeRegion);
    const locM = rest.match(/\s*地点\s*[:：]\s*(.*)$/);
    const location = locM ? cleanupLocation(locM[1]) : '';
    if (!tr) return null;
    if (!title) title = location ? ('在' + location) : '日程';
    return { title, date: currentDate || toDateStr(now), time: tr.start, end: tr.end || null, location, allDay: !!tr.allDay, remind: tr.allDay ? 0 : 30 };
  }

  function parseBatch(text, now) {
    now = now || new Date();
    text = (text || '').trim();
    if (!text) return { events: [], error: '请输入内容' };
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const events = [];
    let currentDate = null;
    for (const line of lines) {
      // 纯标头/冒泡噪音，且不含时间
      if (/^[@#]/.test(line) && !/时间/.test(line) && !/\d\s*[:：点半时]/.test(line)) continue;
      if (/时间\s*[:：]/.test(line)) {
        const ev = parseEventLine(line, currentDate, now);
        if (ev) events.push(ev);
      } else {
        const d = lineDate(line, now);
        if (d) currentDate = d;                        // 日期头 → 切换当前日期
        else {
          const ev = parseFreeLine(line, currentDate, now);
          if (ev) events.push(ev);                      // 无「时间：」但含时间 → 自由文本
        }
      }
    }
    if (!events.length) return { events: [], error: '没有识别到日程（需包含时间，如 9:00 或 时间：…）' };
    return { events };
  }

  // 判断是否像是「通知/多条」：含「时间：」关键字，或 ≥2 行带时间 → 走批量解析；否则单条自然语言
  function looksBatch(text) {
    text = (text || '').trim();
    if (!text) return false;
    if (/时间\s*[:：]/.test(text)) return true;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const eventy = lines.filter(l => /时间\s*[:：]/.test(l) || /\d{1,2}\s*[:：点半时]/.test(l)).length;
    return eventy >= 2;
  }

  window.NLP = { parseQuick, parseBatch, looksBatch };
})();
