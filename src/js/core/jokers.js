// Jokers (lifelines) – pure functions, see docs/PLAN.md §5.1.
import { shuffle } from './random.js';

export const JOKERS = {
  fifty: { icon: '½', label: '50:50', title: 'Zwei falsche Antworten entfernen' },
  audience: { icon: '👥', label: 'Publikum', title: 'Das Publikum abstimmen lassen' },
  time: { icon: '⏱', label: '+30 s', title: '30 Sekunden mehr Zeit' },
};
export const EXTRA_SECONDS = 30;

/** 50:50 – returns the indices of two wrong answers to hide. */
export function fiftyFifty(correctIndex, answerCount = 4, rng = Math.random) {
  const wrong = [...Array(answerCount).keys()].filter((i) => i !== correctIndex);
  return shuffle(wrong, rng).slice(0, 2).sort();
}

// How strongly the audience leans towards the correct answer, per difficulty.
const AUDIENCE_STRENGTH = { 1: 4, 2: 2.4, 3: 1.4, 4: 0.9 };

/**
 * Simulated audience vote. Returns percentages per answer index (sum = 100,
 * hidden answers get 0). The easier the question, the more reliable the audience.
 */
export function audienceVote(correctIndex, difficulty, { hidden = [], answerCount = 4, rng = Math.random } = {}) {
  const visible = [...Array(answerCount).keys()].filter((i) => !hidden.includes(i));
  const strength = AUDIENCE_STRENGTH[difficulty] ?? 1.5;
  const weights = Array(answerCount).fill(0);
  for (const i of visible) {
    weights[i] = i === correctIndex ? strength * (0.6 + rng() * 0.8) : 0.15 + rng();
  }
  return toPercentages(weights);
}

/** Largest-remainder rounding so the result always sums to exactly 100. */
export function toPercentages(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * 100);
  const result = raw.map(Math.floor);
  let rest = 100 - result.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).filter(([, i]) => weights[i] > 0).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) result[order[k][1]]++;
  return result;
}
