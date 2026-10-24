/**
 * The weightless job title of the opening (main spec §4, the « Apesanteur » title of the mockup): every 2.4 s, the
 * letters of the job float away one after the other, rising and turning, while the next job's letters land. With
 * "reduce motion", the jobs cross-fade in 0.5 s. Screen readers read the whole list once, from the hidden text.
 */
import { onTick } from './ticker';

const WAIT = 2400;
const FLOAT = 1800;
const FADE = 500;

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const outCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const inOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

function letters(word: string): HTMLSpanElement[] {
  return Array.from(new Intl.Segmenter().segment(word), ({ segment }) => segment).map((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    return span;
  });
}

function layer(spans: HTMLSpanElement[]): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'job-layer';
  span.append(...spans);
  return span;
}

export interface JobTitleOptions {
  reduce: boolean;
  /** Whether the title waits (the opening's text has faded out, the scene is frozen). */
  paused: () => boolean;
}

/** Animates the job title in `element` through `words`; returns a function that stops it. */
export function startJobTitle(element: HTMLElement, words: readonly string[], options: JobTitleOptions): () => void {
  if (words.length < 2) return () => undefined;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopTick: (() => void) | undefined;
  let from = letters(words[0] ?? '');
  element.replaceChildren(layer(from));

  const schedule = (): void => {
    timer = setTimeout(start, WAIT);
  };

  function start(): void {
    if (options.paused() || document.hidden) {
      schedule();
      return;
    }
    const i = index;
    const fromWord = words[i] ?? '';
    const toWord = words[(i + 1) % words.length] ?? '';
    const to = letters(toWord);
    const incoming = layer(to);
    element.append(incoming);
    const duration = options.reduce ? FADE : FLOAT;
    let t0 = -1;
    stopTick = onTick((now) => {
      if (t0 < 0) t0 = now;
      const p = Math.min(1, (now - t0) / duration);
      if (options.reduce) {
        from.forEach((span) => (span.style.opacity = (1 - p).toFixed(3)));
        to.forEach((span) => (span.style.opacity = p.toFixed(3)));
      } else {
        const lastFrom = Math.max(1, fromWord.length - 1);
        from.forEach((span, k) => {
          const e = inOutSine(clamp((p - (k / lastFrom) * 0.35) / 0.45));
          const r = (hash(k + i * 31) - 0.5) * 50;
          const dx = (hash(k * 7 + i) - 0.5) * 16;
          span.style.transform = `translate(${(dx * e).toFixed(1)}px, ${(-26 * e).toFixed(1)}px) rotate(${(r * e).toFixed(1)}deg)`;
          span.style.opacity = (1 - e).toFixed(3);
          span.style.filter = `blur(${(1.5 * e).toFixed(2)}px)`;
        });
        const lastTo = Math.max(1, toWord.length - 1);
        to.forEach((span, k) => {
          const e = outCubic(clamp((p - 0.3 - (k / lastTo) * 0.35) / 0.45));
          const r = (hash(k * 3 + i * 17 + 5) - 0.5) * 40;
          span.style.transform = `translateY(${(20 * (1 - e)).toFixed(1)}px) rotate(${(r * (1 - e)).toFixed(1)}deg)`;
          span.style.opacity = e.toFixed(3);
          span.style.filter = `blur(${(1.5 * (1 - e)).toFixed(2)}px)`;
        });
      }
      if (p < 1) return;
      stopTick?.();
      stopTick = undefined;
      index = (i + 1) % words.length;
      from = letters(toWord);
      element.replaceChildren(layer(from));
      schedule();
    });
  }

  schedule();
  return () => {
    clearTimeout(timer);
    stopTick?.();
    from = letters(words[0] ?? '');
    element.replaceChildren(layer(from));
  };
}
