// Stateful catalog library: keeps sources + enabled flags in localStorage and
// catalog data (questions incl. images) in IndexedDB. See core/library.js for the model.
import {
  BUILTIN_ID, LIBRARY_FORMAT, builtinFromEmbedded, sourceFromResult, setCatalogsEnabled,
  mergePool, compareVersions, hashString,
} from '../core/library.js';
import { loadJson, saveJson } from './storage.js';
import { dbGet, dbSet, dbDelete, isPersistent } from './db.js';

const KEY = 'quizshow.library';

export function createLibrary(embedded) {
  const embeddedBuiltin = builtinFromEmbedded(embedded);
  let sources = [];
  const data = new Map(); // catalogId → questions

  function save() {
    saveJson(KEY, { format: LIBRARY_FORMAT, sources });
  }

  async function storeData(map) {
    for (const [id, questions] of map) {
      data.set(id, questions);
      await dbSet(id, { questions });
    }
  }

  async function dropData(ids) {
    for (const id of ids) {
      data.delete(id);
      await dbDelete(id);
    }
  }

  function useEmbeddedBuiltin(previous) {
    const builtin = structuredClone(embeddedBuiltin.source);
    const flags = new Map((previous?.catalogs ?? []).map((c) => [c.file, c.enabled]));
    builtin.catalogs.forEach((c) => (c.enabled = flags.get(c.file) ?? true));
    for (const [id, qs] of embeddedBuiltin.data) data.set(id, qs);
    return builtin;
  }

  const api = {
    get sources() {
      return sources;
    },
    get persistent() {
      return isPersistent();
    },

    /** Loads the stored library. The embedded catalog wins over an older stored update. */
    async init() {
      await dbGet('__probe__'); // detects whether IndexedDB works (see persistent)
      const stored = loadJson(KEY, null);
      const storedSources = stored?.format === LIBRARY_FORMAT && Array.isArray(stored.sources) ? stored.sources : [];
      const storedBuiltin = storedSources.find((s) => s.id === BUILTIN_ID);
      let builtin;
      if (storedBuiltin?.override && compareVersions(storedBuiltin.version, embeddedBuiltin.source.version) > 0) {
        builtin = storedBuiltin;
      } else {
        if (storedBuiltin?.override) await dropData(storedBuiltin.catalogs.map((c) => c.id));
        builtin = useEmbeddedBuiltin(storedBuiltin);
      }
      sources = [builtin, ...storedSources.filter((s) => s.id !== BUILTIN_ID)];
      for (const source of sources) {
        if (source.id === BUILTIN_ID && !source.override) continue;
        for (const cat of source.catalogs) {
          const entry = await dbGet(cat.id);
          if (entry?.questions) {
            data.set(cat.id, entry.questions);
            delete cat.missing;
          } else cat.missing = true;
        }
      }
      // an update of the built-in catalog whose data is gone → back to the embedded one
      if (builtin.override && builtin.catalogs.some((c) => c.missing)) sources[0] = useEmbeddedBuiltin(builtin);
      save();
      return api;
    },

    /** The merged question pool of all enabled catalogs. */
    pool() {
      return mergePool(sources, data);
    },

    setEnabled(catalogIds, enabled) {
      sources = setCatalogsEnabled(sources, catalogIds, enabled);
      save();
    },

    setSourceEnabled(sourceId, enabled) {
      sources = setCatalogsEnabled(sources, (id, s) => s.id === sourceId, enabled);
      save();
    },

    /** Finds a URL source by entered or resolved URL. */
    findByUrl(resolvedUrl) {
      return sources.find((s) => s.kind === 'url' && s.resolvedUrl === resolvedUrl);
    },

    /** Adds a new source or replaces an existing one (same id) with a loader result. */
    async put(result, { kind, id }) {
      const sourceId = id ?? `${kind}-${hashString(`${result.resolvedUrl ?? result.name}|${Date.now()}`)}`;
      const previous = sources.find((s) => s.id === sourceId);
      const { source, data: newData } = sourceFromResult(result, { id: sourceId, kind, url: result.url, previous });
      source.resolvedUrl = result.resolvedUrl;
      if (sourceId === BUILTIN_ID) {
        source.override = true;
        source.updateUrl = previous?.updateUrl ?? source.updateUrl;
      }
      if (previous) {
        const keep = new Set(source.catalogs.map((c) => c.id));
        await dropData(previous.catalogs.map((c) => c.id).filter((cid) => !keep.has(cid)));
      }
      await storeData(newData);
      sources = previous ? sources.map((s) => (s.id === sourceId ? source : s)) : [...sources, source];
      save();
      return source;
    },

    async remove(sourceId) {
      const source = sources.find((s) => s.id === sourceId);
      if (!source || sourceId === BUILTIN_ID) return;
      await dropData(source.catalogs.map((c) => c.id));
      sources = sources.filter((s) => s.id !== sourceId);
      save();
    },

    /** Back to the catalog embedded in this HTML file. */
    async resetBuiltin() {
      const current = sources.find((s) => s.id === BUILTIN_ID);
      if (current?.override) await dropData(current.catalogs.map((c) => c.id).filter((cid) => !embeddedBuiltin.data.has(cid)));
      sources = sources.map((s) => (s.id === BUILTIN_ID ? useEmbeddedBuiltin(current) : s));
      for (const id of embeddedBuiltin.data.keys()) await dbDelete(id);
      save();
    },

    embeddedVersion: embeddedBuiltin.source.version,
  };
  return api;
}
