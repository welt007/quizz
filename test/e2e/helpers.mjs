// Shared helpers for the browser tests (npm run e2e).
// Playwright is deliberately NOT a dependency of this project (see CLAUDE.md);
// install it ad hoc: npm i --no-save playwright && npx playwright install chromium
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURES = path.join(ROOT, 'test/e2e/fixtures');
export const GAME_URL = pathToFileURL(path.join(ROOT, 'dist/quizshow.html')).href;

let pw = null;
try {
  pw = require('playwright');
} catch {
  /* not installed */
}
export const playwright = pw;
/** Reason to skip (string) or false – pass as { skip } to describe(). */
export const skip = pw ? false : 'Playwright nicht installiert: npm i --no-save playwright && npx playwright install chromium';

export const launch = () => pw.chromium.launch();

/** Answer pairs [question, correct] known to the tests: embedded catalog + fixtures. */
function KNOWN_FIXTURE_ANSWERS(q) {
  const m = /^(?:Sport|Film|Musik|Kunst)frage (\d)\?$/.exec(q);
  if (m) return `Richtig ${m[1]}`;
  return { 'Welche Form hat dieser Ball?': 'Richtig rund', 'Noch eine Kunstfrage?': 'Richtig 2' }[q] ?? null;
}

/**
 * Opens the game in a fresh browser context.
 * @returns {Promise<{page, context, errors: string[], external: string[], builtin: object, correctIndex: Function, answer: Function, text: Function}>}
 */
export async function openGame(browser, { offline = true, device, viewport, clock = false, route } = {}) {
  const base = device ? pw.devices[device] : { viewport: viewport ?? { width: 1280, height: 900 } };
  const context = await browser.newContext({ ...base, offline });
  const errors = [];
  const external = [];
  if (route) await context.route('**/*', route);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('request', (r) => {
    if (!/^(file|data):|^http:\/\/(localhost|127\.0\.0\.1)/.test(r.url())) external.push(r.url());
  });
  if (clock) await page.clock.install();
  await page.goto(GAME_URL);
  await page.waitForSelector('.mode');
  const files = await page.evaluate(() =>
    JSON.parse(document.getElementById('embedded-catalogs').textContent).files.map((f) => ({
      file: f.file,
      questions: f.questions.map((q) => [q.question, q.correct, q.category, [q.correct, ...q.wrong].sort().join('\u0001'), q.image ?? null]),
    })),
  );
  const embedded = files.flatMap((f) => f.questions);
  /** Figures of the embedded standard catalog, so tests do not hard-code catalog sizes. */
  const builtin = {
    total: embedded.length,
    files: files.length,
    categories: new Set(embedded.map((q) => q[2])).size,
    /** Number of questions in one CSV, e.g. count('geographie'). */
    count: (name) => files.find((f) => f.file === `${name}.csv`).questions.length,
  };

  async function correctIndex() {
    const q = await page.locator('.question__text').innerText();
    const answers = await page.locator('.answer__text').allInnerTexts();
    const fixture = KNOWN_FIXTURE_ANSWERS(q);
    // flag/outline questions share their text (some even their answers), so match answer set and image too
    const set = [...answers].sort().join('\u0001');
    const img = (await page.locator('.question__image').count()) ? await page.locator('.question__image').getAttribute('src') : null;
    const idx = answers.findIndex(
      (a) => a === fixture || embedded.some(([qq, c, , all, image]) => qq === q && c === a && all === set && (image ?? null) === img),
    );
    if (idx < 0) throw new Error(`Richtige Antwort unbekannt: ${q}`);
    return idx;
  }
  /** Answers the current question right or wrong, by click or key. */
  async function answer(right = true, { key = false } = {}) {
    const c = await correctIndex();
    const i = right ? c : (c + 1) % 4;
    if (key) await page.keyboard.press('ABCD'[i]);
    else await page.locator('.answer').nth(i).click();
  }
  const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s*\n+\s*/g, ' | ');
  return { page, context, errors, external, builtin, correctIndex, answer, text };
}

/** Static file server with CORS on a random port, serving a writable copy of fixtures/server. */
export async function startCatalogServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quizshow-e2e-'));
  fs.cpSync(path.join(FIXTURES, 'server'), dir, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    dir,
    close: () => new Promise((r) => server.close(() => (fs.rmSync(dir, { recursive: true, force: true }), r()))),
  };
}
