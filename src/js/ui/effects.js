// Visual effects without libraries. All respect prefers-reduced-motion.
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#ffc940', '#ff9f1c', '#5d7cff', '#22b86b', '#e05c9b', '#ffffff'];

/** Confetti burst on a temporary full-screen canvas. */
export function confetti({ count = 140, duration = 2600 } = {}) {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) return canvas.remove();
  g.scale(dpr, dpr);

  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    size: 6 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const t0 = performance.now();
  function frame(now) {
    const t = now - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

/** Re-triggers a CSS animation class on an element. */
export function pulseClass(el, cls, ms = 700) {
  el.classList.remove(cls);
  void el.offsetWidth; // restart animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/**
 * "3 – 2 – 1 – Los!" overlay inside `parent` (it disappears with the screen).
 * @returns {Promise<void>}
 */
export function countdown(parent, { from = 3, onStep } = {}) {
  const el = document.createElement('div');
  el.className = 'countdown';
  el.setAttribute('aria-live', 'assertive');
  parent.append(el);
  const fast = reducedMotion();
  return new Promise((resolve) => {
    let n = from;
    const step = () => {
      el.textContent = n > 0 ? String(n) : 'Los!';
      pulseClass(el, 'is-tick', 600);
      onStep?.(n);
      if (n-- > 0) setTimeout(step, fast ? 400 : 750);
      else setTimeout(() => (el.remove(), resolve()), fast ? 200 : 500);
    };
    step();
  });
}
