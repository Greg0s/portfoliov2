/**
 * The accent colour proposals (8 November 2026), to compare before one is chosen: `?accent=1` to `?accent=13` sets
 * `data-accent` on the root element for the rest of the visit, `?accent=0` goes back to the site as it is; with an
 * accent, `?lumiere=1` to `?lumiere=3` sets `data-lumiere` too, which brings the accent into the 3D scenes' light in
 * one of three ways (src/lib/accent-light.ts), and `?lumiere=0` takes it out. Without the parameters, nothing changes.
 * Self-contained: Base.astro inlines its source in the page head, so that the first paint has the colours, and calls
 * it again after each page swap of the client router.
 */
export function applyAccent(): void {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;
  const pick = (name: string, key: string, valid: RegExp): string | undefined => {
    let value = params.get(name);
    try {
      if (value === null) value = sessionStorage.getItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Storage may be unavailable (a private window): the parameter alone still works on the page it is on.
    }
    return value !== null && valid.test(value) ? value : undefined;
  };
  const accent = pick('accent', 'accent-proposal', /^([1-9]|1[0-3])$/);
  const light = accent === undefined ? undefined : pick('lumiere', 'accent-light', /^[1-3]$/);
  if (accent === undefined) delete root.dataset.accent;
  else root.dataset.accent = accent;
  if (light === undefined) delete root.dataset.lumiere;
  else root.dataset.lumiere = light;
}
