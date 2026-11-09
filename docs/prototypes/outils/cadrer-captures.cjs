/**
 * Frames the projects' screenshots as their covers (Grégoire's decision of 9 November 2026): each product in a browser
 * window, with a phone beside it when there is one, on the site's night background, a soft glow in the product's
 * colours under the screens. Writes 2560 × 1440 PNGs, to save as `src/content/projects/<slug>/cover.jpg`.
 *
 *   node cadrer-captures.cjs [sources] [out]
 *
 * The sources (Grégoire's screenshots, cropped to what each frame shows) stay out of the repository, in
 * `.design-assets/captures/` by default; Siemens' dashboard already has its added "Layer simulation" panel.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const sources = process.argv[2] || path.join(__dirname, '../../../.design-assets/captures');
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(sources, f)).toString('base64');

const jobs = [
  { out: 'lyrix', desktop: 'lyrix-desktop.png', phone: 'lyrix-phone.png', url: 'lyrix.mintymoon.app', glow: '242 106 46', glow2: '236 106 46' },
  { out: 'what-we-play', desktop: 'wwp-desktop.png', phone: 'wwp-phone.png', url: 'whatweplay.gregoiretinn.es', glow: '236 72 153', glow2: '91 200 232' },
  { out: 'sncf-wrapped', desktop: 'sncf-desktop.png', phone: 'sncf-phone.png', url: 'greg0s.github.io/sncf-wrapped', glow: '140 228 250', glow2: '225 150 250' },
  { out: 'siemens', desktop: 'siemens-desktop.png', url: '', glow: '0 160 170', glow2: '60 90 220' },
  { out: 'perfmanager', desktop: 'perf-desktop.png', url: 'perfmanager.com', glow: '26 160 140', glow2: '24 145 170' },
  { out: 'litterature-combinatoire', desktop: 'combi-desktop.png', phone: 'combi-phone.png', url: 'combimac.oulico.fr', glow: '250 190 140', glow2: '245 150 150' },
  { out: 'obaine', desktop: 'obaine-desktop.png', phone: 'obaine-phone.png', url: '', glow: '230 50 90', glow2: '60 70 200' },
];

const page = (job) => `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 2560px; height: 1440px; overflow: hidden; background: #0c0c0d; font-family: system-ui, sans-serif; position: relative; }
  .glow { position: absolute; inset: 0;
    background: radial-gradient(ellipse 38% 34% at 44% 42%, rgb(${job.glow} / 30%), transparent 72%),
                radial-gradient(ellipse 22% 30% at 70% 50%, rgb(${job.glow2} / 24%), transparent 72%),
                radial-gradient(ellipse 80% 70% at 50% 30%, #17171a, #0c0c0d 75%);
    filter: blur(20px); }
  .window { position: absolute; top: 170px; left: 50%; width: ${job.phone ? 1560 : 1720}px;
    translate: ${job.phone ? '-58%' : '-50%'} 0;
    border-radius: 22px; overflow: hidden; background: #1a1a1d;
    box-shadow: 0 0 0 1px rgb(255 255 255 / 9%), 0 40px 120px rgb(0 0 0 / 65%), 0 10px 30px rgb(0 0 0 / 45%); }
  .bar { height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 24px; background: #1d1d20;
    border-bottom: 1px solid rgb(255 255 255 / 6%); }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: rgb(255 255 255 / 16%); }
  .url { margin-left: 28px; flex: 0 1 560px; height: 32px; border-radius: 16px; background: rgb(255 255 255 / 6%);
    color: rgb(243 243 241 / 55%); font-size: 18px; letter-spacing: 0.01em; display: flex; align-items: center; justify-content: center; }
  .window img { display: block; width: 100%; }
  .phone { position: absolute; top: 330px; left: 50%; translate: 455px 0; width: 400px; height: 846px;
    border-radius: 54px; padding: 12px; background: #1a1a1d; overflow: hidden;
    box-shadow: 0 0 0 1px rgb(255 255 255 / 12%), 0 40px 110px rgb(0 0 0 / 70%), 0 10px 30px rgb(0 0 0 / 50%); }
  .phone .screen { width: 100%; height: 100%; border-radius: 43px; overflow: hidden; background: #000; }
  .phone img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
</style></head><body>
  <div class="glow"></div>
  <div class="window">
    <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="url">${job.url}</span></div>
    <img src="${img(job.desktop)}">
  </div>
  ${job.phone ? `<div class="phone"><div class="screen"><img src="${img(job.phone)}"></div></div>` : ''}
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const outDir = process.argv[3] || path.join(sources, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  for (const job of jobs) {
    await p.setContent(page(job));
    // The glows sit on their own layer, under both screens: each follows its screen's outline.
    await p.evaluate(({ glow, glow2 }) => {
      const layer = (selector, color, blur, spread, radius) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const g = document.createElement('div');
        Object.assign(g.style, {
          position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
          borderRadius: radius, boxShadow: `0 0 ${blur}px ${spread}px rgb(${color})`,
        });
        document.querySelector('.glow').after(g);
      };
      layer('.phone', `${glow2} / 16%`, 200, 20, '54px');
      layer('.window', `${glow} / 14%`, 300, 30, '22px');
    }, { glow: job.glow, glow2: job.glow2 });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(outDir, `${job.out}.png`) });
  }
  await browser.close();
})();
