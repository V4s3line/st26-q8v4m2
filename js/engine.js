'use strict';
// Движок: экран, ввод, звук, текст, частицы, игровой цикл.
// Логическое разрешение 480×270 (16:9), всё масштабируется под экран.

const W = 480, H = 270;
const FONT = '"Press Start 2P", monospace';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let SCALE = 1, DPR = 1;

function resize() {
  DPR = window.devicePixelRatio || 1;
  SCALE = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.floor(W * SCALE) + 'px';
  cv.style.height = Math.floor(H * SCALE) + 'px';
  cv.width = Math.floor(W * SCALE * DPR);
  cv.height = Math.floor(H * SCALE * DPR);
}
window.addEventListener('resize', resize);
resize();

// ---------- утилиты ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function mulberry32(seed) {
  return function () {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- ввод: мышь, тач, клавиатура ----------
const Input = {
  x: W / 2, y: H / 2, down: false, tapped: false, pointerType: 'mouse', usingPointer: false,
  keys: {}, pressedKeys: {},
  get action() { return this.tapped || !!this.pressedKeys[' '] || !!this.pressedKeys['Enter']; },
  axisX() {
    const k = this.keys;
    const l = k['ArrowLeft'] || k['a'] || k['A'] || k['ф'] || k['Ф'];
    const r = k['ArrowRight'] || k['d'] || k['D'] || k['в'] || k['В'];
    return (r ? 1 : 0) - (l ? 1 : 0);
  },
  endFrame() { this.tapped = false; this.pressedKeys = {}; },
};
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
window.addEventListener('pointerdown', e => {
  const p = toLogical(e);
  Object.assign(Input, { x: p.x, y: p.y, down: true, tapped: true, pointerType: e.pointerType, usingPointer: true });
  Sound.unlock();
});
window.addEventListener('pointermove', e => {
  const p = toLogical(e);
  Input.x = p.x; Input.y = p.y;
  if (e.pointerType === 'mouse') { Input.pointerType = 'mouse'; Input.usingPointer = true; }
});
window.addEventListener('pointerup', () => { Input.down = false; });
window.addEventListener('pointercancel', () => { Input.down = false; });
window.addEventListener('keydown', e => {
  if (!e.repeat) Input.pressedKeys[e.key] = true;
  Input.keys[e.key] = true;
  Input.usingPointer = false;
  Sound.unlock();
  if (e.key === 'm' || e.key === 'ь') Sound.muted = !Sound.muted;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { Input.keys[e.key] = false; });
window.addEventListener('blur', () => { Input.keys = {}; Input.down = false; });
document.addEventListener('contextmenu', e => e.preventDefault());

function goFullscreen() {
  const el = document.documentElement;
  try {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req || document.fullscreenElement) return;
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => {
      try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    }).catch(() => {});
  } catch (e) {}
}

// ---------- звук: синтез 8-бит через WebAudio ----------
const Sound = {
  ac: null, muted: false,
  unlock() {
    if (!this.ac) {
      try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  },
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0, when = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + when;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  seq(notes, step = 0.09, type = 'square', vol = 0.07) {
    notes.forEach((n, i) => { if (n) this.tone(n, step * 0.95, type, vol, 0, i * step); });
  },
  noise(dur = 0.3, vol = 0.15) {
    if (!this.ac || this.muted) return;
    const n = Math.floor(this.ac.sampleRate * dur);
    const b = this.ac.createBuffer(1, n, this.ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = this.ac.createBufferSource(), g = this.ac.createGain();
    s.buffer = b; g.gain.value = vol;
    s.connect(g).connect(this.ac.destination);
    s.start();
  },
  blip()    { this.tone(660, 0.06, 'square', 0.06); },
  pop()     { this.tone(700, 0.07, 'triangle', 0.12, 500); },
  click()   { this.tone(180 + Math.random() * 60, 0.05, 'square', 0.07, -80); },
  hit()     { this.tone(140, 0.15, 'square', 0.1, -70); this.noise(0.08, 0.08); },
  nope()    { this.tone(110, 0.18, 'sawtooth', 0.07); },
  boom()    { this.noise(0.6, 0.25); this.tone(80, 0.4, 'sine', 0.2, -50); },
  verb()    { this.seq([392, 523, 659], 0.07); },
  win()     { this.seq([523, 659, 784, 1047], 0.08); },
  lose()    { this.seq([392, 330, 262, 196], 0.12, 'sawtooth', 0.06); },
  pity()    { this.seq([262, 0, 262, 247, 233], 0.14, 'triangle', 0.1); },
  fanfare() { this.seq([523, 523, 523, 659, 0, 523, 659, 784, 0, 1047, 1047], 0.11, 'square', 0.07); },
};

// Фоновая музыка: короткая чиптюн-петля
const Music = {
  timer: null, step: 0, next: 0,
  MEL: [659, 0, 784, 0, 659, 587, 523, 0, 587, 0, 659, 0, 587, 523, 440, 0,
        523, 0, 659, 0, 784, 659, 587, 0, 523, 0, 587, 0, 523, 0, 0, 0],
  BASS: [131, 110, 87, 98],
  start() {
    if (this.timer || !Sound.ac) return;
    this.next = Sound.ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
  },
  tick() {
    const ac = Sound.ac;
    while (this.next < ac.currentTime + 0.2) {
      const i = this.step % 32, when = this.next - ac.currentTime;
      if (this.MEL[i]) Sound.tone(this.MEL[i], 0.13, 'triangle', 0.03, 0, when);
      if (i % 8 === 0) Sound.tone(this.BASS[(i / 8) % 4], 0.5, 'square', 0.015, 0, when);
      if (i % 8 === 4) Sound.tone(this.BASS[(i / 8 | 0) % 4] * 1.5, 0.3, 'square', 0.012, 0, when);
      this.next += 0.15;
      this.step++;
    }
  },
};

// ---------- текст и интерфейс в стиле Майнкрафта ----------
function text(str, x, y, o = {}) {
  const size = o.size || 8;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'top';
  if (o.shadow !== false) {
    const d = Math.max(1, size / 8);
    ctx.fillStyle = o.shadowColor || 'rgba(0,0,0,0.6)';
    ctx.fillText(str, x + d, y + d);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y);
}
function wrap(str, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}
// Тултип из Майнкрафта: тёмный фон, фиолетовая рамка
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(16,0,16,0.94)';
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = '#4a22b8'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillStyle = '#26105e'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillStyle = '#3a1890'; ctx.fillRect(x + 1, y + 2, 1, h - 4); ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
}
// Каменная кнопка из меню Майнкрафта
function button(x, y, w, h, label, hl) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = hl ? '#7d8ad0' : '#6f6f6f'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hl ? '#a9b4f0' : '#a6a6a6'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = hl ? '#4a5394' : '#444'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 1, y, 1, h);
  text(label, x + w / 2, y + h / 2 - 3, { size: 8, color: hl ? '#ffffa0' : '#fff' });
}

// ---------- частицы ----------
const FX = {
  list: [],
  add(p) { this.list.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, size: 2, color: '#fff', age: 0 }, p)); },
  burst(x, y, n, colors, spd = 80, extra = {}) {
    for (let i = 0; i < n; i++) {
      this.add(Object.assign({
        x, y, vx: rand(-spd, spd), vy: rand(-spd, spd * 0.3) - spd * 0.4,
        g: 320, life: rand(0.4, 0.9), size: randi(1, 3), color: choice(colors),
      }, extra));
    }
  },
  update(dt) {
    for (const p of this.list) { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.list = this.list.filter(p => p.age < p.life);
  },
  draw() {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(1 - Math.pow(p.age / p.life, 3), 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },
  clear() { this.list = []; },
};

// ---------- игровой цикл и сцены ----------
const Game = {
  scene: null, shakeT: 0, shakeMag: 0, flashT: 0, flashMax: 1, flashColor: '#fff',
  shake(t, mag) { this.shakeT = Math.max(this.shakeT, t); this.shakeMag = mag; },
  flash(color, t) { this.flashColor = color; this.flashT = t; this.flashMax = t; },
};
function setScene(s) { Game.scene = s; }

const portraitMQ = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  ctx.setTransform(SCALE * DPR, 0, 0, SCALE * DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (!portraitMQ.matches && Game.scene) {
    Game.scene.update(dt);
    FX.update(dt);
    Game.shakeT = Math.max(0, Game.shakeT - dt);
    Game.flashT = Math.max(0, Game.flashT - dt);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (Game.shakeT > 0) ctx.translate(rand(-1, 1) * Game.shakeMag, rand(-1, 1) * Game.shakeMag);
    Game.scene.draw();
    FX.draw();
    ctx.restore();
    if (Game.flashT > 0) {
      ctx.globalAlpha = Game.flashT / Game.flashMax;
      ctx.fillStyle = Game.flashColor; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
  Input.endFrame();
  requestAnimationFrame(frame);
}
function startLoop(firstScene) {
  setScene(firstScene);
  requestAnimationFrame(frame);
}
