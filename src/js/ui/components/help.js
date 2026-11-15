import { h } from '../dom.js';

const SECTIONS = [
  ['Überall', [['M', 'Ton an/aus'], ['F', 'Präsentationsmodus (Vollbild, groß für Beamer/TV)'], ['?', 'diese Übersicht'], ['Esc', 'zurück bzw. Spiel beenden']]],
  ['Im Spiel', [['A–D oder 1–4', 'Antwort wählen'], ['Enter / Leertaste / →', 'weiter'], ['Z', 'Fragebild vergrößern']]],
  ['Punkteleiter', [['H', 'Joker 50:50'], ['P', 'Joker Publikum'], ['T', 'Joker +30 Sekunden']]],
  ['Duell mit Buzzer', [['Q · P · X · N', 'Buzzer für Spieler 1–4'], ['danach A–D', 'antworten']]],
];

/** Modal overview of all keyboard shortcuts. */
export function showHelp() {
  if (document.querySelector('dialog.help')) return;
  const previous = document.activeElement;
  const ok = h('button', { class: 'btn', value: 'ok' }, 'Alles klar');
  const dlg = h(
    'dialog',
    { class: 'dialog help', 'aria-labelledby': 'help-title' },
    h(
      'form',
      { method: 'dialog' },
      h('h3', { class: 'dialog__title', id: 'help-title' }, '⌨️ Tastenkürzel'),
      SECTIONS.map(([title, keys]) =>
        h(
          'section',
          { class: 'help__section' },
          h('h4', {}, title),
          h('dl', { class: 'help__list' }, keys.flatMap(([k, d]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, d)])),
        ),
      ),
      h('div', { class: 'actions' }, ok),
    ),
  );
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
  });
  document.body.append(dlg);
  dlg.showModal();
  ok.focus();
}
