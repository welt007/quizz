#!/usr/bin/env node
// Validates all question catalogs. Exit code 1 on errors.
// Usage: node tools/validate-catalogs.mjs [catalogs-dir]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogs, formatIssue } from './lib/load-catalogs.mjs';
import { DIFFICULTIES } from '../src/js/core/catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.resolve(process.argv[2] ?? path.join(root, 'catalogs'));

const { manifest, questions, errors, warnings } = await loadCatalogs(dir);

if (questions.length) {
  const table = {};
  for (const q of questions) {
    table[q.category] ??= { 1: 0, 2: 0, 3: 0 };
    table[q.category][q.difficulty]++;
  }
  console.log(`Katalog "${manifest?.title ?? '?'}" Version ${manifest?.version ?? '?'}: ${questions.length} Fragen\n`);
  const head = ['Kategorie'.padEnd(20), ...Object.values(DIFFICULTIES).map((d) => d.padStart(7))].join('');
  console.log(head);
  for (const [cat, counts] of Object.entries(table).sort()) {
    console.log([cat.padEnd(20), ...[1, 2, 3].map((d) => String(counts[d]).padStart(7))].join(''));
  }
  console.log();
}
if (warnings.length) console.log(`⚠ ${warnings.length} Hinweis(e):\n${warnings.map(formatIssue).join('\n')}\n`);
if (errors.length) {
  console.error(`✗ ${errors.length} Fehler:\n${errors.map(formatIssue).join('\n')}`);
  process.exit(1);
}
console.log('✓ Alle Kataloge sind gültig.');
