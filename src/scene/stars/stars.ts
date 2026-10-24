/**
 * The journey's stars (journey spec §4): about 90 far stars that twinkle and barely move, and about 56 near stars
 * along the camera's path that stream toward the planet, in one `Points` geometry drawn by the shared renderer. The
 * trails of the office's jump (step 7) reuse it.
 */
import { BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial } from 'three';
import { fragmentShader, vertexShader } from './stars.glsl';
import type { Star, View } from '../journey/layout';

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

export interface StarField {
  points: Points;
  resize(view: View, pixelRatio: number): void;
  update(state: StarsState): void;
  dispose(): void;
}

export function createStars(stars: readonly Star[], view: View, pixelRatio: number): StarField {
  const count = stars.length;
  const position = new Float32Array(count * 3);
  const near = new Float32Array(count);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  const big = new Float32Array(count);
  const twinkle = new Float32Array(count * 2);
  const keep = new Float32Array(count);
  stars.forEach((star, i) => {
    // Near stars in the Three.js world (y up); far stars in px from the vanishing point (y down).
    position.set(star.near ? [star.x, -star.y, star.z] : [star.x, star.y, 0], i * 3);
    near[i] = star.near ? 1 : 0;
    size[i] = star.size;
    alpha[i] = star.alpha;
    big[i] = star.big ? 1 : 0;
    twinkle.set([star.twinkleDuration || 1, star.twinkleDelay], i * 2);
    keep[i] = star.keep ? 1 : 0;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aNear', new BufferAttribute(near, 1));
  geometry.setAttribute('aSize', new BufferAttribute(size, 1));
  geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
  geometry.setAttribute('aBig', new BufferAttribute(big, 1));
  geometry.setAttribute('aTwinkle', new BufferAttribute(twinkle, 2));
  geometry.setAttribute('aKeep', new BufferAttribute(keep, 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // The fragment shader writes premultiplied colours.
    blending: NormalBlending,
    premultipliedAlpha: true,
    uniforms: {
      uTime: { value: 0 },
      uDepth: { value: 0 },
      uPerspective: { value: view.perspective },
      uViewport: { value: [view.width, view.height] },
      uVanish: { value: [view.vpX, view.vpY] },
      uFarScale: { value: 1 },
      uFarShift: { value: [0, 0] },
      uFarOpacity: { value: 1 },
      uFarFade: { value: 1 },
      uNearOpacity: { value: 1 },
      uPixelRatio: { value: pixelRatio },
    },
  });
  const points = new Points(geometry, material);
  // The vertex shader places the far stars itself: the bounding sphere means nothing to them.
  points.frustumCulled = false;
  const u = material.uniforms;

  return {
    points,
    resize(next, ratio) {
      if (u.uPerspective) u.uPerspective.value = next.perspective;
      if (u.uViewport) u.uViewport.value = [next.width, next.height];
      if (u.uVanish) u.uVanish.value = [next.vpX, next.vpY];
      if (u.uPixelRatio) u.uPixelRatio.value = ratio;
    },
    update(state) {
      const set = (name: string, value: unknown): void => {
        const uniform = u[name];
        if (uniform) uniform.value = value;
      };
      set('uTime', state.time);
      set('uDepth', state.depth);
      set('uFarScale', state.farScale);
      set('uFarShift', [state.farShiftX, state.farShiftY]);
      set('uFarOpacity', state.farOpacity);
      set('uFarFade', state.farFade);
      set('uNearOpacity', state.nearOpacity);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
