/**
 * Per-question statistics, keyed by question id:
 *   { [id]: { a: timesAsked, c: timesCorrect, t: lastAskedTimestamp } }
 * Used to avoid repeating recently asked questions.
 */
export function recordAnswer(stats, id, correct, now = Date.now()) {
  if (!stats || typeof stats !== 'object') stats = {};
  const prev = stats[id] && typeof stats[id] === 'object' ? stats[id] : { a: 0, c: 0, t: 0 };
  return { ...stats, [id]: { a: prev.a + 1, c: prev.c + (correct ? 1 : 0), t: now } };
}
