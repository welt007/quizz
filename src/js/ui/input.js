// One global keyboard handler at a time; each screen installs its own.
import { ANSWER_KEYS } from '../core/question.js';

let handler = null;

document.addEventListener('keydown', (e) => {
  if (!handler || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (document.querySelector('dialog[open]')) return; // dialogs handle their own keys
  if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
  // Otherwise the browser applies this Escape to a dialog the handler has just opened
  if (e.key === 'Escape') e.preventDefault();
  handler(e);
});

export function setKeyHandler(fn) {
  handler = fn;
}

export const hasKeyHandler = () => handler != null;

/** A–D or 1–4 → 0–3, otherwise -1. */
export function answerIndexFromKey(key) {
  const letter = ANSWER_KEYS.indexOf(key.toUpperCase());
  if (letter >= 0) return letter;
  const num = Number(key);
  return Number.isInteger(num) && num >= 1 && num <= ANSWER_KEYS.length ? num - 1 : -1;
}

/** Enter/Space/→ as "continue" – but not when a button has focus (it clicks by itself). */
export function isContinueKey(e) {
  if (e.target instanceof HTMLButtonElement) return false;
  return e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight';
}
