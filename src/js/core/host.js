// Host ("Moderator") lines – own wording, picked at random, no immediate repeats.
// Placeholders: {n} question number, {points}, {total}.
export const HOST_LINES = {
  start: [
    'Herzlich willkommen! {total} Fragen trennen dich vom Hauptgewinn.',
    'Licht an, Kameras laufen – los geht’s!',
    'Schön, dass du da bist! Wir starten ganz entspannt.',
    'Willkommen auf der großen Bühne! Bereit für die erste Frage?',
  ],
  question: [
    'Frage {n} – um {points} Punkte.',
    'Weiter geht’s mit Frage {n}.',
    'Konzentration! Frage {n} wartet.',
    'Hier kommt Frage {n}.',
    'Nächste Runde, nächste Chance: Frage {n}.',
  ],
  questionSafe: [
    'Frage {n} – jetzt geht es um die Sicherheitsstufe!',
    'Achtung: Mit dieser Frage sicherst du dir {points} Punkte!',
  ],
  questionExtreme: [
    'Willkommen in der Extrem-Zone! Ab jetzt wird’s richtig knifflig.',
    'Jetzt trennt sich die Spreu vom Weizen – extrem schwer!',
  ],
  questionFinal: [
    'Die letzte Frage – um den Hauptgewinn von {points} Punkten!',
    'Alles oder nichts: die Frage um {points} Punkte!',
  ],
  lock: ['Eingeloggt! Mal sehen …', 'Mutig! Wir lösen auf …', 'Die Antwort steht – jetzt wird’s spannend.', 'Okay … Trommelwirbel, bitte!'],
  correct: ['Richtig! Stark!', 'Ganz genau!', 'Volltreffer!', 'Das sitzt!', 'Perfekt – weiter so!'],
  safe: ['Sicherheitsstufe erreicht – {points} Punkte sind dir sicher!', 'Geschafft! {points} Punkte kann dir keiner mehr nehmen.'],
  wrong: ['Oh nein – das war leider daneben.', 'Schade! Da hat das Bauchgefühl getäuscht.', 'Autsch – knapp vorbei ist auch daneben.'],
  timeUp: ['Die Zeit ist um!', 'Zu spät – die Uhr war schneller.', 'Tick, tack … und vorbei.'],
  fifty: ['Zwei falsche Antworten verschwinden …', 'Halbe-halbe: Jetzt bleiben nur noch zwei!'],
  audience: ['Das Publikum hat abgestimmt!', 'Mal sehen, was der Saal meint …'],
  time: ['30 Sekunden extra – nutze sie gut!', 'Mehr Zeit zum Grübeln!'],
  walk: ['Klug gespielt – du nimmst {points} Punkte mit.', 'Manchmal ist Aufhören die beste Antwort. {points} Punkte!'],
  won: ['Unglaublich! Alle {total} Fragen – der Hauptgewinn gehört dir!', 'Wahnsinn! Du hast die ganze Leiter erklommen!'],
};

/** Creates a host that never says the same line twice in a row per situation. */
export function createHost(rng = Math.random) {
  const last = {};
  return {
    say(situation, vars = {}) {
      const lines = HOST_LINES[situation];
      if (!lines?.length) return '';
      let idx = Math.floor(rng() * lines.length);
      if (lines.length > 1 && idx === last[situation]) idx = (idx + 1) % lines.length;
      last[situation] = idx;
      return lines[idx].replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
    },
  };
}
