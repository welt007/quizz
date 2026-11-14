// Game screen + result screen for the "Punkteleiter".
import { h, mount } from '../dom.js';
import { buildLadder } from '../../core/questionPool.js';
import { LADDER, LADDER_PLAN, createLadderGame, bankedPoints, securedPoints } from '../../core/modes/ladder.js';
import { questionView } from '../components/questionView.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { formatPoints } from '../modes.js';

const LOCK_DELAY_MS = 1200; // suspense between "logged in" and reveal

export function renderLadder(ctx, params) {
  const built = buildLadder(params.questions, LADDER_PLAN, { stats: ctx.stats });
  if (!built.ok) return ctx.go('setup', { mode: 'ladder' });
  const game = createLadderGame(built.questions);
  const s = game.state;

  // --- static layout ---
  const ladderItems = LADDER.map((lvl, i) =>
    h(
      'li',
      { class: `ladder__step${lvl.safe ? ' is-safe' : ''}` },
      h('span', { class: 'ladder__no' }, String(i + 1)),
      h('span', { class: 'ladder__points' }, formatPoints(lvl.points)),
      lvl.safe ? h('span', { class: 'ladder__safe', title: 'Sicherheitsstufe' }, '🛡') : null,
    ),
  );
  const status = h('div', { class: 'topbar__status' });
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--ladder' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link', onclick: () => abort() }, '✕ Beenden'), status),
        stage,
        feedback,
        explanation,
        actions,
      ),
      h('aside', { class: 'ladder', 'aria-label': 'Punkteleiter' }, h('ol', { reversed: true }, [...ladderItems].reverse())),
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
    const walk = h('button', { class: 'btn btn--ghost', onclick: () => walkAway() }, `Aussteigen mit ${formatPoints(bankedPoints(s.level))} Punkten`);
    actions.replaceChildren(s.level > 0 ? walk : '');
    updateLadder();
    const lvl = LADDER[s.level];
    status.textContent = `Frage ${s.level + 1} von ${LADDER.length} · um ${formatPoints(lvl.points)} Punkte`;
    view.el.querySelector('.question__text')?.focus({ preventScroll: true });
  }

  function updateLadder() {
    ladderItems.forEach((li, i) => {
      li.classList.toggle('is-done', i < s.level || (i === s.level && s.phase !== 'question' && s.correct));
      li.classList.toggle('is-current', i === s.level);
      li.classList.toggle('is-failed', i === s.level && s.correct === false);
    });
  }

  function choose(index) {
    if (busy || s.phase !== 'question') return;
    busy = true;
    view.lock(index);
    actions.replaceChildren();
    feedback.textContent = 'Eingeloggt …';
    feedback.className = 'feedback is-pending';
    setTimeout(() => {
      game.answer(index);
      ctx.record(s.current.question.id, s.correct);
      view.reveal(index);
      updateLadder();
      showOutcome();
      busy = false;
    }, LOCK_DELAY_MS);
  }

  function showOutcome() {
    const q = s.current.question;
    const lvl = LADDER[s.level];
    if (s.correct) {
      feedback.className = 'feedback is-right';
      feedback.textContent =
        s.outcome === 'won'
          ? `Richtig! Alle ${LADDER.length} Fragen geschafft!`
          : `Richtig! ${formatPoints(lvl.points)} Punkte${lvl.safe ? ' – Sicherheitsstufe erreicht! 🛡' : '.'}`;
    } else {
      feedback.className = 'feedback is-wrong';
      feedback.textContent = `Leider falsch. Richtig ist: ${q.correct}. Du nimmst ${formatPoints(s.points)} Punkte mit.`;
    }
    explanation.textContent = q.explanation ?? '';
    const next = h('button', { class: 'btn', onclick: () => advance() }, s.outcome ? 'Zum Ergebnis' : 'Nächste Frage');
    actions.replaceChildren(next);
    next.focus();
  }

  function advance() {
    if (busy) return;
    game.next();
    if (s.phase === 'finished') renderLadderResult(ctx, s, params);
    else renderQuestion();
  }

  async function walkAway() {
    if (busy || s.phase !== 'question') return;
    const yes = await confirmDialog({
      title: 'Aussteigen?',
      text: `Du nimmst ${formatPoints(bankedPoints(s.level))} Punkte mit. Bei einer falschen Antwort wären es ${formatPoints(securedPoints(s.level))}.`,
      confirmLabel: 'Aussteigen',
      cancelLabel: 'Weiterspielen',
    });
    if (!yes || s.phase !== 'question') return;
    game.walkAway();
    view.reveal(null);
    feedback.className = 'feedback';
    feedback.textContent = `Ausgestiegen. Die richtige Antwort wäre gewesen: ${s.current.question.correct}`;
    const next = h('button', { class: 'btn', onclick: () => renderLadderResult(ctx, s, params) }, 'Zum Ergebnis');
    actions.replaceChildren(next);
    next.focus();
  }

  async function abort() {
    if (s.phase === 'finished') return renderLadderResult(ctx, s, params);
    const yes = await confirmDialog({ title: 'Spiel beenden?', text: 'Der aktuelle Spielstand geht verloren.', confirmLabel: 'Beenden' });
    if (yes) ctx.go('start');
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

  if (built.substitutions) {
    ctx.toast?.(`Hinweis: ${built.substitutions} Stufe(n) mit Fragen aus einer benachbarten Schwierigkeit.`);
  }
  renderQuestion();
}

function renderLadderResult(ctx, s, params) {
  const reached = s.outcome === 'lost' ? s.level : s.outcome === 'walked' ? s.level : LADDER.length;
  const titles = {
    won: ['🏆', 'Hauptgewinn!', `Alle ${LADDER.length} Fragen richtig beantwortet.`],
    walked: ['🧠', 'Clever ausgestiegen!', `${reached} von ${LADDER.length} Fragen geschafft.`],
    lost: ['💥', 'Das war’s!', `${reached} von ${LADDER.length} Fragen geschafft.`],
  };
  const [icon, title, sub] = titles[s.outcome];
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('ladder', params) }, 'Nochmal spielen');

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: `result result--${s.outcome}` },
      h('div', { class: 'result__icon', 'aria-hidden': 'true' }, icon),
      h('h1', { class: 'result__title' }, title),
      h('p', { class: 'result__points' }, h('strong', {}, formatPoints(s.points)), ' Punkte'),
      h('p', { class: 'result__sub' }, sub),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'ladder' }) }, 'Kategorien ändern'),
        again,
      ),
    ),
  );
  again.focus();
}
