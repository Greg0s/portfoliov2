/**
 * The pictures' labels (office spec §3): on desktop, hovering a picture of the wall shows its cartel under it, or on its
 * right where it would cover the contact text, in 200 ms with a 4 px rise (none with reduced motion), and it fades out
 * in 140 ms. On phones, a tap on the small frame of the desk shows its cartel above it, and a tap elsewhere closes it.
 * They answer once the camera is at rest, slide with the head as their layer does, and stay decorative for screen
 * readers. A picture with nothing known has no cartel.
 */
import type { Placement, Quad } from './corners';
import type { FrameSpec } from './frame';
import type { Framing } from './framings';
import type { Head } from './live';

/** What a cartel says, as the contact section gives it (`src/lib/wall.ts` decides what is known). */
export interface Cartel {
  main: string;
  /** A title of a work, in the light italic of titles; a name alone stays upright. */
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

/** The frames whose cartels go on their right, clear of the contact text; the others go under, or above on phones. */
const ON_THE_RIGHT = new Set(['photo-portrait', 'photo-landscape']);
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

export function createCartels(
  parent: HTMLElement,
  rest: Placement,
  framing: Framing,
  frame: FrameSpec,
  /** The frames that may show a cartel (the landscape photo, behind the text, never does). */
  labelled: ReadonlySet<string>,
): Cartels {
  const mobile = framing === 'mobile';
  const layers = {
    room: el('div', 'office-layer office-cartels', parent),
    desk: el('div', 'office-layer office-cartels', parent),
  };
  let live = false;
  let open = '';
  const items = new Map<string, { hit: HTMLElement; card: HTMLElement; known: boolean }>();

  const setOpen = (id: string): void => {
    open = id;
    for (const [key, item] of items) item.card.toggleAttribute('data-open', key === id && live);
  };

  for (const picture of rest.pictures) {
    if (!labelled.has(picture.id)) continue;
    // On phones, only the frame on the desk is in the field.
    if (mobile && picture.id !== 'desk') continue;
    const layer = picture.id === 'desk' ? layers.desk : layers.room;
    const { l, t, r, b } = box(picture.corners);
    const hit = el('div', 'office-cartel-hit', layer);
    Object.assign(hit.style, { left: px(l), top: px(t), width: px(r - l), height: px(b - t) });
    const card = el('div', 'office-cartel', layer);
    const right = !mobile && ON_THE_RIGHT.has(picture.id);
    const above = mobile;
    const left = right ? r + 12 : Math.max(16, Math.min(picture.corners[0][0], picture.corners[3][0]));
    const top = right ? t : above ? t - 10 : b + 10;
    Object.assign(card.style, { left: px(Math.min(left, frame.w - CARTEL_W - 16)), top: px(top) });
    if (above) card.classList.add('above');
    items.set(picture.id, { hit, card, known: false });
    if (mobile) {
      hit.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(open === picture.id ? '' : picture.id);
      });
    } else {
      hit.addEventListener('pointerenter', () => {
        setOpen(picture.id);
      });
      hit.addEventListener('pointerleave', () => {
        if (open === picture.id) setOpen('');
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
  };

  return {
    set(pictures) {
      for (const [id, item] of items) {
        const cartel = pictures.get(id)?.cartel ?? null;
        item.known = cartel !== null;
        item.card.replaceChildren();
        if (!cartel) continue;
        const main = el('span', 'office-cartel-main', item.card);
        main.textContent = cartel.main;
        main.classList.toggle('title', cartel.isTitle);
        if (cartel.sub) el('span', 'office-cartel-sub', item.card).textContent = cartel.sub;
        if (cartel.note) el('span', 'office-cartel-note', item.card).textContent = cartel.note;
      }
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
    },
    dispose() {
      document.removeEventListener('click', closeOnTap);
      layers.room.remove();
      layers.desk.remove();
    },
  };
}
