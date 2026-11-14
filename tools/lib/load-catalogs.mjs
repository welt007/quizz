// Reads catalogs/index.json and all referenced CSV files from disk,
// validates them and (optionally) inlines relative images as data URIs.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCatalog, validateManifest } from '../../src/js/core/catalog.js';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};
export const IMAGE_WARN_BYTES = 200 * 1024;

export async function loadCatalogs(dir, { inlineImages = false } = {}) {
  const errors = [];
  const warnings = [];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'));
  } catch (e) {
    errors.push({ source: 'index.json', line: 0, message: `nicht lesbar: ${e.message}` });
    return { manifest: null, questions: [], errors, warnings };
  }
  for (const message of validateManifest(manifest)) errors.push({ source: 'index.json', line: 0, message });
  if (errors.length) return { manifest, questions: [], errors, warnings };

  const questions = [];
  const seen = new Map(); // id → source, across files
  for (const file of manifest.files) {
    let text;
    try {
      text = await readFile(path.join(dir, file), 'utf8');
    } catch (e) {
      errors.push({ source: file, line: 0, message: `nicht lesbar: ${e.message}` });
      continue;
    }
    const res = parseCatalog(text, { source: file, categories: manifest.categories ?? {} });
    errors.push(...res.errors);
    warnings.push(...res.warnings);
    for (const q of res.questions) {
      if (seen.has(q.id)) {
        errors.push({ source: file, line: 0, message: `ID "${q.id}" kommt bereits in ${seen.get(q.id)} vor` });
        continue;
      }
      seen.set(q.id, file);
      questions.push(q);
    }
  }

  for (const q of questions) {
    if (!q.image || /^(https?:|data:)/i.test(q.image)) continue;
    const imgPath = path.resolve(dir, q.image);
    if (!imgPath.startsWith(path.resolve(dir) + path.sep)) {
      errors.push({ source: q.source, line: 0, message: `${q.id}: Bildpfad "${q.image}" liegt außerhalb von catalogs/` });
      continue;
    }
    const mime = MIME[path.extname(imgPath).toLowerCase()];
    if (!mime) {
      errors.push({ source: q.source, line: 0, message: `${q.id}: Bildformat von "${q.image}" nicht unterstützt` });
      continue;
    }
    try {
      const { size } = await stat(imgPath);
      if (size > IMAGE_WARN_BYTES) {
        warnings.push({ source: q.source, line: 0, message: `${q.id}: Bild "${q.image}" ist ${Math.round(size / 1024)} KB groß` });
      }
      if (inlineImages) {
        const data = await readFile(imgPath);
        q.image = `data:${mime};base64,${data.toString('base64')}`;
      }
    } catch {
      errors.push({ source: q.source, line: 0, message: `${q.id}: Bild "${q.image}" nicht gefunden` });
    }
  }

  return { manifest, questions, errors, warnings };
}

export function formatIssue({ source, line, message }) {
  return `  ${source}${line ? `:${line}` : ''}  ${message}`;
}
