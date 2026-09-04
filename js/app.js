/* 日程管家 —— 应用主逻辑 */
(function () {
  'use strict';

  const LS_KEY = 'schedule-app.items.v1';
  const DURATION = 60; // 每件事默认时长（分钟），用于“进行中”状态

  let items = [];
  let view = 'list';
  let editingId = null;
  let tickTimer = null;
  let pushEnabled = false; // 推送是否已就绪（就绪后由后端负责提醒，避免重复本地通知）
  // APK（Capacitor）模式：使用原生本地通知，无需服务器/域名，App 关闭也能提醒
  let _ln = null;
  function getLocalNotif() {
    if (_ln) return _ln;
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        _ln = window.Capacitor.Plugins.LocalNotifications;
        return _ln;
      }
      // 普通脚本未 import 插件时，用 Capacitor 原生注册一个代理（直接调用原生 LocalNotifications）
      if (window.Capacitor && typeof window.Capacitor.registerPlugin === 'function') {
        _ln = window.Capacitor.registerPlugin('LocalNotifications');
        if (window.Capacitor.Plugins) window.Capacitor.Plugins.LocalNotifications = _ln;
        return _ln;
      }
    } catch (e) {}
    return null;
  }
  const isCap = !!getLocalNotif();

  // 全局错误提示：任何未捕获错误都弹出来，避免“静默无反应”
  window.addEventListener('error', (ev) => {
    if (ev && ev.message) { try { toast('⚠️ ' + ev.message); } catch (e) {} }
  });

  // ---------- 工具 ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function load() {
    try { items = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { items = []; }
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    syncToServer(); // 推送开启后，把最新日程同步给后端
    if (isCap) scheduleNativeReminders(); // APK：重新安排原生本地通知
  }
  function uuid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayStr() { return fmtDate(new Date()); }
  function parseWhen(item) { return new Date(item.date + 'T' + item.time); }

  const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];

  function weekdayCN(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : '周' + WD_CN[d.getDay()];
  }

  function isToday(dateStr) { return dateStr === todayStr(); }

  function statusOf(item, now) {
    now = now || Date.now();
    const st = parseWhen(item).getTime();
    if (item.done) return 'done';
    if (st > now) return 'upcoming';
    if (now >= st && now < st + DURATION * 60000) return 'doing';
    return 'past';
  }

  function countdownText(item, now) {
    now = now || Date.now();
    const st = parseWhen(item).getTime();
    const diff = st - now;
    if (item.done) return '';
    if (diff <= 0) {
      return statusOf(item, now) === 'doing' ? '进行中' : '已结束';
    }
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + ' 分钟后';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + (m ? ' 小时 ' + m + ' 分' : ' 小时') + ' 后';
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- 视图渲染 ----------
  function render() {
    renderList();
    renderTable();
    renderSeg();
  }

  function renderSeg() {
    $('#tabList').classList.toggle('active', view === 'list');
    $('#tabTable').classList.toggle('active', view === 'table');
    $('#viewList').classList.toggle('hidden', view !== 'list');
    $('#viewTable').classList.toggle('hidden', view !== 'table');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function sortItems(list) { return list.slice().sort((a, b) => parseWhen(a) - parseWhen(b)); }

  function renderList() {
    const container = $('#listContainer');
    const empty = $('#emptyHint');
    // 分类
    const today = todayStr();
    const future = [], past = [], todayItems = [];
    for (const it of items) {
      if (isToday(it.date)) todayItems.push(it);
      else if (it.date >= today) future.push(it);
      else past.push(it);
    }
    const sections = [];
    if (todayItems.length) {
      sections.push({ label: '今天', sub: weekdayCN(today), arr: sortItems(todayItems), today: true });
    }
    if (future.length) {
      const byDate = groupByDate(future);
      for (const d of byDate) sections.push({ label: d.date, sub: weekdayCN(d.date), arr: d.items });
    }
    let html = '';
    for (const sec of sections) {
      html += `<div class="group">
        <div class="group-date">${sec.label} <span class="badge">${sec.arr.length}</span> <span class="sub">${sec.sub}</span></div>
        ${sec.arr.map(it => itemHTML(it)).join('')}
      </div>`;
    }
    if (past.length) {
      const byDate = groupByDate(past, true);
      html += `<div class="group"><div class="group-date" style="color:#8d93ad">已过日程 <span class="badge">${past.length}</span></div>`;
      for (const d of byDate) {
        html += `<div class="group" style="opacity:.8"><div class="group-date"><span class="sub">${d.date} ${weekdayCN(d.date)}</span></div>${d.items.map(it => itemHTML(it)).join('')}</div>`;
      }
      html += `</div>`;
    }
    container.innerHTML = html;
    empty.classList.toggle('hidden', items.length > 0);
  }

  function groupByDate(list, desc) {
    const map = {};
    for (const it of list) (map[it.date] = map[it.date] || []).push(it);
    const keys = Object.keys(map);
    keys.sort((a, b) => desc ? (b < a ? -1 : 1) : (a < b ? -1 : 1));
    return keys.map(k => ({ date: k, items: sortItems(map[k]) }));
  }

  function itemHTML(it) {
    const st = statusOf(it);
    const barCls = it.done ? 'done' : st === 'past' ? 'past' : '';
    const tagCls = it.done ? 'done' : st === 'upcoming' ? 'upcoming' : st === 'doing' ? 'doing' : 'past';
    const tagText = it.done ? '已完成' : st === 'upcoming' ? '未开始' : st === 'doing' ? '进行中' : '已结束';
    const cd = it.done ? '' : countdownText(it);
    const cdCls = st === 'doing' ? 'doing' : st === 'past' ? 'past' : '';
    const remind = it.remind > 0 ? `⏰ 提前${it.remind}分钟` : '';
    return `<div class="item" data-id="${it.id}">
      <button class="check ${it.done ? 'done' : ''}" data-act="toggle" aria-label="完成">${it.done ? '✓' : ''}</button>
      <div class="item-bar ${barCls}"></div>
      <div class="item-body">
        <div class="item-title">${esc(it.title)}</div>
        <div class="item-meta">
          <span class="item-time">${isToday(it.date) ? '今天' : it.date} ${it.allDay ? '全天' : it.time + (it.end ? ' - ' + it.end : '')}</span>
          ${remind ? `<span class="tag upcoming">${remind}</span>` : ''}
          ${it.location ? `<span class="tag">📍 ${esc(it.location)}</span>` : ''}
        </div>
        ${it.note ? `<div class="item-note">${esc(it.note)}</div>` : ''}
      </div>
      <div class="item-right">
        <div class="countdown ${cdCls}">${cd}</div>
        <span class="tag ${tagCls}">${tagText}</span>
      </div>
    </div>`;
  }

  function renderTable() {
    const tbody = $('#tableBody');
    const empty = $('#tableEmpty');
    const sorted = sortItems(items);
    const today = todayStr();
    if (!sorted.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = sorted.map(it => {
      const st = statusOf(it);
      const tagCls = it.done ? 'done' : st === 'upcoming' ? 'upcoming' : st === 'doing' ? 'doing' : 'past';
      const tagText = it.done ? '已完成' : st === 'upcoming' ? '未开始' : st === 'doing' ? '进行中' : '已结束';
      const remind = it.remind > 0 ? `${it.remind}分钟` : '—';
      return `<tr class="${it.date === today ? 'today' : ''}" data-id="${it.id}">
        <td class="tdate">${isToday(it.date) ? '今天' : it.date}<div style="font-size:11px;color:#8d93ad">${weekdayCN(it.date)}</div></td>
        <td class="ttime">${it.allDay ? '全天' : it.time + (it.end ? '-' + it.end : '')}</td>
        <td>${esc(it.title)}${it.location ? `<div style="font-size:11px;color:#8d93ad">📍 ${esc(it.location)}</div>` : ''}${it.note ? `<div style="font-size:11px;color:#8d93ad">${esc(it.note)}</div>` : ''}</td>
        <td>${remind}</td>
        <td><span class="t-status ${tagCls}" style="background:var(--brand-soft);color:var(--brand)${st==='doing'?';background:#fff4e5;color:#e79a00':''}${st==='past'?';background:#f0f1f6;color:#8d93ad':''}${it.done?';background:#e6f8f0;color:#22c08a':''}">${tagText}</span></td>
      </tr>`;
    }).join('');
  }

  // ---------- 添加 / 编辑 / 删除 ----------
  function addItem(data) {
    const item = Object.assign({ id: uuid(), done: false, notified: false, allDay: false, createdAt: Date.now() }, data);
    items.push(item);
    save();
    render();
    return item;
  }

  // 同地点相连合并：同一天、同地点、且上一场结束时间 == 下一场开始时间 → 合并
  function mergeSameVenue(events) {
    if (events.length < 2) return events;
    const sorted = events.slice().sort((a, b) => {
      const ka = a.date + ' ' + a.time, kb = b.date + ' ' + b.time;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const out = [];
    for (const ev of sorted) {
      const last = out[out.length - 1];
      if (last && last.date === ev.date && last.location && ev.location === last.location && last.end === ev.time) {
        last.end = ev.end || ev.time;
        last.title = last.title + '、' + ev.title;
        last.allDay = last.allDay || ev.allDay;
      } else {
        out.push(Object.assign({}, ev));
      }
    }
    return out;
  }

  function openEdit(id) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    editingId = id;
    $('#modalTitle').textContent = '编辑日程';
    $('#eTitle').value = it.title;
    $('#eDate').value = it.date;
    $('#eTime').value = it.time;
    $('#eEnd').value = it.end || '';
    $('#eLocation').value = it.location || '';
    $('#eNote').value = it.note || '';
    const remindGroup = $('#eRemindGroup');
    $$('.chip', remindGroup).forEach(c => c.classList.toggle('active', parseInt(c.dataset.min, 10) === it.remind));
    $('#eRemind').value = it.remind;
    $('#deleteBtn').textContent = '删除';
    openModal();
  }

  function openModal() { $('#modal').classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); editingId = null; }

  // ---------- 通知 ----------
  let swReg = null;
  function notifSupported() { return 'Notification' in window; }

  async function ensurePermission() {
    if (!notifSupported()) { toast('此浏览器不支持通知'); return 'unsupported'; }
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') { toast('通知已被关闭，请在系统设置中开启'); return 'denied'; }
    return Notification.requestPermission().then(p => { updateNotifyUI(); return p; });
  }

  async function updateNotifyUI() {
    const btn = $('#notifyBtn');
    const dot = $('#notifyDot');
    btn.classList.remove('on', 'off');
    if (!notifSupported()) { dot.style.background = 'var(--muted)'; return; }
    if (Notification.permission === 'granted') { btn.classList.add('on'); dot.style.background = 'var(--ok)'; }
    else if (Notification.permission === 'denied') { btn.classList.add('off'); dot.style.background = 'var(--warn)'; }
    else { dot.style.background = 'var(--muted)'; }
  }

  function showNotification(item) {
    if (!notifSupported() || Notification.permission !== 'granted') return;
    const body = `${item.title} · ${item.date} ${item.time}${item.note ? ' · ' + item.note : ''}`;
    try {
      if (swReg && swReg.showNotification) {
        swReg.showNotification('⏰ 日程提醒：马上开始', {
          body,
          tag: 'remind-' + item.id,
          renotify: true,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          vibrate: [200, 100, 200],
        }).catch(() => new Notification('⏰ 日程提醒', { body, tag: 'remind-' + item.id, icon: 'icons/icon-192.png' }));
      } else {
        const n = new Notification('⏰ 日程提醒：马上开始', {
          body,
          tag: 'remind-' + item.id,
          icon: 'icons/icon-192.png',
        });
        n.onclick = () => { window.focus(); n.close(); };
      }
    } catch (e) { /* 忽略 */ }
  }

  let remindingId = null;

  // 检查哪些日程进入提前提醒窗口
  function checkReminders() {
    const now = Date.now();
    for (const it of items) {
      if (it.done) continue;
      // 提前提醒窗口
      if (!it.notified && it.remind > 0) {
        const st = parseWhen(it).getTime();
        const target = st - it.remind * 60000;
        if (now >= target && now < st) {
          it.notified = true;
          save();
          fireReminder(it, false);
        }
      }
      // 稍后提醒（snooze）
      if (it._snoozeAt && now >= it._snoozeAt) {
        it._snoozeAt = null;
        save();
        fireReminder(it, true);
      }
    }
  }

  // 触发提醒：全屏弹窗 + 声音 + 震动 + 系统通知（推送未启用时）
  // 无论是网页版还是 APK，App 打开时都弹窗+声音+震动，确保能被注意到
  function fireReminder(item, isSnooze) {
    showRemindModal(item, isSnooze);
    playSound();
    if (navigator.vibrate) { try { navigator.vibrate([300, 120, 300, 120, 300]); } catch (e) {} }
    if (!pushEnabled) {
      showNotification(item);
      toast(`已提醒：${item.title}`);
    }
  }

  // ---------- CAPACITOR 原生本地通知（APK：无需服务器，关闭也能提醒） ----------
  function toNumId(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return (h % 2147483646) + 1; }
  // 转成 Capacitor 的原生本地时间对象（注意：Capacitor 的 month 是 0-11，不是 1-12）
  function localScheduleOn(d) {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
  }
  async function scheduleNativeReminders() {
    // 同时尝试两条路：A 用本地通知(LocalNotifications)、B 用全屏闹钟(Alarm)，哪个真实存在就生效
    const AL = getAlarmPlugin();
    const LN = getLocalNotif();
    const now = Date.now();
    const buildList = () => {
      const list = [];
      const nowMs = Date.now();
      for (const it of items) {
        if (it.done || !(it.remind > 0)) continue;
        const st = parseWhen(it).getTime();
        if (st <= nowMs) continue; // 已开始/已结束，不再安排
        const when = st - it.remind * 60000;
        // 提醒时刻至少为“现在+1秒”，避免“等于现在”被跳过导致不提醒
        const fireAt = Math.max(when, nowMs + 1000);
        const body = `${it.title} · ${it.date} ${it.allDay ? '全天' : it.time + (it.end ? '-' + it.end : '')}${it.location ? ' · ' + it.location : ''}`;
        list.push({ id: toNumId(it.id), title: it.title, body, at: new Date(fireAt).toISOString() });
      }
      return list;
    };

    // B 方案：全屏闹钟插件
    if (AL) {
      try {
        try { if (typeof AL.requestPermissions === 'function') await AL.requestPermissions(); } catch (e) {}
        try { if (typeof AL.cancelAll === 'function') await AL.cancelAll(); } catch (e) {}
        const list = buildList();
        for (const n of list) { try { if (typeof AL.schedule === 'function') await AL.schedule(n); } catch (e) {} }
      } catch (e) { /* 忽略 */ }
    }

    // A 方案：本地通知
    if (LN) {
      try {
        const pending = await LN.getPending();
        await LN.cancel({ notifications: pending.notifications });
        await LN.requestPermissions();
        await LN.createChannel({ id: 'alarm_reminders', name: '日程提醒', importance: 4, sound: 'schedule_alarm', vibration: true, vibrationPattern: [0, 600, 300, 600], visibility: 0, lights: true });
      } catch (e) { /* 忽略 */ }
      const list = buildList();
      if (list.length) {
        try {
          await LN.schedule({
            notifications: list.map(n => ({
              id: n.id,
              title: '⏰ 日程提醒',
              body: n.body,
              schedule: { at: n.at, allowWhileIdle: true },
              sound: 'schedule_alarm',
              channelId: 'alarm_reminders',
              smallIcon: 'ic_stat_icon',
            })),
          });
        } catch (e) {}
      }
    }
  }

  // ---------- 提醒声音（Web Audio，无需音频文件） ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
    return audioCtx;
  }
  function playSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      const notes = [[523, 0], [659, 0.16], [784, 0.32]]; // C5 - E5 - G5 清脆提示音
      for (const [freq, off] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        const t = t0 + off;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.start(t); osc.stop(t + 0.6);
      }
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 提醒弹窗 ----------
  function showRemindModal(item, isSnooze) {
    remindingId = item.id;
    $('#remindTitle').textContent = item.title;
    const loc = item.location ? ' · ' + item.location : '';
    const time = item.allDay ? '全天' : item.time + (item.end ? ' - ' + item.end : '');
    $('#remindMeta').textContent = `${isSnooze ? '（稍后提醒）' : '即将开始'} · ${item.date} ${time}${loc}`;
    $('#remindModal').classList.remove('hidden');
  }

  // 每秒/每隔一段时间检查，并在整点时做准备
  function startTick() {
    tickTimer = setInterval(() => {
      checkReminders();       // 到点触发提醒
      render();               // 每 20 秒刷新列表/表格，让倒计时与状态实时更新
    }, 20000);
  }

  // ---------- Web Push ----------
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  // 把当前日程同步给后端（供定时任务判断何时推送）
  async function syncToServer() {
    if (!pushEnabled) return;
    try {
      const payload = items.map(it => ({
        id: it.id,
        title: it.title,
        date: it.date,
        time: it.time,
        end: it.end || null,
        location: it.location || '',
        allDay: !!it.allDay,
        remind: it.remind,
        done: !!it.done,
      }));
      await fetch('api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) { /* 忽略，本地仍可用 */ }
  }

  // 订阅推送 + 上报给后端
  async function setupPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const r = await fetch('api/vapid-public');
        const { publicKey } = await r.json();
        if (!publicKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await fetch('api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      pushEnabled = true;
      syncToServer();
    } catch (e) {
      pushEnabled = false;
    }
  }

  // ---------- 日期默认值 ----------
  function initFormDefaults() {
    const today = new Date();
    let t = today.getTime() + 60 * 60000; // 默认1小时后
    const d = new Date(t);
    $('#fDate').value = fmtDate(d);
    $('#fTime').value = pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // ---------- 事件绑定 ----------
  function bindChips(groupSel, inputSel) {
    const group = $(groupSel), input = $(inputSel);
    $$('.chip', group).forEach(c => {
      c.addEventListener('click', () => {
        $$('.chip', group).forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        input.value = parseInt(c.dataset.min, 10);
      });
    });
  }

  function bindEvents() {
    // 快速录入 / 批量解析
    $('#quickForm').addEventListener('submit', e => {
      e.preventDefault();
      const raw = $('#quickInput').value;
      if (typeof window.NLP === 'undefined' || typeof window.NLP.parseBatch !== 'function') {
        toast('⚠️ 解析脚本未加载，请刷新页面（Ctrl+F5）');
        return;
      }
      // 仅当看起来像「通知/多条」才批量解析；否则走单条自然语言
      if (typeof window.NLP.looksBatch === 'function' && window.NLP.looksBatch(raw)) {
        const batch = window.NLP.parseBatch(raw);
        if (batch.events && batch.events.length) {
          const chipRemind = parseInt($('#fRemind').value, 10) || 30;
          const evs = mergeSameVenue(batch.events); // 按时间排序 + 同地点相连合并
          evs.forEach(ev => addItem({ title: ev.title, date: ev.date, time: ev.time, end: ev.end, location: ev.location, allDay: ev.allDay, note: '', remind: ev.allDay ? 0 : chipRemind }));
          $('#quickInput').value = '';
          toast('已导入 ' + evs.length + ' 条日程');
          return;
        }
      }
      const res = window.NLP.parseQuick(raw);
      if (res.error) { toast(res.error); return; }
      addItem({ title: res.title, date: res.dateStr, time: res.timeStr, end: null, location: '', allDay: res.allDay, note: '', remind: parseInt($('#fRemind').value, 10) || 30 });
      $('#quickInput').value = '';
      toast('已添加：' + res.title + ' · ' + res.dateStr + ' ' + res.timeStr);
    });

    // 手动表单
    $('#openFormBtn').addEventListener('click', () => {
      initFormDefaults();
      $('#formCard').classList.toggle('hidden');
    });
    $('#cancelFormBtn').addEventListener('click', () => $('#formCard').classList.add('hidden'));
    $('#manualForm').addEventListener('submit', e => {
      e.preventDefault();
      const title = $('#fTitle').value.trim();
      const date = $('#fDate').value, time = $('#fTime').value;
      if (!title || !date || !time) { toast('请填写完整'); return; }
      addItem({ title, date, time, end: $('#fEnd').value || null, location: $('#fLocation').value.trim(), note: $('#fNote').value.trim(), remind: parseInt($('#fRemind').value, 10) || 30 });
      $('#manualForm').reset();
      $('#formCard').classList.add('hidden');
      toast('已保存日程');
    });

    // 视图切换
    $('#tabList').addEventListener('click', () => { view = 'list'; render(); });
    $('#tabTable').addEventListener('click', () => { view = 'table'; render(); });

    // 列表/表格点击（编辑）
    $('#listContainer').addEventListener('click', onItemClick);
    $('#tableBody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) openEdit(tr.dataset.id);
    });

    // 编辑弹窗
    bindChips('#eRemindGroup', '#eRemind');
    $('#editForm').addEventListener('submit', e => {
      e.preventDefault();
      const it = items.find(x => x.id === editingId);
      if (!it) return;
      it.title = $('#eTitle').value.trim();
      it.date = $('#eDate').value;
      it.time = $('#eTime').value;
      it.end = $('#eEnd').value || null;
      it.location = $('#eLocation').value.trim();
      it.note = $('#eNote').value.trim();
      it.remind = parseInt($('#eRemind').value, 10) || 0;
      // 若修改了时间，重置提醒状态
      it.notified = false;
      save(); render(); closeModal();
      toast('已更新');
    });
    $('#deleteBtn').addEventListener('click', () => {
      if (!editingId) return;
      items = items.filter(x => x.id !== editingId);
      save(); render(); closeModal();
      toast('已删除');
    });

    // 弹窗关闭
    $$('#modal [data-close]').forEach(el => el.addEventListener('click', closeModal));

    // FAB / 通知
    $('#fabAdd').addEventListener('click', () => { initFormDefaults(); $('#formCard').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#notifyBtn').addEventListener('click', async () => {
      const LN = getLocalNotif();
      const AL = getAlarmPlugin();
      let sent = false;
      // 优先本地通知（A 方案用），失败再试全屏闹钟（B 方案用）
      if (LN) {
        try {
          await LN.requestPermissions();
          await LN.createChannel({ id: 'alarm_reminders', name: '日程提醒', importance: 4, sound: 'schedule_alarm', vibration: true, vibrationPattern: [0, 600, 300, 600], visibility: 0, lights: true });
          await LN.schedule({ notifications: [{ id: 123456, title: '⏰ 测试提醒', body: '收到说明后台提醒正常', schedule: { at: new Date(Date.now() + 2000).toISOString(), allowWhileIdle: true }, sound: 'schedule_alarm', channelId: 'alarm_reminders', smallIcon: 'ic_stat_icon' }] });
          sent = true;
        } catch (e) {}
      }
      if (!sent && AL) {
        try {
          if (typeof AL.requestPermissions === 'function') await AL.requestPermissions();
          await AL.schedule({ id: 123456, title: '⏰ 测试提醒', body: '收到说明全屏闹钟正常', at: new Date(Date.now() + 2000).toISOString() });
          sent = true;
        } catch (e) {}
      }
      if (sent) toast('测试提醒已发送，2 秒后请注意');
      else {
        const p = await ensurePermission();
        if (p === 'granted') toast('已开启提醒通知 ✅');
        else toast('当前浏览器不支持通知');
      }
      await scheduleNativeReminders();
    });

    // 提醒弹窗：知道了 / 稍后提醒 / 点击遮罩关闭
    $('#remindDismiss').addEventListener('click', () => $('#remindModal').classList.add('hidden'));
    $('#remindSnooze').addEventListener('click', () => {
      const it = items.find(x => x.id === remindingId);
      if (it) { it._snoozeAt = Date.now() + 5 * 60000; save(); }
      $('#remindModal').classList.add('hidden');
      toast('5 分钟后提醒你');
    });
    $('#remindModal .remind-backdrop').addEventListener('click', () => $('#remindModal').classList.add('hidden'));

    // 首次交互时解锁音频（浏览器自动播放策略需要用户手势）
    const unlockAudio = () => { ensureAudio(); };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  function onItemClick(e) {
    const check = e.target.closest('[data-act="toggle"]');
    const itemEl = e.target.closest('.item[data-id]');
    if (!itemEl) return;
    const id = itemEl.dataset.id;
    if (check) {
      const it = items.find(x => x.id === id);
      if (it) { it.done = !it.done; if (it.done) it.notified = true; save(); render(); }
      return;
    }
    openEdit(id);
  }

  // ---------- 启动 ----------
  function init() {
    load();
    initFormDefaults();
    bindChips('#remindGroup', '#fRemind');
    bindEvents();
    // 更新今日标签
    const now = new Date();
    $('#todayLabel').textContent = `今天是 ${fmtDate(now)} ${weekdayCN(fmtDate(now))}`;
    updateNotifyUI();
    render();
    startTick();
    if (isCap) scheduleNativeReminders(); // APK：启动时安排原生本地通知
    // 注册 Service Worker；当检测到新的 SW（代码更新）接管时，自动刷新一次，让新逻辑立即生效
    if ('serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller; // 是否已由旧 SW 接管（视为“更新”而非首次安装）
      let reloaded = false;
      navigator.serviceWorker.register('sw.js').then(reg => { swReg = reg; }).catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        if (hadController) window.location.reload(); // 更新场景才自动刷新；首次访问不刷
      });
    }
    // 请求通知权限（首次且未决定时）
    load();
    if (notifSupported() && Notification.permission === 'default') {
      setTimeout(() => {
        Promise.resolve(Notification.requestPermission()).then(() => {
          updateNotifyUI();
          setupPush(); // 授权后尝试订阅推送
        });
      }, 1200);
    } else {
      // 若已授权，直接尝试建立推送
      setupPush();
    }
    // 应用重新可见时，若推送已就绪则补一次同步
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncToServer(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
