export const MODES = [
  { id: 'ladder', icon: 'trophy', name: 'Punkteleiter', desc: '15 Fragen von leicht bis extrem, mit Zeitlimit und drei Jokern.', short: '15 Fragen bis zum Hauptgewinn', ready: true },
  { id: 'training', icon: 'book', name: 'Training', desc: 'Freie Auswahl, ohne Zeitdruck, mit Erklärungen.', short: 'Freie Auswahl, mit Erklärungen', ready: true },
  { id: 'blitz', icon: 'bolt', name: 'Blitzrunde', desc: '60 Sekunden, Serien-Multiplikator bis ×4 – Fehler kosten 3 Sekunden.', short: '60 Sekunden, Multiplikator ×4', ready: true },
  { id: 'sudden', icon: 'flame', name: 'Sudden Death', desc: 'Immer schwerer, bis zum ersten Fehler.', short: 'Bis zum ersten Fehler', ready: true },
  { id: 'duel', icon: 'users', name: 'Duell / Party', desc: '2–4 Spieler an einem Gerät – mit Buzzer oder reihum.', short: '2–4 Spieler, ein Gerät', ready: true },
];

export const modeById = (id) => MODES.find((m) => m.id === id);

export const formatPoints = (n) => n.toLocaleString('de-DE').replace('-', '−');
