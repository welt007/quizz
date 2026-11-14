#!/usr/bin/env node
// Builds dist/quizshow.html: a single, self-contained, offline-capable HTML file
// containing the bundled JS, CSS, all catalogs and all images (as data URIs).
//
// Usage: node tools/build.mjs [--dev]   (--dev: no minification)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { loadCatalogs, formatIssue } from './lib/load-catalogs.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dev = process.argv.includes('--dev');
const SIZE_WARN_BYTES = 5 * 1024 * 1024;

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

// 1. catalogs
const { manifest, questions, errors, warnings } = await loadCatalogs(path.join(root, 'catalogs'), { inlineImages: true });
if (warnings.length) console.warn(`⚠ ${warnings.length} Hinweis(e) in den Katalogen:\n${warnings.map(formatIssue).join('\n')}`);
if (errors.length) {
  console.error(`✗ Build abgebrochen, ${errors.length} Fehler in den Katalogen:\n${errors.map(formatIssue).join('\n')}`);
  process.exit(1);
}
const embedded = {
  manifest,
  questions: questions.map(({ source, ...q }) => q),
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
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
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

await mkdir(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/quizshow.html');
await writeFile(out, html);

const bytes = Buffer.byteLength(html);
console.log(`✓ ${path.relative(root, out)} (${(bytes / 1024).toFixed(1)} KB, ${questions.length} Fragen, Katalog ${manifest.version})`);
if (bytes > SIZE_WARN_BYTES) console.warn(`⚠ Datei ist größer als ${SIZE_WARN_BYTES / 1024 / 1024} MB – Bilder verkleinern?`);
