/**
 * The stars' shaders (main spec §7.4, measurement §5): one cloud of points for the far and the near stars, with the
 * far stars' twinkle computed here rather than as animated HTML elements, which slowed the journey on phones.
 */

export const vertexShader = /* glsl */ `
  attribute float aNear;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aBig;
  attribute vec2 aTwinkle;
  attribute float aKeep;

  uniform float uTime;
  uniform float uDepth;
  uniform float uPerspective;
  uniform vec2 uViewport;
  uniform vec2 uVanish;
  uniform float uFarScale;
  uniform vec2 uFarShift;
  uniform float uFarOpacity;
  uniform float uFarFade;
  uniform float uNearOpacity;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vCore;
  varying float vBig;

  float smoothstep01(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  void main() {
    float size = aSize;
    float alpha = aAlpha;
    if (aNear > 0.5) {
      // Near stars sit along the path, at their depth relative to the camera, in the swayed world.
      float relative = position.z - uDepth;
      vec4 mv = modelViewMatrix * vec4(position.x, position.y, relative * uPerspective, 1.0);
      gl_Position = projectionMatrix * mv;
      size *= uPerspective / max(1.0, -mv.z);
      bool shown = relative < 0.72 && relative > -2.8;
      alpha *= shown ? (1.0 - smoothstep01(0.45, 0.72, relative)) * (1.0 - smoothstep01(1.4, 2.8, -relative)) : 0.0;
      alpha *= uNearOpacity;
    } else {
      // Far stars barely move: a backdrop scaled toward the vanishing point, shifted by the mouse and the drift.
      vec2 screen = uVanish + position.xy * uFarScale + uFarShift;
      gl_Position = vec4(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0, 0.0, 1.0);
      float phase = mod(uTime - aTwinkle.y, 2.0 * aTwinkle.x) / aTwinkle.x;
      float wave = 0.5 - 0.5 * cos(3.14159265 * phase);
      alpha *= mix(1.0, 0.2, wave) * uFarOpacity * (aKeep > 0.5 ? 1.0 : uFarFade);
    }
    vAlpha = alpha;
    vBig = aBig;
    // A big near star has a soft glow around it; every point gets a pixel of room for its antialiased edge.
    float drawn = aBig > 0.5 && aNear > 0.5 ? size * 5.0 : size + 2.0;
    vCore = size / drawn;
    gl_PointSize = drawn * uPixelRatio;
    if (alpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vCore;
  varying float vBig;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float edge = fwidth(d);
    float core = 1.0 - smoothstep(vCore - edge, vCore + edge, d);
    float glow = vBig > 0.5 ? 0.35 * exp(-pow(max(0.0, d - vCore) / (vCore * 1.2), 2.0)) : 0.0;
    float a = vAlpha * max(core, glow);
    if (a < 0.002) discard;
    gl_FragColor = vec4(vec3(1.0) * a, a);
  }
`;
