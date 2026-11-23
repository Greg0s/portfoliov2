/**
 * What the office's scenes share (the one in relief, its CSS layers, and the live one the build renders the layers
 * with): what the HTML laid over them asks of a scene, and the halos laid over it in screen blending.
 */
import {
  AddEquation,
  CanvasTexture,
  CustomBlending,
  DstAlphaFactor,
  DstColorFactor,
  Group,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  PlaneGeometry,
  ReverseSubtractEquation,
  SRGBColorSpace,
  ZeroFactor,
  type Texture,
} from 'three';
import type { ArrivalState } from './arrival';
import type { Placement } from './corners';
import type { Fit } from './frame';

export interface PictureSource {
  src: string;
  /** The point kept when cropping, in % of the image (CSS object-position). */
  focus: [number, number];
}

export interface Head {
  /** Where the head leans, from −1 to 1 on each axis (toward the mouse). */
  x: number;
  y: number;
}

export interface Drawn {
  placement: Placement;
  screenShown: boolean;
  opacity: { room: number; desk: number };
  /** The setting sun's centre and radius in the town as drawn, for the halo's twin over the sky (dusk only). */
  sun: [number, number, number] | null;
}

/** The office's scene behind its HTML: in relief or live (a canvas over the section), or its layers (in the frame). */
export interface OfficeScene {
  element: HTMLElement;
  /** Where things land in the frame at rest (for the HTML laid over the scene). */
  rest: Placement;
  /** Draws a frame; returns where the screen and the pictures land now, in frame px, and how visible they are. */
  draw(state: ArrivalState, head: Head): Drawn;
  resize(width: number, height: number, fit: Fit): void;
  /** Puts the pictures on their frames; `loaded` is called as each one is ready to show. */
  setPictures(pictures: ReadonlyMap<string, PictureSource>, loaded: () => void): void;
  /** Whether its WebGL context was lost: what was on the GPU is gone (the layers have none to lose). */
  isLost(): boolean;
  /** Calls `callback` (one at a time, `null` for none) if its WebGL context is lost. */
  whenLost(callback: (() => void) | null): void;
  dispose(): void;
}

/**
 * A soft round glow for the halos laid over the scene in screen blending, drawn over black: its colours are already
 * weighed by their alpha in sRGB, as the browser does when it blends a CSS gradient. Weighing them in the shader would
 * do it in linear light and brighten the faint edge of the glow a lot.
 */
export function glowTexture(stops: readonly [number, string][]): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    // As CSS's `radial-gradient(circle, …)`, whose stops are along the way to the farthest corner.
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * Math.SQRT1_2);
    stops.forEach(([at, color]) => {
      gradient.addColorStop(at, color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A halo facing the camera, blended as the CSS `screen` mode over what is drawn: the setting sun's over the hills, the
 * lamp's over the wall. Where the canvas is transparent, the sky behind is HTML and has its own twin of the halo: there
 * the halo must add nothing, or the page would add it to the sky instead of screening it. So it adds `halo × (alpha −
 * colour)` of what is drawn, in two draws: one takes off `halo × colour`, the next adds `halo × alpha`.
 */
export function halo(texture: Texture, layer: number): Group {
  const geometry = new PlaneGeometry(1, 1);
  const group = new Group();
  for (const [order, equation, factor] of [
    [10, ReverseSubtractEquation, DstColorFactor],
    [11, AddEquation, DstAlphaFactor],
  ] as const) {
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      premultipliedAlpha: false,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
      blending: CustomBlending,
      blendEquation: equation,
      blendSrc: factor,
      blendDst: OneFactor,
      blendEquationAlpha: AddEquation,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    });
    const mesh = new Mesh(geometry, material);
    mesh.layers.set(layer);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

/** Thrown when the device cannot draw the office's scene smoothly: its layers stand in. */
export class SlowOffice extends Error {}
