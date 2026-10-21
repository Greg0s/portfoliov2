// Renders render.html variants with headless Chromium and saves each picture, with its placement data alongside.
// Usage: node shoot.cjs <outDir> <name>:<query> [<name>:<query> ...]
// Serve this folder first (`npm run serve`). BASE_URL and CHROMIUM_PATH are optional.
const fs = require('fs');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8766/render.html';

(async () => {
  const [outDir, ...jobs] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const job of jobs) {
    const [name, query] = job.split(/:(.*)/s);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    const started = Date.now();
    await page.goto(BASE_URL + '?' + query);
    try {
      await page.waitForFunction(() => window.__done === true, null, { timeout: 600000 });
    } catch (e) {
      console.log(name, 'TIMEOUT', logs.join('\n'));
      await page.close();
      continue;
    }
    const { image, meta } = await page.evaluate(() => ({ image: window.__image, meta: window.__meta }));
    fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(image.split(',')[1], 'base64'));
    fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify(meta, null, 2));
    console.log(name, 'ok', ((Date.now() - started) / 1000).toFixed(1) + 's');
    for (const l of logs) if (!/404|THREE\./.test(l)) console.log('  ' + l.slice(0, 2000));
    await page.close();
  }
  await browser.close();
})();
