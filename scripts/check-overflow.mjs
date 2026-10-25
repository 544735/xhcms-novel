/**
 * 通过 CDP 检查指定页面在指定视口下是否存在横向溢出，并列出溢出元素。
 * 用法：node scripts/check-overflow.mjs <url> [width] [height]
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const [, , url = 'http://127.0.0.1:3000/', width = '390', height = '844'] = process.argv;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;

const child = spawn(EDGE, [
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${width},${height}`,
  '--user-data-dir=' + process.env.TEMP + '\\wmcms-cdp-' + Date.now(),
  url,
], { stdio: 'ignore' });

const sleep = (ms) => delay(ms);

async function targets() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await response.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* 等待浏览器启动 */
    }
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
}

async function main() {
  const target = await targets();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(3000);

  const expression = `(() => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.textContent || '').trim().slice(0, 40),
        });
      }
    }
    offenders.sort((a, b) => b.right - a.right);
    return JSON.stringify({
      innerWidth: vw,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenderCount: offenders.length,
      top: offenders.slice(0, 12),
    });
  })()`;

  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  console.log(result.result.value);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFileSync } = await import('node:fs');
  const prefix = process.env.SHOT_PREFIX || 'screenshots/mobile';
  writeFileSync(`${prefix}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`screenshot -> ${prefix}.png`);

  ws.close();
  child.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error('检查失败:', error.message);
  child.kill();
  process.exit(1);
});
