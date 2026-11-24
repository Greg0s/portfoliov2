/**
 * The planet in loops (the performance analysis of 23 November 2026, behind `?planete=images`): instead of the live
 * scene, its rest pose as a still image, and the four parts the wind moves (the scarf, the fox's ears and tail, the
 * rose) as short looping videos, rendered at build from the same scene (`scripts/render-planet-loops.ts`). No model,
 * no Three.js, no shaders to compile: a WebGL 2 canvas lays each video's rectangle over the still, its edge faded into
 * it, and the GPU only copies pictures. The wind's gusts quicken the videos as they quickened the scene.
 *
 * The scarf loads first and settles the planet: it moves as soon as it shows (Grégoire, 24 November 2026). The other
 * parts join as their videos arrive, from their first frame, which is the still's pose: nothing jumps.
 *
 * Each video stacks the part's colour, premultiplied by its alpha, over its alpha in grey, in AV1 without chroma
 * subsampling. Where AV1 in 4:4:4 does not play (Safari), the live planet stays.
 */
import { LOOPS, createWind } from './wind';
import manifest from './loops.json';

type Part = keyof typeof LOOPS;

interface LoopPart {
  name: Part;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LoopSet {
  size: number;
  base: string;
  feather: number;
  parts: LoopPart[];
}

const SETS = manifest as unknown as Record<'desktop' | 'mobile', LoopSet>;
/** AV1, high profile (4:4:4), 8 bits. */
const CODEC = 'video/mp4; codecs="av01.1.04M.08.0.000"';
/** How long without a draw before the videos pause: the journey stopped drawing the planet. */
const IDLE = 250;

export interface PlanetLoops {
  canvas: HTMLCanvasElement;
  render(delta: number): void;
  resize(size: number, mobile: boolean): void;
  linksSlowly: boolean;
  isLost(): boolean;
  whenLost(callback: (() => void) | null): void;
  dispose(): void;
}

export interface LoopsOptions {
  /** Where the loops are served, with a trailing slash. */
  base: string;
  /** The planet's size on screen, in CSS px. */
  size: number;
  /** Only the scarf moves (`?planete=echarpe`). */
  scarfOnly?: boolean;
}

/** Thrown where the loops cannot play: the live planet stays. */
export class NoLoops extends Error {}

/** Whether this browser plays the loops smoothly: AV1 in 4:4:4, and WebGL 2. */
export async function loopsPlay(): Promise<boolean> {
  const probe = document.createElement('video');
  if (!probe.canPlayType(CODEC)) return false;
  if (!('mediaCapabilities' in navigator)) return true;
  try {
    const info = await navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      video: { contentType: CODEC, width: 400, height: 500, bitrate: 400_000, framerate: 30 },
    });
    return info.supported && info.smooth;
  } catch {
    return true;
  }
}

/** The set whose pixels this screen shows: the smaller one as long as it is sharp enough. */
function setFor(size: number): LoopSet {
  const needed = size * Math.min(window.devicePixelRatio || 1, 2);
  return needed <= SETS.mobile.size * 1.05 ? SETS.mobile : SETS.desktop;
}

const VERTEX = `#version 300 es
in vec2 corner;
uniform vec4 rect;
uniform float size;
void main() {
  vec2 clip = (rect.xy + corner * rect.zw) / size * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

// The still under everything; over it, a part's rectangle replaces it, faded in over its edge (still pixels on both
// sides), so that no seam shows. Colours stay premultiplied, as the canvas takes them.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D still;
uniform sampler2D loop;
uniform vec4 rect;
uniform float size;
uniform float feather;
uniform bool onlyStill;
out vec4 color;
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), int(size) - 1 - int(gl_FragCoord.y));
  vec4 below = texelFetch(still, p, 0);
  if (onlyStill) {
    color = below;
    return;
  }
  ivec2 local = p - ivec2(rect.xy);
  // The alpha lies below the colour, a rectangle's height (rect.w) further down.
  vec3 rgb = texelFetch(loop, local, 0).rgb;
  float alpha = texelFetch(loop, local + ivec2(0, int(rect.w)), 0).r;
  vec2 edge = min(vec2(local) + 0.5, rect.zw - vec2(local) - 0.5);
  float weight = clamp(min(edge.x, edge.y) / feather, 0.0, 1.0);
  color = mix(below, vec4(min(rgb, vec3(alpha)), alpha), weight);
}`;

interface Loop {
  part: LoopPart;
  video: HTMLVideoElement;
  texture: WebGLTexture;
  /** Whether it plays: its frames replace the still. */
  ready: boolean;
  /** Whether a frame came since the last upload. */
  fresh: boolean;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new NoLoops('No shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function texture(gl: WebGL2RenderingContext): WebGLTexture {
  const made = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, made);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return made;
}

/** A looping video, muted, ready to play from its first frame. */
function loadVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    video.addEventListener(
      'canplaythrough',
      () => {
        resolve(video);
      },
      { once: true },
    );
    video.addEventListener(
      'error',
      () => {
        reject(new NoLoops(`The loop ${src} does not play.`));
      },
      { once: true },
    );
    video.src = src;
    video.load();
  });
}

export async function createLoops(container: HTMLElement, options: LoopsOptions): Promise<PlanetLoops> {
  const set = setFor(options.size);
  const parts = options.scarfOnly ? set.parts.filter((part) => part.name === 'scarf') : set.parts;
  const [first, ...others] = parts;
  if (!first) throw new NoLoops('No loops.');

  const still = new Image();
  still.src = `${options.base}${set.base}`;
  // The scarf comes with the still: the planet shows moving.
  const [firstVideo] = await Promise.all([loadVideo(`${options.base}${first.src}`), still.decode()]);

  const canvas = document.createElement('canvas');
  canvas.className = 'planet-canvas';
  canvas.width = set.size;
  canvas.height = set.size;
  canvas.style.cssText = 'width: 100%; height: 100%';
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) throw new NoLoops('No WebGL 2.');

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new NoLoops(gl.getProgramInfoLog(program) ?? 'No link.');
  gl.useProgram(program);
  const at = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const uniforms = {
    rect: at('rect'),
    size: at('size'),
    feather: at('feather'),
    onlyStill: at('onlyStill'),
  };
  gl.uniform1i(at('still'), 0);
  gl.uniform1i(at('loop'), 1);
  gl.uniform1f(uniforms.size, set.size);
  gl.uniform1f(uniforms.feather, set.feather);

  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  texture(gl);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, still);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.activeTexture(gl.TEXTURE1);

  const wind = createWind();
  let rate = 1;
  let playing = false;
  let disposed = false;
  // Read after an await, where the compiler takes it for the value before.
  const gone = (): boolean => disposed;
  let lost = false;
  let onLost: (() => void) | null = null;
  let idle = 0;
  let drawn = false;

  const loops: Loop[] = [];
  const watch = (loop: Loop): void => {
    const { video } = loop;
    if (!('requestVideoFrameCallback' in video)) return;
    const next = (): void => {
      if (disposed) return;
      loop.fresh = true;
      video.requestVideoFrameCallback(next);
    };
    video.requestVideoFrameCallback(next);
  };
  const join = (part: LoopPart, video: HTMLVideoElement): void => {
    if (disposed) return;
    video.playbackRate = rate;
    const loop: Loop = { part, video, texture: texture(gl), ready: true, fresh: true };
    loops.push(loop);
    watch(loop);
    if (playing) void video.play().catch(() => undefined);
  };
  join(first, firstVideo);
  // The others, one after the other: the scarf first, then the ears and the tail, which move most, then the rose.
  void (async () => {
    for (const part of others) {
      if (gone()) return;
      try {
        join(part, await loadVideo(`${options.base}${part.src}`));
      } catch {
        // Its part keeps the still's pose.
      }
    }
  })();

  const pause = (): void => {
    playing = false;
    for (const { video } of loops) video.pause();
  };

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    pause();
    onLost?.();
  });

  const draw = (): void => {
    gl.viewport(0, 0, set.size, set.size);
    gl.uniform1i(uniforms.onlyStill, 1);
    gl.uniform4f(uniforms.rect, 0, 0, set.size, set.size);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.uniform1i(uniforms.onlyStill, 0);
    for (const loop of loops) {
      if (!loop.ready || loop.video.readyState < 2) continue;
      gl.bindTexture(gl.TEXTURE_2D, loop.texture);
      if (loop.fresh || !('requestVideoFrameCallback' in loop.video)) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, loop.video);
        loop.fresh = false;
      }
      const { x, y, w, h } = loop.part;
      gl.uniform4f(uniforms.rect, x, y, w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  container.append(canvas);
  draw();

  return {
    canvas,
    render(delta) {
      if (disposed || lost) return;
      if (delta > 0) {
        wind.advance(delta);
        const gust = wind.rate();
        if (Math.abs(gust - rate) > 0.01) {
          rate = gust;
          for (const { video } of loops) video.playbackRate = rate;
        }
        if (!playing) {
          playing = true;
          for (const { video } of loops) void video.play().catch(() => undefined);
        }
        window.clearTimeout(idle);
        idle = window.setTimeout(pause, IDLE);
      }
      // A WebGL canvas not drawn to keeps what it shows: drawn again only when a video brought a frame.
      if (!drawn || loops.some((loop) => loop.fresh || !('requestVideoFrameCallback' in loop.video))) {
        draw();
        drawn = true;
      }
    },
    resize() {
      // Drawn at the set's size, laid out at the planet's by CSS.
    },
    linksSlowly: false,
    isLost: () => lost,
    whenLost(callback) {
      onLost = callback;
    },
    dispose() {
      disposed = true;
      window.clearTimeout(idle);
      for (const { video } of loops) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
