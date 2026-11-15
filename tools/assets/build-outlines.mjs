#!/usr/bin/env node
// Generates the country silhouettes for the "Umrisse" category as SVG files
// from Natural Earth 1:50m boundaries (public domain, via the world-atlas package).
//
// One-off asset generator – the packages are NOT project dependencies:
//   npm i --no-save world-atlas@2.0.2 topojson-client@3.1.0
//   node tools/assets/build-outlines.mjs <name>...   (English Natural Earth names)
// Output: catalogs/images/umrisse/<slug>.svg
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const topojson = require('topojson-client');
const world = require('world-atlas/countries-50m.json');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'catalogs/images/umrisse');
const W = 600;
const H = 450;
const PAD = 24;
const NEAR_DEG = 5; // keep islands/exclaves within this distance of the main part's bounding box
const MIN_AREA = 0.0015; // … and at least this share of the main part's area
const SIMPLIFY_PX = 0.6;

const features = topojson.feature(world, world.objects.countries).features;

export const slug = (name) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}
function bbox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function bboxDistance(a, b) {
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]);
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
  return Math.hypot(dx, dy);
}
// Douglas–Peucker
function simplify(points, tol) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const len = Math.hypot(x2 - x1, y2 - y1);
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      // closed rings start and end on the same point → use the distance to that point
      const d = len < 1e-9
        ? Math.hypot(points[i][0] - x1, points[i][1] - y1)
        : Math.abs((y2 - y1) * points[i][0] - (x2 - x1) * points[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) (max = d), (idx = i);
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function outline(name) {
  const f = features.find((x) => x.properties.name === name);
  if (!f) throw new Error(`Unbekannt: ${name}`);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  // largest polygon = main part; unwrap longitudes around it (antimeridian)
  const main = polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const lon0 = (bbox(main[0])[0] + bbox(main[0])[2]) / 2;
  const unwrap = (p) => [p[0] - 360 * Math.round((p[0] - lon0) / 360), p[1]];
  const unwrapped = polys.map((poly) => poly.map((ring) => ring.map(unwrap)));
  const mainU = unwrapped[polys.indexOf(main)];
  const mainBox = bbox(mainU[0]);
  const mainArea = ringArea(mainU[0]);
  const kept = unwrapped.filter((poly) => poly === mainU || (ringArea(poly[0]) >= mainArea * MIN_AREA && bboxDistance(bbox(poly[0]), mainBox) <= NEAR_DEG));

  const all = kept.flatMap((p) => p[0]);
  const [minLon, minLat, maxLon, maxLat] = bbox(all);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const project = ([lon, lat]) => [lon * k, -lat];
  const pb = bbox(all.map(project));
  const scale = Math.min((W - 2 * PAD) / (pb[2] - pb[0]), (H - 2 * PAD) / (pb[3] - pb[1]));
  const ox = (W - (pb[2] - pb[0]) * scale) / 2;
  const oy = (H - (pb[3] - pb[1]) * scale) / 2;
  const toPx = (p) => {
    const [x, y] = project(p);
    return [ox + (x - pb[0]) * scale, oy + (y - pb[1]) * scale];
  };
  let d = '';
  for (const poly of kept) {
    for (const ring of poly) {
      const pts = simplify(ring.map(toPx), SIMPLIFY_PX);
      if (pts.length < 4) continue;
      d += `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#1a2160"/>` +
    `<path d="${d}" fill="#f5f3ff" fill-rule="evenodd" stroke="#ffc940" stroke-width="1.5" stroke-linejoin="round"/></svg>\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of process.argv.slice(2)) {
    const svg = outline(name);
    const file = path.join(OUT, `${slug(name)}.svg`);
    fs.writeFileSync(file, svg);
    console.log(`${path.relative(ROOT, file)}  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
