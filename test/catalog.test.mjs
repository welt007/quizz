import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog, validateManifest } from '../src/js/core/catalog.js';
import { prepareQuestion } from '../src/js/core/question.js';
import { createRng } from '../src/js/core/random.js';

const HEADER = 'id,category,difficulty,question,correct,wrong1,wrong2,wrong3,image,explanation,tags';

test('gültige Frage wird übernommen', () => {
  const csv = `${HEADER}\nq1,geo,2,Frage?,Ja,Nein,Vielleicht,Egal,images/x.png,Weil.,a| b |`;
  const { questions, errors } = parseCatalog(csv);
  assert.equal(errors.length, 0);
  assert.deepEqual(questions[0], {
    id: 'q1', category: 'geo', difficulty: 2, question: 'Frage?', correct: 'Ja',
    wrong: ['Nein', 'Vielleicht', 'Egal'], image: 'images/x.png', explanation: 'Weil.',
    tags: ['a', 'b'], source: 'catalog.csv',
  });
});

test('fehlende Pflichtspalte ist ein Fehler', () => {
  const { questions, errors } = parseCatalog('id,category,difficulty,question,correct,wrong1,wrong2\n');
  assert.equal(questions.length, 0);
  assert.match(errors[0].message, /wrong3/);
});

test('fehlerhafte Zeilen werden mit Zeilennummer übersprungen', () => {
  const csv = [
    HEADER,
    'ok1,geo,1,F?,a,b,c,d',
    'bad1,geo,4,F?,a,b,c,d',      // Schwierigkeit
    'bad2,geo,1,F?,a,A,c,d',      // doppelte Antwort
    'ok1,geo,1,F?,a,b,c,d',       // doppelte ID
    'bad3,geo,1,,a,b,c,d',        // leere Frage
    'bad4,geo,1,F?,a,b,c,d,,x,y,z', // zu viele Felder
  ].join('\n');
  const { questions, errors } = parseCatalog(csv, { source: 't.csv' });
  assert.deepEqual(questions.map((q) => q.id), ['ok1']);
  assert.deepEqual(errors.map((e) => e.line), [3, 4, 5, 6, 7]);
  assert.ok(errors.every((e) => e.source === 't.csv'));
});

test('unbekannte Kategorie und falsche Kodierung sind Warnungen', () => {
  const csv = `${HEADER}\nq1,xyz,1,MÃ¼nchen?,a,b,c,d`;
  const { questions, warnings } = parseCatalog(csv, { categories: { geo: {} } });
  assert.equal(questions.length, 1);
  assert.equal(warnings.length, 2);
});

test('validateManifest', () => {
  assert.deepEqual(validateManifest({ format: 1, version: '1', files: ['a.csv'] }), []);
  assert.equal(validateManifest({ format: 2, files: ['../x.csv'] }).length, 3);
});

test('prepareQuestion mischt, behält alle Antworten und findet die richtige', () => {
  const q = { correct: 'R', wrong: ['F1', 'F2', 'F3'] };
  const positions = new Set();
  const rng = createRng(42);
  for (let i = 0; i < 50; i++) {
    const p = prepareQuestion(q, rng);
    assert.equal(p.answers[p.correctIndex], 'R');
    assert.deepEqual([...p.answers].sort(), ['F1', 'F2', 'F3', 'R']);
    positions.add(p.correctIndex);
  }
  assert.equal(positions.size, 4);
});
