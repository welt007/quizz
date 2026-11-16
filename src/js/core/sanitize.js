// Cleaning of data that comes from outside the build: catalogs added by URL or
// file, and anything read back from storage. The game only ever puts text into
// the DOM (textContent), but a few values end up in attributes or CSS:
//   - image: goes into <img src>  → only https:, data:image/… or relative paths
//   - category color: becomes a CSS custom property → only real colors
//   - category icon/name: short text
// Everything else is forced to the expected type so no screen can throw on it.

export const MAX_ICON_LEN = 8; // a couple of emoji (with modifiers), never a sentence
export const MAX_NAME_LEN = 60;
export const MAX_COLOR_LEN = 40;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\((?:[\s\d.%,/\-a-z]*)\)$/i;
const NAMED_COLOR = /^[a-z]{3,20}$/i;

/** A CSS color literal the game may put into a custom property, or undefined. */
export function cleanColor(value) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v || v.length > MAX_COLOR_LEN) return undefined;
  if (HEX_COLOR.test(v) || FUNC_COLOR.test(v) || NAMED_COLOR.test(v)) return v;
  return undefined;
}

export function cleanText(value, max) {
  if (typeof value !== 'string') return undefined;
  const v = value.replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : undefined;
}

/** Category metadata {name, icon, color} with every field checked; unknown fields are dropped. */
export function cleanCategoryMeta(meta) {
  if (!meta || typeof meta !== 'object') return undefined;
  const out = {};
  const name = cleanText(meta.name, MAX_NAME_LEN);
  const icon = cleanText(meta.icon, MAX_ICON_LEN);
  const color = cleanColor(meta.color);
  if (name) out.name = name;
  if (icon) out.icon = icon;
  if (color) out.color = color;
  return Object.keys(out).length ? out : undefined;
}

/** A categories map {id: meta}; ids are plain words. */
export function cleanCategories(categories) {
  const out = {};
  if (!categories || typeof categories !== 'object') return out;
  for (const [id, meta] of Object.entries(categories)) {
    if (!/^[\w.-]{1,40}$/.test(id)) continue;
    const clean = cleanCategoryMeta(meta);
    if (clean) out[id] = clean;
  }
  return out;
}

/**
 * Is this something the game may use as an image address? Only data URIs that
 * are images, https (or http on localhost) and plain relative paths pass; a
 * relative path is accepted here because the loader resolves it against the
 * source URL and the build against catalogs/ before the game ever sees it.
 */
export function isSafeImage(src) {
  if (typeof src !== 'string' || !src || src.length > 8 * 1024 * 1024) return false;
  const s = src.trim();
  if (/^data:/i.test(s)) return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|avif);base64,[a-z0-9+/=\s]*$/i.test(s);
  if (/^https:\/\//i.test(s)) return true;
  if (/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(s)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return false; // any other scheme (javascript:, file:, blob:, …)
  if (s.startsWith('//') || s.startsWith('\\')) return false; // protocol-relative
  return true; // relative path
}

const DIFFICULTIES = new Set([1, 2, 3, 4]);

/**
 * One question as stored or merged into the pool. Returns a clean copy, or null
 * if the row cannot be used at all. Text fields are forced to strings so that
 * textContent/localeCompare never see numbers or objects.
 */
export function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const id = str(q.id).trim();
  const category = str(q.category).trim();
  const question = str(q.question).trim();
  const correct = str(q.correct).trim();
  const wrong = Array.isArray(q.wrong) ? q.wrong.map(str).map((w) => w.trim()) : [];
  const difficulty = Number(q.difficulty);
  if (!id || !category || !question || !correct || wrong.length !== 3 || wrong.some((w) => !w) || !DIFFICULTIES.has(difficulty)) return null;
  const out = { id, category, difficulty, question, correct, wrong };
  if (isSafeImage(q.image)) out.image = String(q.image).trim();
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';
  if (explanation) out.explanation = explanation;
  out.tags = Array.isArray(q.tags) ? q.tags.filter((t) => typeof t === 'string').slice(0, 20) : [];
  return out;
}

/** A list of questions as read back from storage (anything odd is dropped). */
export function cleanQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list.map(cleanQuestion).filter(Boolean);
}

/** Per-question statistics {id: {a, c, t}} – only finite, consistent numbers survive. */
export function cleanStats(stats) {
  const out = {};
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return out;
  for (const [id, s] of Object.entries(stats)) {
    if (!s || typeof s !== 'object') continue;
    const a = Number(s.a);
    const c = Number(s.c);
    const t = Number(s.t);
    if (!Number.isFinite(a) || a < 0 || !Number.isFinite(c) || c < 0 || c > a) continue;
    out[id] = { a: Math.floor(a), c: Math.floor(c), t: Number.isFinite(t) && t > 0 ? t : 0 };
  }
  return out;
}

/** Highscore lists {mode: [{name, score, date, detail?}]} – lists only, entries with a finite score. */
export function cleanHighscores(hs) {
  const out = {};
  if (!hs || typeof hs !== 'object' || Array.isArray(hs)) return out;
  for (const [mode, list] of Object.entries(hs)) {
    if (!Array.isArray(list)) continue;
    out[mode] = list
      .filter((e) => e && typeof e === 'object' && Number.isFinite(Number(e.score)))
      .map((e) => ({
        name: typeof e.name === 'string' ? e.name : 'Anonym',
        score: Number(e.score),
        date: typeof e.date === 'string' ? e.date : '',
        ...(typeof e.detail === 'string' ? { detail: e.detail } : {}),
      }));
  }
  return out;
}

/** Settings: must be a plain object; everything inside is checked where it is used. */
export function cleanSettings(settings) {
  return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
}
