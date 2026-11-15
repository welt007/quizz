// Entry point: loads the embedded catalogs, builds the shared context and
// routes between screens. See docs/PLAN.md for the overall architecture.
import { h } from './ui/dom.js';
import { recordAnswer } from './core/stats.js';
import { insertHighscore } from './core/highscores.js';
import { createLibrary } from './data/library.js';
import { loadJson, saveJson, KEYS } from './data/storage.js';
import { setKeyHandler } from './ui/input.js';
import { audio } from './ui/audio.js';
import { togglePresentation, isPresentation, onPresentationChange } from './ui/presentation.js';
import { showHelp } from './ui/components/help.js';
import { renderStart } from './ui/screens/start.js';
import { renderSetup } from './ui/screens/setup.js';
import { renderLadder } from './ui/screens/ladder.js';
import { renderTraining } from './ui/screens/training.js';
import { renderBlitz } from './ui/screens/blitz.js';
import { renderSudden } from './ui/screens/sudden.js';
import { renderDuel } from './ui/screens/duel.js';
import { renderHighscores } from './ui/screens/highscores.js';
import { renderOptions } from './ui/screens/options.js';
import { renderStatistics } from './ui/screens/statistics.js';

/* global __APP_VERSION__ */
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const FALLBACK_COLORS = ['#8e6cff', '#e05c9b', '#25a5b8', '#c9a227', '#6aa84f', '#e07b39'];

function loadEmbeddedCatalogs() {
  const el = document.getElementById('embedded-catalogs');
  if (!el) return { manifest: { title: 'Kein Katalog', version: '-', files: [], categories: {} }, files: [] };
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
  options: renderOptions,
  statistics: renderStatistics,
};

const ctx = {
  app: document.getElementById('app'),
  version: VERSION,
  library: null,
  /** Merged pool of all enabled catalogs: { questions, categories, activeCatalogs, totalCatalogs } */
  catalog: { questions: [], categories: {}, activeCatalogs: 0, totalCatalogs: 0 },
  /** Category ids present in the pool, sorted by display name. */
  categories: [],
  settings: loadJson(KEYS.settings, {}),
  stats: loadJson(KEYS.stats, {}),
  highscores: loadJson(KEYS.highscores, {}),
  leaveHandlers: [],

  /** Recomputes the pool after catalogs were added, removed, enabled or disabled. */
  refreshCatalog() {
    ctx.catalog = ctx.library.pool();
    const name = (id) => ctx.catalog.categories[id]?.name ?? id;
    ctx.categories = [...new Set(ctx.catalog.questions.map((q) => q.category))].sort((a, b) => name(a).localeCompare(name(b), 'de'));
  },

  categoryInfo(id) {
    const meta = ctx.catalog.categories?.[id] ?? {};
    const idx = Math.max(0, ctx.categories.indexOf(id));
    return {
      name: meta.name ?? id.charAt(0).toUpperCase() + id.slice(1),
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
    if (!ids.length || ids.length === ctx.categories.length) return 'Alle Kategorien';
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

// corner buttons (top right, all screens): presentation mode + sound
audio.setEnabled(ctx.settings.sound !== false);
const soundButton = h('button', { class: 'corner-btn', onclick: () => toggleSound() });
const presentButton = h('button', { class: 'corner-btn corner-btn--present', onclick: () => togglePresentation() });
function renderPresentButton() {
  const on = isPresentation();
  presentButton.textContent = on ? '🗗' : '📺';
  presentButton.setAttribute('aria-label', on ? 'Präsentationsmodus beenden (F)' : 'Präsentationsmodus: Vollbild für Beamer/TV (F)');
  presentButton.setAttribute('aria-pressed', String(on));
  presentButton.title = presentButton.getAttribute('aria-label');
}
onPresentationChange(renderPresentButton);
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
// global shortcuts – work on every screen (screen keys: ui/input.js)
const GLOBAL_KEYS = {
  m: toggleSound,
  f: togglePresentation,
  '?': showHelp,
  z: () => document.querySelector('.question__zoom')?.click(),
};
document.addEventListener('keydown', (e) => {
  const action = GLOBAL_KEYS[e.key.toLowerCase()];
  if (!action || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
  e.preventDefault();
  action();
});
renderSoundButton();
renderPresentButton();
document.body.append(h('div', { class: 'corner' }, presentButton, soundButton));

createLibrary(loadEmbeddedCatalogs())
  .init()
  .then((library) => {
    ctx.library = library;
    ctx.refreshCatalog();
    ctx.go('start');
  });
