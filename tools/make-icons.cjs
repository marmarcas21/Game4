// Genera los iconos PNG (requiere Playwright):  node tools/make-icons.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd9c7"/><stop offset=".5" stop-color="#ffb3c7"/><stop offset="1" stop-color="#c9b3ff"/>
    </linearGradient>
    <clipPath id="t"><path d="M-46 0 V214 a46 46 0 0 0 92 0 V0Z"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${[[146, ['#ff6b8b', '#ffd43b', '#ff6b8b']], [256, ['#4a8dff', '#4a8dff', '#35c9d6']], [366, ['#ffd43b', '#ff9838', '#ff9838']]].map(([x, c], i) => `
  <g transform="translate(${x} ${i === 1 ? 96 : 136})">
    <path d="M-46 0 V214 a46 46 0 0 0 92 0 V0Z" fill="#fff" opacity=".75"/>
    <g clip-path="url(#t)">
      <rect x="-46" y="196" width="92" height="70" fill="${c[0]}"/>
      <rect x="-46" y="130" width="92" height="66" fill="${c[1]}"/>
      <rect x="-46" y="64" width="92" height="66" fill="${c[2]}"/>
    </g>
    <path d="M-46 0 V214 a46 46 0 0 0 92 0 V0Z" fill="none" stroke="#fff" stroke-width="10"/>
    <rect x="-56" y="-10" width="112" height="20" rx="10" fill="#fff"/>
    <path d="M-24 40 V190" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".6"/>
  </g>`).join('')}
</svg>`;

(async () => {
  const browser = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(__dirname, '..', 'icons', `icon-${size}.png`) });
    await page.close();
  }
  await browser.close();
})();
