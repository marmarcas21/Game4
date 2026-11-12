// Genera los 70 niveles (7 días x 10) y los escribe en js/levels.js.
// Cada nivel se resuelve con BFS: se garantiza que tiene solución, que la
// dificultad (movimientos mínimos) sube poco a poco y que la mecánica nueva
// de cada día es necesaria para la solución óptima.
//
//   node tools/gen-levels.mjs

import { writeFileSync } from 'node:fs';
import { parseLevel, initState, solve } from '../js/engine.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spec(world, i) {
  const t = i / 9;
  const L = (a, b) => Math.round(a + (b - a) * t);
  switch (world) {
    case 0: return { W: 6, H: 7, lo: L(2, 7) };
    case 1: return { W: 6, H: 8, gems: L(1, 3), lo: L(4, 9) };
    case 2: return { W: 7, H: 9, gems: L(0, 2), spikes: L(2, 6), lo: L(5, 10), need: [/X/g] };
    case 3: return { W: 7, H: 9, gems: L(0, 2), portals: i < 5 ? 1 : 2, lo: L(5, 10), need: [/[ab]/g] };
    case 4: return { W: 7, H: 10, gems: L(1, 2), blocks: L(1, 4), lo: L(6, 11), need: [/B/g] };
    case 5: return { W: 8, H: 10, gems: L(1, 2), arrows: L(2, 5), lo: L(6, 12), need: [/[<>^v]/g] };
    default: return {
      W: 8, H: 11, gems: L(2, 3), spikes: L(3, 5), portals: 1, blocks: 2, arrows: L(2, 3),
      lo: L(9, 15), need: [/X/g, /[ab]/g, /B/g, /[<>^v]/g], needCount: 3,
    };
  }
}

function build(sp, r) {
  const { W, H } = sp;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const dens = 0.1 + r() * 0.1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (r() < dens) g[y][x] = '#';
  const put = (ch) => {
    for (let k = 0; k < 200; k++) {
      const x = (r() * W) | 0, y = (r() * H) | 0;
      if (g[y][x] === '.') { g[y][x] = ch; return; }
    }
  };
  put('S'); put('G');
  for (let k = 0; k < (sp.gems || 0); k++) put('*');
  for (let k = 0; k < (sp.spikes || 0); k++) put('X');
  for (let k = 0; k < (sp.blocks || 0); k++) put('B');
  for (let k = 0; k < (sp.arrows || 0); k++) put('^>v<'[(r() * 4) | 0]);
  for (let k = 0; k < (sp.portals || 0); k++) { put('ab'[k]); put('ab'[k]); }
  return g.map((row) => row.join(''));
}

function minMoves(rows) {
  const p = parseLevel({ rows });
  const s = solve(p, initState(p), 60000);
  return s ? s.moves : Infinity;
}

const strip = (rows, re) => rows.map((s) => s.replace(re, '.'));

const levels = [];
for (let world = 0; world < 7; world++) {
  for (let i = 0; i < 10; i++) {
    const sp = spec(world, i);
    const r = rng(1000 * (world + 1) + i * 37 + 7);
    let best = null;
    for (let attempt = 0; attempt < 60000; attempt++) {
      const rows = build(sp, r);
      const m = minMoves(rows);
      if (m === Infinity) continue;
      const off = m < sp.lo ? sp.lo - m : m > sp.lo + 1 ? m - sp.lo - 1 : 0;
      if (best && off >= best.off) continue;
      const need = sp.need || [];
      const relevant = need.filter((re) => minMoves(strip(rows, re)) !== m).length;
      if (relevant < (sp.needCount || need.length)) continue;
      best = { rows, par: m, off };
      if (off === 0) break;
    }
    if (!best) throw new Error(`Sin nivel para día ${world + 1} nivel ${i + 1}`);
    levels.push({ par: best.par, rows: best.rows });
    console.log(`Día ${world + 1} · ${String(i + 1).padStart(2)}  objetivo ${sp.lo}-${sp.lo + 1}  par ${best.par}`);
  }
}

const body = levels
  .map((l) => `  { par: ${l.par}, rows: [\n${l.rows.map((s) => `    '${s}',`).join('\n')}\n  ] },`)
  .join('\n');
writeFileSync(
  new URL('../js/levels.js', import.meta.url),
  `// GENERADO por tools/gen-levels.mjs — no editar a mano.\nexport const LEVELS = [\n${body}\n];\n`,
);
console.log(`\n${levels.length} niveles escritos en js/levels.js`);
