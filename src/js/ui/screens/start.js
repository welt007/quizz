import { h, mount } from '../dom.js';
import { MODES } from '../modes.js';
import { showHelp } from '../components/help.js';

export function renderStart(ctx) {
  const tool = (icon, label, screen) =>
    h('button', { class: 'link tool', onclick: () => ctx.go(screen) }, h('span', { class: 'tool__icon', 'aria-hidden': 'true' }, icon), ' ', h('span', {}, label));
  const { questions, activeCatalogs, totalCatalogs } = ctx.catalog;
  const empty = questions.length === 0;

  const modeButtons = MODES.map((m) =>
    h(
      'button',
      {
        class: 'mode',
        disabled: !m.ready || empty,
        title: m.ready ? null : 'Folgt in einem der nächsten Meilensteine',
        onclick: () => ctx.go('setup', { mode: m.id }),
      },
      h('span', { class: 'mode__icon', 'aria-hidden': 'true' }, m.icon),
      h('span', { class: 'mode__name' }, m.name),
      h('span', { class: 'mode__desc' }, m.desc),
      m.ready ? null : h('span', { class: 'badge' }, 'demnächst'),
    ),
  );

  mount(
    ctx.app,
    h('header', { class: 'logo' }, h('h1', {}, 'QUIZSHOW'), h('p', {}, 'Licht an, Bühne frei!')),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel__head' },
        h('h2', {}, 'Spielmodus'),
        h(
          'div',
          { class: 'panel__tools' },
          tool('🗂️', 'Kategorien', 'categories'),
          tool('🏅', 'Bestenliste', 'highscores'),
          tool('📊', 'Statistik', 'statistics'),
          tool('⚙️', 'Optionen & Kataloge', 'options'),
        ),
      ),
      empty ? h('p', { class: 'setup__info is-warning' }, 'Keine aktiven Fragen – bitte in den Optionen mindestens einen Katalog aktivieren.') : null,
      h('div', { class: 'modes' }, modeButtons),
    ),
    h(
      'footer',
      { class: 'footer' },
      `${ctx.platform === 'android' ? 'App-' : ''}Version ${ctx.version} · ${activeCatalogs} von ${totalCatalogs} Katalogen aktiv · `,
      h('button', { class: 'link', onclick: () => ctx.go('options') }, 'Kataloge verwalten'),
      ' · ',
      h('button', { class: 'link', onclick: () => showHelp() }, '⌨️ Tastenkürzel (?)'),
    ),
  );

  (empty ? ctx.app.querySelector('.footer .link') : modeButtons[0]).focus();
}
