// Highscore lists (top 10 per mode).
export const HIGHSCORE_LIMIT = 10;
export const HIGHSCORE_MODES = ['ladder', 'blitz', 'sudden'];
export const MAX_NAME_LENGTH = 20;

/** Would `score` make it into the list? */
export function qualifies(list = [], score, limit = HIGHSCORE_LIMIT) {
  return score > 0 && (list.length < limit || score > list[list.length - 1].score);
}

export function cleanName(name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return clean || 'Anonym';
}

/**
 * Inserts an entry; equal scores keep the older entry first.
 * @param {{name: string, score: number, date: string, detail?: string}} entry
 * @returns {{list: object[], rank: number}} rank is 1-based, 0 if not in the list
 */
export function insertHighscore(list = [], entry, limit = HIGHSCORE_LIMIT) {
  const item = { ...entry, name: cleanName(entry.name) };
  let pos = list.findIndex((e) => item.score > e.score);
  if (pos === -1) pos = list.length;
  const next = [...list.slice(0, pos), item, ...list.slice(pos)].slice(0, limit);
  return { list: next, rank: pos < limit ? pos + 1 : 0 };
}
