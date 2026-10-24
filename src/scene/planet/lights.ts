/**
 * The planet's "Noir musée" lighting (main spec §6.3), the prototype's `noir` ambience: a museum spot on the prince and
 * the fox from the top left, a near-null ambient light, a light cold back light, a very faint environment. The
 * visitor's moment changes the spot's and the sky's colours; at noon they cross-fade.
 */
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  SpotLight,
  Vector3,
  type Scene,
  type WebGLRenderer,
} from 'three';
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

export function addLights(scene: Scene, renderer: WebGLRenderer, moment: Moment, shadowSize: number): PlanetLights {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
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
  directional(0xffffff, 0.35, [-6, 6, -8]);
  directional(0xffffff, 0.04, [7, 4, 4]);
  directional(0xdfe6ff, 0.9, [-2, -6, -8]);

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
      spot.color.copy(next.spot);
      sky.color.copy(next.sky);
    },
    dispose() {
      environment.dispose();
      spot.shadow.dispose();
    },
  };
}
