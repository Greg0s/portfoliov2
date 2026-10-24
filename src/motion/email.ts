/**
 * The copy button of the email (office spec §6): shown once JavaScript runs, it copies the address, shows a check for
 * 1.8 s and has screen readers announce it. Delegated, so that it works on every page the client router shows.
 */
const CHECK_MS = 1800;

let ready = false;

/** Shows the copy buttons of the current page. */
export function showCopyButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-email] .copy')) button.hidden = false;
}

export function initEmailActions(): void {
  showCopyButtons();
  if (ready) return;
  ready = true;
  document.addEventListener('astro:after-swap', showCopyButtons);
  const timers = new WeakMap<HTMLElement, number>();
  document.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-email] .copy') : null;
    const box = button?.closest<HTMLElement>('[data-email]');
    if (!button || !box) return;
    const { email = '', copiedText = '' } = box.dataset;
    void navigator.clipboard.writeText(email).then(() => {
      button.dataset.copied = '';
      const status = box.querySelector('[role="status"]');
      if (status) status.textContent = copiedText;
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
