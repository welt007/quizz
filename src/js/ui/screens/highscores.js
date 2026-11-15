import { h, mount } from '../dom.js';
import { HIGHSCORE_MODES } from '../../core/highscores.js';
import { chipGroup } from '../components/chips.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler } from '../input.js';
import { modeById, formatPoints } from '../modes.js';
import { icon } from '../icons.js';

const UNIT = { ladder: 'Punkte', journey: 'Etappen', blitz: 'Punkte', sudden: 'richtig in Folge' };

export function renderHighscores(ctx, params = {}) {
  let mode = HIGHSCORE_MODES.includes(params.mode) ? params.mode : HIGHSCORE_MODES[0];
  const tableSlot = h('div', { class: 'hs-table-slot' });

  const tabs = chipGroup({
    label: 'Spielmodus',
    multi: false,
    options: HIGHSCORE_MODES.map((id) => ({ value: id, label: modeById(id).name, icon: icon(modeById(id).icon, { size: 16 }) })),
    selected: [mode],
    onChange: (v) => {
      mode = v[0] ?? mode;
      renderTable();
    },
  });

  function renderTable() {
    const list = ctx.highscores[mode] ?? [];
    if (!list.length) {
      tableSlot.replaceChildren(h('p', { class: 'hs-empty' }, 'Noch keine Einträge – sei die erste Person auf der Liste!'));
      return;
    }
    tableSlot.replaceChildren(
      h(
        'table',
        { class: 'hs-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Name'), h('th', { class: 'num' }, UNIT[mode]), h('th', { class: 'hs-detail' }, 'Details'), h('th', {}, 'Datum'))),
        h(
          'tbody',
          {},
          list.map((e, i) =>
            h(
              'tr',
              {},
              h('td', {}, h('span', { class: `rank rank--${i + 1}` }, String(i + 1))),
              h('td', { class: 'hs-name' }, e.name),
              h('td', { class: 'num' }, formatPoints(e.score)),
              h('td', { class: 'hs-detail' }, e.detail ?? ''),
              h('td', {}, formatDate(e.date)),
            ),
          ),
        ),
      ),
      h('div', { class: 'actions actions--end' }, h('button', { class: 'link', onclick: () => reset() }, 'Liste zurücksetzen')),
    );
  }

  async function reset() {
    const yes = await confirmDialog({
      title: 'Bestenliste zurücksetzen?',
      text: `Alle Einträge für „${modeById(mode).name}“ werden gelöscht.`,
      confirmLabel: 'Löschen',
    });
    if (!yes) return;
    ctx.clearHighscores(mode);
    renderTable();
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  const back = h('button', { class: 'btn', onclick: () => ctx.go('start') }, 'Zurück');
  mount(
    ctx.app,
    h('header', { class: 'setup__head' }, h('div', { class: 'setup__icon' }, icon('medal', { size: 30 })), h('h1', {}, 'Bestenliste')),
    h('section', { class: 'panel' }, tabs.el, tableSlot),
    h('div', { class: 'actions' }, back),
  );
  renderTable();
  back.focus();
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE');
}
