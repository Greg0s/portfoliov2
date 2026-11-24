/**
 * The journey's stars (journey spec §4): about 90 far stars that twinkle and barely move, and about 56 near stars
 * along the camera's path that stream toward the planet, in one cloud of points drawn by the journey's renderer
 * (`src/scene/renderer.ts`), in plain WebGL 2. The trails of the office's jump (step 7) reuse it.
 */
import { accentAt, mixRgb } from '../accent';
import { multiply, type Mat4 } from '../journey/camera3d';
import type { Star, View } from '../journey/layout';
import type { Drawable, Renderer } from '../renderer';
import { fragmentShader, vertexShader } from './stars.glsl';

export interface StarsState {
  time: number;
  depth: number;
  farScale: number;
  farShiftX: number;
  farShiftY: number;
  farOpacity: number;
  farFade: number;
  nearOpacity: number;
}

export interface StarField extends Drawable {
  resize(view: View, pixelRatio: number): void;
  update(state: StarsState): void;
  /** The swayed world matrix (`swayMatrix()`), column-major. */
  setMatrix(matrix: Mat4): void;
  dispose(): void;
}

/** Each attribute: its name in the shader, its size, its values. */
type Attributes = [string, number, Float32Array][];

export function createStars(stars: readonly Star[], view: View, pixelRatio: number): StarField {
  const count = stars.length;
  const position = new Float32Array(count * 3);
  const near = new Float32Array(count);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  const big = new Float32Array(count);
  const twinkle = new Float32Array(count * 2);
  const keep = new Float32Array(count);
  // White, but about one star in three takes a colour along the accent's gradient (src/scene/accent.ts).
  const color = new Float32Array(count * 3).fill(1);
  const hash = (i: number, salt: number): number => {
    const x = Math.sin(i * 12.9898 + salt) * 43758.5453;
    return x - Math.floor(x);
  };
  stars.forEach((star, i) => {
    if (hash(i, 1.7) < 0.36) color.set(mixRgb([1, 1, 1], accentAt(hash(i, 8.3)), 0.8), i * 3);
    // Near stars in the WebGL world (y up); far stars in px from the vanishing point (y down).
    position.set(star.near ? [star.x, -star.y, star.z] : [star.x, star.y, 0], i * 3);
    near[i] = star.near ? 1 : 0;
    size[i] = star.size;
    alpha[i] = star.alpha;
    big[i] = star.big ? 1 : 0;
    twinkle.set([star.twinkleDuration || 1, star.twinkleDelay], i * 2);
    keep[i] = star.keep ? 1 : 0;
  });
  const attributes: Attributes = [
    ['position', 3, position],
    ['aNear', 1, near],
    ['aSize', 1, size],
    ['aAlpha', 1, alpha],
    ['aBig', 1, big],
    ['aTwinkle', 2, twinkle],
    ['aKeep', 1, keep],
    ['aColor', 3, color],
  ];

  const uniforms: Record<string, number | number[]> = {
    uTime: 0,
    uDepth: 0,
    uPerspective: view.perspective,
    uViewport: [view.width, view.height],
    uVanish: [view.vpX, view.vpY],
    uFarScale: 1,
    uFarShift: [0, 0],
    uFarOpacity: 1,
    uFarFade: 1,
    uNearOpacity: 1,
    uPixelRatio: pixelRatio,
  };
  let matrix: Mat4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  // What it put on the GPU, for the renderer's context of that generation: made again after a lost context.
  let made: {
    renderer: Renderer;
    generation: number;
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    program: WebGLProgram;
    locations: Map<string, WebGLUniformLocation | null>;
  } | null = null;

  const release = (): void => {
    if (!made) return;
    const { gl } = made.renderer;
    if (!gl.isContextLost()) {
      gl.deleteVertexArray(made.vao);
      for (const buffer of made.buffers) gl.deleteBuffer(buffer);
    }
    made = null;
  };

  const make = (renderer: Renderer): NonNullable<typeof made> => {
    release();
    const { gl } = renderer;
    // The program is the renderer's: the field of the next visit of the home takes it back already linked.
    const program = renderer.program('stars', vertexShader, fragmentShader);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = attributes.map(([name, itemSize, values]) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, itemSize, gl.FLOAT, false, 0, 0);
      }
      return buffer;
    });
    gl.bindVertexArray(null);
    const locations = new Map(
      [...Object.keys(uniforms), 'modelViewMatrix', 'projectionMatrix'].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    );
    return { renderer, generation: renderer.generation, vao, buffers, program, locations };
  };

  return {
    resize(next, ratio) {
      uniforms.uPerspective = next.perspective;
      uniforms.uViewport = [next.width, next.height];
      uniforms.uVanish = [next.vpX, next.vpY];
      uniforms.uPixelRatio = ratio;
    },
    update(state) {
      uniforms.uTime = state.time;
      uniforms.uDepth = state.depth;
      uniforms.uFarScale = state.farScale;
      uniforms.uFarShift = [state.farShiftX, state.farShiftY];
      uniforms.uFarOpacity = state.farOpacity;
      uniforms.uFarFade = state.farFade;
      uniforms.uNearOpacity = state.nearOpacity;
    },
    setMatrix(next) {
      matrix = next;
    },
    draw(renderer) {
      if (made?.renderer !== renderer || made.generation !== renderer.generation) made = make(renderer);
      const { gl } = renderer;
      const { program, locations, vao } = made;
      gl.useProgram(program);
      for (const [name, value] of Object.entries(uniforms)) {
        const location = locations.get(name) ?? null;
        if (typeof value === 'number') gl.uniform1f(location, value);
        else gl.uniform2f(location, value[0] ?? 0, value[1] ?? 0);
      }
      // The camera's view times the swayed world, and its projection, as the shader takes them.
      gl.uniformMatrix4fv(locations.get('modelViewMatrix') ?? null, false, multiply(renderer.view, matrix));
      gl.uniformMatrix4fv(locations.get('projectionMatrix') ?? null, false, renderer.projection);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      // The fragment shader writes premultiplied colours.
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.bindVertexArray(null);
    },
    dispose: release,
  };
}
