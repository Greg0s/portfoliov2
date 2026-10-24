/**
 * The actions of the email (office spec §6), shown once JavaScript runs. On desktop, the copy button copies the address,
 * shows a check for 1.8 s and has screen readers announce it. On phones, a tap on the address opens a bubble, "Copy |
 * Send an email": "Copy" turns into "Copied" and the bubble closes 0.9 s later; a tap elsewhere closes it. Delegated,
 * so that it works on every page the client router shows.
 */
const CHECK_MS = 1800;
const BUBBLE_MS = 900;
const phone = (): boolean => window.matchMedia('(width < 768px)').matches;

let ready = false;

/** Shows the copy buttons of the current page. */
export function showCopyButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-email] .copy')) button.hidden = false;
  for (const bubble of document.querySelectorAll<HTMLElement>('[data-email] [data-bubble]')) bubble.hidden = false;
}

function closeBubbles(except?: Element): void {
  for (const box of document.querySelectorAll<HTMLElement>('[data-email][data-bubble-open]')) {
    if (box === except) continue;
    box.removeAttribute('data-bubble-open');
    box.querySelector(':scope > a')?.setAttribute('aria-expanded', 'false');
  }
}

/** Copies the address, then tells screen readers. */
async function copy(box: HTMLElement): Promise<void> {
  const { email = '', copiedText = '' } = box.dataset;
  await navigator.clipboard.writeText(email);
  const status = box.querySelector('[role="status"]');
  if (status) status.textContent = copiedText;
}

export function initEmailActions(): void {
  showCopyButtons();
  if (ready) return;
  ready = true;
  document.addEventListener('astro:after-swap', showCopyButtons);
  const timers = new WeakMap<HTMLElement, number>();
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const box = target?.closest<HTMLElement>('[data-email]');
    // The bubble, on phones: the address opens it, a tap elsewhere closes it.
    closeBubbles(box ?? undefined);
    if (!target || !box) return;
    const address = target.closest('[data-email] > a');
    if (address && phone() && box.querySelector('[data-bubble]')) {
      event.preventDefault();
      const open = box.toggleAttribute('data-bubble-open');
      address.setAttribute('aria-expanded', String(open));
      return;
    }
    const bubbleCopy = target.closest<HTMLButtonElement>('[data-bubble-copy]');
    if (bubbleCopy) {
      void copy(box).then(() => {
        bubbleCopy.textContent = bubbleCopy.dataset.copiedShort ?? '';
        window.clearTimeout(timers.get(bubbleCopy));
        timers.set(
          bubbleCopy,
          window.setTimeout(() => {
            closeBubbles();
            // Its word back once the bubble has faded out.
            window.setTimeout(() => {
              bubbleCopy.textContent = bubbleCopy.dataset.copyText ?? '';
            }, 250);
          }, BUBBLE_MS),
        );
      });
      return;
    }
    if (target.closest('[data-bubble] a')) {
      closeBubbles();
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-email] .copy');
    if (!button) return;
    void copy(box).then(() => {
      button.dataset.copied = '';
      const status = box.querySelector('[role="status"]');
      window.clearTimeout(timers.get(button));
      timers.set(
        button,
        window.setTimeout(() => {
          delete button.dataset.copied;
          if (status) status.textContent = '';
        }, CHECK_MS),
      );
    });
  });
}
