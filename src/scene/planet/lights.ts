/**
 * The planet's "Noir musée" lighting (main spec §6.3), the prototype's `noir` ambience: a museum spot on the prince and
 * the fox from the top left, a near-null ambient light, a light cold back light, a very faint environment. The
 * visitor's moment changes the spot's and the sky's colours; at noon they cross-fade.
 */
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { AccentLight } from '../../lib/accent-light';
import { LightPMREMGenerator } from '../pmrem';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Moment } from '../time';

/** The centre the lights aim at, in the model's space. */
export const CENTER = new Vector3(0, 0, -0.58);

/** The colours a moment gives the spot and the sky. */
export const momentColors: Record<Moment, { spot: number; sky: number }> = {
  aube: { spot: 0xffc2a0, sky: 0xe8a890 },
  crepuscule: { spot: 0xffa070, sky: 0xd98a7a },
};

/** How long the moment's colours take to cross-fade, in ms. */
export const MOMENT_FADE = 2000;

/** The spot's and the sky's colours `elapsed` ms into the cross-fade from one moment to the other. */
export function mixMoments(from: Moment, to: Moment, elapsed: number): { spot: Color; sky: Color } {
  const k = Math.max(0, Math.min(1, elapsed / MOMENT_FADE));
  const ease = k * k * (3 - 2 * k);
  const a = momentColors[from];
  const b = momentColors[to];
  return {
    spot: new Color(a.spot).lerp(new Color(b.spot), ease),
    sky: new Color(a.sky).lerp(new Color(b.sky), ease),
  };
}

export interface PlanetLights {
  setColors(colors: { spot: Color; sky: Color }): void;
  dispose(): void;
}

export function addLights(
  scene: Scene,
  renderer: WebGLRenderer,
  moment: Moment,
  shadowSize: number,
  accent: AccentLight | null = null,
): PlanetLights {
  const pmrem = new LightPMREMGenerator(renderer);
  const room = new RoomEnvironment();
  // Small: the environment is a faint glow (0.035), and its prefiltering's work on the GPU grows with its size.
  const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 64 }).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.035;

  const colors = momentColors[moment];
  const sky = new HemisphereLight(colors.sky, 0x000000, 0.06);
  scene.add(sky);
  const directional = (color: number, intensity: number, offset: [number, number, number]): void => {
    const light = new DirectionalLight(color, intensity);
    light.position.copy(CENTER).add(new Vector3(...offset));
    light.target.position.copy(CENTER);
    scene.add(light, light.target);
  };
  // The accent colour proposals' light (`?lumiere=1…3`): its colours, from the gradient's first stop to its last.
  const tint = (t: number): Color => new Color().setRGB(...(accent?.at(t) ?? [1, 1, 1]), SRGBColorSpace);
  const mode = accent?.mode ?? 0;
  directional(mode === 2 ? tint(1).getHex() : 0xffffff, 0.35, [-6, 6, -8]);
  directional(mode === 2 ? tint(1).getHex() : 0xffffff, 0.04, [7, 4, 4]);
  if (mode === 1) {
    // 1. Backlit: two rim lights from behind the planet, the first stop on its left edge and the last on its right,
    // instead of the cold back light.
    directional(tint(0).getHex(), 4, [-4.5, -7, -2]);
    directional(tint(1).getHex(), 4, [4.5, -7, 2]);
    directional(tint(0.5).getHex(), 0.45, [-2, -6, -8]);
  } else {
    // 2. The lights that are already there take the colours, and none is added: the back light the last stop.
    directional(mode === 2 ? tint(1).getHex() : 0xdfe6ff, mode === 2 ? 1.3 : 0.9, [-2, -6, -8]);
  }

  // The museum spot: a pool of light on the characters, the rest of the planet falls into darkness.
  const spot = new SpotLight(colors.spot, 7.5, 0, 0.165, 1, 0);
  spot.position.copy(CENTER).add(new Vector3(-3.5, 8, -6.5));
  spot.target.position.set(-0.25, 0.75, -1.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(shadowSize, shadowSize);
  spot.shadow.bias = -0.0002;
  spot.shadow.normalBias = 0.015;
  spot.shadow.radius = 6;
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 30;
  scene.add(spot, spot.target);

  if (mode === 3) {
    // 3. Two corner spots: the first stop from the bottom left of the screen, the last from the top right (on screen,
    // +x is right and -z is up), each lighting its side of the planet; the museum's lights stay as they are.
    const corner = (color: Color, offset: [number, number, number]): void => {
      const light = new SpotLight(color, 3.2, 0, 0.32, 0.9, 0);
      light.position.copy(CENTER).add(new Vector3(...offset));
      light.target.position.copy(CENTER);
      scene.add(light, light.target);
    };
    corner(tint(0), [-7, 2.5, 6.5]);
    corner(tint(1), [7, 2.5, -6.5]);
  }

  /** In 2, the spot and the sky lean toward the gradient's first stop and its middle, whatever the moment. */
  const lean = (next: { spot: Color; sky: Color }): { spot: Color; sky: Color } =>
    mode === 2 ? { spot: next.spot.clone().lerp(tint(0), 0.6), sky: next.sky.clone().lerp(tint(0.5), 0.7) } : next;
  const first = lean({ spot: spot.color.clone(), sky: sky.color.clone() });
  spot.color.copy(first.spot);
  sky.color.copy(first.sky);

  return {
    setColors(next) {
      const leaned = lean(next);
      spot.color.copy(leaned.spot);
      sky.color.copy(leaned.sky);
    },
    dispose() {
      environment.dispose();
      spot.shadow.dispose();
    },
  };
}
