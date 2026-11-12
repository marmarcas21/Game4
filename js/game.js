import { SPECIES, growth, parseLevel, freeCount, solve } from './engine.js';
import { LEVELS } from './levels.js';
import { FLOWERS, patternSVG, drawFlower } from './flowers.js';

const CHEERS = ['¡Ha florecido!', '¡Qué jardín!', '¡Precioso!', '¡Primavera!', '¡Así se planta!', '¡Brota todo!'];
const ORDER_TIP = 'El orden importa: lo que ya ha florecido corta el paso a lo siguiente.';
const SOIL = '#ead7c2', SOIL_DOT = '#dcc4a9';
const $ = (id) => document.getElementById(id);
const idx = (ch) => SPECIES.indexOf(ch);
// La flor que cada nivel aporta al jardín propio: una de sus semillas.
const featured = (i) => idx(LEVELS[i].s[(i * 7 + 3) % LEVELS[i].s.length]);

// ---------- Guardado ----------
const KEY = 'brota.v1';
const save = { done: {}, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* sin guardado */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado */ } };
const isDoneLevel = (i) => !!save.done[i];
const unlocked = (i) => i === 0 || isDoneLevel(i - 1);
const doneCount = () => LEVELS.reduce((a, _, i) => a + (isDoneLevel(i) ? 1 : 0), 0);
const firstPending = () => LEVELS.findIndex((_, i) => !isDoneLevel(i));

// ---------- Sonido ----------
let ac = null;
function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
}
function tone(freq, dur, { type = 'sine', vol = 0.1, to = 0, delay = 0 } = {}) {
  if (!ac || !save.sound) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}
const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568]; // pentatónica: cualquier combinación suena bien
const sfx = {
  tap: () => tone(700, 0.05, { vol: 0.05 }),
  pick: () => tone(620, 0.08, { vol: 0.06, to: 820 }),
  no: () => tone(190, 0.1, { type: 'triangle', vol: 0.1, to: 150 }),
  bloom: (d, delay) => { tone(SCALE[Math.min(d, SCALE.length - 1)], 0.32, { vol: 0.085, delay }); tone(SCALE[Math.min(d, SCALE.length - 1)] * 2, 0.2, { vol: 0.02, delay }); },
  undo: () => tone(520, 0.12, { vol: 0.06, to: 330 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, { vol: 0.09, delay: i * 0.09 })),
};

// ---------- Pantallas ----------
let screen = 'home', running = false;
function show(name) {
  screen = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === name);
  if (name === 'home') renderHome();
  if (name === 'levels') renderLevels();
  if (name === 'garden') renderGarden();
  if (name === 'game') { resize(); if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
}

function renderHome() {
  const pending = firstPending(), n = doneCount();
  $('btn-play').textContent = pending < 0 ? 'Volver a jugar' : n === 0 ? 'Jugar' : `Nivel ${pending + 1}`;
  $('home-bar').style.width = `${(n / LEVELS.length) * 100}%`;
  $('home-progress').textContent = n === 1 ? '1 flor en tu jardín' : `${n} flores en tu jardín`;
  $('btn-sound').textContent = `Sonido: ${save.sound ? 'sí' : 'no'}`;
}

function renderLevels() {
  $('lv-count').textContent = `${doneCount()}/${LEVELS.length}`;
  const list = $('lv-list');
  list.textContent = '';
  const pending = firstPending();
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lv' + (isDoneLevel(i) ? ' done' : '') + (i === pending ? ' next' : '');
    b.disabled = !unlocked(i);
    b.textContent = i + 1;
    b.onclick = () => { sfx.tap(); startLevel(i); };
    list.appendChild(b);
    if (i === pending) requestAnimationFrame(() => b.scrollIntoView({ block: 'center' }));
  });
}

function renderGarden() {
  $('garden-count').textContent = `${doneCount()}/${LEVELS.length}`;
  const c = $('garden-cv');
  const cols = 8, rows = Math.ceil(LEVELS.length / cols);
  const wCss = c.parentElement.clientWidth - 4, t = wCss / cols;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  c.style.height = `${t * rows}px`;
  c.width = Math.round(wCss * dpr); c.height = Math.round(t * rows * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  LEVELS.forEach((lv, i) => {
    const x = (i % cols) * t, y = Math.floor(i / cols) * t, s = featured(i);
    roundRect(g, x + 2, y + 2, t - 4, t - 4, t * 0.22);
    g.fillStyle = isDoneLevel(i) ? FLOWERS[s].tint : SOIL;
    g.fill();
    if (isDoneLevel(i)) drawFlower(g, s, x + t / 2, y + t / 2, t * 0.34, Math.sin(i * 1.7) * 0.12);
    else speckles(g, x, y, t, i);
  });
}

// ---------- Estado de la partida ----------
const cv = $('cv');
const ctx = cv.getContext('2d');
let cur = 0, gw = 0, gh = 0, cells = new Int8Array(0), counts = [], sel = -1, history = [], won = false;
let bloomAt = new Float32Array(0), origins = new Set();
let preview = null, pressing = false, hint = null, particles = [];
let vw = 0, vh = 0, ts = 50, ox = 0, oy = 0, T = 0, last = 0;

function startLevel(i) {
  cur = i;
  const p = parseLevel(LEVELS[i]);
  gw = p.w; gh = p.h; cells = p.cells; counts = p.counts;
  bloomAt = new Float32Array(cells.length);
  origins = new Set();
  history = []; won = false; preview = null; pressing = false; hint = null; particles = [];
  sel = counts.findIndex((n) => n > 0);
  $('g-title').textContent = `Nivel ${i + 1}`;
  $('g-tip').textContent = levelTip(i);
  $('win').classList.add('hidden');
  buildTray();
  updateHud();
  show('game');
  layout();
}

function levelTip(i) {
  if (i === 0) return `Toca la tierra para plantar. ${FLOWERS[0].tip}`;
  if (i === 2) return 'Cubre toda la tierra con las semillas que tienes.';
  if (i === 7) return ORDER_TIP;
  const prev = new Set(LEVELS.slice(0, i).flatMap((l) => l.s.split('')));
  const fresh = [...new Set(LEVELS[i].s.split(''))].find((ch) => !prev.has(ch));
  return fresh ? FLOWERS[idx(fresh)].tip || FLOWERS[idx('T')].tip : '';
}

function buildTray() {
  const tray = $('tray');
  tray.textContent = '';
  counts.forEach((n, s) => {
    if (!n) return;
    const f = FLOWERS[s];
    const b = document.createElement('button');
    b.className = 'seed';
    b.dataset.s = s;
    b.style.setProperty('--c', f.color);
    b.innerHTML = `<i></i><span class="row2"><canvas width="102" height="102"></canvas>${patternSVG(f)}</span>${f.name}`;
    drawFlower(b.querySelector('canvas').getContext('2d'), s, 51, 51, 38);
    b.onclick = () => {
      unlockAudio();
      if (won || !counts[s]) { sfx.no(); return; }
      sel = s; hint = null; sfx.pick(); updateHud();
    };
    tray.appendChild(b);
  });
}

function updateHud() {
  for (const b of $('tray').children) {
    const s = +b.dataset.s;
    b.querySelector('i').textContent = counts[s];
    b.classList.toggle('sel', s === sel && counts[s] > 0);
    b.classList.toggle('empty', counts[s] === 0);
  }
  const free = freeCount(cells);
  $('g-left').textContent = free ? `${free} libres` : '';
  $('g-undo').disabled = !history.length || won;
  $('g-hint').disabled = won;
}

function plant(s, c) {
  history.push({ cells: cells.slice(), counts: counts.slice(), origin: c, s });
  const cover = growth(cells, gw, gh, s, c);
  const rings = new Set();
  for (const { i, d } of cover) {
    cells[i] = s + 1;
    bloomAt[i] = T + d * 0.08;
    rings.add(d);
  }
  for (const d of rings) sfx.bloom(d, d * 0.08);
  origins.add(c);
  counts[s]--;
  if (!counts[s]) sel = counts.findIndex((n) => n > 0);
  hint = null;
  const free = freeCount(cells);
  const maxD = Math.max(...rings);
  if (free === 0) win(maxD * 0.08 + 0.45);
  else if (sel < 0) $('g-tip').textContent = 'Quedan huecos sin flor. Deshaz y prueba otro orden.';
  else if (cur > 0) $('g-tip').textContent = '';
  updateHud();
}

function undo() {
  if (won || !history.length) return;
  const h = history.pop();
  cells = h.cells; counts = h.counts;
  origins.delete(h.origin);
  if (sel < 0 || !counts[sel]) sel = counts.findIndex((n) => n > 0);
  hint = null; preview = null;
  $('g-tip').textContent = '';
  sfx.undo();
  updateHud();
}

function showHint() {
  if (won) return;
  // Si se han seguido los pasos de la solución guardada, se continúa por ella; si no, se busca una.
  const known = LEVELS[cur].sol;
  const onTrack = history.every((h, k) => known[k] && known[k][0] === h.s && known[k][1] === h.origin);
  let m = onTrack && known[history.length] ? { s: known[history.length][0], c: known[history.length][1] } : null;
  if (!m) {
    const sol = solve(cells, gw, gh, counts, 45000);
    if (sol && sol.moves) m = sol.moves[0];
    else {
      $('g-tip').textContent = sol ? 'No encuentro pista desde aquí. Reinicia y te guío paso a paso.' : 'Así ya no se puede completar. Deshaz algún paso.';
      sfx.no();
      return;
    }
  }
  sel = m.s;
  hint = { c: m.c, t: 0 };
  $('g-tip').textContent = `Planta ${FLOWERS[m.s].name.toLowerCase()} donde marca el círculo.`;
  sfx.pick();
  updateHud();
}

function win(delay) {
  won = true;
  const first = !isDoneLevel(cur);
  save.done[cur] = 1;
  persist();
  updateHud();
  const level = cur, s = featured(cur), isLast = cur === LEVELS.length - 1;
  setTimeout(() => {
    if (cur !== level || screen !== 'game') return;
    sfx.win();
    petalRain();
  }, delay * 1000);
  setTimeout(() => {
    if (cur !== level || screen !== 'game' || !won) return;
    const g = $('win-flower').getContext('2d');
    g.clearRect(0, 0, 240, 240);
    drawFlower(g, s, 120, 120, 92);
    $('win-title').textContent = isLast ? '¡Jardín completo!' : CHEERS[cur % CHEERS.length];
    $('win-text').textContent = isLast ? 'Has hecho florecer los 80 jardines.'
      : first ? `Una flor más en tu jardín: ${FLOWERS[s].name.toLowerCase()}.` : `Nivel ${cur + 1} completado.`;
    $('win-next').textContent = isLast ? 'Ver mi jardín' : 'Siguiente';
    $('win').classList.remove('hidden');
  }, (delay + 1.25) * 1000);
}

function petalRain() {
  const colors = [...new Set([...cells].filter((v) => v > 0).map((v) => FLOWERS[v - 1].color))].concat('#ffffff');
  for (let q = 0; q < 90; q++) {
    particles.push({
      x: Math.random() * vw, y: -20 - Math.random() * vh * 0.5,
      vx: (Math.random() - 0.5) * 50, vy: 90 + Math.random() * 130,
      life: 1, decay: 0.25, color: colors[(Math.random() * colors.length) | 0], r: 4 + Math.random() * 4,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, ph: Math.random() * 6,
    });
  }
}

// ---------- Geometría y dibujo ----------
function resize() {
  const r = $('stage').getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  vw = r.width; vh = r.height;
  cv.width = Math.round(vw * dpr);
  cv.height = Math.round(vh * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout();
}

function layout() {
  if (!gw || !vw) return;
  ts = Math.floor(Math.min((vw - 8) / gw, (vh - 12) / gh, 68));
  ox = Math.round((vw - ts * gw) / 2);
  oy = Math.round((vh - ts * gh) / 2);
}

function cellAt(px, py) {
  const x = Math.floor((px - ox) / ts), y = Math.floor((py - oy) / ts);
  return x < 0 || y < 0 || x >= gw || y >= gh ? -1 : y * gw + x;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function speckles(g, x, y, t, i) {
  g.fillStyle = SOIL_DOT;
  for (let k = 0; k < 3; k++) {
    const a = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453, b = Math.sin(i * 39.346 + k * 11.135) * 24634.6345;
    g.beginPath();
    g.arc(x + t * (0.25 + 0.5 * (a - Math.floor(a))), y + t * (0.25 + 0.5 * (b - Math.floor(b))), t * 0.035, 0, 7);
    g.fill();
  }
}

const backOut = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

function draw() {
  ctx.clearRect(0, 0, vw, vh);
  const rad = ts * 0.22, pad = Math.max(1.5, ts * 0.04);

  // sombra de las casillas
  ctx.fillStyle = 'rgba(122,92,142,.13)';
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === -1) continue;
    roundRect(ctx, ox + (i % gw) * ts + pad, oy + Math.floor(i / gw) * ts + pad + ts * 0.07, ts - pad * 2, ts - pad * 2, rad);
    ctx.fill();
  }

  const inPreview = new Map((preview ? preview.cover : []).map((p) => [p.i, p.d]));
  const later = [];
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v === -1) continue;
    const x = ox + (i % gw) * ts, y = oy + Math.floor(i / gw) * ts;
    roundRect(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, rad);
    ctx.fillStyle = SOIL;
    ctx.fill();
    const k = v > 0 ? Math.min(1, (T - bloomAt[i]) / 0.38) : 0;
    if (k <= 0) {
      speckles(ctx, x, y, ts, i);
      if (inPreview.has(i)) {
        roundRect(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, rad);
        ctx.globalAlpha = 0.92; ctx.fillStyle = FLOWERS[sel].tint; ctx.fill();
        ctx.globalAlpha = 1;
        if (i !== preview.c) { ctx.fillStyle = FLOWERS[sel].color; ctx.beginPath(); ctx.arc(x + ts / 2, y + ts / 2, ts * 0.09, 0, 7); ctx.fill(); }
      }
      continue;
    }
    roundRect(ctx, x + pad, y + pad, ts - pad * 2, ts - pad * 2, rad);
    ctx.globalAlpha = Math.min(1, k * 2.5);
    ctx.fillStyle = FLOWERS[v - 1].tint;
    ctx.fill();
    ctx.globalAlpha = 1;
    later.push({ i, x, y, s: v - 1, k });
  }

  for (const { i, x, y, s, k } of later) {
    const sway = Math.sin(T * (won ? 3 : 1.5) + i * 1.3) * (won ? 0.2 : 0.07);
    drawFlower(ctx, s, x + ts / 2, y + ts / 2, ts * (origins.has(i) ? 0.4 : 0.31) * backOut(k), sway);
  }

  if (preview) {
    ctx.globalAlpha = 0.75;
    drawFlower(ctx, sel, ox + (preview.c % gw + 0.5) * ts, oy + (Math.floor(preview.c / gw) + 0.5) * ts, ts * 0.42, 0);
    ctx.globalAlpha = 1;
  }

  if (hint) {
    const a = 0.5 + 0.5 * Math.sin(hint.t * 6);
    ctx.strokeStyle = FLOWERS[sel >= 0 ? sel : 0].color;
    ctx.lineWidth = ts * 0.08;
    ctx.globalAlpha = 0.55 + a * 0.45;
    ctx.beginPath();
    ctx.arc(ox + (hint.c % gw + 0.5) * ts, oy + (Math.floor(hint.c / gw) + 0.5) * ts, ts * (0.3 + a * 0.06), 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 3));
    ctx.fillStyle = q.color;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
    ctx.beginPath(); ctx.ellipse(0, 0, q.r, q.r * 0.55, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function update(dt) {
  T += dt;
  if (hint) hint.t += dt;
  for (const q of particles) {
    q.x += (q.vx + Math.sin(T * 2 + q.ph) * 40) * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.life -= dt * q.decay;
  }
  particles = particles.filter((q) => q.life > 0 && q.y < vh + 30);
}

function frame(t) {
  if (screen !== 'game') { running = false; return; }
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- Entrada ----------
// Mantén pulsado y arrastra para ver cómo crecería; al soltar, se planta.
function setPreview(e) {
  const r = cv.getBoundingClientRect();
  const c = cellAt(e.clientX - r.left, e.clientY - r.top);
  preview = c >= 0 && cells[c] === 0 && sel >= 0 && counts[sel] > 0 ? { c, cover: growth(cells, gw, gh, sel, c) } : null;
  return c;
}
cv.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (won) return;
  pressing = true;
  const c = setPreview(e);
  if (!preview && c >= 0 && cells[c] === 0) { // tierra libre pero sin semillas
    sfx.no();
    for (const b of $('tray').children) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  }
});
window.addEventListener('pointermove', (e) => { if (pressing) setPreview(e); });
window.addEventListener('pointerup', (e) => {
  if (!pressing) return;
  pressing = false;
  setPreview(e);
  const p = preview;
  preview = null;
  if (p && !won) plant(sel, p.c);
});
window.addEventListener('pointercancel', () => { pressing = false; preview = null; });
// iOS: sin zoom por pellizco ni por doble toque
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('resize', () => { resize(); if (screen === 'garden') renderGarden(); });
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- Botones ----------
const on = (id, fn) => { $(id).onclick = () => { unlockAudio(); sfx.tap(); fn(); }; };
on('btn-play', () => { const i = firstPending(); if (i < 0) show('levels'); else startLevel(i); });
on('btn-levels', () => show('levels'));
on('btn-garden', () => show('garden'));
on('btn-sound', () => { save.sound = !save.sound; persist(); renderHome(); sfx.tap(); });
on('lv-back', () => show('home'));
on('garden-back', () => show('home'));
on('g-back', () => show('home'));
on('g-undo', undo);
on('g-restart', () => startLevel(cur));
on('g-hint', showHint);
on('win-next', () => { if (cur === LEVELS.length - 1) show('garden'); else startLevel(cur + 1); });

// ---------- PWA ----------
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
if (isIOS && !standalone) $('install-hint').classList.remove('hidden');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// Solo para las pruebas automáticas (?test).
if (location.search.includes('test')) {
  window.__test = {
    state: () => ({ won, free: freeCount(cells), sel, counts: counts.slice() }),
    xy: (c) => { const r = cv.getBoundingClientRect(); return [r.left + ox + (c % gw + 0.5) * ts, r.top + oy + (Math.floor(c / gw) + 0.5) * ts]; },
    next: () => { const s = solve(cells, gw, gh, counts, 200000); return s && s.moves && s.moves[0]; },
  };
}

renderHome();
