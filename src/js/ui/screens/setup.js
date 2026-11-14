// Game setup: categories (all modes), difficulty + count (training).
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { filterQuestions, buildLadder, ALL_DIFFICULTIES } from '../../core/questionPool.js';
import { LADDER_PLAN } from '../../core/modes/ladder.js';
import { chipGroup } from '../components/chips.js';
import { setKeyHandler } from '../input.js';
import { modeById } from '../modes.js';

const COUNT_OPTIONS = [10, 20, 0]; // 0 = alle

export function renderSetup(ctx, { mode }) {
  const def = modeById(mode);
  const saved = ctx.settings.setup?.[mode] ?? {};
  const keep = (list, allowed) => {
    const valid = (list ?? []).filter((v) => allowed.includes(v));
    return valid.length ? valid : allowed;
  };
  const choice = {
    categories: keep(saved.categories, ctx.categories),
    difficulties: keep(saved.difficulties, ALL_DIFFICULTIES),
    count: COUNT_OPTIONS.includes(saved.count) ? saved.count : 10,
    timer: saved.timer !== false,
  };

  const info = h('p', { class: 'setup__info', role: 'status' });
  const start = h('button', { class: 'btn btn--big', onclick: () => launch() }, 'Los geht’s!');

  const categoryChips = chipGroup({
    label: 'Kategorien',
    options: ctx.categories.map((id) => {
      const c = ctx.categoryInfo(id);
      return { value: id, label: c.name, icon: c.icon, color: c.color };
    }),
    selected: choice.categories,
    onChange: (v) => ((choice.categories = v), update()),
  });

  const sections = [
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'panel__head' },
        h('h2', {}, 'Kategorien'),
        h(
          'div',
          { class: 'panel__tools' },
          h('button', { type: 'button', class: 'link', onclick: () => categoryChips.setAll(true) }, 'alle'),
          h('button', { type: 'button', class: 'link', onclick: () => categoryChips.setAll(false) }, 'keine'),
        ),
      ),
      categoryChips.el,
    ),
  ];

  if (mode === 'ladder') {
    sections.push(
      h(
        'section',
        { class: 'panel' },
        h('h2', {}, 'Zeitlimit'),
        chipGroup({
          label: 'Zeitlimit',
          multi: false,
          options: [
            { value: true, label: '⏱ an', hint: '30 s leicht/medium · 45 s schwer/extrem' },
            { value: false, label: 'aus', hint: 'ohne Zeit-Joker' },
          ],
          selected: [choice.timer],
          onChange: (v) => (choice.timer = v[0] ?? true),
        }).el,
      ),
    );
  }

  if (mode === 'training') {
    sections.push(
      h(
        'section',
        { class: 'panel' },
        h('h2', {}, 'Schwierigkeit'),
        chipGroup({
          label: 'Schwierigkeit',
          options: ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTIES[d], color: `var(--d${d})` })),
          selected: choice.difficulties,
          onChange: (v) => ((choice.difficulties = v), update()),
        }).el,
      ),
      h(
        'section',
        { class: 'panel' },
        h('h2', {}, 'Anzahl Fragen'),
        chipGroup({
          label: 'Anzahl Fragen',
          multi: false,
          options: COUNT_OPTIONS.map((n) => ({ value: n, label: n ? String(n) : 'alle' })),
          selected: [choice.count],
          onChange: (v) => ((choice.count = v[0] ?? 10), update()),
        }).el,
      ),
    );
  }

  function pool() {
    // here an empty selection means "nothing" (in filterQuestions it means "all")
    if (!choice.categories.length || (mode === 'training' && !choice.difficulties.length)) return [];
    return filterQuestions(ctx.catalog.questions, {
      categories: choice.categories,
      difficulties: mode === 'training' ? choice.difficulties : undefined,
    });
  }

  function update() {
    const questions = pool();
    let ok = questions.length > 0;
    let text;
    if (mode === 'ladder') {
      const preview = buildLadder(questions, LADDER_PLAN);
      ok = preview.ok;
      if (!ok) text = `Nur ${questions.length} passende Fragen – für die Punkteleiter werden ${LADDER_PLAN.length} gebraucht. Bitte mehr Kategorien wählen.`;
      else if (preview.substitutions) {
        text = `${questions.length} passende Fragen. Für ${preview.substitutions} Stufe(n) gibt es nicht genug Fragen der passenden Schwierigkeit – dort wird auf eine benachbarte Stufe ausgewichen.`;
      } else text = `${questions.length} passende Fragen.`;
    } else {
      const n = choice.count ? Math.min(choice.count, questions.length) : questions.length;
      text = ok ? `${questions.length} passende Fragen – gespielt werden ${n}.` : 'Keine passenden Fragen – bitte Auswahl erweitern.';
    }
    info.textContent = text;
    info.classList.toggle('is-warning', !ok || /ausgewichen/.test(text));
    start.disabled = !ok;
  }

  function launch() {
    if (start.disabled) return;
    ctx.saveSettings({ setup: { ...ctx.settings.setup, [mode]: choice } });
    ctx.go(mode, { questions: pool(), count: choice.count, timer: choice.timer });
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  mount(
    ctx.app,
    h(
      'header',
      { class: 'setup__head' },
      h('div', { class: 'setup__icon', 'aria-hidden': 'true' }, def.icon),
      h('h1', {}, def.name),
      h('p', {}, def.desc),
    ),
    ...sections,
    info,
    h('div', { class: 'actions' }, h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Zurück'), start),
  );
  update();
  start.focus();
}
