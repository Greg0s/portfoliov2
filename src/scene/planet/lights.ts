/**
 * The planet's "Noir musée" lighting (main spec §6.3), the prototype's `noir` ambience: a museum spot on the prince and
 * the fox from the top left, a near-null ambient light, a light back light, a very faint environment. The visitor's
 * moment changes the spot's and the sky's colours; at noon they cross-fade. The accent's colours (src/scene/accent.ts)
 * come into these same lights, none added (Grégoire's choice of 9 November 2026): the spot leans toward its green, the
 * sky toward its turquoise, the fill light and the back light take its sky blue.
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
import { accentAt } from '../accent';
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

const accent = (t: number): Color => new Color().setRGB(...accentAt(t), SRGBColorSpace);

/** The moment's colours with the accent in them: the spot leans toward its start, the sky toward its middle. */
export function withAccent(colors: { spot: Color; sky: Color }): { spot: Color; sky: Color } {
  return { spot: colors.spot.clone().lerp(accent(0), 0.6), sky: colors.sky.clone().lerp(accent(0.5), 0.7) };
}

export interface PlanetLights {
  setColors(colors: { spot: Color; sky: Color }): void;
  dispose(): void;
}

export function addLights(scene: Scene, renderer: WebGLRenderer, moment: Moment, shadowSize: number): PlanetLights {
  const pmrem = new LightPMREMGenerator(renderer);
  const room = new RoomEnvironment();
  // Small: the environment is a faint glow (0.035), and its prefiltering's work on the GPU grows with its size.
  const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 64 }).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.035;

  const colors = withAccent({ spot: new Color(momentColors[moment].spot), sky: new Color(momentColors[moment].sky) });
  const sky = new HemisphereLight(colors.sky, 0x000000, 0.06);
  scene.add(sky);
  const directional = (color: Color, intensity: number, offset: [number, number, number]): void => {
    const light = new DirectionalLight(color, intensity);
    light.position.copy(CENTER).add(new Vector3(...offset));
    light.target.position.copy(CENTER);
    scene.add(light, light.target);
  };
  // The fill light, a faint one and the back light, in the accent's sky blue.
  directional(accent(1), 0.35, [-6, 6, -8]);
  directional(accent(1), 0.04, [7, 4, 4]);
  directional(accent(1), 1.3, [-2, -6, -8]);

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

  return {
    setColors(next) {
      const leaned = withAccent(next);
      spot.color.copy(leaned.spot);
      sky.color.copy(leaned.sky);
    },
    dispose() {
      environment.dispose();
      spot.shadow.dispose();
    },
  };
}
