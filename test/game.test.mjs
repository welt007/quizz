import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterQuestions, orderByFreshness, difficultyPreference, buildLadder, countByDifficulty,
} from '../src/js/core/questionPool.js';
import { LADDER, LADDER_PLAN, createLadderGame, securedPoints, bankedPoints } from '../src/js/core/modes/ladder.js';
import { createTrainingGame } from '../src/js/core/modes/training.js';
import { recordAnswer } from '../src/js/core/stats.js';
import { createRng } from '../src/js/core/random.js';

let n = 0;
const q = (difficulty, category = 'geo') => ({
  id: `q${++n}`, category, difficulty, question: `Frage ${n}?`, correct: 'R', wrong: ['F1', 'F2', 'F3'], tags: [],
});
const many = (counts, category) => Object.entries(counts).flatMap(([d, c]) => Array.from({ length: c }, () => q(Number(d), category)));
const wrongIndex = (game) => (game.state.current.correctIndex + 1) % 4;

test('filterQuestions: Kategorien und Schwierigkeiten, leer = alle', () => {
  const qs = [q(1, 'a'), q(2, 'a'), q(3, 'b'), q(4, 'c')];
  assert.equal(filterQuestions(qs).length, 4);
  assert.equal(filterQuestions(qs, { categories: ['a', 'c'] }).length, 3);
  assert.equal(filterQuestions(qs, { categories: ['a'], difficulties: [2, 3] }).length, 1);
  assert.deepEqual(countByDifficulty(qs), { 1: 1, 2: 1, 3: 1, 4: 1 });
});

test('orderByFreshness: nie gestellte zuerst, dann am längsten nicht gestellte', () => {
  const [a, b, c, d] = [q(1), q(1), q(1), q(1)];
  const stats = { [a.id]: { t: 300 }, [b.id]: { t: 100 } };
  const ordered = orderByFreshness([a, b, c, d], stats, createRng(1));
  assert.deepEqual(new Set(ordered.slice(0, 2).map((x) => x.id)), new Set([c.id, d.id]));
  assert.deepEqual(ordered.slice(2).map((x) => x.id), [b.id, a.id]);
});

test('difficultyPreference: nächste Stufe zuerst, leichter vor schwerer', () => {
  assert.deepEqual(difficultyPreference(1), [1, 2, 3, 4]);
  assert.deepEqual(difficultyPreference(3), [3, 2, 4, 1]);
  assert.deepEqual(difficultyPreference(4), [4, 3, 2, 1]);
});

test('buildLadder: genug Fragen → exakt nach Plan, ohne Doppelte', () => {
  const pool = many({ 1: 10, 2: 10, 3: 10, 4: 10 });
  const res = buildLadder(pool, LADDER_PLAN, { rng: createRng(7) });
  assert.ok(res.ok);
  assert.equal(res.substitutions, 0);
  assert.deepEqual(res.questions.map((x) => x.difficulty), LADDER_PLAN);
  assert.equal(new Set(res.questions.map((x) => x.id)).size, 15);
});

test('buildLadder: Engpass → Nachbarstufe, Schwierigkeit fällt nie', () => {
  const pool = many({ 1: 3, 2: 3, 3: 3, 4: 6 }); // wie eine einzelne Beispielkategorie + Extras
  const res = buildLadder(pool, LADDER_PLAN, { rng: createRng(3) });
  assert.ok(res.ok);
  assert.equal(res.substitutions, 3);
  const diffs = res.questions.map((x) => x.difficulty);
  assert.deepEqual(diffs, [...diffs].sort());
});

test('buildLadder: weniger als 15 Fragen → nicht spielbar', () => {
  assert.equal(buildLadder(many({ 1: 14 }), LADDER_PLAN).ok, false);
});

test('Punkteleiter: Sicherheitsstufen und Ausstieg', () => {
  assert.equal(LADDER.length, 15);
  assert.equal(securedPoints(0), 0);
  assert.equal(securedPoints(4), 0); // Frage 5 falsch: Stufe 5 noch nicht erreicht
  assert.equal(securedPoints(5), LADDER[4].points);
  assert.equal(securedPoints(14), LADDER[9].points);
  assert.equal(bankedPoints(0), 0);
  assert.equal(bankedPoints(7), LADDER[6].points);
  for (let i = 1; i < LADDER.length; i++) assert.ok(LADDER[i].points > LADDER[i - 1].points);
});

test('Punkteleiter: alles richtig → Hauptgewinn', () => {
  const game = createLadderGame(many({ 1: 4, 2: 4, 3: 4, 4: 3 }), { rng: createRng(5) });
  for (let i = 0; i < 15; i++) {
    assert.equal(game.state.phase, 'question');
    assert.equal(game.state.level, i);
    game.answer(game.state.current.correctIndex);
    assert.equal(game.state.points, LADDER[i].points);
    game.next();
  }
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.outcome, 'won');
  assert.equal(game.state.points, LADDER[14].points);
});

test('Punkteleiter: Fehler bei Frage 8 → zurück auf Sicherheitsstufe 1', () => {
  const game = createLadderGame(many({ 1: 4, 2: 4, 3: 4, 4: 3 }), { rng: createRng(6) });
  for (let i = 0; i < 7; i++) game.answer(game.state.current.correctIndex), game.next();
  game.answer(wrongIndex(game));
  assert.equal(game.state.phase, 'reveal');
  assert.equal(game.state.correct, false);
  assert.equal(game.state.points, LADDER[4].points);
  game.answer(0); // ignoriert
  game.next();
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.outcome, 'lost');
});

test('Punkteleiter: Aussteigen sichert den aktuellen Stand', () => {
  const game = createLadderGame(many({ 1: 4, 2: 4, 3: 4, 4: 3 }), { rng: createRng(8) });
  for (let i = 0; i < 3; i++) game.answer(game.state.current.correctIndex), game.next();
  game.walkAway();
  assert.equal(game.state.outcome, 'walked');
  assert.equal(game.state.points, LADDER[2].points);
});

test('Training: zählt richtig/falsch und merkt sich falsche Fragen', () => {
  const qs = many({ 1: 3 });
  const game = createTrainingGame(qs, { rng: createRng(2) });
  game.answer(game.state.current.correctIndex); game.next();
  game.answer(wrongIndex(game)); game.next();
  game.answer(game.state.current.correctIndex);
  assert.equal(game.state.phase, 'reveal');
  game.next();
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.correctCount, 2);
  assert.equal(game.state.answered, 3);
  assert.deepEqual(game.state.wrong.map((x) => x.id), [qs[1].id]);
});

test('Training: vorzeitig beenden', () => {
  const game = createTrainingGame(many({ 2: 5 }));
  game.answer(0);
  game.finish();
  assert.equal(game.state.phase, 'finished');
  assert.equal(game.state.answered, 1);
});

test('recordAnswer', () => {
  let s = recordAnswer({}, 'x', true, 10);
  s = recordAnswer(s, 'x', false, 20);
  assert.deepEqual(s, { x: { a: 2, c: 1, t: 20 } });
});
