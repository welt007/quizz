// Game screen + result screen for "Duell / Party".
import { h, mount } from '../dom.js';
import { orderByFreshness } from '../../core/questionPool.js';
import {
  createDuelGame, BUZZ_OPEN_SECONDS, ANSWER_SECONDS, TURN_SECONDS, BUZZER_KEYS,
} from '../../core/modes/duel.js';
import { questionView } from '../components/questionView.js';
import { createTimer } from '../components/timer.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, countdown, pulseClass } from '../effects.js';
import { formatPoints } from '../modes.js';
import { nextButton } from '../components/nextButton.js';
import { gameFooter } from '../components/gameFooter.js';
import { icon } from '../icons.js';

const LOCK_DELAY_MS = 700;

/** params: { questions, players, variant, rounds } */
export function renderDuel(ctx, params) {
  const selection = orderByFreshness(params.questions, ctx.stats).slice(0, params.rounds);
  const game = createDuelGame(selection, { players: params.players, variant: params.variant });
  const s = game.state;
  const buzzer = s.variant === 'buzzer';
  let alive = true;
  let busy = true; // until the countdown is over
  let openTimer = null;
  let answerTimer = null;

  const status = h('div', { class: 'topbar__status' });
  const prompt = h('p', { class: 'duel__prompt', role: 'status' });
  const timerSlot = h('div', { class: 'hud__timer' });
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });
  const cards = s.players.map((p, i) =>
    h(
      'button',
      { class: `player player--${i}`, onclick: () => buzz(i) },
      buzzer ? h('span', { class: 'player__key' }, BUZZER_KEYS[i]) : null,
      h('span', { class: 'player__name' }, p.name),
      h('span', { class: 'player__score' }, '0'),
    ),
  );

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--duel' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link topbar__exit', onclick: () => abort() }, icon('x', { size: 16 }), 'Beenden'), status),
        h('div', { class: 'hud' }, prompt, timerSlot),
        stage,
        explanation,
        gameFooter(
          feedback,
          actions,
          h('div', { class: 'players-bar', role: 'group', 'aria-label': buzzer ? 'Buzzer' : 'Spieler' }, cards),
        ),
      ),
    ),
  );
  ctx.onLeave(() => {
    alive = false;
    openTimer?.pause();
    answerTimer?.pause();
  });

  let view;
  const tick = (sec) => sec <= 3 && sec > 0 && audio.play('tick');

  function showTimer(t) {
    timerSlot.replaceChildren(t ? t.el : '');
    timerSlot.classList.toggle('is-idle', !t);
  }

  function renderRound() {
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose });
    stage.replaceChildren(view.el);
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    actions.replaceChildren();
    status.textContent = `Runde ${s.round + 1} von ${s.rounds}`;
    answerTimer?.pause();
    answerTimer = null;
    if (buzzer) {
      view.setEnabled(false);
      openTimer = createTimer({ seconds: BUZZ_OPEN_SECONDS, onExpire: nobody, onSecond: tick });
      showTimer(openTimer);
      prompt.textContent = `Wer weiß es? Buzzern mit ${BUZZER_KEYS.slice(0, s.players.length).join(' / ')} – oder auf den eigenen Namen tippen.`;
      if (!busy) openTimer.start();
    } else {
      startAnswerTimer(TURN_SECONDS);
      prompt.textContent = `${s.players[s.active].name} ist dran!`;
    }
    updatePlayers();
  }

  function startAnswerTimer(seconds) {
    answerTimer = createTimer({ seconds, onExpire: answerTimeUp, onSecond: tick });
    showTimer(answerTimer);
    if (!busy) answerTimer.start();
  }

  function updatePlayers() {
    cards.forEach((card, i) => {
      card.querySelector('.player__score').textContent = formatPoints(s.players[i].score);
      card.classList.toggle('is-active', s.active === i && s.phase === 'answering');
      card.classList.toggle('is-locked', s.lockedOut.includes(i));
      card.classList.toggle('is-winner', s.winner === i);
      card.disabled = !game.canBuzz(i);
    });
  }

  function buzz(p) {
    if (busy || !game.buzz(p)) return;
    audio.play('buzz');
    openTimer?.pause();
    pulseClass(cards[p], 'is-buzzed', 600);
    prompt.textContent = `${s.players[p].name} antwortet …`;
    view.setEnabled(true);
    startAnswerTimer(ANSWER_SECONDS);
    updatePlayers();
  }

  function choose(index) {
    if (busy || s.phase !== 'answering' || view.el.querySelectorAll('.answer')[index]?.disabled) return;
    busy = true;
    answerTimer?.pause();
    view.lock(index);
    audio.play('click');
    setTimeout(() => {
      if (!alive) return;
      busy = false;
      game.answer(index);
      if (s.last.correct) reveal();
      else afterWrong(index);
    }, LOCK_DELAY_MS);
  }

  function answerTimeUp() {
    if (busy || s.phase !== 'answering') return;
    game.answerTimeUp();
    afterWrong(null);
  }

  function nobody() {
    if (busy || s.phase !== 'open') return;
    game.nobodyBuzzed();
    reveal();
  }

  function afterWrong(index) {
    const { player, delta } = s.last;
    audio.play('wrong');
    pulseClass(stage, 'is-shaking', 500);
    feedback.className = 'feedback is-wrong';
    feedback.textContent = `${s.players[player].name}: ${index == null ? 'Zeit abgelaufen' : 'falsch'}${delta ? ` (${formatPoints(delta)})` : ''}`;
    if (index != null && s.phase === 'open') view.hide([index]); // others must not pick it again
    updatePlayers();
    if (s.phase === 'open') {
      view.setEnabled(false);
      showTimer(openTimer);
      openTimer.start();
      prompt.textContent = 'Noch jemand? Jetzt dürfen die anderen buzzern!';
    } else {
      reveal(index);
    }
  }

  /** @param {number|null} chosenWrong  the last wrong answer, shown in red */
  function reveal(chosenWrong = null) {
    openTimer?.pause();
    answerTimer?.pause();
    timerSlot.classList.add('is-idle');
    const q = s.current.question;
    view.reveal(s.winner != null ? s.current.correctIndex : chosenWrong);
    if (s.winner != null) {
      audio.play('right');
      feedback.className = 'feedback is-right';
      feedback.textContent = `${s.players[s.winner].name} holt +${formatPoints(s.last.delta)}!`;
      prompt.textContent = 'Richtig!';
    } else {
      if (s.last?.correct !== false) audio.play('timeUp');
      if (!feedback.textContent) feedback.className = 'feedback is-wrong';
      feedback.textContent = `${feedback.textContent ? `${feedback.textContent} · ` : ''}Richtig ist: ${q.correct}`;
      prompt.textContent = buzzer ? 'Niemand hatte die richtige Antwort.' : 'Leider nicht.';
    }
    explanation.textContent = q.explanation ?? '';
    updatePlayers();
    const last = s.round + 1 >= s.rounds;
    const next = nextButton(ctx, last ? 'Zur Siegerehrung' : 'Nächste Frage', () => advance());
    actions.replaceChildren(next);
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (busy || s.phase !== 'reveal') return;
    game.next();
    if (s.phase === 'finished') renderDuelResult(ctx, game, params);
    else renderRound();
  }

  async function abort() {
    if (s.phase === 'finished') return;
    const running = [openTimer, answerTimer].filter((t) => t?.running);
    running.forEach((t) => t.pause());
    const yes = await confirmDialog({ title: 'Spiel beenden?', text: 'Der Spielstand geht verloren.', confirmLabel: 'Beenden' });
    if (yes) ctx.go('start');
    else running.forEach((t) => t.start());
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return abort();
    if (busy) return;
    const key = e.key.toUpperCase();
    if (s.phase === 'open') {
      const p = BUZZER_KEYS.indexOf(key);
      if (p >= 0 && p < s.players.length) buzz(p);
    } else if (s.phase === 'answering') {
      const i = answerIndexFromKey(e.key);
      if (i >= 0) choose(i);
    } else if (s.phase === 'reveal' && isContinueKey(e)) {
      e.preventDefault();
      actions.querySelector('button')?.click();
    }
  });

  renderRound();
  view.setEnabled(false);
  countdown(ctx.app, { onStep: (n) => audio.play(n > 0 ? 'countdown' : 'go') }).then(() => {
    if (!alive) return;
    busy = false;
    if (buzzer) openTimer.start();
    else {
      view.setEnabled(true);
      answerTimer.start();
    }
  });
}

function renderDuelResult(ctx, game, params) {
  const ranking = game.ranking();
  const winners = ranking.filter((p) => p.rank === 1);
  const title = winners.length > 1 ? 'Unentschieden!' : `${winners[0].name} gewinnt!`;
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('duel', params) }, 'Revanche!');

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });
  mount(
    ctx.app,
    h(
      'section',
      { class: 'result result--won' },
      h('div', { class: 'result__icon' }, icon(winners.length > 1 ? 'users' : 'trophy', { size: 44 })),
      h('h1', { class: 'result__title' }, title),
      h(
        'ol',
        { class: 'podium' },
        ranking.map((p) =>
          h(
            'li',
            { class: `podium__row podium__row--${p.rank}` },
            h('span', { class: `podium__medal podium__medal--${p.rank}`, 'aria-label': `Platz ${p.rank}` }, String(p.rank)),
            h('span', { class: 'podium__name' }, p.name),
            h('span', { class: 'podium__stats' }, `${p.correct} richtig · ${p.wrong} falsch`),
            h('strong', { class: 'podium__score' }, formatPoints(p.score)),
          ),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'duel' }) }, 'Einstellungen ändern'),
        again,
      ),
    ),
  );
  audio.play('win');
  confetti({ count: 200, duration: 3200 });
  again.focus();
}
