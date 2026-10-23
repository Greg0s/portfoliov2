/**
 * The cut through the night (main spec §5.5): the view goes dark in 0.25 s, what has to change happens in the dark,
 * then the view comes back in 0.35 s. Header links, the mobile menu, the case study's Contact link and the office's
 * recycle bin all go through it.
 */

const OUT = { duration: 250, easing: 'cubic-bezier(0.32, 0, 0.67, 0)' } as const;
const IN = { duration: 350, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' } as const;

let running = false;

function veil(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-veil]');
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** Whether a cut is under way. */
export function isCutting(): boolean {
  return running;
}

/** Runs `inDark` behind the veil. A cut asked for while another runs does the change at once, without a second veil. */
export async function blackout(inDark: () => void | Promise<void>): Promise<void> {
  const element = veil();
  if (running || !element || typeof element.animate !== 'function') {
    await inDark();
    return;
  }
  running = true;
  element.style.pointerEvents = 'auto';
  try {
    await element.animate([{ opacity: 0 }, { opacity: 1 }], { ...OUT, fill: 'forwards' }).finished;
    await inDark();
    // Two frames for the destination to paint in the dark.
    await nextFrame();
    await nextFrame();
    await element.animate([{ opacity: 1 }, { opacity: 0 }], { ...IN, fill: 'forwards' }).finished;
  } finally {
    element.getAnimations().forEach((animation) => {
      animation.cancel();
    });
    element.style.pointerEvents = '';
    running = false;
  }
}
