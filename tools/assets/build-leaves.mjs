#!/usr/bin/env node
// Draws stylised leaves of trees native to Germany for the image questions
// (catalogs/baumblaetter.csv). Everything is generated from simple shape formulas –
// no external material, the drawings belong to this project.
//
//   node tools/assets/build-leaves.mjs
// Output: catalogs/images/blaetter/<slug>.svg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'catalogs/images/blaetter');
const W = 600;
const H = 450;
const BG = '#f3efe1';
const STEPS = 200;

const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');

// ---- margin modifiers (u = position inside one tooth, 0…1) ----
const saw = (u) => (u < 0.78 ? u / 0.78 : (1 - u) / 0.22); // tooth pointing towards the tip
const round = (u) => Math.sin(Math.PI * u) ** 0.8;
const spike = (u) => (u < 0.5 ? (u / 0.5) ** 2.2 : ((1 - u) / 0.5) ** 2.2);
const frac = (x) => x - Math.floor(x);

/**
 * A simple leaf along the vertical axis. All lengths are fractions of `len` (leaf length in px).
 * @param {object} o
 *   width(t)  half width at t (0 = base, 1 = tip), as fraction of len
 *   teeth     [{ n, amp, kind, from, to }] margin teeth
 *   baseL/baseR  t where the left/right margin meets the midrib (asymmetric bases)
 *   cordate   depth of heart-shaped base lobes below the attachment (fraction of len)
 *   notch     depth of a notched (emarginate) tip
 */
function simpleLeaf(o) {
  const { len, width, widthL = width, teeth = [], baseL = 0, baseR = 0, cordate = 0, notch = 0, skewL = 1, steps = STEPS } = o;
  const edge = (t, side) => {
    let w = side < 0 ? widthL(t) * skewL : width(t);
    if (w <= 0) return 0;
    for (const z of teeth) {
      if (t < (z.from ?? 0.03) || t > (z.to ?? 0.97)) continue;
      const fade = Math.min(1, (t - (z.from ?? 0.03)) / 0.06, ((z.to ?? 0.97) - t) / 0.06);
      const f = z.kind === 'round' ? round : z.kind === 'spike' ? spike : saw;
      w += z.amp * fade * f(frac(t * z.n + (z.phase ?? 0)));
    }
    return w;
  };
  const side = (s, t0) => {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((1 - t0) * i) / steps;
      out.push([s * edge(t, s) * len, -t * len]);
    }
    return out;
  };
  const right = side(1, baseR); // base → tip
  const left = side(-1, baseL).reverse(); // tip → base
  const path = [];
  // start at the attachment, right margin up to the tip, left margin back down
  const startR = cordate ? heartLobe(1, right[0], len, cordate) : [[0, -baseR * len]];
  const endL = cordate ? heartLobe(-1, left[left.length - 1], len, cordate).reverse() : [[0, -baseL * len]];
  path.push(...startR, ...right);
  if (notch) path.push([0, -(1 - notch) * len]);
  path.push(...left, ...endL);
  return path;
}

/** Rounded lobe below the attachment point for heart-shaped bases. */
function heartLobe(s, [x, y], len, depth) {
  const out = [[0, 0]];
  for (let i = 1; i < 24; i++) {
    const a = (i / 24) * Math.PI;
    out.push([s * (Math.abs(x) * 0.5 * (1 - Math.cos(a))) , depth * len * Math.sin(a) + (y * i) / 24]);
  }
  return out;
}

/** Lateral veins of a pinnately veined leaf. */
function veins({ len, width, n, from = 0.08, to = 0.85, rise = 0.1, reach = 0.82, skewL = 1 }) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = from + ((to - from) * i) / (n + 1);
    for (const s of [-1, 1]) {
      const te = Math.min(0.99, t + rise);
      const w = width(te) * (s < 0 ? skewL : 1) * reach;
      out.push(`M0 ${r1(-t * len)}Q${r1(s * w * len * 0.45)} ${r1(-(t + rise * 0.35) * len)} ${r1(s * w * len)} ${r1(-te * len)}`);
    }
  }
  return out.join('');
}

function leafSvg({ path, veinsD = '', midrib = true, len, petiole = 0.1, fill, edge, vein, petioleColor, extra = '' }) {
  return (
    `<path d="M${pts(path)}Z" fill="${fill}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>` +
    (veinsD ? `<path d="${veinsD}" stroke="${vein}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '') +
    (midrib ? `<path d="M0 0L0 ${r1(-len * 0.97)}" stroke="${vein}" stroke-width="2.6" stroke-linecap="round"/>` : '') +
    (petiole ? `<path d="M0 0L0 ${r1(petiole * len)}" stroke="${petioleColor ?? edge}" stroke-width="4" stroke-linecap="round"/>` : '') +
    extra
  );
}

/** Complete simple leaf: shape + veins, placed in the card. */
function simple(o) {
  const path = simpleLeaf(o);
  const veinsD = o.veins === false ? '' : veins({ len: o.len, width: o.width, skewL: o.skewL, ...(o.veinOpts ?? {}) });
  return leafSvg({ ...o, path, veinsD });
}

const card = (inner, { x = W / 2, y = 410, rot = -8, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/><g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">${inner}</g></svg>\n`;

// ---- shape helpers (half width as a function of t) ----
const beta = (a, b) => {
  const peak = a / (a + b);
  const m = peak ** a * (1 - peak) ** b;
  return (t) => (t <= 0 || t >= 1 ? 0 : (t ** a * (1 - t) ** b) / m);
};
const scaled = (f, k) => (t) => f(t) * k;

const GREEN = { fill: '#5c9e3c', edge: '#2f6b23', vein: '#9fcf7c' };

const leaves = {};

// Stieleiche – obovate with 4–5 rounded lobes per side (staggered), short petiole, small ear-like base lobes
{
  const env = beta(1.6, 0.7);
  const make = (phase) => (t) => {
    if (t <= 0 || t >= 1) return 0;
    const lobes = 0.28 + 0.72 * Math.abs(Math.sin(Math.PI * (t * 4.3 + phase))) ** 0.55;
    const ear = t < 0.1 ? 0.07 * Math.sin((t / 0.1) * Math.PI) : 0;
    return 0.37 * env(t) * lobes + ear;
  };
  const width = make(0.05);
  leaves.eiche = card(
    simple({ len: 340, width, widthL: make(0.3), petiole: 0.04, ...GREEN, fill: '#4f8f33', veinOpts: { n: 5, from: 0.06, to: 0.9, rise: 0.08, reach: 0.7 } }),
    { y: 400, rot: -4 },
  );
}

// Rotbuche – elliptic, slightly wavy margin, straight parallel veins
{
  const width = scaled(beta(1.1, 1.0), 0.3);
  leaves.buche = card(
    simple({ len: 320, width, petiole: 0.06, teeth: [{ n: 8, amp: 0.008, kind: 'round', from: 0.12, to: 0.9 }], ...GREEN, fill: '#69a843', veinOpts: { n: 7, from: 0.04, to: 0.92, rise: 0.12, reach: 0.95 } }),
    { y: 400 },
  );
}

// Hainbuche – ovate, pointed, double-serrated, many parallel veins
{
  const width = (t) => 0.26 * beta(1.0, 1.4)(t) * (t > 0.82 ? 1 - (t - 0.82) * 1.2 : 1);
  leaves.hainbuche = card(
    simple({
      len: 320,
      width,
      petiole: 0.05,
      teeth: [
        { n: 13, amp: 0.022, from: 0.1, to: 0.96 },
        { n: 39, amp: 0.008, from: 0.1, to: 0.96 },
      ],
      ...GREEN,
      fill: '#5fa13f',
      veinOpts: { n: 12, from: 0.03, to: 0.93, rise: 0.1, reach: 0.98 },
    }),
    { y: 395 },
  );
}

// Winterlinde – heart-shaped base, finely serrated, short drawn-out tip
{
  const env = beta(0.6, 1.25);
  const width = (t) => (t >= 1 ? 0 : 0.42 * env(0.12 + t * 0.88) * (t > 0.85 ? Math.max(0.2, 1 - (t - 0.85) * 3) : 1));
  leaves.linde = card(
    simple({ len: 300, width, cordate: 0.09, skewL: 1.08, petiole: 0.22, teeth: [{ n: 24, amp: 0.012, from: 0.02, to: 0.96 }], ...GREEN, fill: '#6aaa45', veinOpts: { n: 5, from: 0.0, to: 0.8, rise: 0.13, reach: 0.9 } }),
    { y: 350, rot: -14 },
  );
}

// Hängebirke – triangular (deltoid), truncate base, long tip, double-serrated
{
  const width = (t) => (t <= 0 || t >= 1 ? 0 : t < 0.18 ? 0.32 + (t / 0.18) * 0.06 : 0.38 * ((1 - t) / 0.82) ** 1.25);
  leaves.birke = card(
    simple({
      len: 270,
      width,
      petiole: 0.28,
      teeth: [
        { n: 11, amp: 0.03, from: 0.05, to: 0.9 },
        { n: 33, amp: 0.009, from: 0.05, to: 0.9 },
      ],
      ...GREEN,
      fill: '#7cb84e',
      veinOpts: { n: 6, from: 0.02, to: 0.8, rise: 0.1, reach: 0.95 },
    }),
    { y: 330, rot: 10 },
  );
}

// Silberweide – long and narrow, finely serrated, grey-green
{
  const width = scaled(beta(1.2, 1.2), 0.085);
  leaves.weide = card(
    simple({ len: 380, width, petiole: 0.03, teeth: [{ n: 40, amp: 0.004, from: 0.05, to: 0.95 }], fill: '#8fb07a', edge: '#4d6b3e', vein: '#d6e6c8', veinOpts: { n: 14, from: 0.05, to: 0.92, rise: 0.06, reach: 0.9 } }),
    { y: 415, rot: 28 },
  );
}

// Zitterpappel (Espe) – nearly round, coarse rounded teeth, long flat petiole
{
  const width = (t) => (t <= 0 || t >= 1 ? 0 : 0.47 * Math.sqrt(1 - (2 * t - 0.9) ** 2 / 1.2) * (t > 0.88 ? Math.max(0.35, 1 - (t - 0.88) * 5) : 1));
  leaves.espe = card(
    simple({ len: 230, width, petiole: 0.42, teeth: [{ n: 9, amp: 0.025, kind: 'round', from: 0.08, to: 0.92 }], ...GREEN, fill: '#6fae4a', veinOpts: { n: 4, from: 0.0, to: 0.75, rise: 0.15, reach: 0.85 } }),
    { y: 300, rot: -12 },
  );
}

// Schwarzerle – roundish obovate with notched tip, serrated
{
  const width = (t) => (t <= 0 ? 0 : 0.4 * beta(1.4, 0.55)(Math.min(t, 0.999)) + (t > 0.97 ? 0.06 : 0));
  leaves.erle = card(
    simple({ len: 270, width, notch: 0.05, petiole: 0.15, teeth: [{ n: 12, amp: 0.018, from: 0.12, to: 0.95 }], ...GREEN, fill: '#3f8034', veinOpts: { n: 6, from: 0.04, to: 0.86, rise: 0.11, reach: 0.95 } }),
    { y: 370, rot: -6 },
  );
}

// Bergulme – asymmetric base, double-serrated, pointed
{
  const width = (t) => 0.3 * beta(1.25, 0.95)(t) * (t > 0.86 ? Math.max(0.15, 1 - (t - 0.86) * 4) : 1);
  leaves.ulme = card(
    simple({
      len: 330,
      width,
      baseR: 0.07,
      skewL: 1.12,
      petiole: 0.03,
      teeth: [
        { n: 15, amp: 0.022, from: 0.1, to: 0.95 },
        { n: 45, amp: 0.007, from: 0.1, to: 0.95 },
      ],
      ...GREEN,
      fill: '#4e8c35',
      veinOpts: { n: 13, from: 0.05, to: 0.92, rise: 0.09, reach: 0.98 },
    }),
    { y: 405, rot: -4 },
  );
}

// Vogelkirsche – obovate-elliptic, long tip, serrated, red petiole with two glands
{
  const width = (t) => 0.24 * beta(1.4, 0.95)(t) * (t > 0.84 ? Math.max(0.1, 1 - (t - 0.84) * 5.5) : 1);
  leaves.vogelkirsche = card(
    simple({
      len: 300,
      width,
      petiole: 0.18,
      petioleColor: '#a33a3a',
      teeth: [{ n: 26, amp: 0.012, from: 0.08, to: 0.94 }],
      ...GREEN,
      fill: '#5fa03e',
      extra: `<circle cx="-4" cy="${r1(0.1 * 300)}" r="4" fill="#b23b3b"/><circle cx="4" cy="${r1(0.12 * 300)}" r="4" fill="#b23b3b"/>`,
      veinOpts: { n: 8, from: 0.05, to: 0.88, rise: 0.11, reach: 0.9 },
    }),
    { y: 360, rot: 12 },
  );
}

// Stechpalme – leathery, glossy dark green, spiny wavy margin
{
  const width = scaled(beta(1.1, 1.0), 0.22);
  const leaf = simple({ len: 260, width, petiole: 0.06, teeth: [{ n: 4.5, amp: 0.07, kind: 'spike', from: 0.06, to: 0.96, phase: 0.5 }], fill: '#2f6b2e', edge: '#1d4a1e', vein: '#6fa36a', veinOpts: { n: 4, from: 0.1, to: 0.8, rise: 0.12, reach: 0.6 } });
  leaves.stechpalme = card(leaf + `<ellipse cx="-14" cy="-160" rx="10" ry="46" fill="#fff" opacity=".18" transform="rotate(-6 -14 -160)"/>`, { y: 360, rot: -20 });
}

// Spitzahorn – palmate, 5 lobes with long pointed teeth, wide rounded sinuses (hand-placed outline)
{
  // right half from the petiole to the top of the middle lobe; [x, y] = corner, ['q', cx, cy, x, y] = rounded sinus
  const half = [
    ['q', 18, 4, 40, -2],
    [92, 30], [84, 6], [152, 4], [112, -24],
    ['q', 92, -40, 104, -62],
    [146, -58], [128, -82], [182, -122], [134, -118], [150, -166], [112, -134],
    ['q', 74, -116, 52, -146],
    [88, -178], [52, -176], [0, -238],
  ];
  const mirror = half.slice(0, -1).reverse().map((p) => (p[0] === 'q' ? p : [-p[0], p[1]]));
  // sinus control points must be mirrored with their end points shifted: rebuild left side explicitly
  const left = [];
  for (let i = half.length - 2; i >= 0; i--) {
    const p = half[i];
    const prev = i > 0 ? half[i - 1] : [0, 0];
    const end = prev[0] === 'q' ? [-prev[3], prev[4]] : [-prev[0], prev[1]];
    if (p[0] === 'q') left.push(['q', -p[1], p[2], ...end]);
    else left.push(end);
  }
  void mirror;
  const seg = (p) => (p[0] === 'q' ? `Q${p[1]} ${p[2]} ${p[3]} ${p[4]}` : `L${p[0]} ${p[1]}`);
  const d = `M0 0${half.map(seg).join('')}${left.map(seg).join('')}Z`;
  const veinsD = [[0, -228], [170, -116], [-170, -116], [140, 2], [-140, 2]].map(([x, y]) => `M0 -8L${x * 0.88} ${y * 0.88}`).join('');
  const inner =
    `<path d="${d}" fill="#5a9d3a" stroke="#2f6b23" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="${veinsD}" stroke="#a6d283" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M0 0L0 140" stroke="#2f6b23" stroke-width="4" stroke-linecap="round"/>`;
  leaves.ahorn = card(inner, { y: 290, rot: -8, scale: 1.05 });
}

// Pinnate leaves: leaflets on a rachis
function pinnate({ pairs, gap, leafletLen, leafletWidth, teeth, fill, edge, vein, angle, rachis }) {
  const leaflet = (len) => {
    const path = simpleLeaf({ len, width: leafletWidth, teeth, steps: 90 });
    return `<path d="M${pts(path)}Z" fill="${fill}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 0L0 ${r1(-len * 0.95)}" stroke="${vein}" stroke-width="1.4"/>`;
  };
  let out = `<path d="M0 0L0 ${r1(-(rachis + gap * 0.2))}" stroke="${edge}" stroke-width="3.5" stroke-linecap="round"/>`;
  for (let i = 0; i < pairs; i++) {
    const y = -(rachis - gap * (pairs - 1 - i)) + gap * 0.2 - gap * 0.6;
    const len = leafletLen * (0.82 + 0.18 * (i / Math.max(1, pairs - 1)));
    for (const s of [-1, 1]) out += `<g transform="translate(0 ${r1(y)}) rotate(${s * angle})">${leaflet(len)}</g>`;
  }
  out += `<g transform="translate(0 ${r1(-(rachis + gap * 0.2))})">${leaflet(leafletLen * 1.05)}</g>`;
  return out;
}

leaves.esche = card(
  pinnate({ pairs: 5, gap: 52, rachis: 250, leafletLen: 112, leafletWidth: scaled(beta(1.2, 1.1), 0.17), teeth: [{ n: 9, amp: 0.012, from: 0.15, to: 0.92 }], angle: 62, ...GREEN, fill: '#5a9c3b' }),
  { y: 430, rot: -6, scale: 0.92 },
);

leaves.eberesche = card(
  pinnate({ pairs: 7, gap: 34, rachis: 250, leafletLen: 82, leafletWidth: scaled(beta(1, 1), 0.15), teeth: [{ n: 11, amp: 0.025, from: 0.3, to: 0.95 }], angle: 72, ...GREEN, fill: '#64a542' }),
  { y: 425, rot: 6, scale: 0.95 },
);

fs.mkdirSync(OUT, { recursive: true });
for (const [slug, svg] of Object.entries(leaves)) fs.writeFileSync(path.join(OUT, `${slug}.svg`), svg);
console.log(`blaetter: ${Object.keys(leaves).length} Bilder`);
