import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanColor, cleanCategoryMeta, cleanCategories, isSafeImage, cleanQuestion, cleanQuestions,
  cleanStats, cleanHighscores, cleanSettings, cleanText,
} from '../src/js/core/sanitize.js';
import { insertHighscore, qualifies } from '../src/js/core/highscores.js';
import { summarizeStats } from '../src/js/core/statistics.js';
import { orderByFreshness } from '../src/js/core/questionPool.js';
import { recordAnswer } from '../src/js/core/stats.js';
import { createJourneyGame, JOURNEY_STEPS } from '../src/js/core/modes/journey.js';
import { normalizeSourceUrl } from '../src/js/core/sources.js';
import { loadFromUrl } from '../src/js/data/loader.js';

test('Farben: nur echte CSS-Farben kommen in eine Custom Property', () => {
  for (const ok of ['#abc', '#aabbcc', '#aabbccdd', 'rgb(1, 2, 3)', 'hsl(120 50% 50% / 0.5)', 'tomato', 'oklch(60% 0.1 200)']) {
    assert.equal(cleanColor(ok), ok, ok);
  }
  for (const bad of ['red; background: url(x)', 'url(x)', 'var(--y)', '#12', '#12345', 'expression(1)', 'a'.repeat(50), 12, null, '']) {
    assert.equal(cleanColor(bad), undefined, String(bad));
  }
});

test('Kategorie-Metadaten: Typen erzwungen, Längen begrenzt, Fremdes fällt weg', () => {
  assert.deepEqual(cleanCategoryMeta({ name: '  Geo  grafie ', icon: '🌍', color: '#123456', evil: 1 }), { name: 'Geo grafie', icon: '🌍', color: '#123456' });
  assert.deepEqual(cleanCategoryMeta({ name: 1, icon: {}, color: ['a'] }), undefined);
  assert.equal(cleanCategoryMeta({ icon: '🙂'.repeat(50) }).icon.length, 8);
  assert.equal(cleanCategoryMeta({ name: 'x'.repeat(200) }).name.length, 60);
  assert.deepEqual(cleanCategories({ 'ok-id': { name: 'A' }, 'bad id!': { name: 'B' }, '': { name: 'C' } }), { 'ok-id': { name: 'A' } });
  assert.deepEqual(cleanCategories('nope'), {});
  assert.equal(cleanText('  a \n b ', 3), 'a b');
});

test('Bildadressen: nur https, data:image oder relative Pfade', () => {
  for (const ok of ['https://x.example/a.png', 'images/a.svg', './a.jpg', 'data:image/png;base64,AAAA', 'http://localhost:8080/a.png']) {
    assert.ok(isSafeImage(ok), ok);
  }
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:x', 'file:///etc/passwd', 'blob:https://x/y', '//evil.example/a.png', 'data:text/html;base64,AAAA', 'data:image/svg+xml,<svg onload=alert(1)>', 'http://evil.example/a.png', '', 5]) {
    assert.ok(!isSafeImage(bad), String(bad));
  }
});

test('Fragen aus dem Speicher: kaputte Zeilen fallen weg, Felder sind Strings', () => {
  const good = { id: 'a', category: 'x', difficulty: '2', question: 'Q?', correct: 'R', wrong: ['A', 'B', 'C'], image: 'javascript:x', explanation: 7, tags: ['t', 3] };
  const c = cleanQuestion(good);
  assert.deepEqual(c, { id: 'a', category: 'x', difficulty: 2, question: 'Q?', correct: 'R', wrong: ['A', 'B', 'C'], tags: ['t'] });
  assert.equal(cleanQuestion({ ...good, wrong: ['A', 'B'] }), null);
  assert.equal(cleanQuestion({ ...good, difficulty: 7 }), null);
  assert.equal(cleanQuestion({ ...good, question: '' }), null);
  assert.equal(cleanQuestion('str'), null);
  assert.deepEqual(cleanQuestions([good, null, 1, { id: 'b' }]).map((q) => q.id), ['a']);
  assert.deepEqual(cleanQuestions('nope'), []);
});

test('Statistik, Bestenlisten und Einstellungen aus kaputtem Speicher', () => {
  assert.deepEqual(cleanStats({ a: { a: 3, c: 2, t: 5 }, b: { a: '5', c: '9' }, c: null, d: 'x', e: { a: -1, c: 0 } }), { a: { a: 3, c: 2, t: 5 } });
  assert.deepEqual(cleanStats(null), {});
  assert.deepEqual(cleanStats([1, 2]), {});
  const hs = cleanHighscores({ ladder: [{ name: 'a', score: '5', date: '2026-01-01' }, { score: NaN }, 'x'], blitz: 'nope', sudden: null });
  assert.deepEqual(hs, { ladder: [{ name: 'a', score: 5, date: '2026-01-01' }] });
  assert.deepEqual(cleanSettings('str'), {});
  assert.deepEqual(cleanSettings([1]), {});
  assert.deepEqual(cleanSettings({ sound: false }), { sound: false });
  // the consumers survive odd shapes on their own, too
  assert.equal(insertHighscore('corrupt', { name: 'b', score: 10 }).rank, 1);
  assert.equal(insertHighscore([{ name: 'a', score: 5 }], { name: 'b', score: '10' }).list[0].score, 10);
  assert.equal(qualifies(null, 5), true);
  assert.equal(qualifies([], NaN), false);
  const qs = [{ id: 'a', category: 'x', difficulty: 1 }];
  assert.equal(summarizeStats(qs, null).overall.asked, 0);
  assert.equal(summarizeStats(qs, { a: 'x' }).overall.asked, 0);
  assert.equal(orderByFreshness(qs, null).length, 1);
  assert.equal(recordAnswer(null, 'a', true).a.a, 1);
  assert.equal(recordAnswer({ a: 'junk' }, 'a', true).a.a, 1);
});

test('Journey: gespeicherter Stand wird geprüft', () => {
  const q = (c, d, i) => ({ id: `${c}${d}${i}`, category: c, difficulty: d, question: '?', correct: 'R', wrong: ['A', 'B', 'C'] });
  const pool = ['a', 'b'].flatMap((c) => [1, 2, 3, 4].flatMap((d) => Array.from({ length: 12 }, (_, i) => q(c, d, i))));
  const g = createJourneyGame(pool, { resume: { step: 999, jokers: { fifty: -3, switch: 'x', shield: 2.5, bogus: 5 }, totalCorrect: '7' } });
  assert.equal(g.state.step, JOURNEY_STEPS - 1);
  assert.deepEqual(g.state.jokers, { switch: 0, shield: 0, fifty: 0 });
  assert.equal(g.state.totalCorrect, 0);
  assert.equal(createJourneyGame(pool, { resume: { step: -5, jokers: { fifty: 99 } } }).state.jokers.fifty, 9);
  assert.equal(createJourneyGame(pool, { resume: 'junk' }).state.step, 0);
});

test('Quellen-URLs mit Zugangsdaten werden abgelehnt', () => {
  assert.throws(() => normalizeSourceUrl('https://user:pw@example.com/x.csv'), /Benutzername/);
  assert.throws(() => normalizeSourceUrl('https://user@example.com/x.csv'), /Benutzername/);
});

test('Loader: feindliche Manifest-Daten werden bereinigt, gefährliche Bilder übersprungen', async () => {
  const HEADER = 'id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image';
  const files = {
    'https://x.example/c/index.json': JSON.stringify({
      format: 1,
      version: '1',
      title: '  Evil <b>Pack</b> '.padEnd(200, 'x'),
      attribution: 'x'.repeat(1000),
      files: ['a.csv'],
      categories: { x: { name: 'X', color: 'red; background: url(evil)', icon: '🙂'.repeat(40) }, 'bad id': { name: 'B' } },
    }),
    'https://x.example/c/a.csv': `${HEADER}\nq1,x,1,Q?,R,A,B,C,javascript:alert(1)\nq2,x,1,Q2?,R,A,B,C,\nq3,x,1,Q3?,R,A,B,C,data:text/html;base64,AAAA\n`,
  };
  const fetchImpl = async (url) => (url in files ? new Response(files[url], { status: 200, headers: { 'content-type': 'text/plain' } }) : new Response('', { status: 404 }));
  const r = await loadFromUrl('https://x.example/c/index.json', { fetchImpl });
  assert.equal(r.name.length, 80);
  assert.equal(r.attribution.length, 600);
  assert.equal(r.updateUrl, undefined);
  assert.deepEqual(Object.keys(r.categories), ['x']);
  assert.equal(r.categories.x.color, undefined);
  assert.equal(r.categories.x.icon.length, 8);
  assert.deepEqual(r.catalogs[0].questions.map((q) => q.id), ['q2']);
  assert.equal(r.catalogs[0].errors.length, 2);
});
