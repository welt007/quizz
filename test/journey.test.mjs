import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourneyGame, journeyDifficulty, stepLength, isMilestone, JOURNEY_STEPS, JOURNEY_QUESTIONS,
} from '../src/js/core/modes/journey.js';
import { createRng } from '../src/js/core/random.js';

let n = 0;
const q = (category, difficulty) => ({ id: `j${++n}`, category, difficulty, question: `F${n}?`, correct: 'R', wrong: ['A', 'B', 'C'], tags: [] });
/** `per` questions per difficulty in each category */
const pool = (cats, per = 30) => cats.flatMap((c) => [1, 2, 3, 4].flatMap((d) => Array.from({ length: per }, () => q(c, d))));
const right = (g) => g.state.current.correctIndex;
const wrong = (g) => (g.state.current.correctIndex + 1) % 4;

function playStage(g, { mistakeAt = -1 } = {}) {
  const s = g.state;
  const category = s.category;
  for (let i = 0; i < s.length; i++) {
    assert.equal(s.phase, 'question');
    assert.equal(s.current.question.category, s.category, 'alle Fragen einer Etappe aus einer Kategorie');
    g.answer(i === mistakeAt ? wrong(g) : right(g));
    g.next();
  }
  return category;
}

test('Journey: Etappenlänge, Etappenziele und Schwierigkeit', () => {
  assert.deepEqual([0, 3, 4, 5, 9, 14].map(stepLength), [5, 5, 10, 5, 10, 10]);
  assert.deepEqual([4, 9, 14].map(isMilestone), [true, true, true]);
  assert.deepEqual([0, 3, 4, 7, 8, 11, 12, 14].map(journeyDifficulty), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(JOURNEY_QUESTIONS, 12 * 5 + 3 * 10);
});

test('Journey: Etappe nur mit lauter richtigen Antworten, Kategorie wechselt zwischen Etappen', () => {
  const g = createJourneyGame(pool(['a', 'b', 'c']), { rng: createRng(3) });
  const s = g.state;
  assert.equal(s.step, 0);
  assert.equal(s.length, 5);
  assert.equal(s.current.question.difficulty, 1, 'die Reise beginnt leicht');
  const first = playStage(g);
  assert.equal(s.phase, 'stepDone');
  assert.equal(s.stepsDone, 1);
  g.startStep();
  assert.notEqual(s.category, first, 'nächste Etappe in anderer Kategorie');
  g.answer(right(g));
  g.next();
  g.answer(wrong(g));
  assert.equal(s.outcome, 'lost');
  g.next();
  assert.equal(s.phase, 'finished');
  assert.equal(s.stepsDone, 1);
});

test('Journey: Etappenziel mit 10 Fragen bringt einen Joker nach Wahl', () => {
  const g = createJourneyGame(pool(['a', 'b']), { rng: createRng(5) });
  const s = g.state;
  for (let i = 0; i < 4; i++) {
    playStage(g);
    g.startStep();
  }
  assert.equal(s.step, 4);
  assert.equal(s.length, 10);
  assert.equal(s.current.question.difficulty, 2, 'ab Etappe 5 medium');
  playStage(g);
  assert.equal(s.phase, 'reward');
  g.takeReward('fifty');
  assert.equal(s.jokers.fifty, 1);
  assert.equal(s.phase, 'stepDone');
});

test('Journey: Joker – 50:50 für die ganze Etappe, Fehler frei, Kategorie wechseln', () => {
  const g = createJourneyGame(pool(['a', 'b', 'c']), { rng: createRng(7), resume: { step: 2, jokers: { fifty: 1, shield: 1, switch: 1 } } });
  const s = g.state;
  assert.equal(s.step, 2);
  assert.equal(s.stepsDone, 2, 'fortgesetzte Reise zählt die geschafften Etappen');

  assert.equal(g.useJoker('fifty'), true);
  assert.equal(s.hidden.length, 2);
  assert.ok(!s.hidden.includes(s.current.correctIndex));
  assert.equal(g.canUse('fifty'), false, 'nur einmal je Etappe');
  g.answer(right(g));
  g.next();
  assert.equal(s.hidden.length, 2, 'gilt auch für die nächste Frage der Etappe');

  const before = s.category;
  assert.equal(g.useJoker('switch'), true);
  assert.notEqual(s.category, before);
  assert.equal(s.current.question.category, s.category);
  assert.equal(s.results.length, 1, 'bisherige Antworten zählen weiter');

  assert.equal(g.useJoker('shield'), true);
  g.answer(wrong(g));
  assert.equal(s.outcome, null, 'ein Fehler ist erlaubt');
  g.next();
  g.answer(right(g));
  g.next();
  g.answer(right(g));
  g.next();
  g.answer(right(g));
  g.next();
  assert.equal(s.phase, 'stepDone', 'Etappe trotz eines Fehlers geschafft');
  assert.deepEqual(s.jokers, { switch: 0, shield: 0, fifty: 0 });
  assert.deepEqual(g.snapshot(), { step: 3, jokers: { switch: 0, shield: 0, fifty: 0 }, totalCorrect: 4 });
});

test('Journey: alle Etappen geschafft → gewonnen', () => {
  const g = createJourneyGame(pool(['a', 'b'], 40), { rng: createRng(9) });
  const s = g.state;
  for (let i = 0; i < JOURNEY_STEPS; i++) {
    playStage(g);
    if (s.phase === 'reward') g.takeReward('shield');
    if (s.phase === 'stepDone') g.startStep();
  }
  assert.equal(s.phase, 'finished');
  assert.equal(s.outcome, 'won');
  assert.equal(s.stepsDone, JOURNEY_STEPS);
  assert.equal(s.totalCorrect, JOURNEY_QUESTIONS);
});

test('Journey: zu wenige Fragen → Reise endet ohne Fehler', () => {
  const g = createJourneyGame(pool(['a'], 2), { rng: createRng(11) });
  const s = g.state;
  for (let i = 0; i < 20 && s.phase !== 'finished'; i++) {
    if (s.phase === 'question') {
      g.answer(right(g));
      g.next();
    } else if (s.phase === 'stepDone') g.startStep();
    else if (s.phase === 'reward') g.takeReward('fifty');
  }
  assert.equal(s.outcome, 'stuck');
});
