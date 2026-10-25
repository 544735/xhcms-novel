/**
 * 管理后台运行时验证（CDP）：
 * 1) 调 API 登录获取真实令牌；
 * 2) 注入 localStorage（与 lib/tokens.ts 的 key 一致）；
 * 3) 依次访问后台页面，截图并检查渲染结果与前端异常。
 *
 * 用法：node scripts/verify-admin.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9334;
const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:4000/api/v1';
const OUT = 'D:\\wmcms\\screenshots';

const sleep = (ms) => delay(ms);

async function apiLogin(username, password) {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`登录失败 HTTP ${response.status}`);
  const payload = await response.json();
  return payload.data;
}

const child = spawn(EDGE, [
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\wmcms-admin-${Date.now()}`,
  'about:blank',
], { stdio: 'ignore' });

async function findTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await response.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* 等待启动 */
    }
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
}

async function main() {
  const login = await apiLogin('admin', 'Admin@123456');
  console.log(`登录成功：${login.user.username}，权限 ${login.user.permissions.length} 项`);

  const target = await findTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const consoleErrors = [];
  let messageId = 0;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(data.params.exceptionDetails?.text || 'unknown exception');
    }
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      consoleErrors.push(data.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    }
    if (!data.id) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error.message));
    else entry.resolve(data.result);
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  await send('Page.enable');
  await send('Runtime.enable');

  // 先进入同源页面后写 localStorage
  await send('Page.navigate', { url: `${BASE}/admin/login` });
  await sleep(3500);
  const siteId = login.user.sites[0]?.id ?? '';
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('wmcms:access_token', ${JSON.stringify(login.accessToken)});
      localStorage.setItem('wmcms:refresh_token', ${JSON.stringify(login.refreshToken)});
      localStorage.setItem('wmcms:current_site', ${JSON.stringify(siteId)});
      'ok';
    `,
    returnByValue: true,
  });

  const pages = [
    ['16-admin-dashboard.png', '/admin'],
    ['17-admin-novels.png', '/admin/novels'],
    ['18-admin-categories.png', '/admin/categories'],
    ['19-admin-collect.png', '/admin/collect'],
    ['20-admin-vip.png', '/admin/vip'],
    ['21-admin-authors.png', '/admin/authors'],
  ];

  for (const [file, path] of pages) {
    await send('Page.navigate', { url: BASE + path });
    await sleep(3800);
    const probe = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText || '';
        return JSON.stringify({
          url: location.pathname,
          title: document.title,
          hasErrorOverlay: Boolean(document.querySelector('nextjs-portal')) || text.includes('Application error'),
          unauthorized: text.includes('无权限') || text.includes('缺少权限'),
          redirectToLogin: location.pathname === '/admin/login',
          markers: ['仪表盘','文章管理','栏目管理','插件中心','站点设置','评论审核'].filter((m) => text.includes(m)),
          length: text.length,
        });
      })()`,
      returnByValue: true,
    });
    console.log(file, probe.result.value);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${OUT}\\${file}`, Buffer.from(shot.data, 'base64'));
  }

  if (consoleErrors.length) {
    console.log('前端控制台错误：');
    for (const error of consoleErrors.slice(0, 15)) console.log(' -', error);
  } else {
    console.log('前端控制台错误：0');
  }

  ws.close();
  child.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error('验证失败:', error.message);
  child.kill();
  process.exit(1);
});
