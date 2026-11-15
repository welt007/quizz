// Game screen + result screen for the "Blitzrunde".
import { h, mount } from '../dom.js';
import { orderByFreshness } from '../../core/questionPool.js';
import { createBlitzGame, BLITZ_SECONDS, PENALTY_SECONDS } from '../../core/modes/blitz.js';
import { questionView } from '../components/questionView.js';
import { createTimer } from '../components/timer.js';
import { confirmDialog } from '../components/dialog.js';
import { highscoreEntry } from '../components/highscoreEntry.js';
import { setKeyHandler, answerIndexFromKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, countdown, pulseClass } from '../effects.js';
import { formatPoints } from '../modes.js';
import { icon } from '../icons.js';

const RIGHT_PAUSE_MS = 450;
const WRONG_PAUSE_MS = 1100;

/** params: { questions, categories } */
export function renderBlitz(ctx, params) {
  const game = createBlitzGame(orderByFreshness(params.questions, ctx.stats));
  const s = game.state;
  let alive = true;
  let busy = true; // until the countdown is over
  let ended = false;

  const scoreEl = h('strong', { class: 'blitz__score' }, '0');
  const multiEl = h('span', { class: 'blitz__multi' }, '×1');
  const status = h('div', { class: 'topbar__status' });
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const timer = createTimer({
    seconds: BLITZ_SECONDS,
    onExpire: () => end(),
    onSecond: (sec) => sec <= 5 && sec > 0 && audio.play('tick'),
  });

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--blitz' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link topbar__exit', onclick: () => abort() }, icon('x', { size: 16 }), 'Beenden'), status),
        h(
          'div',
          { class: 'hud' },
          h('div', { class: 'blitz__scorebox' }, h('span', { class: 'blitz__label' }, 'Punkte'), scoreEl, multiEl),
          timer.el,
        ),
        stage,
        feedback,
      ),
    ),
  );
  ctx.onLeave(() => {
    alive = false;
    timer.pause();
  });

  let view;
  function renderQuestion() {
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose, fast: true });
    stage.replaceChildren(view.el);
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = formatPoints(s.score);
    const m = game.nextMultiplier();
    multiEl.textContent = `×${m}`;
    multiEl.className = `blitz__multi blitz__multi--${m}`;
    status.textContent = `${s.correctCount} von ${s.answered} richtig · Serie ${s.streak}`;
  }

  function choose(index) {
    if (busy || ended || s.phase !== 'question') return;
    busy = true;
    timer.pause();
    const result = game.answer(index);
    ctx.record(s.current.question.id, result.correct);
    view.reveal(index);
    updateHud();
    if (result.correct) {
      audio.play('right');
      feedback.className = 'feedback is-right';
      feedback.textContent = `+${formatPoints(result.points)}${result.multiplier > 1 ? ` (×${result.multiplier})` : ''}`;
      pulseClass(scoreEl, 'is-bump', 400);
      if (result.multiplier > 1 && s.streak % 3 === 1) pulseClass(multiEl, 'is-bump', 600);
    } else {
      audio.play('wrong');
      feedback.className = 'feedback is-wrong';
      feedback.textContent = `−${PENALTY_SECONDS} s · richtig: ${s.current.question.correct}`;
      pulseClass(stage, 'is-shaking', 500);
      timer.addSeconds(-PENALTY_SECONDS); // may end the round
    }
    setTimeout(() => {
      if (!alive || ended) return;
      feedback.textContent = '';
      feedback.className = 'feedback';
      game.next();
      renderQuestion();
      busy = false;
      timer.start();
    }, result.correct ? RIGHT_PAUSE_MS : WRONG_PAUSE_MS);
  }

  function end() {
    if (ended) return;
    ended = true;
    busy = true;
    timer.pause();
    game.finish();
    audio.play('timeUp');
    view?.setEnabled(false);
    feedback.className = 'feedback is-pending';
    feedback.textContent = 'Zeit ist um!';
    setTimeout(() => alive && renderBlitzResult(ctx, s, params), 1400);
  }

  async function abort() {
    if (ended) return;
    const wasRunning = timer.running;
    timer.pause();
    const yes = await confirmDialog({ title: 'Blitzrunde beenden?', text: 'Die Runde wird nicht gewertet.', confirmLabel: 'Beenden' });
    if (yes) ctx.go('start');
    else if (wasRunning && !ended) timer.start();
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return abort();
    const i = answerIndexFromKey(e.key);
    if (i >= 0) choose(i);
  });

  renderQuestion();
  view.setEnabled(false);
  countdown(ctx.app, { onStep: (n) => audio.play(n > 0 ? 'countdown' : 'go') }).then(() => {
    if (!alive) return;
    view.setEnabled(true);
    busy = false;
    timer.start();
  });
}

function renderBlitzResult(ctx, s, params) {
  const pct = s.answered ? Math.round((s.correctCount / s.answered) * 100) : 0;
  const detail = `${s.correctCount}/${s.answered} richtig · beste Serie ${s.bestStreak} · ${ctx.categoryLabel(params.categories)}`;
  const entry = highscoreEntry(ctx, 'blitz', s.score, detail);
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('blitz', params) }, 'Nochmal');

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: 'result' },
      h('div', { class: 'result__icon' }, icon('bolt', { size: 44 })),
      h('h1', { class: 'result__title' }, 'Blitzrunde vorbei!'),
      h('p', { class: 'result__points' }, h('strong', {}, formatPoints(s.score)), ' Punkte'),
      h('p', { class: 'result__sub' }, `${s.correctCount} von ${s.answered} richtig (${pct} %) · beste Serie: ${s.bestStreak}`),
      entry?.el,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'blitz' }) }, 'Einstellungen ändern'),
        again,
      ),
    ),
  );
  if (entry) {
    entry.focus();
    confetti();
  } else again.focus();
}
