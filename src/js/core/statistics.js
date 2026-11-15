// Player statistics derived from the per-question stats ({ [id]: {a, c, t} }, see stats.js)
// for the questions currently in the pool.
import { ALL_DIFFICULTIES } from './questionPool.js';

const rate = (correct, asked) => (asked ? correct / asked : null);

function bucket() {
  return { asked: 0, correct: 0, seen: 0, total: 0 };
}

function add(b, s) {
  b.total++;
  if (!s?.a) return;
  b.asked += s.a;
  b.correct += s.c;
  b.seen++;
}

const finish = (b) => ({ ...b, rate: rate(b.correct, b.asked), coverage: b.total ? b.seen / b.total : 0 });

/**
 * @param {object[]} questions  current pool
 * @param {Object<string, {a: number, c: number, t: number}>} stats
 * @returns {{overall, byCategory: Object, byDifficulty: Object, troublemakers: object[], lastPlayed: number}}
 *   each bucket: { asked, correct, seen (distinct questions), total, rate (0–1 or null), coverage (0–1) }
 *   troublemakers: questions answered wrong at least once, most wrong (then lowest rate) first
 */
export function summarizeStats(questions, stats = {}, { limit = 10 } = {}) {
  const overall = bucket();
  const byCategory = {};
  const byDifficulty = Object.fromEntries(ALL_DIFFICULTIES.map((d) => [d, bucket()]));
  const trouble = [];
  let lastPlayed = 0;

  for (const q of questions) {
    const s = stats[q.id];
    add(overall, s);
    add((byCategory[q.category] ??= bucket()), s);
    if (byDifficulty[q.difficulty]) add(byDifficulty[q.difficulty], s);
    if (s?.a) {
      lastPlayed = Math.max(lastPlayed, s.t ?? 0);
      const wrong = s.a - s.c;
      if (wrong > 0) trouble.push({ question: q, asked: s.a, wrong, rate: rate(s.c, s.a) });
    }
  }
  trouble.sort((x, y) => y.wrong - x.wrong || x.rate - y.rate || y.asked - x.asked);

  return {
    overall: finish(overall),
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, b]) => [k, finish(b)])),
    byDifficulty: Object.fromEntries(Object.entries(byDifficulty).map(([k, b]) => [k, finish(b)])),
    troublemakers: trouble.slice(0, limit),
    lastPlayed,
  };
}
