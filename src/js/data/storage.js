// localStorage wrapper with an in-memory fallback (private mode, blocked
// storage under file:// …). The game must work even if nothing can be saved.
// In the Android app the values go to the native SharedPreferences instead
// (survive WebView data resets, included in Android's backup).
import { nativeBridge } from './native.js';

const memory = new Map();
const native = nativeBridge();

function readRaw(key) {
  if (native) return native.getItem(key);
  return localStorage.getItem(key);
}

function writeRaw(key, raw) {
  if (native) {
    if (!native.setItem(key, raw)) throw new Error('native storage failed');
    return;
  }
  localStorage.setItem(key, raw);
}

export function loadJson(key, fallback) {
  try {
    const raw = readRaw(key);
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
    writeRaw(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  settings: 'quizshow.settings',
  stats: 'quizshow.stats',
  highscores: 'quizshow.highscores',
};
