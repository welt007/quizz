// Browser tests for the web part of the Android app (npm run build:android):
// served from the same https origin as WebViewAssetLoader, with a simulated
// native bridge (window.QuizshowNative, see android/…/NativeStore.java).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { skip, launch, ROOT, FIXTURES } from './helpers.mjs';

const ORIGIN = 'https://appassets.androidplatform.net';
const START_URL = `${ORIGIN}/assets/www/index.html`;
const ASSETS = path.join(ROOT, 'android/app/src/main/assets');
const TYPES = { '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

// Fake bridge: synchronous like the real one; keeps its data in localStorage under
// "native:" so it survives a reload, while the game's own keys must not appear there.
function fakeBridge() {
  const ITEM = 'native:item:';
  const DATA = 'native:data:';
  window.QuizshowNative = {
    getItem: (k) => localStorage.getItem(ITEM + k),
    setItem: (k, v) => (localStorage.setItem(ITEM + k, v), true),
    removeItem: (k) => localStorage.removeItem(ITEM + k),
    readData: (k) => localStorage.getItem(DATA + k),
    writeData: (k, v) => (localStorage.setItem(DATA + k, v), true),
    deleteData: (k) => localStorage.removeItem(DATA + k),
  };
}

describe('Android-Version (WebView-Inhalt)', { skip }, () => {
  let browser;
  before(async () => {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/build.mjs'), '--android'], { cwd: ROOT, stdio: 'ignore' });
    browser = await launch();
  });
  after(async () => {
    await browser?.close();
  });

  async function openApp() {
    const context = await browser.newContext({ viewport: { width: 412, height: 860 } });
    const errors = [];
    const external = [];
    // like WebViewAssetLoader: https://appassets.androidplatform.net/assets/… → APK assets
    await context.route(`${ORIGIN}/**`, (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/assets\//, '');
      const file = path.join(ASSETS, rel);
      if (!file.startsWith(ASSETS + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) });
    });
    await context.addInitScript(fakeBridge);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => !r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && external.push(r.url()));
    await page.goto(START_URL);
    await page.waitForSelector('.mode');
    const back = () => page.evaluate(() => window.quizshowBack());
    const stored = () => page.evaluate(() => Object.keys(localStorage).sort());
    return { context, page, errors, external, back, stored };
  }

  test('startet, Bilder kommen als eigene Dateien, keine externen Zugriffe', async () => {
    const { context, page, errors, external } = await openApp();
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('platform-android')));
    assert.match(await page.locator('.footer').innerText(), /App-Version/);
    const images = await page.evaluate(() =>
      JSON.parse(document.getElementById('embedded-catalogs').textContent).files.flatMap((f) => f.questions.map((q) => q.image).filter(Boolean)),
    );
    assert.ok(images.length > 100);
    assert.ok(images.every((src) => /^images\/.+\.svg$/.test(src)), 'Bilder als relative Pfade statt data:-URIs');
    const statuses = await page.evaluate(async (list) => Promise.all(list.map(async (src) => (await fetch(src)).status)), [images[0], images.at(-1)]);
    assert.deepEqual(statuses, [200, 200]);

    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Flaggen');
    await page.click('text=Los geht’s!');
    await page.waitForFunction(() => document.querySelector('.question__image')?.naturalWidth > 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await context.close();
  });

  test('speichert über die native Brücke statt im localStorage', async () => {
    const { context, page, stored } = await openApp();
    await page.keyboard.press('m'); // sound off → settings saved
    const keys = await stored();
    assert.ok(keys.includes('native:item:quizshow.settings'));
    assert.ok(keys.includes('native:item:quizshow.library'));
    assert.ok(!keys.some((k) => k.startsWith('quizshow.')), `direkt im localStorage: ${keys}`);
    await page.reload();
    await page.waitForSelector('.mode');
    assert.equal(await page.locator('.corner-btn').last().getAttribute('aria-label'), 'Ton einschalten (M)', 'Einstellung nach Neustart erhalten');

    // imported catalogs → files (writeData)
    await page.click('button:has-text("Optionen & Kataloge")');
    await page.setInputFiles('input[type=file]', [path.join(FIXTURES, 'import/kunst.csv')]);
    await page.click('.preview >> text=Importieren');
    await page.waitForSelector('.source--import');
    assert.equal((await stored()).filter((k) => k.startsWith('native:data:')).length, 1);
    await page.reload();
    await page.waitForSelector('.mode');
    await page.click('button:has-text("Optionen & Kataloge")');
    await page.waitForSelector('.source--import');
    assert.equal(await page.locator('.source--import :text("Daten fehlen")').count(), 0, 'Katalogdaten nach Neustart da');
    await context.close();
  });

  test('Zurück-Taste: Dialog schließen, Spiel beenden, App verlassen', async () => {
    const { context, page, back } = await openApp();
    assert.equal(await back(), false, 'Startbildschirm → App schließen');

    await page.click('button:has-text("Optionen & Kataloge")');
    assert.equal(await back(), true);
    await page.waitForSelector('.mode');

    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    await page.waitForSelector('.question__text');
    assert.equal(await back(), true);
    await page.waitForSelector('dialog[open]');
    assert.equal(await back(), true, 'Dialog schließen = Abbrechen');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await page.locator('.question__text').count(), 1, 'Spiel läuft weiter');
    await back();
    await page.click('dialog button[value=ok]');
    await page.waitForSelector('.mode');
    await context.close();
  });
});
