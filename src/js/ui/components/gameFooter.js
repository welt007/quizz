import { h } from '../dom.js';

/**
 * Bottom area of a game screen (feedback, "Nächste Frage", …). Sticks to the
 * bottom edge when the question is taller than the screen (phones); only then
 * it gets a backdrop (class is-stuck), so it does not show as a dark band otherwise.
 */
export function gameFooter(...children) {
  const el = h('div', { class: 'game__footer' }, ...children);
  if (typeof IntersectionObserver === 'function') {
    // bottom: -1px in the CSS → while stuck, 1px lies outside the viewport
    new IntersectionObserver(([entry]) => el.classList.toggle('is-stuck', entry.intersectionRatio < 1 && entry.isIntersecting), {
      threshold: [1],
    }).observe(el);
  }
  return el;
}
