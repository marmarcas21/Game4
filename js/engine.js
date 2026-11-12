// Lógica pura del juego (sin DOM). La usan el juego y el generador de niveles.
//
// Caracteres de un nivel:
//   #  muro            .  suelo           S  inicio         G  salida
//   *  gema            X  pinchos         B  bloque frágil
//   ^ > v <  flechas   a b c d  portales (por parejas)

export const DX = [0, 1, 0, -1]; // 0 arriba, 1 derecha, 2 abajo, 3 izquierda
export const DY = [-1, 0, 1, 0];

export const FLOOR = 0, WALL = 1, SPIKE = 2;
const ARROWS = { '^': 0, '>': 1, 'v': 2, '<': 3 };

export function parseLevel(lv) {
  const h = lv.rows.length, w = lv.rows[0].length, n = w * h;
  const p = {
    w, h, n, par: lv.par || 0,
    type: new Uint8Array(n),
    gemAt: new Int8Array(n).fill(-1),
    blockAt: new Int8Array(n).fill(-1),
    arrowAt: new Int8Array(n).fill(-1),
    portalTo: new Int16Array(n).fill(-1),
    portalId: new Int8Array(n).fill(-1),
    gems: [], blocks: [], start: 0, goal: -1,
  };
  const open = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = lv.rows[y][x], i = y * w + x;
      if (c === '#') p.type[i] = WALL;
      else if (c === 'X') p.type[i] = SPIKE;
      else if (c === 'S') p.start = i;
      else if (c === 'G') p.goal = i;
      else if (c === '*') { p.gemAt[i] = p.gems.length; p.gems.push(i); }
      else if (c === 'B') { p.blockAt[i] = p.blocks.length; p.blocks.push(i); }
      else if (c in ARROWS) p.arrowAt[i] = ARROWS[c];
      else if (c >= 'a' && c <= 'd') {
        p.portalId[i] = c.charCodeAt(0) - 97;
        if (c in open) { p.portalTo[i] = open[c]; p.portalTo[open[c]] = i; }
        else open[c] = i;
      }
    }
  }
  p.allGems = (1 << p.gems.length) - 1;
  return p;
}

export function initState(p) {
  return { pos: p.start, gems: 0, blocks: 0 };
}

// Desliza desde el estado `s` en la dirección `dir`.
// Devuelve el estado final, los pasos (para animar) y el resultado:
// 'stop' | 'win' | 'dead'. `moved` es false si no ha pasado nada.
export function slide(p, s, dir) {
  let pos = s.pos, gems = s.gems, blocks = s.blocks, d = dir;
  let result = 'stop';
  const steps = [];
  const seen = new Set();
  for (;;) {
    const x = pos % p.w, y = (pos / p.w) | 0;
    const nx = x + DX[d], ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) break;
    const n = ny * p.w + nx;
    if (p.type[n] === WALL) break;
    const b = p.blockAt[n];
    if (b >= 0 && !((blocks >> b) & 1)) {
      blocks |= 1 << b;
      steps.push({ k: 'b', at: n, block: b, d });
      break;
    }
    pos = n;
    const st = { k: 'm', at: n, d };
    steps.push(st);
    const g = p.gemAt[n];
    if (g >= 0 && !((gems >> g) & 1)) { gems |= 1 << g; st.gem = g; }
    if (p.type[n] === SPIKE) { result = 'dead'; break; }
    if (n === p.goal && gems === p.allGems) { result = 'win'; break; }
    if (p.portalTo[n] >= 0) {
      pos = p.portalTo[n];
      steps.push({ k: 't', at: pos, from: n, d });
    }
    if (p.arrowAt[pos] >= 0) d = p.arrowAt[pos];
    const key = pos * 4 + d;
    if (seen.has(key)) { result = 'dead'; break; } // bucle infinito de flechas
    seen.add(key);
  }
  return { state: { pos, gems, blocks }, steps, result, moved: steps.length > 0 };
}

// Búsqueda en anchura: solución con el mínimo de movimientos desde `s0`.
// Devuelve { moves, dirs } o null si no hay salida.
export function solve(p, s0, limit = 300000) {
  const ng = p.gems.length;
  const key = (s) => s.pos + p.n * (s.gems + (s.blocks << ng));
  const prev = new Map();
  prev.set(key(s0), null);
  let frontier = [s0];
  let depth = 0;
  while (frontier.length && prev.size < limit) {
    depth++;
    const next = [];
    for (const s of frontier) {
      const ks = key(s);
      for (let d = 0; d < 4; d++) {
        const r = slide(p, s, d);
        if (!r.moved || r.result === 'dead') continue;
        if (r.result === 'win') {
          const dirs = [d];
          let k = ks;
          for (let e = prev.get(k); e; e = prev.get(k)) { dirs.push(e.d); k = e.k; }
          return { moves: depth, dirs: dirs.reverse() };
        }
        const kn = key(r.state);
        if (prev.has(kn)) continue;
        prev.set(kn, { k: ks, d });
        next.push(r.state);
      }
    }
    frontier = next;
  }
  return null;
}
