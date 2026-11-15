// Entry point: loads the embedded catalogs, builds the shared context and
// routes between screens. See docs/PLAN.md for the overall architecture.
import { h } from './ui/dom.js';
import { recordAnswer } from './core/stats.js';
import { insertHighscore } from './core/highscores.js';
import { loadJson, saveJson, KEYS } from './data/storage.js';
import { setKeyHandler } from './ui/input.js';
import { audio } from './ui/audio.js';
import { renderStart } from './ui/screens/start.js';
import { renderSetup } from './ui/screens/setup.js';
import { renderLadder } from './ui/screens/ladder.js';
import { renderTraining } from './ui/screens/training.js';
import { renderBlitz } from './ui/screens/blitz.js';
import { renderSudden } from './ui/screens/sudden.js';
import { renderDuel } from './ui/screens/duel.js';
import { renderHighscores } from './ui/screens/highscores.js';

/* global __APP_VERSION__ */
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const FALLBACK_COLORS = ['#8e6cff', '#e05c9b', '#25a5b8', '#c9a227', '#6aa84f', '#e07b39'];

function loadEmbeddedCatalogs() {
  const el = document.getElementById('embedded-catalogs');
  if (!el) return { manifest: { title: 'Kein Katalog', version: '-', categories: {} }, questions: [] };
  return JSON.parse(el.textContent);
}

const screens = {
  start: renderStart,
  setup: renderSetup,
  ladder: renderLadder,
  training: renderTraining,
  blitz: renderBlitz,
  sudden: renderSudden,
  duel: renderDuel,
  highscores: renderHighscores,
};

const catalog = loadEmbeddedCatalogs();
const categoryIds = [...new Set(catalog.questions.map((q) => q.category))].sort((a, b) =>
  (catalog.manifest.categories?.[a]?.name ?? a).localeCompare(catalog.manifest.categories?.[b]?.name ?? b, 'de'),
);

const ctx = {
  app: document.getElementById('app'),
  version: VERSION,
  catalog,
  categories: categoryIds,
  settings: loadJson(KEYS.settings, {}),
  stats: loadJson(KEYS.stats, {}),
  highscores: loadJson(KEYS.highscores, {}),
  leaveHandlers: [],

  categoryInfo(id) {
    const meta = catalog.manifest.categories?.[id] ?? {};
    const idx = Math.max(0, categoryIds.indexOf(id));
    return {
      name: meta.name ?? id,
      icon: meta.icon ?? '❓',
      color: meta.color ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    };
  },

  saveSettings(patch) {
    ctx.settings = { ...ctx.settings, ...patch };
    saveJson(KEYS.settings, ctx.settings);
  },

  /** "Alle Kategorien" or the category names. */
  categoryLabel(ids = []) {
    if (!ids.length || ids.length === categoryIds.length) return 'Alle Kategorien';
    return ids.map((id) => ctx.categoryInfo(id).name).join(', ');
  },

  /** Adds a highscore entry, returns the 1-based rank (0 = not in the list). */
  addHighscore(mode, entry) {
    const { list, rank } = insertHighscore(ctx.highscores[mode], entry);
    ctx.highscores = { ...ctx.highscores, [mode]: list };
    saveJson(KEYS.highscores, ctx.highscores);
    return rank;
  },

  clearHighscores(mode) {
    ctx.highscores = { ...ctx.highscores, [mode]: [] };
    saveJson(KEYS.highscores, ctx.highscores);
  },

  record(id, correct) {
    ctx.stats = recordAnswer(ctx.stats, id, correct);
    saveJson(KEYS.stats, ctx.stats);
  },

  /** Registers cleanup for the current screen (timers etc.); runs on the next go(). */
  onLeave(fn) {
    ctx.leaveHandlers.push(fn);
  },

  go(name, params = {}) {
    for (const fn of ctx.leaveHandlers.splice(0)) fn();
    setKeyHandler(null);
    window.scrollTo(0, 0);
    (screens[name] ?? renderStart)(ctx, params);
  },

  toast(text) {
    const el = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.classList.add('is-leaving'), 4000);
    setTimeout(() => el.remove(), 4600);
  },
};

// global sound toggle (top right, all screens)
audio.setEnabled(ctx.settings.sound !== false);
const soundButton = h('button', { class: 'sound-toggle', onclick: () => toggleSound() });
function renderSoundButton() {
  soundButton.textContent = audio.enabled ? '🔊' : '🔇';
  soundButton.setAttribute('aria-label', audio.enabled ? 'Ton ausschalten (M)' : 'Ton einschalten (M)');
  soundButton.title = soundButton.getAttribute('aria-label');
}
function toggleSound() {
  audio.setEnabled(!audio.enabled);
  ctx.saveSettings({ sound: audio.enabled });
  renderSoundButton();
  audio.play('click');
}
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
  toggleSound();
});
renderSoundButton();
document.body.append(soundButton);

ctx.go('start');
