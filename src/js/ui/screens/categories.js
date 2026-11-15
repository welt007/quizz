// Overview of the categories in the current question pool (from the start screen).
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { countByDifficulty } from '../../core/questionPool.js';
import { setKeyHandler } from '../input.js';

export function renderCategories(ctx) {
  const { questions } = ctx.catalog;

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  const back = h('button', { class: 'btn', onclick: () => ctx.go('start') }, 'Zurück');
  mount(
    ctx.app,
    h(
      'header',
      { class: 'setup__head' },
      h('div', { class: 'setup__icon', 'aria-hidden': 'true' }, '🗂️'),
      h('h1', {}, 'Kategorien'),
      h('p', {}, `${questions.length} Fragen in ${ctx.categories.length} Kategorien`),
    ),
    h(
      'section',
      { class: 'panel' },
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
      h('div', { class: 'actions actions--end' }, h('button', { class: 'link', onclick: () => ctx.go('options') }, 'Kataloge verwalten')),
    ),
    h('div', { class: 'actions' }, back),
  );
  back.focus({ preventScroll: true });
}
