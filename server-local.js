/**
 * 本地开发服务器（内存存储，未配置 Vercel KV）
 * 用法：npm run dev  →  http://localhost:8099
 * 说明：真实推送需要浏览器实际订阅 + HTTPS + 推送服务，本地主要用于界面与接口联调、逻辑自测。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8099;
const ROOT = __dirname;

const vapid = require('./api/vapid-public');
const subscribe = require('./api/subscribe');
const sync = require('./api/sync');
const remind = require('./api/remind');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname;

  if (p === '/api/vapid-public') return vapid(req, res);
  if (p === '/api/subscribe') { req.body = await readBody(req); return subscribe(req, res); }
  if (p === '/api/sync') { req.body = await readBody(req); return sync(req, res); }
  if (p === '/api/remind') return remind(req, res);
  if (p === '/api/status') { return require('./api/_lib').json(res, 200, { ok: true, kv: require('./api/_lib').hasKV() }); }

  // 静态文件
  let file = p === '/' ? '/index.html' : p;
  file = path.normalize(path.join(ROOT, file));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => console.log(`日程管家 dev server: http://localhost:${PORT}`));
