/**
 * The site's one WebGL renderer (implementation plan §2.2): a full-screen canvas behind the HTML, transparent, that
 * draws the journey's stars now and the planet and the office from step 7. Its pixel ratio is capped (2, and 1.5 on
 * phones); it stops drawing while the tab is hidden or the context is lost, and says when it is back.
 */
import { PerspectiveCamera, Scene, ShaderChunk, Vector2, WebGLRenderer } from 'three';
import { cameraPosition, projectionMatrix } from './journey/camera3d';
import type { View } from './journey/layout';
import { noteContext, RENDERER_CONTEXT } from './quality';
import { cappedPixelRatio } from './resolution';

// A first visit, again and again (`?froid=1`, and the fast and full-visit measurement runs): the browser keeps the programs it linked
// in a cache of its own, which makes every later visit fast. A comment that changes at each visit, in the code every
// material of the planet and the office shares, makes it miss.
if (typeof location !== 'undefined' && /[?&](froid=1|mesure=rapide|mesure=visite)\b/.test(location.search)) {
  ShaderChunk.common = `// ${String(Math.random())}\n${ShaderChunk.common}`;
}

export interface Renderer {
  canvas: HTMLCanvasElement;
  scene: Scene;
  camera: PerspectiveCamera;
  pixelRatio: number;
  /** Whether its WebGL context is lost, and not back yet. */
  readonly lost: boolean;
  resize(view: View): void;
  render(): void;
  dispose(): void;
}

/** `canvas`, when given, holds the context made ahead with the same attributes (`contextAhead()`). */
export function createRenderer(
  container: HTMLElement,
  view: View,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Renderer {
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  const { antialias, powerPreference } = RENDERER_CONTEXT;
  const gl = new WebGLRenderer({ canvas, alpha: true, antialias, powerPreference });
  gl.setClearColor(0x000000, 0);
  noteContext(gl.getContext() as WebGL2RenderingContext);
  const scene = new Scene();
  // The camera's projection comes from the journey's CSS camera; Three.js never recomputes it on its own.
  const camera = new PerspectiveCamera();
  let lost = false;
  let pixelRatio = 1;
  const sizeOf = new Vector2();

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
    get lost() {
      return lost;
    },
    resize(next) {
      const ratio = cappedPixelRatio(window.devicePixelRatio || 1, next.mobile);
      // Sized again only when its size changes: sizing a canvas throws its drawing buffer away, even at the same size
      // (the renderer kept from a former visit of the home comes back at the size it had).
      const size = gl.getSize(sizeOf);
      if (ratio !== gl.getPixelRatio() || size.x !== next.width || size.y !== next.height) {
        pixelRatio = ratio;
        gl.setPixelRatio(pixelRatio);
        gl.setSize(next.width, next.height, false);
      }
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
      // Its context is given back now: a browser keeps only so many (8 on a phone) and waits for the garbage
      // collector otherwise, dropping the oldest one meanwhile, which may be a scene still on screen.
      if (!lost) gl.forceContextLoss();
      canvas.remove();
    },
  };
  renderer.resize(view);
  return renderer;
}
