import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlitzGame, multiplierFor, BLITZ_POINTS, PENALTY_SECONDS } from '../src/js/core/modes/blitz.js';
import { createSuddenDeathGame, suddenDifficulty } from '../src/js/core/modes/sudden.js';
import { createDuelGame, DUEL_POINTS, penaltyFor } from '../src/js/core/modes/duel.js';
import { insertHighscore, qualifies, cleanName } from '../src/js/core/highscores.js';
import { createRng } from '../src/js/core/random.js';

let n = 0;
const q = (difficulty) => ({ id: `z${++n}`, category: 'x', difficulty, question: `F${n}?`, correct: 'R', wrong: ['A', 'B', 'C'], tags: [] });
const many = (counts) => Object.entries(counts).flatMap(([d, c]) => Array.from({ length: c }, () => q(Number(d))));
const right = (g) => g.state.current.correctIndex;
const wrong = (g) => (g.state.current.correctIndex + 1) % 4;

// ---------- Blitzrunde ----------
test('Blitz: Multiplikator steigt alle 3 richtigen, max ×4', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 7, 10, 20].map(multiplierFor), [1, 1, 1, 2, 2, 3, 4, 4]);
});

test('Blitz: Punkte, Serie, Strafe und Neustart der Fragenliste', () => {
  const qs = many({ 2: 3 });
  const g = createBlitzGame(qs, { rng: createRng(1) });
  const s = g.state;
  for (let i = 0; i < 4; i++) {
    const r = g.answer(right(g));
    assert.equal(r.correct, true);
    g.next();
  }
  // 3×(150×1) + 150×2
  assert.equal(s.score, 3 * BLITZ_POINTS[2] + 2 * BLITZ_POINTS[2]);
  assert.equal(s.streak, 4);
  assert.equal(g.nextMultiplier(), 2);
  const r = g.answer(wrong(g));
  assert.deepEqual(r, { correct: false, points: 0, multiplier: 1, penalty: PENALTY_SECONDS });
  assert.equal(s.streak, 0);
  assert.equal(s.bestStreak, 4);
  const before = s.current.question.id;
  g.next();
  assert.notEqual(s.current.question.id, before, 'keine direkte Wiederholung');
  g.finish();
  assert.equal(s.phase, 'finished');
  assert.equal(s.answered, 5);
  assert.equal(s.correctCount, 4);
});

// ---------- Sudden Death ----------
test('Sudden Death: Schwierigkeit steigt alle 5 Fragen', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15, 40].map(suddenDifficulty), [1, 1, 2, 2, 3, 3, 4, 4]);
  const g = createSuddenDeathGame(many({ 1: 6, 2: 6, 3: 6, 4: 6 }), { rng: createRng(2) });
  const diffs = [];
  for (let i = 0; i < 17; i++) {
    diffs.push(g.state.current.question.difficulty);
    g.answer(right(g));
    g.next();
  }
  assert.deepEqual(diffs, [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4]);
  assert.equal(g.state.score, 17);
});

test('Sudden Death: erster Fehler beendet das Spiel', () => {
  const g = createSuddenDeathGame(many({ 1: 10 }));
  g.answer(right(g)); g.next();
  g.answer(right(g)); g.next();
  g.answer(wrong(g));
  assert.equal(g.state.outcome, 'lost');
  g.next();
  assert.equal(g.state.phase, 'finished');
  assert.equal(g.state.score, 2);
});

test('Sudden Death: Zeitablauf und „alle geschafft“', () => {
  const g = createSuddenDeathGame(many({ 3: 1 }), { timer: true });
  assert.equal(g.timeLimit(), 45);
  g.answer(right(g));
  g.next();
  assert.equal(g.state.outcome, 'cleared');
  assert.equal(g.state.phase, 'finished');

  const t = createSuddenDeathGame(many({ 1: 3 }), { timer: false });
  assert.equal(t.timeLimit(), null);
  t.timeUp();
  assert.equal(t.state.timedOut, true);
  assert.equal(t.state.outcome, 'lost');
});

// ---------- Duell ----------
test('Duell (Buzzer): richtig gibt Punkte, falsch kostet die Hälfte, andere dürfen nachbuzzern', () => {
  const g = createDuelGame(many({ 2: 3 }), { players: ['Ana', 'Ben', 'Cem'], rng: createRng(3) });
  const s = g.state;
  assert.equal(s.phase, 'open');
  assert.equal(g.buzz(0), true);
  assert.equal(g.buzz(1), false, 'während jemand antwortet, ist der Buzzer gesperrt');
  g.answer(wrong(g));
  assert.equal(s.players[0].score, -penaltyFor(2));
  assert.equal(s.phase, 'open');
  assert.equal(g.buzz(0), false, 'wer falsch lag, darf nicht nochmal');
  g.buzz(2);
  g.answer(right(g));
  assert.equal(s.players[2].score, DUEL_POINTS[2]);
  assert.equal(s.winner, 2);
  assert.equal(s.phase, 'reveal');
  g.next();
  assert.equal(s.round, 1);
  assert.equal(s.phase, 'open');
  assert.deepEqual(s.lockedOut, []);
});

test('Duell (Buzzer): alle falsch oder niemand buzzert → Auflösung ohne Punkte', () => {
  const g = createDuelGame(many({ 1: 2 }), { players: ['A', 'B'] });
  g.buzz(0); g.answer(wrong(g));
  g.buzz(1); g.answerTimeUp();
  assert.equal(g.state.phase, 'reveal');
  assert.equal(g.state.winner, null);
  g.next();
  g.nobodyBuzzed();
  assert.equal(g.state.phase, 'reveal');
  g.next();
  assert.equal(g.state.phase, 'finished');
});

test('Duell (reihum): Spieler wechseln sich ab, falsch ohne Abzug', () => {
  const g = createDuelGame(many({ 4: 4 }), { players: ['A', 'B', 'C'], variant: 'turns' });
  const s = g.state;
  const order = [];
  for (let i = 0; i < 4; i++) {
    assert.equal(s.phase, 'answering');
    order.push(s.active);
    g.answer(i === 1 ? wrong(g) : right(g));
    assert.equal(s.phase, 'reveal');
    g.next();
  }
  assert.deepEqual(order, [0, 1, 2, 0]);
  assert.deepEqual(s.players.map((p) => p.score), [2 * DUEL_POINTS[4], 0, DUEL_POINTS[4]]);
  const ranking = g.ranking();
  assert.deepEqual(ranking.map((p) => [p.name, p.rank]), [['A', 1], ['C', 2], ['B', 3]]);
});

test('Duell: Gleichstand teilt den Platz; Spielerzahl wird geprüft', () => {
  const g = createDuelGame(many({ 1: 2 }), { players: ['A', 'B'], variant: 'turns' });
  g.answer(right(g)); g.next();
  g.answer(right(g)); g.next();
  assert.deepEqual(g.ranking().map((p) => p.rank), [1, 1]);
  assert.throws(() => createDuelGame(many({ 1: 1 }), { players: ['Solo'] }));
  assert.throws(() => createDuelGame(many({ 1: 1 }), { players: ['1', '2', '3', '4', '5'] }));
});

// ---------- Highscores ----------
test('Highscores: Einsortieren, Platz, Limit und Gleichstand', () => {
  let list = [];
  for (const [name, score] of [['A', 100], ['B', 300], ['C', 200], ['D', 200]]) {
    ({ list } = insertHighscore(list, { name, score, date: '2026-11-15' }, 3));
  }
  assert.deepEqual(list.map((e) => e.name), ['B', 'C', 'D']);
  assert.equal(qualifies(list, 200, 3), false);
  assert.equal(qualifies(list, 201, 3), true);
  assert.equal(qualifies([], 0), false);
  const res = insertHighscore(list, { name: 'E', score: 250, date: 'x' }, 3);
  assert.equal(res.rank, 2);
  assert.equal(insertHighscore(list, { name: 'F', score: 1, date: 'x' }, 3).rank, 0);
});

test('Highscores: Namen werden bereinigt', () => {
  assert.equal(cleanName('  Max   Mustermann  '), 'Max Mustermann');
  assert.equal(cleanName(''), 'Anonym');
  assert.equal(cleanName('x'.repeat(50)).length, 20);
});
