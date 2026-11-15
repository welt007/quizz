// Minimal IndexedDB key-value store for catalog data (questions incl. images).
// Falls back to memory if IndexedDB is unavailable (private mode, some file:// setups).
const DB_NAME = 'quizshow';
const STORE = 'catalogs';
const memory = new Map();
let dbPromise = null;
let persistent = true;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
      } catch (e) {
        reject(e);
      }
    }).catch((e) => {
      persistent = false;
      throw e;
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Whether data survives a reload (false = memory only). Valid after the first call. */
export const isPersistent = () => persistent;

export async function dbGet(key) {
  try {
    return await run('readonly', (s) => s.get(key));
  } catch {
    return memory.get(key);
  }
}

export async function dbSet(key, value) {
  memory.set(key, value);
  try {
    await run('readwrite', (s) => s.put(value, key));
    return true;
  } catch {
    return false;
  }
}

export async function dbDelete(key) {
  memory.delete(key);
  try {
    await run('readwrite', (s) => s.delete(key));
  } catch {
    /* memory only */
  }
}
