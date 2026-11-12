import { CAP, isComplete, isDone, canPour, solve, hasUsefulMove } from './engine.js';
import { LEVELS } from './levels.js';
import { DRINKS, DRINK_EVERY, drinkSVG } from './drinks.js';

const COLORS = ['#ff6b8b', '#ff9838', '#ffd43b', '#a6d94a', '#33b679', '#35c9d6', '#4a8dff', '#5a55d6', '#c39bff', '#d94bc0', '#a9744f', '#7b2242'];
const HIDDEN = '#ddd3e8';
const TYPE_NAME = { n: '', m: 'misterio', r: 'reto' };
const TIPS = {
  first: 'Toca una botella y después otra para verter. Deja cada color en su botella.',
  m: 'Misterio: los colores ocultos se descubren al quedar arriba.',
  r: 'Reto: solo hay una botella libre.',
};
const CHEERS = ['¡Perfecto!', '¡Qué arte!', '¡Brillante!', '¡Chin-chin!', '¡Precioso!', '¡Así se hace!'];
const $ = (id) => document.getElementById(id);

// ---------- Guardado ----------
const KEY = 'mimosa.v1';
const save = { done: {}, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* sin guardado */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado */ } };
const isDoneLevel = (i) => save.done[i] > 0;
const unlocked = (i) => i === 0 || isDoneLevel(i - 1);
const doneCount = () => LEVELS.reduce((a, _, i) => a + (isDoneLevel(i) ? 1 : 0), 0);
const firstPending = () => LEVELS.findIndex((_, i) => !isDoneLevel(i));
const drinkUnlocked = (d) => isDoneLevel((d + 1) * DRINK_EVERY - 1);
const drinksCount = () => DRINKS.reduce((a, _, d) => a + (drinkUnlocked(d) ? 1 : 0), 0);

// ---------- Sonido ----------
let ac = null, noise = null;
function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
const sfx = {
  pick: () => tone(620, 0.09, { vol: 0.07, to: 880 }),
  drop: () => tone(520, 0.08, { vol: 0.05, to: 380 }),
  no: () => tone(190, 0.1, { type: 'triangle', vol: 0.1, to: 150 }),
  tap: () => tone(700, 0.05, { vol: 0.05 }),
  pour(dur) { // ruido filtrado que sube de tono, como un vaso llenándose
    if (!ac || !save.sound) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.loop = true;
    f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
    g.gain.setValueAtTime(0.09, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t); src.stop(t + dur + 0.06);
  },
  done: () => [784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { vol: 0.08, delay: i * 0.06 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.36, { vol: 0.09, delay: 0.12 + i * 0.09 })),
};

// ---------- Pantallas ----------
let screen = 'home', running = false;
function show(name) {
  screen = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === name);
  if (name === 'home') renderHome();
  if (name === 'levels') renderLevels();
  if (name === 'menu') renderMenu();
  if (name === 'game') { resize(); if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
}

function renderHome() {
  const pending = firstPending(), n = doneCount();
  $('btn-play').textContent = pending < 0 ? 'Volver a jugar' : n === 0 ? 'Jugar' : `Nivel ${pending + 1}`;
  $('home-bar').style.width = `${(n / LEVELS.length) * 100}%`;
  $('home-progress').textContent = `${n} de ${LEVELS.length} niveles · ${drinksCount()} de ${DRINKS.length} bebidas`;
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
    b.innerHTML = `${i + 1}<small>${TYPE_NAME[lv.t]}</small>`;
    b.onclick = () => { sfx.tap(); startLevel(i); };
    list.appendChild(b);
    if (i === pending) requestAnimationFrame(() => b.scrollIntoView({ block: 'center' }));
  });
}

function renderMenu() {
  $('menu-count').textContent = `${drinksCount()}/${DRINKS.length}`;
  $('menu-list').innerHTML = DRINKS.map((d, i) => {
    const ok = drinkUnlocked(i);
    return `<div class="drink${ok ? '' : ' locked'}">${drinkSVG(d, !ok)}<strong>${ok ? d.name : '???'}</strong><small>${ok ? 'Conseguida' : `Nivel ${(i + 1) * DRINK_EVERY}`}</small></div>`;
  }).join('');
}

// ---------- Estado de la partida ----------
const cv = $('cv');
const ctx = cv.getContext('2d');
let cur = 0, bottles = [], hid = [], view = [], sel = -1, moves = 0, history = [], extraUsed = false, won = false;
let pours = [], particles = [], hint = null;
let vw = 0, vh = 0, W = 40, UH = 32, H = 150, T = 0, last = 0;

function startLevel(i) {
  cur = i;
  const lv = LEVELS[i];
  $('g-title').textContent = `Nivel ${i + 1}`;
  $('g-tip').textContent = i === 0 ? TIPS.first : TIPS[lv.t] || '';
  $('win').classList.add('hidden');
  bottles = lv.b.map((s) => [...s].map((ch) => parseInt(ch, 12)));
  hid = bottles.map((b) => b.map((_, j) => lv.t === 'm' && j < b.length - 1));
  view = bottles.map(() => ({ x: 0, y: 0, lift: 0, busy: false, nudge: 0, doneT: -9 }));
  sel = -1; moves = 0; history = []; extraUsed = false; won = false;
  pours = []; particles = []; hint = null;
  updateHud();
  show('game');
  layout();
}

function updateHud() {
  $('g-moves').textContent = moves ? `${moves}` : '';
  $('g-undo').disabled = !history.length || won;
  $('g-extra').disabled = extraUsed || won;
  $('g-hint').disabled = won;
}

const units = (i) => bottles[i].map((c, j) => ({ c, hid: hid[i][j], amt: 1 }));

function visibleRun(i) { // cuántas unidades se vierten: las de arriba del mismo color y a la vista
  const b = bottles[i];
  if (!b.length) return 0;
  let n = 1;
  while (n < b.length && b[b.length - 1 - n] === b[b.length - 1] && !hid[i][b.length - 1 - n]) n++;
  return n;
}

function tap(i) {
  if (won || view[i].busy) return;
  const b = bottles[i];
  hint = null;
  if (sel < 0) {
    if (!b.length || isComplete(b)) { view[i].nudge = 1; sfx.no(); return; }
    sel = i; sfx.pick();
    return;
  }
  if (sel === i) { sel = -1; sfx.drop(); return; }
  if (canPour(bottles[sel], b)) { pour(sel, i); return; }
  if (b.length && !isComplete(b)) { sel = i; sfx.pick(); } else { view[i].nudge = 1; sfx.no(); }
}

function pour(a, b) {
  const A = bottles[a], B = bottles[b];
  const c = A[A.length - 1];
  const k = Math.min(visibleRun(a), CAP - B.length);
  history.push({ bottles: bottles.map((x) => x.slice()), hid: hid.map((x) => x.slice()), moves });
  const fromA = units(a), fromB = units(b);
  for (let q = 0; q < k; q++) { A.pop(); hid[a].pop(); B.push(c); hid[b].push(false); }
  if (A.length) hid[a][A.length - 1] = false; // se descubre lo que queda arriba
  moves++;
  sel = -1;
  view[a].busy = view[b].busy = true;
  pours.push({ a, b, k, c, fromA, fromB, u0: fromA.length, s: view[b].x < vw / 2 ? -1 : 1, t: 0, T1: 0.2, T2: 0.2 + 0.1 * k, T3: 0.2, started: false, landed: false });
  if (cur === 0 || $('g-tip').textContent.startsWith('No quedan')) $('g-tip').textContent = cur === 0 ? TIPS.first : '';
  updateHud();
}

function undo() {
  if (won || !history.length) return;
  const h = history.pop();
  const extra = bottles.length - h.bottles.length; // la botella extra se conserva
  bottles = h.bottles; hid = h.hid; moves = h.moves;
  for (let q = 0; q < extra; q++) { bottles.push([]); hid.push([]); }
  pours = []; sel = -1; hint = null;
  for (const v of view) { v.busy = false; v.doneT = -9; }
  updateHud();
}

function addBottle() {
  if (extraUsed || won) return;
  extraUsed = true;
  bottles.push([]); hid.push([]);
  view.push({ x: 0, y: 0, lift: 0, busy: false, nudge: 0, doneT: -9 });
  pours = []; for (const v of view) v.busy = false;
  layout();
  const v = view[view.length - 1];
  sparkle(v.x, v.y + H / 2, '#ff9ab5', 14);
  sfx.done();
  $('g-tip').textContent = '';
  updateHud();
}

function showHint() {
  if (won || pours.length) return;
  const sol = solve(bottles, 30000);
  if (!sol || !sol.moves.length) { $('g-tip').textContent = 'Desde aquí no veo salida: deshaz o añade una botella.'; sfx.no(); return; }
  const [from, to] = sol.moves[0];
  sel = from;
  hint = { to, t: 0 };
  sfx.pick();
}

function landed(p) {
  view[p.b].busy = false;
  if (isComplete(bottles[p.b])) {
    view[p.b].doneT = T;
    sparkle(view[p.b].x, view[p.b].y + H * 0.3, COLORS[p.c], 16);
    sfx.done();
  }
  if (won) return;
  if (isDone(bottles)) return win();
  if (!hasUsefulMove(bottles)) $('g-tip').textContent = 'No quedan movimientos: deshaz o añade una botella.';
}

function win() {
  won = true;
  sel = -1; hint = null;
  const firstTime = !isDoneLevel(cur);
  save.done[cur] = save.done[cur] ? Math.min(save.done[cur], moves) : moves;
  persist();
  updateHud();
  sfx.win();
  confetti();
  const isLast = cur === LEVELS.length - 1;
  const d = (cur + 1) % DRINK_EVERY === 0 ? DRINKS[(cur + 1) / DRINK_EVERY - 1] : null;
  $('win-title').textContent = isLast ? '¡Lo has completado!' : CHEERS[cur % CHEERS.length];
  $('win-text').textContent = isLast ? 'Los 100 niveles superados. Enhorabuena.' : `Nivel ${cur + 1} en ${moves} movimientos`;
  $('win-drink').classList.toggle('hidden', !(d && firstTime));
  if (d && firstTime) { $('win-drink-art').innerHTML = drinkSVG(d); $('win-drink-name').textContent = d.name; }
  $('win-next').textContent = isLast ? 'Inicio' : 'Siguiente';
  const level = cur;
  setTimeout(() => { if (won && cur === level && screen === 'game') $('win').classList.remove('hidden'); }, 1100);
}

// ---------- Partículas ----------
function sparkle(x, y, color, n) {
  for (let q = 0; q < n; q++) {
    const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 110;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 60, life: 1, decay: 1.5, color, r: 2 + Math.random() * 3, kind: 0 });
  }
}
function confetti() {
  for (let q = 0; q < 110; q++) {
    particles.push({
      x: Math.random() * vw, y: -20 - Math.random() * vh * 0.4,
      vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160, g: 60,
      life: 1, decay: 0.28, color: COLORS[(Math.random() * 10) | 0], r: 4 + Math.random() * 4,
      kind: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
    });
  }
}

// ---------- Geometría ----------
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
  const n = bottles.length;
  if (!n || !vw) return;
  const rows = n <= 5 ? 1 : 2;
  const per = Math.ceil(n / rows);
  W = Math.min((vw / per) * 0.6, 54, vh / (rows === 1 ? 8.4 : 13.6));
  UH = W * 0.8;
  H = UH * CAP + W * 0.45;
  const head = 3.9 * W, gap = 2.1 * W; // aire para la botella que vierte
  const body = rows * H + (rows - 1) * gap;
  const top = Math.max(head, (vh - body) / 2 - 0.2 * W); // botellas centradas, con hueco arriba garantizado
  const step = Math.min(vw / per, W * 2);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per);
    const inRow = row === rows - 1 ? n - per * (rows - 1) : per;
    view[i].x = vw / 2 + (i - row * per - (inRow - 1) / 2) * step;
    view[i].y = top + row * (H + gap);
    view[i].hit = step / 2;
  }
}

// Ángulo al que el líquido llega justo al borde, según cuánto queda.
function tilt(u) {
  const L = u * UH, empty = H - L;
  if (L < 0.01) return Math.PI * 0.52;
  return empty <= H / 2 ? Math.atan((2 * empty) / W) : Math.atan((H * H) / (2 * W * L));
}
const ease = (x) => x * x * (3 - 2 * x);

function pourPose(p) {
  const A = view[p.a], B = view[p.b];
  let kk, u, frac;
  if (p.t < p.T1) { kk = ease(p.t / p.T1); u = p.u0; frac = 0; }
  else if (p.t < p.T1 + p.T2) { kk = 1; frac = (p.t - p.T1) / p.T2; u = p.u0 - p.k * frac; }
  else { kk = 1 - ease(Math.min(1, (p.t - p.T1 - p.T2) / p.T3)); u = p.u0 - p.k; frac = 1; }
  const th = tilt(u);
  const cx = B.x, cy = B.y - Math.max(W * 0.9, H * Math.cos(th) + W * 0.35); // punto por el que cae el chorro
  const tx = cx - Math.cos(th) * p.s * W / 2, ty = cy - Math.sin(th) * W / 2;
  const hx = A.x, hy = A.y - A.lift;
  return { px: hx + (tx - hx) * kk, py: hy + (ty - hy) * kk, ang: p.s * th * kk, kk, frac, cx, cy };
}

// ---------- Dibujo ----------
function tubePath() {
  const r = W * 0.46;
  ctx.beginPath();
  ctx.moveTo(-W / 2, 0);
  ctx.lineTo(-W / 2, H - r);
  ctx.arc(-W / 2 + r, H - r, r, Math.PI, Math.PI / 2, true);
  ctx.lineTo(W / 2 - r, H);
  ctx.arc(W / 2 - r, H - r, r, Math.PI / 2, 0, true);
  ctx.lineTo(W / 2, 0);
  ctx.closePath();
}

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Dibuja una botella con su líquido. El líquido siempre queda horizontal aunque la botella se incline.
function drawBottle(px, py, ang, list, kk, s, corkT) {
  const sin = Math.sin(ang), cos = Math.cos(ang);
  const total = list.reduce((a, u) => a + u.amt, 0);
  const yLow = py + Math.max(H * cos + (W / 2) * Math.abs(sin), (W / 2) * Math.abs(sin));
  const yLip = py + (s * W / 2) * sin;
  const depth = total * UH + (yLow - yLip - total * UH) * kk;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  tubePath();
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.rotate(-ang);
  ctx.translate(-px, -py);
  if (total > 0.001) {
    let acc = 0;
    for (const u of list) {
      const y1 = yLow - (acc / total) * depth;
      acc += u.amt;
      const y0 = yLow - (acc / total) * depth;
      ctx.fillStyle = u.hid ? HIDDEN : COLORS[u.c];
      ctx.fillRect(px - H - W, y0 - 0.5, 2 * (H + W), y1 - y0 + 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(px - H - W, yLow - depth - 0.5, 2 * (H + W), Math.min(3, depth));
  }
  ctx.restore();

  // interrogantes de los colores ocultos (solo con la botella quieta)
  if (kk === 0) {
    ctx.fillStyle = '#a996bd';
    ctx.font = `800 ${Math.round(UH * 0.52)}px ui-rounded, -apple-system, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    list.forEach((u, j) => { if (u.hid) ctx.fillText('?', 0, H - (j + 0.5) * UH); });
  }

  // cristal
  tubePath();
  ctx.lineWidth = Math.max(2, W * 0.055);
  ctx.strokeStyle = 'rgba(122,92,142,.5)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = W * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-W * 0.27, H * 0.1); ctx.lineTo(-W * 0.27, H * 0.78); ctx.stroke();
  rr(-W / 2 - W * 0.08, -W * 0.09, W * 1.16, W * 0.18, W * 0.09);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = Math.max(1.5, W * 0.04); ctx.strokeStyle = 'rgba(122,92,142,.5)'; ctx.stroke();

  // corcho de botella terminada
  if (corkT >= 0 && list.length) {
    const k = Math.min(1, corkT * 5), drop = (1 - ease(k)) * W * 0.8;
    ctx.globalAlpha = k;
    rr(-W * 0.33, -W * 0.42 - drop, W * 0.66, W * 0.46, W * 0.12);
    ctx.fillStyle = shade(COLORS[list[0].c], 0.78);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, vw, vh);
  const pouring = new Map(pours.map((p) => [p.a, p]));
  const receiving = new Map(pours.filter((p) => !p.landed).map((p) => [p.b, p]));

  // sombras
  ctx.fillStyle = 'rgba(122,92,142,.1)';
  for (const v of view) {
    ctx.beginPath(); ctx.ellipse(v.x, v.y + H + W * 0.14, W * 0.52, W * 0.11, 0, 0, 7); ctx.fill();
  }

  view.forEach((v, i) => {
    if (pouring.has(i)) return;
    let list = units(i);
    const p = receiving.get(i);
    if (p) {
      const f = p.t < p.T1 ? 0 : Math.min(1, (p.t - p.T1) / p.T2);
      list = p.fromB.concat(f > 0 ? [{ c: p.c, hid: false, amt: p.k * f }] : []);
    }
    const shakeX = v.nudge > 0 ? Math.sin(v.nudge * 18) * W * 0.12 * v.nudge : 0;
    const complete = !p && isComplete(bottles[i]);
    drawBottle(v.x + shakeX, v.y - v.lift, 0, list, 0, 1, complete ? (v.doneT < 0 ? 1 : T - v.doneT) : -1);
  });

  // marca de pista sobre la botella destino
  if (hint && view[hint.to]) {
    const v = view[hint.to], b = Math.sin(hint.t * 6) * W * 0.16;
    ctx.fillStyle = '#ff6b8b';
    ctx.beginPath();
    ctx.moveTo(v.x - W * 0.3, v.y - W * 1.05 + b); ctx.lineTo(v.x + W * 0.3, v.y - W * 1.05 + b); ctx.lineTo(v.x, v.y - W * 0.55 + b);
    ctx.closePath(); ctx.fill();
  }

  for (const p of pours) {
    const pose = pourPose(p);
    const B = view[p.b];
    if (p.t >= p.T1 && p.t < p.T1 + p.T2) { // chorro
      const surface = B.y + H - (p.fromB.length + p.k * pose.frac) * UH;
      const sw = W * 0.17;
      ctx.fillStyle = COLORS[p.c];
      rr(pose.cx - sw / 2, pose.cy - 2, sw, surface - pose.cy + 4, sw / 2);
      ctx.fill();
    }
    const f = p.t < p.T1 ? 0 : Math.min(1, (p.t - p.T1) / p.T2);
    const list = p.fromA.map((u, j) => (j >= p.fromA.length - p.k ? { ...u, amt: 1 - f } : u));
    drawBottle(pose.px, pose.py, pose.ang, list, pose.kk, p.s, -1);
  }

  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
    ctx.fillStyle = q.color;
    if (q.kind === 1) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillRect(-q.r, -q.r * 0.45, q.r * 2, q.r * 0.9);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.4 + q.life * 0.6), 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function update(dt) {
  T += dt;
  if (hint) hint.t += dt;
  view.forEach((v, i) => {
    const target = i === sel ? UH * 0.6 : 0;
    v.lift += (target - v.lift) * Math.min(1, dt * 18);
    v.nudge = Math.max(0, v.nudge - dt * 3);
  });
  for (const p of pours) {
    p.t += dt;
    if (!p.started && p.t >= p.T1) { p.started = true; sfx.pour(p.T2); }
    if (!p.landed && p.t >= p.T1 + p.T2) { p.landed = true; landed(p); }
    if (p.t >= p.T1 + p.T2 + p.T3) { p.finished = true; view[p.a].busy = false; }
  }
  pours = pours.filter((p) => !p.finished);
  for (const q of particles) {
    q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * q.decay;
    if (q.kind === 1) { q.rot += q.vr * dt; q.vx += Math.sin(T * 3 + q.r) * 40 * dt; }
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
cv.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  let best = -1, bd = Infinity;
  view.forEach((v, i) => {
    const dx = Math.abs(x - v.x);
    if (dx <= v.hit && y > v.y - W * 1.2 && y < v.y + H + W * 0.8 && dx < bd) { bd = dx; best = i; }
  });
  if (best >= 0) tap(best);
  else if (sel >= 0 && !won) { sel = -1; hint = null; sfx.drop(); }
});
// iOS: sin zoom por pellizco ni por doble toque
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- Botones ----------
const on = (id, fn) => { $(id).onclick = () => { sfx.tap(); fn(); }; };
on('btn-play', () => { const i = firstPending(); if (i < 0) show('levels'); else startLevel(i); });
on('btn-levels', () => show('levels'));
on('btn-menu', () => show('menu'));
on('btn-sound', () => { save.sound = !save.sound; persist(); renderHome(); sfx.tap(); });
on('lv-back', () => show('home'));
on('menu-back', () => show('home'));
on('g-back', () => show('home'));
on('g-undo', undo);
on('g-restart', () => startLevel(cur));
on('g-hint', showHint);
on('g-extra', addBottle);
on('win-next', () => { if (cur === LEVELS.length - 1) show('home'); else startLevel(cur + 1); });

// ---------- PWA ----------
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
if (isIOS && !standalone) $('install-hint').classList.remove('hidden');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// Solo para las pruebas automáticas (?test).
if (location.search.includes('test')) {
  window.__test = {
    state: () => ({ bottles, won, busy: pours.length > 0, sel }),
    xy: (i) => { const r = cv.getBoundingClientRect(); return [r.left + view[i].x, r.top + view[i].y + H / 2]; },
    next: () => { const s = solve(bottles, 60000); return s && s.moves[0]; },
  };
}

renderHome();
