/**
 * The handoff between the planet's fallback image and the live planet (main spec §6.4). The live canvas sits over
 * the image and fades in once ready; once it covers it, the image is taken away, so that the scarf moving in the wind
 * never shows the image's scarf behind it. When the planet recedes into a blurred light, the image comes back under
 * the canvas, the canvas fades out, and the scene stops drawing: the real-time render is paid only while it shows.
 */

/** The cross-fade, in ms (the canvas's CSS transition). */
export const HANDOFF_FADE = 400;

export type HandoffState = 'image' | 'in' | 'live' | 'out';

export interface Handoff {
  /** Moves the handoff on; returns whether the live planet must draw this frame. */
  update(wantLive: boolean, now: number): boolean;
  state(): HandoffState;
  /** Gives the page its image back, at once. */
  reset(): void;
}

export function planetHandoff(image: HTMLElement, canvas: HTMLCanvasElement): Handoff {
  let state: HandoffState = 'image';
  let since = 0;
  canvas.style.opacity = '0';

  const enter = (next: HandoffState, now: number): void => {
    state = next;
    since = now;
    canvas.style.opacity = next === 'in' || next === 'live' ? '1' : '0';
    if (next === 'live') image.style.backgroundImage = 'none';
    else image.style.removeProperty('background-image');
  };

  return {
    update(wantLive, now) {
      const done = now - since >= HANDOFF_FADE;
      if (wantLive) {
        if (state === 'image' || state === 'out') enter('in', now);
        else if (state === 'in' && done) enter('live', now);
      } else if (state === 'in' || state === 'live') {
        enter('out', now);
      } else if (state === 'out' && done) {
        enter('image', now);
      }
      return state !== 'image';
    },
    state: () => state,
    reset() {
      state = 'image';
      canvas.style.opacity = '0';
      image.style.removeProperty('background-image');
    },
  };
}
