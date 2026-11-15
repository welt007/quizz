import { h } from '../dom.js';
import { qualifies, cleanName, MAX_NAME_LENGTH } from '../../core/highscores.js';
import { audio } from '../audio.js';

/**
 * "New highscore" form for the result screen, or null if the score does not qualify.
 * @returns {{el: HTMLElement, focus: Function} | null}
 */
export function highscoreEntry(ctx, mode, score, detail) {
  if (!qualifies(ctx.highscores[mode], score)) return null;

  const input = h('input', {
    class: 'input',
    type: 'text',
    maxlength: String(MAX_NAME_LENGTH),
    placeholder: 'Dein Name',
    autocomplete: 'nickname',
    'aria-label': 'Name für die Bestenliste',
  });
  input.value = ctx.settings.playerName ?? '';

  const form = h(
    'form',
    { class: 'panel hs-entry', onsubmit: (e) => (e.preventDefault(), save()) },
    h('h2', {}, '🏅 Neuer Highscore!'),
    h('div', { class: 'hs-entry__row' }, input, h('button', { class: 'btn', type: 'submit' }, 'Eintragen')),
  );

  function save() {
    const name = cleanName(input.value);
    const rank = ctx.addHighscore(mode, { name, score, detail, date: new Date().toISOString().slice(0, 10) });
    ctx.saveSettings({ playerName: name });
    audio.play('safe');
    form.replaceChildren(
      h('p', { class: 'hs-entry__done' }, rank ? `Eingetragen auf Platz ${rank}!` : 'Leider nicht mehr in den Top 10.'),
      h('button', { class: 'link', type: 'button', onclick: () => ctx.go('highscores', { mode }) }, 'Bestenliste ansehen'),
    );
  }

  return { el: form, focus: () => input.focus() };
}
