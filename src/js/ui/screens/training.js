// Game screen + result screen for "Training".
import { h, mount } from '../dom.js';
import { orderByFreshness } from '../../core/questionPool.js';
import { createTrainingGame } from '../../core/modes/training.js';
import { shuffle } from '../../core/random.js';
import { questionView } from '../components/questionView.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, pulseClass } from '../effects.js';

const LOCK_DELAY_MS = 350;

/** params: { questions, count } – or { replay: questions } to repeat a fixed set. */
export function renderTraining(ctx, params) {
  const selection = params.replay
    ? shuffle(params.replay)
    : orderByFreshness(params.questions, ctx.stats).slice(0, params.count || undefined);
  if (selection.length === 0) return ctx.go('setup', { mode: 'training' });
  const game = createTrainingGame(selection);
  const s = game.state;

  const status = h('div', { class: 'topbar__status' });
  const progress = h('div', { class: 'progress', 'aria-hidden': 'true' }, h('div', { class: 'progress__bar' }));
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--training' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link', onclick: () => end() }, '✕ Beenden'), status),
        progress,
        stage,
        feedback,
        explanation,
        actions,
      ),
    ),
  );

  let view;
  let busy = false;

  function renderQuestion() {
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose });
    stage.replaceChildren(view.el);
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    actions.replaceChildren();
    updateStatus();
    view.el.querySelector('.question__text')?.focus({ preventScroll: true });
  }

  function updateStatus() {
    status.textContent = `Frage ${s.index + 1} von ${s.total} · ${s.correctCount} richtig`;
    progress.firstChild.style.width = `${(s.answered / s.total) * 100}%`;
  }

  function choose(index) {
    if (busy || s.phase !== 'question') return;
    busy = true;
    view.lock(index);
    audio.play('click');
    setTimeout(() => {
      game.answer(index);
      ctx.record(s.current.question.id, s.correct);
      view.reveal(index);
      updateStatus();
      feedback.className = `feedback ${s.correct ? 'is-right' : 'is-wrong'}`;
      feedback.textContent = s.correct ? 'Richtig!' : `Falsch – richtig ist: ${s.current.question.correct}`;
      audio.play(s.correct ? 'right' : 'wrong');
      if (!s.correct) pulseClass(stage, 'is-shaking', 500);
      explanation.textContent = s.current.question.explanation ?? '';
      const last = s.index + 1 >= s.total;
      const next = h('button', { class: 'btn', onclick: () => advance() }, last ? 'Zum Ergebnis' : 'Nächste Frage');
      actions.replaceChildren(next);
      next.focus();
      busy = false;
    }, LOCK_DELAY_MS);
  }

  function advance() {
    if (busy) return;
    game.next();
    if (s.phase === 'finished') renderTrainingResult(ctx, s, params);
    else renderQuestion();
  }

  async function end() {
    if (s.answered === 0) return ctx.go('setup', { mode: 'training' });
    const yes = await confirmDialog({
      title: 'Training beenden?',
      text: `${s.answered} von ${s.total} Fragen beantwortet.`,
      confirmLabel: 'Zum Ergebnis',
      cancelLabel: 'Weiter üben',
    });
    if (!yes) return;
    game.finish();
    renderTrainingResult(ctx, s, params);
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return end();
    if (busy) return;
    if (s.phase === 'question') {
      const i = answerIndexFromKey(e.key);
      if (i >= 0) choose(i);
    } else if (isContinueKey(e)) {
      e.preventDefault();
      actions.querySelector('button')?.click();
    }
  });

  renderQuestion();
}

function renderTrainingResult(ctx, s, params) {
  const pct = s.answered ? Math.round((s.correctCount / s.answered) * 100) : 0;
  const icon = pct === 100 ? '🌟' : pct >= 70 ? '👏' : pct >= 40 ? '💪' : '📚';
  const buttons = [
    h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
    h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'training' }) }, 'Auswahl ändern'),
  ];
  const primary = s.wrong.length
    ? h('button', { class: 'btn btn--big', onclick: () => ctx.go('training', { replay: s.wrong }) }, `${s.wrong.length} falsche wiederholen`)
    : h('button', { class: 'btn btn--big', onclick: () => ctx.go('training', params.replay ? { questions: params.replay, count: 0 } : params) }, 'Neue Runde');
  buttons.push(primary);

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: 'result' },
      h('div', { class: 'result__icon', 'aria-hidden': 'true' }, icon),
      h('h1', { class: 'result__title' }, 'Training beendet'),
      h('p', { class: 'result__points' }, h('strong', {}, `${s.correctCount} / ${s.answered}`), ' richtig'),
      h('p', { class: 'result__sub' }, s.answered ? `${pct} % Trefferquote` : 'Keine Frage beantwortet.'),
      s.wrong.length
        ? h(
            'div',
            { class: 'panel review' },
            h('h2', {}, 'Zum Nachlesen'),
            h(
              'ul',
              { class: 'review__list' },
              s.wrong.map((q) =>
                h(
                  'li',
                  {},
                  h('div', { class: 'review__q' }, q.question),
                  h('div', { class: 'review__a' }, '✓ ', q.correct),
                  q.explanation ? h('div', { class: 'review__x' }, q.explanation) : null,
                ),
              ),
            ),
          )
        : null,
      h('div', { class: 'actions' }, buttons),
    ),
  );
  primary.focus();
  if (s.answered >= 5 && pct === 100) {
    audio.play('win');
    confetti();
  }
}
