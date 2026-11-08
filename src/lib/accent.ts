/**
 * The accent colour proposals (8 November 2026), to compare before one is chosen: `?accent=1` to `?accent=7` sets
 * `data-accent` on the root element for the rest of the visit, `?accent=0` goes back to the site as it is. Without the
 * parameter, nothing changes. Self-contained: Base.astro inlines its source in the page head, so that the first paint
 * has the colours, and calls it again after each page swap of the client router.
 */
export function applyAccent(): void {
  const key = 'accent-proposal';
  let value = new URLSearchParams(location.search).get('accent');
  try {
    if (value === null) value = sessionStorage.getItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (a private window): the parameter alone still works on the page it is on.
  }
  const root = document.documentElement;
  if (value !== null && /^[1-7]$/.test(value)) root.dataset.accent = value;
  else delete root.dataset.accent;
}
