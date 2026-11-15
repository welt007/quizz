// Catalog library: several sources (built-in, URL, local import), each with one
// or more catalogs (= CSV files). All enabled catalogs are merged into ONE
// question pool. Pure functions – persistence lives in data/library.js.
//
// Source  { id, kind: 'builtin'|'url'|'import', name, url?, version, updatedAt, addedAt,
//           categories: {id: {name, icon, color}}, updateUrl?, override?, catalogs: Catalog[] }
// Catalog { id, file, name, enabled, count, errors: Issue[], missing? }
//
// Question ids are made unique across sources: built-in questions keep their id
// (statistics stay valid), all others are prefixed with "<sourceId>:".

export const BUILTIN_ID = 'builtin';
export const LIBRARY_FORMAT = 1;
const MAX_STORED_ERRORS = 50;

/** "welt-geschichte_2.csv" → "Welt Geschichte 2" */
export function catalogDisplayName(file) {
  const base = decodeURIComponent(String(file).split('/').pop() ?? '').replace(/\.csv$/i, '');
  const words = base.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Katalog';
}

/** Small stable hash (djb2) as hex – for ids and CSV content versions. */
export function hashString(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export const catalogId = (sourceId, file) => `${sourceId}/${file}`;

/** Numeric-aware version comparison: > 0 if a is newer than b. */
export function compareVersions(a = '', b = '') {
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

/**
 * Creates a source object from a loader result (data/loader.js) or embedded data.
 * @param {{name, version, categories, updateUrl?, catalogs: {file, name?, questions, errors?}[]}} result
 * @param {{id, kind, url?, now?, previous?}} meta  previous: existing source → keeps enabled flags
 * @returns {{source: object, data: Map<string, object[]>}}  data: catalogId → questions
 */
export function sourceFromResult(result, { id, kind, url, now = new Date().toISOString(), previous } = {}) {
  const oldCatalogs = new Map((previous?.catalogs ?? []).map((c) => [c.file, c]));
  const data = new Map();
  const catalogs = result.catalogs.map((c) => {
    const cid = catalogId(id, c.file);
    data.set(cid, c.questions);
    return {
      id: cid,
      file: c.file,
      name: c.name ?? catalogDisplayName(c.file),
      enabled: oldCatalogs.get(c.file)?.enabled ?? true,
      count: c.questions.length,
      errors: (c.errors ?? []).slice(0, MAX_STORED_ERRORS),
      errorCount: (c.errors ?? []).length,
    };
  });
  const source = {
    id,
    kind,
    name: result.name,
    url,
    version: result.version,
    updateUrl: result.updateUrl,
    categories: result.categories ?? {},
    addedAt: previous?.addedAt ?? now,
    updatedAt: now,
    catalogs,
  };
  return { source, data };
}

/** Built-in source from the data embedded at build time. */
export function builtinFromEmbedded(embedded) {
  const { manifest } = embedded;
  return sourceFromResult(
    {
      name: manifest.title ?? 'Standardkatalog',
      version: manifest.version,
      categories: manifest.categories,
      updateUrl: manifest.updateUrl,
      catalogs: embedded.files.map((f) => ({ file: f.file, questions: f.questions })),
    },
    { id: BUILTIN_ID, kind: 'builtin', now: null },
  );
}

/** Enables/disables catalogs. ids: one id, a list, or a predicate. Returns a new sources array. */
export function setCatalogsEnabled(sources, ids, enabled) {
  const match = typeof ids === 'function' ? ids : (id) => [].concat(ids).includes(id);
  return sources.map((s) => ({
    ...s,
    catalogs: s.catalogs.map((c) => (match(c.id, s) ? { ...c, enabled } : c)),
  }));
}

/** Unique question id within the merged pool. */
export const questionUid = (sourceId, id) => (sourceId === BUILTIN_ID ? id : `${sourceId}:${id}`);

/**
 * Merges all enabled catalogs into one pool.
 * Category metadata: the first source (in list order) that describes a category wins.
 * @param {object[]} sources
 * @param {Map<string, object[]>} data  catalogId → questions
 * @returns {{questions: object[], categories: object, activeCatalogs: number, totalCatalogs: number}}
 */
export function mergePool(sources, data) {
  const questions = [];
  const categories = {};
  let activeCatalogs = 0;
  let totalCatalogs = 0;
  const seen = new Set();
  for (const source of sources) {
    for (const cat of source.catalogs) {
      totalCatalogs++;
      const list = data.get(cat.id);
      if (!cat.enabled || !list) continue;
      activeCatalogs++;
      for (const q of list) {
        const uid = questionUid(source.id, q.id);
        if (seen.has(uid)) continue;
        seen.add(uid);
        questions.push({ ...q, id: uid, originalId: q.id, sourceId: source.id, catalogId: cat.id });
        if (!categories[q.category] && source.categories?.[q.category]) {
          categories[q.category] = source.categories[q.category];
        }
      }
    }
  }
  return { questions, categories, activeCatalogs, totalCatalogs };
}

/** Short summary for previews: questions, catalogs, categories, broken rows. */
export function summarizeResult(result) {
  const questions = result.catalogs.reduce((n, c) => n + c.questions.length, 0);
  const categories = new Set(result.catalogs.flatMap((c) => c.questions.map((q) => q.category)));
  const errors = result.catalogs.reduce((n, c) => n + (c.errors?.length ?? 0), 0) + (result.errors?.length ?? 0);
  const warnings = result.catalogs.reduce((n, c) => n + (c.warnings?.length ?? 0), 0);
  return { questions, catalogs: result.catalogs.length, categories: categories.size, errors, warnings };
}
