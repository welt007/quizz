// "Training": free choice of questions, no time pressure, explanations.
import { prepareQuestion } from '../question.js';

/**
 * Phases: 'question' → answer(i) → 'reveal' → next() → 'question' | 'finished'.
 * finish() ends the round early at any time.
 */
export function createTrainingGame(questions, { rng = Math.random } = {}) {
  if (questions.length === 0) throw new Error('Training braucht mindestens eine Frage');
  const state = {
    index: 0,
    total: questions.length,
    phase: 'question',
    current: prepareQuestion(questions[0], rng),
    chosen: null,
    correct: null,
    answered: 0,
    correctCount: 0,
    wrong: [], // original question objects answered wrong
  };

  return {
    state,
    answer(index) {
      if (state.phase !== 'question') return state;
      state.chosen = index;
      state.correct = index === state.current.correctIndex;
      state.phase = 'reveal';
      state.answered++;
      if (state.correct) state.correctCount++;
      else state.wrong.push(state.current.question);
      return state;
    },
    next() {
      if (state.phase !== 'reveal') return state;
      if (state.index + 1 >= state.total) {
        state.phase = 'finished';
        return state;
      }
      state.index++;
      state.current = prepareQuestion(questions[state.index], rng);
      state.chosen = null;
      state.correct = null;
      state.phase = 'question';
      return state;
    },
    finish() {
      state.phase = 'finished';
      return state;
    },
  };
}
