// Browser tests: all game modes, played offline from file:// (dist/quizshow.html).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, launch, openGame } from './helpers.mjs';

describe('Spielmodi (Browser, offline)', { skip }, () => {
  let browser;
  before(async () => (browser = await launch()));
  after(async () => browser?.close());

  async function noProblems(g) {
    assert.deepEqual(g.errors, [], 'keine JS-Fehler');
    assert.deepEqual(g.external, [], 'keine Netzzugriffe');
    await g.context.close();
  }

  test('Startbildschirm: alle Modi, Kataloge aktiv', async () => {
    const g = await openGame(browser);
    assert.equal(await g.page.locator('.mode:not(:disabled)').count(), 5);
    const b = g.builtin;
    assert.ok((await g.text('.footer')).includes(`${b.files} von ${b.files} Katalogen aktiv`));
    assert.equal(await g.page.locator('.category').count(), b.categories);
    await noProblems(g);
  });

  test('Punkteleiter: alle 15 richtig → Hauptgewinn + Bestenliste', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    const diffs = [];
    for (let i = 0; i < 15; i++) {
      diffs.push(await page.locator('.question__meta .difficulty').innerText());
      await g.answer(true, { key: i % 2 === 0 });
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    assert.deepEqual(diffs, [...Array(4).fill('leicht'), ...Array(4).fill('medium'), ...Array(4).fill('schwer'), ...Array(3).fill('extrem')]);
    await page.waitForSelector('.result--won');
    await page.waitForTimeout(1400); // count-up
    assert.match(await g.text('.result__points'), /50\.000/);
    await page.fill('.hs-entry input', 'Siegerin');
    await page.keyboard.press('Enter');
    assert.match(await g.text('.hs-entry'), /Platz 1/);
    await page.click('text=Bestenliste ansehen');
    assert.match(await g.text('.hs-table tbody'), /Siegerin.*50\.000/);
    await noProblems(g);
  });

  test('Punkteleiter: Fehler bei Frage 8 → Sicherheitsstufe, Aussteigen sichert Stand', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    for (let i = 0; i < 7; i++) {
      await g.answer(true);
      await page.click('text=Nächste Frage');
    }
    await g.answer(false);
    await page.waitForSelector('.answer.is-wrong');
    assert.match(await g.text('.feedback'), /Du nimmst 500 Punkte mit/);
    await page.click('text=Zum Ergebnis');
    await page.click('text=Nochmal spielen');
    for (let i = 0; i < 3; i++) {
      await g.answer(true);
      await page.click('text=Nächste Frage');
    }
    await page.click('text=/Aussteigen mit 200 Punkten/');
    await page.click('dialog button[value=ok]');
    await page.click('text=Zum Ergebnis');
    await page.waitForTimeout(1400);
    assert.match(await g.text('.result'), /Clever ausgestiegen.*200/);
    await noProblems(g);
  });

  test('Punkteleiter: Joker 50:50, Publikum, +30 s', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    await page.keyboard.press('h');
    await page.clock.runFor(600);
    const removed = await page.locator('.answer').evaluateAll((els) => els.map((e, i) => (e.classList.contains('is-removed') ? i : -1)).filter((i) => i >= 0));
    assert.equal(removed.length, 2);
    assert.ok(!removed.includes(await g.correctIndex()), '50:50 entfernt nie die richtige Antwort');
    await page.keyboard.press('p');
    const votes = (await page.locator('.answer__vote').allInnerTexts()).map((v) => parseInt(v, 10));
    assert.equal(votes.length, 2);
    assert.equal(votes[0] + votes[1], 100);
    const before = Number(await page.locator('.timer__value').innerText());
    await page.keyboard.press('t');
    const after = Number(await page.locator('.timer__value').innerText());
    assert.ok(after >= before + 29 && after <= before + 30, `Timer ${before} → ${after}`);
    assert.equal(await page.locator('.joker.is-used').count(), 3);
    await page.locator('.answer').nth(removed[0]).click({ force: true });
    assert.equal(await page.locator('.answer.is-locked').count(), 0, 'entfernte Antwort nicht wählbar');
    await noProblems(g);
  });

  test('Punkteleiter: Zeitablauf zählt als falsch', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    await page.clock.runFor(25000);
    assert.equal(await page.locator('.timer.is-low').count(), 1, 'letzte 10 Sekunden rot');
    await page.clock.runFor(6000);
    assert.match(await g.text('.feedback'), /Zeit abgelaufen/);
    await noProblems(g);
  });

  test('Punkteleiter: Timer pausiert während des Beenden-Dialogs (Echtzeit)', async () => {
    const g = await openGame(browser);
    const { page } = g;
    const value = async () => Number(await page.locator('.timer__value').innerText());
    await page.click('.mode >> text=Punkteleiter');
    await page.click('text=Los geht’s!');
    await page.waitForTimeout(1300);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    const paused = await value();
    await page.waitForTimeout(2200);
    assert.equal(await value(), paused, 'steht im Dialog');
    await page.click('dialog button[value=cancel]');
    await page.waitForTimeout(2200);
    assert.ok((await value()) < paused, 'läuft nach „Abbrechen“ weiter');
    await noProblems(g);
  });

  test('Training: Auswertung und falsch beantwortete wiederholen', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('.mode >> text=Training');
    await page.click('text=keine');
    await page.click('.chip >> text=Geographie');
    await page.click('text=Los geht’s!');
    for (let i = 0; i < 10; i++) {
      await g.answer(i !== 2 && i !== 5, { key: true });
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    assert.match(await g.text('.result__points'), /8 \/ 10/);
    assert.equal(await page.locator('.review__list li').count(), 2);
    await page.click('text=2 falsche wiederholen');
    assert.match(await g.text('.topbar__status'), /Frage 1 von 2/);
    await noProblems(g);
  });

  test('Blitzrunde: Countdown, Multiplikator, Strafsekunden, Ende', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    await page.click('.mode >> text=Blitzrunde');
    await page.click('text=Los geht’s!');
    assert.equal(await page.locator('.countdown').count(), 1);
    await page.keyboard.press('a'); // ignored during countdown
    await page.clock.runFor(3500);
    assert.match(await g.text('.topbar__status'), /0 von 0/);
    for (let i = 0; i < 4; i++) {
      await g.answer(true, { key: true });
      await page.clock.runFor(500);
    }
    assert.match(await g.text('.blitz__multi'), /×2/);
    const before = Number(await page.locator('.timer__value').innerText());
    await g.answer(false, { key: true });
    const after = Number(await page.locator('.timer__value').innerText());
    // −3 s penalty; the clock may tick one more second in between
    assert.ok(after <= before - 3 && after >= before - 4, `Timer ${before} → ${after}`);
    await page.clock.runFor(70000);
    await page.waitForSelector('.result');
    assert.match(await g.text('.result__sub'), /4 von 5 richtig/);
    await noProblems(g);
  });

  test('Sudden Death: Stufe steigt nach 5 Fragen, Fehler beendet', async () => {
    const g = await openGame(browser);
    const { page } = g;
    await page.click('.mode >> text=Sudden Death');
    await page.click('text=Los geht’s!');
    const diffs = [];
    for (let i = 0; i < 6; i++) {
      diffs.push(await page.locator('.question__meta .difficulty').innerText());
      await g.answer(true, { key: true });
      await page.waitForSelector('.answer.is-right');
      await page.keyboard.press('Enter');
    }
    assert.deepEqual(diffs, ['leicht', 'leicht', 'leicht', 'leicht', 'leicht', 'medium']);
    await g.answer(false);
    await page.waitForSelector('.answer.is-wrong');
    await page.click('text=Zum Ergebnis');
    assert.match(await g.text('.result__points'), /^6 \| richtig in Folge/);
    await noProblems(g);
  });

  test('Duell mit Buzzer: Sperre nach Fehler, Nachbuzzern, Siegerehrung', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    await page.click('.mode >> text=Duell');
    await page.click('.chip >> text=3 Spieler');
    await page.locator('.players input').nth(0).fill('Ana');
    await page.locator('.players input').nth(1).fill('Ben');
    await page.click('.chip >> text=10 Fragen');
    await page.click('text=Los geht’s!');
    await page.clock.runFor(3500);
    assert.equal(await page.locator('.answer:disabled').count(), 4, 'vor dem Buzzern gesperrt');
    await page.keyboard.press('q');
    assert.equal(await page.locator('.player.is-active .player__name').innerText(), 'Ana');
    await g.answer(false, { key: true });
    await page.clock.runFor(800);
    assert.match(await g.text('.feedback'), /Ana: falsch \(−\d+\)/);
    await page.keyboard.press('q');
    assert.equal(await page.locator('.player.is-active').count(), 0, 'Ana ist gesperrt');
    await page.locator('.player').nth(1).click(); // Ben buzzert per Antippen
    await g.answer(true, { key: true });
    await page.clock.runFor(800);
    assert.match(await g.text('.feedback'), /Ben holt \+\d+/);
    for (let r = 1; r < 10; r++) {
      await page.keyboard.press('Enter');
      await page.keyboard.press('x');
      await g.answer(true, { key: true });
      await page.clock.runFor(800);
    }
    await page.click('text=Zur Siegerehrung');
    assert.match(await g.text('.result__title'), /Spieler 3 gewinnt/);
    assert.equal(await page.locator('.podium__row').count(), 3);
    await noProblems(g);
  });

  test('Duell reihum: Spieler wechseln sich ab', async () => {
    const g = await openGame(browser, { clock: true });
    const { page } = g;
    await page.click('.mode >> text=Duell');
    await page.click('.chip >> text=2 Spieler');
    await page.click('.chip >> text=Reihum');
    await page.click('text=Los geht’s!');
    await page.clock.runFor(3500);
    assert.match(await g.text('.duel__prompt'), /Spieler 1 ist dran/);
    await g.answer(false, { key: true });
    await page.clock.runFor(800);
    assert.equal(await page.locator('.answer.is-wrong').count(), 1);
    await page.keyboard.press('Enter');
    assert.match(await g.text('.duel__prompt'), /Spieler 2 ist dran/);
    await noProblems(g);
  });
});
