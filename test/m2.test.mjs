import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fiftyFifty, audienceVote, toPercentages, EXTRA_SECONDS } from '../src/js/core/jokers.js';
import { createLadderGame, LADDER, TIME_LIMITS } from '../src/js/core/modes/ladder.js';
import { createHost, HOST_LINES } from '../src/js/core/host.js';
import { createRng } from '../src/js/core/random.js';

let n = 0;
const ladderQuestions = () =>
  [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4].map((difficulty) => ({
    id: `m${++n}`, category: 'x', difficulty, question: `F${n}?`, correct: 'R', wrong: ['A', 'B', 'C'], tags: [],
  }));

test('50:50 entfernt genau zwei falsche Antworten', () => {
  const rng = createRng(1);
  for (let c = 0; c < 4; c++) {
    for (let k = 0; k < 20; k++) {
      const hidden = fiftyFifty(c, 4, rng);
      assert.equal(hidden.length, 2);
      assert.ok(!hidden.includes(c));
      assert.equal(new Set(hidden).size, 2);
    }
  }
});

test('toPercentages ergibt immer genau 100', () => {
  assert.deepEqual(toPercentages([1, 1, 1, 0]), [34, 33, 33, 0]);
  const rng = createRng(9);
  for (let k = 0; k < 200; k++) {
    const w = [rng(), rng(), rng(), rng() < 0.3 ? 0 : rng()];
    assert.equal(toPercentages(w).reduce((a, b) => a + b), 100);
  }
});

test('Publikum: versteckte Antworten 0 %, bei leichten Fragen meist richtig', () => {
  const rng = createRng(4);
  const v = audienceVote(2, 3, { hidden: [0, 3], rng });
  assert.equal(v[0], 0);
  assert.equal(v[3], 0);
  assert.equal(v[1] + v[2], 100);

  const hitRate = (difficulty) => {
    let hits = 0;
    for (let k = 0; k < 500; k++) {
      const vote = audienceVote(1, difficulty, { rng });
      if (vote[1] === Math.max(...vote)) hits++;
    }
    return hits / 500;
  };
  const easy = hitRate(1);
  const extreme = hitRate(4);
  assert.ok(easy > 0.9, `leicht: ${easy}`);
  assert.ok(extreme < easy, `extrem ${extreme} sollte unter leicht ${easy} liegen`);
  assert.ok(extreme > 0.25, `extrem: ${extreme}`);
});

test('Joker sind je Spiel einmal nutzbar, 50:50 sperrt versteckte Antworten', () => {
  const game = createLadderGame(ladderQuestions(), { rng: createRng(3) });
  const s = game.state;
  const hidden = game.useJoker('fifty');
  assert.deepEqual(s.hidden, hidden);
  assert.equal(game.useJoker('fifty'), null);
  game.answer(hidden[0]);
  assert.equal(s.phase, 'question', 'versteckte Antwort wird ignoriert');

  const vote = game.useJoker('audience');
  assert.equal(vote[hidden[0]], 0);
  assert.equal(game.useJoker('time'), EXTRA_SECONDS);
  assert.deepEqual(s.jokers, { fifty: false, audience: false, time: false });

  game.answer(s.current.correctIndex);
  game.next();
  assert.deepEqual(s.hidden, []);
  assert.equal(s.audience, null);
});

test('Ohne Timer: kein Zeitlimit und kein Zeit-Joker', () => {
  const withTimer = createLadderGame(ladderQuestions());
  assert.equal(withTimer.timeLimit(), TIME_LIMITS[1]);
  const without = createLadderGame(ladderQuestions(), { timer: false });
  assert.equal(without.timeLimit(), null);
  assert.equal(without.useJoker('time'), null);
});

test('Zeit abgelaufen zählt wie eine falsche Antwort', () => {
  const game = createLadderGame(ladderQuestions(), { rng: createRng(2) });
  const s = game.state;
  for (let i = 0; i < 6; i++) game.answer(s.current.correctIndex), game.next();
  game.timeUp();
  assert.equal(s.timedOut, true);
  assert.equal(s.correct, false);
  assert.equal(s.chosen, null);
  assert.equal(s.points, LADDER[4].points);
  game.next();
  assert.equal(s.outcome, 'lost');
});

test('Moderator: Platzhalter ersetzt, keine direkte Wiederholung', () => {
  const host = createHost(createRng(5));
  for (const situation of Object.keys(HOST_LINES)) {
    let prev = null;
    for (let k = 0; k < 10; k++) {
      const line = host.say(situation, { n: 3, points: '1.000', total: 15 });
      assert.ok(line && !/\{\w+\}/.test(line), `${situation}: ${line}`);
      if (HOST_LINES[situation].length > 1) assert.notEqual(line, prev);
      prev = line;
    }
  }
  assert.equal(host.say('gibt-es-nicht'), '');
});
