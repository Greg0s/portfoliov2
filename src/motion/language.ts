/**
 * The language switch changes the words, nothing else: the page in the other language takes the place of this one at
 * once, where the visitor was (`nav.ts` gives the link the anchor nearest the scroll).
 *
 * The client router's fade would show the new page live as soon as it is in the document. On the home, that is before
 * the journey has started and landed on its anchor: for a few frames the page shows its opening, wherever the visitor
 * was (the ring, the office), and the cross-fade dims the whole screen. So the view transition holds the old page, as
 * captured, until the new one stands where the old one was, then shows it in one frame (`base.css`, `data-lang-switch`).
 * On a case study, the new page keeps the scroll, in proportion, and shows its content in place, without its rise.
 */
import { fragments } from '../i18n/routes';
import { journeyOn } from '../scene/journey/mode';
import { currentJourney } from '../scene/journey/registry';

/** The longest hold on the old page, in ms, if the new one never says it is ready (base.css holds a little longer). */
const HOLD_MAX = 2000;

let ready = false;
/** Whether this page was reached by the language switch: the office then shows the pictures it showed (view.ts). */
let reached = false;
/** The switch in progress: the view transition to end, and the case study's scroll to keep, as a share of its length. */
let switching: { transition: ViewTransition | null; scroll: number | null } | null = null;

const frame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });

/** How far down the page is, as a share of what it scrolls; null on the home, whose journey keeps its own place. */
function scrollShare(): number | null {
  if (document.querySelector('[data-journey-root]')) return null;
  const room = document.documentElement.scrollHeight - innerHeight;
  return room > 0 ? scrollY / room : 0;
}

/** Whether the page was reached by the language switch, until the next page change. */
export function reachedBySwitch(): boolean {
  return reached;
}

/**
 * Resolves once the new page stands where the old one was: on the home, once the journey has landed, and on the
 * contact once the office is there too (kept from the old page, it only lays its HTML again).
 */
async function settled(): Promise<void> {
  const until = performance.now() + HOLD_MAX;
  if (document.querySelector('[data-journey-root]') && journeyOn()) {
    while (!currentJourney() && performance.now() < until) await frame();
    const html = document.documentElement;
    const hash = decodeURIComponent(location.hash.slice(1));
    const atContact = Object.values(fragments.contact).some((name) => name === hash);
    while (atContact && html.dataset.office !== 'live' && performance.now() < until) await frame();
  }
  // The frame where the new page is drawn in its place, then the one where it shows.
  await frame();
  await frame();
}

function mark(): void {
  const html = document.documentElement;
  html.dataset.langSwitch = '';
  // The case study shows its content in place, as after a slide, until the next page (CaseStudy.astro).
  html.dataset.langSwitched = '';
}

export function initLanguage(): void {
  if (ready) return;
  ready = true;

  document.addEventListener('astro:before-preparation', (event) => {
    const source = event.sourceElement;
    switching = source?.closest('a[data-lang-switch]') ? { transition: null, scroll: scrollShare() } : null;
    reached = switching !== null;
    // Set before the old page is captured: it is held as it is, with no fade (base.css).
    if (switching) document.documentElement.dataset.langSwitch = '';
  });

  document.addEventListener('astro:before-swap', (event) => {
    if (switching) switching.transition = event.viewTransition;
  });

  document.addEventListener('astro:after-swap', () => {
    if (!switching) return;
    // The router has just given the root element the new page's attributes.
    mark();
    const share = switching.scroll;
    if (share !== null && !location.hash) {
      const room = document.documentElement.scrollHeight - innerHeight;
      scrollTo({ top: Math.round(share * room), behavior: 'instant' });
    }
  });

  document.addEventListener('astro:page-load', () => {
    const current = switching;
    switching = null;
    if (!current) return;
    void settled().then(() => {
      current.transition?.skipTransition();
      delete document.documentElement.dataset.langSwitch;
    });
  });
}
