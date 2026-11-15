// Game screen + result screen for the "Punkteleiter".
import { h, mount } from '../dom.js';
import { buildLadder } from '../../core/questionPool.js';
import { LADDER, LADDER_PLAN, createLadderGame, bankedPoints, securedPoints } from '../../core/modes/ladder.js';
import { JOKERS } from '../../core/jokers.js';
import { createHost } from '../../core/host.js';
import { questionView } from '../components/questionView.js';
import { createTimer } from '../components/timer.js';
import { confirmDialog } from '../components/dialog.js';
import { highscoreEntry } from '../components/highscoreEntry.js';
import { setKeyHandler, answerIndexFromKey, isContinueKey } from '../input.js';
import { audio } from '../audio.js';
import { confetti, pulseClass } from '../effects.js';
import { formatPoints } from '../modes.js';

const LOCK_DELAY_MS = 1300; // suspense between "logged in" and reveal (matches the drum roll)
const TICK_FROM_SECONDS = 5;
const JOKER_KEYS = { h: 'fifty', p: 'audience', t: 'time' };

/** params: { questions, timer } */
export function renderLadder(ctx, params) {
  const timerOn = params.timer !== false;
  const built = buildLadder(params.questions, LADDER_PLAN, { stats: ctx.stats });
  if (!built.ok) return ctx.go('setup', { mode: 'ladder' });
  const game = createLadderGame(built.questions, { timer: timerOn });
  const s = game.state;
  const host = createHost();

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
  const jokerButtons = Object.fromEntries(
    Object.entries(JOKERS).map(([type, j]) => [
      type,
      h(
        'button',
        { class: `joker joker--${type}`, title: `${j.title} (Taste ${Object.keys(JOKER_KEYS).find((k) => JOKER_KEYS[k] === type).toUpperCase()})`, onclick: () => useJoker(type) },
        h('span', { class: 'joker__icon', 'aria-hidden': 'true' }, j.icon),
        h('span', { class: 'joker__label' }, j.label),
      ),
    ]),
  );
  const status = h('div', { class: 'topbar__status' });
  const hostText = h('p', { class: 'host__text' });
  const timerSlot = h('div', { class: 'hud__timer' });
  const stage = h('div', { class: 'game__question' });
  const feedback = h('p', { class: 'feedback', role: 'status' });
  const explanation = h('p', { class: 'explanation' });
  const actions = h('div', { class: 'actions' });
  const ladderEl = h('aside', { class: 'ladder', 'aria-label': 'Punkteleiter' }, h('ol', {}, [...ladderItems].reverse()));

  mount(
    ctx.app,
    h(
      'div',
      { class: 'game game--ladder' },
      h(
        'div',
        { class: 'game__main' },
        h('div', { class: 'topbar' }, h('button', { class: 'link', onclick: () => abort() }, '✕ Beenden'), status),
        h('div', { class: 'host' }, h('span', { class: 'host__avatar', 'aria-hidden': 'true' }, '🎤'), hostText),
        h('div', { class: 'hud' }, h('div', { class: 'jokers', role: 'group', 'aria-label': 'Joker' }, Object.values(jokerButtons)), timerSlot),
        stage,
        feedback,
        explanation,
        actions,
      ),
      ladderEl,
    ),
  );

  let view;
  let timer = null;
  let busy = false;
  ctx.onLeave(() => timer?.pause());

  function say(situation, vars = {}) {
    hostText.textContent = host.say(situation, { total: LADDER.length, ...vars });
    pulseClass(hostText, 'is-new', 500);
  }

  function renderQuestion(first = false) {
    const lvl = LADDER[s.level];
    view = questionView(s.current, { categoryInfo: ctx.categoryInfo, onAnswer: choose });
    stage.replaceChildren(view.el);
    feedback.textContent = '';
    feedback.className = 'feedback';
    explanation.textContent = '';
    const walk = h('button', { class: 'btn btn--ghost', onclick: () => walkAway() }, `Aussteigen mit ${formatPoints(bankedPoints(s.level))} Punkten`);
    actions.replaceChildren(s.level > 0 ? walk : '');
    updateLadder();
    updateJokers();
    status.textContent = `Frage ${s.level + 1} von ${LADDER.length} · um ${formatPoints(lvl.points)} Punkte`;

    const vars = { n: s.level + 1, points: formatPoints(lvl.points) };
    if (first) say('start', vars);
    else if (s.level === LADDER.length - 1) say('questionFinal', vars);
    else if (lvl.safe) say('questionSafe', vars);
    else if (lvl.difficulty === 4 && LADDER[s.level - 1].difficulty < 4) say('questionExtreme', vars);
    else say('question', vars);

    const limit = game.timeLimit();
    timer = limit ? createTimer({ seconds: limit, onExpire: timeUp, onSecond: (sec) => sec <= TICK_FROM_SECONDS && sec > 0 && audio.play('tick') }) : null;
    timerSlot.replaceChildren(timer ? timer.el : '');
    timerSlot.classList.remove('is-idle');
    timer?.start();
    view.el.querySelector('.question__text')?.focus({ preventScroll: true });
  }

  function updateLadder() {
    ladderItems.forEach((li, i) => {
      li.classList.toggle('is-done', i < s.level || (i === s.level && s.phase !== 'question' && s.correct));
      li.classList.toggle('is-current', i === s.level);
      li.classList.toggle('is-failed', i === s.level && s.correct === false);
    });
  }

  function updateJokers() {
    for (const [type, btn] of Object.entries(jokerButtons)) {
      const available = s.jokers[type];
      btn.disabled = !available || busy || s.phase !== 'question';
      btn.classList.toggle('is-used', !available);
      if (type === 'time' && !s.timer) btn.hidden = true;
    }
  }

  function useJoker(type) {
    if (busy || s.phase !== 'question') return;
    const result = game.useJoker(type);
    if (result == null) return;
    audio.play('joker');
    if (type === 'fifty') {
      view.hide(result);
      if (s.audience) view.showAudience(s.audience);
    } else if (type === 'audience') {
      view.showAudience(result);
    } else if (type === 'time') {
      timer?.addSeconds(result);
    }
    say(type);
    updateJokers();
  }

  function choose(index) {
    if (busy || s.phase !== 'question' || s.hidden.includes(index)) return;
    busy = true;
    timer?.pause();
    view.lock(index);
    updateJokers();
    actions.replaceChildren();
    feedback.textContent = 'Eingeloggt …';
    feedback.className = 'feedback is-pending';
    audio.play('lock');
    say('lock');
    setTimeout(() => {
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
    const q = s.current.question;
    const lvl = LADDER[s.level];
    timerSlot.classList.add('is-idle');
    updateLadder();
    updateJokers();
    if (s.correct) {
      feedback.className = 'feedback is-right';
      if (s.outcome === 'won') {
        feedback.textContent = `Richtig! Alle ${LADDER.length} Fragen geschafft!`;
        say('won');
        audio.play('win');
        confetti({ count: 220, duration: 3500 });
      } else if (lvl.safe) {
        feedback.textContent = `Richtig! ${formatPoints(lvl.points)} Punkte – Sicherheitsstufe erreicht! 🛡`;
        say('safe', { points: formatPoints(lvl.points) });
        audio.play('safe');
        confetti({ count: 90, duration: 2000 });
      } else {
        feedback.textContent = `Richtig! ${formatPoints(lvl.points)} Punkte.`;
        say('correct');
        audio.play('right');
      }
      pulseClass(ladderEl, 'is-climbing', 600);
    } else {
      feedback.className = 'feedback is-wrong';
      const lead = s.timedOut ? 'Zeit abgelaufen!' : 'Leider falsch.';
      feedback.textContent = `${lead} Richtig ist: ${q.correct}. Du nimmst ${formatPoints(s.points)} Punkte mit.`;
      say(s.timedOut ? 'timeUp' : 'wrong');
      audio.play(s.timedOut ? 'timeUp' : 'wrong');
      pulseClass(stage, 'is-shaking', 500);
    }
    explanation.textContent = q.explanation ?? '';
    const next = h('button', { class: 'btn', onclick: () => advance() }, s.outcome ? 'Zum Ergebnis' : 'Nächste Frage');
    actions.replaceChildren(next);
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (busy) return;
    game.next();
    if (s.phase === 'finished') renderLadderResult(ctx, s, params);
    else renderQuestion();
  }

  async function walkAway() {
    if (busy || s.phase !== 'question') return;
    timer?.pause();
    const yes = await confirmDialog({
      title: 'Aussteigen?',
      text: `Du nimmst ${formatPoints(bankedPoints(s.level))} Punkte mit. Bei einer falschen Antwort wären es ${formatPoints(securedPoints(s.level))}.`,
      confirmLabel: 'Aussteigen',
      cancelLabel: 'Weiterspielen',
    });
    if (!yes || s.phase !== 'question') return timer?.start();
    game.walkAway();
    view.reveal(null);
    timerSlot.classList.add('is-idle');
    updateJokers();
    say('walk', { points: formatPoints(s.points) });
    feedback.className = 'feedback';
    feedback.textContent = `Ausgestiegen. Die richtige Antwort wäre gewesen: ${s.current.question.correct}`;
    const next = h('button', { class: 'btn', onclick: () => renderLadderResult(ctx, s, params) }, 'Zum Ergebnis');
    actions.replaceChildren(next);
    next.focus();
  }

  async function abort() {
    if (s.phase === 'finished') return renderLadderResult(ctx, s, params);
    const wasRunning = timer?.running;
    timer?.pause();
    const yes = await confirmDialog({ title: 'Spiel beenden?', text: 'Der aktuelle Spielstand geht verloren.', confirmLabel: 'Beenden' });
    if (yes) ctx.go('start');
    else if (wasRunning) timer.start();
  }

  setKeyHandler((e) => {
    if (e.key === 'Escape') return abort();
    if (busy) return;
    if (s.phase === 'question') {
      const i = answerIndexFromKey(e.key);
      if (i >= 0) return choose(i);
      const joker = JOKER_KEYS[e.key.toLowerCase()];
      if (joker) useJoker(joker);
    } else if (isContinueKey(e)) {
      e.preventDefault();
      actions.querySelector('button')?.click();
    }
  });

  if (built.substitutions) {
    ctx.toast(`Hinweis: ${built.substitutions} Stufe(n) mit Fragen aus einer benachbarten Schwierigkeit.`);
  }
  audio.play('start');
  renderQuestion(true);
}

function renderLadderResult(ctx, s, params) {
  const reached = s.outcome === 'won' ? LADDER.length : s.level;
  const titles = {
    won: ['🏆', 'Hauptgewinn!', `Alle ${LADDER.length} Fragen richtig beantwortet.`],
    walked: ['🧠', 'Clever ausgestiegen!', `${reached} von ${LADDER.length} Fragen geschafft.`],
    lost: ['💥', s.timedOut ? 'Die Zeit ist um!' : 'Das war’s!', `${reached} von ${LADDER.length} Fragen geschafft.`],
  };
  const [icon, title, sub] = titles[s.outcome];
  const again = h('button', { class: 'btn btn--big', onclick: () => ctx.go('ladder', params) }, 'Nochmal spielen');
  const used = Object.entries(s.jokers).filter(([type, available]) => !available && (type !== 'time' || s.timer));
  const detail = [
    `Frage ${reached}/${LADDER.length}`,
    ctx.categoryLabel(params.categories),
    s.timer ? null : 'ohne Timer',
    used.length ? null : 'ohne Joker',
  ].filter(Boolean).join(' · ');
  const entry = highscoreEntry(ctx, 'ladder', s.points, detail);

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
      h('p', { class: 'result__points' }, h('strong', { class: 'countup' }, '0'), ' Punkte'),
      h('p', { class: 'result__sub' }, sub, used.length ? ` Joker eingesetzt: ${used.map(([t]) => JOKERS[t].label).join(', ')}.` : ' Ganz ohne Joker!'),
      entry?.el,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('start') }, 'Hauptmenü'),
        h('button', { class: 'btn btn--ghost', onclick: () => ctx.go('setup', { mode: 'ladder' }) }, 'Einstellungen ändern'),
        again,
      ),
    ),
  );
  countUp(ctx.app.querySelector('.countup'), s.points);
  if (s.outcome === 'won') confetti({ count: 260, duration: 4000 });
  if (entry) entry.focus();
  else again.focus();
}

function countUp(el, target, ms = 1200) {
  if (!target || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = formatPoints(target);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = formatPoints(Math.round(target * (1 - (1 - p) ** 3)));
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
