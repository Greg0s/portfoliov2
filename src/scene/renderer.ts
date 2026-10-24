/**
 * The site's one WebGL renderer (implementation plan §2.2): a full-screen canvas behind the HTML, transparent, that
 * draws the journey's stars now and the planet and the office from step 7. Its pixel ratio is capped (2, and 1.5 on
 * phones); it stops drawing while the tab is hidden or the context is lost, and says when it is back.
 */
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { cameraPosition, projectionMatrix } from './journey/camera3d';
import type { View } from './journey/layout';

export interface Renderer {
  canvas: HTMLCanvasElement;
  scene: Scene;
  camera: PerspectiveCamera;
  pixelRatio: number;
  resize(view: View): void;
  render(): void;
  dispose(): void;
}

/** The device pixel ratio the renderer draws at: at most 2, and 1.5 on phones. */
export function cappedPixelRatio(devicePixelRatio: number, mobile: boolean): number {
  return Math.min(devicePixelRatio, mobile ? 1.5 : 2);
}

export function createRenderer(container: HTMLElement, view: View): Renderer {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  const gl = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  gl.setClearColor(0x000000, 0);
  const scene = new Scene();
  // The camera's projection comes from the journey's CSS camera; Three.js never recomputes it on its own.
  const camera = new PerspectiveCamera();
  let lost = false;
  let pixelRatio = 1;

  const onLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
  };
  const onRestored = (): void => {
    lost = false;
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  const renderer: Renderer = {
    canvas,
    scene,
    camera,
    get pixelRatio() {
      return pixelRatio;
    },
    resize(next) {
      pixelRatio = cappedPixelRatio(window.devicePixelRatio || 1, next.mobile);
      gl.setPixelRatio(pixelRatio);
      gl.setSize(next.width, next.height, false);
      camera.projectionMatrix.copy(projectionMatrix(next));
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.position.copy(cameraPosition(next));
    },
    render() {
      if (lost || document.hidden) return;
      gl.render(scene, camera);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl.dispose();
      canvas.remove();
    },
  };
  renderer.resize(view);
  return renderer;
}
