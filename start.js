/* 日程管家桌面启动器：启动本地服务并打开浏览器（纯英文，避免 cmd 编码问题） */
const { spawn, execFile } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8099;
const URL = 'http://localhost:' + PORT;
const DIR = __dirname;

function isUp(cb) {
  const req = http.get('http://127.0.0.1:' + PORT, (res) => { res.resume(); cb(true); });
  req.on('error', () => cb(false));
  req.setTimeout(800, () => { req.destroy(); cb(false); });
}

function openBrowser() {
  execFile('cmd', ['/c', 'start', '', URL], () => {});
}

function waitAndOpen(tries) {
  tries = tries || 0;
  isUp((up) => {
    if (up) { openBrowser(); return; }
    if (tries >= 30) { openBrowser(); return; } // 最多等约 7.5 秒，仍尝试打开
    setTimeout(() => waitAndOpen(tries + 1), 250);
  });
}

isUp((up) => {
  if (up) { openBrowser(); return; } // 服务已在运行，直接打开网页
  const child = spawn(process.execPath, [path.join(DIR, 'server-local.js')], {
    cwd: DIR,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  waitAndOpen(0);
});
