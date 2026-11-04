/**
 * The arrival on the home (journey spec §6, chosen by Grégoire on 2 November 2026): the screen is dark, the planet
 * lights up, the night around it lifts on the stars and the decor, the name and the job land letter by letter, then
 * the header and the call show. A gesture (wheel, finger, key, click, a scroll) plays the rest six times faster.
 *
 * It plays when a visit starts on the opening of the journey: not on a page reached from the site itself (a change of
 * language), on another anchor (`#contact`, a project), through the client router, or with `?still=1`. Without the
 * journey (no JavaScript, "reduce motion", the light version), the opening shows at once.
 *
 * Both functions are self-contained: the opening inlines their sources, so that the first paint is already dark and
 * the arrival never waits for the site's scripts, only for the planet's image.
 */

/** Before the opening's content: decides whether the arrival plays, so that the first paint is already dark. */
export function applyArrival(fragment: string): void {
  const html = document.documentElement;
  const hash = decodeURIComponent(location.hash.slice(1));
  let fromSite = false;
  try {
    fromSite = document.referrer !== '' && new URL(document.referrer).origin === location.origin;
  } catch {
    // An unreadable referrer is another site's.
  }
  const plays =
    html.dataset.journey === 'on' &&
    document.readyState === 'loading' &&
    new URLSearchParams(location.search).get('still') !== '1' &&
    !fromSite &&
    (hash === '' || hash === fragment);
  if (plays) html.dataset.arrival = 'waiting';
  else delete html.dataset.arrival;
}

/** After the opening's content: plays the arrival, once the planet's image (and the fonts) are ready. */
export function playArrival(): void {
  const html = document.documentElement;
  const opening = document.querySelector<HTMLElement>('.opening');
  if (html.dataset.arrival !== 'waiting' || !opening) return;

  const EASE_UI = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_FLOAT = 'cubic-bezier(0.37, 0, 0.63, 1)';
  const EASE_SETTLE = 'cubic-bezier(0.33, 1, 0.68, 1)';
  /** How much faster the rest plays after a gesture. */
  const HURRY = 6;
  /** The longest wait for the planet's image and the fonts, after which the arrival plays anyway. */
  const WAIT = 1500;

  const animations: Animation[] = [];
  const restores: (() => void)[] = [];
  let speed = 1;
  let done = false;

  const play = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): void => {
    if (!element) return;
    const animation = element.animate(keyframes, { fill: 'both', ...options });
    if (speed !== 1) animation.updatePlaybackRate(speed);
    animations.push(animation);
  };

  /** A stable pseudo-random number in [0, 1) for `n`. */
  const hash = (n: number): number => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  /**
   * Splits an element holding a single text into letters (inline blocks, in words so that lines still break), set
   * at the places the text's kerning gives them, so that putting the text back at the end moves nothing. Screen
   * readers read a hidden copy meanwhile.
   */
  const split = (element: HTMLElement | null): HTMLSpanElement[] => {
    const node = element?.firstChild;
    if (!element || !(node instanceof Text) || element.childNodes.length !== 1) return [];
    const text = node.data;
    const chars = Array.from(text);
    // Where the kerned text puts each character.
    const range = document.createRange();
    const lefts: number[] = [];
    let offset = 0;
    chars.forEach((char) => {
      range.setStart(node, offset);
      range.setEnd(node, offset + char.length);
      lefts.push(range.getBoundingClientRect().left);
      offset += char.length;
    });
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = text;
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    const letters: HTMLSpanElement[] = [];
    const pairs: [number, number][] = [];
    let word: HTMLSpanElement | null = null;
    chars.forEach((char, i) => {
      if (/\s/.test(char)) {
        word = null;
        shown.append(document.createTextNode(' '));
        return;
      }
      if (!word) {
        word = document.createElement('span');
        word.className = 'arrival-word';
        shown.append(word);
      } else {
        pairs.push([letters.length - 1, i]);
      }
      const letter = document.createElement('span');
      letter.className = 'arrival-letter';
      letter.textContent = char;
      word.append(letter);
      letters.push(letter);
    });
    element.replaceChildren(spoken, shown);
    restores.push(() => {
      element.replaceChildren(node);
    });
    // Within a word, each letter keeps the advance it has in the kerned text.
    const index = chars.map((_, i) => i).filter((i) => !/\s/.test(chars[i] ?? ''));
    const widths = letters.map((letter) => letter.getBoundingClientRect().width);
    pairs.forEach(([previous, charIndex]) => {
      const from = index[previous];
      const left = from === undefined ? undefined : lefts[from];
      const next = lefts[charIndex];
      const width = widths[previous];
      if (left === undefined || next === undefined || width === undefined) return;
      const letter = letters[previous];
      if (letter) letter.style.marginRight = `${(next - left - width).toFixed(2)}px`;
    });
    return letters;
  };

  /** The letters land one after the other: each rises into place, turning back straight and sharpening. */
  const land = (letters: HTMLSpanElement[], delay: number, span: number, seed: number): void => {
    const stagger = Math.min(55, span / Math.max(1, letters.length - 1));
    letters.forEach((letter, i) => {
      const dx = (hash(i * 7 + seed) - 0.5) * 0.3;
      const dy = 0.45 + hash(i * 3 + seed) * 0.35;
      const r = (hash(i * 11 + seed) - 0.5) * 36;
      play(
        letter,
        [
          {
            opacity: 0,
            transform: `translate(${dx.toFixed(3)}em, ${dy.toFixed(3)}em) rotate(${r.toFixed(1)}deg) scale(0.9)`,
            filter: 'blur(5px)',
          },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        ],
        { delay: delay + i * stagger, duration: 1100, easing: EASE_UI },
      );
    });
  };

  const gestures = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'] as const;
  const startY = window.scrollY;
  const hurry = (event: Event): void => {
    // A scroll the arrival didn't ask for (the browser putting the page back where it was) hurries it too.
    if (event.type === 'scroll' && Math.abs(window.scrollY - startY) < 40) return;
    speed = HURRY;
    animations.forEach((animation) => {
      animation.updatePlaybackRate(HURRY);
    });
    unlisten();
  };
  function unlisten(): void {
    gestures.forEach((name) => {
      window.removeEventListener(name, hurry, true);
    });
  }
  gestures.forEach((name) => {
    window.addEventListener(name, hurry, { capture: true, passive: true });
  });

  /** Lets the opening go back to its own styles and text, as the arrival leaves them. */
  const finish = (): void => {
    if (done) return;
    done = true;
    unlisten();
    document.removeEventListener('astro:before-swap', finish);
    restores.forEach((restore) => {
      restore();
    });
    animations.forEach((animation) => {
      animation.cancel();
    });
    delete html.dataset.arrival;
  };
  document.addEventListener('astro:before-swap', finish);

  const start = (): void => {
    if (done || html.dataset.arrival !== 'waiting') return;
    const planet = opening.querySelector('.planet-image');
    // In the dark, the planet lights up, a little past its light before it settles.
    play(planet, [{ opacity: 0, offset: 0 }], { delay: 300, duration: 1700, easing: EASE_FLOAT });
    play(
      planet,
      [
        { filter: 'brightness(0.2)', easing: EASE_FLOAT },
        { filter: 'brightness(1.1)', offset: 0.55, easing: EASE_SETTLE },
        { filter: 'brightness(1)' },
      ],
      { delay: 300, duration: 3000 },
    );
    // The night lifts on the stars, the sky and the decor.
    play(opening.querySelector('.night'), [{ opacity: 1 }, { opacity: 0 }], {
      delay: 1400,
      duration: 2400,
      easing: EASE_FLOAT,
    });
    // The name, then the job, land letter by letter, as the text rises a little into place.
    const titles = opening.querySelector('.titles');
    play(titles, [{ transform: 'translateY(12px)' }, { transform: 'none' }], {
      delay: 1800,
      duration: 2400,
      easing: EASE_UI,
    });
    land(split(opening.querySelector<HTMLElement>('.intro h1')), 1800, 600, 0);
    land(split(opening.querySelector<HTMLElement>('.intro .job')), 2350, 520, 101);
    // Then the header and the call.
    const appear = (element: Element | null, delay: number): void => {
      play(element, [{ opacity: 0, offset: 0 }], { delay, duration: 900, easing: 'ease' });
    };
    appear(document.querySelector('.header'), 3400);
    appear(opening.querySelector('.cta-text'), 3550);
    appear(opening.querySelector('.cta-line'), 3670);
    html.dataset.arrival = 'playing';
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
  };

  // The planet's image, as the opening shows it (the moment's, the screen's).
  const source = /url\(["']?([^"')]+)["']?\)/.exec(
    getComputedStyle(opening.querySelector('.planet-image') ?? opening).backgroundImage,
  )?.[1];
  const ready: Promise<unknown>[] = [document.fonts.ready];
  if (source) {
    const image = new Image();
    image.src = source;
    ready.push(image.decode());
  }
  void Promise.race([
    Promise.allSettled(ready),
    new Promise((resolve) => {
      setTimeout(resolve, WAIT);
    }),
  ]).then(start);
}
