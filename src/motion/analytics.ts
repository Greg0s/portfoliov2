/**
 * The visit, counted by Umami (main spec §7.6), self-hosted on Vercel. Its script counts the pages (the client router's
 * changes too) and is added once the page has loaded: in the head, even `async`, it held the arrival on the home as
 * long as it took to arrive from Vercel (measured on 17 November 2026: 800 ms late for a script 800 ms slow), since the
 * page's `load` waits for it. It is added only on the site's domain: the tests, Lighthouse and a preview never fetch it.
 * It counts the pages without their anchors (`#projets` is the same page). This module also counts what the visitor does on them. One delegated listener reads each click and never changes it: Umami's own
 * `data-umami-event` attributes would turn an internal link into a full page load (it holds the click, then sets
 * `location.href`), which would break the dive into a case study and the language switch.
 *
 * Nothing is counted while the script is missing (blocked, not loaded yet, or another domain than the site's).
 */

import { config } from '../config';

/** What Umami's script puts on `window`. */
interface Umami {
  track: (name: string, data?: Record<string, string>) => unknown;
}

export interface VisitEvent {
  name: string;
  data?: Record<string, string>;
}

/** The contact's links, by the page they show on the office's screen (`Contact.astro`). */
const CONTACT_LINKS: Record<string, string> = {
  LinkedIn: 'linkedin',
  GitHub: 'github',
  CV: 'cv',
  Instagram: 'instagram',
};

/** The last segment of a link's path: a case study's slug. */
function slugOf(link: HTMLAnchorElement): string {
  return new URL(link.href).pathname.split('/').filter(Boolean).pop() ?? '';
}

/**
 * The event a click on this element stands for, if any. `mailto` is the one a click on the address would be: on
 * phones, that click may only open the bubble, which the caller checks once the click has been handled.
 */
export function eventFor(target: Element, origin: string): (VisitEvent & { mailto?: true }) | null {
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (target.closest('[data-email] .copy, [data-bubble-copy]')) return { name: 'email', data: { action: 'copy' } };
  if (!link) return null;
  if (link.matches('a.card[data-slug]')) {
    return { name: 'case-study', data: { project: link.dataset.slug ?? slugOf(link), from: 'ring' } };
  }
  if (link.closest('.next')) return { name: 'case-study', data: { project: slugOf(link), from: 'next' } };
  if (link.dataset.langSwitch) return { name: 'language', data: { to: link.dataset.langSwitch } };
  if (link.protocol === 'mailto:') return { name: 'email', data: { action: 'open' }, mailto: true };
  const contact = link.dataset.screenPage ? CONTACT_LINKS[link.dataset.screenPage] : undefined;
  if (contact) return { name: contact };
  if (link.target === '_blank' || new URL(link.href).origin !== origin) {
    return { name: 'outbound', data: { url: link.href } };
  }
  return null;
}

function send({ name, data }: VisitEvent): void {
  const umami = (window as Window & { umami?: Umami }).umami;
  try {
    umami?.track(name, data);
  } catch {
    // A failing counter never gets in the visit's way.
  }
}

/** The site's domain, the only one Umami counts. */
const SITE_HOST = new URL(import.meta.env.SITE).hostname;

/** Adds Umami's script, with the attributes of its snippet. */
function loadUmami(): void {
  if (location.hostname !== SITE_HOST) return;
  const script = document.createElement('script');
  script.src = config.analytics.script;
  script.defer = true;
  script.dataset.websiteId = config.analytics.websiteId;
  script.dataset.domains = SITE_HOST;
  script.dataset.excludeHash = 'true';
  document.head.append(script);
}

let ready = false;

export function initAnalytics(): void {
  if (ready) return;
  ready = true;
  if (document.readyState === 'complete') loadUmami();
  else window.addEventListener('load', loadUmami, { once: true });
  // Capture, so that a handler that stops the click (the dive, the slide) does not hide it.
  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const visit = eventFor(event.target, location.origin);
      if (!visit) return;
      if (!visit.mailto) {
        send(visit);
        return;
      }
      // Once every handler has run: a tap that opened the bubble did not open the mail app.
      window.setTimeout(() => {
        if (!event.defaultPrevented) send(visit);
      }, 0);
    },
    { capture: true },
  );
}
