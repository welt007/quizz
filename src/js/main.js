// Entry point. M0: start screen + sample question to prove the data flow
// (embedded catalogs → question pool → rendering incl. images).
// The real game screens and modes follow in M1–M3 (see docs/PLAN.md).
import { h, mount } from './ui/dom.js';
import { DIFFICULTIES } from './core/catalog.js';
import { prepareQuestion, ANSWER_KEYS } from './core/question.js';
import { pick } from './core/random.js';

/* global __APP_VERSION__, __BUILD_DATE__ */
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

const MODES = [
  { id: 'ladder', icon: '🏆', name: 'Punkteleiter', desc: '12 Fragen, steigende Schwierigkeit, Joker.' },
  { id: 'blitz', icon: '⚡', name: 'Blitzrunde', desc: '60 Sekunden – so viele Fragen wie möglich.' },
  { id: 'sudden', icon: '💀', name: 'Sudden Death', desc: 'Weiter bis zum ersten Fehler.' },
  { id: 'duel', icon: '🎮', name: 'Duell / Party', desc: '2–4 Spieler an einem Gerät, mit Buzzer.' },
  { id: 'training', icon: '📚', name: 'Training', desc: 'Freie Auswahl, ohne Zeitdruck, mit Erklärungen.' },
];

function loadEmbeddedCatalogs() {
  const el = document.getElementById('embedded-catalogs');
  if (!el) return { manifest: { title: 'Kein Katalog', version: '-', categories: {} }, questions: [] };
  return JSON.parse(el.textContent);
}

const state = {
  catalog: loadEmbeddedCatalogs(),
};
const app = document.getElementById('app');

function categoryInfo(id) {
  return state.catalog.manifest.categories?.[id] ?? { name: id, icon: '❓' };
}

function renderStart() {
  const { manifest, questions } = state.catalog;
  const byCat = {};
  for (const q of questions) {
    byCat[q.category] ??= { total: 0, 1: 0, 2: 0, 3: 0 };
    byCat[q.category].total++;
    byCat[q.category][q.difficulty]++;
  }

  mount(
    app,
    h('header', { class: 'logo' }, h('h1', {}, 'QUIZSHOW'), h('p', {}, 'Licht an, Bühne frei!')),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Spielmodus'),
      h(
        'div',
        { class: 'modes' },
        MODES.map((m) =>
          h(
            'button',
            { class: 'mode', disabled: true, title: 'Folgt in einem der nächsten Meilensteine' },
            h('span', { class: 'mode__icon', 'aria-hidden': 'true' }, m.icon),
            h('span', { class: 'mode__name' }, m.name),
            h('span', { class: 'mode__desc' }, m.desc),
            h('span', { class: 'badge' }, 'in Arbeit'),
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, `Kategorien · ${questions.length} Fragen`),
      h(
        'div',
        { class: 'categories' },
        Object.entries(byCat).map(([id, c]) => {
          const info = categoryInfo(id);
          return h(
            'div',
            { class: 'category', '--cat': info.color },
            h('span', { class: 'category__icon', 'aria-hidden': 'true' }, info.icon ?? '❓'),
            h(
              'div',
              {},
              h('div', { class: 'category__name' }, info.name ?? id),
              h('div', { class: 'category__meta' }, [1, 2, 3].map((d) => `${c[d]} ${DIFFICULTIES[d]}`).join(' · ')),
            ),
          );
        }),
      ),
    ),
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn', onclick: () => renderSample(), disabled: questions.length === 0 }, '▶ Probefrage'),
    ),
    h('footer', { class: 'footer' }, `Version ${VERSION} ${BUILD_DATE} · Katalog „${manifest.title}“ ${manifest.version}`),
  );
}

function renderSample() {
  const prepared = prepareQuestion(pick(state.catalog.questions));
  const { question: q, answers, correctIndex } = prepared;
  const info = categoryInfo(q.category);

  const explanation = h('p', { class: 'explanation', hidden: true }, q.explanation ?? '');
  const next = h('div', { class: 'actions', hidden: true },
    h('button', { class: 'btn', onclick: () => renderSample() }, 'Nächste Frage'),
    h('button', { class: 'btn btn--ghost', onclick: () => renderStart() }, 'Zurück'),
  );

  const buttons = answers.map((text, i) =>
    h(
      'button',
      { class: 'answer', onclick: () => reveal(i) },
      h('span', { class: 'answer__key' }, `${ANSWER_KEYS[i]}:`),
      h('span', {}, text),
      h('span', { class: 'answer__mark', 'aria-hidden': 'true' }),
    ),
  );

  function reveal(chosen) {
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correctIndex) {
        b.classList.add('is-right');
        b.lastChild.textContent = '✓';
      } else if (i === chosen) {
        b.classList.add('is-wrong');
        b.lastChild.textContent = '✗';
      }
    });
    if (q.explanation) explanation.hidden = false;
    next.hidden = false;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    const idx = ANSWER_KEYS.indexOf(e.key.toUpperCase());
    const num = Number(e.key) - 1;
    if (idx >= 0) reveal(idx);
    else if (num >= 0 && num < 4) reveal(num);
  }
  document.addEventListener('keydown', onKey);

  mount(
    app,
    h(
      'section',
      { class: 'question' },
      h(
        'div',
        { class: 'question__meta' },
        h('span', {}, `${info.icon ?? ''} ${info.name ?? q.category}`),
        h('span', { 'aria-hidden': 'true' }, '·'),
        h('span', {}, DIFFICULTIES[q.difficulty]),
      ),
      q.image ? h('img', { class: 'question__image', src: q.image, alt: 'Bild zur Frage' }) : null,
      h('h2', { class: 'question__text' }, q.question),
      h('div', { class: 'answers' }, buttons),
      explanation,
      next,
    ),
  );
}

renderStart();
