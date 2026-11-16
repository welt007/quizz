import { shuffle } from './random.js';
import { DIFFICULTIES } from './catalog.js';

export const ALL_DIFFICULTIES = Object.keys(DIFFICULTIES).map(Number);
const MAX_DIFFICULTY = Math.max(...ALL_DIFFICULTIES);

/** Filters by category ids and difficulty levels; an empty/missing list means "all". */
export function filterQuestions(questions, { categories, difficulties } = {}) {
  const cats = categories?.length ? new Set(categories) : null;
  const diffs = difficulties?.length ? new Set(difficulties) : null;
  return questions.filter((q) => (!cats || cats.has(q.category)) && (!diffs || diffs.has(q.difficulty)));
}

/**
 * Orders questions so that never-asked come first, then least recently asked.
 * Equal candidates are in random order.
 * @param {Object<string, {t?: number}>} stats  see stats.js
 */
export function orderByFreshness(questions, stats = {}, rng = Math.random) {
  if (!stats || typeof stats !== 'object') stats = {};
  const t = (q) => Number(stats[q.id]?.t) || 0;
  return shuffle(questions, rng).sort((a, b) => t(a) - t(b));
}

/** Difficulties to try if `d` has run out: nearest first, easier before harder. */
export function difficultyPreference(d) {
  const order = [d];
  for (let k = 1; k < MAX_DIFFICULTY; k++) {
    if (d - k >= 1) order.push(d - k);
    if (d + k <= MAX_DIFFICULTY) order.push(d + k);
  }
  return order;
}

/**
 * Picks one question per entry of `plan` (a list of difficulties). If a
 * difficulty runs out, a neighbouring one is used. The result is sorted by
 * difficulty so the game never gets easier.
 *
 * @returns {{ok: boolean, questions: object[], substitutions: number}}
 *   substitutions: how many levels had to use another difficulty.
 *   The substitution count depends only on the counts per difficulty, so it can
 *   be used for a preview before the game starts.
 */
export function buildLadder(questions, plan, { stats, rng = Math.random } = {}) {
  const buckets = new Map(
    ALL_DIFFICULTIES.map((d) => [d, orderByFreshness(questions.filter((q) => q.difficulty === d), stats, rng)]),
  );
  // pass 1: every level from its own difficulty, as far as possible
  const picked = plan.map((wanted) => buckets.get(wanted)?.shift());
  // pass 2: fill the gaps from what is left (avoids a cascade of substitutions)
  let substitutions = 0;
  for (let i = 0; i < plan.length; i++) {
    if (picked[i]) continue;
    const from = difficultyPreference(plan[i]).find((d) => buckets.get(d)?.length);
    if (from === undefined) return { ok: false, questions: [], substitutions };
    substitutions++;
    picked[i] = buckets.get(from).shift();
  }
  picked.sort((a, b) => a.difficulty - b.difficulty);
  return { ok: true, questions: picked, substitutions };
}

/** Counts questions per difficulty: {1: n, 2: n, …}. */
export function countByDifficulty(questions) {
  const counts = Object.fromEntries(ALL_DIFFICULTIES.map((d) => [d, 0]));
  for (const q of questions) counts[q.difficulty]++;
  return counts;
}
