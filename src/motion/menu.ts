/**
 * The mobile menu (journey spec §8): the night covers the page in 0.26 s while the words rise one after the other;
 * "Close" fades it out in 0.18 s, the words staying in place. A native modal dialog keeps the focus inside, closes on
 * Escape and gives the focus back to the Menu button.
 *
 * Everything is delegated from the document, so it keeps working when the client router swaps pages.
 */

const CLOSE_MS = 180;

let closeTimer: ReturnType<typeof setTimeout> | undefined;

function dialog(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('dialog[data-menu]');
}

function opener(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-menu-open]');
}

export function isMenuOpen(): boolean {
  return dialog()?.open ?? false;
}

export function openMenu(): void {
  const menu = dialog();
  if (!menu) return;
  clearTimeout(closeTimer);
  if (!menu.open) {
    delete menu.dataset.state;
    menu.showModal();
  }
  opener()?.setAttribute('aria-expanded', 'true');
  // Two frames so that the starting state paints before the transition.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      menu.dataset.state = 'in';
    }),
  );
}

/** Closes the menu: with its fade, or at once (behind the veil of a cut). */
export function closeMenu({ instant = false } = {}): void {
  const menu = dialog();
  if (!menu?.open) return;
  clearTimeout(closeTimer);
  const finish = (): void => {
    menu.close();
    delete menu.dataset.state;
    const button = opener();
    button?.setAttribute('aria-expanded', 'false');
  };
  if (instant) {
    finish();
    return;
  }
  menu.dataset.state = 'out';
  closeTimer = setTimeout(finish, CLOSE_MS);
}

export function initMenu(): void {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-menu-open]')) openMenu();
    else if (target?.closest('[data-menu-close]')) closeMenu();
  });

  // Tab and Shift+Tab loop inside the open menu instead of leaving for the browser's interface.
  document.addEventListener('keydown', (event) => {
    const menu = dialog();
    if (event.key !== 'Tab' || !menu?.open) return;
    const focusable = [...menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Escape plays the same fade as "Close".
  document.addEventListener(
    'cancel',
    (event) => {
      if (event.target instanceof HTMLDialogElement && event.target.matches('[data-menu]')) {
        event.preventDefault();
        closeMenu();
      }
    },
    true,
  );

  // The menu only exists on small screens: widening the window closes it.
  matchMedia('(width >= 768px)').addEventListener('change', (query) => {
    if (query.matches) closeMenu({ instant: true });
  });
}
