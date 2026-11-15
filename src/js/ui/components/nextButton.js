import { h } from '../dom.js';

export const AUTO_NEXT_SECONDS = 5;
const TICK_MS = 100;

/** Whether "Automatisch weiter" is switched on (options, default on). */
export const autoNextEnabled = (ctx) => ctx.settings.autoNext !== false;

/**
 * "Nächste Frage" button after the answer is revealed. With the option
 * "Automatisch weiter" it presses itself after AUTO_NEXT_SECONDS; a fill bar in
 * the button shows the remaining time. The countdown waits while a dialog
 * (end game, image zoom) is open or the page is hidden, and stops for this
 * question as soon as the player touches or scrolls the screen elsewhere
 * (e.g. to read an explanation) – then the button works as usual.
 */
export function nextButton(ctx, label, onNext) {
  let done = false;
  let elapsed = 0;
  let interval = 0;

  const fill = h('span', { class: 'btn__countdown', 'aria-hidden': 'true' });
  const btn = h(
    'button',
    {
      class: 'btn btn--next',
      onclick: () => {
        if (done) return;
        done = true;
        stop();
        window.scrollTo(0, 0); // the next question starts at the top
        onNext();
      },
    },
    fill,
    h('span', { class: 'btn__label' }, label),
  );

  function stop() {
    clearInterval(interval);
    interval = 0;
    btn.classList.remove('is-counting');
    for (const type of ['pointerdown', 'wheel', 'touchmove']) document.removeEventListener(type, interrupt, true);
  }

  function interrupt(e) {
    if (!btn.contains(e.target)) stop();
  }

  function tick() {
    if (!btn.isConnected) return stop();
    if (document.hidden || document.querySelector('dialog[open]')) return;
    elapsed += TICK_MS;
    fill.style.transform = `scaleX(${Math.min(1, elapsed / (AUTO_NEXT_SECONDS * 1000))})`;
    if (elapsed >= AUTO_NEXT_SECONDS * 1000) btn.click();
  }

  if (autoNextEnabled(ctx)) {
    btn.classList.add('is-counting');
    btn.title = `Geht nach ${AUTO_NEXT_SECONDS} Sekunden automatisch weiter (Optionen)`;
    interval = setInterval(tick, TICK_MS);
    for (const type of ['pointerdown', 'wheel', 'touchmove']) document.addEventListener(type, interrupt, { capture: true, passive: true });
  }
  return btn;
}
