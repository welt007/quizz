// localStorage wrapper with an in-memory fallback (private mode, blocked
// storage under file:// …). The game must work even if nothing can be saved.
const memory = new Map();

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch {
    /* storage unavailable or corrupt → fall through */
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

/** Returns true if the value was persisted, false if it is only kept in memory. */
export function saveJson(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  settings: 'quizshow.settings',
  stats: 'quizshow.stats',
};
