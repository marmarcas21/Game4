// Reglas del juego y solucionador. Sin DOM: lo usan el juego y el generador.
// Una botella es un array de colores (enteros) de abajo arriba.

export const CAP = 4;

export const isUniform = (b) => b.every((c) => c === b[0]);
export const isComplete = (b) => b.length === CAP && isUniform(b);
export const isDone = (bs) => bs.every((b) => b.length === 0 || isComplete(b));

export function runLen(b) {
  if (!b.length) return 0;
  let n = 1;
  while (n < b.length && b[b.length - 1 - n] === b[b.length - 1]) n++;
  return n;
}

export function canPour(a, b) {
  return a.length > 0 && b.length < CAP && (b.length === 0 || b[b.length - 1] === a[a.length - 1]);
}

// Movimientos que tienen sentido, ordenados del más prometedor al menos.
function candidates(bs) {
  const out = [];
  const firstEmpty = bs.findIndex((b) => b.length === 0);
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (!a.length || isComplete(a)) continue;
    const c = a[a.length - 1], n = runLen(a), whole = n === a.length;
    for (let j = 0; j < bs.length; j++) {
      if (j === i) continue;
      const b = bs[j];
      let score;
      if (b.length === 0) {
        if (whole || j !== firstEmpty) continue; // mover una botella de un solo color a una vacía no aporta
        score = 1;
      } else {
        if (b.length === CAP || b[b.length - 1] !== c) continue;
        const space = CAP - b.length;
        score = n > space ? 0 : 3 + (whole ? 2 : 0) + (isUniform(b) ? 1 : 0);
      }
      out.push({ i, j, score });
    }
  }
  return out.sort((p, q) => q.score - p.score);
}

export const hasUsefulMove = (bs) => candidates(bs).length > 0;

// Búsqueda en profundidad con memoria. Devuelve { moves: [[de, a], ...], nodes } o null.
export function solve(start, limit = 40000) {
  const bs = start.map((b) => b.slice());
  const seen = new Set();
  const path = [];
  let nodes = 0;
  const key = () => bs.map((b) => b.join(',')).sort().join('|');
  const rec = () => {
    if (isDone(bs)) return true;
    if (++nodes > limit) return false;
    const k = key();
    if (seen.has(k)) return false;
    seen.add(k);
    for (const { i, j } of candidates(bs)) {
      const a = bs[i], b = bs[j];
      const k2 = Math.min(runLen(a), CAP - b.length);
      for (let q = 0; q < k2; q++) b.push(a.pop());
      path.push([i, j]);
      if (rec()) return true;
      path.pop();
      for (let q = 0; q < k2; q++) a.push(b.pop());
      if (nodes > limit) return false;
    }
    return false;
  };
  return rec() ? { moves: path, nodes } : null;
}
