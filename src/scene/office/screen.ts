/**
 * The screen comes alive (office spec §6): the copy of the screen's template laid onto the monitor, run here. On desktop,
 * hovering a link of the contact opens its page in Firefox, from its icon in the taskbar to the full screen in 0.4 s,
 * with the four pages in four tabs, the hovered one in front; the email opens Thunderbird instead, and Firefox shrinks
 * back. A page left under the mouse scrolls slowly down after 1.1 s, to its end in 5 to 12 s (at most 140 px/s); the
 * windows shrink back 0.6 s after the mouse leaves the links. The Recycle Bin asks whether to empty itself, hands
 * « Oui » over to the office (which goes dark and draws new pictures, and a new wallpaper), then owns up that nothing
 * happened. The wallpaper is one of Grégoire's photos, drawn at random. On phones the
 * desktop shows alone, and no capture loads. The taskbar's clock shows the visitor's time.
 */

/** The links' pages; the email opens the mail app. */
export type ScreenPage = 'LinkedIn' | 'GitHub' | 'CV' | 'Instagram' | 'Email';
const PAGES: readonly ScreenPage[] = ['LinkedIn', 'GitHub', 'CV', 'Instagram', 'Email'];

/** Firefox's view, under its tabs and its toolbar. */
const VIEW_H = 670;
const SCROLL_AFTER = 1100;
const CLOSE_AFTER = 600;
const DONE_AFTER = 450;

export interface ScreenOptions {
  /** Phones: the desktop alone, the Recycle Bin inactive. */
  mobile: boolean;
  still: boolean;
  reduce: boolean;
  locale: string;
  /** « Oui » in the Recycle Bin's dialog: the office goes dark and draws new pictures, then calls `redrawn`. */
  onEmpty: () => void;
}

export interface Screen {
  element: HTMLElement;
  /** Shows a link's page, or none; for the tests and the captures too. */
  show(page: ScreenPage | ''): void;
  /** Whether the camera is at rest: the Recycle Bin answers only then. */
  setLive(live: boolean): void;
  /** The new draw is done, in the dark: the desktop comes back, and once the scene is back, the message. */
  redrawn(): void;
  /** Draws another wallpaper, in the dark; resolves once it is ready to show (or after a second at most). */
  drawWallpaper(): Promise<void>;
  dispose(): void;
}

export function createScreen(template: HTMLTemplateElement, links: ParentNode, options: ScreenOptions): Screen {
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const element = fragment.firstElementChild as HTMLElement;
  const query = <T extends Element = HTMLElement>(selector: string): T[] => [...element.querySelectorAll<T>(selector)];

  const tabs = new Map(query('[data-tab]').map((node) => [node.dataset.tab ?? '', node]));
  const pages = new Map(query('[data-page]').map((node) => [node.dataset.page ?? '', node]));
  const address = element.querySelector<HTMLElement>('[data-address]');

  // ---- The wallpaper, set before the copy reaches the page so that only the drawn one loads.
  const wallpaper = element.querySelector<HTMLImageElement>('.wallpaper');
  const wallpapers = JSON.parse(wallpaper?.dataset.wallpapers ?? '[]') as string[];
  let current = '';
  const drawWallpaper = (): HTMLImageElement | null => {
    const candidates = wallpapers.length > 1 ? wallpapers.filter((src) => src !== current) : wallpapers;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (!wallpaper || next === undefined) return null;
    current = next;
    wallpaper.src = next;
    return wallpaper;
  };
  drawWallpaper();

  // ---- Windows: which one is open, and the tab in front (kept while Firefox shrinks back).
  let open: ScreenPage | '' = '';
  let live = false;
  let shown = 'LinkedIn';
  let scrollTimer = 0;
  let closeTimer = 0;
  let doneTimer = 0;

  const front = (name: string): void => {
    for (const [key, tab] of tabs) tab.toggleAttribute('data-active', key === name);
    for (const [key, page] of pages) page.toggleAttribute('data-active', key === name);
    if (address) address.textContent = tabs.get(name)?.dataset.url ?? '';
  };
  front(shown);

  /** A page's capture loads on its link's first hover. */
  const load = (page: HTMLElement): void => {
    for (const image of page.querySelectorAll<HTMLImageElement>('img[data-src]')) {
      image.decoding = 'async';
      image.src = image.dataset.src ?? '';
      image.removeAttribute('data-src');
    }
  };

  const scrollOf = (page: HTMLElement): HTMLElement | null => page.querySelector<HTMLElement>('.scroll');
  const rewind = (page: HTMLElement): void => {
    const scroll = scrollOf(page);
    if (!scroll) return;
    scroll.style.transition = 'none';
    scroll.style.transform = '';
  };
  const scrollDown = (page: HTMLElement): void => {
    const scroll = scrollOf(page);
    if (!scroll) return;
    const by = Math.max(0, Number(page.dataset.height) - VIEW_H);
    // To its end in 5 to 12 s, slow at both ends; the long LinkedIn page goes no faster than 140 px/s.
    const duration = Math.round(Math.max(Math.min(12000, Math.max(5000, (by / 70) * 1000)), (by / 140) * 1000));
    scroll.style.transition = `transform ${String(duration)}ms cubic-bezier(0.45, 0.05, 0.55, 0.95)`;
    scroll.style.transform = `translateY(${String(-by)}px)`;
  };

  function show(page: ScreenPage | ''): void {
    window.clearTimeout(closeTimer);
    if (page === open) return;
    open = page;
    window.clearTimeout(scrollTimer);
    element.dataset.open = page === 'Email' ? 'mail' : page ? 'firefox' : '';
    if (page === 'Email') element.toggleAttribute('data-mail-seen', true);
    if (!page || page === 'Email') return;
    // A tab brought to the front starts again from the top.
    const node = pages.get(page);
    if (!node) return;
    for (const other of pages.values()) rewind(other);
    load(node);
    shown = page;
    front(shown);
    if (!options.still && !options.reduce) {
      scrollTimer = window.setTimeout(() => {
        scrollDown(node);
      }, SCROLL_AFTER);
    }
  }

  // ---- The links of the contact: their pages on hover and on focus (desktop only).
  const pageOf = (target: EventTarget | null): ScreenPage | '' => {
    const node = target instanceof Element ? target.closest<HTMLElement>('[data-screen-page]') : null;
    const page = node?.dataset.screenPage as ScreenPage | undefined;
    return page && PAGES.includes(page) ? page : '';
  };
  const enter = (event: Event): void => {
    const page = pageOf(event.target);
    if (page && live) show(page);
  };
  const leave = (event: Event): void => {
    if (!pageOf(event.target)) return;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      show('');
    }, CLOSE_AFTER);
  };
  if (!options.mobile) {
    links.addEventListener('pointerover', enter);
    links.addEventListener('pointerout', leave);
    links.addEventListener('focusin', enter);
    links.addEventListener('focusout', leave);
  }

  // ---- The Recycle Bin.
  let dialog: '' | 'ask' | 'done' = '';
  const setDialog = (next: typeof dialog): void => {
    dialog = next;
    element.dataset.dialogOpen = next;
    refreshBin();
  };
  function refreshBin(): void {
    element.toggleAttribute('data-bin-live', live && !options.mobile && !open && dialog === '');
  }
  element.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-bin]') && element.hasAttribute('data-bin-live')) {
      setDialog('ask');
      return;
    }
    const answer = target.closest<HTMLElement>('[data-answer]')?.dataset.answer;
    if (answer === 'yes') {
      setDialog('');
      options.onEmpty();
    } else if (answer === 'no' || answer === 'ok') {
      setDialog('');
    }
  });

  // ---- The clock: the visitor's time, and the date in the language of the page.
  const clock = element.querySelector('[data-clock]');
  const date = element.querySelector('[data-date]');
  const dateFormat = new Intl.DateTimeFormat(options.locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const tick = (): void => {
    const now = new Date();
    if (clock)
      clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (date) date.textContent = dateFormat.format(now);
  };
  tick();
  const clockTimer = window.setInterval(tick, 15_000);

  return {
    element,
    show,
    setLive(next) {
      if (next === live) return;
      live = next;
      if (!live) {
        show('');
        if (dialog) setDialog('');
      }
      refreshBin();
    },
    redrawn() {
      setDialog('');
      show('');
      window.clearTimeout(doneTimer);
      doneTimer = window.setTimeout(() => {
        setDialog('done');
      }, DONE_AFTER);
    },
    drawWallpaper() {
      const image = drawWallpaper();
      if (!image) return Promise.resolve();
      return Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ]);
    },
    dispose() {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(closeTimer);
      window.clearTimeout(doneTimer);
      window.clearInterval(clockTimer);
      links.removeEventListener('pointerover', enter);
      links.removeEventListener('pointerout', leave);
      links.removeEventListener('focusin', enter);
      links.removeEventListener('focusout', leave);
      element.remove();
    },
  };
}
