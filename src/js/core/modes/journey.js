// "Journey": a trip of JOURNEY_STEPS stages. Every stage is played in ONE category
// and has 5 questions (every 5th stage, an "Etappenziel", has 10) that must all be
// answered correctly. Reaching an Etappenziel earns a joker of the player's choice:
//   switch – change the category of the current stage
//   shield – one wrong answer is allowed in the current stage
//   fifty  – 50:50 for every question of the current stage
// The trip starts easy and gets harder every few stages. A wrong answer (without
// shield) ends the journey; it can be resumed at the start of a stage (see resume).
import { prepareQuestion } from '../question.js';
import { fiftyFifty } from '../jokers.js';
import { orderByFreshness, difficultyPreference, ALL_DIFFICULTIES } from '../questionPool.js';
import { shuffle } from '../random.js';

export const JOURNEY_STEPS = 15;
export const STEP_QUESTIONS = 5;
export const MILESTONE_EVERY = 5;
export const MILESTONE_QUESTIONS = 10;
const STEPS_PER_DIFFICULTY = 4;

export const JOURNEY_JOKERS = {
  switch: { label: 'Kategorie wechseln', short: 'Wechsel', title: 'Die aktuelle Etappe in einer anderen Kategorie weiterspielen' },
  shield: { label: 'Ein Fehler frei', short: 'Fehler frei', title: 'In dieser Etappe darf eine Frage falsch sein' },
  fifty: { label: '50:50 für die Etappe', short: '50:50', title: 'Bei allen Fragen dieser Etappe zwei falsche Antworten entfernen' },
};
export const JOKER_TYPES = Object.keys(JOURNEY_JOKERS);

/** 0-based stage → is it an Etappenziel (10 questions, joker reward)? */
export const isMilestone = (step) => (step + 1) % MILESTONE_EVERY === 0;
/** 0-based stage → number of questions. */
export const stepLength = (step) => (isMilestone(step) ? MILESTONE_QUESTIONS : STEP_QUESTIONS);
/** 0-based stage → target difficulty: 1 for stages 1–4, 2 for 5–8, 3 for 9–12, then 4. */
export function journeyDifficulty(step) {
  return Math.min(Math.max(...ALL_DIFFICULTIES), 1 + Math.floor(step / STEPS_PER_DIFFICULTY));
}
/** Total questions of a complete journey (for the setup screen). */
export const JOURNEY_QUESTIONS = Array.from({ length: JOURNEY_STEPS }, (_, i) => stepLength(i)).reduce((a, b) => a + b, 0);

/**
 * Phases:
 *   'question' → answer(i) → 'reveal' → next() → 'question' | 'stepDone' | 'reward' | 'finished'
 *   'reward'   → takeReward(type) → 'stepDone'
 *   'stepDone' → startStep() → 'question'
 * outcome: 'lost' (wrong answer) | 'won' (all stages) | 'stuck' (no questions left).
 *
 * @param {object[]} questions  pool (already filtered by the chosen categories)
 * @param {{stats?: object, rng?: Function, resume?: {step: number, jokers: object, totalCorrect?: number}}} opts
 */
export function createJourneyGame(questions, { stats, rng = Math.random, resume } = {}) {
  if (questions.length === 0) throw new Error('Die Reise braucht mindestens eine Frage');
  // category → difficulty → questions (freshest first)
  const pool = new Map();
  for (const q of orderByFreshness(questions, stats, rng)) {
    if (!pool.has(q.category)) pool.set(q.category, new Map(ALL_DIFFICULTIES.map((d) => [d, []])));
    pool.get(q.category).get(q.difficulty).push(q);
  }
  const left = (cat, d) => (d ? pool.get(cat).get(d).length : [...pool.get(cat).values()].reduce((n, l) => n + l.length, 0));

  const state = {
    phase: 'question',
    step: Math.max(0, Math.min(JOURNEY_STEPS - 1, resume?.step ?? 0)),
    category: null,
    difficulty: 1,
    length: STEP_QUESTIONS,
    index: 0, // question within the stage
    results: [], // per answered question of the stage: true / false
    shield: false, // joker active in this stage
    fifty: false,
    switched: false,
    hidden: [], // answer indices removed by 50:50 for the current question
    current: null,
    chosen: null,
    correct: null,
    jokers: Object.fromEntries(JOKER_TYPES.map((t) => [t, Math.max(0, resume?.jokers?.[t] ?? 0)])),
    stepsDone: Math.max(0, Math.min(JOURNEY_STEPS - 1, resume?.step ?? 0)),
    totalCorrect: resume?.totalCorrect ?? 0,
    outcome: null,
    lastCategory: null,
  };

  /** Categories that can still fill the rest of the stage, best first (target difficulty available). */
  function candidates(needed, exclude) {
    const cats = shuffle([...pool.keys()], rng).filter((c) => left(c) >= needed);
    const others = cats.filter((c) => !exclude.includes(c));
    const list = others.length ? others : cats;
    const good = list.filter((c) => left(c, state.difficulty) >= needed);
    return good.length ? good : list.sort((a, b) => left(b) - left(a));
  }

  function draw() {
    const buckets = pool.get(state.category);
    const from = difficultyPreference(state.difficulty).find((d) => buckets.get(d).length);
    return from === undefined ? null : buckets.get(from).shift();
  }

  function setQuestion(q) {
    state.current = prepareQuestion(q, rng);
    state.hidden = state.fifty ? fiftyFifty(state.current.correctIndex, state.current.answers.length, rng) : [];
    state.chosen = null;
    state.correct = null;
  }

  function finish(outcome) {
    state.outcome = outcome;
    state.phase = 'finished';
    return state;
  }

  const api = {
    state,

    /** Begins the stage `state.step` (category, difficulty, first question). */
    startStep() {
      if (state.phase !== 'stepDone' && state.current) return state;
      state.difficulty = journeyDifficulty(state.step);
      state.length = stepLength(state.step);
      const [cat] = candidates(state.length, state.lastCategory ? [state.lastCategory] : []);
      if (!cat) return finish('stuck');
      state.category = cat;
      state.index = 0;
      state.results = [];
      state.shield = false;
      state.fifty = false;
      state.switched = false;
      setQuestion(draw());
      state.phase = 'question';
      return state;
    },

    answer(index) {
      if (state.phase !== 'question') return state;
      state.chosen = index;
      state.correct = index === state.current.correctIndex;
      state.results.push(state.correct);
      if (state.correct) state.totalCorrect++;
      state.phase = 'reveal';
      if (!state.correct && api.mistakes() > api.allowedMistakes()) state.outcome = 'lost';
      return state;
    },

    mistakes: () => state.results.filter((r) => !r).length,
    allowedMistakes: () => (state.shield ? 1 : 0),

    next() {
      if (state.phase !== 'reveal') return state;
      if (state.outcome) return finish(state.outcome);
      if (state.results.length < state.length) {
        const q = draw();
        if (!q) return finish('stuck');
        state.index++;
        setQuestion(q);
        state.phase = 'question';
        return state;
      }
      // stage complete
      state.stepsDone = state.step + 1;
      state.lastCategory = state.category;
      if (state.stepsDone >= JOURNEY_STEPS) return finish('won');
      state.phase = isMilestone(state.step) ? 'reward' : 'stepDone';
      state.step++;
      return state;
    },

    /** After an Etappenziel: the player picks a joker. */
    takeReward(type) {
      if (state.phase !== 'reward' || !JOURNEY_JOKERS[type]) return state;
      state.jokers[type]++;
      state.phase = 'stepDone';
      return state;
    },

    /** Can the joker be used right now? */
    canUse(type) {
      if (state.phase !== 'question' || !(state.jokers[type] > 0)) return false;
      if (type === 'shield') return !state.shield;
      if (type === 'fifty') return !state.fifty;
      if (type === 'switch') return !state.switched && candidates(state.length - state.results.length, [state.category]).some((c) => c !== state.category);
      return false;
    },

    /** Uses a joker in the current stage. Returns false if not possible. */
    useJoker(type) {
      if (!api.canUse(type)) return false;
      state.jokers[type]--;
      if (type === 'shield') state.shield = true;
      if (type === 'fifty') {
        state.fifty = true;
        state.hidden = fiftyFifty(state.current.correctIndex, state.current.answers.length, rng);
      }
      if (type === 'switch') {
        // the current question goes back, the rest of the stage comes from another category
        pool.get(state.category).get(state.current.question.difficulty).unshift(state.current.question);
        const [cat] = candidates(state.length - state.results.length, [state.category]);
        state.category = cat;
        state.switched = true;
        setQuestion(draw());
      }
      return true;
    },

    /** What to store so the journey can be continued later (at the start of the current stage). */
    snapshot() {
      return { step: state.step, jokers: { ...state.jokers }, totalCorrect: state.totalCorrect };
    },
  };

  state.phase = 'stepDone';
  api.startStep();
  return api;
}
