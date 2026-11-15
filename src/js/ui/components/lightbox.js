import { h } from '../dom.js';
import { icon } from '../icons.js';

/** Shows an image large (modal). Closes on click, Escape or any key. */
export function openLightbox(src, alt = 'Bild zur Frage') {
  const previous = document.activeElement;
  const close = h('button', { class: 'lightbox__close', type: 'button', 'aria-label': 'Schließen' }, icon('x', { size: 22 }));
  const dlg = h(
    'dialog',
    { class: 'lightbox', 'aria-label': alt },
    h('img', { class: 'lightbox__img', src, alt }),
    close,
  );
  const shut = () => dlg.open && dlg.close();
  dlg.addEventListener('click', shut);
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') {
      e.preventDefault();
      e.stopPropagation(); // the key must not also reach the game (Esc would end it)
      shut();
    }
  });
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
  });
  document.body.append(dlg);
  dlg.showModal();
  close.focus();
}
