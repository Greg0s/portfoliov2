// Renders render.html variants with headless Chromium and saves the canvas as an image file.
// Usage: node shoot.cjs <outDir> <name>:<query> [<name>:<query> ...]
// Serve this folder first (for example `python3 -m http.server 8765`). BASE_URL and CHROMIUM_PATH are optional.
const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8765/render.html';

(async () => {
  const [outDir, ...jobs] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const job of jobs) {
    const [name, query] = job.split(/:(.*)/s);
    const params = new URLSearchParams(query);
    const w = Number(params.get('w') || 1200);
    const h = Number(params.get('h') || 1200);
    const ext = params.get('fmt') === 'jpg' ? 'jpg' : 'png';
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    const started = Date.now();
    await page.goto(BASE_URL + '?' + query);
    try {
      // A series of frames takes longer: allow 6 s more per frame.
      await page.waitForFunction(() => window.__done === true, null, { timeout: 240000 + Number(params.get('frames') || 0) * 6000 });
    } catch (e) {
      console.log(name, 'TIMEOUT', logs.join('\n'));
      await page.close();
      continue;
    }
    // One image, or a numbered series for the frames of an animation.
    const urls = await page.evaluate(() => window.__images || [window.__image]);
    urls.forEach((url, i) => {
      const file = urls.length > 1 ? `${name}-${String(i).padStart(3, '0')}` : name;
      fs.writeFileSync(`${outDir}/${file}.${ext}`, Buffer.from(url.split(',')[1], 'base64'));
    });
    // Data the page needs to place a layer (the rose's pivot), when the render gives any.
    const info = await page.evaluate(() => window.__info || null);
    if (info) fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify(info));
    console.log(name, 'ok', ((Date.now() - started) / 1000).toFixed(1) + 's');
    for (const l of logs) if (!/404|THREE\./.test(l)) console.log('  ' + l.slice(0, 2000));
    await page.close();
  }
  await browser.close();
})();
