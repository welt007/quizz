#!/usr/bin/env node
// Generates the Android launcher icon (own design: golden ring with a
// question mark in a spotlight) in all required forms:
//   - adaptive icon (Android 8+): vector drawables for background, foreground, monochrome
//   - PNG mipmaps for Android 7 (square with rounded corners and round)
// One set of shapes → all outputs, so they stay consistent.
//
// Needs Playwright (not a dependency, e.g. `npm i --no-save playwright`) for the PNGs.
// Usage: node tools/assets/build-app-icon.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const res = path.join(root, 'android/app/src/main/res');

// adaptive icon canvas: 108×108, visible safe zone = circle with diameter 66 around the centre
const BG_INNER = '#3a2496';
const BG_OUTER = '#0b0820';
const GOLD = '#ffc940';
const WHITE = '#f5f3ff';
const RING = 'M54,28 A26,26 0 1,1 54,80 A26,26 0 1,1 54,28 Z';
const QUESTION = 'M45.5,46 A8.5,8.5 0 1,1 62.5,46 C62.5,51.5 54,52.5 54,58.5 L54,60.5';
const DOT = 'M54,65.6 A3.6,3.6 0 1,1 54,72.8 A3.6,3.6 0 1,1 54,65.6 Z';
// small "studio lights" around the ring
const SPARKS = [[54, 21], [80, 33.7], [80, 74.3], [28, 33.7], [28, 74.3]]
  .map(([x, y]) => `M${x},${y - 2.4} L${x + 0.8},${y - 0.8} L${x + 2.4},${y} L${x + 0.8},${y + 0.8} L${x},${y + 2.4} L${x - 0.8},${y + 0.8} L${x - 2.4},${y} L${x - 0.8},${y - 0.8} Z`)
  .join(' ')
  .replace(/\d+\.\d{3,}/g, (n) => String(+(+n).toFixed(2)));

const shapes = [
  { d: SPARKS, fill: GOLD, alpha: 0.85 },
  { d: RING, stroke: GOLD, width: 4.5 },
  { d: QUESTION, stroke: WHITE, width: 6.5 },
  { d: DOT, fill: WHITE },
];

// ---- vector drawables
const vector = (body, extraNs = '') => `<?xml version="1.0" encoding="utf-8"?>
<!-- generiert von tools/assets/build-app-icon.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"${extraNs}
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
${body}
</vector>
`;
const vPath = (s, color) => {
  const attrs = [`android:pathData="${s.d}"`];
  if (s.stroke) {
    attrs.push(`android:strokeColor="${color ?? s.stroke}"`, `android:strokeWidth="${s.width}"`,
      'android:strokeLineCap="round"', 'android:strokeLineJoin="round"');
  } else attrs.push(`android:fillColor="${color ?? s.fill}"`);
  if (s.alpha && !color) attrs.push(`android:fillAlpha="${s.alpha}"`);
  return `    <path\n        ${attrs.join('\n        ')} />`;
};
const background = vector(`    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:type="radial"
                android:centerX="54"
                android:centerY="50"
                android:gradientRadius="62"
                android:startColor="${BG_INNER}"
                android:endColor="${BG_OUTER}" />
        </aapt:attr>
    </path>`, '\n    xmlns:aapt="http://schemas.android.com/aapt"');
const foreground = vector(shapes.map((s) => vPath(s)).join('\n'));
const monochrome = vector(shapes.filter((s) => s.d !== SPARKS).map((s) => vPath(s, '#ffffff')).join('\n'));
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;

await mkdir(path.join(res, 'drawable'), { recursive: true });
await mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
await writeFile(path.join(res, 'drawable/ic_launcher_background.xml'), background);
await writeFile(path.join(res, 'drawable/ic_launcher_foreground.xml'), foreground);
await writeFile(path.join(res, 'drawable/ic_launcher_monochrome.xml'), monochrome);
await writeFile(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
await writeFile(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

// ---- PNGs for Android 7 (legacy icons: 48dp, motif slightly larger than in the safe zone)
const svgPath = (s) => s.stroke
  ? `<path d="${s.d}" fill="none" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`
  : `<path d="${s.d}" fill="${s.fill}"${s.alpha ? ` fill-opacity="${s.alpha}"` : ''}/>`;
const legacySvg = (round, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 80 80" width="${size}" height="${size}" style="display:block">
  <defs>
    <radialGradient id="bg" cx="54" cy="50" r="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BG_INNER}"/><stop offset="1" stop-color="${BG_OUTER}"/>
    </radialGradient>
    <clipPath id="clip">${round ? '<circle cx="54" cy="54" r="39"/>' : '<rect x="16" y="16" width="76" height="76" rx="14"/>'}</clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="108" height="108" fill="url(#bg)"/>
    ${shapes.map(svgPath).join('\n    ')}
  </g>
</svg>`;

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright')); // CommonJS: also finds NODE_PATH
} catch {
  console.warn('⚠ Playwright nicht gefunden – nur die Vektor-Icons wurden erzeugt.');
  process.exit(0);
}
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [density, size] of Object.entries(DENSITIES)) {
  await page.setViewportSize({ width: size, height: size });
  const dir = path.join(res, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  for (const [name, round] of [['ic_launcher', false], ['ic_launcher_round', true]]) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${legacySvg(round, size)}</body></html>`);
    await page.locator('svg').screenshot({ path: path.join(dir, `${name}.png`), omitBackground: true });
  }
}
await browser.close();
console.log(`✓ App-Icon erzeugt (${path.relative(root, res)})`);
