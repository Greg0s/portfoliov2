/**
 * The river as a mirror (a landscape proposal, `?paysage=1`): it reflects the town, the quays and the bridges, not only
 * the sky. The town's camera never moves, it only shifts and zooms its picture, so the reflection is the same in every
 * frame: it is drawn once, at the first draw of the town, for the whole frame (and a margin for the head and the
 * arrival), then only looked up. Small ripples blur it as water does.
 */
import {
  Color,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  type Texture,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

const shader = {
  name: 'RiverShader',
  uniforms: UniformsUtils.merge([
    UniformsLib.fog,
    {
      color: { value: new Color() },
      tDiffuse: { value: null },
      textureMatrix: { value: new Matrix4() },
      tRipples: { value: null },
      repeat: { value: [1, 1] },
      strength: { value: 0.7 },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    uniform vec2 repeat;
    varying vec4 vUv;
    varying vec2 vRippleUv;
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vRippleUv = uv * repeat;
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tRipples;
    uniform float strength;
    varying vec4 vUv;
    varying vec2 vRippleUv;
    #include <fog_pars_fragment>
    void main() {
      vec2 ripple = texture2D( tRipples, vRippleUv ).xy * 2.0 - 1.0;
      vec4 at = vUv;
      // Mostly up and down, as ripples stretch a reflection.
      at.xy += vec2( ripple.x * 0.002, ripple.y * 0.012 ) * at.w;
      vec4 reflected = texture2DProj( tDiffuse, at );
      gl_FragColor = vec4( mix( color, reflected.rgb, strength ), 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export function river(width: number, depth: number, color: Color, ripples: Texture): Mesh {
  const reflector = new Reflector(new PlaneGeometry(width, depth), {
    textureWidth: 1600,
    textureHeight: 1000,
    color,
    shader,
    multisample: 4,
  });
  const material = reflector.material as ShaderMaterial;
  material.fog = true;
  material.uniforms.tRipples = { value: ripples };
  material.uniforms.repeat = { value: [width / ripples.repeat.x, depth / ripples.repeat.y] };
  const draw = reflector.onBeforeRender.bind(reflector);
  reflector.onBeforeRender = (renderer, scene, camera, ...rest) => {
    // The whole frame of the seated camera, without the view offset, and a little wider.
    const full = (camera as PerspectiveCamera).clone();
    full.clearViewOffset();
    full.fov *= 1.25;
    full.updateProjectionMatrix();
    full.updateMatrixWorld();
    // The sky the town reflects is its environment (the HTML sky is not in the scene).
    const background = scene.background;
    scene.background = scene.environment;
    draw(renderer, scene, full, ...rest);
    scene.background = background;
    reflector.onBeforeRender = () => undefined;
  };
  return reflector;
}
