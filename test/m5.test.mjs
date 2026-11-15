import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeStats } from '../src/js/core/statistics.js';

const q = (id, category, difficulty) => ({ id, category, difficulty, question: `${id}?`, correct: 'R', wrong: ['A', 'B', 'C'] });

test('Statistik: gesamt, je Kategorie, je Schwierigkeit, Abdeckung', () => {
  const pool = [q('a', 'geo', 1), q('b', 'geo', 2), q('c', 'film', 4), q('d', 'film', 4)];
  const stats = {
    a: { a: 4, c: 3, t: 100 },
    c: { a: 2, c: 0, t: 300 },
    gone: { a: 9, c: 9, t: 999 }, // question no longer in the pool → ignored
  };
  const s = summarizeStats(pool, stats);
  assert.deepEqual(
    { asked: s.overall.asked, correct: s.overall.correct, seen: s.overall.seen, total: s.overall.total },
    { asked: 6, correct: 3, seen: 2, total: 4 },
  );
  assert.equal(s.overall.rate, 0.5);
  assert.equal(s.overall.coverage, 0.5);
  assert.equal(s.byCategory.geo.rate, 0.75);
  assert.equal(s.byCategory.film.rate, 0);
  assert.equal(s.byCategory.film.coverage, 0.5);
  assert.equal(s.byDifficulty[2].rate, null, 'nie gestellt → keine Quote');
  assert.equal(s.byDifficulty[2].total, 1);
  assert.equal(s.byDifficulty[4].asked, 2);
  assert.equal(s.lastPlayed, 300);
});

test('Statistik: Knackpunkte nach Anzahl Fehler, dann Quote', () => {
  const pool = ['x', 'y', 'z', 'w'].map((id) => q(id, 'k', 1));
  const stats = { x: { a: 5, c: 4, t: 1 }, y: { a: 3, c: 0, t: 1 }, z: { a: 6, c: 3, t: 1 }, w: { a: 2, c: 2, t: 1 } };
  const s = summarizeStats(pool, stats, { limit: 2 });
  assert.deepEqual(s.troublemakers.map((t) => [t.question.id, t.wrong]), [['y', 3], ['z', 3]]);
});

test('Statistik: leer ohne gespielte Fragen', () => {
  const s = summarizeStats([q('a', 'geo', 1)], {});
  assert.equal(s.overall.rate, null);
  assert.equal(s.overall.seen, 0);
  assert.deepEqual(s.troublemakers, []);
  assert.equal(s.lastPlayed, 0);
});
