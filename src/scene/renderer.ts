/**
 * The journey's WebGL renderer (implementation plan §2.2): a full-screen canvas behind the HTML, transparent, that
 * draws the journey's stars. Plain WebGL 2, without Three.js (Grégoire, 24 November 2026): the stars are one cloud of
 * points, and Three.js, 150 KB compressed, was loaded for them alone wherever the planet and the office show as
 * pictures (phones). Its pixel ratio is capped (2, and 1.5 on phones); it stops drawing while the tab is hidden or the
 * context is lost, and when the context comes back, what it draws is put on the GPU again.
 */
import { coldSource } from './cold';
import { projectionMatrix, viewMatrix, type Mat4 } from './journey/camera3d';
import type { View } from './journey/layout';
import { noteContext, RENDERER_CONTEXT } from './quality';
import { cappedPixelRatio } from './resolution';

/** What the renderer draws (the stars' field). */
export interface Drawable {
  draw(renderer: Renderer): void;
}

export interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  pixelRatio: number;
  /** Whether its WebGL context is lost, and not back yet. */
  readonly lost: boolean;
  /** Counts the contexts it had: what was put on the GPU before a loss has to be put there again. */
  readonly generation: number;
  /** The camera's projection, column-major. */
  readonly projection: Mat4;
  /** The camera's view: `perspective` px in front of the focus plane (`viewMatrix()`), column-major. */
  readonly view: Mat4;
  /** What it draws, if anything. */
  field: Drawable | null;
  /** A program linked once per context, shared by every field that asks with the same `key`. */
  program(key: string, vertex: string, fragment: string): WebGLProgram;
  resize(view: View): void;
  render(): void;
  dispose(): void;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('No shader.');
    gl.shaderSource(shader, coldSource(source));
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(gl.getProgramInfoLog(program) ?? 'The stars do not link.');
  return program;
}

/** `canvas`, when given, holds the context made ahead with the same attributes (`contextAhead()`). */
export function createRenderer(
  container: HTMLElement,
  view: View,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Renderer {
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', RENDERER_CONTEXT);
  if (!gl) throw new Error('No WebGL 2.');
  container.prepend(canvas);
  noteContext(gl);

  let lost = false;
  let generation = 0;
  let pixelRatio = 1;
  let width = 0;
  let height = 0;
  let projection: Mat4 = new Float32Array(16);
  let viewOf: Mat4 = new Float32Array(16);
  let programs = new Map<string, WebGLProgram>();

  const onLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
  };
  const onRestored = (): void => {
    lost = false;
    generation += 1;
    programs = new Map();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const renderer: Renderer = {
    canvas,
    gl,
    field: null,
    get pixelRatio() {
      return pixelRatio;
    },
    get lost() {
      return lost;
    },
    get generation() {
      return generation;
    },
    get projection() {
      return projection;
    },
    get view() {
      return viewOf;
    },
    program(key, vertex, fragment) {
      let program = programs.get(key);
      if (!program) {
        program = link(gl, vertex, fragment);
        programs.set(key, program);
      }
      return program;
    },
    resize(next) {
      const ratio = cappedPixelRatio(window.devicePixelRatio || 1, next.mobile);
      // Sized again only when its size changes: sizing a canvas throws its drawing buffer away, even at the same size
      // (the renderer kept from a former visit of the home comes back at the size it had).
      if (ratio !== pixelRatio || next.width !== width || next.height !== height) {
        pixelRatio = ratio;
        width = next.width;
        height = next.height;
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
      }
      projection = projectionMatrix(next);
      viewOf = viewMatrix(next);
    },
    render() {
      if (lost || document.hidden) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.field?.draw(renderer);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const program of programs.values()) gl.deleteProgram(program);
      programs.clear();
      // Its context is given back now: a browser keeps only so many (8 on a phone) and waits for the garbage
      // collector otherwise, dropping the oldest one meanwhile, which may be a scene still on screen.
      if (!lost) gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
  renderer.resize(view);
  return renderer;
}
