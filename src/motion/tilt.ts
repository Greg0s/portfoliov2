/**
 * On desktop, the camera leans 1 to 2° toward the mouse (journey spec §4), replacing the parallax of the v2: the
 * mouse's place on screen, from -1 to 1 on each axis, followed with a lag so that the scene settles softly.
 */

export interface Pointer {
  /** The mouse on screen, from -1 (left, top) to 1 (right, bottom), smoothed. */
  x: number;
  y: number;
  /** The mouse in px, as it is. */
  clientX: number;
  clientY: number;
}

/** Follows the mouse over `target`; returns the smoothed pointer, its update and a function that stops. */
export function followPointer(target: Window): {
  pointer: Pointer;
  update(delta: number): void;
  /** Whether the smoothed pointer has caught up with the mouse. */
  settled(): boolean;
  stop(): void;
} {
  const pointer: Pointer = { x: 0, y: 0, clientX: -1000, clientY: -1000 };
  let wantX = 0;
  let wantY = 0;
  const move = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    wantX = (event.clientX / target.innerWidth) * 2 - 1;
    wantY = (event.clientY / target.innerHeight) * 2 - 1;
  };
  const leave = (): void => {
    wantX = 0;
    wantY = 0;
    pointer.clientX = -1000;
    pointer.clientY = -1000;
  };
  target.addEventListener('pointermove', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', leave);
  return {
    pointer,
    update(delta) {
      // The mockup's 1.2 s ease-out, as a follow with a time constant of about 0.3 s.
      const k = 1 - Math.exp(-delta / 300);
      pointer.x += (wantX - pointer.x) * k;
      pointer.y += (wantY - pointer.y) * k;
    },
    settled: () => Math.abs(wantX - pointer.x) < 1e-4 && Math.abs(wantY - pointer.y) < 1e-4,
    stop() {
      target.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    },
  };
}

/** The camera's tilt toward the pointer, in degrees (CSS rotateX, rotateY). */
export function tiltToward(pointer: Pointer): { tiltX: number; tiltY: number } {
  return { tiltX: pointer.y * 1, tiltY: -pointer.x * 1.5 };
}
