/**
 * The light-speed jump on the way to the office (office spec §5), drawn on a 2D canvas: the stars stretch into streaks
 * that rush toward the planet while the camera backs away at full speed, then shrink back to points and go out before
 * the sky appears. Depth cycles keep the field full; the tail of each streak is where its star was a moment before,
 * so streaks are longest at the edges, and they fade toward the tail like light trails. A glow, a core and a flash
 * mark the jump, with an anamorphic flare: a long bluish streak across the planet, as through a cinema lens. From the
 * mockup's SVG, drawn the same way.
 */
import type { ArrivalState } from './arrival';
import type { FrameSpec } from './frame';

export interface JumpStar {
  /** Direction around the planet, place in the cycle of depths, width and tone. */
  a: number;
  z: number;
  w: number;
  tone: number;
}

/** The jump's stars, from the mockup's seeded draws. */
export function jumpStars(rand: () => number, count: number): JumpStar[] {
  const stars: JumpStar[] = [];
  for (let k = 0; k < count; k += 1) {
    const a = rand() * Math.PI * 2;
    const z = rand();
    const w = rand() < 0.08 ? 2.2 + rand() : 0.7 + rand() * 1.3;
    const tone = rand() < 0.14 ? 2 : rand() < 0.4 ? 1 : 0;
    stars.push({ a, z, w, tone });
  }
  return stars;
}

const TONES = ['255, 255, 255', '214, 208, 255', '165, 155, 255'] as const;
const CUT = [0, 0.3, 0.65, 1] as const;
const FADE = [1, 0.5, 0.18] as const;

/** A radial glow centred on (x, y), of diameter d, from CSS-like stops. */
function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  d: number,
  opacity: number,
  stops: readonly (readonly [number, string])[],
): void {
  if (opacity <= 0.001) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, d / 2);
  stops.forEach(([at, color]) => {
    gradient.addColorStop(at, color);
  });
  ctx.globalAlpha = opacity;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - d / 2, y - d / 2, d, d);
  ctx.globalAlpha = 1;
}

/** Draws the jump in frame px (the context is already placed on the frame). */
export function drawJump(
  ctx: CanvasRenderingContext2D,
  stars: readonly JumpStar[],
  frame: FrameSpec,
  state: ArrivalState,
): void {
  const { v, travel, burst } = state.jump;
  const [px, py] = frame.planet;
  const mob = frame.w < 768;
  // The glow around the planet, under the streaks.
  const glowD = mob ? 300 : 500;
  round(ctx, px, py, glowD, 0.45 * v, [
    [0, 'rgba(232, 228, 255, 0.5)'],
    [0.34, 'rgba(170, 160, 255, 0.16)'],
    [0.7, 'rgba(150, 140, 255, 0)'],
  ]);
  const C = Math.hypot(frame.w, frame.h) * 0.75;
  const bins = new Map<string, Path2D>();
  const halo = new Path2D();
  let haloUsed = false;
  for (const st of stars) {
    const z = 1 + 11 * ((st.z + travel * 9) % 1);
    const zn = (z - 1) / 11;
    const rh = C / z;
    const rt = C / Math.max(0.3, z - v * 1.3) + st.w * 1.2;
    const hw = (st.w * (0.35 + 1.15 * (1 - zn))) / 2;
    const ca = Math.cos(st.a);
    const sa = Math.sin(st.a);
    const at = (r: number, w: number): [number, number] => [px + r * ca - sa * w, py + r * sa + ca * w];
    const depth = zn < 0.45 ? 'n' : 'f';
    for (let k = 0; k < 3; k += 1) {
      const c0 = CUT[k] ?? 0;
      const c1 = CUT[k + 1] ?? 1;
      const r0 = rh + (rt - rh) * c0;
      const r1 = rh + (rt - rh) * c1;
      const w0 = hw * (1 - c0);
      const w1 = hw * (1 - c1);
      const key = `${String(st.tone)}${depth}${String(k)}`;
      let path = bins.get(key);
      if (!path) {
        path = new Path2D();
        bins.set(key, path);
      }
      if (k === 0) {
        path.moveTo(...at(rh - hw, 0));
        path.lineTo(...at(r0, w0));
      } else {
        path.moveTo(...at(r0, w0));
      }
      path.lineTo(...at(r1, w1));
      path.lineTo(...at(r1, -w1));
      path.lineTo(...at(r0, -w0));
      path.closePath();
    }
    if (zn < 0.3) {
      haloUsed = true;
      halo.moveTo(...at(rh, hw * 3));
      halo.lineTo(...at(rh + (rt - rh) * 0.7, 0));
      halo.lineTo(...at(rh, -hw * 3));
      halo.closePath();
    }
  }
  if (haloUsed) {
    ctx.fillStyle = `rgba(170, 160, 255, ${(0.1 * v).toFixed(3)})`;
    ctx.fill(halo);
  }
  const bright = 0.35 + 0.65 * v;
  for (const [key, path] of bins) {
    const a = (key[1] === 'n' ? 0.9 : 0.2) * (FADE[Number(key[2])] ?? 1) * bright;
    ctx.fillStyle = `rgba(${TONES[Number(key[0])] ?? TONES[0]}, ${a.toFixed(3)})`;
    ctx.fill(path);
  }
  // The core of light on the planet, the flash, and the flare.
  round(ctx, px, py, mob ? 40 : 56, 0.75 * v, [
    [0, 'rgba(255, 255, 255, 0.95)'],
    [0.3, 'rgba(235, 232, 255, 0.45)'],
    [0.7, 'rgba(220, 215, 255, 0)'],
  ]);
  round(ctx, px, py, Math.hypot(frame.w, frame.h) * 1.2, 0.24 * burst, [
    [0, 'rgba(255, 255, 255, 0.85)'],
    [0.14, 'rgba(228, 224, 255, 0.32)'],
    [0.36, 'rgba(200, 192, 255, 0.08)'],
    [0.62, 'rgba(200, 192, 255, 0)'],
  ]);
  const flare = Math.min(1, burst + 0.28 * v);
  if (flare > 0.001) {
    const w = frame.flare;
    const left = px - w / 2;
    ctx.globalAlpha = flare;
    // The soft band: an ellipse, blurred.
    const band = ctx.createLinearGradient(left, 0, left + w, 0);
    band.addColorStop(0, 'rgba(90, 140, 255, 0)');
    band.addColorStop(0.3, 'rgba(110, 160, 255, 0.35)');
    band.addColorStop(0.5, 'rgba(170, 205, 255, 0.6)');
    band.addColorStop(0.7, 'rgba(110, 160, 255, 0.35)');
    band.addColorStop(1, 'rgba(90, 140, 255, 0)');
    ctx.filter = 'blur(5px)';
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.ellipse(px, py, w / 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    // The thin bright line.
    const line = ctx.createLinearGradient(left + w * 0.06, 0, left + w * 0.94, 0);
    line.addColorStop(0, 'rgba(120, 170, 255, 0)');
    line.addColorStop(0.35, 'rgba(150, 195, 255, 0.85)');
    line.addColorStop(0.5, 'rgba(245, 250, 255, 1)');
    line.addColorStop(0.65, 'rgba(150, 195, 255, 0.85)');
    line.addColorStop(1, 'rgba(120, 170, 255, 0)');
    ctx.fillStyle = line;
    ctx.fillRect(left + w * 0.06, py - 1, w * 0.88, 2);
    ctx.globalAlpha = 1;
  }
}
