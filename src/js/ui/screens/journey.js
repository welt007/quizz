// Game screen + result screen for "Journey" (see core/modes/journey.js).
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import {
  createJourneyGame, JOURNEY_JOKERS, JOKER_TYPES, JOURNEY_STEPS, isMilestone, stepLength, journeyDifficulty,
} from '../../core/modes/journey.js';
import { questionView } from '../components/questionView.js';
import { confirmDialog } from '../components/dialog.js';
import { highscoreEntry } from '../components/highscoreEntry.js';
import { nextButton } from '../components/nextButton.js';
import { gameFooter } from '../components/gameFooter.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, pulseClass } from '../effects.js';
import { icon } from '../icons.js';

const LOCK_DELAY_MS = 800;
const JOKER_ICONS = { switch: 'shuffle', shield: 'shield', fifty: 'half' };
const JOKER_KEYS = { k: 'switch', f: 'shield', h: 'fifty' };

/** Saved journey (settings.journey): resume at the start of a stage. */
export const savedJourney = (ctx) => {
  const j = ctx.settings.journey;
  return j && Number.isInteger(j.step) && Array.isArray(j.categories) ? j : null;
};

/** params: { questions, categories, resume? } */
export function renderJourney(ctx, params) {
  const game = createJourneyGame(params.questions, { stats: ctx.stats, resume: params.resume });
  const s = game.state;
  let alive = true;
  let busy = false;
  let view = null;

  const save = () => ctx.saveSettings({ journey: { ...game.snapshot(), categories: params.categories, date: new Date().toISOString().slice(0, 10) } });
  const clearSave = () => ctx.saveSettings({ journey: null });

  const status = h('div', { class: 'topbar__status' });
  const route = h('ol', { class: 'journey__route', 'aria-label': 'Reiseroute' });
  const stageInfo = h('div', { class: 'journey__stage' });
  const pips = h('div', { class: 'journey__pips', 'aria-hidden': 'true' });
  const jokerButtons = Object.fromEntries(
    JOKER_TYPES.map((type) => [
      type,
      h(
        'button',
        {
          class: `joker joker--${type}`,
          title: `${JOURNEY_JOKERS[type].title} (Taste ${Object.keys(JOKER_KEYS).find((k) => JOKER_KEYS[k] === type).toUpperCase()})`,
          onclick: () => useJoker(type),
        },
        h('span', { class: 'joker__icon' }, icon(JOKER_ICONS[type], { size: 18 })),
        h('span', { class: 'joker__label' }, JOURNEY_JOKERS[type].short),
        h('span', { class: 'joker__count' }),
      ),
    ]),
  );
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--journey' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link topbar__exit', onclick: () => abort() }, icon('x', { size: 16 }), 'Pause'), status),
        route,
        h('div', { class: 'journey__head' }, stageInfo, pips),
        h('div', { class: 'jokers journey__jokers', role: 'group', 'aria-label': 'Joker' }, Object.values(jokerButtons)),
        stage,
        explanation,
        gameFooter(feedback, actions),
      ),
    ),
  );
  ctx.onLeave(() => (alive = false));

  // ---------- rendering ----------
  function renderRoute() {
    route.replaceChildren(
      ...Array.from({ length: JOURNEY_STEPS }, (_, i) => {
        const done = i < s.stepsDone;
        const current = !done && i === s.step && s.phase !== 'finished';
        const cls = ['journey__stop', done ? 'is-done' : '', current ? 'is-current' : '', isMilestone(i) ? 'is-milestone' : ''].filter(Boolean).join(' ');
        const label = `Etappe ${i + 1}${isMilestone(i) ? ' (Etappenziel)' : ''}${done ? ' – geschafft' : current ? ' – aktuell' : ''}`;
        return h('li', { class: cls, 'aria-label': label, title: label }, isMilestone(i) ? icon(done ? 'check' : 'flag', { size: 14 }) : done ? icon('check', { size: 12 }) : null);
      }),
    );
    status.textContent = `Etappe ${Math.min(s.step + 1, JOURNEY_STEPS)} von ${JOURNEY_STEPS}`;
  }

  function renderStage() {
    const info = ctx.categoryInfo(s.category);
    stageInfo.replaceChildren(
      h('span', { class: 'journey__label' }, isMilestone(s.step) ? 'Etappenziel' : `Etappe ${s.step + 1}`),
      h('span', { class: 'question__category', '--cat': info.color }, `${info.icon} ${info.name}`),
      h('span', { class: `difficulty difficulty--${s.difficulty}` }, DIFFICULTIES[s.difficulty]),
    );
    pips.replaceChildren(
      ...Array.from({ length: s.length }, (_, i) => {
        const r = s.results[i];
        return h('span', { class: `journey__pip${r === true ? ' is-right' : r === false ? ' is-wrong' : i === s.results.length ? ' is-current' : ''}` });
      }),
    );
    pips.setAttribute('aria-label', `${s.results.filter(Boolean).length} von ${s.length} Fragen richtig`);
    updateJokers();
  }

  function updateJokers() {
    for (const [type, btn] of Object.entries(jokerButtons)) {
      const count = s.jokers[type];
      btn.disabled = busy || !game.canUse(type);
      btn.hidden = count === 0 && !(type === 'shield' && s.shield) && !(type === 'fifty' && s.fifty);
      btn.classList.toggle('is-active', (type === 'shield' && s.shield) || (type === 'fifty' && s.fifty));
      btn.querySelector('.joker__count').textContent = count > 1 ? `×${count}` : '';
      btn.setAttribute('aria-label', `${JOURNEY_JOKERS[type].label}, ${count}× vorhanden`);
    }
    jokerButtons.switch.parentElement.hidden = Object.values(jokerButtons).every((b) => b.hidden);
  }

  function renderQuestion() {
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose, confirm: ctx.settings.confirmAnswer === true, confirmSlot: actions });
    if (s.hidden.length) view.hide(s.hidden);
    stage.replaceChildren(view.el);
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    actions.replaceChildren();
    renderRoute();
    renderStage();
    view.el.querySelector('.question__text')?.focus({ preventScroll: true });
  }

  // ---------- playing ----------
  function choose(index) {
    if (busy || s.phase !== 'question') return;
    busy = true;
    view.lock(index);
    updateJokers();
    audio.play('click');
    setTimeout(() => {
      if (!alive) return;
      game.answer(index);
      ctx.record(s.current.question.id, s.correct);
      view.reveal(index);
      busy = false;
      showOutcome();
    }, LOCK_DELAY_MS);
  }

  function showOutcome() {
    const q = s.current.question;
    renderStage();
    if (s.correct) {
      audio.play('right');
      feedback.className = 'feedback is-right';
      const left = s.length - s.results.length;
      feedback.textContent = left ? `Richtig! Noch ${left} ${left === 1 ? 'Frage' : 'Fragen'} in dieser Etappe.` : 'Richtig! Etappe geschafft!';
    } else {
      audio.play('wrong');
      pulseClass(stage, 'is-shaking', 500);
      feedback.className = 'feedback is-wrong';
      feedback.textContent = s.outcome
        ? `Falsch – richtig ist: ${q.correct}. Hier endet die Reise.`
        : `Falsch – richtig ist: ${q.correct}. Der Joker „Fehler frei“ rettet dich!`;
    }
    explanation.textContent = q.explanation ?? '';
    const last = s.results.length >= s.length;
    const label = s.outcome ? 'Zum Ergebnis' : last ? 'Etappe abschließen' : 'Nächste Frage';
    const next = nextButton(ctx, label, () => advance());
    actions.replaceChildren(next);
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (busy) return;
    game.next();
    if (s.phase === 'finished') return renderJourneyResult(ctx, s, params, clearSave);
    if (s.phase === 'question') return renderQuestion();
    renderBreak();
  }

  function useJoker(type) {
    if (busy || !game.useJoker(type)) return;
    audio.play('joker');
    if (type === 'switch') {
      ctx.toast(`Neue Kategorie: ${ctx.categoryInfo(s.category).name}`);
      renderQuestion();
    } else if (type === 'fifty') {
      view.hide(s.hidden);
      renderStage();
    } else renderStage();
  }

  // ---------- between stages ----------
  function renderBreak() {
    renderRoute();
    stageInfo.replaceChildren();
    pips.replaceChildren();
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    updateJokers();
    const done = s.stepsDone;
    if (s.phase === 'reward') {
      audio.play('win');
      confetti({ count: 120, duration: 2200 });
      const choices = JOKER_TYPES.map((type) =>
        h(
          'button',
          { class: 'journey__reward', onclick: () => (game.takeReward(type), audio.play('safe'), renderBreak()) },
          h('span', { class: 'journey__reward-icon' }, icon(JOKER_ICONS[type], { size: 26 })),
          h('span', { class: 'journey__reward-name' }, JOURNEY_JOKERS[type].label),
          h('span', { class: 'journey__reward-text' }, JOURNEY_JOKERS[type].title),
        ),
      );
      stage.replaceChildren(
        h(
          'section',
          { class: 'journey__card' },
          h('div', { class: 'result__icon' }, icon('flag', { size: 40 })),
          h('h2', { class: 'journey__title' }, `Etappenziel erreicht!`),
          h('p', { class: 'journey__text' }, `${done} von ${JOURNEY_STEPS} Etappen geschafft. Such dir einen Joker aus – du kannst ihn in einer späteren Etappe einsetzen.`),
          h('div', { class: 'journey__rewards' }, choices),
        ),
      );
      actions.replaceChildren();
      choices[0].focus({ preventScroll: true });
      return;
    }
    // stepDone: the journey can be resumed from here
    save();
    audio.play('safe');
    const nextLen = stepLength(s.step);
    const nextDiff = journeyDifficulty(s.step);
    const go = h('button', { class: 'btn btn--next', onclick: () => startNext() }, `Weiter zu Etappe ${s.step + 1}`, icon('arrowRight', { size: 18 }));
    stage.replaceChildren(
      h(
        'section',
        { class: 'journey__card' },
        h('div', { class: 'result__icon' }, icon('check', { size: 40 })),
        h('h2', { class: 'journey__title' }, `Etappe ${done} geschafft!`),
        h(
          'p',
          { class: 'journey__text' },
          `Als Nächstes: ${isMilestone(s.step) ? 'Etappenziel' : `Etappe ${s.step + 1}`} mit ${nextLen} Fragen, Schwierigkeit ${DIFFICULTIES[nextDiff]}`,
          nextDiff > journeyDifficulty(s.step - 1) ? ' – jetzt wird es schwerer!' : '.',
          ' Die Kategorie wird ausgelost.',
        ),
        h('p', { class: 'journey__hint' }, 'Dein Fortschritt ist gespeichert – du kannst die Reise jederzeit hier fortsetzen.'),
      ),
    );
    actions.replaceChildren(go);
    go.focus({ preventScroll: true });
  }

  function startNext() {
    game.startStep();
    if (s.phase === 'finished') return renderJourneyResult(ctx, s, params, clearSave);
    audio.play('start');
    window.scrollTo(0, 0);
    renderQuestion();
  }

  async function abort() {
    if (s.phase === 'finished') return;
    const yes = await confirmDialog({
      title: 'Reise unterbrechen?',
      text: `Du kannst sie später in der Journey-Einrichtung ab Etappe ${s.step + 1} fortsetzen.`,
      confirmLabel: 'Unterbrechen',
    });
    if (yes) ctx.go('start');
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return abort();
    if (busy) return;
    if (s.phase === 'question') {
      if (e.key === 'Enter' && view.confirmSelection()) return e.preventDefault();
      const i = answerIndexFromKey(e.key);
      if (i >= 0) return view.pick(i);
      const joker = JOKER_KEYS[e.key.toLowerCase()];
      if (joker) useJoker(joker);
    } else if (isContinueKey(e)) {
      e.preventDefault();
      (actions.querySelector('button') ?? stage.querySelector('button'))?.click();
    }
  });

  save();
  audio.play('start');
  renderQuestion();
  if (params.resume) ctx.toast(`Willkommen zurück – weiter geht's mit Etappe ${s.step + 1}.`);
}

function renderJourneyResult(ctx, s, params, clearSave) {
  clearSave();
  const won = s.outcome === 'won';
  const detail = `${s.totalCorrect} richtig · ${ctx.categoryLabel(params.categories)}`;
  const entry = highscoreEntry(ctx, 'journey', s.stepsDone, detail);
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('setup', { mode: 'journey' }) }, 'Neue Reise');
  const title = won ? 'Ziel erreicht!' : s.outcome === 'stuck' ? 'Keine Fragen mehr' : 'Endstation!';
  const sub = won
    ? `Alle ${JOURNEY_STEPS} Etappen geschafft – was für eine Reise!`
    : s.outcome === 'stuck'
      ? 'Für die nächste Etappe gibt es nicht genug Fragen. Wähle beim nächsten Mal mehr Kategorien.'
      : s.stepsDone >= 10
        ? 'Schon weit gekommen – das Ziel war in Sichtweite!'
        : s.stepsDone >= 5
          ? 'Ein Etappenziel geschafft – nicht schlecht!'
          : 'Die nächste Reise wird länger!';

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: `result${won ? ' result--won' : s.outcome === 'lost' ? ' result--lost' : ''}` },
      h('div', { class: 'result__icon' }, icon(won ? 'trophy' : 'route', { size: 44 })),
      h('h1', { class: 'result__title' }, title),
      h('p', { class: 'result__points' }, h('strong', {}, `${s.stepsDone} / ${JOURNEY_STEPS}`), ' Etappen'),
      h('p', { class: 'result__sub' }, sub, ` ${s.totalCorrect} richtige Antworten.`),
      entry?.el,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        again,
      ),
    ),
  );
  if (won || entry) confetti();
  if (entry) entry.focus();
  else again.focus();
}
