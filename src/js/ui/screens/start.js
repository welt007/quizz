import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { countByDifficulty } from '../../core/questionPool.js';
import { MODES } from '../modes.js';

export function renderStart(ctx) {
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
          h('button', { class: 'link', onclick: () => ctx.go('highscores') }, '🏅 Bestenliste'),
          h('button', { class: 'link', onclick: () => ctx.go('options') }, '⚙️ Optionen & Kataloge'),
        ),
      ),
      empty ? h('p', { class: 'setup__info is-warning' }, 'Keine aktiven Fragen – bitte in den Optionen mindestens einen Katalog aktivieren.') : null,
      h('div', { class: 'modes' }, modeButtons),
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, `Kategorien · ${questions.length} Fragen`),
      h(
        'div',
        { class: 'categories' },
        ctx.categories.map((id) => {
          const info = ctx.categoryInfo(id);
          const counts = countByDifficulty(questions.filter((q) => q.category === id));
          return h(
            'div',
            { class: 'category', '--cat': info.color },
            h('span', { class: 'category__icon', 'aria-hidden': 'true' }, info.icon),
            h(
              'div',
              {},
              h('div', { class: 'category__name' }, info.name),
              h('div', { class: 'category__meta' }, Object.keys(DIFFICULTIES).map((d) => `${counts[d]} ${DIFFICULTIES[d]}`).join(' · ')),
            ),
          );
        }),
      ),
    ),
    h(
      'footer',
      { class: 'footer' },
      `Version ${ctx.version} · ${activeCatalogs} von ${totalCatalogs} Katalogen aktiv · `,
      h('button', { class: 'link', onclick: () => ctx.go('options') }, 'Kataloge verwalten'),
    ),
  );

  (empty ? ctx.app.querySelector('.footer .link') : modeButtons[0]).focus();
}
