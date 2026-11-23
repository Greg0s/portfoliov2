/**
 * The pictures' labels (office spec §3): on desktop, hovering a picture of the wall shows its cartel under it, in 200 ms
 * with a 4 px rise (none with reduced motion), and it fades out
 * in 140 ms. On phones, a tap on the small frame of the desk shows its cartel above it, and a tap elsewhere closes it.
 * They answer once the camera is at rest, slide with the head as their layer does, and stay decorative for screen
 * readers. A picture with nothing known has no cartel.
 *
 * A picture with a post on Instagram links to it, in a new tab: on desktop the picture itself, under the light disc
 * that follows the mouse over the projects' cards (`src/motion/cursor.ts`), here saying "See on Instagram"; on phones,
 * a link at the foot of its cartel. Like the rest of the office, they stay out of the keyboard's way: the contact's own
 * links lead to Instagram.
 */
import type { Placement, Quad } from './corners';
import type { FrameSpec } from './frame';
import type { Framing } from './framings';
import type { Head } from './live';

/** What a cartel says, as the contact section gives it (`src/lib/wall.ts` decides what is known). */
export interface Cartel {
  main: string;
  /** A title of a work, in the light italic of titles; without one, `main` is set like an author line. */
  isTitle: boolean;
  sub?: string;
  /** A last line: a credit the picture requires. */
  note?: string;
}

/** A picture as drawn for a frame: its file, its focus, and its cartel if anything is known. */
export interface WallPicture {
  src: string;
  focus: [number, number];
  cartel: Cartel | null;
  /** Its post on Instagram, if it has one. */
  link: string | null;
}

export interface Cartels {
  /** The pictures drawn now: their cartels change with them. */
  set(pictures: ReadonlyMap<string, WallPicture>): void;
  setLive(live: boolean): void;
  /** Slides the cartels with the head, as their layer (the room's, or the desk's). */
  move(head: Head): void;
  close(): void;
  dispose(): void;
}

const CARTEL_W = 250;

const el = (tag: string, className: string, parent: HTMLElement): HTMLElement => {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
};
const px = (v: number): string => `${v.toFixed(1)}px`;

function box(quad: Quad): { l: number; t: number; r: number; b: number } {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  return { l: Math.max(0, Math.min(...xs)), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
}

/**
 * The cartels, in `parent` (the frame's pixels), and the link's disc, in `screen` (the screen's pixels, unscaled, so
 * that the disc keeps its size whatever the frame's).
 */
export function createCartels(
  parent: HTMLElement,
  screen: HTMLElement,
  rest: Placement,
  framing: Framing,
  frame: FrameSpec,
  linkLabel: string,
): Cartels {
  const mobile = framing === 'mobile';
  const layers = {
    room: el('div', 'office-layer office-cartels', parent),
    desk: el('div', 'office-layer office-cartels', parent),
  };
  let live = false;
  let open = '';
  const items = new Map<string, { hit: HTMLAnchorElement; card: HTMLElement; known: boolean; link: string | null }>();

  const setOpen = (id: string): void => {
    open = id;
    for (const [key, item] of items) item.card.toggleAttribute('data-open', key === id && live);
  };

  // The disc over a linked picture, on desktop.
  const disc = mobile ? null : el('div', 'office-disc', screen);
  if (disc) el('span', '', disc).textContent = linkLabel;
  const showDisc = (event: PointerEvent | null): void => {
    if (!disc) return;
    const shown = event !== null && live && items.get(open)?.link != null;
    if (shown) {
      const box = screen.getBoundingClientRect();
      disc.style.translate = `${(event.clientX - box.left).toFixed(1)}px ${(event.clientY - box.top).toFixed(1)}px`;
    }
    disc.classList.toggle('on', shown);
  };

  for (const picture of rest.pictures) {
    // On phones, only the frame on the desk is in the field.
    if (mobile && picture.id !== 'desk') continue;
    const layer = picture.id === 'desk' ? layers.desk : layers.room;
    const { l, t, r, b } = box(picture.corners);
    // A link when the picture drawn has a post, and nothing but a hit area otherwise.
    const hit = el('a', 'office-cartel-hit', layer) as HTMLAnchorElement;
    hit.tabIndex = -1;
    hit.draggable = false;
    Object.assign(hit.style, { left: px(l), top: px(t), width: px(r - l), height: px(b - t) });
    const card = el('div', 'office-cartel', layer);
    // Under the picture on desktop, above the desk's frame on phones.
    const above = mobile;
    const left = Math.max(16, Math.min(picture.corners[0][0], picture.corners[3][0]));
    const top = above ? t - 10 : b + 10;
    Object.assign(card.style, { left: px(Math.min(left, frame.w - CARTEL_W - 16)), top: px(top) });
    if (above) card.classList.add('above');
    items.set(picture.id, { hit, card, known: false, link: null });
    if (mobile) {
      hit.addEventListener('click', (event) => {
        // On phones, the picture opens its cartel; the link is in it.
        event.preventDefault();
        event.stopPropagation();
        setOpen(open === picture.id ? '' : picture.id);
      });
    } else {
      hit.addEventListener('pointerenter', (event) => {
        setOpen(picture.id);
        showDisc(event);
      });
      hit.addEventListener('pointermove', showDisc);
      hit.addEventListener('pointerleave', () => {
        if (open === picture.id) setOpen('');
        showDisc(null);
      });
    }
  }

  // On phones, a tap anywhere else closes the cartel.
  const closeOnTap = (): void => {
    if (open) setOpen('');
  };
  if (mobile) document.addEventListener('click', closeOnTap);

  const refresh = (): void => {
    for (const item of items.values()) item.hit.style.pointerEvents = live && item.known ? 'auto' : 'none';
    if (!live) showDisc(null);
  };

  return {
    set(pictures) {
      for (const [id, item] of items) {
        const picture = pictures.get(id);
        const cartel = picture?.cartel ?? null;
        item.known = cartel !== null;
        item.link = cartel ? (picture?.link ?? null) : null;
        if (item.link && !mobile) {
          item.hit.href = item.link;
          item.hit.target = '_blank';
          item.hit.rel = 'noopener';
        } else {
          item.hit.removeAttribute('href');
          item.hit.removeAttribute('target');
          item.hit.removeAttribute('rel');
        }
        item.hit.classList.toggle('linked', item.link !== null && !mobile);
        item.card.replaceChildren();
        if (!cartel) continue;
        el('span', cartel.isTitle ? 'office-cartel-main' : 'office-cartel-sub', item.card).textContent = cartel.main;
        if (cartel.sub) el('span', 'office-cartel-sub', item.card).textContent = cartel.sub;
        if (cartel.note) el('span', 'office-cartel-note', item.card).textContent = cartel.note;
        if (item.link && mobile) {
          const link = el('a', 'office-cartel-link', item.card) as HTMLAnchorElement;
          Object.assign(link, { href: item.link, target: '_blank', rel: 'noopener', tabIndex: -1 });
          link.textContent = linkLabel;
          const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          arrow.setAttribute('viewBox', '0 0 14 14');
          arrow.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M4 10L10 4M5 4h5v5');
          arrow.append(path);
          link.append(arrow);
          // The link opens the post; the tap does not reach the page, which would close the cartel first.
          link.addEventListener('click', (event) => {
            event.stopPropagation();
          });
        }
      }
      showDisc(null);
      setOpen('');
      refresh();
    },
    setLive(next) {
      if (next === live) return;
      live = next;
      if (!live) setOpen('');
      refresh();
    },
    move(head) {
      const shift = (par: readonly [number, number]): string =>
        `translate3d(${(-head.x * par[0]).toFixed(2)}px, ${(-head.y * par[1]).toFixed(2)}px, 0)`;
      layers.room.style.transform = shift(frame.par.room);
      layers.desk.style.transform = shift(frame.par.desk);
    },
    close() {
      setOpen('');
      showDisc(null);
    },
    dispose() {
      document.removeEventListener('click', closeOnTap);
      disc?.remove();
      layers.room.remove();
      layers.desk.remove();
    },
  };
}
