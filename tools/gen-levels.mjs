// Genera los 100 niveles y los escribe en js/levels.js.
// Cada nivel se comprueba con el solucionador, así que todos tienen solución.
//
//   node tools/gen-levels.mjs
//
// Tipos: n = normal, m = misterio (colores ocultos), r = reto (una sola botella vacía).

import { writeFileSync } from 'node:fs';
import { CAP, isComplete, solve } from '../js/engine.js';

const TOTAL = 100;
const PALETTE = 12;
// Nivel en el que empieza cada tramo y cuántos colores tiene.
const TIERS = [[1, 2], [2, 3], [4, 4], [7, 5], [12, 6], [19, 7], [28, 8], [39, 9], [53, 10], [69, 11], [85, 12], [TOTAL + 1, 12]];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function spec(n) {
  const ti = TIERS.findIndex(([from], k) => n >= from && n < TIERS[k + 1][0]);
  const [from, colors] = TIERS[ti];
  const pos = (n - from) / Math.max(1, TIERS[ti + 1][0] - from - 1); // 0..1 dentro del tramo
  if (n >= 10 && n % 10 === 0) return { type: 'r', colors: Math.min(7, Math.max(4, colors - 3)), empties: 1, pos };
  if (n >= 14 && n % 4 === 2) return { type: 'm', colors: Math.max(4, colors - 1), empties: 2, pos };
  return { type: 'n', colors, empties: 2, pos };
}

function candidate(sp, r) {
  const ids = shuffle([...Array(PALETTE).keys()], r).slice(0, sp.colors);
  const units = shuffle(ids.flatMap((c) => Array(CAP).fill(c)), r);
  const bottles = [];
  for (let i = 0; i < sp.colors; i++) bottles.push(units.slice(i * CAP, (i + 1) * CAP));
  for (let i = 0; i < sp.empties; i++) bottles.push([]);
  if (bottles.some(isComplete)) return null;
  const sol = solve(bottles, sp.type === 'r' ? 30000 : 120000);
  return sol ? { bottles, nodes: sol.nodes, len: sol.moves.length } : null;
}

const levels = [{ t: 'n', b: [[0, 0, 0, 5], [5, 5, 5, 0], []] }]; // nivel 1: tutorial de 3 movimientos
for (let n = 2; n <= TOTAL; n++) {
  const sp = spec(n);
  const r = rng(n * 7919 + 13);
  const want = sp.type === 'r' ? 4 : 10;
  const pool = [];
  for (let tries = 0; pool.length < want && tries < 6000; tries++) {
    const c = candidate(sp, r);
    if (c) pool.push(c);
  }
  if (!pool.length) throw new Error(`Nivel ${n}: no se encontró ningún reparto con solución`);
  pool.sort((a, b) => a.nodes - b.nodes);
  const pick = pool[Math.round((pool.length - 1) * (0.15 + 0.7 * sp.pos))];
  levels.push({ t: sp.type, b: pick.bottles });
  console.log(`Nivel ${String(n).padStart(3)}  ${sp.type}  ${sp.colors} colores  ${sp.empties} vacías  esfuerzo ${pick.nodes}`);
}

const body = levels
  .map((l) => `  { t: '${l.t}', b: [${l.b.map((b) => `'${b.map((c) => c.toString(PALETTE)).join('')}'`).join(', ')}] },`)
  .join('\n');
writeFileSync(
  new URL('../js/levels.js', import.meta.url),
  `// GENERADO por tools/gen-levels.mjs — no editar a mano.\n// Cada botella es una cadena de colores (dígitos en base 12) de abajo arriba.\nexport const LEVELS = [\n${body}\n];\n`,
);
console.log(`\n${levels.length} niveles escritos en js/levels.js`);
