// Catalog sources: turning what a user types into the options menu into a
// URL the game can fetch directly (with CORS) – see docs/PLAN.md §4.
//
// Accepted inputs:
//   owner/repo                                       → GitHub repo, catalogs/index.json on the default branch
//   https://github.com/owner/repo                    → same
//   https://github.com/owner/repo/tree/<ref>/<dir>   → <dir>/index.json on <ref>
//   https://github.com/owner/repo/blob/<ref>/<file>  → that file (.json or .csv)
//   https://<host>/.../index.json  (or any .json)    → manifest
//   https://<host>/.../questions.csv                 → single CSV catalog
//   https://<host>/.../dir/                          → dir/index.json

export const DEFAULT_CATALOG_DIR = 'catalogs';
const RAW = 'https://raw.githubusercontent.com';
const GH_SHORTHAND = /^([\w.-]+)\/([\w.-]+)$/;

export class SourceUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceUrlError';
  }
}

/**
 * @param {string} input  what the user entered
 * @returns {{kind: 'manifest'|'csv', url: string, baseUrl: string}}
 *   url: the file to fetch; baseUrl: directory against which relative paths
 *   (CSV files from the manifest, images) are resolved.
 */
export function normalizeSourceUrl(input) {
  const text = String(input ?? '').trim();
  if (!text) throw new SourceUrlError('Bitte eine URL angeben.');

  const short = text.match(GH_SHORTHAND);
  if (short) return fromParts(`${RAW}/${short[1]}/${short[2]}/HEAD/${DEFAULT_CATALOG_DIR}/index.json`);

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new SourceUrlError('Das ist keine gültige URL.');
  }
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new SourceUrlError('Nur https-Adressen werden unterstützt.');
  }
  url.hash = '';

  if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
    return fromParts(githubToRaw(url));
  }
  return fromParts(url.href);
}

function githubToRaw(url) {
  const [owner, repo, type, ref, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) throw new SourceUrlError('GitHub-Adresse ohne Repository.');
  const name = repo.replace(/\.git$/, '');
  if (!type) return `${RAW}/${owner}/${name}/HEAD/${DEFAULT_CATALOG_DIR}/index.json`;
  if ((type === 'tree' || type === 'blob') && ref) {
    const path = rest.join('/');
    if (type === 'blob') return `${RAW}/${owner}/${name}/${ref}/${path}`;
    return `${RAW}/${owner}/${name}/${ref}/${path ? `${path}/` : ''}index.json`;
  }
  throw new SourceUrlError('Diese GitHub-Adresse wird nicht unterstützt – bitte auf das Repo, einen Ordner oder eine Datei verlinken.');
}

function fromParts(href) {
  const url = new URL(href);
  const path = url.pathname.toLowerCase();
  if (path.endsWith('/')) url.pathname += 'index.json';
  let kind;
  if (url.pathname.toLowerCase().endsWith('.json')) kind = 'manifest';
  else if (path.endsWith('.csv')) kind = 'csv';
  else {
    throw new SourceUrlError('Die URL muss auf eine index.json, eine .csv-Datei, einen Ordner (mit / am Ende) oder ein GitHub-Repo zeigen.');
  }
  return { kind, url: url.href, baseUrl: new URL('./', url).href };
}

/** Resolves a path from a manifest/CSV (CSV file name, image) against the source's base URL. */
export function resolveSourcePath(path, baseUrl) {
  if (/^(https?:|data:)/i.test(path)) return path;
  return new URL(path, baseUrl).href;
}
