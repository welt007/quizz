export const MODES = [
  { id: 'ladder', icon: '🏆', name: 'Punkteleiter', desc: '15 Fragen von leicht bis extrem, mit Zeitlimit und drei Jokern.', ready: true },
  { id: 'training', icon: '📚', name: 'Training', desc: 'Freie Auswahl, ohne Zeitdruck, mit Erklärungen.', ready: true },
  { id: 'blitz', icon: '⚡', name: 'Blitzrunde', desc: '60 Sekunden – so viele Fragen wie möglich.' },
  { id: 'sudden', icon: '💀', name: 'Sudden Death', desc: 'Weiter bis zum ersten Fehler.' },
  { id: 'duel', icon: '🎮', name: 'Duell / Party', desc: '2–4 Spieler an einem Gerät, mit Buzzer.' },
];

export const modeById = (id) => MODES.find((m) => m.id === id);

export const formatPoints = (n) => n.toLocaleString('de-DE');
