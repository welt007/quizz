import { h, mount } from '../dom.js';
import { MODES } from '../modes.js';
import { icon } from '../icons.js';
import { showHelp } from '../components/help.js';

export function renderStart(ctx) {
  const { questions, activeCatalogs, totalCatalogs } = ctx.catalog;
  const empty = questions.length === 0;

  const modeButtons = MODES.map((m, i) =>
    h(
      'button',
      {
        class: `mode mode--${m.id}${i === 0 ? ' mode--featured' : ''}`,
        disabled: !m.ready || empty,
        title: m.ready ? null : 'Folgt in einem der nächsten Meilensteine',
        onclick: () => ctx.go('setup', { mode: m.id }),
      },
      h('span', { class: 'mode__icon' }, icon(m.icon, { size: i === 0 ? 26 : 22 })),
      h('span', { class: 'mode__name' }, m.name),
      h('span', { class: 'mode__desc' }, i === 0 ? m.desc : m.short),
      i === 0 ? h('span', { class: 'mode__go', 'aria-hidden': 'true' }, 'Los') : null,
      m.ready ? null : h('span', { class: 'badge' }, 'demnächst'),
    ),
  );
  const tool = (name, label, screen) => h('button', { class: 'tool', onclick: () => ctx.go(screen) }, icon(name, { size: 18 }), h('span', {}, label));

  mount(
    ctx.app,
    h('header', { class: 'logo' }, h('h1', {}, 'QUIZSHOW'), h('p', {}, 'Licht an, Bühne frei!')),
    empty ? h('p', { class: 'setup__info is-warning' }, 'Keine aktiven Fragen – bitte in den Optionen mindestens einen Katalog aktivieren.') : null,
    h('section', { class: 'start__modes', 'aria-labelledby': 'modes-title' }, h('h2', { class: 'visually-hidden', id: 'modes-title' }, 'Spielmodus'), h('div', { class: 'modes' }, modeButtons)),
    h(
      'nav',
      { class: 'tools', 'aria-label': 'Menü' },
      tool('grid', 'Kategorien', 'categories'),
      tool('medal', 'Bestenliste', 'highscores'),
      tool('chart', 'Statistik', 'statistics'),
      tool('sliders', 'Optionen & Kataloge', 'options'),
    ),
    h(
      'footer',
      { class: 'footer' },
      `${ctx.platform === 'android' ? 'App-' : ''}Version ${ctx.version} · ${activeCatalogs} von ${totalCatalogs} Katalogen aktiv · `,
      h('button', { class: 'link', onclick: () => ctx.go('options') }, 'Kataloge verwalten'),
      ' · ',
      h('button', { class: 'link', onclick: () => showHelp() }, 'Tastenkürzel (?)'),
    ),
  );

  (empty ? ctx.app.querySelector('.footer .link') : modeButtons[0]).focus();
}
