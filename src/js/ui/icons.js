// Line icons (24×24, stroke) for the interface – drawn for this project.
// Built with createElementNS, so no markup strings are ever parsed.
const SVG = 'http://www.w3.org/2000/svg';

const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS = {
  volume: ['M11 5 6 9H3v6h3l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  volumeOff: ['M11 5 6 9H3v6h3l5 4V5z', 'M16 9l6 6', 'M22 9l-6 6'],
  tv: ['M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 21h8', 'M12 17v4'],
  minimize: ['M8 3v3a2 2 0 0 1-2 2H3', 'M21 8h-3a2 2 0 0 1-2-2V3', 'M3 16h3a2 2 0 0 1 2 2v3', 'M16 21v-3a2 2 0 0 1 2-2h3'],
  trophy: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0V4z', 'M17 5h3v2a3 3 0 0 1-3 3', 'M7 5H4v2a3 3 0 0 0 3 3'],
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z', 'M4 19a2 2 0 0 1 2-2h13'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'],
  flame: ['M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8a7 7 0 0 0 7 7z'],
  users: [circle(9, 8, 3.5), 'M2 20a7 7 0 0 1 14 0', 'M16 4.6a3.5 3.5 0 0 1 0 6.8', 'M18 13.5a6.5 6.5 0 0 1 4 6.5'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  medal: [circle(12, 9, 5), 'm9 13.5-1.5 7.5 4.5-2.5 4.5 2.5-1.5-7.5'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  sliders: ['M4 6h9', 'M19 6h1', 'M4 12h3', 'M13 12h7', 'M4 18h11', circle(16, 6, 2.5), circle(10, 12, 2.5), circle(18, 18, 2.5)],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['m5 12 5 5 9-10'],
  keyboard: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  crown: ['M3 7l4 5 5-7 5 7 4-5-2 12H5L3 7z'],
  star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z'],
  refresh: ['M20 11a8 8 0 0 0-14.8-4', 'M4 3v4h4', 'M4 13a8 8 0 0 0 14.8 4', 'M20 21v-4h-4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  folder: ['M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2z', 'M10 21h4'],
  repeat: ['M17 2l3 3-3 3', 'M4 11V9a4 4 0 0 1 4-4h12', 'M7 22l-3-3 3-3', 'M20 13v2a4 4 0 0 1-4 4H4'],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z'],
  mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  flag: ['M5 21V4', 'M5 4h13l-2.5 4.5L18 13H5'],
  xCircle: [circle(12, 12, 9), 'M9 9l6 6', 'M15 9l-6 6'],
  target: [circle(12, 12, 9), circle(12, 12, 5), circle(12, 12, 1)],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  route: [circle(6, 18, 2.5), circle(18, 6, 2.5), 'M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5'],
  shuffle: ['M3 7h4l10 10h4', 'M18 14l3 3-3 3', 'M3 17h4l3-3', 'M14 10l3-3h4', 'M18 4l3 3-3 3'],
  half: [circle(12, 12, 9), 'M12 3v18', 'M12 7.5h4.5', 'M12 12h6', 'M12 16.5h4.5'],
};

/** <svg> with the named icon; decorative (aria-hidden) – label the surrounding control instead. */
export function icon(name, { size = 20, cls = '' } = {}) {
  const svg = document.createElementNS(SVG, 'svg');
  const attrs = {
    class: `icon icon--${name}${cls ? ` ${cls}` : ''}`, width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  for (const d of PATHS[name] ?? []) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

export const ICON_NAMES = Object.keys(PATHS);
