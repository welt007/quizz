import { shuffle } from './random.js';

export const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

/**
 * Prepares a question for display: the four answers in random order and the
 * index of the correct one.
 * @param {import('./catalog.js').Question} q
 * @returns {{question: object, answers: string[], correctIndex: number}}
 */
export function prepareQuestion(q, rng = Math.random) {
  const answers = shuffle([q.correct, ...q.wrong], rng);
  return { question: q, answers, correctIndex: answers.indexOf(q.correct) };
}
