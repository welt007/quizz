// All sounds are synthesized with WebAudio – no audio files, works offline.
// Every call is wrapped so that missing/blocked audio never breaks the game.
let ac = null;
let master = null;
let enabled = true;

function context() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.22;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(c, { freq, type = 'sine', start = 0, dur = 0.2, vol = 1, slideTo }) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuffer = null;
function noise(c, { start = 0, dur = 0.1, vol = 0.5, filter = 1200, q = 1 }) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = filter;
  bp.Q.value = q;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(gain).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const chord = (c, freqs, opts) => freqs.forEach((freq) => tone(c, { ...opts, freq }));

const SOUNDS = {
  click: (c) => tone(c, { freq: 660, type: 'triangle', dur: 0.06, vol: 0.4 }),
  tick: (c) => tone(c, { freq: 1200, type: 'square', dur: 0.035, vol: 0.18 }),
  lock: (c) => {
    tone(c, { freq: 196, type: 'sawtooth', dur: 0.3, vol: 0.35 });
    // drum roll that gets faster
    let t = 0.15;
    for (let gap = 0.09; t < 1.1; gap = Math.max(0.035, gap * 0.9)) {
      noise(c, { start: t, dur: 0.06, vol: 0.25 + t * 0.2, filter: 900, q: 0.8 });
      t += gap;
    }
  },
  right: (c) => {
    [523.25, 659.25, 783.99].forEach((f, i) => tone(c, { freq: f, type: 'triangle', start: i * 0.08, dur: 0.3, vol: 0.7 }));
    chord(c, [523.25, 659.25, 783.99, 1046.5], { type: 'triangle', start: 0.26, dur: 0.6, vol: 0.35 });
  },
  wrong: (c) => {
    tone(c, { freq: 220, type: 'sawtooth', dur: 0.35, vol: 0.4, slideTo: 150 });
    tone(c, { freq: 165, type: 'sawtooth', start: 0.3, dur: 0.6, vol: 0.4, slideTo: 80 });
  },
  timeUp: (c) => {
    [880, 880, 880].forEach((f, i) => tone(c, { freq: f, type: 'square', start: i * 0.18, dur: 0.12, vol: 0.3 }));
    tone(c, { freq: 220, type: 'sawtooth', start: 0.55, dur: 0.6, vol: 0.4, slideTo: 90 });
  },
  joker: (c) => {
    tone(c, { freq: 300, type: 'sine', dur: 0.35, vol: 0.5, slideTo: 1200 });
    noise(c, { dur: 0.35, vol: 0.2, filter: 3000, q: 0.5 });
  },
  safe: (c) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { freq: f, type: 'triangle', start: i * 0.1, dur: 0.25, vol: 0.6 }));
    chord(c, [523.25, 783.99, 1046.5, 1318.5], { type: 'sine', start: 0.42, dur: 0.9, vol: 0.3 });
  },
  win: (c) => {
    const melody = [523.25, 523.25, 523.25, 698.46, 880, 698.46, 880, 1046.5];
    const times = [0, 0.15, 0.3, 0.45, 0.75, 0.95, 1.1, 1.3];
    melody.forEach((f, i) => tone(c, { freq: f, type: 'square', start: times[i], dur: 0.2, vol: 0.25 }));
    chord(c, [523.25, 659.25, 783.99, 1046.5], { type: 'triangle', start: 1.3, dur: 1.6, vol: 0.3 });
  },
  start: (c) => {
    chord(c, [392, 493.88, 587.33], { type: 'triangle', dur: 0.25, vol: 0.35 });
    chord(c, [523.25, 659.25, 783.99], { type: 'triangle', start: 0.22, dur: 0.6, vol: 0.35 });
  },
};

export const audio = {
  get enabled() {
    return enabled;
  },
  setEnabled(value) {
    enabled = Boolean(value);
  },
  play(name) {
    if (!enabled) return;
    try {
      const c = context();
      if (c) SOUNDS[name]?.(c);
    } catch {
      /* audio is optional */
    }
  },
};
