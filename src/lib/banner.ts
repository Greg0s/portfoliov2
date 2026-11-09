/**
 * The banner proposal (9 November 2026), to compare before choosing: `?banniere=capture` shows, for the projects that
 * have one, a screenshot of the product in a sober frame (`capture.jpg`, a browser window and a phone on the night
 * background) instead of their cover, on the card, the case study's banner, the next project and a swipe's neighbour,
 * for the rest of the visit; `?banniere=0` goes back to the covers. Without the parameter, nothing changes.
 *
 * The pages carry both pictures: an image that has a capture holds its sources in `data-capture-src` and
 * `data-capture-srcset`, swapped in by `swapCaptures`, on the page as it loads and on each page the client router
 * brings in, before it shows. Until then, `src/styles/base.css` keeps such an image hidden, so the cover never flashes.
 */

/** Sets `data-banniere` on the root element. Self-contained: Base.astro inlines its source in the page head. */
export function applyBanner(): void {
  const asked = new URLSearchParams(location.search).get('banniere');
  let value = asked;
  try {
    if (asked === null) value = sessionStorage.getItem('banner-proposal');
    else sessionStorage.setItem('banner-proposal', asked);
  } catch {
    // Storage may be unavailable (a private window): the parameter alone still works on the page it is on.
  }
  if (value === 'capture') document.documentElement.dataset.banniere = 'capture';
  else delete document.documentElement.dataset.banniere;
}

/** Whether the visit shows the captures. */
export function showsCaptures(): boolean {
  return document.documentElement.dataset.banniere === 'capture';
}

/**
 * Swaps in the captures under `root`: an image's `src` and `srcset`, a swipe peek's `data-src` and `data-srcset`.
 * Does nothing when the visit shows the covers.
 */
export function swapCaptures(root: ParentNode): void {
  if (!showsCaptures()) return;
  for (const element of root.querySelectorAll<HTMLElement>('[data-capture-src]:not([data-captured])')) {
    const src = element.dataset.captureSrc ?? '';
    const srcset = element.dataset.captureSrcset ?? '';
    if (element instanceof HTMLImageElement) {
      element.srcset = srcset;
      element.src = src;
      element.style.objectPosition = '';
    } else {
      element.dataset.src = src;
      element.dataset.srcset = srcset;
    }
    element.dataset.captured = '';
  }
}
