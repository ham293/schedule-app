/**
 * 后端共享库（Vercel Node Serverless Function）
 * - Web Push（VAPID）
 * - KV 存储层：优先 Vercel KV（Upstash Redis，REST），未配置时回退内存（本地开发）
 */
const webpush = require('web-push');

// VAPID 密钥：优先环境变量，其次内置默认（开箱即用；生产建议用自己的）
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BNWOHWsquqwl3ITq416gjSSmOwXOfKVHBjeQtVTh3UE_C2B3l1GohTSG7mKPa15fOK9rYI6HDrfIvy-HLYPvpus';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'm8mbv_9zK_lHFYw7m4fZHYboKA968HSWDi3iJGtnTMo';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

// Vercel KV 环境变量（Upstash Redis REST 兼容）
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const hasKV = () => !!(KV_URL && KV_TOKEN);

const mem = new Map();

async function kvGet(key) {
  if (!hasKV()) return mem.get(key) || null;
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const j = await r.json();
  return j.result;
}

async function kvSet(key, val) {
  if (!hasKV()) { mem.set(key, val); return; }
  await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: val,
  });
}

async function getJSON(key, fallback) {
  const s = await kvGet(key);
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}
async function setJSON(key, val) { await kvSet(key, JSON.stringify(val)); }

/** 把订阅里已失效的 endpoint 从列表中移除，并回写 */
async function pruneSubs(subs, deadEndpoints) {
  if (!deadEndpoints || (!deadEndpoints.length)) return subs;
  const set = new Set(deadEndpoints);
  const next = subs.filter(s => !set.has(s.endpoint));
  await setJSON('subs', next);
  return next;
}

/** 统一 JSON 响应（兼容 Vercel 与本地 Node） */
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

module.exports = { webpush, PUBLIC_KEY, hasKV, getJSON, setJSON, pruneSubs, json };
