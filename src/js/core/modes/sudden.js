// "Sudden Death": questions until the first mistake, difficulty rises every 5 questions.
import { prepareQuestion } from '../question.js';
import { orderByFreshness, difficultyPreference, ALL_DIFFICULTIES } from '../questionPool.js';
import { TIME_LIMITS } from './ladder.js';

export const QUESTIONS_PER_STEP = 5;

/** Difficulty for the question with 0-based number `n`: 1 for 0–4, 2 for 5–9, 3 for 10–14, then 4. */
export function suddenDifficulty(n) {
  return Math.min(Math.max(...ALL_DIFFICULTIES), 1 + Math.floor(n / QUESTIONS_PER_STEP));
}

/**
 * Phases: 'question' → answer(i) | timeUp() → 'reveal' → next() → 'question' | 'finished'.
 * outcome: 'lost' (wrong/time) | 'cleared' (no questions left).
 */
export function createSuddenDeathGame(questions, { stats, rng = Math.random, timer = true } = {}) {
  if (questions.length === 0) throw new Error('Sudden Death braucht mindestens eine Frage');
  const buckets = new Map(
    ALL_DIFFICULTIES.map((d) => [d, orderByFreshness(questions.filter((q) => q.difficulty === d), stats, rng)]),
  );
  const draw = (n) => {
    const from = difficultyPreference(suddenDifficulty(n)).find((d) => buckets.get(d)?.length);
    return from === undefined ? null : buckets.get(from).shift();
  };

  const state = {
    phase: 'question',
    number: 0, // 0-based number of the current question
    current: prepareQuestion(draw(0), rng),
    chosen: null,
    correct: null,
    timedOut: false,
    score: 0, // correct answers in a row
    outcome: null,
    timer,
  };

  const lose = () => {
    state.correct = false;
    state.phase = 'reveal';
    state.outcome = 'lost';
  };

  return {
    state,
    timeLimit: () => (timer ? TIME_LIMITS[state.current.question.difficulty] : null),
    answer(index) {
      if (state.phase !== 'question') return state;
      state.chosen = index;
      if (index !== state.current.correctIndex) return lose(), state;
      state.correct = true;
      state.score++;
      state.phase = 'reveal';
      return state;
    },
    timeUp() {
      if (state.phase !== 'question') return state;
      state.timedOut = true;
      lose();
      return state;
    },
    next() {
      if (state.phase !== 'reveal') return state;
      if (state.outcome) {
        state.phase = 'finished';
        return state;
      }
      const q = draw(state.number + 1);
      if (!q) {
        state.outcome = 'cleared';
        state.phase = 'finished';
        return state;
      }
      state.number++;
      state.current = prepareQuestion(q, rng);
      state.chosen = null;
      state.correct = null;
      state.phase = 'question';
      return state;
    },
  };
}
