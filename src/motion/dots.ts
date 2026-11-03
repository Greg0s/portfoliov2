/**
 * The case studies' dots, on a touch screen (CaseStudy.astro): over a slide (slide.ts), the light travels from the dot
 * of the case study left to the one that comes in, in one piece, as a bead on a wire. It stretches with its speed,
 * overshoots a little and settles with a soft squash, and each dot it passes over glints as it goes by. Meanwhile the
 * old dot narrows and the new one widens, so that the row ends as the page drew it.
 */

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** A damped spring from 0 to 1: quick, a little past the end, and back. */
const spring = (t: number): number => (t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(9 * t));

/** Moves the light from the dot at `from` to the current one, over `duration` ms. */
export function moveDots(from: number, duration: number): void {
  const row = document.querySelector<HTMLElement>('.dots');
  if (!row || getComputedStyle(row).display === 'none') return;
  const dots = Array.from(row.querySelectorAll<HTMLElement>(':scope > span:not(.bead)'));
  const to = dots.findIndex((dot) => dot.classList.contains('current'));
  const left = dots[from];
  const current = dots[to];
  if (!left || !current || from === to) return;

  const wide = current.offsetWidth;
  const narrow = left.offsetWidth;
  const height = current.offsetHeight;
  const dim = getComputedStyle(left).backgroundColor;
  const light = getComputedStyle(current).backgroundColor;
  const bead = document.createElement('span');
  bead.className = 'bead';
  Object.assign(bead.style, {
    position: 'absolute',
    top: '50%',
    left: '0',
    width: `${String(wide)}px`,
    height: `${String(height)}px`,
    borderRadius: `${String(height / 2)}px`,
    background: light,
    pointerEvents: 'none',
    willChange: 'transform',
  });
  row.style.position = 'relative';
  row.append(bead);
  for (const dot of [left, current]) dot.style.backgroundColor = dim;

  const passed = new Set<HTMLElement>();
  const glint = (dot: HTMLElement): void => {
    if (passed.has(dot) || dot === left || dot === current) return;
    passed.add(dot);
    dot.animate(
      [
        { scale: '1', backgroundColor: dim },
        { scale: '1.7', backgroundColor: light, offset: 0.25 },
        { scale: '1', backgroundColor: dim },
      ],
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  };

  const centre = (dot: HTMLElement): number => dot.offsetLeft + dot.offsetWidth / 2;
  const start = performance.now();
  let last = 0;
  let lastTime = start;
  const frame = (now: number): void => {
    const t = clamp01((now - start) / duration);
    const grow = easeInOut(t);
    left.style.width = `${String(lerp(wide, narrow, grow))}px`;
    current.style.width = `${String(lerp(narrow, wide, grow))}px`;
    const p = spring(t);
    const x = lerp(centre(left), centre(current), p);
    // Stretched along its way by its speed, squashed as it settles past the end.
    const speed = Math.abs(p - last) / Math.max(1, now - lastTime);
    last = p;
    lastTime = now;
    const stretch = 1 + Math.min(1.4, speed * 260);
    const squash = 1 / Math.sqrt(stretch);
    // Its glow, bright as it leaves, dies down as it settles.
    bead.style.boxShadow = `0 0 ${String(12 * (1 - grow))}px ${light}`;
    bead.style.transform = `translate(${String(x - wide / 2)}px, -50%) scale(${String(stretch)}, ${String(squash)})`;
    for (const dot of dots) if (Math.abs(centre(dot) - x) < 3) glint(dot);
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    bead.remove();
    for (const dot of [left, current]) {
      dot.style.removeProperty('width');
      dot.style.removeProperty('background-color');
    }
  };
  requestAnimationFrame(frame);
}
