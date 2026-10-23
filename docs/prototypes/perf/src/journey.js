// The journey through the projects: the planet live in Three.js, three layers of stars, the small worlds and the eight
// cards with their depth of field, driven by a scripted camera that stops on every anchor (journey spec §4 and §5).
// Two ways to draw the cards (main spec §7.4):
// - `css`: HTML cards in CSS 3D over the scene, blurred with `filter: blur()`, as in the mockup;
// - `webgl`: textured planes in one WebGL canvas, blurred in the shader, the planet drawn into a texture.
// Only the sharp card plays its video; the others show their still image.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createPlanet } from './planet.js';
import { sceneGpuBytes, framebufferMB, round } from './meter.js';

// Journey spec §5: side offset and vertical offset (fractions of the screen), sharp width, rotations Y and Z.
const TAG = '2024 — Three.js · génératif'; // the mockup's example tag
const PROJECTS = [
  ['La Fabrique des Mondes', -0.27, -0.06, 0.38, 12, -1.5],
  ['What we play?', 0.25, 0.08, 0.32, -10, 2],
  ['Littérature & Combinatoire', -0.3, 0.1, 0.34, 9, 1],
  ['SNCF Wrapped', 0.28, -0.09, 0.3, -12, -2],
  ['Recoding', -0.24, -0.02, 0.36, 11, 1.5],
  ['Lyrix', 0.31, 0.05, 0.33, -9, -1],
  ['Le Petit Prince', -0.29, 0.12, 0.31, 10, 2],
  ['Obaine', 0.26, -0.07, 0.35, -11, -1.5],
];

// The planet's web model. Artifacts only serve web file types, so the build copies the .glb under a .wasm name (a
// binary type); the loader reads the bytes whatever the name.
const MODEL = 'models/petit-prince-glb.wasm';
const P = 1000; // CSS perspective, px
const L = 0.9; // distance travelled between two anchors, in focus distances
const DWELL = 1.3;
const TRAVEL = 1.2;
const OPENING = 2;
const ANCHORS = 10; // opening, eight projects, contact
const MAX_BLUR = 12;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Camera progress, in anchors, at time t.
function progress(t) {
  if (t < OPENING) return 0;
  const s = t - OPENING;
  const step = Math.floor(s / (TRAVEL + DWELL));
  const r = s - step * (TRAVEL + DWELL);
  return Math.min(ANCHORS - 1, step + ease(Math.min(1, r / TRAVEL)));
}
const DURATION = OPENING + (ANCHORS - 1) * (TRAVEL + DWELL);

// Depth of field: sharp within ±10 % of the focus distance, then blur up to 12 px and fade toward 0.25.
function focus(dist) {
  const off = Math.max(0, Math.abs(dist - 1) - 0.1);
  const blur = Math.min(MAX_BLUR, off * 18);
  const fadeIn = clamp((dist - 0.3) / 0.25, 0, 1);
  const fadeOut = dist > 1 ? 1 - 0.75 * clamp((dist - 1.1) / 2.2, 0, 1) : 1;
  return { blur, opacity: fadeIn * fadeOut, sharp: Math.abs(dist - 1) < 0.12 };
}

const BLUR_SHADER = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform vec2 size;      // card size in px
    uniform float radius;   // corner radius in px
    uniform float blur;     // blur radius in uv
    uniform float opacity;
    uniform float ring;     // 0..1, the white ring of the sharp card
    uniform float round_;   // 1: rounded rectangle, 0: soft disc (the planet)
    varying vec2 vUv;
    void main() {
      vec3 c = vec3(0.0);
      if (blur < 0.0005) c = texture2D(map, vUv).rgb;
      else {
        // 16 taps on a golden-angle spiral.
        for (int i = 0; i < 16; i++) {
          float r = sqrt((float(i) + 0.5) / 16.0) * blur;
          float a = float(i) * 2.39996;
          c += texture2D(map, vUv + vec2(cos(a), sin(a) * size.x / size.y) * r).rgb;
        }
        c /= 16.0;
      }
      float alpha;
      if (round_ > 0.5) {
        vec2 p = (vUv - 0.5) * size;
        vec2 q = abs(p) - size * 0.5 + radius;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
        alpha = clamp(0.5 - d, 0.0, 1.0);
        c = mix(c, vec3(1.0), ring * 0.55 * clamp(1.0 - abs(d + 0.5), 0.0, 1.0));
      } else {
        alpha = 1.0 - smoothstep(0.36, 0.5, length(vUv - 0.5));
      }
      gl_FragColor = vec4(c, alpha * opacity);
    }`,
};

export async function setup({ stage, mobile, moment, variant, params, timings }) {
  // Diagnostic switches: leave out the stars, the small worlds or the videos.
  const withStars = params.get('stars') !== '0';
  const withWorlds = params.get('worlds') !== '0';
  const withVideo = params.get('video') !== '0';
  const vw = stage.clientWidth;
  const vh = stage.clientHeight;
  const webgl = variant === 'webgl';
  const dpr = Math.min(devicePixelRatio, mobile ? 1.5 : 2);
  stage.classList.add('journey');

  // ---------- Stars and small worlds (HTML in both variants) ----------
  const starLayers = [60, 40, 20].map((n, li) => {
    const layer = document.createElement('div');
    layer.className = 'stars';
    for (let i = 0; i < (withStars ? n : 0); i++) {
      const s = document.createElement('i');
      s.className = 'star';
      s.style.left = Math.random() * 140 - 20 + '%';
      s.style.top = Math.random() * 140 - 20 + '%';
      s.style.animationDuration = 2.5 + Math.random() * 4.5 + 's';
      s.style.animationDelay = -Math.random() * 7 + 's';
      if (li === 2) s.classList.add('big');
      layer.append(s);
    }
    stage.append(layer);
    return { el: layer, rate: [0.25, 0.5, 1][li] };
  });
  const worlds = [];
  const worldCount = withWorlds ? (mobile ? 16 : 21) : 0;
  for (let i = 0; i < worldCount; i++) {
    const el = document.createElement('div');
    el.className = 'world w' + (i % 4);
    stage.append(el);
    const side = Math.random() < 0.5 ? -1 : 1;
    worlds.push({ el, at: 0.6 + (i / worldCount) * 8.4, x: side * (0.15 + Math.random() * 0.3) * vw, y: (Math.random() - 0.5) * 0.8 * vh, size: 14 + Math.random() * 26, alpha: 0.5 + Math.random() * 0.25 });
  }

  // ---------- Cards ----------
  const cardLayer = document.createElement('div');
  cardLayer.className = 'cards';
  if (!webgl) stage.append(cardLayer);
  const cards = PROJECTS.map(([title, x, y, width, ry, rz], i) => {
    const w = (mobile ? 0.78 : width) * vw;
    const clip = 'abc'[i % 3];
    const card = { title, tag: TAG, at: i + 1, x: (mobile ? (i % 2 ? 0.06 : -0.06) : x) * vw, y: (mobile ? -0.08 : y) * vh, w, h: (w * 9) / 16, ry: mobile ? ry / 3 : ry, rz, clip, playing: false };
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.src = `media/clip-${clip}.mp4`;
    card.video = video;
    if (!webgl) {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.width = w + 'px';
      el.style.height = card.h + 'px';
      const img = document.createElement('img');
      img.src = `media/clip-${clip}.webp`;
      img.alt = '';
      el.append(img, video);
      cardLayer.append(el);
      card.el = el;
    }
    return card;
  });
  const cartel = document.createElement('div');
  cartel.className = 'cartel';
  cartel.innerHTML = '<h2></h2><p class="tag"></p><p>Une description courte du projet, sur deux lignes.</p>';
  stage.append(cartel);

  // ---------- Renderer and planet ----------
  const planetPx = mobile ? Math.min(vw * 0.9, 360) : 600;
  const renderer = new THREE.WebGLRenderer({ antialias: !webgl, alpha: webgl, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (webgl) {
    renderer.setSize(vw, vh);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'gl';
  } else {
    renderer.setSize(planetPx, planetPx);
    renderer.domElement.className = 'planet-canvas';
  }
  stage.append(renderer.domElement);

  let t0 = performance.now();
  const planet = await createPlanet({ renderer, url: MODEL, moment, mobile });
  timings.buildPlanetMs = round(performance.now() - t0);

  const target = webgl ? new THREE.WebGLRenderTarget(planetPx * dpr, planetPx * dpr, { type: THREE.HalfFloatType }) : null;
  const composer = new EffectComposer(renderer, target ?? undefined);
  if (webgl) composer.setSize(planetPx, planetPx);
  composer.renderToScreen = !webgl;
  composer.addPass(new RenderPass(planet.scene, planet.camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(planetPx, planetPx), 0.25, 0.2, 0.92));
  composer.addPass(new OutputPass());

  const dot = document.createElement('div');
  dot.className = 'planet-dot';
  stage.append(dot);

  // WebGL variant: one scene of planes, seen by a camera that matches the CSS perspective.
  let glScene;
  let glCamera;
  let planetPlane;
  if (webgl) {
    glScene = new THREE.Scene();
    glCamera = new THREE.PerspectiveCamera((2 * Math.atan(vh / 2 / P) * 180) / Math.PI, vw / vh, 1, 20000);
    const quad = new THREE.PlaneGeometry(1, 1);
    const material = (map, w, h, round_) =>
      new THREE.ShaderMaterial({
        ...BLUR_SHADER,
        uniforms: { map: { value: map }, size: { value: new THREE.Vector2(w, h) }, radius: { value: 20 }, blur: { value: 0 }, opacity: { value: 1 }, ring: { value: 0 }, round_: { value: round_ } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
    const loader = new THREE.TextureLoader();
    const stills = Object.fromEntries(['a', 'b', 'c'].map((c) => [c, loader.load(`media/clip-${c}.webp`)]));
    for (const card of cards) {
      card.still = stills[card.clip];
      card.videoTexture = new THREE.VideoTexture(card.video);
      card.mesh = new THREE.Mesh(quad, material(card.still, card.w, card.h, 1));
      card.mesh.scale.set(card.w, card.h, 1);
      card.mesh.rotation.set(0, (-card.ry * Math.PI) / 180, (-card.rz * Math.PI) / 180);
      glScene.add(card.mesh);
    }
    planetPlane = new THREE.Mesh(quad, material(composer.readBuffer.texture, planetPx, planetPx, 0));
    planetPlane.scale.set(planetPx, planetPx, 1);
    planetPlane.renderOrder = -1;
    glScene.add(planetPlane);
  }

  // The planet's place: at the opening, on the left at 600 px (at the top on mobile); it recedes toward the centre.
  const planetAt = mobile ? { x: 0, y: -0.24 * vh } : { x: -0.22 * vw, y: 0 };
  let planetLive = true;

  // Where an object at `dist` focus distances lands: CSS translateZ, scale and screen position.
  const place = (dist) => ({ z: P - P * dist, scale: 1 / dist });

  let lastP = -1;
  let planetFrames = 0;
  return {
    duration: DURATION,
    phaseAt: (t) => (progress(t) < 1 ? 'ouverture' : 'projets'),
    frame(t) {
      const p = progress(t);

      // Planet: distance 1 at the opening, then it recedes much faster than the cards.
      const pd = 1 + p * 2.6;
      const pf = focus(Math.min(pd, 1 + p * 0.9));
      const ps = 1 / pd;
      planetLive = ps > 0.14;
      if (planetLive) {
        planet.update(t);
        if (webgl) {
          renderer.setRenderTarget(null);
          composer.render();
          planetFrames++;
          planetPlane.visible = true;
          planetPlane.position.set(planetAt.x, -planetAt.y, -P * pd);
          planetPlane.material.uniforms.blur.value = pf.blur / (planetPx / pd);
          planetPlane.material.uniforms.map.value = composer.readBuffer.texture;
        } else {
          composer.render();
          planetFrames++;
          const c = renderer.domElement;
          c.style.display = '';
          c.style.transform = `translate(-50%,-50%) translate3d(${planetAt.x * ps}px, ${planetAt.y * ps}px, 0) scale(${ps})`;
          c.style.filter = pf.blur > 0.3 ? `blur(${(pf.blur / ps).toFixed(1)}px)` : 'none';
        }
        dot.style.opacity = '0';
      } else {
        if (webgl) planetPlane.visible = false;
        else renderer.domElement.style.display = 'none';
        dot.style.opacity = '0.8';
      }

      // Stars recede toward the centre, the nearest layers faster.
      if (p !== lastP) {
        for (const s of starLayers) s.el.style.transform = `scale(${(1 / (1 + p * 0.12 * s.rate)).toFixed(4)})`;
        for (const w of worlds) {
          const dist = 1 + (p - w.at) * L;
          if (dist < 0.3 || dist > 7) {
            w.el.style.display = 'none';
            continue;
          }
          const f = focus(dist);
          const { z } = place(dist);
          w.el.style.display = '';
          w.el.style.width = w.el.style.height = w.size + 'px';
          w.el.style.opacity = (f.opacity * w.alpha).toFixed(3);
          w.el.style.transform = `translate(-50%,-50%) translate3d(${w.x}px, ${w.y}px, ${z}px)`;
          w.el.style.filter = f.blur > 0.3 ? `blur(${(f.blur * dist).toFixed(1)}px)` : 'none';
        }
      }

      // Cards.
      let sharp = null;
      for (const card of cards) {
        const dist = 1 + (p - card.at) * L;
        const visible = dist > 0.3 && dist < 7;
        const f = focus(dist);
        const play = withVideo && visible && Math.abs(dist - 1) < 0.35;
        if (play !== card.playing) {
          card.playing = play;
          if (play) card.video.play().catch(() => {});
          else card.video.pause();
          if (webgl) card.mesh.material.uniforms.map.value = play ? card.videoTexture : card.still;
          else card.el.classList.toggle('playing', play);
        }
        if (f.sharp && visible) sharp = card;
        if (webgl) {
          card.mesh.visible = visible;
          if (!visible) continue;
          const u = card.mesh.material.uniforms;
          card.mesh.position.set(card.x, -card.y, -P * dist);
          u.blur.value = f.blur / (card.w / dist);
          u.opacity.value = f.opacity;
          u.ring.value = f.sharp ? 1 : 0;
        } else {
          card.el.style.display = visible ? '' : 'none';
          if (!visible) continue;
          const { z } = place(dist);
          card.el.style.transform = `translate(-50%,-50%) translate3d(${card.x}px, ${card.y}px, ${z.toFixed(1)}px) rotateY(${card.ry}deg) rotateZ(${card.rz}deg)`;
          card.el.style.opacity = f.opacity.toFixed(3);
          card.el.style.filter = f.blur > 0.3 ? `blur(${(f.blur * dist).toFixed(1)}px)` : 'none';
          card.el.classList.toggle('sharp', f.sharp);
        }
      }
      if (sharp) {
        cartel.querySelector('h2').textContent = sharp.title;
        cartel.querySelector('.tag').textContent = sharp.tag;
        const side = mobile ? 0 : sharp.x < 0 ? 1 : -1;
        cartel.style.transform = mobile ? `translate(-50%, ${(sharp.y + sharp.h / 2 + 24).toFixed(0)}px)` : `translate(${side > 0 ? sharp.x + sharp.w / 2 + 40 : sharp.x - sharp.w / 2 - 340}px, ${sharp.y - 60}px)`;
      }
      cartel.classList.toggle('on', !!sharp);

      if (webgl) {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(glScene, glCamera);
      }
      lastP = p;
    },
    stats() {
      const gpu = sceneGpuBytes(webgl ? [planet.scene, glScene] : [planet.scene]);
      const fb = framebufferMB(renderer, planet.shadowMaps);
      const rt = round((planetPx * dpr) ** 2 * 8 * 3 / 1048576, 1); // composer and bloom targets, roughly
      const videoMB = round((1280 * 720 * 4 * 3) / 1048576, 1);
      return {
        cards: variant,
        planetSize: `${planetPx} px`,
        planetFrames,
        ...gpu,
        framebufferMB: fb,
        postprocessMB: rt,
        gpuTotalMB: round(gpu.geometryMB + gpu.texturesMB + fb + rt + videoMB, 1),
        pixelRatio: renderer.getPixelRatio(),
      };
    },
    hud: () => [planetLive ? 'planète en direct' : 'planète arrêtée'],
    dispose() {
      for (const c of cards) {
        c.video.pause();
        c.video.removeAttribute('src');
        c.video.load();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
