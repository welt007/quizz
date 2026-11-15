#!/usr/bin/env node
// Builds dist/quizshow.html: a single, self-contained, offline-capable HTML file
// containing the bundled JS, CSS, all catalogs and all images (as data URIs).
//
// The output is reproducible (no timestamps) and committed to the repo, so the
// game can be downloaded directly from GitHub.
//
// --android builds the web part of the Android app instead
// (android/app/src/main/assets/www/, not committed): same game, but images are
// copied as separate files – smaller HTML, faster start in the WebView.
//
// Usage: node tools/build.mjs [--dev] [--android]   (--dev: no minification)
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { loadCatalogs, formatIssue } from './lib/load-catalogs.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dev = process.argv.includes('--dev');
const android = process.argv.includes('--android');
const outDir = android ? path.join(root, 'android/app/src/main/assets/www') : path.join(root, 'dist');
const SIZE_WARN_BYTES = 5 * 1024 * 1024;

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

// 1. catalogs
const { manifest, questions, errors, warnings } = await loadCatalogs(path.join(root, 'catalogs'), { inlineImages: !android });
if (warnings.length) console.warn(`⚠ ${warnings.length} Hinweis(e) in den Katalogen:\n${warnings.map(formatIssue).join('\n')}`);
if (errors.length) {
  console.error(`✗ Build abgebrochen, ${errors.length} Fehler in den Katalogen:\n${errors.map(formatIssue).join('\n')}`);
  process.exit(1);
}
// one entry per CSV file, so each file can be switched on/off in the game
const embedded = {
  manifest,
  files: manifest.files.map((file) => ({
    file,
    questions: questions.filter((q) => q.source === file).map(({ source, ...q }) => q),
  })),
};

// 2. JS + CSS
const common = { bundle: true, write: false, minify: !dev, legalComments: 'none', logLevel: 'warning' };
const js = await esbuild.build({
  ...common,
  entryPoints: [path.join(root, 'src/js/main.js')],
  format: 'iife',
  target: ['es2020'],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_PLATFORM__: JSON.stringify(android ? 'android' : 'web'),
  },
});
const css = await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/styles/main.css')] });

// 3. assemble
// Everything is inlined into <script>/<style>; "</" must never appear literally inside.
const safeScript = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const template = await readFile(path.join(root, 'src/index.html'), 'utf8');
const replacements = {
  '<!-- @CSS -->': `<style>\n${css.outputFiles[0].text}</style>`,
  '<!-- @CATALOGS -->': `<script type="application/json" id="embedded-catalogs">${safeJson(embedded)}</script>`,
  '<!-- @JS -->': `<script>\n${safeScript(js.outputFiles[0].text)}</script>`,
};
let html = template;
for (const [marker, value] of Object.entries(replacements)) {
  if (!html.includes(marker)) throw new Error(`Platzhalter ${marker} fehlt in src/index.html`);
  html = html.replace(marker, () => value);
}

if (android) await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, android ? 'index.html' : 'quizshow.html');
await writeFile(out, html);
if (android) {
  // relative image paths (checked by loadCatalogs) → same path next to index.html
  const images = new Set(questions.map((q) => q.image).filter((img) => img && !/^(https?:|data:)/i.test(img)));
  for (const img of images) {
    const target = path.join(outDir, img);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(root, 'catalogs', img), target);
  }
  console.log(`✓ ${images.size} Bilder nach ${path.relative(root, outDir)}/ kopiert`);
}

const bytes = Buffer.byteLength(html);
console.log(`✓ ${path.relative(root, out)} (${(bytes / 1024).toFixed(1)} KB, ${questions.length} Fragen, Katalog ${manifest.version})`);
if (bytes > SIZE_WARN_BYTES) console.warn(`⚠ Datei ist größer als ${SIZE_WARN_BYTES / 1024 / 1024} MB – Bilder verkleinern?`);
