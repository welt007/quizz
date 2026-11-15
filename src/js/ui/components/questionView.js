import { h } from '../dom.js';
import { ANSWER_KEYS } from '../../core/question.js';
import { DIFFICULTIES } from '../../core/catalog.js';
import { openLightbox } from './lightbox.js';
import { icon } from '../icons.js';

/**
 * Question card with four answer buttons.
 * @param {{question: object, answers: string[], correctIndex: number}} prepared
 * @param {{categoryInfo: Function, onAnswer: (index: number) => void, fast?: boolean}} opts
 *   fast: shorter entrance animation (Blitzrunde)
 */
export function questionView(prepared, { categoryInfo, onAnswer, fast = false }) {
  const q = prepared.question;
  const info = categoryInfo(q.category);

  const buttons = prepared.answers.map((text, i) =>
    h(
      'button',
      { class: 'answer', onclick: () => onAnswer(i) },
      h('span', { class: 'answer__key' }, ANSWER_KEYS[i]),
      h('span', { class: 'answer__text' }, text),
      h('span', { class: 'answer__mark', 'aria-hidden': 'true' }),
    ),
  );

  const el = h(
    'section',
    { class: `question${fast ? ' question--fast' : ''}` },
    h(
      'div',
      { class: 'question__meta' },
      h('span', { class: 'question__category', '--cat': info.color }, `${info.icon} ${info.name}`),
      h('span', { 'aria-hidden': 'true' }, '·'),
      h('span', { class: `difficulty difficulty--${q.difficulty}` }, DIFFICULTIES[q.difficulty]),
    ),
    q.image
      ? h(
          'button',
          { type: 'button', class: 'question__zoom', title: 'Bild vergrößern (Z)', 'aria-label': 'Bild zur Frage vergrößern', onclick: () => openLightbox(q.image) },
          h('img', { class: 'question__image', src: q.image, alt: 'Bild zur Frage' }),
        )
      : null,
    h('h2', { class: 'question__text', tabindex: '-1' }, q.question),
    // short answers (flags, numbers …) fit two per row even on phones
    h('div', { class: `answers${prepared.answers.every((a) => String(a).length <= 11) ? ' answers--short' : ''}`, role: 'group', 'aria-label': 'Antworten' }, buttons),
  );

  return {
    el,
    /** Enables/disables answering (e.g. only after buzzing in a duel). */
    setEnabled(on) {
      buttons.forEach((b) => {
        if (!b.classList.contains('is-removed')) b.disabled = !on;
      });
      el.classList.toggle('is-waiting', !on);
    },
    /** Marks the chosen answer as "logged in" and disables all buttons. */
    lock(index) {
      buttons.forEach((b) => (b.disabled = true));
      buttons[index]?.classList.add('is-locked');
    },
    /** 50:50 – removes answers (they stay in place so the layout does not jump). */
    hide(indices) {
      for (const i of indices) {
        buttons[i].disabled = true;
        buttons[i].classList.remove('is-locked');
        buttons[i].classList.add('is-removed');
        buttons[i].setAttribute('aria-hidden', 'true');
      }
    },
    /** Audience joker – shows a percentage bar inside every answer. */
    showAudience(percentages) {
      buttons.forEach((b, i) => {
        b.querySelector('.answer__vote')?.remove();
        if (b.classList.contains('is-removed')) return;
        b.style.setProperty('--vote', `${percentages[i]}%`);
        b.classList.add('has-vote');
        b.append(h('span', { class: 'answer__vote' }, `${percentages[i]} %`));
      });
    },
    /** Shows right/wrong. `chosen` may be null (e.g. after walking away). */
    reveal(chosen) {
      buttons.forEach((b, i) => {
        b.disabled = true;
        b.classList.remove('is-locked');
        const mark = b.querySelector('.answer__mark');
        // screen readers: the ✓/✗ marks are decorative, so say it in words
        const say = (text) => b.append(h('span', { class: 'visually-hidden' }, text));
        if (i === prepared.correctIndex) {
          b.classList.add('is-right');
          mark.replaceChildren(icon('check', { size: 22 }));
          say(i === chosen ? ' – richtig, deine Antwort' : ' – richtige Antwort');
        } else if (i === chosen) {
          b.classList.add('is-wrong');
          mark.replaceChildren(icon('x', { size: 22 }));
          say(' – deine Antwort, falsch');
        } else if (!b.classList.contains('is-removed')) {
          b.classList.add('is-dimmed');
        }
      });
    },
  };
}
