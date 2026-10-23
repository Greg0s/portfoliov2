// Runs every test of dist/ in headless Chromium, on a desktop and a phone viewport, takes screenshots along the way
// and prints the results. Headless Chromium renders WebGL on the CPU (SwiftShader): the frame rates here only show
// that the tests run, never how fast a real device is.
// Usage: npm run build, then `node check.mjs [test …]`. Screenshots go to renders/check/.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(here, 'dist');
const out = path.join(here, 'renders/check');
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const tests = process.argv.slice(2).length ? process.argv.slice(2) : ['office-live', 'office-live-shadows', 'office-layers', 'journey-css', 'journey-webgl'];
const SHOTS = { 'office-live': [1.5, 6], 'office-live-shadows': [6], 'office-layers': [1.5, 6], 'journey-css': [1, 4.5, 12], 'journey-webgl': [1, 4.5, 12] };
const VIEWPORTS_ALL = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const VIEWPORTS = process.env.VIEWPORT ? { [process.env.VIEWPORT]: VIEWPORTS_ALL[process.env.VIEWPORT] } : VIEWPORTS_ALL;
for (const test of tests) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage(vp);
    const logs = [];
    page.on('console', (m) => m.type() !== 'debug' && logs.push(m.type() + ': ' + m.text()));
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    await page.goto(`${base}/run.html?test=${test}`);
    // Wait for the run to start (the readout appears), then shoot at the given times.
    await page.waitForSelector('.hud', { timeout: 300000 }).catch(() => {});
    const started = Date.now();
    for (const t of SHOTS[test] ?? []) {
      const wait = t * 1000 - (Date.now() - started);
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(out, `${test}-${vpName}-${t}s.png`) });
    }
    await page.waitForFunction(() => window.__result, null, { timeout: 600000 });
    const r = await page.evaluate(() => window.__result);
    const phases = r.phases ? Object.entries(r.phases).map(([k, p]) => `${k} ${p.fps} i/s`).join(', ') : r.error;
    console.log(`${test} ${vpName}: ${phases} · mise en place ${JSON.stringify(r.timings)} · ${JSON.stringify(r.stats)}`);
    for (const l of logs.filter((l) => !/GPU stall|favicon|404 \(Not Found\)|WebGL-|THREE\.WebGLRenderer: Context Lost/.test(l))) console.log('  ' + l.slice(0, 400));
    fs.writeFileSync(path.join(out, `${test}-${vpName}.json`), JSON.stringify(r, null, 2));
    await page.close();
  }
}
await browser.close();
server.close();
