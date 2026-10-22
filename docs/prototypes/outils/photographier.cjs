// Takes screenshots of static pages (as written by rendre.cjs) in headless Chromium, served by a local http server:
// CSS masks and some other image fetches need a same-origin page, which file:// pages are not.
// Usage: node photographier.cjs <root dir> <width>x<height> <page.html> [<page.html> ...]   (pages relative to the root)
// Each picture is saved next to its page, as .png. CHROMIUM_PATH is optional.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

(async () => {
  const [rootArg, size, ...pages] = process.argv.slice(2);
  const [width, height] = String(size).split('x').map(Number);
  if (!rootArg || !width || !height || !pages.length) {
    console.error('Usage: node photographier.cjs <root dir> <width>x<height> <page.html> [<page.html> ...]');
    process.exit(1);
  }
  const root = path.resolve(rootArg);
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width, height } });
  for (const name of pages) {
    await page.goto(base + name.split(path.sep).map(encodeURIComponent).join('/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const shot = path.join(root, name.replace(/\.html$/, '') + '.png');
    await page.screenshot({ path: shot });
    console.log(name, '->', path.relative(process.cwd(), shot));
  }
  await browser.close();
  server.close();
})();
