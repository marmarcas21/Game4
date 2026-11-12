// Genera los iconos PNG (requiere Playwright):  node tools/make-icons.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b2a5e"/><stop offset="1" stop-color="#0b1020"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g fill="#5ec8ff" opacity=".35">
    <rect x="70" y="236" width="150" height="26" rx="13"/>
    <rect x="110" y="286" width="110" height="26" rx="13"/>
    <rect x="110" y="186" width="110" height="26" rx="13"/>
  </g>
  <rect x="216" y="136" width="226" height="226" rx="62" fill="#f4f7ff"/>
  <ellipse cx="316" cy="238" rx="17" ry="27" fill="#0b1020"/>
  <ellipse cx="388" cy="238" rx="17" ry="27" fill="#0b1020"/>
  <path d="M130 390 l34 40 -34 40 -34 -40z" fill="#ffd24a"/>
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
