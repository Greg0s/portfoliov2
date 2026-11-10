/**
 * The ring's sky (`showcase.ts`): its dust, its line and its small bodies, drawn on a canvas. Two painters draw the
 * same picture: one in WebGL, the other on a 2D context, for a browser without WebGL 2 (or with `?ciel=2d`).
 *
 * Why WebGL: Firefox on a phone (a Mali-T760, 10 November 2026) drew the ring at 27 to 35 frames a second with the
 * sky on 2D canvases, whatever their resolution, and at 40 to 45 without them, while the stars' WebGL canvas, as
 * large and redrawn as often, cost next to nothing. The 900 grains of a frame are 900 small fills for a 2D context,
 * one draw for the GPU.
 *
 * The WebGL painter reproduces the 2D context's drawing: a grain is a square covering its pixels by their area, the
 * line a band one unit wide, a body its two radial gradients (the canvas's, interpolated without premultiplying), the
 * strokes and fills composited one over the other, all in premultiplied colours as the canvas composites them.
 */
import { cssRgb, type Rgb } from '../accent';

export type BodyKind = 'orb' | 'ringed' | 'moon';

/** A box in the sky's own px (at the stop, before the approach's zoom). */
export interface SkyBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Draws the sky's parts; the coordinates are the sky's px, mapped onto the canvas's device px as `begin` says. The
 * grains are drawn when `grainsDone` is called, the line when `lineDone` is, each body at once: the order of the
 * drawing is the order of these calls.
 */
export interface SkyPainter {
  /** Whether the canvas draws in WebGL. */
  readonly webgl: boolean;
  /** Clears the canvas, and nothing more. */
  clear(): void;
  /** Starts a frame: the canvas cleared, a point `p` of the sky drawn at `p * scale + offset` device px. */
  begin(scale: number, offsetX: number, offsetY: number): void;
  /** From now on, nothing is drawn within `box`; `null` lifts it. */
  hole(box: SkyBox | null): void;
  /** A grain: a square of side `size` centred on `x, y`, of colour `rgb` at `alpha`. */
  grain(x: number, y: number, size: number, alpha: number, rgb: Rgb): void;
  grainsDone(): void;
  /** The line: `lineMove` lifts the pen to a point, `lineTo` draws to the next. */
  lineMove(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  /** Strokes the line, one unit wide. */
  lineDone(rgb: Rgb, alpha: number): void;
  /** A body of `size` px across at `x, y`, with its glow in `glow` (at 42 %), the whole at `alpha`. */
  body(kind: BodyKind, x: number, y: number, size: number, alpha: number, glow: Rgb): void;
}

/** The painter on a 2D context. */
export function canvasPainter(canvas: HTMLCanvasElement): SkyPainter | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const colors = new Map<Rgb, string>();
  const colorOf = (rgb: Rgb): string => {
    let value = colors.get(rgb);
    if (value === undefined) {
      value = cssRgb(rgb);
      colors.set(rgb, value);
    }
    return value;
  };
  let fill = '';
  let holed = false;
  let pen = false;
  return {
    webgl: false,
    clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    begin(scale, offsetX, offsetY) {
      this.clear();
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      fill = '';
    },
    hole(box) {
      if (holed) {
        ctx.restore();
        holed = false;
        fill = '';
      }
      if (!box) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-1e6, -1e6, 2e6, 2e6);
      ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.clip('evenodd');
      ctx.beginPath();
      holed = true;
    },
    grain(x, y, size, alpha, rgb) {
      const style = colorOf(rgb);
      if (style !== fill) {
        fill = style;
        ctx.fillStyle = fill;
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    },
    grainsDone() {
      ctx.globalAlpha = 1;
    },
    lineMove(x, y) {
      if (!pen) {
        ctx.beginPath();
        pen = true;
      }
      ctx.moveTo(x, y);
    },
    lineTo(x, y) {
      ctx.lineTo(x, y);
    },
    lineDone(rgb, alpha) {
      if (!pen) return;
      ctx.strokeStyle = cssRgb(rgb, alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      pen = false;
    },
    body(kind, x, y, size, alpha, glowRgb) {
      const r = size / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, cssRgb(glowRgb, 0.42));
      glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      const disc = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      disc.addColorStop(0, '#ffffff');
      disc.addColorStop(1, 'rgb(200 200 196)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(x, y, r * (kind === 'orb' ? 0.8 : 0.62), 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'ringed') {
        ctx.strokeStyle = 'rgb(255 255 255 / 70%)';
        ctx.lineWidth = Math.max(0.8, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.35, r * 0.36, -0.32, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'moon') {
        ctx.fillStyle = 'rgb(255 255 255 / 85%)';
        ctx.beginPath();
        ctx.arc(x + r * 1.25, y - r * 0.7, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      fill = '';
    },
  };
}

// ---------- WebGL ----------

/** The device pixel under a fragment (y down), the sky's point there, and whether it lies in the hole. */
const FRAGMENT_HEAD = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec3 uMap;
uniform vec4 uHole;
out vec4 outColor;
vec2 devicePoint() { return vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); }
bool inHole(vec2 device) {
  vec2 p = (device - uMap.yz) / uMap.x;
  return uHole.z > uHole.x && p.x >= uHole.x && p.x < uHole.z && p.y >= uHole.y && p.y < uHole.w;
}
`;

/** A device position to clip space, y down. */
const CLIP = `vec4 clip(vec2 device) { return vec4(device.x / uSize.x * 2.0 - 1.0, 1.0 - device.y / uSize.y * 2.0, 0.0, 1.0); }`;

const GRAIN_VERTEX = `#version 300 es
in vec2 aCorner;
in vec4 aRect;
in vec4 aColor;
uniform vec2 uSize;
uniform vec3 uMap;
out vec4 vRect;
out vec4 vColor;
${CLIP}
void main() {
  vec2 d0 = aRect.xy * uMap.x + uMap.yz;
  vec2 d1 = aRect.zw * uMap.x + uMap.yz;
  vRect = vec4(d0, d1);
  vColor = aColor;
  gl_Position = clip(mix(floor(d0), ceil(d1), aCorner));
}
`;

// A grain covers each pixel by the area it has in common with it, as the 2D context fills a rectangle.
const GRAIN_FRAGMENT = `${FRAGMENT_HEAD}
in vec4 vRect;
in vec4 vColor;
void main() {
  vec2 device = devicePoint();
  if (inHole(device)) discard;
  vec2 p0 = floor(device);
  vec2 c = max(min(vRect.zw, p0 + 1.0) - max(vRect.xy, p0), 0.0);
  float a = vColor.a * c.x * c.y;
  outColor = vec4(vColor.rgb * a, a);
}
`;

const LINE_VERTEX = `#version 300 es
in vec2 aPosition;
in float aAcross;
uniform vec2 uSize;
out float vAcross;
${CLIP}
void main() {
  vAcross = aAcross;
  gl_Position = clip(aPosition);
}
`;

// The band's share of a pixel, across the line.
const LINE_FRAGMENT = `${FRAGMENT_HEAD}
uniform vec4 uColor;
uniform float uHalf;
in float vAcross;
void main() {
  if (inHole(devicePoint())) discard;
  float a = uColor.a * clamp(min(vAcross + 0.5, uHalf) - max(vAcross - 0.5, -uHalf), 0.0, 1.0);
  outColor = vec4(uColor.rgb * a, a);
}
`;

const BODY_VERTEX = `#version 300 es
in vec2 aCorner;
uniform vec2 uSize;
uniform vec3 uMap;
uniform vec2 uCenter;
uniform float uRadius;
${CLIP}
void main() {
  vec2 center = uCenter * uMap.x + uMap.yz;
  gl_Position = clip(center + (aCorner * 2.0 - 1.0) * (uRadius * uMap.x * 3.0 + 1.0));
}
`;

// The body as the 2D context paints it: its glow (a radial gradient from its colour at 42 % to a clear white, over
// three times its radius), its disc (a gradient from a white spot up and left to a warm grey), then its ring or its
// moon; each fill composited over the one before, at the body's alpha.
const BODY_FRAGMENT = `${FRAGMENT_HEAD}
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAlpha;
uniform vec3 uGlow;
uniform int uKind;
vec4 over(vec4 under, vec3 rgb, float a) { return vec4(rgb * a, a) + under * (1.0 - a); }
float disc(float radius, float d) { return clamp(radius + 0.5 - d, 0.0, 1.0); }
void main() {
  vec2 device = devicePoint();
  if (inHole(device)) discard;
  vec2 p = device - (uCenter * uMap.x + uMap.yz);
  float R = uRadius * uMap.x;
  float d = length(p);
  vec4 color = vec4(0.0);
  float t = clamp(d / (3.0 * R), 0.0, 1.0);
  color = over(color, mix(uGlow, vec3(1.0), t), (1.0 - t) * 0.42 * uAlpha * disc(3.0 * R, d));
  // The disc's gradient, between a small circle up and left and the disc itself (the canvas's two-circle gradient).
  vec2 c0 = vec2(-0.35 * R);
  float r0 = 0.1 * R;
  vec2 cd = -c0;
  float dr = R - r0;
  vec2 pd = p - c0;
  float qa = dot(cd, cd) - dr * dr;
  float qb = dot(pd, cd) + r0 * dr;
  float qc = dot(pd, pd) - r0 * r0;
  float s = abs(qa) < 1e-6 ? qc / (2.0 * qb) : (qb + sign(qa) * sqrt(max(qb * qb - qa * qc, 0.0))) / qa;
  s = clamp(s, 0.0, 1.0);
  float k = uKind == 0 ? 0.8 : 0.62;
  color = over(color, mix(vec3(1.0), vec3(200.0, 200.0, 196.0) / 255.0, s), uAlpha * disc(R * k, d));
  if (uKind == 1) {
    vec2 q = vec2(cos(0.32) * p.x - sin(0.32) * p.y, sin(0.32) * p.x + cos(0.32) * p.y);
    vec2 radii = vec2(1.35, 0.36) * R;
    vec2 n = q / radii;
    float sdf = (length(n) - 1.0) / max(length(n / radii), 1e-6);
    float reach = 0.5 * max(0.8, uRadius * 0.14) * uMap.x;
    float cover = clamp(min(sdf + 0.5, reach) - max(sdf - 0.5, -reach), 0.0, 1.0);
    color = over(color, vec3(1.0), 0.7 * uAlpha * cover);
  } else if (uKind == 2) {
    color = over(color, vec3(1.0), 0.85 * uAlpha * disc(0.22 * R, length(p - vec2(1.25, -0.7) * R)));
  }
  outColor = color;
}
`;

const KINDS: Record<BodyKind, number> = { orb: 0, ringed: 1, moon: 2 };
const MAX_GRAINS = 1024;

interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
}

function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error('no shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`sky shader: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string, names: string[]): Program {
  const program = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new Error(`sky program: ${log}`);
  }
  const uniforms: Program['uniforms'] = {};
  const attributes: Program['attributes'] = {};
  for (const name of names) {
    if (name.startsWith('u')) uniforms[name] = gl.getUniformLocation(program, name);
    else attributes[name] = gl.getAttribLocation(program, name);
  }
  return { program, uniforms, attributes };
}

/**
 * The painter in WebGL 2, or `null` where the canvas gives no such context or its programs fail to build. A canvas
 * that gave a WebGL context keeps it: the caller then draws on another canvas.
 */
export function webglPainter(canvas: HTMLCanvasElement): SkyPainter | null {
  const context = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  let lost = false;
  let grainProgram: Program;
  let lineProgram: Program;
  let bodyProgram: Program;
  let cornerBuffer: WebGLBuffer;
  let grainBuffer: WebGLBuffer;
  let lineBuffer: WebGLBuffer;
  let grainArray: WebGLVertexArrayObject;
  let lineArray: WebGLVertexArrayObject;
  let bodyArray: WebGLVertexArrayObject;

  function setUp(): void {
    grainProgram = link(gl, GRAIN_VERTEX, GRAIN_FRAGMENT, ['aCorner', 'aRect', 'aColor', 'uSize', 'uMap', 'uHole']);
    lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT, [
      'aPosition',
      'aAcross',
      'uSize',
      'uMap',
      'uHole',
      'uColor',
      'uHalf',
    ]);
    bodyProgram = link(gl, BODY_VERTEX, BODY_FRAGMENT, [
      'aCorner',
      'uSize',
      'uMap',
      'uHole',
      'uCenter',
      'uRadius',
      'uAlpha',
      'uGlow',
      'uKind',
    ]);
    cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    grainBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, grainBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_GRAINS * 8 * 4, gl.DYNAMIC_DRAW);
    lineBuffer = gl.createBuffer();

    grainArray = gl.createVertexArray();
    gl.bindVertexArray(grainArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.enableVertexAttribArray(grainProgram.attributes.aCorner ?? 0);
    gl.vertexAttribPointer(grainProgram.attributes.aCorner ?? 0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, grainBuffer);
    const rect = grainProgram.attributes.aRect ?? 1;
    const color = grainProgram.attributes.aColor ?? 2;
    gl.enableVertexAttribArray(rect);
    gl.vertexAttribPointer(rect, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(rect, 1);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(color, 1);

    lineArray = gl.createVertexArray();
    gl.bindVertexArray(lineArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    const position = lineProgram.attributes.aPosition ?? 0;
    const across = lineProgram.attributes.aAcross ?? 1;
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(across);
    gl.vertexAttribPointer(across, 1, gl.FLOAT, false, 12, 8);

    bodyArray = gl.createVertexArray();
    gl.bindVertexArray(bodyArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.enableVertexAttribArray(bodyProgram.attributes.aCorner ?? 0);
    gl.vertexAttribPointer(bodyProgram.attributes.aCorner ?? 0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  try {
    setUp();
  } catch (error) {
    console.warn("the ring's sky falls back to 2D canvases:", error);
    return null;
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      setUp();
      lost = false;
    } catch {
      // The sky stays blank until the page is left.
    }
  });

  // The frame's mapping and hole, for every program.
  const map = { scale: 1, x: 0, y: 0 };
  const hole = new Float32Array([0, 0, 0, 0]);
  const frame = (program: Program): void => {
    gl.useProgram(program.program);
    gl.uniform2f(program.uniforms.uSize ?? null, canvas.width, canvas.height);
    gl.uniform3f(program.uniforms.uMap ?? null, map.scale, map.x, map.y);
    gl.uniform4fv(program.uniforms.uHole ?? null, hole);
  };

  const grains = new Float32Array(MAX_GRAINS * 8);
  let grainCount = 0;
  // The line's points, in device px, and where the pen lifted (the index of the first point of each run).
  let points: number[] = [];
  let runs: number[] = [];

  return {
    webgl: true,
    clear() {
      if (lost) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    begin(scale, offsetX, offsetY) {
      map.scale = scale;
      map.x = offsetX;
      map.y = offsetY;
      this.clear();
      grainCount = 0;
      points = [];
      runs = [];
    },
    hole(box) {
      hole.set(box ? [box.x0, box.y0, box.x1, box.y1] : [0, 0, 0, 0]);
    },
    grain(x, y, size, alpha, rgb) {
      if (grainCount >= MAX_GRAINS) return;
      const at = grainCount * 8;
      grains[at] = x - size / 2;
      grains[at + 1] = y - size / 2;
      grains[at + 2] = x + size / 2;
      grains[at + 3] = y + size / 2;
      grains[at + 4] = rgb[0];
      grains[at + 5] = rgb[1];
      grains[at + 6] = rgb[2];
      grains[at + 7] = alpha;
      grainCount += 1;
    },
    grainsDone() {
      if (lost || grainCount === 0) {
        grainCount = 0;
        return;
      }
      frame(grainProgram);
      gl.bindVertexArray(grainArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, grainBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, grains, 0, grainCount * 8);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, grainCount);
      gl.bindVertexArray(null);
      grainCount = 0;
    },
    lineMove(x, y) {
      runs.push(points.length / 2);
      points.push(x * map.scale + map.x, y * map.scale + map.y);
    },
    lineTo(x, y) {
      points.push(x * map.scale + map.x, y * map.scale + map.y);
    },
    lineDone(rgb, alpha) {
      if (lost || points.length === 0) {
        points = [];
        runs = [];
        return;
      }
      // A band along each run of points, one unit wide plus a pixel of margin on each side for its edges: two
      // triangles between each point and the next, the vertices across the line at ±reach.
      const half = map.scale / 2;
      const reach = half + 1;
      const vertices: number[] = [];
      const push = (x: number, y: number, nx: number, ny: number, side: number): void => {
        vertices.push(x + nx * reach * side, y + ny * reach * side, reach * side);
      };
      for (let r = 0; r < runs.length; r += 1) {
        const start = runs[r] ?? 0;
        const end = (runs[r + 1] ?? points.length / 2) - 1;
        if (end <= start) continue;
        const normal = (i: number): [number, number] => {
          const a = Math.max(start, i - 1);
          const b = Math.min(end, i + 1);
          const dx = (points[b * 2] ?? 0) - (points[a * 2] ?? 0);
          const dy = (points[b * 2 + 1] ?? 0) - (points[a * 2 + 1] ?? 0);
          const length = Math.hypot(dx, dy) || 1;
          return [-dy / length, dx / length];
        };
        let [nx0, ny0] = normal(start);
        for (let i = start; i < end; i += 1) {
          const [nx1, ny1] = normal(i + 1);
          const x0 = points[i * 2] ?? 0;
          const y0 = points[i * 2 + 1] ?? 0;
          const x1 = points[i * 2 + 2] ?? 0;
          const y1 = points[i * 2 + 3] ?? 0;
          push(x0, y0, nx0, ny0, 1);
          push(x0, y0, nx0, ny0, -1);
          push(x1, y1, nx1, ny1, 1);
          push(x0, y0, nx0, ny0, -1);
          push(x1, y1, nx1, ny1, -1);
          push(x1, y1, nx1, ny1, 1);
          nx0 = nx1;
          ny0 = ny1;
        }
      }
      points = [];
      runs = [];
      if (vertices.length === 0) return;
      frame(lineProgram);
      gl.uniform4f(lineProgram.uniforms.uColor ?? null, rgb[0], rgb[1], rgb[2], alpha);
      gl.uniform1f(lineProgram.uniforms.uHalf ?? null, half);
      gl.bindVertexArray(lineArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
      gl.bindVertexArray(null);
    },
    body(kind, x, y, size, alpha, glow) {
      if (lost) return;
      frame(bodyProgram);
      gl.uniform2f(bodyProgram.uniforms.uCenter ?? null, x, y);
      gl.uniform1f(bodyProgram.uniforms.uRadius ?? null, size / 2);
      gl.uniform1f(bodyProgram.uniforms.uAlpha ?? null, alpha);
      gl.uniform3f(bodyProgram.uniforms.uGlow ?? null, glow[0], glow[1], glow[2]);
      gl.uniform1i(bodyProgram.uniforms.uKind ?? null, KINDS[kind]);
      gl.bindVertexArray(bodyArray);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
  };
}
