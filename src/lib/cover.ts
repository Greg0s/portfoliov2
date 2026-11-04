/**
 * Where a case study's opening media starts, in px from the top of the screen: flush with it behind the header on a
 * computer, under the header on a phone (`--cover-top`, tokens.css). The dive lands there and leaves from there.
 */
export function coverTop(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cover-top')) || 0;
}
