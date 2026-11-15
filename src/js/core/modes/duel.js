// "Duell / Party": 2–4 players on one device, buzzer or taking turns.
import { prepareQuestion } from '../question.js';

export const DUEL_POINTS = { 1: 100, 2: 200, 3: 300, 4: 400 };
export const BUZZ_OPEN_SECONDS = 20; // time to buzz in
export const ANSWER_SECONDS = 10; // time to answer after buzzing
export const TURN_SECONDS = 30; // time per question when taking turns
export const BUZZER_KEYS = ['Q', 'P', 'X', 'N'];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** Penalty for a wrong buzzer answer: half the question's points. */
export const penaltyFor = (difficulty) => Math.round(DUEL_POINTS[difficulty] / 2);

/**
 * Phases per question:
 *   buzzer: 'open' → buzz(p) → 'answering' → answer(i) → 'open' (wrong, others may buzz) | 'reveal'
 *   turns:  'answering' (player = question number mod players) → answer(i) → 'reveal'
 *   'open' → nobodyBuzzed() → 'reveal';  'answering' → answerTimeUp() acts like a wrong answer
 *   'reveal' → next() → next question | 'finished'
 *
 * @param {object[]} questions  one per round
 * @param {{players: string[], variant: 'buzzer'|'turns', rng?: Function}} opts
 */
export function createDuelGame(questions, { players, variant = 'buzzer', rng = Math.random }) {
  if (questions.length === 0) throw new Error('Duell braucht mindestens eine Frage');
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Duell braucht ${MIN_PLAYERS}–${MAX_PLAYERS} Spieler`);
  }

  const state = {
    variant,
    round: 0,
    rounds: questions.length,
    players: players.map((name) => ({ name, score: 0, correct: 0, wrong: 0 })),
    current: null,
    phase: null,
    active: null, // index of the player who is answering
    lockedOut: [], // players who already answered this question wrong
    winner: null, // player who answered this question correctly
    last: null, // { player, correct, delta } of the latest answer
  };

  function startRound() {
    state.current = prepareQuestion(questions[state.round], rng);
    state.lockedOut = [];
    state.winner = null;
    state.last = null;
    if (variant === 'turns') {
      state.active = state.round % state.players.length;
      state.phase = 'answering';
    } else {
      state.active = null;
      state.phase = 'open';
    }
  }

  function wrong(p) {
    const player = state.players[p];
    player.wrong++;
    const delta = variant === 'buzzer' ? -penaltyFor(state.current.question.difficulty) : 0;
    player.score += delta;
    state.last = { player: p, correct: false, delta };
    state.lockedOut.push(p);
    state.active = null;
    const everyoneOut = state.lockedOut.length >= state.players.length;
    state.phase = variant === 'buzzer' && !everyoneOut ? 'open' : 'reveal';
  }

  startRound();
  return {
    state,
    /** Players that may still buzz for the current question. */
    canBuzz: (p) => state.phase === 'open' && p >= 0 && p < state.players.length && !state.lockedOut.includes(p),
    buzz(p) {
      if (!this.canBuzz(p)) return false;
      state.active = p;
      state.phase = 'answering';
      return true;
    },
    answer(index) {
      if (state.phase !== 'answering') return state;
      const p = state.active;
      if (index === state.current.correctIndex) {
        const delta = DUEL_POINTS[state.current.question.difficulty];
        const player = state.players[p];
        player.score += delta;
        player.correct++;
        state.winner = p;
        state.last = { player: p, correct: true, delta };
        state.phase = 'reveal';
      } else {
        wrong(p);
      }
      return state;
    },
    answerTimeUp() {
      if (state.phase === 'answering') wrong(state.active);
      return state;
    },
    nobodyBuzzed() {
      if (state.phase === 'open') state.phase = 'reveal';
      return state;
    },
    next() {
      if (state.phase !== 'reveal') return state;
      state.round++;
      if (state.round >= state.rounds) {
        state.phase = 'finished';
        return state;
      }
      startRound();
      return state;
    },
    /** Players sorted by score (desc), with shared ranks for ties. */
    ranking() {
      const sorted = state.players.map((p, index) => ({ ...p, index })).sort((a, b) => b.score - a.score || b.correct - a.correct);
      let rank = 0;
      return sorted.map((p, i) => {
        if (i === 0 || p.score !== sorted[i - 1].score || p.correct !== sorted[i - 1].correct) rank = i + 1;
        return { ...p, rank };
      });
    },
  };
}
