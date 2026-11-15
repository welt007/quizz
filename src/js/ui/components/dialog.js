import { h } from '../dom.js';

/**
 * Modal yes/no dialog based on <dialog>. Escape = cancel.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, text, confirmLabel = 'Ja', cancelLabel = 'Abbrechen' }) {
  const previous = document.activeElement;
  return new Promise((resolve) => {
    const cancel = h('button', { class: 'btn btn--ghost', value: 'cancel' }, cancelLabel);
    const ok = h('button', { class: 'btn', value: 'ok' }, confirmLabel);
    const dlg = h(
      'dialog',
      { class: 'dialog' },
      h(
        'form',
        { method: 'dialog' },
        h('h3', { class: 'dialog__title' }, title),
        text ? h('p', { class: 'dialog__text' }, text) : null,
        h('div', { class: 'actions' }, cancel, ok),
      ),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'ok');
      dlg.remove();
      // give focus back (e.g. to the "Aussteigen" button) unless the caller moved on
      if (previous instanceof HTMLElement && previous.isConnected && document.activeElement === document.body) {
        previous.focus({ preventScroll: true });
      }
    });
    document.body.append(dlg);
    dlg.showModal();
    cancel.focus();
  });
}
