/**
 * The sky's shaders. Everything is drawn in quads that face the camera, in the journey's camera (world units are CSS
 * px at the focus plane, the camera `perspective` px in front of it), and fades with its depth as the cards do:
 *
 * - sprites: the stars, the out-of-focus lights, the suns and the small worlds, in one geometry;
 * - planets: a sphere drawn in its quad (no mesh to antialias), wearing the project's picture, with a ring;
 * - ribbons: the constellations' lines and the orbits, as thin quads drawn on screen, which draw themselves along their
 *   path.
 */

/** The depth fade, from the depth in front of the focus plane (as `depthFade` in sky.ts). */
const fade = /* glsl */ `
  float sstep(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }
  float depthFade(float rel) {
    if (rel >= 0.72) return 0.0;
    float near = rel > 0.0 ? 1.0 - sstep(0.36, 0.72, rel) : 1.0 - 0.75 * sstep(0.12, 1.3, -rel);
    return near * (1.0 - sstep(0.6, 2.2, -rel));
  }
`;

export const spriteVertex = /* glsl */ `
  attribute vec2 aCorner;
  attribute float aSize;
  attribute float aKind;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aGroup;
  attribute float aBody;

  uniform float uTime;
  uniform float uPerspective;
  uniform vec2 uViewport;
  uniform float uPx;
  uniform float uAlpha;
  uniform float uGroupAlpha[2];
  uniform float uBodyGlow[8];
  uniform float uBodyDim[8];
  uniform float uFocusRel;
  uniform float uBokeh;

  varying vec2 vQ;
  varying float vKind;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vPx;
  varying float vSharp;
  varying float vSeed;
  varying float vGlow;

  ${fade}

  float extentOf(float kind) {
    if (kind < 0.5) return 5.0;   // glow star
    if (kind < 1.5) return 14.0;  // star with spikes
    if (kind < 2.5) return 1.25;  // bokeh, round
    if (kind < 3.5) return 1.25;  // bokeh, hexagon
    if (kind < 4.5) return 3.4;   // orb
    if (kind < 5.5) return 3.6;   // ringed orb
    if (kind < 6.5) return 3.6;   // planet and moon
    if (kind < 7.5) return 2.4;   // five-pointed star
    return 11.0;                  // sun
  }

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.0, -mv.z);
    float scale = uPerspective / dist;
    float rel = 1.0 + mv.z / uPerspective;
    float alpha = aAlpha * uAlpha * depthFade(rel);
    float glow = 0.0;
    if (aBody >= 0.0) {
      int b = int(aBody + 0.5);
      glow = uBodyGlow[b];
      alpha *= 1.0 - 0.72 * uBodyDim[b];
    } else if (aGroup < 1.5) {
      alpha *= uGroupAlpha[int(aGroup + 0.5)];
    }
    // The stars far away twinkle a little.
    if (aKind < 0.5 && aBody < 0.0) alpha *= 0.72 + 0.28 * sin(uTime * 0.0011 * (0.6 + aSeed) + aSeed * 40.0);
    float size = aSize * uPx * scale * (1.0 + 0.35 * glow);
    float sharp = 1.0;
    if (uBokeh > 0.5) {
      // Out of the focus plane, a light spreads into a disc: the further, the wider and the fainter.
      float coc = 90.0 * abs(rel - uFocusRel) * uPx * scale;
      float grown = sqrt(size * size + coc * coc);
      sharp = size / grown;
      if (aKind > 1.5 && aKind < 3.5) {
        alpha *= mix(0.16, 1.0, pow(sharp, 1.1));
        size = grown;
      } else {
        // The project's lights stay readable: they spread less, and keep more of their light.
        size = mix(grown, size, 0.35);
        alpha *= mix(0.4, 1.0, sharp);
      }
    }
    float extent = extentOf(aKind);
    vec4 clip = projectionMatrix * mv;
    float halfSize = size * extent + 1.5;
    clip.xy += aCorner * halfSize * 2.0 / uViewport * clip.w;
    gl_Position = alpha < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : clip;
    vQ = aCorner * halfSize / max(size, 0.001);
    vKind = aKind;
    vAlpha = alpha;
    vColor = aColor;
    vPx = size;
    vSharp = sharp;
    vSeed = aSeed;
    vGlow = glow;
  }
`;

export const spriteFragment = /* glsl */ `
  varying vec2 vQ;
  varying float vKind;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vPx;
  varying float vSharp;
  varying float vSeed;
  varying float vGlow;

  float disc(float d, float r, float aa) {
    return 1.0 - smoothstep(r - aa, r + aa, d);
  }

  float star5(vec2 p, float r, float rf) {
    // A five-pointed star's distance (Inigo Quilez's sdStar5).
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x, k1.y);
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
  }

  void main() {
    vec2 q = vQ;
    float d = length(q);
    float aa = 1.0 / max(vPx, 0.5);
    float a = 0.0;
    vec3 color = vColor;
    if (vKind < 0.5) {
      // A star: a sharp core and a soft halo.
      a = disc(d, 1.0, aa) + 0.42 * exp(-d * d / 4.5) + vGlow * 0.5 * exp(-d * d / 9.0);
    } else if (vKind < 1.5) {
      // A bright star, as a telescope sees it: its core, its halo and four thin spikes.
      float core = disc(d, 1.0, aa);
      float halo = 0.5 * exp(-d * d / 5.0) + 0.16 * exp(-d / 3.2);
      float thin = 0.55 / max(vPx, 1.0);
      float reach = 12.0 * (0.55 + 0.45 * vGlow);
      float sx = exp(-abs(q.y) / thin) * max(0.0, 1.0 - abs(q.x) / reach);
      float sy = exp(-abs(q.x) / thin) * max(0.0, 1.0 - abs(q.y) / reach);
      a = core + halo + 0.75 * (sx + sy) * (0.6 + 0.4 * vGlow) + vGlow * 0.35 * exp(-d * d / 18.0);
    } else if (vKind < 3.5) {
      // A light out of focus: a disc, brighter at its rim, which closes into a star in the focus plane.
      float r = vKind < 2.5 ? d : max(dot(abs(q), vec2(0.866025, 0.5)), abs(q.y)) / 0.94;
      float edge = mix(0.08, aa * 1.5, vSharp);
      float body = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
      float rim = 0.22 * smoothstep(0.55, 0.98, r) * body * (1.0 - vSharp);
      float halo = vSharp * 0.45 * exp(-d * d / 0.6);
      a = body * (0.78 + rim) + halo;
    } else if (vKind < 4.5) {
      // A small world: a white disc that glows.
      a = disc(d, 1.0, aa) * 0.92 + 0.35 * exp(-(d - 1.0) * 1.6) * step(1.0, d);
    } else if (vKind < 5.5) {
      // A planet and its ring, seen at an angle.
      float body = disc(d, 1.0, aa);
      float c = cos(-0.32);
      float s = sin(-0.32);
      vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
      float e = length(vec2(r.x, r.y * 3.4));
      float ring = (1.0 - smoothstep(0.1, 0.1 + aa * 3.0, abs(e - 2.25))) * 0.9;
      // The ring passes behind the planet's top half.
      ring *= 1.0 - body * step(0.0, r.y);
      a = max(body * 0.92, ring) + 0.25 * exp(-(d - 1.0) * 1.8) * step(1.0, d);
    } else if (vKind < 6.5) {
      // A planet and its moon.
      float body = disc(d, 1.0, aa);
      float moon = disc(length(q - vec2(2.3, -1.1)), 0.36, aa);
      a = max(body * 0.92, moon * 0.8) + 0.25 * exp(-(d - 1.0) * 1.8) * step(1.0, d);
    } else if (vKind < 7.5) {
      // A little five-pointed star.
      float s5 = star5(q, 1.6, 0.45);
      a = (1.0 - smoothstep(-aa, aa, s5)) * 0.9 + 0.2 * exp(-d * d / 3.0);
    } else {
      // A sun: a white core in a wide light.
      float wide = 0.38 * exp(-d / 2.6) + 0.12 * exp(-d / 7.0);
      // The wide light fades out before the quad's edge, so that no square shows around the sun.
      a = disc(d, 1.0, aa) + 0.85 * exp(-d * d / 5.0) + wide * (1.0 - smoothstep(6.5, 10.8, d));
      color = mix(vec3(1.0), vColor, smoothstep(0.5, 2.0, d));
    }
    a *= vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(color * a, a);
  }
`;

export const planetVertex = /* glsl */ `
  attribute vec2 aCorner;

  uniform float uPerspective;
  uniform vec2 uViewport;
  uniform float uPx;
  uniform float uRadius;
  uniform float uExtent;
  uniform float uAlpha;

  varying vec2 vQ;
  varying float vPx;
  varying float vAlpha;

  ${fade}

  void main() {
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float dist = max(1.0, -mv.z);
    float scale = uPerspective / dist;
    float rel = 1.0 + mv.z / uPerspective;
    float size = uRadius * uPx * scale;
    vec4 clip = projectionMatrix * mv;
    float halfSize = size * uExtent + 1.5;
    clip.xy += aCorner * halfSize * 2.0 / uViewport * clip.w;
    vAlpha = uAlpha * depthFade(rel);
    gl_Position = vAlpha < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : clip;
    vQ = aCorner * halfSize / max(size, 0.001);
    vPx = size;
  }
`;

export const planetFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec4 uCell;
  uniform float uSpin;
  uniform float uAxis;
  uniform vec3 uLight;
  uniform vec3 uTint;
  uniform float uGlow;
  uniform float uDim;
  uniform float uRing;
  uniform vec3 uRingNormal;
  uniform vec2 uRingSize;
  uniform float uRingAlpha;
  uniform float uReady;
  uniform float uAmbient;

  varying vec2 vQ;
  varying float vPx;
  varying float vAlpha;

  const float PI = 3.14159265;

  vec4 over(vec4 top, vec4 under) {
    return top + under * (1.0 - top.a);
  }

  void main() {
    vec2 q = vQ;
    float r2 = dot(q, q);
    float d = sqrt(r2);
    float aa = 1.2 / max(vPx, 1.0);
    vec4 result = vec4(0.0);

    // The light around it: its group's, wider while it shows.
    float halo = d > 1.0 ? exp(-(d - 1.0) * 9.0) * 0.42 + uGlow * 0.32 * exp(-(d - 1.0) * 2.6) : 0.0;
    result = vec4(uTint * halo, halo) * (1.0 - 0.6 * uDim);

    float nz = sqrt(max(0.0, 1.0 - r2));
    vec3 n = vec3(q, nz);
    float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    if (inside > 0.0) {
      // The picture, wrapped on the half of the sphere that faces us, its mirror on the other half.
      float ca = cos(uAxis);
      float sa = sin(uAxis);
      vec3 m = vec3(ca * n.x - sa * n.y, sa * n.x + ca * n.y, n.z);
      float cs = cos(uSpin);
      float ss = sin(uSpin);
      m = vec3(cs * m.x + ss * m.z, m.y, -ss * m.x + cs * m.z);
      float lon = atan(m.x, m.z);
      float lat = asin(clamp(m.y, -1.0, 1.0));
      if (abs(lon) > PI * 0.5) lon = sign(lon) * PI - lon;
      vec2 uv = vec2(0.5 + lon / PI, clamp(0.5 + lat / 1.92, 0.012, 0.988));
      vec3 picture = texture2D(uAtlas, uCell.xy + uv * uCell.zw).rgb;
      picture = mix(vec3(0.16, 0.16, 0.18), picture, uReady);
      float light = smoothstep(-0.28, 0.85, dot(n, uLight));
      vec3 color = picture * (uAmbient + (1.1 - uAmbient) * light);
      // Its atmosphere, at the edge.
      float rim = pow(1.0 - nz, 2.6);
      color += uTint * rim * (0.22 + 0.5 * light) * (0.7 + 0.6 * uGlow);
      color *= 1.0 - 0.55 * uDim;
      result = over(vec4(color, 1.0) * inside, result);
    }

    if (uRing > 0.5) {
      // The ring: where the line of sight meets its plane, between its two radii; hidden behind the planet.
      float zq = -(uRingNormal.x * q.x + uRingNormal.y * q.y) / uRingNormal.z;
      float rho = length(vec3(q, zq));
      float w = fwidth(rho) * 1.2;
      float band = smoothstep(uRingSize.x - w, uRingSize.x + w, rho) * (1.0 - smoothstep(uRingSize.y - w, uRingSize.y + w, rho));
      float stripes = 0.62 + 0.38 * sin((rho - uRingSize.x) / (uRingSize.y - uRingSize.x) * 18.0);
      float ringA = band * stripes * uRingAlpha * (1.0 - 0.6 * uDim) * (0.75 + 0.5 * uGlow);
      vec4 ring = vec4(mix(vec3(1.0), uTint, 0.75) * ringA, ringA);
      bool behind = inside > 0.5 && zq < nz;
      if (!behind) result = over(ring, result);
    }

    result *= vAlpha;
    if (result.a < 0.002) discard;
    gl_FragColor = result;
  }
`;

export const ribbonVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aSide;
  attribute float aAlong;
  attribute vec2 aT;
  attribute float aChannel;
  attribute float aDash;

  uniform float uPerspective;
  uniform vec2 uViewport;
  uniform float uWidth;
  uniform float uAlpha;
  uniform float uDraw[10];
  uniform float uChannelAlpha[10];
  uniform vec3 uChannelColor[10];
  uniform float uFocusRel;
  uniform float uBokeh;

  varying float vSide;
  varying float vT;
  varying float vDraw;
  varying float vAlpha;
  varying float vDist;
  varying float vDash;
  varying float vHalf;
  varying vec3 vColor;

  ${fade}

  void main() {
    vec4 m0 = modelViewMatrix * vec4(aStart, 1.0);
    vec4 m1 = modelViewMatrix * vec4(aEnd, 1.0);
    vec4 c0 = projectionMatrix * m0;
    vec4 c1 = projectionMatrix * m1;
    vec2 s0 = c0.xy / c0.w * uViewport * 0.5;
    vec2 s1 = c1.xy / c1.w * uViewport * 0.5;
    vec2 dir = normalize(s1 - s0 + vec2(1e-5));
    vec2 normal = vec2(-dir.y, dir.x);
    vec4 mv = mix(m0, m1, aAlong);
    vec4 clip = mix(c0, c1, aAlong);
    float halfSize = uWidth * 0.5 + 1.0;
    clip.xy += normal * aSide * halfSize * 2.0 / uViewport * clip.w;
    float rel = 1.0 + mv.z / uPerspective;
    int ch = int(aChannel + 0.5);
    float alpha = uAlpha * uChannelAlpha[ch] * depthFade(rel);
    if (uBokeh > 0.5) alpha *= mix(0.25, 1.0, 1.0 - smoothstep(0.03, 0.4, abs(rel - uFocusRel)));
    vAlpha = alpha;
    vDraw = uDraw[ch];
    vT = mix(aT.x, aT.y, aAlong);
    vSide = aSide * halfSize;
    vHalf = uWidth * 0.5;
    vDist = aAlong * length(s1 - s0);
    vDash = aDash;
    vColor = uChannelColor[ch];
    gl_Position = c0.w <= 0.0 || c1.w <= 0.0 || alpha < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : clip;
  }
`;

export const ribbonFragment = /* glsl */ `
  varying float vSide;
  varying float vT;
  varying float vDraw;
  varying float vAlpha;
  varying float vDist;
  varying float vDash;
  varying float vHalf;
  varying vec3 vColor;

  void main() {
    float a = 1.0 - smoothstep(vHalf - 0.5, vHalf + 0.5, abs(vSide));
    // Drawn along its path up to vDraw, its head soft.
    a *= 1.0 - smoothstep(vDraw - 0.015, vDraw + 0.001, vT);
    if (vDash > 0.0) {
      float phase = mod(vDist, vDash) / vDash;
      a *= smoothstep(0.0, 0.08, phase) * (1.0 - smoothstep(0.5, 0.58, phase));
    }
    a *= vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;
