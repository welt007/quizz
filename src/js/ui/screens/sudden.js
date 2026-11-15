// Game screen + result screen for "Sudden Death".
import { h, mount } from '../dom.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { createSuddenDeathGame, suddenDifficulty, QUESTIONS_PER_STEP } from '../../core/modes/sudden.js';
import { questionView } from '../components/questionView.js';
import { createTimer } from '../components/timer.js';
import { confirmDialog } from '../components/dialog.js';
import { highscoreEntry } from '../components/highscoreEntry.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, pulseClass } from '../effects.js';

const LOCK_DELAY_MS = 800;

/** params: { questions, categories, timer } */
export function renderSudden(ctx, params) {
  const game = createSuddenDeathGame(params.questions, { stats: ctx.stats, timer: params.timer !== false });
  const s = game.state;
  let alive = true;
  let busy = false;
  let timer = null;

  const streakEl = h('strong', { class: 'sudden__streak' }, '0');
  const levelEl = h('span', { class: 'sudden__level' });
  const status = h('div', { class: 'topbar__status' });
  const timerSlot = h('div', { class: 'hud__timer' });
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--sudden' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link', onclick: () => abort() }, '✕ Beenden'), status),
        h(
          'div',
          { class: 'hud' },
          h('div', { class: 'sudden__box' }, h('span', { class: 'sudden__label' }, '🔥 Serie'), streakEl, levelEl),
          timerSlot,
        ),
        stage,
        feedback,
        explanation,
        actions,
      ),
    ),
  );
  ctx.onLeave(() => {
    alive = false;
    timer?.pause();
  });

  let view;
  function renderQuestion() {
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose });
    stage.replaceChildren(view.el);
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    actions.replaceChildren();
    streakEl.textContent = String(s.score);
    const target = suddenDifficulty(s.number);
    levelEl.textContent = `Stufe: ${DIFFICULTIES[target]}`;
    levelEl.className = `sudden__level difficulty--${target}`;
    const nextStep = QUESTIONS_PER_STEP - (s.number % QUESTIONS_PER_STEP);
    status.textContent = `Frage ${s.number + 1}${target < 4 ? ` · nächste Stufe in ${nextStep}` : ' · Endstufe'}`;
    if (s.number > 0 && s.number % QUESTIONS_PER_STEP === 0 && target <= 4) {
      pulseClass(levelEl, 'is-bump', 900);
      ctx.toast(`Stufe hoch: ${DIFFICULTIES[target]}!`);
    }
    const limit = game.timeLimit();
    timer = limit ? createTimer({ seconds: limit, onExpire: timeUp, onSecond: (sec) => sec <= 5 && sec > 0 && audio.play('tick') }) : null;
    timerSlot.replaceChildren(timer ? timer.el : '');
    timerSlot.classList.remove('is-idle');
    timer?.start();
    view.el.querySelector('.question__text')?.focus({ preventScroll: true });
  }

  function choose(index) {
    if (busy || s.phase !== 'question') return;
    busy = true;
    timer?.pause();
    view.lock(index);
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

  function timeUp() {
    if (busy || s.phase !== 'question') return;
    game.timeUp();
    ctx.record(s.current.question.id, false);
    view.reveal(null);
    showOutcome();
  }

  function showOutcome() {
    timerSlot.classList.add('is-idle');
    streakEl.textContent = String(s.score);
    const q = s.current.question;
    if (s.correct) {
      audio.play('right');
      pulseClass(streakEl, 'is-bump', 500);
      feedback.className = 'feedback is-right';
      feedback.textContent = `Richtig! Serie: ${s.score}`;
    } else {
      audio.play(s.timedOut ? 'timeUp' : 'wrong');
      pulseClass(stage, 'is-shaking', 500);
      feedback.className = 'feedback is-wrong';
      feedback.textContent = `${s.timedOut ? 'Zeit abgelaufen!' : 'Falsch!'} Richtig ist: ${q.correct}`;
    }
    explanation.textContent = q.explanation ?? '';
    const next = h('button', { class: 'btn', onclick: () => advance() }, s.outcome ? 'Zum Ergebnis' : 'Nächste Frage');
    actions.replaceChildren(next);
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (busy) return;
    game.next();
    if (s.phase === 'finished') renderSuddenResult(ctx, s, params);
    else renderQuestion();
  }

  async function abort() {
    if (s.phase === 'finished') return;
    const wasRunning = timer?.running;
    timer?.pause();
    const yes = await confirmDialog({ title: 'Spiel beenden?', text: 'Die Serie wird nicht gewertet.', confirmLabel: 'Beenden' });
    if (yes) ctx.go('start');
    else if (wasRunning) timer.start();
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return abort();
    if (busy) return;
    if (s.phase === 'question') {
      const i = answerIndexFromKey(e.key);
      if (i >= 0) choose(i);
    } else if (isContinueKey(e)) {
      e.preventDefault();
      actions.querySelector('button')?.click();
    }
  });

  audio.play('start');
  renderQuestion();
}

function renderSuddenResult(ctx, s, params) {
  const cleared = s.outcome === 'cleared';
  const detail = `${ctx.categoryLabel(params.categories)}${s.timer ? '' : ' · ohne Timer'}`;
  const entry = highscoreEntry(ctx, 'sudden', s.score, detail);
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('sudden', params) }, 'Nochmal');
  const sub = cleared
    ? 'Alle passenden Fragen fehlerfrei beantwortet!'
    : s.score >= 15
      ? 'Bis in die Extrem-Zone – stark!'
      : s.score >= 5
        ? 'Ordentliche Serie!'
        : 'Da geht noch mehr!';

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: `result${cleared ? ' result--won' : ''}` },
      h('div', { class: 'result__icon', 'aria-hidden': 'true' }, cleared ? '👑' : '💀'),
      h('h1', { class: 'result__title' }, cleared ? 'Unbesiegbar!' : s.timedOut ? 'Die Zeit ist um!' : 'Erwischt!'),
      h('p', { class: 'result__points' }, h('strong', {}, String(s.score)), ' richtig in Folge'),
      h('p', { class: 'result__sub' }, sub),
      entry?.el,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'sudden' }) }, 'Einstellungen ändern'),
        again,
      ),
    ),
  );
  if (cleared || entry) confetti();
  if (entry) entry.focus();
  else again.focus();
}
