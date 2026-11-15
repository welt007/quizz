import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogDisplayName, hashString, compareVersions, sourceFromResult, builtinFromEmbedded,
  setCatalogsEnabled, mergePool, summarizeResult, BUILTIN_ID,
} from '../src/js/core/library.js';
import { loadFromUrl, loadFromFiles, LoaderError } from '../src/js/data/loader.js';
import { SourceUrlError } from '../src/js/core/sources.js';

const HEADER = 'id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image,explanation,tags';
const q = (id, category, extra = {}) => ({ id, category, difficulty: 1, question: `${id}?`, correct: 'R', wrong: ['A', 'B', 'C'], tags: [], ...extra });

// ---------- library (pure) ----------
test('Hilfsfunktionen', () => {
  assert.equal(catalogDisplayName('welt-geschichte_2.csv'), 'Welt geschichte 2');
  assert.equal(catalogDisplayName('sport/fu%C3%9Fball.csv'), 'Fußball');
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('abc'), hashString('abd'));
  assert.ok(compareVersions('2026-11-14.10', '2026-11-14.9') > 0);
  assert.ok(compareVersions('2026-11-14.2', '2026-11-15.1') < 0);
  assert.equal(compareVersions('1', '1'), 0);
});

const embedded = {
  manifest: { title: 'Standard', version: '1', categories: { geo: { name: 'Geographie', icon: '🌍' } }, updateUrl: 'a/b' },
  files: [
    { file: 'geo.csv', questions: [q('g1', 'geo'), q('g2', 'geo')] },
    { file: 'mix.csv', questions: [q('m1', 'geo'), q('m2', 'sport')] },
  ],
};

test('Eingebetteter Standardkatalog: eine Quelle, ein Katalog pro CSV', () => {
  const { source, data } = builtinFromEmbedded(embedded);
  assert.equal(source.id, BUILTIN_ID);
  assert.equal(source.updateUrl, 'a/b');
  assert.deepEqual(source.catalogs.map((c) => [c.id, c.name, c.count, c.enabled]), [
    ['builtin/geo.csv', 'Geo', 2, true],
    ['builtin/mix.csv', 'Mix', 2, true],
  ]);
  assert.equal(data.get('builtin/mix.csv').length, 2);
});

test('mergePool vereint mehrere CSVs/Quellen zu einem Pool und respektiert deaktivierte Kataloge', () => {
  const builtin = builtinFromEmbedded(embedded);
  const extra = sourceFromResult(
    { name: 'Sport', version: 'x', categories: { sport: { name: 'Sport', icon: '⚽' }, geo: { name: 'Erdkunde' } },
      catalogs: [{ file: 'fussball.csv', questions: [q('g1', 'sport'), q('f2', 'sport')] }] },
    { id: 'url-1', kind: 'url', url: 'https://x/fussball.csv' },
  );
  let sources = [builtin.source, extra.source];
  const data = new Map([...builtin.data, ...extra.data]);

  let pool = mergePool(sources, data);
  assert.equal(pool.questions.length, 6);
  assert.equal(pool.activeCatalogs, 3);
  assert.deepEqual(pool.questions.map((x) => x.id), ['g1', 'g2', 'm1', 'm2', 'url-1:g1', 'url-1:f2'], 'gleiche IDs aus verschiedenen Quellen kollidieren nicht');
  assert.equal(pool.categories.geo.name, 'Geographie', 'erste Quelle gewinnt');
  assert.equal(pool.categories.sport.name, 'Sport', 'Kategorie-Infos aus späterer Quelle, wenn vorher keine');
  assert.equal(pool.questions[4].catalogId, 'url-1/fussball.csv');
  assert.equal(pool.questions[4].originalId, 'g1');

  sources = setCatalogsEnabled(sources, 'builtin/mix.csv', false);
  pool = mergePool(sources, data);
  assert.deepEqual(pool.questions.map((x) => x.id), ['g1', 'g2', 'url-1:g1', 'url-1:f2']);
  assert.equal(pool.activeCatalogs, 2);
  assert.equal(pool.totalCatalogs, 3);

  sources = setCatalogsEnabled(sources, (id, s) => s.id === BUILTIN_ID, false);
  assert.equal(mergePool(sources, data).questions.length, 2);
  sources = setCatalogsEnabled(sources, (id, s) => s.id === BUILTIN_ID, true);
  assert.equal(mergePool(sources, data).questions.length, 6, 'wieder aktiviert');
});

test('Katalog ohne Daten (z. B. Speicher nicht verfügbar) wird übersprungen', () => {
  const { source } = builtinFromEmbedded(embedded);
  const pool = mergePool([source], new Map([['builtin/geo.csv', embedded.files[0].questions]]));
  assert.equal(pool.questions.length, 2);
  assert.equal(pool.activeCatalogs, 1);
});

test('Aktualisierung behält An/Aus je Datei, neue Dateien sind an, entfernte verschwinden', () => {
  const first = sourceFromResult(
    { name: 'S', version: '1', catalogs: [{ file: 'a.csv', questions: [q('a', 'x')] }, { file: 'b.csv', questions: [q('b', 'x')] }] },
    { id: 'u', kind: 'url', now: 'T1' },
  ).source;
  const disabled = setCatalogsEnabled([first], 'u/b.csv', false)[0];
  const { source } = sourceFromResult(
    { name: 'S', version: '2', catalogs: [{ file: 'b.csv', questions: [q('b', 'x')] }, { file: 'c.csv', questions: [q('c', 'x')] }] },
    { id: 'u', kind: 'url', now: 'T2', previous: disabled },
  );
  assert.deepEqual(source.catalogs.map((c) => [c.file, c.enabled]), [['b.csv', false], ['c.csv', true]]);
  assert.equal(source.addedAt, 'T1');
  assert.equal(source.updatedAt, 'T2');
  assert.equal(source.version, '2');
});

// ---------- loader with a fake server ----------
function fakeServer(files) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (!(url in files)) return new Response('not found', { status: 404 });
    const body = files[url];
    if (body instanceof Error) throw body;
    const type = url.endsWith('.png') ? 'image/png' : url.endsWith('.svg') ? 'text/plain' : 'text/plain';
    return new Response(body, { status: 200, headers: { 'content-type': type } });
  };
  return { fetchImpl, calls };
}

const RAW = 'https://raw.githubusercontent.com/o/r/HEAD/catalogs/';

test('loadFromUrl: Manifest mit mehreren CSVs, Bilder werden eingebettet, Fehler gemeldet', async () => {
  const { fetchImpl } = fakeServer({
    [`${RAW}index.json`]: JSON.stringify({ format: 1, version: '7', title: 'Sport & Film', files: ['sport.csv', 'film.csv', 'fehlt.csv'], categories: { sport: { name: 'Sport' } } }),
    [`${RAW}sport.csv`]: `${HEADER}\ns1,sport,1,Ball?,rund,eckig,flach,spitz,img/ball.svg,,\ns2,sport,2,Tor?,ja,nein,vielleicht,egal,img/weg.png,,\ns3,sport,9,kaputt?,a,b,c,d,,,`,
    [`${RAW}film.csv`]: `${HEADER}\ns1,film,1,Doppelt?,a,b,c,d,,,\nf1,film,3,Film?,a,b,c,d,,,`,
    [`${RAW}img/ball.svg`]: '<svg xmlns="http://www.w3.org/2000/svg"/>',
  });
  const steps = [];
  const res = await loadFromUrl('o/r', { fetchImpl, onProgress: (t) => steps.push(t) });
  assert.equal(res.name, 'Sport & Film');
  assert.equal(res.version, '7');
  assert.equal(res.resolvedUrl, `${RAW}index.json`);
  assert.deepEqual(res.catalogs.map((c) => [c.file, c.questions.length]), [['sport.csv', 1], ['film.csv', 1], ['fehlt.csv', 0]]);
  assert.match(res.catalogs[0].questions[0].image, /^data:image\/svg\+xml;base64,/, 'SVG trotz text/plain erkannt');
  const msgs = res.catalogs.flatMap((c) => c.errors.map((e) => e.message)).join(' | ');
  assert.match(msgs, /s2: Bild nicht ladbar/);
  assert.match(msgs, /Schwierigkeit "9"/);
  assert.match(msgs, /ID "s1" kommt bereits in sport.csv vor/);
  assert.match(msgs, /HTTP 404/);
  assert.ok(steps.some((t) => /film\.csv/.test(t)));
  const sum = summarizeResult(res);
  assert.deepEqual([sum.questions, sum.catalogs, sum.categories], [2, 3, 2]);
});

test('loadFromUrl: einzelne CSV-Datei, Version = Inhalts-Hash', async () => {
  const url = 'https://example.org/quiz/mein-quiz.csv';
  const csv = `${HEADER}\nx1,film,1,F?,a,b,c,d,,,`;
  const { fetchImpl } = fakeServer({ [url]: csv });
  const res = await loadFromUrl(url, { fetchImpl });
  assert.equal(res.name, 'Mein quiz');
  assert.equal(res.version, hashString(csv));
  assert.equal(res.catalogs.length, 1);
});

test('loadFromUrl: verständliche Fehler', async () => {
  await assert.rejects(loadFromUrl('kein url'), SourceUrlError);
  const { fetchImpl } = fakeServer({ 'https://x.org/k/index.json': '{kaputt' });
  await assert.rejects(loadFromUrl('https://x.org/k/', { fetchImpl }), /kein gültiges JSON/);
  await assert.rejects(loadFromUrl('https://x.org/nix.csv', { fetchImpl }), /HTTP 404.*nicht gefunden/);
  const offline = fakeServer({ 'https://x.org/a.csv': new TypeError('Failed to fetch') });
  await assert.rejects(loadFromUrl('https://x.org/a.csv', { fetchImpl: offline.fetchImpl }), /CORS/);
  const empty = fakeServer({ 'https://x.org/b.csv': `${HEADER}\nb1,x,7,F?,a,b,c,d,,,` });
  await assert.rejects(loadFromUrl('https://x.org/b.csv', { fetchImpl: empty.fetchImpl }), LoaderError);
});

test('loadFromFiles: mehrere lokale CSVs, relative Bilder werden übersprungen', async () => {
  const { fetchImpl } = fakeServer({ 'https://cdn.example.org/a.png': new Uint8Array([137, 80, 78, 71]) });
  const res = await loadFromFiles(
    [
      { name: 'eins.csv', text: `${HEADER}\ne1,x,1,F?,a,b,c,d,https://cdn.example.org/a.png,,\ne2,x,1,G?,a,b,c,d,bilder/lokal.png,,` },
      { name: 'zwei.csv', text: `id;category;difficulty;question;correct;wrong1;wrong2;wrong3\nz1;y;2;H?;a;b;c;d` },
    ],
    { fetchImpl },
  );
  assert.equal(res.name, 'Import (2 Dateien)');
  assert.deepEqual(res.catalogs.map((c) => c.questions.map((x) => x.id)), [['e1'], ['z1']]);
  assert.match(res.catalogs[0].questions[0].image, /^data:image\/png;base64,iVBORw==$/);
  assert.match(res.catalogs[0].errors[0].message, /relativer Bildpfad/);
});
