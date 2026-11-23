/**
 * Contact shadows on the desk (a render proposal, `?rendu=1` and up): the soft darkening where each object meets the
 * desk top, that the lamp's and the window's shadow maps are too coarse to draw. Nothing on the desk ever moves, so it
 * is drawn once, as the shadow maps are: the objects are seen from under the desk top, in an orthographic camera, each
 * one darker the closer it is to the desk; that picture is blurred twice and laid over the desk as a transparent plane.
 * Drawing a frame then costs one more textured plane.
 */
import {
  AddEquation,
  CustomBlending,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ZeroFactor,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { isMesh, LAYERS, ROOM } from './common';

export interface ContactOptions {
  /** How dark the shadow is right under an object, from 0 to 1. */
  darkness: number;
  /** How high above the desk an object still darkens it, in metres. */
  reach: number;
  /** How far the shadow spreads, in texels of the 1024 × 256 picture (each about 3.3 mm). */
  blur: number;
}

/** The desk top, as `buildDesk` lays it: its centre, width and depth, in metres. */
const DESK = { x: -0.1, w: 3.4, z: (ROOM.wallZ + ROOM.deskFront) / 2, d: ROOM.deskFront - ROOM.wallZ } as const;

export function contactShadows(renderer: WebGLRenderer, desk: Object3D, options: ContactOptions): Mesh {
  const width = 1024;
  const height = 256;
  const target = new WebGLRenderTarget(width, height, { depthBuffer: true });
  target.texture.generateMipmaps = false;
  const spare = new WebGLRenderTarget(width, height, { depthBuffer: false });
  spare.texture.generateMipmaps = false;

  // Looking up from the desk top: what is drawn is what stands on it, darker the closer to the desk.
  const camera = new OrthographicCamera(-DESK.w / 2, DESK.w / 2, DESK.d / 2, -DESK.d / 2, 0.0004, options.reach);
  camera.position.set(DESK.x, ROOM.deskY, DESK.z);
  camera.rotation.x = Math.PI / 2;
  camera.layers.set(LAYERS.desk);
  camera.updateMatrixWorld();

  const depth = new MeshDepthMaterial();
  depth.depthTest = false;
  depth.depthWrite = false;
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = { value: options.darkness };
    shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) * darkness );',
    )}`;
  };

  // Drawn alone: glass, the bulb and the lamp's lit inside cast no contact shadow.
  const hidden: Object3D[] = [];
  desk.traverse((node) => {
    if (!isMesh(node) || !node.visible) return;
    const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
    if (node.userData.noShadow === true || materials.some((m) => m.transparent || m.type === 'MeshBasicMaterial')) {
      node.visible = false;
      hidden.push(node);
    }
  });
  const scene = new Scene();
  const parent = desk.parent;
  scene.add(desk);
  scene.overrideMaterial = depth;

  const blurScene = new Scene();
  const blurQuad = new Mesh(new PlaneGeometry(2, 2));
  blurQuad.frustumCulled = false;
  blurScene.add(blurQuad);
  const flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurH = { tDiffuse: { value: null as Texture | null }, h: { value: 0 } };
  const blurV = { tDiffuse: { value: null as Texture | null }, v: { value: 0 } };
  const horizontal = new ShaderMaterial({ ...HorizontalBlurShader, uniforms: blurH });
  const vertical = new ShaderMaterial({ ...VerticalBlurShader, uniforms: blurV });
  horizontal.depthTest = vertical.depthTest = false;

  const previousTarget = renderer.getRenderTarget();
  const previousShadows = renderer.shadowMap.enabled;
  const previousAutoClear = renderer.autoClear;
  const previousToneMapping = renderer.toneMapping;
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);

  const blur = (amount: number): void => {
    blurQuad.material = horizontal;
    blurH.tDiffuse.value = target.texture;
    blurH.h.value = amount / width;
    renderer.setRenderTarget(spare);
    renderer.render(blurScene, flat);
    blurQuad.material = vertical;
    blurV.tDiffuse.value = spare.texture;
    blurV.v.value = amount / height;
    renderer.setRenderTarget(target);
    renderer.render(blurScene, flat);
  };
  // A wide blur, then a narrow one, so that the shadow is soft away from the object and tight under it.
  blur(options.blur);
  blur(options.blur * 0.4);

  renderer.setRenderTarget(previousTarget);
  renderer.shadowMap.enabled = previousShadows;
  renderer.autoClear = previousAutoClear;
  renderer.toneMapping = previousToneMapping;
  parent?.add(desk);
  hidden.forEach((node) => {
    node.visible = true;
  });
  spare.dispose();
  horizontal.dispose();
  vertical.dispose();
  depth.dispose();
  blurQuad.geometry.dispose();

  // Laid just above the desk top; the objects in front of it hide it, as they would hide their shadow.
  const material = new MeshBasicMaterial({
    map: target.texture,
    // Drawn among the opaque objects, after them, darkening what is under it: RGB × (1 − alpha), alpha unchanged.
    transparent: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const geometry = new PlaneGeometry(DESK.w, DESK.d);
  // The camera looked up: seen from above, the picture is mirrored front to back.
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - uv.getY(i));
  const plane = new Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(DESK.x, ROOM.deskY + 0.0006, DESK.z);
  plane.renderOrder = 2;
  plane.layers.set(LAYERS.desk);
  return plane;
}
