/**
 * Loading ahead (main spec §6.5): once the opening shows and the page is calm, everything the rest of the visit can
 * ask for is fetched in the background, in the order the visitor meets it, so that nothing waits on the network later:
 *
 * 1. the case studies, from the project in front on round the ring: each page, and its cover at the size this screen
 *    takes, decoded;
 * 2. the office as the contact shows it on this screen and at this moment of the day: its still image, its layers and
 *    where they land (`placement.json`);
 * 3. the pictures of the wall, which the office draws from, and the screen's wallpapers;
 * 4. the captures of the screen's pages (LinkedIn, GitHub, the CV, Instagram).
 *
 * It starts after the page's own load, a little later, so that the opening and its first paint never share the
 * network with it (Lighthouse stays as it is), one file after the other at the lowest priority, and each file waits for
 * a calm moment (nothing scrolled for a quarter of a second, no dive under way). With the browser's data saver on, or a
 * slow connection (2G, 3G), only the case studies' pages are fetched: the rest loads when it is needed, as before.
 *
 * Once per document: the client router keeps it going from page to page.
 */
import { atRest, watchMoves } from './rest';

/** How long after the page's load the queue starts, in ms. */
const START_AFTER = 2000;
/** How long a file waits at most for a calm moment, in ms. */
const PATIENCE = 4000;

interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

/** Whether the visitor asks to spare data, or the connection is slow: then only what is light and next is fetched. */
export function sparing(connection: Connection | undefined): boolean {
  if (!connection) return false;
  return connection.saveData === true || ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '');
}

/** What the home's page lists to load ahead, in order; `spare` keeps the case studies' pages alone. */
export interface Plan {
  pages: string[];
  files: string[];
}

/**
 * The case studies' pages, from the project in front on round the ring, then the office's files, the wall's and the
 * screen's, for a screen `width` px wide at `moment`.
 */
export function planFrom(home: ParentNode, width: number, moment: string): Plan {
  const cards = [...home.querySelectorAll<HTMLAnchorElement>('[data-project] a.card[href]')];
  const front = Math.max(
    0,
    cards.findIndex((card) => card.closest('[data-project]')?.classList.contains('lit')),
  );
  const pages = [...cards.slice(front), ...cards.slice(0, front)].map((card) => card.href);

  const files: string[] = [];
  const office = home.querySelector<HTMLElement>('[data-layers]');
  if (office) {
    const framing = width < 768 ? 'mobile' : 'desktop';
    const picture = office.querySelector<HTMLElement>(`picture.${moment}`);
    const still =
      framing === 'mobile'
        ? picture?.querySelector('source')?.getAttribute('srcset')
        : picture?.querySelector('img')?.getAttribute('src');
    if (still) files.push(still);
    const base = office.dataset.layers ?? '';
    files.push(`${base}/placement.json`);
    for (const layer of ['city', 'room', 'desk']) files.push(`${base}/${moment}-${framing}-${layer}.webp`);
    const pools = JSON.parse(office.dataset.pictures ?? '{}') as Record<string, { src: string }[]>;
    for (const pool of Object.values(pools)) for (const { src } of pool) files.push(src);
    const screen = office.querySelector<HTMLTemplateElement>('template[data-screen-template]')?.content;
    const wallpapers = screen?.querySelector<HTMLElement>('[data-wallpapers]')?.dataset.wallpapers;
    if (wallpapers) files.push(...(JSON.parse(wallpapers) as string[]));
    for (const capture of screen?.querySelectorAll<HTMLImageElement>('img[data-src]') ?? [])
      files.push(capture.dataset.src ?? '');
  }
  return { pages, files: [...new Set(files.filter(Boolean))] };
}

/** The files fetched, the pictures kept decoded: what the queue has done, for the tests. */
const done: string[] = [];
const kept: HTMLImageElement[] = [];
let started = false;

/** What the queue has fetched so far, in order (for the tests and the measurement run). */
export function loadedAhead(): readonly string[] {
  return done;
}

/** Starts the queue from the home's page, once per document. */
export function loadAhead(home: ParentNode): void {
  if (started) return;
  started = true;
  const begin = (): void => {
    setTimeout(() => {
      // Safari has no idle callback: the queue's own calm moments do.
      if ('requestIdleCallback' in window)
        requestIdleCallback(
          () => {
            void run(home);
          },
          { timeout: 2000 },
        );
      else void run(home);
    }, START_AFTER);
  };
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
}

async function run(home: ParentNode): Promise<void> {
  const spare = sparing((navigator as Navigator & { connection?: Connection }).connection);
  const plan = planFrom(home, innerWidth, document.documentElement.dataset.moment ?? 'crepuscule');
  const moves = watchMoves();
  try {
    for (const page of plan.pages) {
      await atRest(moves, PATIENCE);
      const html = await text(page);
      done.push(page);
      if (spare || !html) continue;
      // The cover, as the case study's page will ask for it on this screen.
      const cover = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-case-slug] .cover img');
      if (cover) {
        await atRest(moves, PATIENCE);
        await picture(cover.getAttribute('src') ?? '', {
          srcset: cover.getAttribute('srcset') ?? '',
          sizes: cover.getAttribute('sizes') ?? '',
          decoded: true,
        });
      }
    }
    if (spare) return;
    for (const file of plan.files) {
      await atRest(moves, PATIENCE);
      if (file.endsWith('.json')) await text(file);
      else await picture(file);
      done.push(file);
    }
  } finally {
    moves.stop();
  }
}

/** Fetches `url` at the lowest priority, into the browser's cache; its text, or '' if it failed. */
async function text(url: string): Promise<string> {
  try {
    const response = await fetch(url, { priority: 'low' });
    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
}

/**
 * Loads a picture at the lowest priority, into the browser's cache. `decoded` (the case studies' covers, which show
 * the moment their page does) decodes it too, out of the frame's way, and keeps it for the visit; the others, some of
 * them tall (the screen's captures), are decoded only when they show.
 */
async function picture(
  src: string,
  { srcset = '', sizes = '', decoded = false }: { srcset?: string; sizes?: string; decoded?: boolean } = {},
): Promise<void> {
  if (!src && !srcset) return;
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'low';
  if (sizes) image.sizes = sizes;
  if (srcset) image.srcset = srcset;
  image.src = src;
  try {
    if (decoded) {
      await image.decode();
      kept.push(image);
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => {
          resolve();
        };
        image.onerror = reject;
      });
    }
  } catch {
    // A picture that fails loads again when it is needed.
  }
}
