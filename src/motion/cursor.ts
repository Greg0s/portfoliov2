/**
 * The click hint (journey spec §5): on desktop, over the sharp card, the mouse becomes a light 96 px disc where "See
 * the project" is written; it grows in over 300 ms. On touch screens the card shows a pill instead (CSS).
 */

export interface DiscCursor {
  update(x: number, y: number, shown: boolean): void;
}

export function discCursor(element: HTMLElement): DiscCursor {
  let wasShown = false;
  return {
    update(x, y, shown) {
      if (shown) element.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      if (shown !== wasShown) {
        element.classList.toggle('on', shown);
        wasShown = shown;
      }
    },
  };
}
