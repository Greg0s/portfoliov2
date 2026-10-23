// Frame-time recorder and on-screen readout shared by every test.
// A test reports each frame with `meter.frame(now)` and switches phases with `meter.phase(name)`; the runner reads the
// summary with `meter.result()`.

const MB = 1024 * 1024;

export function createMeter() {
  const phases = new Map();
  let current = null;
  let last = 0;
  const recent = [];

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = '<div class="hud-fps"><b>--</b> i/s</div><canvas width="160" height="40"></canvas><div class="hud-lines"></div>';
  document.body.appendChild(hud);
  const fpsEl = hud.querySelector('b');
  const lines = hud.querySelector('.hud-lines');
  const graph = hud.querySelector('canvas').getContext('2d');
  let lastHud = 0;
  let extra = () => [];

  function phase(name) {
    if (name === current) return;
    current = name;
    if (!phases.has(name)) phases.set(name, []);
    last = 0;
  }

  function frame(now) {
    if (last && current) {
      const dt = now - last;
      phases.get(current).push(dt);
      recent.push(dt);
      if (recent.length > 160) recent.shift();
    }
    last = now;
    if (now - lastHud > 250) {
      lastHud = now;
      drawHud();
    }
  }

  function drawHud() {
    const window1s = recent.slice(-60);
    const mean = window1s.reduce((a, b) => a + b, 0) / (window1s.length || 1);
    fpsEl.textContent = window1s.length ? Math.round(1000 / mean) : '--';
    graph.clearRect(0, 0, 160, 40);
    graph.fillStyle = 'rgba(255,255,255,0.12)';
    graph.fillRect(0, 40 - (16.7 / 50) * 40, 160, 1);
    recent.forEach((dt, i) => {
      const h = Math.min(40, (dt / 50) * 40);
      graph.fillStyle = dt > 25 ? '#ff7a50' : dt > 18 ? '#f2c14e' : '#9fe0b0';
      graph.fillRect(i, 40 - h, 1, h);
    });
    const heap = jsHeapMB();
    lines.textContent = [current ?? '', heap ? `JS ${heap.toFixed(0)} Mo` : '', ...extra()].filter(Boolean).join('\n');
  }

  function result() {
    const out = {};
    for (const [name, dts] of phases) out[name] = summarize(dts);
    return out;
  }

  return {
    phase,
    frame,
    result,
    setExtra: (fn) => (extra = fn),
    remove: () => hud.remove(),
  };
}

export function summarize(dts) {
  if (!dts.length) return { frames: 0 };
  const sorted = [...dts].sort((a, b) => a - b);
  const total = dts.reduce((a, b) => a + b, 0);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    frames: dts.length,
    seconds: round(total / 1000, 1),
    fps: round((1000 * dts.length) / total, 1),
    medianMs: round(pick(0.5), 1),
    p95Ms: round(pick(0.95), 1),
    p99Ms: round(pick(0.99), 1),
    worstMs: round(sorted[sorted.length - 1], 1),
    // Frames that missed the 60 Hz deadline by more than half a frame.
    slowPct: round((100 * dts.filter((d) => d > 25).length) / dts.length, 1),
  };
}

export function jsHeapMB() {
  return performance.memory ? performance.memory.usedJSHeapSize / MB : null;
}

export const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

// The display's refresh interval: the median of a second of empty frames.
export function measureRefresh(ms = 1000) {
  return new Promise((resolve) => {
    const dts = [];
    let last = 0;
    const start = performance.now();
    const step = (now) => {
      if (last) dts.push(now - last);
      last = now;
      if (now - start < ms) requestAnimationFrame(step);
      else {
        dts.sort((a, b) => a - b);
        resolve(1000 / dts[Math.floor(dts.length / 2)]);
      }
    };
    requestAnimationFrame(step);
  });
}

// ---------- GPU memory estimates ----------

// Bytes of one texture as uploaded (RGBA8, plus a third for mipmaps when the texture has them).
export function textureBytes(t) {
  const img = t.image;
  if (!img) return 0;
  const w = img.videoWidth || img.width || 0;
  const h = img.videoHeight || img.height || 0;
  const mips = t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1;
  const faces = Array.isArray(img) ? img.length : 1;
  return w * h * 4 * mips * faces;
}

// Geometry buffers and textures reachable from the given scenes, counted once each.
export function sceneGpuBytes(scenes) {
  const geos = new Set();
  const texs = new Set();
  for (const scene of scenes) {
    scene.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && v.isTexture) texs.add(v);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) texs.add(u.value);
      }
    });
    if (scene.environment) texs.add(scene.environment);
  }
  let geometry = 0;
  for (const g of geos) {
    for (const a of Object.values(g.attributes)) geometry += a.array.byteLength;
    if (g.index) geometry += g.index.array.byteLength;
    if (g.isInstancedBufferGeometry) geometry += 0;
  }
  let textures = 0;
  for (const t of texs) textures += textureBytes(t);
  return { geometryMB: round(geometry / MB, 1), texturesMB: round(textures / MB, 1), geometries: geos.size, textures: texs.size };
}

// The drawing buffer (colour + depth, multisampled when antialiased) and the shadow maps.
export function framebufferMB(renderer, shadowMaps = []) {
  const c = renderer.domElement;
  const samples = renderer.getContext().getContextAttributes()?.antialias ? 4 : 1;
  const screen = c.width * c.height * 8 * samples + c.width * c.height * 4;
  const shadows = shadowMaps.reduce((s, size) => s + size * size * 4, 0);
  return round((screen + shadows) / MB, 1);
}
