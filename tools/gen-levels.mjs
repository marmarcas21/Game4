// Genera los 80 niveles y los escribe en js/levels.js.
//
//   node tools/gen-levels.mjs
//
// Cada jardín se construye al revés: se plantan semillas al azar en una rejilla
// y la tierra del nivel es justo lo que floreció, así que siempre tiene solución.
// La dificultad se mide con el solucionador: qué parte de los primeros
// movimientos posibles deja el jardín todavía resoluble (cuanto menos, más difícil).

import { writeFileSync } from 'node:fs';
import { SPECIES, growth, parseLevel, solve } from '../js/engine.js';

const TOTAL = 80;
// [primer nivel, especies permitidas, especie nueva, ancho, alto, semillas de..a]
const TIERS = [
  [2, 'D', '', 4, 4, 2, 4],
  [7, 'DTL', 'TL', 5, 5, 3, 5],
  [15, 'DTLC', 'C', 5, 6, 4, 6],
  [25, 'DTLCR', 'R', 6, 6, 5, 7],
  [37, 'DTLCRS', 'S', 6, 7, 5, 8],
  [51, 'DTLCRSP', 'P', 6, 7, 6, 8],
  [65, 'DTLCRSP', '', 6, 8, 7, 10],
  [TOTAL + 1],
];
const MIN_COVER = { D: 3, T: 2, L: 2, C: 1, R: 4, S: 3, P: 2 };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spec(n) {
  const ti = TIERS.findIndex(([from], k) => n >= from && n < TIERS[k + 1][0]);
  const [from, allowed, fresh, W, H, lo, hi] = TIERS[ti];
  const pos = (n - from) / Math.max(1, TIERS[ti + 1][0] - from - 1);
  const intro = n === from && fresh !== '';
  return { allowed, fresh, W, H, pos, intro, seeds: intro ? Math.max(3, lo - 1) : Math.round(lo + (hi - lo) * pos) };
}

function connected(cells, w, h) {
  const start = cells.findIndex((v) => v !== -1);
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const c = stack.pop(), x = c % w, y = (c / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, i = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || cells[i] === -1 || seen.has(i)) continue;
      seen.add(i); stack.push(i);
    }
  }
  return seen.size === cells.filter((v) => v !== -1).length;
}

function candidate(sp, r) {
  const { W, H } = sp;
  const cells = new Int8Array(W * H);
  const dens = 0.12 + r() * 0.2;
  for (let i = 0; i < cells.length; i++) if (r() < dens) cells[i] = -1;
  const pool = sp.allowed.split('').flatMap((ch) => Array(ch === 'C' ? 1 : sp.fresh.includes(ch) ? 5 : 3).fill(ch));
  const forced = sp.fresh.split(''); // la especie nueva aparece seguro
  const seeds = [], planted = [];
  for (let k = 0; k < sp.seeds; k++) {
    let done = false;
    for (let t = 0; t < 30 && !done; t++) {
      const ch = k < forced.length ? forced[k] : pool[(r() * pool.length) | 0];
      if (ch === 'C' && seeds.filter((x) => x === 'C').length >= 2) continue;
      const c = (r() * cells.length) | 0;
      if (cells[c] !== 0) continue;
      const s = SPECIES.indexOf(ch);
      const cover = growth(cells, W, H, s, c);
      if (cover.length < MIN_COVER[ch]) continue;
      for (const { i } of cover) cells[i] = s + 1;
      seeds.push(ch);
      planted.push([s, c]);
      done = true;
    }
    if (!done) return null;
  }
  // la tierra es lo que floreció; se recortan filas y columnas vacías
  const soil = (x, y) => cells[y * W + x] > 0;
  const xs = [...Array(W).keys()].filter((x) => [...Array(H).keys()].some((y) => soil(x, y)));
  const ys = [...Array(H).keys()].filter((y) => [...Array(W).keys()].some((x) => soil(x, y)));
  const x0 = xs[0], x1 = xs[xs.length - 1], y0 = ys[0], y1 = ys[ys.length - 1];
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const g = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += soil(x, y) ? 'o' : '.';
    g.push(row);
  }
  // la secuencia con la que se construyó es una solución: se guarda para las pistas
  const sol = planted.map(([s, c]) => [s, (((c / W) | 0) - y0) * (x1 - x0 + 1) + (c % W) - x0]);
  const lv = { sol, g, s: seeds.sort((a, b) => SPECIES.indexOf(a) - SPECIES.indexOf(b)).join('') };
  const p = parseLevel(lv);
  if (!connected(p.cells, p.w, p.h)) return null;

  // dificultad: fracción de primeros movimientos que no estropean el jardín
  let good = 0, total = 0;
  for (let s = 0; s < p.counts.length; s++) {
    if (!p.counts[s]) continue;
    for (let c = 0; c < p.cells.length; c++) {
      if (p.cells[c] !== 0) continue;
      total++;
      const cells2 = p.cells.slice(), counts2 = p.counts.slice();
      for (const { i } of growth(cells2, p.w, p.h, s, c)) cells2[i] = s + 1;
      counts2[s]--;
      const r = solve(cells2, p.w, p.h, counts2, 3000);
      if (r && r.moves) good++;
    }
  }
  if (!good) return null;
  return { lv, ease: good / total };
}

const levels = [{ g: ['.o.', 'ooo', '.o.'], s: 'D', sol: [[0, 4]] }]; // nivel 1: una margarita
for (let n = 2; n <= TOTAL; n++) {
  const sp = spec(n);
  const r = rng(n * 7919 + 101);
  const pool = [];
  for (let tries = 0; pool.length < 14 && tries < 4000; tries++) {
    const c = candidate(sp, r);
    if (c && !pool.some((q) => q.lv.g.join() === c.lv.g.join())) pool.push(c);
  }
  if (!pool.length) throw new Error(`Nivel ${n}: no salió ningún jardín`);
  pool.sort((a, b) => b.ease - a.ease); // de fácil a difícil
  const pick = pool[sp.intro ? 0 : Math.round((pool.length - 1) * (0.1 + 0.85 * sp.pos))];
  levels.push(pick.lv);
  console.log(`Nivel ${String(n).padStart(2)}  ${pick.lv.s.padEnd(10)}  ${pick.lv.g[0].length}x${pick.lv.g.length}  buenos comienzos ${(pick.ease * 100).toFixed(0)}%`);
}

const body = levels
  .map((l) => `  { s: '${l.s}', g: [${l.g.map((row) => `'${row}'`).join(', ')}], sol: ${JSON.stringify(l.sol)} },`)
  .join('\n');
writeFileSync(
  new URL('../js/levels.js', import.meta.url),
  `// GENERADO por tools/gen-levels.mjs — no editar a mano.\n// g: jardín ('o' tierra, '.' hueco) · s: semillas\n// sol: una solución, como pares [especie, casilla] en orden.\nexport const LEVELS = [\n${body}\n];\n`,
);
console.log(`\n${levels.length} niveles escritos en js/levels.js`);
