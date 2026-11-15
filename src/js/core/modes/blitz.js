// "Blitzrunde": 60 seconds, as many questions as possible, streak multiplier.
import { prepareQuestion } from '../question.js';
import { shuffle } from '../random.js';

export const BLITZ_SECONDS = 60;
export const PENALTY_SECONDS = 3;
export const BLITZ_POINTS = { 1: 100, 2: 150, 3: 200, 4: 300 };
export const MAX_MULTIPLIER = 4;

/** Multiplier for an answer that brings the streak to `streak`: ×1 for 1–3, ×2 for 4–6, … max ×4. */
export function multiplierFor(streak) {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, streak - 1) / 3));
}

/**
 * Phases: 'question' → answer(i) → 'reveal' → next() → 'question'; finish() → 'finished'.
 * The clock lives in the UI; a wrong answer reports `penalty` seconds to subtract.
 * @param {object[]} questions  in play order (e.g. by freshness); reshuffled when exhausted
 */
export function createBlitzGame(questions, { rng = Math.random } = {}) {
  if (questions.length === 0) throw new Error('Blitzrunde braucht mindestens eine Frage');
  let queue = questions.slice();
  const state = {
    phase: 'question',
    current: prepareQuestion(queue.shift(), rng),
    score: 0,
    streak: 0,
    bestStreak: 0,
    answered: 0,
    correctCount: 0,
    last: null, // { correct, points, multiplier, penalty }
  };

  return {
    state,
    /** Multiplier the next correct answer would get. */
    nextMultiplier: () => multiplierFor(state.streak + 1),
    answer(index) {
      if (state.phase !== 'question') return null;
      const correct = index === state.current.correctIndex;
      state.answered++;
      state.phase = 'reveal';
      if (correct) {
        state.streak++;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        state.correctCount++;
        const multiplier = multiplierFor(state.streak);
        const points = BLITZ_POINTS[state.current.question.difficulty] * multiplier;
        state.score += points;
        state.last = { correct, points, multiplier, penalty: 0 };
      } else {
        state.streak = 0;
        state.last = { correct, points: 0, multiplier: 1, penalty: PENALTY_SECONDS };
      }
      return state.last;
    },
    next() {
      if (state.phase !== 'reveal') return state;
      if (queue.length === 0) {
        // start over, but never repeat the question just asked
        queue = shuffle(questions, rng);
        if (queue.length > 1 && queue[0].id === state.current.question.id) queue.push(queue.shift());
      }
      state.current = prepareQuestion(queue.shift(), rng);
      state.phase = 'question';
      return state;
    },
    finish() {
      state.phase = 'finished';
      return state;
    },
  };
}
