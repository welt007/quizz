import { parseCsvObjects, CsvError } from './csv.js';

export const REQUIRED_COLUMNS = ['id', 'category', 'difficulty', 'question', 'correct', 'wrong1', 'wrong2', 'wrong3'];
export const OPTIONAL_COLUMNS = ['image', 'explanation', 'tags'];
export const DIFFICULTIES = { 1: 'leicht', 2: 'medium', 3: 'schwer', 4: 'extrem' };
export const MANIFEST_FORMAT = 1;

const MAX_QUESTION_LEN = 200;
const MAX_ANSWER_LEN = 60;
const MOJIBAKE = /Ã[¤¶¼Ÿ„–œ]|â€/;
// answers are plain text or numbers – images are only allowed in the "image" column
const LOOKS_LIKE_IMAGE = /^data:|^https?:\/\/|\.(png|jpe?g|gif|webp|svg)$/i;

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} category
 * @property {1|2|3|4} difficulty
 * @property {string} question
 * @property {string} correct
 * @property {string[]} wrong      exactly three entries
 * @property {string} [image]      relative path, URL or data URI
 * @property {string} [explanation]
 * @property {string[]} tags
 * @property {string} source       file the question came from
 */

/**
 * Parses and validates one catalog CSV.
 * Invalid rows are skipped and reported; the rest is returned.
 *
 * @param {string} text  CSV content
 * @param {Object} [opts]
 * @param {string} [opts.source]          file name for messages
 * @param {Object} [opts.categories]      known category ids (from index.json) → warning if unknown
 * @returns {{questions: Question[], errors: Issue[], warnings: Issue[]}}
 *
 * @typedef {{source: string, line: number, message: string}} Issue
 */
export function parseCatalog(text, { source = 'catalog.csv', categories } = {}) {
  const errors = [];
  const warnings = [];
  const questions = [];
  const issue = (list, line, message) => list.push({ source, line, message });

  let parsed;
  try {
    parsed = parseCsvObjects(text);
  } catch (e) {
    if (e instanceof CsvError) {
      issue(errors, e.line, e.message);
      return { questions, errors, warnings };
    }
    throw e;
  }

  const missing = REQUIRED_COLUMNS.filter((c) => !parsed.header.includes(c));
  if (missing.length) {
    issue(errors, 1, `Fehlende Spalte(n): ${missing.join(', ')}`);
    return { questions, errors, warnings };
  }
  const unknown = parsed.header.filter((h) => h && !REQUIRED_COLUMNS.includes(h) && !OPTIONAL_COLUMNS.includes(h));
  if (unknown.length) issue(warnings, 1, `Unbekannte Spalte(n) werden ignoriert: ${unknown.join(', ')}`);

  const seenIds = new Set();
  for (const rec of parsed.records) {
    const line = rec.line;
    const rowErrors = [];

    for (const col of REQUIRED_COLUMNS) {
      if (!rec[col]) rowErrors.push(`Spalte "${col}" ist leer`);
    }
    const difficulty = Number(rec.difficulty);
    if (rec.difficulty && !DIFFICULTIES[difficulty]) {
      rowErrors.push(`Schwierigkeit "${rec.difficulty}" ungültig (erlaubt: ${Object.keys(DIFFICULTIES).join(', ')})`);
    }
    if (rec.id && seenIds.has(rec.id)) rowErrors.push(`ID "${rec.id}" ist doppelt`);
    if (rec.extraFields) {
      rowErrors.push('Zeile hat mehr Felder als die Kopfzeile – Trennzeichen im Text nicht in "…" gesetzt?');
    }

    const answers = [rec.correct, rec.wrong1, rec.wrong2, rec.wrong3];
    const normalized = answers.filter(Boolean).map((a) => a.toLocaleLowerCase('de'));
    if (new Set(normalized).size !== normalized.length) rowErrors.push('Antworten sind nicht alle verschieden');
    if (answers.some((a) => a && LOOKS_LIKE_IMAGE.test(a))) {
      rowErrors.push('Antworten dürfen nur Text oder Zahlen sein – Bilder gehören in die Spalte "image"');
    }

    if (rowErrors.length) {
      issue(errors, line, `${rec.id || '(ohne ID)'}: ${rowErrors.join('; ')}`);
      continue;
    }
    seenIds.add(rec.id);

    if (categories && !(rec.category in categories)) {
      issue(warnings, line, `${rec.id}: Kategorie "${rec.category}" ist nicht in index.json definiert`);
    }
    if (rec.question.length > MAX_QUESTION_LEN) {
      issue(warnings, line, `${rec.id}: Frage ist sehr lang (${rec.question.length} Zeichen)`);
    }
    for (const a of answers) {
      if (a.length > MAX_ANSWER_LEN) issue(warnings, line, `${rec.id}: Antwort "${a.slice(0, 30)}…" ist sehr lang`);
    }
    if (Object.values(rec).some((v) => MOJIBAKE.test(v))) {
      issue(warnings, line, `${rec.id}: Verdächtige Zeichen – Datei vermutlich nicht als UTF-8 gespeichert`);
    }

    questions.push({
      id: rec.id,
      category: rec.category,
      difficulty,
      question: rec.question,
      correct: rec.correct,
      wrong: [rec.wrong1, rec.wrong2, rec.wrong3],
      image: rec.image || undefined,
      explanation: rec.explanation || undefined,
      tags: rec.tags ? rec.tags.split('|').map((t) => t.trim()).filter(Boolean) : [],
      source,
    });
  }

  return { questions, errors, warnings };
}

/** Validates the structure of catalogs/index.json. Returns a list of error messages. */
export function validateManifest(manifest) {
  const errs = [];
  if (!manifest || typeof manifest !== 'object') return ['index.json ist kein Objekt'];
  if (manifest.format !== MANIFEST_FORMAT) errs.push(`"format" muss ${MANIFEST_FORMAT} sein`);
  if (!manifest.version || typeof manifest.version !== 'string') errs.push('"version" fehlt');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) errs.push('"files" muss eine nicht-leere Liste sein');
  else if (manifest.files.some((f) => typeof f !== 'string' || !f.endsWith('.csv') || f.includes('..'))) {
    errs.push('"files" darf nur relative .csv-Dateinamen enthalten');
  }
  if (manifest.categories && typeof manifest.categories !== 'object') errs.push('"categories" muss ein Objekt sein');
  return errs;
}
