// Game setup per mode: categories, and depending on the mode difficulty, count,
// time limit, players, variant and rounds.
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { filterQuestions, buildLadder, ALL_DIFFICULTIES } from '../../core/questionPool.js';
import { LADDER_PLAN } from '../../core/modes/ladder.js';
import { BUZZER_KEYS, MIN_PLAYERS, MAX_PLAYERS } from '../../core/modes/duel.js';
import { MAX_NAME_LENGTH } from '../../core/highscores.js';
import { chipGroup } from '../components/chips.js';
import { setKeyHandler } from '../input.js';
import { modeById } from '../modes.js';
import { JOURNEY_QUESTIONS, JOURNEY_STEPS, JOURNEY_JOKERS } from '../../core/modes/journey.js';
import { savedJourney } from './journey.js';
import { icon } from '../icons.js';

const COUNT_OPTIONS = [10, 20, 0]; // 0 = alle
const ROUND_OPTIONS = [10, 15, 20];

/** Which options each mode offers. */
const MODE_OPTIONS = {
  ladder: { timer: 'ladder' },
  training: { difficulty: true, count: true },
  blitz: { difficulty: true },
  sudden: { timer: 'sudden' },
  duel: { difficulty: true, players: true },
  journey: {},
};

const TIMER_HINTS = {
  ladder: ['30 s leicht/medium · 45 s schwer/extrem', 'ohne Zeit-Joker'],
  sudden: ['30 s leicht/medium · 45 s schwer/extrem', 'ohne Zeitdruck'],
};

export function renderSetup(ctx, { mode }) {
  const def = modeById(mode);
  const opts = MODE_OPTIONS[mode] ?? {};
  const saved = ctx.settings.setup?.[mode] ?? {};
  const keep = (list, allowed) => {
    const valid = (list ?? []).filter((v) => allowed.includes(v));
    return valid.length ? valid : allowed;
  };
  const savedNames = Array.isArray(saved.players) ? saved.players : [];
  const choice = {
    categories: keep(saved.categories, ctx.categories),
    difficulties: keep(saved.difficulties, ALL_DIFFICULTIES),
    count: COUNT_OPTIONS.includes(saved.count) ? saved.count : 10,
    timer: saved.timer !== false,
    playerCount: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, savedNames.length || MIN_PLAYERS)),
    names: Array.from({ length: MAX_PLAYERS }, (_, i) => savedNames[i] ?? ''),
    variant: saved.variant === 'turns' ? 'turns' : 'buzzer',
    rounds: ROUND_OPTIONS.includes(saved.rounds) ? saved.rounds : 10,
  };

  const info = h('p', { class: 'setup__info', role: 'status' });
  const start = h('button', { class: 'btn btn--big', onclick: () => launch() }, 'Los geht’s!');
  const panel = (title, ...content) => h('section', { class: 'panel' }, h('h2', {}, title), ...content);

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

  if (opts.difficulty) {
    sections.push(
      panel(
        'Schwierigkeit',
        chipGroup({
          label: 'Schwierigkeit',
          options: ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTIES[d], color: `var(--d${d})` })),
          selected: choice.difficulties,
          onChange: (v) => ((choice.difficulties = v), update()),
        }).el,
      ),
    );
  }

  if (opts.timer) {
    const [onHint, offHint] = TIMER_HINTS[opts.timer];
    sections.push(
      panel(
        'Zeitlimit',
        chipGroup({
          label: 'Zeitlimit',
          multi: false,
          options: [
            { value: true, icon: icon('clock', { size: 16 }), label: 'an', hint: onHint },
            { value: false, label: 'aus', hint: offHint },
          ],
          selected: [choice.timer],
          onChange: (v) => (choice.timer = v[0] ?? true),
        }).el,
      ),
    );
  }

  if (opts.count) {
    sections.push(
      panel(
        'Anzahl Fragen',
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

  if (opts.players) {
    const nameList = h('div', { class: 'players' });
    const renderNames = () => {
      nameList.replaceChildren(
        ...Array.from({ length: choice.playerCount }, (_, i) => {
          const input = h('input', {
            class: 'input',
            type: 'text',
            maxlength: String(MAX_NAME_LENGTH),
            placeholder: `Spieler ${i + 1}`,
            'aria-label': `Name Spieler ${i + 1}`,
            oninput: (e) => (choice.names[i] = e.target.value),
          });
          input.value = choice.names[i];
          return h(
            'label',
            { class: `player-input player-input--${i}` },
            h('span', { class: 'player-input__key', title: 'Buzzer-Taste', hidden: choice.variant !== 'buzzer' }, BUZZER_KEYS[i]),
            input,
          );
        }),
      );
    };
    renderNames();
    sections.push(
      panel(
        'Spieler',
        chipGroup({
          label: 'Anzahl Spieler',
          multi: false,
          options: Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => ({ value: MIN_PLAYERS + i, label: `${MIN_PLAYERS + i} Spieler` })),
          selected: [choice.playerCount],
          onChange: (v) => ((choice.playerCount = v[0] ?? MIN_PLAYERS), renderNames()),
        }).el,
        nameList,
      ),
      panel(
        'Spielweise',
        chipGroup({
          label: 'Spielweise',
          multi: false,
          options: [
            { value: 'buzzer', icon: icon('bell', { size: 16 }), label: 'Buzzer', hint: 'wer zuerst drückt, antwortet – falsch kostet Punkte' },
            { value: 'turns', icon: icon('repeat', { size: 16 }), label: 'Reihum', hint: 'jeder ist abwechselnd dran' },
          ],
          selected: [choice.variant],
          onChange: (v) => ((choice.variant = v[0] ?? 'buzzer'), renderNames()),
        }).el,
      ),
      panel(
        'Runden',
        chipGroup({
          label: 'Runden',
          multi: false,
          options: ROUND_OPTIONS.map((n) => ({ value: n, label: `${n} Fragen` })),
          selected: [choice.rounds],
          onChange: (v) => ((choice.rounds = v[0] ?? 10), update()),
        }).el,
      ),
    );
  }

  function pool() {
    // here an empty selection means "nothing" (in filterQuestions it means "all")
    if (!choice.categories.length || (opts.difficulty && !choice.difficulties.length)) return [];
    return filterQuestions(ctx.catalog.questions, {
      categories: choice.categories,
      difficulties: opts.difficulty ? choice.difficulties : undefined,
    });
  }

  function update() {
    const questions = pool();
    const n = questions.length;
    let ok = n > 0;
    let warn = false;
    let text = ok ? `${n} passende Fragen.` : 'Keine passenden Fragen – bitte Auswahl erweitern.';
    if (mode === 'ladder' && n > 0) {
      const preview = buildLadder(questions, LADDER_PLAN);
      ok = preview.ok;
      if (!ok) text = `Nur ${n} passende Fragen – für die Punkteleiter werden ${LADDER_PLAN.length} gebraucht. Bitte mehr Kategorien wählen.`;
      else if (preview.substitutions) {
        warn = true;
        text = `${n} passende Fragen. Für ${preview.substitutions} Stufe(n) gibt es nicht genug Fragen der passenden Schwierigkeit – dort wird auf eine benachbarte Stufe ausgewichen.`;
      }
    } else if (mode === 'training' && ok) {
      text = `${n} passende Fragen – gespielt werden ${choice.count ? Math.min(choice.count, n) : n}.`;
    } else if (mode === 'blitz' && ok && n < 20) {
      warn = true;
      text = `Nur ${n} passende Fragen – in der Blitzrunde werden sie sich wiederholen.`;
    } else if (mode === 'sudden' && ok) {
      text = `${n} passende Fragen – so lang kann die Serie höchstens werden.`;
    } else if (mode === 'journey' && ok) {
      warn = n < JOURNEY_QUESTIONS;
      text = warn
        ? `Nur ${n} passende Fragen – für die ganze Reise werden ${JOURNEY_QUESTIONS} gebraucht. Mehr Kategorien wählen, sonst endet sie früher.`
        : `${n} passende Fragen in ${choice.categories.length} Kategorien.`;
    } else if (mode === 'duel' && ok) {
      warn = n < choice.rounds;
      text = warn ? `Nur ${n} passende Fragen – es werden ${n} Runden gespielt.` : `${n} passende Fragen – gespielt werden ${choice.rounds} Runden.`;
    }
    info.textContent = text;
    info.classList.toggle('is-warning', !ok || warn);
    start.disabled = !ok;
  }

  function launch() {
    if (start.disabled) return;
    const players = choice.names.slice(0, choice.playerCount).map((name, i) => name.trim() || `Spieler ${i + 1}`);
    const toSave = { ...choice, names: undefined, players: choice.names.slice(0, choice.playerCount) };
    ctx.saveSettings({ setup: { ...ctx.settings.setup, [mode]: toSave } });
    ctx.go(mode, {
      questions: pool(),
      categories: choice.categories,
      count: choice.count,
      timer: choice.timer,
      players,
      variant: choice.variant,
      rounds: choice.rounds,
    });
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  const resume = mode === 'journey' ? savedJourney(ctx) : null;
  if (resume) {
    const questions = filterQuestions(ctx.catalog.questions, { categories: resume.categories });
    const jokers = Object.entries(resume.jokers ?? {}).filter(([, n]) => n > 0).map(([t, n]) => `${n}× ${JOURNEY_JOKERS[t]?.label ?? t}`);
    const go = h(
      'button',
      { class: 'btn', disabled: !questions.length, onclick: () => ctx.go('journey', { questions, categories: resume.categories, resume }) },
      'Reise fortsetzen',
    );
    sections.unshift(
      h(
        'section',
        { class: 'panel journey__resume' },
        h('h2', {}, 'Gespeicherte Reise'),
        h(
          'p',
          { class: 'setup__info' },
          `Weiter mit Etappe ${resume.step + 1} von ${JOURNEY_STEPS}`,
          jokers.length ? ` · Joker: ${jokers.join(', ')}` : ' · keine Joker',
          resume.date ? ` · gespeichert am ${new Date(resume.date).toLocaleDateString('de-DE')}` : '',
          questions.length ? '' : ' – die Kategorien sind derzeit nicht verfügbar.',
        ),
        h('div', { class: 'actions actions--start' }, go),
        h('p', { class: 'options__hint' }, '„Los geht’s!“ unten startet eine neue Reise und ersetzt die gespeicherte.'),
      ),
    );
  }

  mount(
    ctx.app,
    h(
      'header',
      { class: 'setup__head' },
      h('div', { class: `setup__icon setup__icon--${mode}` }, icon(def.icon, { size: 30 })),
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
