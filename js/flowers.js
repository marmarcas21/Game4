// Las especies: nombre, colores, cómo crecen (para el dibujito de la semilla) y cómo se pintan.

export const FLOWERS = [
  { key: 'D', name: 'Margarita', color: '#f5b400', tint: '#eef6dc', pattern: [[0, -1], [1, 0], [0, 1], [-1, 0]], tip: 'La margarita florece en cruz: su casilla y las cuatro de al lado.' },
  { key: 'T', name: 'Tulipán', color: '#ff6b8b', tint: '#ffe1e9', pattern: [[-2, 0], [-1, 0], [1, 0], [2, 0]], tip: 'El tulipán crece hacia los lados y la lavanda hacia arriba y abajo, hasta chocar.' },
  { key: 'L', name: 'Lavanda', color: '#9b7bff', tint: '#ece5ff', pattern: [[0, -2], [0, -1], [0, 1], [0, 2]], tip: '' },
  { key: 'C', name: 'Trébol', color: '#45b873', tint: '#d5f0de', pattern: [], tip: 'El trébol solo ocupa su casilla. Guárdalo para un hueco suelto.' },
  { key: 'R', name: 'Rosa', color: '#e8457b', tint: '#ffd6e3', pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], tip: 'La rosa florece en todo su alrededor.' },
  { key: 'S', name: 'Girasol', color: '#ffa000', tint: '#ffedb8', pattern: [[-2, -2], [-1, -1], [1, -1], [2, -2], [-1, 1], [-2, 2], [1, 1], [2, 2]], tip: 'El girasol crece en diagonal, hasta chocar.' },
  { key: 'P', name: 'Diente de león', color: '#5fa8e0', tint: '#dff0fc', pattern: [[0, -2], [2, 0], [0, 2], [-2, 0]], tip: 'El diente de león salta: florece dos casillas más allá, en cruz.' },
];

// Mini esquema 5x5 de cómo crece cada especie.
export function patternSVG(f) {
  let out = '';
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const on = (x === 0 && y === 0) || f.pattern.some(([px, py]) => px === x && py === y);
      out += `<rect x="${(x + 2) * 8 + 1}" y="${(y + 2) * 8 + 1}" width="6" height="6" rx="2" fill="${on ? f.color : '#e7dcec'}" opacity="${on ? (x || y ? 0.75 : 1) : 0.7}"/>`;
    }
  }
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${out}</svg>`;
}

const TAU = Math.PI * 2;

function petals(ctx, n, dist, rx, ry, color) {
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    ctx.save();
    ctx.rotate((k / n) * TAU);
    ctx.beginPath();
    ctx.ellipse(0, -dist, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function stem(ctx, r, top) {
  ctx.strokeStyle = '#58b77a';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.lineTo(0, top);
  ctx.stroke();
}

// Pinta la flor `s` centrada en (x, y) con radio r.
export function drawFlower(ctx, s, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  switch (FLOWERS[s].key) {
    case 'D':
      ctx.shadowColor = 'rgba(122,92,142,.28)'; ctx.shadowBlur = r * 0.18;
      petals(ctx, 9, r * 0.56, r * 0.19, r * 0.4, '#ffffff');
      ctx.shadowBlur = 0;
      dot(ctx, 0, 0, r * 0.27, '#ffc928');
      dot(ctx, -r * 0.07, -r * 0.07, r * 0.1, '#ffe07a');
      break;
    case 'T':
      stem(ctx, r, r * 0.1);
      ctx.fillStyle = '#ff5c80';
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sg * r * 0.24, -r * 0.3, r * 0.27, r * 0.52, sg * 0.3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ff8fa8';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.24, r * 0.25, r * 0.55, 0, 0, TAU); ctx.fill();
      break;
    case 'L':
      stem(ctx, r, -r * 0.3);
      for (let k = 0; k < 6; k++) dot(ctx, (k % 2 ? 1 : -1) * r * 0.15, -r * 0.82 + k * r * 0.2, r * 0.2, k % 2 ? '#b49cff' : '#8f6df5');
      dot(ctx, 0, -r * 0.92, r * 0.15, '#b49cff');
      break;
    case 'C':
      stem(ctx, r * 0.9, 0);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU - Math.PI / 2;
        dot(ctx, Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38 - r * 0.12, r * 0.36, k ? '#45b873' : '#5fcf8b');
      }
      dot(ctx, 0, -r * 0.12, r * 0.1, '#2f9a5b');
      break;
    case 'R':
      dot(ctx, 0, 0, r * 0.78, '#e8457b');
      dot(ctx, r * 0.06, -r * 0.05, r * 0.56, '#ff7fa3');
      dot(ctx, -r * 0.05, r * 0.05, r * 0.38, '#e8457b');
      dot(ctx, r * 0.03, 0, r * 0.2, '#ff9fba');
      ctx.strokeStyle = 'rgba(160,30,80,.35)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0.4, 2.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 3.4, 5.6); ctx.stroke();
      break;
    case 'S':
      petals(ctx, 14, r * 0.62, r * 0.14, r * 0.36, '#ffb300');
      petals(ctx, 7, r * 0.5, r * 0.13, r * 0.3, '#ffcf40');
      dot(ctx, 0, 0, r * 0.38, '#7a4a21');
      dot(ctx, 0, 0, r * 0.22, '#93602e');
      break;
    default: // diente de león
      ctx.strokeStyle = '#8cc0ea'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineCap = 'round';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); ctx.stroke();
        dot(ctx, Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76, r * 0.12, '#ffffff');
      }
      dot(ctx, 0, 0, r * 0.2, '#5fa8e0');
      break;
  }
  ctx.restore();
}
