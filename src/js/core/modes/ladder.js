// "Punkteleiter": 15 questions of rising difficulty, two safety levels.
import { prepareQuestion } from '../question.js';

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
 *   'question' → answer(i) → 'reveal' → next() → 'question' | 'finished'
 *   'question' → walkAway() → 'finished'
 * outcome: 'won' | 'lost' | 'walked'
 */
export function createLadderGame(questions, { rng = Math.random } = {}) {
  if (questions.length !== LADDER.length) {
    throw new Error(`Punkteleiter braucht ${LADDER.length} Fragen, erhalten: ${questions.length}`);
  }
  const state = {
    level: 0,
    phase: 'question',
    current: prepareQuestion(questions[0], rng),
    chosen: null,
    correct: null,
    outcome: null,
    points: 0,
  };

  return {
    state,
    answer(index) {
      if (state.phase !== 'question') return state;
      state.chosen = index;
      state.correct = index === state.current.correctIndex;
      state.phase = 'reveal';
      if (!state.correct) {
        state.outcome = 'lost';
        state.points = securedPoints(state.level);
      } else {
        state.points = LADDER[state.level].points;
        if (state.level === LADDER.length - 1) state.outcome = 'won';
      }
      return state;
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
