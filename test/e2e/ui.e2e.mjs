// Browser tests: presentation mode, image zoom, help, statistics, mobile layout, a11y basics.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, launch, openGame } from './helpers.mjs';

describe('Oberfläche (Browser, offline)', { skip }, () => {
  let browser;
  before(async () => (browser = await launch()));
  after(async () => browser?.close());

  test('Präsentationsmodus mit F, Bild-Zoom mit Z, Tastenkürzel mit ?', async () => {
    const g = await openGame(browser);
    const { page } = g;
    const fontBefore = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-presentation')), true);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), fontBefore, 'alles wird größer');
    assert.equal(await page.locator('.corner-btn--present').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('is-presentation')), false);

    await page.keyboard.press('?');
    assert.match(await g.text('dialog.help'), /Tastenkürzel.*Joker 50:50/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog.help', { state: 'detached' });

    // every question of the Flaggen category has an image
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Flaggen');
    for (const d of ['medium', 'schwer', 'extrem']) await page.click(`.chip >> text=${d}`);
    await page.click('text=Los geht’s!');
    for (let i = 0; i < 3 && !(await page.locator('.question__zoom').count()); i++) {
      await g.answer(true, { key: true });
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    await page.keyboard.press('z');
    await page.waitForSelector('dialog.lightbox[open]');
    assert.ok(await page.locator('.lightbox__img').evaluate((img) => img.complete && img.naturalWidth > 0));
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog.lightbox', { state: 'detached' });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Esc im Zoom öffnet nicht „Spiel beenden?“');
    assert.equal(await page.locator('.question').count(), 1);
    assert.deepEqual(g.errors, []);
    await g.context.close();
  });

  test('Statistik zählt Antworten und bietet Knackpunkte zum Üben an', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('button:has-text("Statistik")');
    assert.match(await g.text('.panel'), /Noch keine Antworten/);
    await page.click('text=Zurück');
    await page.click('.mode >> text=Training');
    await page.click('text=Los geht’s!');
    for (let i = 0; i < 10; i++) {
      await g.answer(i % 3 !== 0, { key: true }); // 4 falsch
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    await page.click('text=Hauptmenü');
    await page.click('button:has-text("Statistik")');
    assert.match(await g.text('.tiles'), new RegExp(`^10 \\| Antworten \\| 60 % \\| Trefferquote \\| 10 / ${g.builtin.total}`));
    assert.equal(await page.locator('.stat-list').first().locator('.stat-row').count(), g.builtin.categories);
    assert.equal(await page.locator('.review__list li').count(), 4);
    await page.click('button:has-text("Diese Fragen üben")');
    assert.match(await g.text('.topbar__status'), /Frage 1 von 4/);
    await g.context.close();
  });

  test('Screenreader: Auflösung in Worten, aktuelle Leiterstufe markiert', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    assert.equal(await page.locator('.ladder__step[aria-current="step"] .ladder__no').innerText(), '1');
    await g.answer(false);
    await page.waitForSelector('.answer.is-wrong');
    assert.match(await page.locator('.answer.is-wrong').innerText(), /deine Antwort, falsch/);
    assert.match(await page.locator('.answer.is-right').innerText(), /richtige Antwort/);
    await g.context.close();
  });

  test('Automatisch weiter nach 5 Sekunden, anhalten durch Antippen, abschaltbar', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    const status = () => g.text('.topbar__status');
    const answerNow = async () => {
      await page.clock.runFor(1000); // question appears
      await g.answer(true);
      await page.clock.runFor(1500); // reveal
      await page.waitForSelector('.btn--next');
    };
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Geographie');
    await page.click('text=Los geht’s!');
    await answerNow();
    assert.ok(await page.locator('.btn--next.is-counting').count(), 'Countdown läuft');
    await page.clock.runFor(5200);
    assert.match(await status(), /Frage 2 von 10/);

    await answerNow();
    await page.mouse.click(5, 300); // touches the screen elsewhere → stays
    await page.clock.runFor(8000);
    assert.match(await status(), /Frage 2 von 10/);
    assert.equal(await page.locator('.btn--next.is-counting').count(), 0);
    await page.click('.btn--next');
    assert.match(await status(), /Frage 3 von 10/);

    await page.goto(page.url()); // fresh start, settings are kept
    await page.click('button:has-text("Optionen & Kataloge")');
    await page.click('label:has-text("Automatisch weiter")');
    await page.goto(page.url());
    await page.click('.mode >> text=Training');
    await page.click('text=Los geht’s!');
    await answerNow();
    assert.equal(await page.locator('.btn--next.is-counting').count(), 0, 'abgeschaltet');
    await page.clock.runFor(8000);
    assert.match(await status(), /Frage 1 von/);
    assert.deepEqual(g.errors, []);
    await g.context.close();
  });

  test('Handy hochkant: Menü-Links im Rahmen, Bild sichtbar, „Nächste Frage“ ohne Scrollen erreichbar', async () => {
    const g = await openGame(browser, { device: 'iPhone 13' });
    const { page } = g;
    const width = page.viewportSize().width;
    for (const box of await Promise.all((await page.locator('.tool, .mode').all()).map((t) => t.boundingBox()))) {
      assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5, 'Kachel im sichtbaren Bereich');
    }
    const last = await page.locator('.tool').last().boundingBox();
    assert.ok(last.y + last.height <= page.viewportSize().height, 'Startseite ohne Scrollen');
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Flaggen');
    await page.click('text=Los geht’s!');
    await page.waitForSelector('.answer:not(:disabled)');
    const img = await page.locator('.question__image').boundingBox();
    assert.ok(img && img.width > 100 && img.height > 50, 'Fragebild sichtbar');
    await g.answer(false);
    await page.waitForSelector('.btn--next');
    const btn = await page.locator('.btn--next').boundingBox();
    assert.ok(btn.y >= 0 && btn.y + btn.height <= page.viewportSize().height, '„Nächste Frage“ im sichtbaren Bereich');
    assert.deepEqual(g.errors, []);
    await g.context.close();
  });

  for (const device of ['iPhone 13', 'iPhone 13 landscape']) {
    test(`Handy (${device}): kein seitliches Scrollen, Buzzer sichtbar`, async () => {
      const g = await openGame(browser, { device });
      const { page } = g;
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(await overflow(), false, 'Start');
      for (const mode of ['Punkteleiter', 'Blitzrunde', 'Duell']) {
        await page.goto(page.url());
        await page.click(`.mode >> text=${mode}`);
        assert.equal(await overflow(), false, `Einrichtung ${mode}`);
        await page.click('text=Los geht’s!');
        await page.waitForTimeout(3300);
        assert.equal(await overflow(), false, `Spiel ${mode}`);
      }
      await page.waitForSelector('.player');
      const box = await page.locator('.player').first().boundingBox();
      const vh = page.viewportSize().height;
      assert.ok(box && box.y + box.height <= vh + 1, 'Buzzer im sichtbaren Bereich');
      assert.deepEqual(g.errors, []);
      await g.context.close();
    });
  }
});
