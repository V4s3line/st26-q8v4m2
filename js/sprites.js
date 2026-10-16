'use strict';
// Пиксельные спрайты (рисуются из строк), текстуры блоков и фон мира.

function makeSprite(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const col = pal[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}
function spr(img, x, y, s = 1, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) { ctx.drawImage(img, x, y, img.width * s, img.height * s); return; }
  ctx.save();
  ctx.translate(x + img.width * s, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, img.width * s, img.height * s);
  ctx.restore();
}

// ---------- Стёпа: скин по канону Майнкрафта (голова 8×8, тело 8×12, руки и ноги 4×12) ----------
// Приметы с фото: круглые очки, рыжая борода, каштановые волосы вверх,
// джинсовка с меховым воротником поверх чёрного худи.
const PAL_STEPA = {
  H: '#5e3219', h: '#7a4424',                 // волосы
  S: '#f2b58f', s: '#dc9a74',                 // кожа
  G: '#3b3b3b', E: '#3a2a22', L: '#d9e9ef',   // оправа, глаза, линзы
  B: '#b8592b', b: '#94431f', M: '#6e2e22',   // борода, рот
  J: '#5f8fcf', j: '#4672ad', W: '#efe8da',   // джинсовка, мех
  K: '#1d1d24', w: '#d8d8d8',                 // худи, шнурки
  D: '#2f4066', d: '#26355a', O: '#3b2a1f',   // джинсы, ботинки
};
function stepaRows(frame) {
  const pad = s => '....' + s + '....';
  const head = [
    '.HHhHH..',
    'HHHHHHHH',
    'HhHHHHhH',
    'HSSSSSSH',
    'SGGGGGGS',
    'SLEGGELS',
    'SGGSSGGS',
    'BSBBBBSB',
    'bBBMMBBb',
  ].map(pad);
  const body = [
    'JJJJWWKKKKWWJJJJ',
    'JJJjJWKKKKWJjJJJ',
    'JJJjJJwKKwJJjJJJ',
    'JJJjJJwKKwJJjJJJ',
    'JJJjJJKKKKJJjJJJ',
    'JJJjJJKKKKJJjJJJ',
    'JJJjjJKKKKJjjJJJ',
    'JJJjJJKKKKJJjJJJ',
    'JJJjJJKKKKJJjJJJ',
    'JJJjJJKKKKJJjJJJ',
    'SSSSjjKKKKjjSSSS',
    'sSSsjjKKKKjjsSSs',
  ];
  // frame 0 — стоит, 1 и 2 — шаг (поднята левая или правая нога)
  const legs = [];
  for (let i = 0; i < 12; i++) {
    const leg = (lifted, c) => {
      const row = lifted ? i + 1 : i;
      if (row >= 12) return '....';
      return row >= 10 ? 'OOOO' : c.repeat(4);
    };
    legs.push('....' + leg(frame === 1, 'D') + leg(frame === 2, 'd') + '....');
  }
  return [...head, ...body, ...legs];
}

const PAL_CREEPER = { g: '#4caf3c', G: '#3d8f2f', l: '#7bd35f', D: '#111', d: '#2a2a2a' };
const PAL_BOTTLE = { Y: '#e8c34a', N: '#6e4219', n: '#a06628', L: '#f3e3b5', R: '#c0392b' };
const PAL_HEART = { R: '#e2231a', r: '#a5120c', W: '#ffd0d0', K: '#000', E: '#3a3a3a' };

const SPR = {
  stepa: [0, 1, 2].map(f => makeSprite(stepaRows(f), PAL_STEPA)),
  creeper: makeSprite([
    'gGglgGgg',
    'lggGgglg',
    'gDDggDDg',
    'gDDGgDDg',
    'gggDDggG',
    'gGDDDDgg',
    'ggDggDlg',
    'GglgggGg',
  ], PAL_CREEPER),
  bottle: makeSprite([
    '..YY..',
    '..Nn..',
    '..Nn..',
    '.NNnN.',
    'NNNNnN',
    'NLLLLN',
    'NLRRLN',
    'NLLLLN',
    'NNNNnN',
    'NNNNnN',
    'NNNNnN',
    '.NNNN.',
  ], PAL_BOTTLE),
  heart: makeSprite([
    '.KK.KK.',
    'KRWKRRK',
    'KRRRRRK',
    '.KRRRK.',
    '..KRK..',
    '...K...',
  ], PAL_HEART),
  heartEmpty: makeSprite([
    '.KK.KK.',
    'KEEKEEK',
    'KEEEEEK',
    '.KEEEK.',
    '..KEK..',
    '...K...',
  ], PAL_HEART),
};

// ---------- авокадо (разрез с косточкой) ----------
SPR.avocado = makeSprite([
  '...dd...',
  '..dlld..',
  '.dlyyld.',
  '.dlyyld.',
  'dlyyyyld',
  'dlyPPyld',
  'dlyPPyld',
  'dlyyyyld',
  '.dlllld.',
  '..dddd..',
], { d: '#2f5a1c', l: '#7fb33a', y: '#d8e86a', P: '#7a4a22' });

// ---------- девушки: та же схема скина, разные причёски и платья ----------
function girlRows(frame) {
  const pad = s => '....' + s + '....';
  const head = ['HHHHHHHH', 'HHHHHHHH', 'HHSSSSHH', 'HSESSESH', 'HSSSSSSH', 'HSSRRSSH', 'HHSSSSHH', 'HH.SS.HH'].map(pad);
  const body = [
    'CCCCHCCCCCCHCCCC',
    'CCCCHCCCCCCHCCCC',
    'SSSSHCCCCCCHSSSS',
    ...Array(7).fill('SSSSCCCCCCCCSSSS'),
    'SSSSccccccccSSSS',
    'ssssccccccccssss',
  ];
  const legs = [];
  for (let i = 0; i < 12; i++) {
    const leg = (lifted, c) => {
      const row = lifted ? i + 1 : i;
      if (row >= 12) return '....';
      if (row >= 10) return 'OOOO';
      return row < 3 ? 'cccc' : c.repeat(4);
    };
    legs.push('....' + leg(frame === 1, 'S') + leg(frame === 2, 's') + '....');
  }
  return [...head, ...body, ...legs];
}
const GIRL_HAIR = ['#2a1a12', '#e8c66a', '#8a3a1a', '#151515', '#c05080'];
const GIRL_DRESS = [['#e04a7a', '#b8335e'], ['#4ab0e0', '#2e86b4'], ['#f0d050', '#c4a830'], ['#9a5ae0', '#7340b0'], ['#f4f4f4', '#cfcfcf']];
SPR.girls = GIRL_HAIR.map((hair, i) => {
  const [C, c] = GIRL_DRESS[i];
  const pal = { H: hair, S: '#f6c9a8', s: '#e2b08e', E: '#2a2030', R: '#d0506a', C, c, O: '#3a2030' };
  return [0, 1, 2].map(f => makeSprite(girlRows(f), pal));
});

// Крипер целиком (для прогулок по земле)
SPR.creeperFull = makeSprite([
  'gGglgGgg', 'lggGgglg', 'gDDggDDg', 'gDDGgDDg', 'gggDDggG', 'gGDDDDgg', 'ggDggDlg', 'GglgggGg',
  '..gGlg..', '..lggG..', '..gGgg..', '..ggGl..', '..Gglg..', '..gggG..',
  '..lGgg..', '..gglG..', '..Gggg..', '..gGlg..', '..ggGg..', '..lggG..',
  'gGgggGlg', 'gglGgggG', 'GggggGgg', 'gGlggGgl',
], PAL_CREEPER);

// ---------- предметы для уровней ----------
const BOTTLE_ROWS = [
  '..YY..', '..Nn..', '..Nn..', '.NNnN.', 'NNNNnN', 'NLLLLN',
  'NLRRLN', 'NLLLLN', 'NNNNnN', 'NNNNnN', 'NNNNnN', '.NNNN.',
];
SPR.whisky = makeSprite(BOTTLE_ROWS, { Y: '#1a1a1a', N: '#c8781e', n: '#e8a040', L: '#1a1a1a', R: '#d8b048' });
SPR.beer = makeSprite(BOTTLE_ROWS, { Y: '#d8d8d8', N: '#2f7a2a', n: '#56b04a', L: '#f3e3b5', R: '#2a5a9a' });
SPR.suitcase = makeSprite([
  '....KKKK....', '....K..K....', 'BBBBBBBBBBBB', 'BbBBBBBBBBbB', 'BBBBBBBBBBBB',
  'BYYYYYYYYYYB', 'BBBBBBBBBBBB', 'BbBBBBBBBBbB', 'BBBBBBBBBBBB', '.K........K.',
], { B: '#a0522d', b: '#7a3c1e', Y: '#e8c34a', K: '#222' });
SPR.pigeon = makeSprite([
  '...gg...', '..gEgO..', 'gggggg..', '.gGGggg.', '..gggg..', '...O.O..',
], { g: '#8a8f9a', G: '#6a6f7a', E: '#111', O: '#e08a2a' });
SPR.earbud = makeSprite([
  '.WWW.', 'WWWWW', 'WWWWw', '.WWw.', '..Ww.', '..ww.',
], { W: '#f4f4f4', w: '#bdbdbd' });
SPR.headT = makeSprite([
  '..KKKK..', '.KKKKKK.', 'KKKKKKKK', 'KSSSSSSK', 'KSEKKESK', 'KKKKKKKK', '.KKKKKK.', '..KKKK..',
], { K: '#2a2a2a', S: '#d9a07a', E: '#111' });
SPR.headCT = makeSprite([
  '..BBBB..', '.BBBBBB.', 'BBBBBBBB', 'BSSSSSSB', 'SSESSESS', 'SSSSSSSS', '.SSMMSS.', '..SSSS..',
], { B: '#3a5fa8', S: '#e2b08e', E: '#111', M: '#a0604a' });
SPR.phantom = makeSprite([
  'BB....................BB',
  'BBB..................BBB',
  '.BBBB..............BBBB.',
  '..BBBBBBBBEEBBEEBBBBBB..',
  '...BBBBBBBBBBBBBBBBBB...',
  '....bbBBBBBBBBBBBBbb....',
  '......bbbBBBBBBbbb......',
  '.........bbBBbb.........',
  '..........bBBb..........',
  '...........bb...........',
], { B: '#4a5a8a', b: '#33406a', E: '#7dff6a' });

// ---------- блоки 16×16 с процедурной текстурой ----------
const DIRT = ['#8b5a2b', '#7a4e25', '#9b6a3a', '#6d4421'];
const GRASS = ['#5fa33a', '#6fb544', '#4f8f2e', '#62a83c'];
const STONE = ['#8a8a8a', '#7d7d7d', '#999999', '#6f6f6f', '#858585'];
const GOLD = ['#f8d94a', '#e8c030', '#fff07a', '#d9b024'];
function makeBlock(kind, seed) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let pal = kind === 'stone' ? STONE : kind === 'gold' ? GOLD : DIRT;
      if (kind === 'grass' && (y < 3 || (y < 5 && r() < 0.45 - (y - 3) * 0.2))) pal = GRASS;
      if (kind === 'brick') pal = STONE;
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      // каменный кирпич: швы через 8 пикселей со сдвигом рядов
      if (kind === 'brick' && (y % 8 === 7 || x === ((y < 8) ? 0 : 8))) g.fillStyle = '#5a5a5a';
      if (kind === 'gold' && (x === 0 || y === 0)) g.fillStyle = '#fff6a0';
      if (kind === 'gold' && (x === 15 || y === 15)) g.fillStyle = '#b08a10';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
SPR.grass = [1, 2, 3, 4].map(s => makeBlock('grass', s * 17));
SPR.dirt = [5, 6, 7].map(s => makeBlock('dirt', s * 31));
SPR.stone = makeBlock('stone', 99);
SPR.brick = makeBlock('brick', 41);
SPR.gold = makeBlock('gold', 77);

// Трещины для ломания блока: точки в порядке появления (от центра к краям)
const CRACKS = (() => {
  const r = mulberry32(7), pts = [];
  for (let k = 0; k < 6; k++) {
    let x = 8, y = 8;
    const dx = Math.cos(k * 1.05 + r()), dy = Math.sin(k * 1.05 + r());
    for (let i = 0; i < 9; i++) {
      x += dx + (r() - 0.5); y += dy + (r() - 0.5);
      if (x >= 0 && x < 16 && y >= 0 && y < 16) pts.push({ x: x | 0, y: y | 0, i });
    }
  }
  return pts.sort((a, b) => a.i - b.i);
})();

// ---------- фон мира ----------
const GROUND_Y = 238;
const CLOUDS = Array.from({ length: 7 }, (_, i) => ({
  x: i * 80 + rand(0, 40), y: rand(14, 90), w: randi(3, 6) * 8, h: randi(1, 2) * 8, s: rand(4, 10),
}));
const STARS = Array.from({ length: 50 }, () => ({ x: randi(0, W), y: randi(0, 200), b: rand(0, 6) }));

function drawWorld(t, o = {}) {
  const night = o.night;
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (night) { sky.addColorStop(0, '#070a22'); sky.addColorStop(1, '#232c5a'); }
  else { sky.addColorStop(0, '#78a7ff'); sky.addColorStop(1, '#c3dcff'); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);
  if (night) {
    for (const s of STARS) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.b));
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8ecff'; ctx.fillRect(398, 22, 22, 22);
    ctx.fillStyle = '#c9cfee'; ctx.fillRect(402, 26, 6, 6); ctx.fillRect(410, 34, 4, 4);
  } else {
    ctx.fillStyle = '#fff6a8'; ctx.fillRect(398, 22, 26, 26);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(402, 26, 18, 18);
  }
  ctx.fillStyle = night ? 'rgba(190,200,255,0.12)' : 'rgba(255,255,255,0.92)';
  for (const c of CLOUDS) {
    const x = ((c.x + t * c.s) % (W + 80)) - 60;
    ctx.fillRect(Math.round(x), c.y, c.w, c.h);
  }
  for (let i = 0; i < W / 16; i++) {
    spr(SPR.grass[(i * 7) % 4], i * 16, GROUND_Y);
    spr(SPR.dirt[(i * 5) % 3], i * 16, GROUND_Y + 16);
  }
  if (night) { ctx.fillStyle = 'rgba(8,12,45,0.5)'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y); }
}
// Фон меню Майнкрафта: затемнённая земля
function drawDirtBg() {
  for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) spr(SPR.dirt[((x + y * 3) / 16) % 3], x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
}
function drawHearts(xRight, y, full, max) {
  for (let i = 0; i < max; i++) {
    spr(i < full ? SPR.heart : SPR.heartEmpty, xRight - (max - i) * 9, y);
  }
}
