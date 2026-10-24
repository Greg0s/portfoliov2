/**
 * The environments the office reflects (office spec §3): the sky as an equirectangular picture, for the river and the
 * town, and the room as seen from the desk, for the objects. The sky the visitor sees through the window is HTML.
 */
import {
  BackSide,
  BoxGeometry,
  Color,
  EquirectangularReflectionMapping,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type CanvasTexture,
} from 'three';
import { canvasTexture, ROOM } from './common';
import type { OfficeMoment } from './moments';

/** The sky as an equirectangular picture, for the reflections in the river. */
export function skyTexture(M: OfficeMoment): CanvasTexture {
  const t = canvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h / 2);
      M.sky.forEach((c, i) => {
        grad.addColorStop(i / (M.sky.length - 1), c);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = '#2a2430';
      ctx.fillRect(0, h / 2, w, h / 2);
      // Forward (−z) sits at a quarter of the width.
      const gx = w * (0.25 + M.glow.azimuth / 360);
      const glow = ctx.createRadialGradient(gx, h / 2, 0, gx, h / 2, h * 0.3);
      glow.addColorStop(0, M.glow.color);
      glow.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.globalAlpha = M.glow.strength;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h / 2);
    },
    false,
  );
  t.mapping = EquirectangularReflectionMapping;
  return t;
}

/** The room as seen from the desk, for the reflections of the objects: dim walls, the bright window, the lamp. */
export function roomEnvironmentScene(M: OfficeMoment): Scene {
  const env = new Scene();
  env.add(
    new Mesh(
      new BoxGeometry(5, 3, 5).translate(0, 1.5, 0.8),
      new MeshBasicMaterial({ color: new Color(M.room.hemi[1]).multiplyScalar(1.3), side: BackSide }),
    ),
  );
  const sky = canvasTexture(
    64,
    256,
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      M.sky.forEach((c, i) => {
        grad.addColorStop(i / (M.sky.length - 1), c);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    false,
  );
  const { win, wallZ } = ROOM;
  const pane = new Mesh(new PlaneGeometry(win.x1 - win.x0, win.y1 - win.y0), new MeshBasicMaterial({ map: sky }));
  pane.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, wallZ);
  const lamp = new Mesh(
    new SphereGeometry(0.08, 16, 8),
    new MeshBasicMaterial({ color: new Color(M.room.lamp[0]).multiplyScalar(6) }),
  );
  lamp.position.set(-0.44, 1.1, -1);
  env.add(pane, lamp);
  return env;
}
