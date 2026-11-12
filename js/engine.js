// Reglas del juego y solucionador. Sin DOM: lo usan el juego y el generador.
//
// El jardín es una rejilla. Cada casilla vale:
//   -1 hueco (no hay tierra)   0 tierra libre   1..7 ya florecida (especie + 1)
//
// Al plantar una semilla en tierra libre, florece su casilla y además:
//   D margarita        las 4 casillas vecinas
//   T tulipán          hacia los lados, hasta chocar
//   L lavanda          hacia arriba y abajo, hasta chocar
//   C trébol           nada más
//   R rosa             las 8 casillas de alrededor
//   S girasol          en las 4 diagonales, hasta chocar
//   P diente de león   salta: las casillas a 2 de distancia en cruz
// "Chocar" es llegar al borde, a un hueco o a algo ya florecido.

export const SPECIES = 'DTLCRSP';

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const DIAG = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

// Casillas que florecen al plantar la especie `s` en `c`: [{ i, d }] con d = distancia al origen.
export function growth(cells, w, h, s, c) {
  const out = [{ i: c, d: 0 }];
  const x0 = c % w, y0 = (c / w) | 0;
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && cells[y * w + x] === 0;
  const near = (dirs, dist) => {
    for (const [dx, dy] of dirs) {
      const x = x0 + dx * dist, y = y0 + dy * dist;
      if (free(x, y)) out.push({ i: y * w + x, d: dist });
    }
  };
  const rays = (dirs) => {
    for (const [dx, dy] of dirs) {
      for (let k = 1; free(x0 + dx * k, y0 + dy * k); k++) out.push({ i: (y0 + dy * k) * w + x0 + dx * k, d: k });
    }
  };
  switch (SPECIES[s]) {
    case 'D': near(ORTHO, 1); break;
    case 'T': rays([ORTHO[1], ORTHO[3]]); break;
    case 'L': rays([ORTHO[0], ORTHO[2]]); break;
    case 'R': near(ORTHO, 1); near(DIAG, 1); break;
    case 'S': rays(DIAG); break;
    case 'P': near(ORTHO, 2); break;
    default: break;
  }
  return out;
}

export function parseLevel(lv) {
  const h = lv.g.length, w = lv.g[0].length;
  const cells = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells[y * w + x] = lv.g[y][x] === 'o' ? 0 : -1;
  const counts = SPECIES.split('').map((ch) => lv.s.split(ch).length - 1);
  return { w, h, cells, counts };
}

export const freeCount = (cells) => cells.reduce((a, v) => a + (v === 0 ? 1 : 0), 0);

// Busca una forma de cubrir toda la tierra con las semillas que quedan.
// Devuelve { moves: [{ s, c }, ...] } si la encuentra, null si es seguro que no existe
// y { moves: null } si se agota el presupuesto sin saberlo.
//
// Es una búsqueda en profundidad que se reinicia con el orden de las jugadas algo
// barajado: en estos jardines, varios intentos cortos rinden mucho más que uno largo.
export function solve(cells0, w, h, counts0, limit = 60000) {
  let seed = 12345;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spent = 0;
  for (let run = 0; spent < limit; run++) {
    const budget = Math.min(limit - spent, 1500);
    const r = attempt(cells0, w, h, counts0, budget, run ? rand : null);
    if (r.moves) return { moves: r.moves };
    if (r.nodes <= budget) return null; // recorrió todo: no hay solución
    spent += budget;
  }
  return { moves: null };
}

function attempt(cells0, w, h, counts0, limit, rand) {
  const cells = cells0.slice(), counts = counts0.slice();
  const seen = new Set();
  const path = [];
  let nodes = 0;
  const rec = (free) => {
    if (free === 0) return true;
    if (++nodes > limit) return false;
    let key = counts.join('');
    for (let i = 0; i < cells.length; i++) key += cells[i] === 0 ? '1' : '0';
    if (seen.has(key)) return false;
    seen.add(key);
    const moves = [];
    const ways = new Uint8Array(cells.length); // si alguna jugada alcanza cada casilla
    let reach = 0; // lo máximo que aún se puede cubrir: si no llega, se poda
    for (let s = 0; s < counts.length; s++) {
      if (!counts[s]) continue;
      const sizes = [];
      for (let c = 0; c < cells.length; c++) {
        if (cells[c] !== 0) continue;
        const cover = growth(cells, w, h, s, c);
        moves.push({ s, c, cover, rank: -cover.length + (rand ? rand() * 2.5 : 0) });
        for (const { i } of cover) ways[i] = 1;
        sizes.push(cover.length);
      }
      sizes.sort((a, b) => b - a);
      for (let k = 0; k < counts[s] && k < sizes.length; k++) reach += sizes[k];
    }
    if (reach < free) return false;
    // el alcance de una semilla solo puede encoger: una casilla que hoy nadie alcanza ya no florecerá
    for (let c = 0; c < cells.length; c++) if (cells[c] === 0 && !ways[c]) return false;
    moves.sort((a, b) => a.rank - b.rank); // primero las que más cubren
    for (const m of moves) {
      for (const { i } of m.cover) cells[i] = m.s + 1;
      counts[m.s]--;
      path.push({ s: m.s, c: m.c });
      if (rec(free - m.cover.length)) return true;
      path.pop();
      counts[m.s]++;
      for (const { i } of m.cover) cells[i] = 0;
      if (nodes > limit) return false;
    }
    return false;
  };
  return rec(freeCount(cells)) ? { moves: path, nodes } : { moves: null, nodes };
}
