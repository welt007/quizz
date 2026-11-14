// "Punkteleiter": 15 questions of rising difficulty, two safety levels, jokers.
import { prepareQuestion } from '../question.js';
import { fiftyFifty, audienceVote, EXTRA_SECONDS } from '../jokers.js';

/** Level definitions (index 0 = question 1). Own point values, not taken from any TV show. */
export const LADDER = [
  { difficulty: 1, points: 50 },
  { difficulty: 1, points: 100 },
  { difficulty: 1, points: 200 },
  { difficulty: 1, points: 300 },
  { difficulty: 2, points: 500, safe: true },
  { difficulty: 2, points: 750 },
  { difficulty: 2, points: 1000 },
  { difficulty: 2, points: 1500 },
  { difficulty: 3, points: 2500 },
  { difficulty: 3, points: 4000, safe: true },
  { difficulty: 3, points: 6000 },
  { difficulty: 3, points: 10000 },
  { difficulty: 4, points: 15000 },
  { difficulty: 4, points: 25000 },
  { difficulty: 4, points: 50000 },
];
export const LADDER_PLAN = LADDER.map((l) => l.difficulty);

/** Seconds per question, by the question's difficulty. */
export const TIME_LIMITS = { 1: 30, 2: 30, 3: 45, 4: 45 };

/** Points kept when answering question `level` (0-based) wrong: the highest safety level below it. */
export function securedPoints(level) {
  for (let i = level - 1; i >= 0; i--) if (LADDER[i].safe) return LADDER[i].points;
  return 0;
}

/** Points kept when walking away before answering question `level`. */
export function bankedPoints(level) {
  return level > 0 ? LADDER[level - 1].points : 0;
}

/**
 * Creates a ladder game. Phases:
 *   'question' → answer(i) | timeUp() → 'reveal' → next() → 'question' | 'finished'
 *   'question' → walkAway() → 'finished'
 * outcome: 'won' | 'lost' | 'walked'
 *
 * @param {object[]} questions  exactly 15
 * @param {{rng?: Function, timer?: boolean}} [opts]  timer: false disables time limits and the time joker
 */
export function createLadderGame(questions, { rng = Math.random, timer = true } = {}) {
  if (questions.length !== LADDER.length) {
    throw new Error(`Punkteleiter braucht ${LADDER.length} Fragen, erhalten: ${questions.length}`);
  }
  const state = {
    level: 0,
    phase: 'question',
    current: prepareQuestion(questions[0], rng),
    chosen: null,
    correct: null,
    timedOut: false,
    outcome: null,
    points: 0,
    timer,
    jokers: { fifty: true, audience: true, time: timer }, // true = still available
    hidden: [], // answer indices removed by 50:50 (current question)
    audience: null, // vote percentages (current question)
  };

  function lose() {
    state.correct = false;
    state.phase = 'reveal';
    state.outcome = 'lost';
    state.points = securedPoints(state.level);
  }

  return {
    state,
    /** Time limit for the current question in seconds, or null without timer. */
    timeLimit() {
      return timer ? TIME_LIMITS[state.current.question.difficulty] : null;
    },
    answer(index) {
      if (state.phase !== 'question' || state.hidden.includes(index)) return state;
      state.chosen = index;
      if (index !== state.current.correctIndex) {
        lose();
        return state;
      }
      state.correct = true;
      state.phase = 'reveal';
      state.points = LADDER[state.level].points;
      if (state.level === LADDER.length - 1) state.outcome = 'won';
      return state;
    },
    timeUp() {
      if (state.phase !== 'question') return state;
      state.timedOut = true;
      lose();
      return state;
    },
    /** Uses a joker. Returns its result (hidden indices / percentages / extra seconds) or null if unavailable. */
    useJoker(type) {
      if (state.phase !== 'question' || !state.jokers[type]) return null;
      state.jokers[type] = false;
      const { correctIndex, question } = state.current;
      if (type === 'fifty') {
        state.hidden = fiftyFifty(correctIndex, 4, rng);
        if (state.audience) state.audience = audienceVote(correctIndex, question.difficulty, { hidden: state.hidden, rng });
        return state.hidden;
      }
      if (type === 'audience') {
        state.audience = audienceVote(correctIndex, question.difficulty, { hidden: state.hidden, rng });
        return state.audience;
      }
      return EXTRA_SECONDS; // 'time' – the UI owns the clock
    },
    next() {
      if (state.phase !== 'reveal') return state;
      if (state.outcome) {
        state.phase = 'finished';
        return state;
      }
      state.level++;
      state.current = prepareQuestion(questions[state.level], rng);
      state.chosen = null;
      state.correct = null;
      state.hidden = [];
      state.audience = null;
      state.phase = 'question';
      return state;
    },
    walkAway() {
      if (state.phase !== 'question') return state;
      state.outcome = 'walked';
      state.points = bankedPoints(state.level);
      state.phase = 'finished';
      return state;
    },
  };
}
