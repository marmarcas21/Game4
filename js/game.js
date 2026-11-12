import { parseLevel, initState, slide, solve, DX, DY, WALL, SPIKE } from './engine.js';
import { LEVELS } from './levels.js';

const WORLDS = [
  { name: 'Primeros pasos', color: '#5ec8ff', tip: 'Desliza el dedo: te mueves hasta chocar. Llega a la salida.' },
  { name: 'Gemas', color: '#ffd24a', tip: 'Recoge todas las gemas para abrir la salida.' },
  { name: 'Pinchos', color: '#ff6b6b', tip: 'Cuidado con los pinchos: si los tocas, pierdes el movimiento.' },
  { name: 'Portales', color: '#b388ff', tip: 'Los portales te llevan a su pareja sin frenarte.' },
  { name: 'Bloques frágiles', color: '#ffa94d', tip: 'Los bloques agrietados te frenan una vez y se rompen.' },
  { name: 'Flechas', color: '#4dd6a8', tip: 'Las flechas cambian tu dirección al pasar por encima.' },
  { name: 'El gran final', color: '#ff7ad9', tip: 'Todo junto. Piensa antes de deslizar.' },
];
const PER_WORLD = 10;
const $ = (id) => document.getElementById(id);

// ---------- Guardado ----------
const KEY = 'desliza.v1';
let save = { stars: {}, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* sin guardado */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* modo privado */ } };
const starsOf = (i) => save.stars[i] || 0;
const unlocked = (i) => i === 0 || starsOf(i - 1) > 0;
const totalStars = () => LEVELS.reduce((a, _, i) => a + starsOf(i), 0);
const firstPending = () => LEVELS.findIndex((_, i) => !starsOf(i));

// ---------- Sonido ----------
let ac = null;
function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ac = new AC();
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(freq, dur, { type = 'sine', vol = 0.12, to = 0, delay = 0 } = {}) {
  if (!ac || !save.sound) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const sfx = {
  bump: () => tone(150, 0.09, { type: 'triangle', vol: 0.18, to: 70 }),
  gem: (n) => tone(660 * 2 ** (n / 6), 0.18, { vol: 0.14 }),
  portal: () => tone(300, 0.2, { type: 'sawtooth', vol: 0.05, to: 1200 }),
  crack: () => { tone(220, 0.12, { type: 'square', vol: 0.07, to: 60 }); tone(90, 0.15, { type: 'triangle', vol: 0.15 }); },
  die: () => tone(420, 0.35, { type: 'sawtooth', vol: 0.08, to: 60 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { vol: 0.12, delay: i * 0.09 })),
  tap: () => tone(520, 0.05, { vol: 0.06 }),
};

// ---------- Pantallas ----------
let screen = 'home', running = false;
function show(name) {
  screen = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === name);
  if (name === 'home') renderHome();
  if (name === 'levels') renderLevels();
  if (name === 'game') { resize(); if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
}

function renderHome() {
  const pending = firstPending();
  $('btn-play').textContent = pending === 0 ? 'Jugar' : pending < 0 ? 'Elegir nivel' : `Continuar · Día ${dayOf(pending)}`;
  $('home-progress').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
  $('btn-sound').textContent = `Sonido: ${save.sound ? 'sí' : 'no'}`;
}

const dayOf = (i) => Math.floor(i / PER_WORLD) + 1;

function renderLevels() {
  $('lv-stars').textContent = `★ ${totalStars()}`;
  const list = $('lv-list');
  list.textContent = '';
  const pending = firstPending();
  WORLDS.forEach((w, wi) => {
    const box = document.createElement('div');
    box.className = 'world';
    box.style.setProperty('--c', w.color);
    const h = document.createElement('h3');
    const got = LEVELS.slice(wi * PER_WORLD, (wi + 1) * PER_WORLD).reduce((a, _, k) => a + starsOf(wi * PER_WORLD + k), 0);
    h.innerHTML = `<b><span class="day">Día ${wi + 1}</span> · ${w.name}</b><span>★ ${got}/${PER_WORLD * 3}</span>`;
    h.querySelector('.day').style.cssText = 'color:var(--c);font-size:inherit';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let k = 0; k < PER_WORLD; k++) {
      const i = wi * PER_WORLD + k;
      const b = document.createElement('button');
      const s = starsOf(i);
      b.className = 'lv' + (s ? ' done' : '') + (i === pending ? ' next' : '');
      b.disabled = !unlocked(i);
      b.innerHTML = `${k + 1}<small>${'★'.repeat(s)}</small>`;
      b.onclick = () => { sfx.tap(); startLevel(i); };
      grid.appendChild(b);
    }
    box.append(h, grid);
    list.appendChild(box);
    if (wi === Math.floor(Math.max(pending, 0) / PER_WORLD)) requestAnimationFrame(() => box.scrollIntoView({ block: 'center' }));
  });
}

// ---------- Estado de la partida ----------
const cv = $('cv');
const ctx = cv.getContext('2d');
let cur = 0, P = null, state = null, history = [], moves = 0, usedHint = false;
let vis = { gems: 0, blocks: 0 };      // lo que se ve (va por detrás de la lógica al animar)
let px = 0, py = 0, face = 2;          // posición visual del jugador (en casillas)
let anim = null, queued = -1, busy = false;
let squash = 0, squashDir = 0, shake = 0, dead = 0, hint = null, gemCount = 0;
let particles = [];
let cs = 40, ox = 0, oy = 0, vw = 0, vh = 0, T = 0, last = 0;
let accent = '#5ec8ff';

function startLevel(i) {
  cur = i;
  P = parseLevel(LEVELS[i]);
  accent = WORLDS[Math.floor(i / PER_WORLD)].color;
  const k = i % PER_WORLD;
  $('g-title').textContent = `Día ${dayOf(i)} · Nivel ${k + 1}`;
  $('g-tip').textContent = k === 0 ? WORLDS[Math.floor(i / PER_WORLD)].tip : '';
  $('win').classList.add('hidden');
  resetLevel();
  show('game');
}

function resetLevel() {
  state = initState(P);
  history = [];
  moves = 0;
  usedHint = false;
  anim = null; queued = -1; busy = false; dead = 0; hint = null; gemCount = 0;
  particles = [];
  syncVisual();
  updateHud();
}

function syncVisual() {
  vis = { gems: state.gems, blocks: state.blocks };
  px = state.pos % P.w;
  py = Math.floor(state.pos / P.w);
  gemCount = bits(state.gems);
}
const bits = (m) => { let c = 0; for (; m; m &= m - 1) c++; return c; };

function updateHud() {
  $('g-moves').textContent = `${moves} / ${P.par}`;
  $('g-undo').disabled = !history.length;
}

function input(dir) {
  if (screen !== 'game' || !$('win').classList.contains('hidden')) return;
  if (busy) return;
  if (anim) { queued = dir; return; }
  const r = slide(P, state, dir);
  face = dir;
  hint = null;
  if (!r.moved) { squash = 1; squashDir = dir; sfx.bump(); return; }
  history.push({ s: state, moves });
  state = r.state;
  moves++;
  updateHud();
  anim = { steps: r.steps, i: 0, p: 0, fx: px, fy: py, result: r.result };
}

function undo() {
  if (busy || !history.length) return;
  const h = history.pop();
  state = h.s; moves = h.moves;
  anim = null; queued = -1; hint = null;
  syncVisual(); updateHud();
}

function showHint() {
  if (busy || anim) return;
  const sol = solve(P, state);
  if (!sol) { $('g-tip').textContent = 'Desde aquí no hay salida: deshaz o reinicia.'; return; }
  usedHint = true;
  hint = { dir: sol.dirs[0], t: 0 };
}

// ---------- Animación ----------
const SPEED = 26; // casillas por segundo

function cellXY(i) { return [i % P.w, Math.floor(i / P.w)]; }

function burst(cx, cy, color, n = 10, power = 1) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = (1.5 + Math.random() * 4) * power;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, r: 0.05 + Math.random() * 0.07 });
  }
}

function arrive(st) {
  const [x, y] = cellXY(st.at);
  if (st.gem !== undefined) {
    vis.gems |= 1 << st.gem;
    sfx.gem(gemCount++);
    burst(x + 0.5, y + 0.5, '#ffd24a', 12);
  }
  if (P.arrowAt[st.at] >= 0) face = P.arrowAt[st.at];
}

function update(dt) {
  T += dt;
  squash = Math.max(0, squash - dt * 7);
  shake = Math.max(0, shake - dt * 3);
  if (hint) { hint.t += dt; if (hint.t > 4) hint = null; }
  for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt * 1.8; }
  particles = particles.filter((q) => q.life > 0);

  if (dead > 0) {
    dead -= dt;
    if (dead <= 0) { // tras morir se vuelve a la posición anterior (el movimiento cuenta)
      const h = history.pop();
      state = h.s;
      syncVisual();
      busy = false; dead = 0;
    }
    return;
  }

  let rem = dt;
  while (anim && rem > 0) {
    const st = anim.steps[anim.i];
    if (!st) { finish(); break; }
    if (st.k === 'm') {
      const [tx, ty] = cellXY(st.at);
      const need = (1 - anim.p) / SPEED;
      if (rem >= need) {
        rem -= need;
        px = tx; py = ty; anim.fx = tx; anim.fy = ty; anim.p = 0; anim.i++;
        arrive(st);
      } else {
        anim.p += rem * SPEED; rem = 0;
        px = anim.fx + (tx - anim.fx) * anim.p;
        py = anim.fy + (ty - anim.fy) * anim.p;
      }
    } else if (st.k === 't') {
      const [tx, ty] = cellXY(st.at);
      burst(px + 0.5, py + 0.5, portalColor(P.portalId[st.at]), 8, 0.7);
      px = tx; py = ty; anim.fx = tx; anim.fy = ty; anim.i++;
      burst(px + 0.5, py + 0.5, portalColor(P.portalId[st.at]), 8, 0.7);
      sfx.portal();
    } else { // bloque frágil
      const [bx, by] = cellXY(st.at);
      vis.blocks |= 1 << st.block;
      burst(bx + 0.5, by + 0.5, '#c9b08a', 14);
      sfx.crack();
      squash = 1; squashDir = st.d; shake = 0.35;
      anim.i++;
    }
  }
}

function finish() {
  const { result, steps } = anim;
  const lastStep = steps[steps.length - 1];
  anim = null;
  if (result === 'win') return win();
  if (result === 'dead') {
    busy = true; dead = 0.55; shake = 1; queued = -1;
    burst(px + 0.5, py + 0.5, '#ff6b6b', 22, 1.3);
    sfx.die();
    return;
  }
  if (lastStep.k !== 'b') { squash = 1; squashDir = lastStep.d; sfx.bump(); }
  if (queued >= 0) { const d = queued; queued = -1; input(d); }
}

function win() {
  busy = true;
  const slack = Math.max(2, Math.ceil(P.par * 0.4));
  let stars = moves <= P.par ? 3 : moves <= P.par + slack ? 2 : 1;
  if (usedHint) stars = Math.min(stars, 2);
  save.stars[cur] = Math.max(starsOf(cur), stars);
  persist();
  sfx.win();
  burst(px + 0.5, py + 0.5, '#7dffb0', 30, 1.5);
  const isLast = cur === LEVELS.length - 1;
  const dayDone = cur % PER_WORLD === PER_WORLD - 1;
  $('win-title').textContent = isLast ? '¡Juego completado!' : dayDone ? `¡Día ${dayOf(cur)} completado!` : '¡Nivel superado!';
  $('win-stars').innerHTML = [1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}">★</span>`).join('');
  $('win-text').textContent = stars === 3 ? `Perfecto: ${moves} movimientos.`
    : usedHint && moves <= P.par ? 'Con pista, máximo 2 estrellas.'
    : `${moves} movimientos. El mínimo es ${P.par}.`;
  $('win-next').textContent = isLast ? 'Inicio' : 'Siguiente';
  const level = cur;
  setTimeout(() => { if (busy && cur === level && screen === 'game') $('win').classList.remove('hidden'); }, 550);
}

// ---------- Dibujo ----------
function resize() {
  const r = $('stage').getBoundingClientRect();
  if (!r.width || !P) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  vw = r.width; vh = r.height;
  cv.width = Math.round(vw * dpr);
  cv.height = Math.round(vh * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cs = Math.floor(Math.min((vw - 16) / P.w, (vh - 16) / P.h, 72));
  ox = Math.round((vw - cs * P.w) / 2);
  oy = Math.round((vh - cs * P.h) / 2);
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

const portalColor = (id) => ['#b388ff', '#ff9d5c', '#5cffd1', '#ff5ca8'][id] || '#b388ff';

function chevron(cx, cy, dir, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(-size, size * 0.5);
  ctx.lineTo(0, -size * 0.5);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);

  rr(ox - 8, oy - 8, cs * P.w + 16, cs * P.h + 16, 18);
  ctx.fillStyle = '#131a36';
  ctx.fill();

  const rad = cs * 0.2;
  for (let i = 0; i < P.n; i++) {
    const cx = i % P.w, cy = Math.floor(i / P.w);
    const x = ox + cx * cs, y = oy + cy * cs, mx = x + cs / 2, my = y + cs / 2;

    if (P.type[i] === WALL) {
      rr(x + 1, y + 1, cs - 2, cs - 2, rad);
      ctx.fillStyle = '#34406f';
      ctx.fill();
      ctx.globalAlpha = 0.28; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
      rr(x + 1, y + 1, cs - 2, cs * 0.42, rad);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fill();
      continue;
    }

    rr(x + 1, y + 1, cs - 2, cs - 2, rad);
    ctx.fillStyle = (cx + cy) % 2 ? '#1b2447' : '#1f2a52';
    ctx.fill();

    if (P.type[i] === SPIKE) {
      ctx.fillStyle = 'rgba(255,107,107,.16)';
      ctx.fill();
      ctx.fillStyle = '#ff6b6b';
      const s = cs * 0.2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const bx = mx + sx * s * 0.95, by = my + sy * s * 0.95;
        ctx.beginPath();
        ctx.moveTo(bx, by - s * 0.8);
        ctx.lineTo(bx + s * 0.7, by + s * 0.6);
        ctx.lineTo(bx - s * 0.7, by + s * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (i === P.goal) {
      const openGoal = vis.gems === P.allGems;
      const pulse = openGoal ? 0.5 + 0.5 * Math.sin(T * 5) : 0;
      ctx.lineWidth = cs * 0.1;
      ctx.strokeStyle = openGoal ? '#7dffb0' : '#56608c';
      ctx.beginPath(); ctx.arc(mx, my, cs * (0.28 + pulse * 0.03), 0, 7); ctx.stroke();
      ctx.fillStyle = openGoal ? `rgba(125,255,176,${0.25 + pulse * 0.3})` : 'rgba(86,96,140,.2)';
      ctx.beginPath(); ctx.arc(mx, my, cs * 0.16, 0, 7); ctx.fill();
    }

    if (P.portalId[i] >= 0) {
      ctx.strokeStyle = portalColor(P.portalId[i]);
      ctx.lineWidth = cs * 0.08;
      ctx.setLineDash([cs * 0.22, cs * 0.12]);
      ctx.lineDashOffset = -T * cs * 0.8;
      ctx.beginPath(); ctx.arc(mx, my, cs * 0.3, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(mx, my, cs * 0.17, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (P.arrowAt[i] >= 0) {
      ctx.strokeStyle = '#4dd6a8';
      ctx.lineWidth = cs * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const off = ((T * 1.5) % 1) * cs * 0.12;
      const d = P.arrowAt[i];
      ctx.globalAlpha = 0.9;
      chevron(mx + DX[d] * (off - cs * 0.1), my + DY[d] * (off - cs * 0.1), d, cs * 0.2);
      ctx.globalAlpha = 0.4;
      chevron(mx + DX[d] * (off + cs * 0.1), my + DY[d] * (off + cs * 0.1), d, cs * 0.2);
      ctx.globalAlpha = 1;
    }

    const b = P.blockAt[i];
    if (b >= 0 && !((vis.blocks >> b) & 1)) {
      rr(x + 3, y + 3, cs - 6, cs - 6, rad);
      ctx.fillStyle = '#b39a74';
      ctx.fill();
      ctx.strokeStyle = '#5d4c33';
      ctx.lineWidth = Math.max(1.5, cs * 0.04); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + cs * 0.3, y + cs * 0.14);
      ctx.lineTo(x + cs * 0.46, y + cs * 0.42);
      ctx.lineTo(x + cs * 0.36, y + cs * 0.6);
      ctx.lineTo(x + cs * 0.56, y + cs * 0.86);
      ctx.moveTo(x + cs * 0.46, y + cs * 0.42);
      ctx.lineTo(x + cs * 0.74, y + cs * 0.5);
      ctx.stroke();
    }

    const g = P.gemAt[i];
    if (g >= 0 && !((vis.gems >> g) & 1)) {
      const bob = Math.sin(T * 3 + i) * cs * 0.03, s = cs * 0.2;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(mx, my - s * 1.2 + bob); ctx.lineTo(mx + s, my + bob);
      ctx.lineTo(mx, my + s * 1.2 + bob); ctx.lineTo(mx - s, my + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.moveTo(mx, my - s * 1.2 + bob); ctx.lineTo(mx + s, my + bob); ctx.lineTo(mx, my + bob);
      ctx.closePath(); ctx.fill();
    }
  }

  // pista
  if (hint && !anim) {
    const a = 0.5 + 0.5 * Math.sin(hint.t * 8), d = hint.dir;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + a * 0.5})`;
    ctx.lineWidth = cs * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = cs * (0.85 + a * 0.15);
    chevron(ox + (px + 0.5) * cs + DX[d] * k, oy + (py + 0.5) * cs + DY[d] * k, d, cs * 0.24);
  }

  // jugador
  if (dead <= 0 || dead > 0.4) {
    const mx = ox + (px + 0.5) * cs, my = oy + (py + 0.5) * cs;
    const horiz = squashDir % 2 === 1;
    const q = Math.sin(squash * Math.PI) * 0.22;
    const sw = cs * 0.74 * (horiz ? 1 - q : 1 + q * 0.6);
    const sh = cs * 0.74 * (horiz ? 1 + q * 0.6 : 1 - q);
    const nx = mx + DX[squashDir] * q * cs * 0.3, ny = my + DY[squashDir] * q * cs * 0.3;
    ctx.shadowColor = accent; ctx.shadowBlur = cs * 0.35;
    rr(nx - sw / 2, ny - sh / 2, sw, sh, cs * 0.24);
    ctx.fillStyle = '#f4f7ff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1020';
    const ex = nx + DX[face] * cs * 0.1, ey = ny + DY[face] * cs * 0.1 - cs * 0.03;
    const blink = T % 3.2 < 0.12 ? 0.2 : 1;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(ex + sgn * cs * 0.13, ey, cs * 0.055, cs * 0.085 * blink, 0, 0, 7);
      ctx.fill();
    }
  }

  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(ox + q.x * cs, oy + q.y * cs, q.r * cs * (0.5 + q.life), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
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
let sx = 0, sy = 0, tracking = false;
const SWIPE = 22;
$('game').addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.target.closest('button')) return;
  tracking = true; sx = e.clientX; sy = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!tracking) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
  input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  sx = e.clientX; sy = e.clientY; // permite encadenar deslizamientos sin levantar el dedo
});
const stopTrack = () => { tracking = false; };
window.addEventListener('pointerup', stopTrack);
window.addEventListener('pointercancel', stopTrack);
window.addEventListener('keydown', (e) => {
  const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
  if (d !== undefined) { e.preventDefault(); input(d); }
  else if (e.key === 'z') undo();
  else if (e.key === 'r') resetLevel();
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
on('btn-sound', () => { save.sound = !save.sound; persist(); renderHome(); sfx.tap(); });
on('lv-back', () => show('home'));
on('g-back', () => show('levels'));
on('g-undo', undo);
on('g-restart', resetLevel);
on('g-hint', showHint);
on('win-retry', () => startLevel(cur));
on('win-next', () => { if (cur === LEVELS.length - 1) show('home'); else startLevel(cur + 1); });

// ---------- PWA ----------
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
if (isIOS && !standalone) $('install-hint').classList.remove('hidden');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

renderHome();
