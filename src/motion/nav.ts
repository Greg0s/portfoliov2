/**
 * Links marked `data-cut` go through the night (main spec §5.5): the view goes dark, the page jumps to the anchor, the
 * view comes back. To an anchor of the current page (header, menu), the jump is a scroll; to another page (a case
 * study's Contact link), the client router loads the page in the dark, the veil persisting across the swap. When the
 * home plays its journey, the camera lands on the anchor instead (journey spec §6).
 */
import { navigate } from 'astro:transitions/client';
import { translateFragment, type Locale } from '../i18n/routes';
import { blackout } from './blackout';
import { currentJourney } from '../scene/journey/registry';
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
      const id = decodeURIComponent(url.hash.slice(1));
      const menuOpen = isMenuOpen();
      const journey = currentJourney();
      if (journey?.has(id)) {
        event.preventDefault();
        // Already there, a click does nothing.
        if (journey.isAt(id) && !menuOpen) return;
        void blackout(() => {
          closeMenu({ instant: true });
          journey.jumpTo(id);
          history.pushState(history.state, '', url.hash);
        });
        return;
      }

      const anchor = document.getElementById(id);
      if (!anchor) return;
      event.preventDefault();

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

  // The language switch keeps the place: on the journey, the anchor nearest the scroll (the address keeps the last one
  // jumped to, or none); elsewhere the fragment, `#projets` leading to `#projects` and a project's slug staying as it is.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[data-lang-switch]');
      const lang = link?.dataset.langSwitch;
      if (!link || !lang) return;
      const here = currentJourney()?.here() ?? (decodeURIComponent(location.hash.slice(1)) || null);
      if (!here) return;
      const url = new URL(link.href);
      url.hash = translateFragment(here, lang as Locale);
      link.href = url.href;
    },
    true,
  );
}
