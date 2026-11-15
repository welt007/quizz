#!/usr/bin/env node
// Generates the fruit and vegetable pictures for the image questions (catalogs/obst-gemuese.csv).
//
// Most motifs come from Microsoft "Fluent Emoji Flat" (MIT licence, via the Iconify JSON package);
// fruits and vegetables missing there (kohlrabi, asparagus, leek …) are drawn here in the same
// flat style – those drawings belong to this project.
//
// One-off asset generator – the package is NOT a project dependency:
//   npm i --no-save @iconify-json/fluent-emoji-flat@1.2.6
//   node tools/assets/build-food-images.mjs
// Output: catalogs/images/obst/<slug>.svg, catalogs/images/gemuese/<slug>.svg
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const emoji = require('@iconify-json/fluent-emoji-flat/icons.json');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BG = '#fdf6e3';

/** slug → [Fluent Emoji name] or [null, own 32×32 drawing] */
const OBST = {
  apfel: ['red-apple'],
  birne: ['pear'],
  mandarine: ['tangerine'],
  zitrone: ['lemon'],
  limette: ['lime'],
  banane: ['banana'],
  wassermelone: ['watermelon'],
  honigmelone: ['melon'],
  weintrauben: ['grapes'],
  erdbeere: ['strawberry'],
  heidelbeeren: ['blueberries'],
  kirschen: ['cherries'],
  pfirsich: ['peach'],
  mango: ['mango'],
  ananas: ['pineapple'],
  kokosnuss: ['coconut'],
  kiwi: ['kiwi-fruit'],
  avocado: ['avocado'],
  zwetschge: [
    null,
    `<path d="M16.5 3.5c.3 2 .1 3.6-.6 5" stroke="#6b4a2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
     <path d="M17 6.5c2.2-2.4 5.3-2.9 7.5-1.6-1.7 2.6-4.6 3.4-7.5 1.6z" fill="#6aa337"/>
     <ellipse cx="16" cy="18" rx="8.2" ry="10" transform="rotate(14 16 18)" fill="#3f2a72"/>
     <path d="M15.4 8.4c-3.3 4.6-3.7 13.3.9 19.5" stroke="#2c1d52" stroke-width="1.1" fill="none" stroke-linecap="round"/>
     <ellipse cx="19.6" cy="15" rx="2.2" ry="4.6" transform="rotate(14 19.6 15)" fill="#8f82c4" opacity=".55"/>`,
  ],
  himbeere: [
    null,
    `<path d="M16 3v4" stroke="#4f8a2b" stroke-width="1.4" stroke-linecap="round"/>
     ${[
       [16, 11, 3.2], [11.5, 13, 3.1], [20.5, 13, 3.1], [9, 17.5, 3.1], [14, 16.3, 3.2], [18.5, 16.3, 3.2], [23, 17.5, 3.1],
       [11, 22, 3.1], [16, 21, 3.2], [21, 22, 3.1], [13.5, 26, 3], [18.5, 26, 3],
     ]
       .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#d8314f" stroke="#a51d39" stroke-width=".6"/><circle cx="${x - 1}" cy="${y - 1}" r=".8" fill="#f6a0b0"/>`)
       .join('')}
     <path d="M16 8.5l-4.5-2 2.6 3.6-4.4 1 5.2.6L16 14l1.1-2.3 5.2-.6-4.4-1 2.6-3.6z" fill="#5f9e33"/>`,
  ],
  johannisbeeren: [
    null,
    `<path d="M5 4c4 1 8 4 10 8s3.5 9 5 14" stroke="#5c7a2a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
     <path d="M5 4c-1.5 3 .3 6 3.2 6.3C9 7.6 7.6 5 5 4z" fill="#6aa337"/>
     ${[
       [11, 10.5, 3], [16.5, 13.5, 3.2], [12.5, 16.5, 3.2], [18.5, 19.5, 3.3], [14.5, 22.5, 3.3], [20.5, 26, 3.3],
     ]
       .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#d4203a" stroke="#9e1228" stroke-width=".6"/><circle cx="${x - 1}" cy="${y - 1.1}" r="1" fill="#fff" opacity=".7"/>`)
       .join('')}`,
  ],
  stachelbeere: [
    null,
    `<path d="M16 3.5v4.5" stroke="#6b5a2b" stroke-width="1.3" stroke-linecap="round"/>
     <circle cx="16" cy="18" r="10" fill="#a9c94c"/>
     ${[-6, -3, 0, 3, 6].map((dx) => `<path d="M16 8.2c${dx * 0.9} 3 ${dx * 0.9} 16.6 0 19.6" stroke="#dbe9a0" stroke-width=".9" fill="none"/>`).join('')}
     <ellipse cx="12.5" cy="13.5" rx="2.2" ry="3" fill="#fff" opacity=".35"/>
     <path d="M16 28v2.5M15 28.2l-1.2 1.8M17 28.2l1.2 1.8" stroke="#6b5a2b" stroke-width=".9" stroke-linecap="round"/>`,
  ],
};

const GEMUESE = {
  tomate: ['tomato'],
  aubergine: ['eggplant'],
  kartoffel: ['potato'],
  karotte: ['carrot'],
  mais: ['ear-of-corn'],
  chili: ['hot-pepper'],
  paprika: ['bell-pepper'],
  gurke: ['cucumber'],
  brokkoli: ['broccoli'],
  knoblauch: ['garlic'],
  zwiebel: ['onion'],
  kidneybohnen: ['beans'],
  ingwer: ['ginger-root'],
  erbsen: ['pea-pod'],
  kuerbis: [
    null,
    `<path d="M16 9.5c-1.6 0-3 .6-4.3 1.6C7.2 9.6 3 12.6 3 19.3 3 26 7.6 29.6 11.3 28.4c1.4.8 3 1.2 4.7 1.2s3.3-.4 4.7-1.2C24.4 29.6 29 26 29 19.3c0-6.7-4.2-9.7-8.7-8.2-1.3-1-2.7-1.6-4.3-1.6z" fill="#e8762b"/>
     <path d="M11.6 11.3c-2.6 4.4-2.6 12.6-.3 17M20.4 11.3c2.6 4.4 2.6 12.6.3 17M16 10v19.3" stroke="#c25a16" stroke-width="1.1" fill="none" stroke-linecap="round"/>
     <path d="M15 10.2c-.1-2.4.6-4.6 2.3-6.2l1.6 1.1c-1.3 1.3-1.9 3-1.8 5.2z" fill="#5d7f22"/>
     <path d="M18.3 5.8c2.2-1.4 4.6-.8 5.4 1.2" stroke="#7ba428" stroke-width="1.2" fill="none" stroke-linecap="round"/>
     <ellipse cx="8.5" cy="16.5" rx="1.6" ry="3.2" fill="#f6a35f" opacity=".7"/>`,
  ],
  radieschen: [
    null,
    `<path d="M16 11.5l-3-6M16 11.5l3-6M16 11.5V5" stroke="#3e7a1e" stroke-width="1" stroke-linecap="round"/>
     <ellipse cx="11.6" cy="5.6" rx="3" ry="5" transform="rotate(-32 11.6 5.6)" fill="#5da130"/>
     <ellipse cx="20.4" cy="5.6" rx="3" ry="5" transform="rotate(32 20.4 5.6)" fill="#4e8f27"/>
     <circle cx="16" cy="18" r="7.4" fill="#d7263d"/>
     <path d="M9.4 21.3c1.5 2.6 3.9 4.1 6.6 4.1s5.1-1.5 6.6-4.1c-1.8 1-4 1.6-6.6 1.6s-4.8-.6-6.6-1.6z" fill="#f4f1ea"/>
     <path d="M16 25.4c0 2 .3 3.8.8 5" stroke="#e9e2d0" stroke-width="1" fill="none" stroke-linecap="round"/>
     <ellipse cx="13" cy="15" rx="1.6" ry="2.4" fill="#fff" opacity=".35"/>`,
  ],
  'rote-bete': [
    null,
    `<path d="M16 13l-5-8M16 13V4M16 13l5-8" stroke="#a0204f" stroke-width="1.2" stroke-linecap="round"/>
     <ellipse cx="9.8" cy="5" rx="2.8" ry="4.6" transform="rotate(-35 9.8 5)" fill="#3d7a2a"/>
     <ellipse cx="16" cy="3.8" rx="2.6" ry="4.2" fill="#356f24"/>
     <ellipse cx="22.2" cy="5" rx="2.8" ry="4.6" transform="rotate(35 22.2 5)" fill="#3d7a2a"/>
     <path d="M16 12c5.3 0 8.6 3.3 8.6 7.8 0 4.2-3.6 7.2-8.6 9.7-5-2.5-8.6-5.5-8.6-9.7C7.4 15.3 10.7 12 16 12z" fill="#8e1b45"/>
     <path d="M16 29.4v2.3" stroke="#8e1b45" stroke-width="1" stroke-linecap="round"/>
     <path d="M11 17.5c1.5-1.6 3.2-2.2 5-2.2" stroke="#c24a78" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>`,
  ],
  kohlrabi: [
    null,
    `<path d="M11.5 14.5L7 6M16 11V3M20.5 14.5L25 6M10 19l-6-4M22 19l6-4" stroke="#8fb85a" stroke-width="1.2" stroke-linecap="round"/>
     <ellipse cx="6.5" cy="5" rx="2.6" ry="3.8" transform="rotate(-30 6.5 5)" fill="#5e9e35"/>
     <ellipse cx="16" cy="2.8" rx="2.5" ry="3.4" fill="#548f2f"/>
     <ellipse cx="25.5" cy="5" rx="2.6" ry="3.8" transform="rotate(30 25.5 5)" fill="#5e9e35"/>
     <ellipse cx="3.5" cy="14" rx="2.4" ry="3.4" transform="rotate(-60 3.5 14)" fill="#68a83c"/>
     <ellipse cx="28.5" cy="14" rx="2.4" ry="3.4" transform="rotate(60 28.5 14)" fill="#68a83c"/>
     <circle cx="16" cy="20" r="8.6" fill="#b9d97c"/>
     <path d="M13 16.5l-1.2-1.3M19 16.5l1.2-1.3M11 21.5l-1.6-.6M21 21.5l1.6-.6" stroke="#93b955" stroke-width="1" stroke-linecap="round"/>
     <ellipse cx="13" cy="18" rx="2" ry="3" fill="#fff" opacity=".3"/>
     <path d="M16 28.6v2" stroke="#93b955" stroke-width="1.2" stroke-linecap="round"/>`,
  ],
  spargel: [
    null,
    `${[9.5, 14.25, 19]
      .map(
        (x, i) => `<path d="M${x} ${9 - i}l1.75-4.5 1.75 4.5V29h-3.5z" fill="${['#7db343', '#6ea53a', '#7db343'][i]}"/>
       <path d="M${x} ${9 - i}l1.75-4.5 1.75 4.5c-.6-.8-1.2-1.2-1.75-1.2S${x + 0.6} ${8.2 - i} ${x} ${9 - i}z" fill="#8a5aa6"/>
       <path d="M${x + 0.4} ${13 - i}l1.35 1.2 1.35-1.2M${x + 0.4} ${17 - i}l1.35 1.2 1.35-1.2" stroke="#4f7f25" stroke-width=".6" fill="none"/>`,
      )
      .join('')}
     <rect x="8.6" y="20" width="14.8" height="2.6" rx="1" fill="#7b4fa0"/>
     <path d="M9.5 29h13" stroke="#e4ddc4" stroke-width="1"/>`,
  ],
  lauch: [
    null,
    `<path d="M14.6 13C12 9 8 6 4.5 5.2c3.4 2.2 6.4 5.6 7.8 9.3zM17.4 13c2.6-4 6.6-7 10.1-7.8-3.4 2.2-6.4 5.6-7.8 9.3zM16 13c-.8-4-.2-8.4 1.6-11.5.6 3.8.4 7.8-.6 11.5z" fill="#2f7a3a"/>
     <rect x="13" y="12" width="6" height="7" fill="#9ccf68"/>
     <rect x="13" y="18.5" width="6" height="9" fill="#f1f1e6"/>
     <path d="M13 18.5h6" stroke="#cfe5a8" stroke-width="1.2"/>
     <path d="M14.5 12.5v15M17.5 12.5v15" stroke="#d6dcc2" stroke-width=".5"/>
     <path d="M13.6 27.5l-1.5 3M15 27.5l-.5 3.2M16.5 27.5l.3 3.2M18 27.5l1.3 3" stroke="#b9a986" stroke-width=".7" stroke-linecap="round"/>`,
  ],
  blumenkohl: [
    null,
    `<path d="M16 29.5C8 29.5 3 22.5 3 16.5c4 1 7.5 4.5 13 6.5 5.5-2 9-5.5 13-6.5 0 6-5 13-13 13z" fill="#5b9a3b"/>
     <path d="M16 29.5c-3.4-1.8-6.2-4.6-8.3-8.3M16 29.5c3.4-1.8 6.2-4.6 8.3-8.3" stroke="#3f7a26" stroke-width=".8" fill="none"/>
     ${[
       [11, 14.5, 4], [16, 12, 4.6], [21, 14.5, 4], [12.8, 18.8, 4], [19.2, 18.8, 4], [16, 17, 4.2], [9, 18, 3], [23, 18, 3],
     ]
       .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f5efd8" stroke="#dcd1ae" stroke-width=".7"/>`)
       .join('')}`,
  ],
};

function card(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450"><rect width="600" height="450" fill="${BG}"/><svg x="150" y="75" width="300" height="300" viewBox="0 0 32 32">${inner}</svg></svg>\n`;
}

function write(dir, table) {
  const out = path.join(ROOT, 'catalogs/images', dir);
  fs.mkdirSync(out, { recursive: true });
  for (const [slug, [name, own]] of Object.entries(table)) {
    let body = own;
    if (name) {
      const icon = emoji.icons[name];
      if (!icon) throw new Error(`Emoji fehlt: ${name}`);
      if ((icon.width ?? emoji.width ?? 32) !== 32 || (icon.height ?? emoji.height ?? 32) !== 32) throw new Error(`Unerwartete Größe: ${name}`);
      body = icon.body;
    }
    fs.writeFileSync(path.join(out, `${slug}.svg`), card(body.replace(/\s*\n\s*/g, '')));
  }
  console.log(`${dir}: ${Object.keys(table).length} Bilder`);
}

write('obst', OBST);
write('gemuese', GEMUESE);
