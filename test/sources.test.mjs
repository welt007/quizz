import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSourceUrl, resolveSourcePath, SourceUrlError } from '../src/js/core/sources.js';

const RAW = 'https://raw.githubusercontent.com';

test('GitHub-Kurzform und Repo-URL zeigen auf catalogs/index.json', () => {
  for (const input of ['welt007/quizz', 'https://github.com/welt007/quizz', 'https://github.com/welt007/quizz.git', ' https://github.com/welt007/quizz/ ']) {
    assert.deepEqual(normalizeSourceUrl(input), {
      kind: 'manifest',
      url: `${RAW}/welt007/quizz/HEAD/catalogs/index.json`,
      baseUrl: `${RAW}/welt007/quizz/HEAD/catalogs/`,
    }, input);
  }
});

test('GitHub tree- und blob-Links', () => {
  assert.equal(normalizeSourceUrl('https://github.com/a/b/tree/main/fragen/sport').url, `${RAW}/a/b/main/fragen/sport/index.json`);
  assert.equal(normalizeSourceUrl('https://github.com/a/b/tree/dev').url, `${RAW}/a/b/dev/index.json`);
  const csv = normalizeSourceUrl('https://github.com/a/b/blob/main/x/sport.csv');
  assert.equal(csv.kind, 'csv');
  assert.equal(csv.url, `${RAW}/a/b/main/x/sport.csv`);
  assert.equal(csv.baseUrl, `${RAW}/a/b/main/x/`);
});

test('beliebige https-URLs auf Manifest, CSV oder Ordner', () => {
  assert.equal(normalizeSourceUrl('https://example.org/quiz/index.json').kind, 'manifest');
  assert.equal(normalizeSourceUrl('https://example.org/quiz/film.csv?v=2#x').url, 'https://example.org/quiz/film.csv?v=2');
  assert.equal(normalizeSourceUrl('https://example.org/quiz/').url, 'https://example.org/quiz/index.json');
  assert.equal(normalizeSourceUrl('http://localhost:8080/k.csv').kind, 'csv');
});

test('ungültige Eingaben werden mit verständlicher Meldung abgelehnt', () => {
  for (const bad of ['', 'kein url', 'http://example.org/a.csv', 'ftp://x/a.csv', 'https://example.org/seite.html', 'https://github.com/a/b/issues']) {
    assert.throws(() => normalizeSourceUrl(bad), SourceUrlError, bad);
  }
});

test('relative Pfade werden gegen die Basis aufgelöst', () => {
  const base = `${RAW}/a/b/main/catalogs/`;
  assert.equal(resolveSourcePath('sport.csv', base), `${base}sport.csv`);
  assert.equal(resolveSourcePath('images/x.png', base), `${base}images/x.png`);
  assert.equal(resolveSourcePath('https://cdn.example.org/y.png', base), 'https://cdn.example.org/y.png');
  assert.equal(resolveSourcePath('data:image/png;base64,AA', base), 'data:image/png;base64,AA');
});
