/**
 * The office's lights (office spec §4): outside, the sky, a low sun behind the hills and the glow of the sky behind
 * the flat, for the town; inside, the desk lamp, the window, the light bouncing off the room behind us and the faint
 * glow of the screen, for the room and the desk. Each set lights only its own pass.
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
  Quaternion,
  RectAreaLight,
  SpotLight,
  Vector3,
  type Light,
} from 'three';
import { DEG, ROOM, SCREEN } from './common';
import type { OfficeMoment } from './moments';
import type { Desk } from './objects';
import { CITY } from './town';

export interface OfficeLights {
  exterior: Group;
  interior: Group;
  /** Sets every light to a moment's colours and strengths. */
  set(moment: OfficeMoment): void;
}

const all = <T extends Light>(light: T): T => {
  light.layers.enableAll();
  return light;
};

export function buildLights(M: OfficeMoment, desk: Desk, shadowSize = 2048): OfficeLights {
  const exterior = new Group();
  const hemiOut = all(new HemisphereLight());
  const sun = all(new DirectionalLight());
  sun.target.position.set(0, CITY.land, -500);
  const fill = all(new DirectionalLight());
  fill.position.set(-300, 500, 800);
  fill.target.position.set(0, CITY.land, -500);
  exterior.add(hemiOut, sun, sun.target, fill, fill.target);

  const interior = new Group();
  const hemiIn = all(new HemisphereLight());
  desk.group.updateMatrixWorld(true);
  const spot = all(new SpotLight(0xffffff, 1, 4, 0.8, 0.75, 2));
  desk.lampLight.getWorldPosition(spot.position);
  spot.target.position
    .copy(spot.position)
    .addScaledVector(desk.lampAxis.clone().transformDirection(desk.lamp.matrixWorld), 0.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(shadowSize, shadowSize);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.015;
  spot.shadow.radius = 6;
  spot.shadow.camera.near = 0.03;
  spot.shadow.camera.far = 4;
  spot.shadow.camera.layers.enableAll();
  interior.add(hemiIn, spot, spot.target);
  const glow = all(new PointLight(0xffffff, 0.6, 1.4, 2));
  glow.position.copy(spot.position);
  glow.position.y += 0.03;
  interior.add(glow);

  const { win, wallZ } = ROOM;
  const winLight = all(new RectAreaLight(0xffffff, 1, win.x1 - win.x0, win.y1 - win.y0));
  winLight.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ - 0.05);
  winLight.lookAt(winLight.position.x, winLight.position.y, 2);
  interior.add(winLight);
  // Light bouncing off the room behind us, so that the wall and the fronts of the objects do not fall into black.
  const bounce = all(new RectAreaLight(0xffffff, 1, 3, 1.6));
  bounce.position.set(0, 1.2, 1.2);
  bounce.lookAt(0, 1.2, ROOM.wallZ);
  interior.add(bounce);
  // A soft key from the window, so that the objects cast their shadows toward the camera.
  const back = all(new DirectionalLight(0xffffff, 0.45));
  back.position.set(0.1, 2.6, -4);
  back.target.position.set(0.1, ROOM.deskY, -0.8);
  back.castShadow = true;
  back.shadow.mapSize.set(shadowSize, shadowSize);
  back.shadow.camera.left = -1.8;
  back.shadow.camera.right = 1.8;
  back.shadow.camera.top = 1.2;
  back.shadow.camera.bottom = -1.2;
  back.shadow.camera.near = 0.5;
  back.shadow.camera.far = 6;
  back.shadow.bias = -0.0005;
  back.shadow.radius = 8;
  back.shadow.camera.layers.enableAll();
  interior.add(back, back.target);

  const screen = desk.monitor.getObjectByName('screen');
  const screenLight = all(new RectAreaLight(0xffffff, 1, SCREEN.w, SCREEN.h));
  if (screen) {
    screen.getWorldPosition(screenLight.position);
    const n = new Vector3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new Quaternion()));
    screenLight.lookAt(screenLight.position.clone().add(n));
  }
  interior.add(screenLight);

  const tone = (light: Light, [color, intensity]: readonly [string, number]): void => {
    light.color.set(color);
    light.intensity = intensity;
  };
  const set = (m: OfficeMoment): void => {
    hemiOut.color.set(m.city.hemi[0]);
    hemiOut.groundColor.set(m.city.hemi[1]);
    hemiOut.intensity = m.city.hemi[2];
    const a = m.glow.azimuth * DEG;
    sun.position.set(Math.sin(a) * 1000, 60, -Math.cos(a) * 1000);
    tone(sun, m.city.sun);
    tone(fill, m.city.fill);
    hemiIn.color.set(m.room.hemi[0]);
    hemiIn.groundColor.set(m.room.hemi[1]);
    hemiIn.intensity = m.room.hemi[2];
    tone(spot, m.room.lamp);
    glow.color = new Color(m.room.lamp[0]);
    tone(winLight, m.room.window);
    tone(bounce, m.room.bounce);
    back.color.set(m.room.window[0]);
    tone(screenLight, m.room.screen);
  };
  set(M);
  return { exterior, interior, set };
}
