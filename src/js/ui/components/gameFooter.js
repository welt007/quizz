import { h } from '../dom.js';

/**
 * Bottom area of a game screen (feedback, "Nächste Frage", …). Sticks to the
 * bottom edge when the question is taller than the screen (phones); only then
 * it gets a backdrop (class is-stuck), so it does not show as a dark band otherwise.
 * When the answer is revealed (a button appears in the footer), the page scrolls
 * just far enough that no answer is hidden behind the footer.
 */
export function gameFooter(...children) {
  const el = h('div', { class: 'game__footer' }, ...children);
  if (typeof IntersectionObserver === 'function') {
    // bottom: -1px in the CSS → while stuck, 1px lies outside the viewport
    new IntersectionObserver(([entry]) => el.classList.toggle('is-stuck', entry.intersectionRatio < 1 && entry.isIntersecting), {
      threshold: [1],
    }).observe(el);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => {
      if (el.querySelector('.actions .btn')) requestAnimationFrame(() => keepAnswersVisible(el));
    }).observe(el, { childList: true, subtree: true });
  }
  return el;
}

function keepAnswersVisible(footer) {
  const answers = footer.parentElement?.querySelector('.answers');
  if (!answers || !footer.isConnected) return;
  const overlap = answers.getBoundingClientRect().bottom - footer.getBoundingClientRect().top + 8;
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
}
