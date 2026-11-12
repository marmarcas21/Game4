// Genera los iconos PNG (requiere Playwright):  node tools/make-icons.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd3c2"/><stop offset=".5" stop-color="#ffb1c4"/><stop offset="1" stop-color="#a8dcb4"/>
    </linearGradient>
    <filter id="sh"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#7a2e55" flood-opacity=".22"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g filter="url(#sh)"><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(0 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(40 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(80 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(120 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(160 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(200 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(240 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(280 256 256)"/><ellipse cx="256" cy="150" rx="44" ry="92" fill="#fff" transform="rotate(320 256 256)"/></g>
  <circle cx="256" cy="256" r="62" fill="#ffc928"/>
  <circle cx="240" cy="240" r="22" fill="#ffe07a"/>
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
