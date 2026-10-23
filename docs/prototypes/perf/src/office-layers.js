// The office in pre-rendered layers, as in the mockup: the town, the room and the desk in WebP rendered by
// `../bureau/layers.mjs`, a layer of lit windows for the life of the town, the sky and its stars live, the screen and
// the pictures in HTML. Each layer moves with the head by its own amount (main spec §5.5).
import { quadMatrix } from './quad.js';
import { round } from './meter.js';

const ARRIVAL = 3.5;
const SEATED = 10;
// Head movement, in px, per layer (main spec §5.5).
const HEAD = { sky: 2, city: 4, room: 8, desk: 13 };
const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export async function setup({ stage, mobile, moment, timings }) {
  const framing = mobile ? 'mobile' : 'desktop';
  const name = (layer) => `layers/${moment}-${framing}-${layer}`;
  const meta = await (await fetch(name('desk') + '.json')).json();
  const base = mobile ? { w: 390, h: 844 } : { w: 1440, h: 900 };
  const vw = stage.clientWidth;
  const vh = stage.clientHeight;
  // Cover the viewport with the frame; the overscan margin spills outside.
  const s = Math.max(vw / base.w, vh / base.h);
  const W = meta.w;
  const H = meta.h;
  const left = (vw - W * s) / 2;
  const top = (vh - H * s) / 2;
  const at = (el) => {
    el.style.width = W + 'px';
    el.style.height = H + 'px';
  };

  const sky = document.createElement('div');
  sky.className = 'sky';
  const SKY = {
    aube: ['#101834', '#27366a', '#6c68a0', '#cb94a2', '#eec29f'],
    crepuscule: ['#121538', '#3b3172', '#a2567b', '#e7845a', '#f8b26b'],
  }[moment];
  sky.style.background = `linear-gradient(${SKY.map((c, i) => `${c} ${(i / (SKY.length - 1)) * 100}%`).join(',')})`;
  sky.style.height = (top + meta.horizon * s) + 'px';
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('i');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 60 + '%';
    star.style.animationDuration = 2.5 + Math.random() * 4.5 + 's';
    star.style.animationDelay = -Math.random() * 7 + 's';
    sky.append(star);
  }
  stage.append(sky);

  const world = document.createElement('div');
  world.className = 'layers';
  world.style.transform = `translate(${left}px, ${top}px) scale(${s})`;
  stage.append(world);

  const t0 = performance.now();
  const layer = async (id) => {
    const img = new Image();
    img.src = name(id) + '.webp';
    img.alt = '';
    img.className = 'layer';
    at(img);
    await img.decode();
    return img;
  };
  const [city, windows, room, desk] = await Promise.all(['city', 'windows', 'room', 'desk'].map(layer));
  timings.decodeLayersMs = round(performance.now() - t0);

  // Windows that light up now and then: patches of the lit layer over the town.
  const cityBox = document.createElement('div');
  cityBox.className = 'layer';
  at(cityBox);
  cityBox.append(city);
  const patches = [];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'lit';
    const w = 50 + Math.random() * 60;
    const h = 30 + Math.random() * 40;
    const x = Math.random() * (W - w);
    const y = meta.horizon + Math.random() * (H - meta.horizon - h) * 0.5;
    Object.assign(p.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', backgroundImage: `url(${windows.src})`, backgroundSize: `${W}px ${H}px`, backgroundPosition: `${-x}px ${-y}px` });
    cityBox.append(p);
    patches.push({ el: p, next: Math.random() * 4 });
  }

  const roomBox = document.createElement('div');
  roomBox.className = 'layer';
  at(roomBox);
  roomBox.append(room);
  const deskBox = document.createElement('div');
  deskBox.className = 'layer';
  at(deskBox);
  deskBox.append(desk);

  // The screen on the desk layer, the pictures on the room layer.
  const screen = document.createElement('div');
  screen.className = 'quad screen';
  screen.innerHTML = '<img src="media/clip-a.webp" alt=""><div class="taskbar"></div>';
  Object.assign(screen.style, { width: '640px', height: '400px', transform: quadMatrix(640, 400, meta.screen) });
  deskBox.append(screen);
  meta.pictures.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'quad picture';
    const w = 400;
    const h = Math.round(400 / p.ratio);
    el.innerHTML = `<img src="media/clip-${'abc'[i % 3]}.webp" alt="">`;
    Object.assign(el.style, { width: w + 'px', height: h + 'px', transform: quadMatrix(w, h, p.corners) });
    (p.id === 'desk' ? deskBox : roomBox).append(el);
  });
  world.append(cityBox, roomBox, deskBox);

  // Window centre, the point the room unfolds from during the arrival.
  const [wx, wy] = meta.window.reduce(([x, y], [a, b]) => [x + a / 4, y + b / 4], [0, 0]);
  roomBox.style.transformOrigin = deskBox.style.transformOrigin = `${wx}px ${Math.min(wy, H * 0.45)}px`;

  let lastT = 0;
  return {
    duration: ARRIVAL + SEATED,
    phaseAt: (t) => (t < ARRIVAL ? 'arrivée' : 'assis'),
    frame(t) {
      const dt = t - lastT;
      lastT = t;
      if (t < ARRIVAL) {
        // The town rises from below, the window frame appears, then the room unfolds as we pull back.
        const rise = easeOut(t / 1.2);
        const pull = easeOut((t - 1) / (ARRIVAL - 1));
        cityBox.style.transform = `translateY(${(1 - rise) * 40}%) scale(${1.4 - 0.4 * pull})`;
        const k = 3 - 2 * pull;
        roomBox.style.transform = `scale(${k})`;
        deskBox.style.transform = `scale(${k * (1 + 0.3 * (1 - pull))})`;
        roomBox.style.opacity = String(Math.min(1, Math.max(0, (t - 0.9) / 0.6)));
        deskBox.style.opacity = String(Math.min(1, Math.max(0, (t - 1.4) / 0.8)));
      } else {
        const st = t - ARRIVAL;
        const hx = Math.sin(st * 0.9);
        const hy = Math.sin(st * 1.3) * 0.5;
        const move = (el, a) => (el.style.transform = `translate(${(hx * a).toFixed(2)}px, ${(hy * a).toFixed(2)}px)`);
        move(sky, HEAD.sky);
        move(cityBox, HEAD.city);
        move(roomBox, HEAD.room);
        move(deskBox, HEAD.desk);
        roomBox.style.opacity = deskBox.style.opacity = '1';
      }
      for (const p of patches) {
        p.next -= dt;
        if (p.next < 0) {
          p.el.classList.toggle('on');
          p.next = 2 + Math.random() * 6;
        }
      }
    },
    stats() {
      const decoded = [city, windows, room, desk].reduce((sum, i) => sum + i.naturalWidth * i.naturalHeight * 4, 0);
      return {
        layers: 4,
        imageSize: `${city.naturalWidth}×${city.naturalHeight}`,
        decodedImagesMB: round(decoded / 1048576, 1),
        gpuTotalMB: round((decoded + vw * vh * devicePixelRatio ** 2 * 4 * 5) / 1048576, 1),
      };
    },
    hud: () => [],
    dispose() {},
  };
}
