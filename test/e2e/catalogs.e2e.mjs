// Browser tests: catalog management (enable/disable, add by URL, update, import,
// remove, built-in update from a simulated GitHub). Uses a local CORS server.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { skip, launch, openGame, startCatalogServer, ROOT, FIXTURES } from './helpers.mjs';

const GH = 'https://raw.githubusercontent.com/welt007/quizz/HEAD/catalogs/';

describe('Kataloge verwalten (Browser)', { skip }, () => {
  let browser;
  let server;
  before(async () => {
    browser = await launch();
    server = await startCatalogServer();
  });
  after(async () => {
    await browser?.close();
    await server?.close();
  });

  const helpers = (g) => {
    const { page } = g;
    return {
      summary: () => g.text('.options__summary'),
      card: (name) => page.locator('.source', { has: page.locator('.source__name', { hasText: name }) }),
      toggle: (name) => page.locator('.catalog', { has: page.locator('.catalog__name', { hasText: new RegExp(`^${name}$`) }) }).locator('.switch'),
      async addUrl(url) {
        await page.fill('.add-form input', url);
        await page.click('.add-form >> text=Laden');
        await page.waitForSelector('.add-form ~ .source__preview .preview, .add-form + .source__status.is-error');
      },
    };
  };

  test('Kataloge einzeln aus- und wieder einschalten, dauerhaft gespeichert', async () => {
    const g = await openGame(browser);
    const { page } = g;
    const o = helpers(g);
    const b = g.builtin;
    await page.click('text=⚙️ Optionen & Kataloge');
    assert.ok((await o.summary()).includes(`${b.total} Fragen aus ${b.files} von ${b.files} Katalogen in ${b.categories} Kategorien`));
    await o.toggle('Geographie').click();
    assert.ok((await o.summary()).includes(`${b.total - b.count('geographie')} Fragen aus ${b.files - 1} von ${b.files}`));
    await page.reload();
    assert.ok((await g.text('.footer')).includes(`${b.files - 1} von ${b.files} Katalogen aktiv`));
    await page.click('text=🗂️ Kategorien');
    const names = await page.locator('.category__name').allInnerTexts();
    assert.equal(names.length, b.categories - 1);
    assert.ok(!names.includes('Geographie') && names.includes('Geschichte'));
    await page.click('text=Zurück');
    await page.click('text=⚙️ Optionen & Kataloge');
    await o.card('Standardkatalog').locator('text=Alle aus').click();
    await page.click('text=Fertig');
    assert.equal(await page.locator('.mode:not(:disabled)').count(), 0);
    assert.match(await g.text('.panel .setup__info'), /Keine aktiven Fragen/);
    await page.click('.footer >> text=Kataloge verwalten');
    await o.card('Standardkatalog').locator('text=Alle an').click();
    assert.ok((await o.summary()).includes(`${b.total} Fragen aus ${b.files} von ${b.files}`));
    await g.context.close();
  });

  test('Paket mit mehreren CSVs per URL hinzufügen, zu einem Pool vereint, offline mit Bild spielbar', async () => {
    const g = await openGame(browser, { offline: false });
    const { page, context } = g;
    const o = helpers(g);
    const b = g.builtin;
    await page.click('text=⚙️ Optionen & Kataloge');

    await o.addUrl('das ist keine url');
    assert.match(await g.text('.add-form + .source__status'), /keine gültige URL/);
    await o.addUrl(`${server.url}/gibtsnicht.csv`);
    assert.match(await g.text('.add-form + .source__status'), /HTTP 404/);

    await o.addUrl(`${server.url}/pack/`);
    assert.match(await g.text('.preview'), /„Sport & Film“ · Version 1 \| 10 Fragen aus 2 Dateien in 2 Kategorien/);
    assert.match(await g.text('.preview'), /Film \(film\.csv\): 4 Fragen · ⚠ 1 übersprungen/);
    await page.click('.preview >> text=Hinzufügen');
    await page.waitForSelector('.source--url');
    assert.ok((await o.summary()).includes(`${b.total + 10} Fragen aus ${b.files + 2} von ${b.files + 2} Katalogen in ${b.categories + 2} Kategorien`));

    await o.addUrl(`${server.url}/einzel.csv`);
    await page.click('.preview >> text=Hinzufügen');
    await page.waitForSelector('.source__name:has-text("Einzel")');
    assert.ok((await o.summary()).includes(`${b.total + 12} Fragen aus ${b.files + 3} von ${b.files + 3}`));

    await o.addUrl(`${server.url}/pack/index.json`);
    assert.match(await g.text('.preview__intro'), /schon vorhanden/);
    await page.click('.preview >> text=Verwerfen');

    // after a reload everything is still there – and works offline incl. the image
    await page.reload();
    await context.setOffline(true);
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip:has-text("Ballsport")');
    await page.click('.chip >> text=alle');
    await page.click('text=Los geht’s!');
    let image = null;
    for (let i = 0; i < 6; i++) {
      if (await page.locator('.question__image').count()) {
        image = await page.locator('.question__image').evaluate((el) => el.complete && el.naturalWidth > 0);
      }
      await g.answer(true, { key: true });
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    assert.equal(image, true, 'Bild aus dem hinzugefügten Katalog offline geladen');
    assert.match(await g.text('.result__points'), /6 \/ 6/);
    await g.context.close();
  });

  test('Aktualisieren behält ausgeschaltete Dateien, Import und Entfernen', async () => {
    const g = await openGame(browser, { offline: false });
    const { page } = g;
    const o = helpers(g);
    const b = g.builtin;
    await page.click('text=⚙️ Optionen & Kataloge');
    await o.addUrl(`${server.url}/pack/`);
    await page.click('.preview >> text=Hinzufügen');
    await page.waitForSelector('.source--url');
    await o.toggle('Film').click();

    const index = path.join(server.dir, 'pack/index.json');
    fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('"version": "1"', '"version": "2"'));
    fs.appendFileSync(path.join(server.dir, 'pack/sport.csv'), 'sp-7,ballsport,2,Neue Sportfrage?,a,b,c,d,,,\n');
    const pack = o.card('Sport & Film');
    await pack.locator('text=🔄 Aktualisieren').click();
    await pack.locator('.preview').waitFor();
    assert.match(await pack.locator('.preview__intro').innerText(), /Neue Version 2 gefunden \(bisher 1\)/);
    await pack.locator('text=Update übernehmen').click();
    await page.waitForSelector('.source--url .source__meta:has-text("Version 2 ·")');
    assert.equal(await o.toggle('Film').locator('input').isChecked(), false, 'Film bleibt aus');
    assert.ok((await o.summary()).includes(`${b.total + 7} Fragen`));
    await o.card('Sport & Film').locator('text=🔄 Aktualisieren').click();
    await page.waitForSelector('.source__status:has-text("Bereits aktuell")');

    await page.setInputFiles('input[type=file]', [path.join(FIXTURES, 'import/kunst.csv'), path.join(FIXTURES, 'import/kunst-semikolon.csv')]);
    await page.waitForSelector('.preview');
    assert.match(await g.text('.preview'), /Import \(2 Dateien\).*2 Fragen aus 2 Dateien in 1 Kategorie/);
    await page.click('.preview >> text=Importieren');
    await page.waitForSelector('.source--import');
    assert.ok((await o.summary()).includes(`${b.total + 9} Fragen`));
    await page.locator('.source--import >> text=🗑 Entfernen').click();
    await page.click('dialog button[value=ok]');
    await page.waitForSelector('.source--import', { state: 'detached' });
    assert.ok((await o.summary()).includes(`${b.total + 7} Fragen`));
    await g.context.close();
  });

  test('Standardkatalog aus GitHub aktualisieren (simuliert) und zurücksetzen', async () => {
    const updated = fs.mkdtempSync(path.join(server.dir, 'gh-'));
    fs.cpSync(path.join(ROOT, 'catalogs'), updated, { recursive: true });
    const idx = path.join(updated, 'index.json');
    const current = JSON.parse(fs.readFileSync(idx, 'utf8')).version;
    fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(`"version": "${current}"`, '"version": "9999-01-01.1"'));
    fs.appendFileSync(path.join(updated, 'geographie.csv'), 'geo-9999,geographie,1,Wie heißt die Hauptstadt von Italien?,Rom,Mailand,Neapel,Turin,,,\n');

    const route = (r) => {
      const u = r.request().url();
      if (!u.startsWith(GH)) return r.continue();
      const f = path.join(updated, u.slice(GH.length));
      return fs.existsSync(f)
        ? r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' } })
        : r.fulfill({ status: 404, body: 'not found' });
    };
    const g = await openGame(browser, { offline: false, route });
    const { page } = g;
    const o = helpers(g);
    await page.click('text=⚙️ Optionen & Kataloge');
    const builtin = o.card('Standardkatalog');
    await builtin.locator('text=🔄 Aktualisieren').click();
    await builtin.locator('.preview').waitFor();
    assert.match(await builtin.locator('.preview__intro').innerText(), /Neue Version 9999-01-01\.1/);
    await builtin.locator('text=Update übernehmen').click();
    await page.waitForSelector('.badge:has-text("aktualisiert")');
    const total = g.builtin.total;
    assert.ok((await g.text('.source--builtin .source__meta')).includes(`${total + 1} Fragen`));
    await page.reload();
    await page.click('text=⚙️ Optionen & Kataloge');
    assert.ok((await g.text('.source--builtin .source__meta')).includes(`9999-01-01.1 · ${total + 1} Fragen`));
    await page.click('text=Auf eingebaute Version zurücksetzen');
    await page.click('dialog button[value=ok]');
    await page.waitForSelector(`.source--builtin .source__meta:has-text("${current}")`);
    assert.ok((await g.text('.source--builtin .source__meta')).includes(`${total} Fragen`));
    await g.context.close();
  });
});
