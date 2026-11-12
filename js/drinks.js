// La carta: una bebida nueva cada 5 niveles superados.

export const DRINKS = [
  { name: 'Mimosa', glass: 'flauta', colors: ['#ffe27a', '#ffa23f'], garnish: '#ff8a3d' },
  { name: 'Rosé Spritz', glass: 'copa', colors: ['#ffc2d1', '#ff7d9c'], garnish: '#ff5c7f' },
  { name: 'Matcha Latte', glass: 'taza', colors: ['#f4ecd8', '#9ccc65'] },
  { name: 'Lavender Fizz', glass: 'vaso', colors: ['#efe6ff', '#b99bff'], garnish: '#8f6bf0' },
  { name: 'Piña Colada', glass: 'copa', colors: ['#fff8dc', '#ffd95a'], garnish: '#ffb300' },
  { name: 'Bubble Tea', glass: 'vaso', colors: ['#f1dcc3', '#c79a6b'], pearls: true },
  { name: 'Aperol Spritz', glass: 'copa', colors: ['#ffb169', '#ff6a2b'], garnish: '#ff9838' },
  { name: 'Mojito', glass: 'vaso', colors: ['#e9ffd6', '#8fdc7c'], garnish: '#33b679' },
  { name: 'Pink Lemonade', glass: 'vaso', colors: ['#ffe0ea', '#ff9ab5'], garnish: '#ffd43b' },
  { name: 'Blue Lagoon', glass: 'martini', colors: ['#aee9ff', '#3fa9ff'], garnish: '#ffd43b' },
  { name: 'Sangría', glass: 'copa', colors: ['#c64a6d', '#7b2242'], garnish: '#ff9838' },
  { name: 'Chai Latte', glass: 'taza', colors: ['#f6e7d2', '#c98f5a'] },
  { name: 'Paloma', glass: 'vaso', colors: ['#ffe3d6', '#ff9f8a'], garnish: '#ff6b8b' },
  { name: 'Tequila Sunrise', glass: 'vaso', colors: ['#ffd43b', '#ff9838', '#ff4f6d'], garnish: '#ff9838' },
  { name: 'Frappé de Caramelo', glass: 'vaso', colors: ['#fff3e0', '#d9a066', '#a9744f'] },
  { name: 'Cosmopolitan', glass: 'martini', colors: ['#ff9ab5', '#e8457b'], garnish: '#a6d94a' },
  { name: 'Espresso Martini', glass: 'martini', colors: ['#e8d3b9', '#5b3a29'] },
  { name: 'Margarita', glass: 'martini', colors: ['#f3ffcf', '#bfe26a'], garnish: '#a6d94a' },
  { name: 'Smoothie de Frutos Rojos', glass: 'vaso', colors: ['#f3a6d0', '#c2459b'], garnish: '#7b2242' },
  { name: 'Champán', glass: 'flauta', colors: ['#fff6cf', '#f4d98a'], bubbles: true },
];

export const DRINK_EVERY = 5;

// Forma del vaso: cuenco (lo que se llena), pie y borde superior.
const GLASS = {
  flauta: { bowl: 'M37 10 L63 10 Q66 62 50 80 Q34 62 37 10Z', stem: 'M50 80 V106 M36 108 H64', top: 10, bottom: 80 },
  copa: { bowl: 'M27 14 L73 14 Q78 54 50 72 Q22 54 27 14Z', stem: 'M50 72 V106 M34 108 H66', top: 14, bottom: 72 },
  martini: { bowl: 'M18 16 L82 16 L50 60Z', stem: 'M50 60 V106 M34 108 H66', top: 16, bottom: 60 },
  vaso: { bowl: 'M31 10 L69 10 L65 108 L35 108Z', stem: '', top: 10, bottom: 108 },
  taza: { bowl: 'M24 40 H72 V94 Q72 108 58 108 H38 Q24 108 24 94Z', stem: 'M72 54 Q90 54 90 70 Q90 86 72 86', top: 40, bottom: 108 },
};

let uid = 0;

export function drinkSVG(d, locked = false) {
  const g = GLASS[d.glass];
  const id = `d${uid++}`;
  const fillTop = g.top + (g.bottom - g.top) * 0.14;
  const stops = d.colors
    .map((c, i) => `<stop offset="${d.colors.length === 1 ? 0 : i / (d.colors.length - 1)}" stop-color="${c}"/>`)
    .join('');
  const ink = locked ? '#cbbfd6' : '#7a5c8e';
  let extra = '';
  if (!locked) {
    if (d.garnish) extra += `<circle cx="${d.glass === 'martini' ? 74 : 68}" cy="${g.top}" r="9" fill="${d.garnish}" stroke="#fff" stroke-width="2.5"/>`;
    if (d.pearls) extra += [38, 46, 54, 61, 42, 57].map((x, i) => `<circle cx="${x}" cy="${100 - (i > 3 ? 9 : 0)}" r="4" fill="#4a3226"/>`).join('');
    if (d.bubbles) extra += [[46, 60], [53, 46], [49, 32], [55, 68]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff" opacity=".9"/>`).join('');
  }
  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
      <clipPath id="${id}c"><path d="${g.bowl}"/></clipPath>
    </defs>
    <path d="${g.bowl}" fill="${locked ? '#f1ecf5' : '#ffffff'}" opacity="${locked ? 1 : 0.7}"/>
    ${locked ? '' : `<rect x="0" y="${fillTop}" width="100" height="${g.bottom - fillTop}" fill="url(#${id}g)" clip-path="url(#${id}c)"/>`}
    <path d="${g.bowl}" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    ${g.stem ? `<path d="${g.stem}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` : ''}
    ${extra}
  </svg>`;
}
