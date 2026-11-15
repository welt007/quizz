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

    // training with Geographie/leicht contains the Japan flag question
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Geographie');
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
    await page.click('text=📊 Statistik');
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
    await page.click('text=📊 Statistik');
    assert.match(await g.text('.tiles'), /^10 \| Antworten \| 60 % \| Trefferquote \| 10 \/ 48/);
    assert.equal(await page.locator('.stat-list').first().locator('.stat-row').count(), 4);
    assert.equal(await page.locator('.review__list li').count(), 4);
    await page.click('text=📚 Diese Fragen üben');
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
