// Loads a catalog source over the network (manifest with several CSVs, or a
// single CSV) or from local files, validates it and turns images into data URIs
// so they work offline afterwards. `fetchImpl` is injectable for tests.
import { parseCatalog, validateManifest } from '../core/catalog.js';
import { normalizeSourceUrl, resolveSourcePath } from '../core/sources.js';
import { catalogDisplayName, hashString } from '../core/library.js';
import { cleanCategories, cleanQuestion, cleanText } from '../core/sanitize.js';

const IMAGE_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PARALLEL_IMAGES = 6;

export class LoaderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LoaderError';
  }
}

async function fetchChecked(fetchImpl, url, what) {
  let res;
  try {
    res = await fetchImpl(url, { cache: 'no-cache' });
  } catch {
    throw new LoaderError(
      `${what} konnte nicht geladen werden – keine Internetverbindung, oder der Server erlaubt keinen Zugriff aus dem Browser (CORS).`,
    );
  }
  if (!res.ok) {
    const hint = res.status === 404 ? ' (nicht gefunden – Adresse prüfen; private Repos sind nicht erreichbar)' : '';
    throw new LoaderError(`${what} konnte nicht geladen werden: HTTP ${res.status}${hint}.`);
  }
  return res;
}

/**
 * Loads a source from a URL as entered by the user.
 * @returns {Promise<{name, version, categories, updateUrl?, url, resolvedUrl, catalogs: {file, name, questions, errors, warnings}[]}>}
 */
export async function loadFromUrl(input, { fetchImpl = globalThis.fetch, onProgress } = {}) {
  const target = normalizeSourceUrl(input); // throws SourceUrlError with a readable message
  const progress = (text) => onProgress?.(text);

  if (target.kind === 'csv') {
    progress('Lade CSV …');
    const text = await (await fetchChecked(fetchImpl, target.url, 'Die CSV-Datei')).text();
    const file = decodeURIComponent(new URL(target.url).pathname.split('/').pop());
    const result = {
      name: catalogDisplayName(file),
      version: hashString(text),
      categories: {},
      attribution: undefined,
      url: String(input).trim(),
      resolvedUrl: target.url,
      catalogs: [parseFile(text, file, null)],
    };
    await inlineImages(result, { fetchImpl, baseUrl: target.baseUrl, progress });
    return finish(result);
  }

  progress('Lade Katalogbeschreibung (index.json) …');
  let manifest;
  try {
    manifest = await (await fetchChecked(fetchImpl, target.url, 'Die Katalogbeschreibung (index.json)')).json();
  } catch (e) {
    if (e instanceof LoaderError) throw e;
    throw new LoaderError('Die Katalogbeschreibung (index.json) ist kein gültiges JSON.');
  }
  const problems = validateManifest(manifest);
  if (problems.length) throw new LoaderError(`Die Katalogbeschreibung ist fehlerhaft: ${problems.join('; ')}.`);

  const catalogs = [];
  for (const [i, file] of manifest.files.entries()) {
    progress(`Lade ${file} (${i + 1}/${manifest.files.length}) …`);
    try {
      const text = await (await fetchChecked(fetchImpl, resolveSourcePath(file, target.baseUrl), file)).text();
      catalogs.push(parseFile(text, file, manifest.categories ?? {}, manifest.titles?.[file]));
    } catch (e) {
      if (!(e instanceof LoaderError)) throw e;
      catalogs.push({ file, name: catalogDisplayName(file), questions: [], errors: [{ source: file, line: 0, message: e.message }], warnings: [] });
    }
  }
  const result = {
    name: cleanText(manifest.title, 80) || catalogDisplayName(target.url.replace(/\/index\.json$/, '')),
    version: manifest.version,
    categories: cleanCategories(manifest.categories),
    updateUrl: typeof manifest.updateUrl === 'string' ? manifest.updateUrl : undefined,
    attribution: cleanText(manifest.attribution, 600),
    url: String(input).trim(),
    resolvedUrl: target.url,
    catalogs,
  };
  dropDuplicateIds(result);
  await inlineImages(result, { fetchImpl, baseUrl: target.baseUrl, progress });
  return finish(result);
}

/**
 * Builds a source from local CSV files (file picker). Relative image paths cannot
 * be resolved here – such questions are skipped; https images are downloaded if online.
 * @param {{name: string, text: string}[]} files
 */
export async function loadFromFiles(files, { fetchImpl = globalThis.fetch, onProgress } = {}) {
  if (!files.length) throw new LoaderError('Keine Datei ausgewählt.');
  const result = {
    name: files.length === 1 ? catalogDisplayName(files[0].name) : `Import (${files.length} Dateien)`,
    version: hashString(files.map((f) => f.name + f.text).join('\n')),
    categories: {},
    catalogs: files.map((f) => parseFile(f.text, f.name, null)),
  };
  dropDuplicateIds(result);
  await inlineImages(result, { fetchImpl, baseUrl: null, progress: (t) => onProgress?.(t) });
  return finish(result);
}

/** categories: from index.json (unknown categories → warning), or null without a manifest. */
function parseFile(text, file, categories, title) {
  const res = parseCatalog(text, { source: file, categories: categories ?? undefined });
  const questions = [];
  for (const { source, ...q } of res.questions) {
    // image addresses with other schemes (javascript:, file:, …) are not images
    if (q.image && !cleanQuestion(q)?.image) {
      res.errors.push({ source: file, line: 0, message: `${q.id}: Bildadresse "${String(q.image).slice(0, 40)}" ist nicht erlaubt – Frage übersprungen` });
      continue;
    }
    questions.push(q);
  }
  return { file, name: cleanText(title, 80) || catalogDisplayName(file), questions, errors: res.errors, warnings: res.warnings };
}

/** Question ids must be unique within one source (across its files). */
function dropDuplicateIds(result) {
  const seen = new Map();
  for (const cat of result.catalogs) {
    cat.questions = cat.questions.filter((q) => {
      if (!seen.has(q.id)) return seen.set(q.id, cat.file), true;
      cat.errors.push({ source: cat.file, line: 0, message: `ID "${q.id}" kommt bereits in ${seen.get(q.id)} vor – übersprungen` });
      return false;
    });
  }
}

function finish(result) {
  if (result.catalogs.every((c) => c.questions.length === 0)) {
    const first = result.catalogs.flatMap((c) => c.errors)[0];
    throw new LoaderError(`Keine gültigen Fragen gefunden${first ? ` – z. B. ${first.source}${first.line ? `:${first.line}` : ''}: ${first.message}` : ''}.`);
  }
  return result;
}

/** Downloads all question images and replaces them by data URIs. Failing questions are skipped. */
async function inlineImages(result, { fetchImpl, baseUrl, progress }) {
  const jobs = [];
  for (const cat of result.catalogs) {
    for (const q of cat.questions) {
      if (q.image && !/^data:/i.test(q.image)) jobs.push({ cat, q });
    }
  }
  if (!jobs.length) return;
  const failed = new Set();
  let done = 0;
  const cache = new Map(); // same image used twice → download once
  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const { cat, q } = job;
      try {
        if (!baseUrl && !/^https?:/i.test(q.image)) {
          throw new LoaderError('relativer Bildpfad – beim Datei-Import nur https-Adressen oder data:-URIs möglich');
        }
        const url = baseUrl ? resolveSourcePath(q.image, baseUrl) : q.image;
        if (!cache.has(url)) cache.set(url, fetchImage(fetchImpl, url));
        q.image = await cache.get(url);
      } catch (e) {
        failed.add(q);
        cat.errors.push({ source: cat.file, line: 0, message: `${q.id}: Bild nicht ladbar (${e.message}) – Frage übersprungen` });
      }
      progress(`Lade Bilder … ${++done}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_IMAGES }, worker));
  for (const cat of result.catalogs) cat.questions = cat.questions.filter((q) => !failed.has(q));
}

async function fetchImage(fetchImpl, url) {
  const res = await fetchChecked(fetchImpl, url, 'Bild');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new LoaderError(`größer als ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  const ext = new URL(url).pathname.split('.').pop().toLowerCase();
  const header = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  // raw.githubusercontent.com serves e.g. SVG as text/plain → fall back to the extension
  const mime = header.startsWith('image/') ? header : IMAGE_MIME[ext];
  if (!mime) throw new LoaderError('kein Bildformat');
  return `data:${mime};base64,${bytesToBase64(buf)}`;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
