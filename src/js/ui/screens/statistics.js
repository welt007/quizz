// Player statistics for the current question pool.
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { summarizeStats } from '../../core/statistics.js';
import { saveJson, KEYS } from '../../data/storage.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler } from '../input.js';
import { icon } from '../icons.js';

const pct = (r) => (r == null ? '–' : `${Math.round(r * 100)} %`);

function statRow(label, b, { icon, color } = {}) {
  return h(
    'li',
    { class: 'stat-row' },
    h('span', { class: 'stat-row__label' }, icon ? `${icon} ` : '', label),
    h(
      'span',
      { class: 'stat-row__bar', role: 'img', 'aria-label': `Trefferquote ${pct(b.rate)}` },
      h('span', { class: 'stat-row__fill', style: { width: `${Math.round((b.rate ?? 0) * 100)}%` }, '--bar': color }),
    ),
    h('span', { class: 'stat-row__rate' }, pct(b.rate)),
    h('span', { class: 'stat-row__meta' }, `${b.correct}/${b.asked} richtig · ${b.seen} von ${b.total} Fragen gesehen`),
  );
}

export function renderStatistics(ctx) {
  const s = summarizeStats(ctx.catalog.questions, ctx.stats);
  const played = s.overall.asked > 0;

  async function reset() {
    const yes = await confirmDialog({
      title: 'Statistik zurücksetzen?',
      text: 'Alle Zahlen hier werden gelöscht, und das Spiel vergisst, welche Fragen du schon hattest. Bestenlisten bleiben erhalten.',
      confirmLabel: 'Zurücksetzen',
    });
    if (!yes) return;
    ctx.stats = {};
    saveJson(KEYS.stats, {});
    renderStatistics(ctx);
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  const back = h('button', { class: 'btn', onclick: () => ctx.go('start') }, 'Zurück');
  const tiles = [
    ['Antworten', String(s.overall.asked)],
    ['Trefferquote', pct(s.overall.rate)],
    ['Fragen gesehen', `${s.overall.seen} / ${s.overall.total}`],
    ['Zuletzt gespielt', s.lastPlayed ? new Date(s.lastPlayed).toLocaleDateString('de-DE') : '–'],
  ];

  mount(
    ctx.app,
    h('header', { class: 'setup__head' }, h('div', { class: 'setup__icon' }, icon('chart', { size: 30 })), h('h1', {}, 'Statistik')),
    h(
      'section',
      { class: 'panel' },
      h('div', { class: 'tiles' }, tiles.map(([label, value]) => h('div', { class: 'tile' }, h('strong', { class: 'tile__value' }, value), h('span', { class: 'tile__label' }, label)))),
      played ? null : h('p', { class: 'hs-empty' }, 'Noch keine Antworten gezählt – spiel eine Runde, dann füllt sich diese Seite.'),
      h('p', { class: 'options__hint' }, 'Gezählt werden die Fragen der aktuell eingeschalteten Kataloge (alle Modi außer Duell).'),
    ),
    played
      ? h(
          'section',
          { class: 'panel' },
          h('h2', {}, 'Nach Kategorie'),
          h(
            'ul',
            { class: 'stat-list' },
            ctx.categories.map((id) => {
              const info = ctx.categoryInfo(id);
              return statRow(info.name, s.byCategory[id], { icon: info.icon, color: info.color });
            }),
          ),
        )
      : null,
    played
      ? h(
          'section',
          { class: 'panel' },
          h('h2', {}, 'Nach Schwierigkeit'),
          h('ul', { class: 'stat-list' }, Object.keys(DIFFICULTIES).map((d) => statRow(DIFFICULTIES[d], s.byDifficulty[d], { color: `var(--d${d})` }))),
        )
      : null,
    s.troublemakers.length
      ? h(
          'section',
          { class: 'panel' },
          h(
            'div',
            { class: 'panel__head' },
            h('h2', {}, 'Knackpunkte'),
            h(
              'button',
              { class: 'btn btn--small', onclick: () => ctx.go('training', { replay: s.troublemakers.map((t) => t.question) }) },
              icon('book', { size: 18 }), 'Diese Fragen üben',
            ),
          ),
          h(
            'ol',
            { class: 'review__list review__list--numbered' },
            s.troublemakers.map((t) =>
              h(
                'li',
                {},
                h('div', { class: 'review__q' }, t.question.question),
                h('div', { class: 'review__a' }, '✓ ', t.question.correct),
                h('div', { class: 'review__x' }, `${t.wrong}× falsch bei ${t.asked} ${t.asked === 1 ? 'Versuch' : 'Versuchen'}`),
              ),
            ),
          ),
        )
      : null,
    h(
      'div',
      { class: 'actions' },
      played ? h('button', { class: 'btn btn--ghost', onclick: () => reset() }, 'Statistik zurücksetzen') : null,
      back,
    ),
  );
  back.focus();
}
