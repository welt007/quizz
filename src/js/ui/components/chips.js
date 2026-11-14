import { h } from '../dom.js';

/**
 * Group of toggle chips.
 * @param {Object} opts
 * @param {{value: any, label: string, icon?: string, color?: string, hint?: string}[]} opts.options
 * @param {any[]} opts.selected  initially selected values
 * @param {boolean} [opts.multi=true]
 * @param {(values: any[]) => void} opts.onChange
 * @param {string} opts.label  accessible group label
 */
export function chipGroup({ options, selected, multi = true, onChange, label }) {
  const current = new Set(selected);
  const buttons = options.map((opt) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'chip',
        '--chip': opt.color,
        'aria-pressed': String(current.has(opt.value)),
        onclick: () => toggle(opt.value),
      },
      opt.icon ? h('span', { 'aria-hidden': 'true' }, opt.icon) : null,
      h('span', {}, opt.label),
      opt.hint != null ? h('span', { class: 'chip__hint' }, opt.hint) : null,
    );
    btn.dataset.value = String(opt.value);
    return btn;
  });

  function sync() {
    options.forEach((opt, i) => buttons[i].setAttribute('aria-pressed', String(current.has(opt.value))));
    onChange(options.map((o) => o.value).filter((v) => current.has(v)));
  }
  function toggle(value) {
    if (!multi) current.clear();
    if (multi && current.has(value)) current.delete(value);
    else current.add(value);
    sync();
  }

  const el = h('div', { class: 'chips', role: 'group', 'aria-label': label }, buttons);
  return {
    el,
    setAll(on) {
      current.clear();
      if (on) options.forEach((o) => current.add(o.value));
      sync();
    },
  };
}
