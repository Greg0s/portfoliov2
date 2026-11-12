/**
 * A figure's note in a case study's results (CaseStudy.astro): hover and keyboard focus show it by CSS alone; a tap or
 * a click pins it open, until another tap, a tap elsewhere or Escape.
 * Escape hides it, however it was shown. Only one note is open at a time.
 *
 * Everything is delegated from the document, so it keeps working when the client router swaps pages.
 */

const SELECTOR = 'button[data-note]';

function closeAll(except?: Element): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(`${SELECTOR}[aria-expanded="true"]`)) {
    if (button !== except) button.setAttribute('aria-expanded', 'false');
  }
}

export function initNote(): void {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(SELECTOR);
    closeAll(button ?? undefined);
    if (!button) return;
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
  });
  // Escape hides the note, even one shown by hover or focus, without moving the focus (WCAG 1.4.13); it shows again
  // once the pointer or the focus leaves and comes back.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeAll();
    for (const button of document.querySelectorAll<HTMLButtonElement>(SELECTOR)) button.dataset.dismissed = '';
  });
  const reset = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(SELECTOR);
    if (button) delete button.dataset.dismissed;
  };
  document.addEventListener('focusout', reset);
  document.addEventListener('pointerout', reset);
  document.addEventListener('astro:before-swap', () => {
    closeAll();
  });
}
