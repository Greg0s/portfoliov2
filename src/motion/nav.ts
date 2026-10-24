/**
 * Links marked `data-cut` go through the night (main spec §5.5): the view goes dark, the page jumps to the anchor, the
 * view comes back. To an anchor of the current page (header, menu), the jump is a scroll; to another page (a case
 * study's Contact link), the client router loads the page in the dark, the veil persisting across the swap.
 */
import { navigate } from 'astro:transitions/client';
import { translateFragment, type Locale } from '../i18n/routes';
import { blackout } from './blackout';
import { closeMenu, isMenuOpen } from './menu';

function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function initNav(): void {
  // Capture phase, so that the client router sees the click as handled.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[data-cut]');
      if (!link || !isPlainClick(event)) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || !url.hash) return;
      if (url.pathname !== location.pathname) {
        event.preventDefault();
        void blackout(() => navigate(url.href));
        return;
      }
      const anchor = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!anchor) return;
      event.preventDefault();

      const menuOpen = isMenuOpen();
      const there = location.hash === url.hash && Math.abs(anchor.getBoundingClientRect().top) < 2;
      // Already there, a click does nothing.
      if (there && !menuOpen) return;
      void blackout(() => {
        closeMenu({ instant: true });
        anchor.scrollIntoView({ block: 'start', behavior: 'instant' });
        history.pushState(history.state, '', url.hash);
      });
    },
    true,
  );

  // The language switch keeps the place: `#projets` leads to `#projects`, a project's slug stays as it is.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[data-lang-switch]');
      const lang = link?.dataset.langSwitch;
      if (!link || !lang || !location.hash) return;
      const url = new URL(link.href);
      url.hash = translateFragment(decodeURIComponent(location.hash.slice(1)), lang as Locale);
      link.href = url.href;
    },
    true,
  );
}
