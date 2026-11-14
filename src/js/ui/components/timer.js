import { h } from '../dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const R = 44;
const CIRC = 2 * Math.PI * R;
const LOW_SECONDS = 10;
const MAX_FRAME_MS = 100; // larger gaps (hidden tab, sleep) do not count as elapsed time

/**
 * Countdown ring.
 * @param {{seconds: number, onExpire: Function, onSecond?: (remaining: number) => void}} opts
 */
export function createTimer({ seconds, onExpire, onSecond }) {
  let total = seconds * 1000;
  let remaining = total;
  let running = false;
  let last = 0;
  let raf = 0;
  let lastWhole = seconds;

  const ring = document.createElementNS(SVG, 'circle');
  ring.setAttribute('class', 'timer__ring');
  ring.setAttribute('cx', '50');
  ring.setAttribute('cy', '50');
  ring.setAttribute('r', String(R));
  ring.setAttribute('stroke-dasharray', String(CIRC));
  const track = document.createElementNS(SVG, 'circle');
  track.setAttribute('class', 'timer__track');
  track.setAttribute('cx', '50');
  track.setAttribute('cy', '50');
  track.setAttribute('r', String(R));
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(track, ring);
  const label = h('span', { class: 'timer__value' });
  const el = h('div', { class: 'timer', role: 'timer', 'aria-label': 'Verbleibende Zeit' }, svg, label);

  function render() {
    const whole = Math.ceil(remaining / 1000);
    label.textContent = String(whole);
    ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - remaining / total)));
    el.classList.toggle('is-low', whole <= LOW_SECONDS);
    if (whole !== lastWhole) {
      lastWhole = whole;
      onSecond?.(whole);
    }
  }

  function frame(now) {
    remaining -= Math.min(now - last, MAX_FRAME_MS);
    last = now;
    if (remaining <= 0) {
      remaining = 0;
      running = false;
      render();
      el.classList.add('is-expired');
      onExpire();
      return;
    }
    render();
    raf = requestAnimationFrame(frame);
  }

  render();
  return {
    el,
    start() {
      if (running || remaining <= 0) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    addSeconds(sec) {
      remaining += sec * 1000;
      total = Math.max(total, remaining);
      el.classList.add('is-boosted');
      setTimeout(() => el.classList.remove('is-boosted'), 800);
      render();
    },
    get running() {
      return running;
    },
  };
}
