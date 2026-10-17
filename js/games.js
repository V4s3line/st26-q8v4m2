'use strict';
// Мини-игры и сценарий уровней.
// Каждая игра: create({ fails, params, night }) → объект с полями
//   time — длительность в секундах, result — null | 'win' | 'lose',
//   update(dt, t), draw(t), onTimeout() → 'win' | 'lose', penalty — штраф ко времени (сек).
// fails — число провалов этого уровня подряд: с каждым провалом игра становится легче.
// Внутри каждой игры 3 волны с нарастанием сложности.

// ---------- Стёпа-игрок: мышь/палец или стрелки ----------
class Player {
  constructor() {
    this.s = 2; this.w = 16 * this.s; this.h = 33 * this.s;
    this.x = W / 2 - this.w / 2; this.y = GROUND_Y - this.h;
    this.speed = 200; this.walk = 0; this.moving = false; this.flip = false; this.dead = false;
  }
  // целевое смещение по X за кадр от клавиш или указателя
  inputDx(dt) {
    const ax = Input.axisX();
    if (ax) return ax * this.speed * dt;
    if (this.followPointer !== false && Input.usingPointer && (Input.pointerType === 'mouse' || Input.down)) {
      const max = this.speed * 1.6 * dt;
      const dx = clamp(Input.x - this.w / 2 - this.x, -max, max);
      return Math.abs(dx) < 0.5 ? 0 : dx;
    }
    return 0;
  }
  update(dt) {
    if (this.dead) return;
    const dx = this.inputDx(dt);
    this.x = clamp(this.x + dx, 0, W - this.w);
    this.moving = dx !== 0;
    if (dx) this.flip = dx < 0;
    this.walk += this.moving ? dt * 10 : 0;
  }
  box() { const s = this.s; return { x: this.x + 3 * s, y: this.y + 3 * s, w: 10 * s, h: 30 * s }; }
  draw() {
    const s = this.s;
    if (this.dead) {
      ctx.save();
      ctx.translate(Math.round(this.x + this.w / 2), GROUND_Y - 8 * s);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(SPR.stepa[0], -16 * s, -8 * s, 16 * s, 33 * s);
      ctx.restore();
      return;
    }
    const f = this.moving ? 1 + (Math.floor(this.walk) % 2) : 0;
    spr(SPR.stepa[f], this.x, this.y, s, this.flip);
  }
}

function boom(x, y) {
  Sound.boom();
  Game.shake(0.4, 4);
  Game.flash('#fff', 0.2);
  FX.burst(x, y, 40, ['#fff', '#ddd', '#9a9a9a', '#4caf3c', '#2a2a2a'], 150);
}

// Всплывающие надписи над объектами
function makeFloats() {
  return {
    list: [],
    add(x, y, s, color = '#fff', life = 1) { this.list.push({ x, y, s, color, life, age: 0 }); },
    update(dt) {
      for (const f of this.list) { f.age += dt; f.y -= 18 * dt; }
      this.list = this.list.filter(f => f.age < f.life);
    },
    draw() {
      for (const f of this.list) {
        ctx.globalAlpha = clamp(2 * (1 - f.age / f.life), 0, 1);
        text(f.s, f.x, f.y, { size: 6, color: f.color });
      }
      ctx.globalAlpha = 1;
    },
  };
}

// Плашка «ВОЛНА N» по центру экрана
function makeWaves(names) {
  return {
    n: 1, t: 1.6,
    set(n) { if (n !== this.n) { this.n = n; this.t = 1.6; Sound.seq([523, 784], 0.08, 'triangle', 0.08); } },
    update(dt) { this.t = Math.max(0, this.t - dt); },
    draw(y = 70) {
      if (!this.t) return;
      ctx.globalAlpha = Math.min(1, this.t * 2);
      text(`ВОЛНА ${this.n}: ${names[this.n - 1]}`, W / 2, y, { size: 10 });
      ctx.globalAlpha = 1;
    },
  };
}

const holding = () => Input.down || !!Input.keys[' '] || !!Input.keys['ArrowDown'];

const GAMES = {};

// ======================================================================
// 1. ЛОВИ: виски и бурбон — да, пиво — «не приветствуется», крипер — взрыв
// ======================================================================
GAMES.catch = {
  verb: 'ЛОВИ!', hint: 'виски — да, пиво — НЕТ, крипер — бум',
  rules: ['Лови виски и бурбон', 'Пиво — минус очко', 'Авокадо — плюс два', 'Крипер — взрыв и проигрыш'],
  touch: 'веди пальцем — Стёпа идёт за ним', keys: 'мышь или стрелки ← →',
  create({ fails, params, night }) {
    const P = new Player();
    const need = Math.max(5, 10 - fails * 2);
    const floats = makeFloats();
    const waves = makeWaves(['ДЕГУСТАЦИЯ', 'ПОДЪЕХАЛО ПИВО', 'ЛИВЕНЬ ИЗ БУТЫЛОК']);
    return {
      time: params.time || 35, result: null, got: 0, items: [], cd: 0.4,
      update(dt) {
        P.update(dt); floats.update(dt); waves.update(dt);
        const w = waves.n;
        this.cd -= dt;
        if (this.cd <= 0) {
          this.cd = [0.6, 0.48, 0.36][w - 1] + fails * 0.1;
          const r = Math.random();
          const creeper = [0.08, 0.15, 0.2][w - 1] - fails * 0.05;
          const beer = w >= 2 ? 0.3 : 0.12;
          const kind = r < creeper ? 'bad' : r < creeper + beer ? 'beer' : r > 0.93 ? 'avo' : 'good';
          const img = { bad: SPR.creeper, beer: SPR.beer, avo: SPR.avocado, good: SPR.whisky }[kind];
          const vy = rand(60, 100) * [1, 1.2, 1.45][w - 1] * (1 - fails * 0.1);
          this.items.push({ x: rand(8, W - 24), y: -24, vy, kind, img, w: img.width * 2, h: img.height * 2 });
        }
        const hb = P.box();
        for (const it of this.items) {
          it.vy += 60 * dt; it.y += it.vy * dt;
          const cx = it.x + it.w / 2;
          if (overlap(hb, it)) {
            it.dead = true;
            if (it.kind === 'bad') { this.result = 'lose'; P.dead = true; boom(cx, it.y + it.h / 2); }
            else if (it.kind === 'beer') {
              this.got = Math.max(0, this.got - 1); Sound.nope(); Game.shake(0.15, 2);
              floats.add(cx, it.y - 8, choice(['НЕ ПРИВЕТСТВУЕТСЯ', 'ФУ, ПИВО', 'ПОДПИВАСНИК!']), '#ff7070', 1.2);
              FX.burst(cx, it.y + 6, 12, ['#56b04a', '#f3e3b5', '#fff'], 90);
            } else {
              const avo = it.kind === 'avo';
              this.got += avo ? 2 : 1;
              avo ? Sound.seq([784, 1047], 0.07) : Sound.pop();
              if (avo) floats.add(cx, it.y - 8, 'ПЛЮШЕВОЕ АВОКАДО! +2', '#b8f060', 1.2);
              FX.burst(cx, it.y + 6, 10, avo ? ['#7fb33a', '#d8e86a', '#fff'] : ['#e8a040', '#c8781e', '#fff']);
              if (this.got >= need) this.result = 'win';
              waves.set(this.got >= need * 0.66 ? 3 : this.got >= need * 0.33 ? 2 : 1);
            }
          } else if (it.y + it.h > GROUND_Y) {
            it.dead = true;
            if (it.kind === 'good') FX.burst(cx, GROUND_Y - 2, 6, ['#c8781e', '#e8a040', '#cfe8ff'], 60);
          }
        }
        this.items = this.items.filter(i => !i.dead);
      },
      draw(t) {
        drawWorld(t, { night });
        for (const it of this.items) spr(it.img, it.x, it.y, 2);
        P.draw();
        floats.draw();
        text(`ВИСКИ ${Math.min(this.got, need)}/${need}`, W / 2, 22, { size: 10, color: '#e8a040' });
        waves.draw();
      },
      onTimeout() { return this.got >= need ? 'win' : 'lose'; },
    };
  },
};

// ======================================================================
// 2. ДАРИ: кидать авокадо девушкам, не попасть в крипера
// ======================================================================
GAMES.avocado = {
  verb: 'ДАРИ!', hint: 'тапай по девушкам — полетит авокадо',
  rules: ['Покори девушек плюшевым авокадо', 'Одной девушке — одно авокадо', 'Попал в крипера — взрыв и -2 сек'],
  touch: 'тапни по девушке — авокадо полетит туда', keys: 'клик по девушке или пробел (бросок вперёд)',
  create({ fails, params, night }) {
    const P = new Player();
    P.followPointer = false;
    const per = Math.max(2, 3 - Math.floor(fails / 2));
    const need = per * 3;
    const floats = makeFloats();
    const waves = makeWaves(['РАЗМИНКА', 'КРИПЕРЫ НЕ ЦЕНЯТ', 'ОНИ УБЕГАЮТ']);
    const REACT = params.reactions || ['ЭТО ЧТО, ИГРУШКА?', 'ОПЯТЬ АВОКАДО?!', 'У БЫВШЕЙ ТАКОЕ ЖЕ', 'МИЛО. НО НЕТ', 'ОНО МЯГКОЕ...', 'ЭТО НАМЁК?', 'МНЕ НЕ 5 ЛЕТ', 'ЛАДНО, ВОЗЬМУ'];
    const G = 600;
    return {
      time: params.time || 40, result: null, got: 0,
      walkers: [], avos: [], cd: 0.2, throwCd: 0, swing: 0, penalty: 0,
      spawn() {
        const w = waves.n;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const creeper = w >= 2 && Math.random() < 0.3;
        const base = [30, 45, 65][w - 1] * (1 - fails * 0.12);
        this.walkers.push({
          x: dir > 0 ? -34 : W + 2, dir, speed: rand(base, base * 1.4), creeper,
          frames: creeper ? null : choice(SPR.girls), walk: 0, gifted: false, stop: 0,
          w: creeper ? 16 : 32, h: creeper ? 48 : 66,
        });
      },
      throwAt(tx, ty) {
        if (this.throwCd > 0 || this.avos.length >= 3) return;
        this.throwCd = 0.3; this.swing = 1;
        const sx = P.x + P.w / 2, sy = P.y + 20;
        P.flip = tx < sx;
        const T = clamp(Math.hypot(tx - sx, ty - sy) / 260, 0.3, 0.75);
        this.avos.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy) / T - 0.5 * G * T, rot: 0 });
        Sound.tone(500, 0.08, 'triangle', 0.08, 300);
      },
      update(dt) {
        P.update(dt); floats.update(dt); waves.update(dt);
        this.throwCd -= dt;
        this.swing = Math.max(0, this.swing - dt * 5);
        if (Input.tapped) this.throwAt(Input.x, Input.y);
        else if (Input.pressedKeys[' '] || Input.pressedKeys['Enter']) this.throwAt(P.x + P.w / 2 + (P.flip ? -130 : 130), GROUND_Y - 40);

        this.cd -= dt;
        const alive = this.walkers.filter(w => !w.creeper && !w.gifted).length;
        if (this.cd <= 0 && alive < 3) { this.cd = rand(0.9, 1.6) / waves.n; this.spawn(); }

        for (const w of this.walkers) {
          w.stop = Math.max(0, w.stop - dt);
          if (!w.stop) { w.x += w.dir * w.speed * (w.gifted ? 1.8 : 1) * dt; w.walk += dt * 8; }
          w.y = GROUND_Y - w.h;
          if (w.x < -40 || w.x > W + 40) w.gone = true;
        }
        for (const a of this.avos) {
          a.vy += G * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.rot += dt * 12;
          const box = { x: a.x - 6, y: a.y - 6, w: 12, h: 12 };
          for (const w of this.walkers) {
            if (a.dead || w.gone || !overlap(box, { x: w.x, y: w.y, w: w.w, h: w.h })) continue;
            a.dead = true;
            if (w.creeper) {
              w.gone = true; this.penalty += 2; boom(w.x + 8, w.y + 24);
              floats.add(w.x + 8, w.y - 10, '-2 СЕК', '#ff5555');
            } else if (w.gifted) {
              Sound.nope();
              floats.add(w.x + 16, w.y - 10, 'У МЕНЯ УЖЕ ЕСТЬ', '#ffaaaa');
            } else {
              w.gifted = true; w.stop = 0.6; w.dir = -w.dir; this.got++;
              Sound.seq([659, 880, 1175], 0.06, 'triangle', 0.09);
              FX.burst(w.x + 16, w.y + 10, 12, ['#ff6b9a', '#ff3c6e', '#fff'], 70, { g: -40 });
              floats.add(w.x + 16, w.y - 12, choice(REACT), '#ffd0e0', 1.4);
              if (this.got >= need) this.result = 'win';
              else waves.set(1 + Math.floor(this.got / per));
            }
          }
          if (!a.dead && a.y > GROUND_Y - 4) {
            a.dead = true;
            FX.burst(a.x, GROUND_Y - 2, 8, ['#7fb33a', '#d8e86a', '#2f5a1c'], 60);
          }
        }
        this.avos = this.avos.filter(a => !a.dead);
        this.walkers = this.walkers.filter(w => !w.gone);
      },
      draw(t) {
        drawWorld(t, { night });
        for (const w of this.walkers) {
          if (w.creeper) { spr(SPR.creeperFull, w.x, w.y, 2); continue; }
          const f = w.stop ? 0 : 1 + (Math.floor(w.walk) % 2);
          spr(w.frames[f], w.x, w.y, 2, w.dir < 0);
          if (w.gifted) spr(SPR.avocado, w.x + 12, w.y - 14);
        }
        spr(SPR.stepa[0], P.x + this.swing * (P.flip ? -4 : 4), P.y, 2, P.flip);
        for (const a of this.avos) {
          ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
          ctx.drawImage(SPR.avocado, -8, -10, 16, 20);
          ctx.restore();
        }
        floats.draw();
        text(`АВОКАДО ${Math.min(this.got, need)}/${need}`, W / 2, 22, { size: 10, color: '#b8f060' });
        waves.draw();
      },
      onTimeout() { return 'lose'; },
    };
  },
};

// ======================================================================
// 3. ПЛАТФОРМА 9¾: раннер по вокзалу, в конце — точно в стену
// ======================================================================
GAMES.runner = {
  verb: 'РАЗБЕГАЙСЯ!', hint: 'тап — прыжок. В конце — тап точно в стену',
  rules: ['Стёпа бежит сам — добеги до стены', 'Перепрыгивай чемоданы', 'Голуби летают высоко — не прыгай в них', 'В конце: тап, когда бегунок в зелёном'],
  touch: 'тап — прыжок', keys: 'клик, пробел или ↑ — прыжок',
  create({ fails, params }) {
    const LEN = params.len || 5200, SX = 70;
    const floats = makeFloats();
    const waves = makeWaves(['ТУРИСТЫ', 'ГОЛУБИ', 'ОПАЗДЫВАЕМ']);
    const zone = 0.22 + fails * 0.08;   // ширина зелёной зоны в финале
    const g = {
      time: params.time || 45, result: null, dist: 0, y: 0, vy: 0, stumble: 0, walk: 0,
      obs: [], next: 420, phase: 'run', marker: 0, mdir: 1, endT: 0,
      jump() { if (this.y === 0 && this.phase === 'run') { this.vy = 330; Sound.tone(300, 0.12, 'square', 0.06, 300); } },
      update(dt) {
        floats.update(dt); waves.update(dt);
        if (this.phase === 'run') {
          waves.set(this.dist > LEN * 0.66 ? 3 : this.dist > LEN * 0.33 ? 2 : 1);
          const speed = [165, 195, 230][waves.n - 1] * (1 - fails * 0.08) * (this.stumble > 0 ? 0.35 : 1);
          this.stumble = Math.max(0, this.stumble - dt);
          this.dist += speed * dt; this.walk += dt * speed / 14;
          if (Input.action || Input.pressedKeys['ArrowUp']) this.jump();
          this.vy -= 1000 * dt; this.y = Math.max(0, this.y + this.vy * dt);
          if (this.y === 0) this.vy = 0;
          // препятствия
          while (this.next < this.dist + W && this.next < LEN - 300) {
            const r = Math.random();
            const kind = waves.n >= 2 && r < 0.3 ? 'pigeon' : r < 0.65 ? 'suitcase' : 'stack';
            this.obs.push({ x: this.next, kind });
            this.next += rand(230, 380) - waves.n * 25 + fails * 40;
          }
          const me = { x: SX + 8, y: -this.y - 60, w: 16, h: 58 };  // координаты относительно пола
          for (const o of this.obs) {
            const sx = o.x - this.dist + SX;
            const b = o.kind === 'suitcase' ? { x: sx, y: -20, w: 24, h: 20 }
              : o.kind === 'stack' ? { x: sx, y: -34, w: 26, h: 34 }
              : { x: sx, y: -96 - Math.sin(o.x) * 6, w: 16, h: 12 };
            o.box = b;
            if (!o.hit && overlap(me, b)) {
              o.hit = true; this.stumble = 0.9; Sound.hit(); Game.shake(0.15, 2);
              floats.add(SX + 16, GROUND_Y - 80, o.kind === 'pigeon' ? 'ГОЛУБЬ В ЛИЦО' : choice(['ОЙ', 'ИЗВИНИТЕ', 'ЧЕМОДАН!']), '#ff8080');
              FX.burst(b.x + b.w / 2, GROUND_Y + b.y, 10, o.kind === 'pigeon' ? ['#8a8f9a', '#fff'] : ['#a0522d', '#e8c34a'], 90);
            }
          }
          this.obs = this.obs.filter(o => o.x - this.dist > -80);
          if (this.dist >= LEN) { this.phase = 'aim'; this.y = 0; this.vy = 0; }
        } else if (this.phase === 'aim') {
          this.marker += this.mdir * dt * (1.3 - fails * 0.2);
          if (this.marker > 1 || this.marker < 0) { this.mdir = -this.mdir; this.marker = clamp(this.marker, 0, 1); }
          if (Input.action) {
            const ok = Math.abs(this.marker - 0.5) < zone / 2;
            this.phase = ok ? 'enter' : 'bonk'; this.endT = 0;
            if (!ok) { Sound.hit(); Game.shake(0.4, 4); floats.add(W - 150, 120, 'ОБ СТЕНУ!', '#ff5555', 1.5); }
          }
        } else {
          this.endT += dt;
          if (this.phase === 'enter' && this.endT > 0.6 && !this.result) {
            this.result = 'win';
            FX.burst(W - 120, GROUND_Y - 40, 40, ['#ffdd55', '#fff', '#b8a0ff'], 120, { g: -30 });
            floats.add(W - 120, 100, 'ХОГВАРТС ПРИНЯЛ', '#ffdd55', 2);
          }
          if (this.phase === 'bonk' && this.endT > 0.5 && !this.result) this.result = 'lose';
        }
      },
      draw(t) {
        const off = this.phase === 'run' ? this.dist : LEN;
        // вокзал: кирпичная стена с арками и колоннами (параллакс)
        ctx.fillStyle = '#6b4a3a'; ctx.fillRect(0, 0, W, GROUND_Y);
        for (let y = 0; y < GROUND_Y; y += 8) for (let x = -((off * 0.3) % 16) - 16; x < W; x += 16) {
          ctx.fillStyle = (y / 8) % 2 ? '#7a5544' : '#734f3f';
          ctx.fillRect(Math.round(x + ((y / 8) % 2) * 8), y, 15, 7);
        }
        for (let i = -1; i < 6; i++) {
          const ax = i * 110 - ((off * 0.3) % 110);
          ctx.fillStyle = '#9fc4e8'; ctx.fillRect(ax + 20, 40, 60, 90);
          ctx.fillStyle = '#c8e0f5'; ctx.fillRect(ax + 26, 46, 48, 30);
          ctx.fillStyle = '#4a3328'; ctx.fillRect(ax + 48, 40, 4, 90); ctx.fillRect(ax + 20, 84, 60, 3);
        }
        for (let i = -1; i < 5; i++) {
          const cx = i * 150 - ((off * 0.7) % 150);
          ctx.fillStyle = '#3a3a44'; ctx.fillRect(cx, 0, 14, GROUND_Y);
          ctx.fillStyle = '#55555f'; ctx.fillRect(cx + 2, 0, 3, GROUND_Y);
        }
        // перрон
        for (let x = -(off % 16); x < W; x += 16) { spr(SPR.stone, x, GROUND_Y); spr(SPR.stone, x, GROUND_Y + 16); }
        ctx.fillStyle = '#e8c34a'; ctx.fillRect(0, GROUND_Y, W, 2);
        // финальная стена между платформами 9 и 10
        const wallX = LEN - off + W - 150;
        if (wallX < W + 10) {
          for (let y = 30; y < GROUND_Y; y += 16) for (let x = 0; x < 96; x += 16) spr(SPR.brick, wallX + x, y);
          panel(wallX + 6, 40, 30, 22); text('9', wallX + 21, 47, { size: 8 });
          panel(wallX + 60, 40, 30, 22); text('10', wallX + 75, 47, { size: 8 });
        }
        // препятствия
        for (const o of this.obs) {
          if (!o.box || o.hit) continue;
          const b = o.box, y = GROUND_Y + b.y;
          if (o.kind === 'suitcase') spr(SPR.suitcase, b.x, y, 2);
          else if (o.kind === 'stack') { spr(SPR.suitcase, b.x + 1, y + 14, 2); spr(SPR.suitcase, b.x + 3, y - 2, 2); }
          else spr(SPR.pigeon, b.x, y + Math.sin(t * 20) * 2, 2);
        }
        // Стёпа
        if (this.phase === 'enter') {
          ctx.globalAlpha = Math.max(0, 1 - this.endT * 2);
          spr(SPR.stepa[1], wallX + 32 + this.endT * 40, GROUND_Y - 66, 2);
          ctx.globalAlpha = 1;
        } else if (this.phase === 'bonk') {
          ctx.save(); ctx.translate(wallX + 10, GROUND_Y - 8); ctx.rotate(-Math.PI / 2);
          ctx.drawImage(SPR.stepa[0], -16, -16, 32, 66); ctx.restore();
        } else {
          const sx = this.phase === 'aim' ? wallX - 40 : SX;
          const f = this.y > 0 ? 1 : 1 + (Math.floor(this.walk) % 2);
          spr(SPR.stepa[this.phase === 'aim' ? 0 : f], sx, GROUND_Y - 66 - this.y, 2);
        }
        // прогресс до стены
        if (this.phase === 'run') {
          const k = clamp(this.dist / LEN, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(140, 20, 200, 6);
          ctx.fillStyle = '#ffdd55'; ctx.fillRect(140, 20, Math.round(200 * k), 6);
          text('9¾', 352, 18, { size: 8, color: '#ffdd55', align: 'left' });
        }
        if (this.phase === 'aim') {
          const bx = 120, bw = 240;
          text('ТАП, КОГДА В ЗЕЛЁНОМ!', W / 2, 60, { size: 10, color: '#ffdd55' });
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, 82, bw + 4, 14);
          ctx.fillStyle = '#8a2a2a'; ctx.fillRect(bx, 84, bw, 10);
          ctx.fillStyle = '#3ad040'; ctx.fillRect(bx + bw * (0.5 - zone / 2), 84, bw * zone, 10);
          ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * this.marker - 2, 80, 4, 18);
        }
        floats.draw();
        waves.draw(90);
      },
      onTimeout() { return 'lose'; },
    };
    return g;
  },
};

// ======================================================================
// 5. ЖИВОЙ УГОЛЬ: шашлык — переворачивать и снимать вовремя
// ======================================================================
// Текстура углей для мангала: рисуется один раз
const COALS = (() => {
  const c = document.createElement('canvas');
  c.width = 280; c.height = 128;
  const g = c.getContext('2d'), r = mulberry32(5);
  for (let y = 0; y < c.height; y += 6) for (let x = 0; x < c.width; x += 6) {
    const v = r();
    g.fillStyle = v > 0.94 ? '#e86a20' : v > 0.75 ? '#7a2008' : v > 0.4 ? '#3a1408' : '#2a0e06';
    g.fillRect(x, y, 5, 5);
  }
  return c;
})();

GAMES.grill = {
  verb: 'ЖАРЬ!', hint: 'тап по шампуру — перевернуть. Румяный — тап, снять',
  rules: ['Мясо жарится снизу', 'Тап по шампуру — перевернуть', 'Обе стороны румяные (мигает) — тап, снять', 'Чёрное — сгорело, не засчитается'],
  touch: 'тап по шампуру', keys: 'клик по шампуру или клавиши 1-4',
  create({ fails, params }) {
    const need = Math.max(4, 8 - fails * 2);
    const floats = makeFloats();
    const waves = makeWaves(['РАЗЖИГАЕМ', 'ЖИВОЙ УГОЛЬ', 'УГОЛЬ ОЧЕНЬ ЖИВОЙ']);
    const MX = 100, MW = 280, ROW0 = 112, RH = 28;    // мангал и ряды шампуров
    const slots = [0, 1, 2, 3].map(i => ({ i, sk: null, cd: 0.3 + i * 0.4, flare: 0 }));
    const color = d => d < 0.3 ? '#e8828a' : d < 0.6 ? '#d0906a' : d < 0.9 ? '#a8642a' : d < 1 ? '#5a3018' : '#1a1a1a';
    const tap = (s, game) => {
      const k = s.sk; if (!k || k.gone) return;
      if (k.d[0] >= 0.6 && k.d[1] >= 0.6) {
        k.gone = true; s.cd = 1;
        const burnt = k.d[0] > 1 || k.d[1] > 1;
        if (burnt) { Sound.nope(); floats.add(MX + MW / 2, ROW0 + s.i * RH, 'С ДЫМКОМ... НЕ ЗАЧЁТ', '#ff8080'); }
        else {
          game.got++; Sound.win();
          floats.add(MX + MW / 2, ROW0 + s.i * RH, choice(['СОЧНО', 'ПРИКОЛЯЙ', 'НУ ТЫ ВИДЕЛ, ВИДЕЛ???', 'МАРИНАД ТОП']), '#ffdd55', 1.3);
          FX.burst(MX + MW / 2, ROW0 + s.i * RH, 14, ['#a8642a', '#ffdd55', '#fff'], 80);
          if (game.got >= need) game.result = 'win';
          game.waves.set(game.got >= need * 0.66 ? 3 : game.got >= need * 0.33 ? 2 : 1);
        }
      } else { k.down = 1 - k.down; k.flip = 0.2; Sound.click(); }
    };
    return {
      time: params.time || 50, result: null, got: 0, waves,
      update(dt, t) {
        floats.update(dt); waves.update(dt);
        const active = waves.n + 1;
        const rate = [0.13, 0.17, 0.21][waves.n - 1] * (1 - fails * 0.15);
        for (const s of slots) {
          s.flare = Math.max(0, s.flare - dt);
          if (waves.n >= 2 && !s.flare && Math.random() < dt * 0.08 * waves.n) {
            s.flare = 1.8; floats.add(MX + MW + 30, ROW0 + s.i * RH, 'ЖИВОЙ!', '#ff8030');
          }
          if (!s.sk || s.sk.gone) {
            if (s.i >= active) continue;
            s.cd -= dt;
            if (s.cd <= 0) s.sk = { d: [0, 0], down: 1, flip: 0, smoke: 0 };
            continue;
          }
          const k = s.sk;
          k.flip = Math.max(0, k.flip - dt);
          k.d[k.down] += rate * (s.flare ? 2.2 : 1) * dt;
          if (k.d[0] > 1 || k.d[1] > 1) {
            k.smoke += dt;
            if (Math.random() < dt * 12) FX.add({ x: MX + rand(20, MW - 20), y: ROW0 + s.i * RH, vy: -30, vx: rand(-10, 10), life: 1, size: 3, color: '#555' });
            if (k.smoke > 1.6) {
              k.gone = true; s.cd = 1; Sound.nope();
              floats.add(MX + MW / 2, ROW0 + s.i * RH, 'УГОЛЁК', '#ff8080');
            }
          }
        }
        if (Input.tapped && Input.x > MX - 20 && Input.x < MX + MW + 20) {
          const i = Math.floor((Input.y - ROW0 + RH / 2) / RH);
          if (slots[i]) tap(slots[i], this);
        }
        for (let i = 0; i < 4; i++) if (Input.pressedKeys[String(i + 1)]) tap(slots[i], this);
      },
      draw(t) {
        drawWorld(t * 0.5, {});
        // мангал сверху: угли
        const top = ROW0 - 22, h = RH * 4 + 16;
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(MX - 8, top - 6, MW + 16, h + 12);
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(MX - 6, top - 4, MW + 12, 2);
        // угли — статичная текстура + медленное мягкое свечение (без мерцания)
        ctx.drawImage(COALS, MX, top);
        ctx.fillStyle = `rgba(255,110,30,${0.08 + 0.04 * Math.sin(t * 1.2)})`;
        ctx.fillRect(MX, top, MW, h);
        for (const s of slots) if (s.flare) {
          ctx.fillStyle = `rgba(255,190,60,${0.22 + 0.06 * Math.sin(t * 2.5)})`;
          ctx.fillRect(MX, ROW0 + s.i * RH - RH / 2, MW, RH);
        }
        // шампуры
        for (const s of slots) {
          const y = ROW0 + s.i * RH;
          text(String(s.i + 1), MX - 18, y - 3, { size: 6, color: '#888' });
          const k = s.sk;
          if (!k || k.gone) continue;
          const ready = k.d[0] >= 0.6 && k.d[1] >= 0.6 && k.d[0] <= 1 && k.d[1] <= 1;
          ctx.fillStyle = '#c8c8c8'; ctx.fillRect(MX - 14, y - 1, MW + 30, 2);
          const lift = k.flip ? -3 : 0;
          for (let c = 0; c < 7; c++) {
            const cx = MX + 20 + c * 36;
            const up = 1 - k.down;
            ctx.fillStyle = color(k.d[up]); ctx.fillRect(cx, y - 8 + lift, 18, 11);
            ctx.fillStyle = color(k.d[k.down]); ctx.fillRect(cx, y + 3 + lift, 18, 5);
            if (c % 2) { ctx.fillStyle = '#f0e0c0'; ctx.fillRect(cx + 22, y - 4 + lift, 6, 8); }  // лук
          }
          if (ready) {
            ctx.strokeStyle = '#80ff20'; ctx.lineWidth = 2;
            ctx.strokeRect(MX + 14, y - 11, MW - 24, 22);
            text('СНИМАЙ', MX + MW + 26, y - 3, { size: 6, color: '#80ff20', align: 'left' });
          }
        }
        text(`ШАШЛЫК ${Math.min(this.got, need)}/${need}`, W / 2, 22, { size: 10, color: '#ffdd55' });
        floats.draw();
        waves.draw(44);
      },
      onTimeout() { return this.got >= need ? 'win' : 'lose'; },
    };
  },
};

// ======================================================================
// ДОМАШНИЙ ВИНОКУР: налить ровно до черты
// ======================================================================
GAMES.wine = {
  verb: 'НАЛИВАЙ!', hint: 'зажми — льётся, отпусти — стоп',
  rules: ['Зажми — льётся, отпусти — стоп', 'Налей до зелёной полосы', 'Перелил или недолил — не считается', 'Дальше тара меньше, а рука дрожит'],
  touch: 'зажми палец на экране', keys: 'зажми пробел или кнопку мыши',
  create({ fails, params }) {
    const need = Math.max(4, 7 - fails);
    const floats = makeFloats();
    const waves = makeWaves(['ДОМАШНЕЕ ВИНО', 'ДОМАШНИЙ ВИСКИ', 'ШОТЫ']);
    const KINDS = [
      { name: 'ВИНО «СТЁПИНО» 2025', w: 46, h: 120, neck: 36, color: '#8a1438', glass: 'rgba(60,110,60,0.55)', speed: 0.3, tol: 0.08 },
      { name: 'ВИСКИ «БАТЯ НАСТРОИЛ»', w: 72, h: 92, neck: 20, color: '#c8781e', glass: 'rgba(160,190,200,0.45)', speed: 0.45, tol: 0.065 },
      { name: 'ШОТ НА ПОСОШОК', w: 34, h: 46, neck: 0, color: '#e8dca0', glass: 'rgba(160,190,200,0.45)', speed: 0.8, tol: 0.07 },
    ];
    const TABLE = 206, TAP_X = W / 2, TAP_Y = 84;
    return {
      time: params.time || 50, result: null, got: 0, v: null, state: 'idle', settle: 0, slide: 1,
      newVessel() {
        const k = KINDS[waves.n - 1];
        this.v = { k, level: 0, target: rand(0.5, 0.85), cur: 0.6, tol: k.tol + fails * 0.025, speed: k.speed * (1 - fails * 0.12) };
        this.state = 'idle'; this.slide = 1;
      },
      update(dt, t) {
        floats.update(dt); waves.update(dt);
        if (!this.v) this.newVessel();
        const v = this.v;
        this.slide = Math.max(0, this.slide - dt * 4);
        const wob = waves.n === 3 ? Math.sin(t * 4) * 0.06 : waves.n === 2 ? Math.sin(t * 2.5) * 0.03 : 0;
        v.cur = clamp(v.target + wob, 0.15, 0.92);
        if (this.slide > 0) return;
        if (this.state === 'idle' && holding()) this.state = 'pour';
        if (this.state === 'pour') {
          const shake = waves.n === 3 ? 1 + Math.sin(t * 23) * 0.35 : 1;
          v.level += v.speed * shake * dt;
          if (Math.random() < dt * 25) Sound.tone(rand(280, 480), 0.03, 'sine', 0.03);
          if (!holding() || v.level >= 1.08) { this.state = 'drip'; this.settle = 0; }
        } else if (this.state === 'drip') {
          this.settle += dt;
          if (this.settle < 0.1) v.level += v.speed * dt * 0.5;   // последние капли
          if (this.settle > 0.55) {
            const d = v.level - v.cur;
            if (Math.abs(d) <= v.tol) {
              this.got++; Sound.win();
              floats.add(W / 2 + 110, 110, Math.abs(d) < v.tol / 3 ? 'ИДЕАЛЬНО' : choice(['ПОЙДЁТ', 'ДЕГУСТАТОР ОДОБРИЛ', 'НА ВИСКИ ХВАТИТ']), '#80ff20', 1.3);
            } else if (d > 0) {
              Sound.nope();
              floats.add(W / 2 + 110, 110, v.level >= 1 ? 'ПЕРЕЛИЛ! ВСЁ НА СТОЛЕ' : 'ПЕРЕЛИВ', '#ff7070', 1.3);
            } else {
              Sound.nope();
              floats.add(W / 2 + 110, 110, choice(['НЕДОЛИВ', 'ЖАДИНА', 'ЭТО НА ДНО?']), '#ff7070', 1.3);
            }
            if (this.got >= need) { this.result = 'win'; return; }
            waves.set(this.got >= need * 0.66 ? 3 : this.got >= need * 0.33 ? 2 : 1);
            this.v = null;
          }
        }
      },
      draw(t) {
        // кухня: плитка и стол
        ctx.fillStyle = '#e4d8bc'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d4c6a6'; for (let y = 0; y < TABLE; y += 16) for (let x = 0; x < W; x += 16) ctx.fillRect(x, y, 15, 15);
        spr(SPR.stepa[0], 54, TABLE - 60, 2);
        // бочка с краном
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(TAP_X - 44, 18, 88, 56);
        ctx.fillStyle = '#5a3416'; ctx.fillRect(TAP_X - 44, 28, 88, 4); ctx.fillRect(TAP_X - 44, 60, 88, 4);
        ctx.fillStyle = '#9a6a3a'; for (let x = TAP_X - 40; x < TAP_X + 44; x += 12) ctx.fillRect(x, 18, 1, 56);
        ctx.fillStyle = '#9a9a9a'; ctx.fillRect(TAP_X - 3, 74, 6, 10); ctx.fillRect(TAP_X - 8, 74, 16, 3);
        // стол
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(0, TABLE, W, H - TABLE);
        ctx.fillStyle = '#6a4018'; for (let y = TABLE + 12; y < H; y += 14) ctx.fillRect(0, y, W, 2);
        const v = this.v;
        if (v) {
          const k = v.k, cx = W / 2 + this.slide * 300, bodyH = k.h - k.neck, bottom = TABLE;
          const top = bottom - bodyH, x0 = cx - k.w / 2;
          // струя
          if (this.state === 'pour' || (this.state === 'drip' && this.settle < 0.1)) {
            const surf = bottom - Math.min(v.level, 1) * bodyH;
            ctx.fillStyle = k.color; ctx.fillRect(TAP_X - 2, TAP_Y, 4, surf - TAP_Y);
          }
          // жидкость
          const lh = Math.min(v.level, 1) * bodyH;
          ctx.fillStyle = k.color; ctx.fillRect(x0 + 3, bottom - lh, k.w - 6, lh);
          if (v.level > 1) { ctx.fillRect(x0 - 30, bottom - 2, k.w + 60, 3); }
          // стекло
          ctx.fillStyle = k.glass; ctx.fillRect(x0, top, k.w, bodyH);
          if (k.neck) ctx.fillRect(cx - k.w * 0.18, top - k.neck, k.w * 0.36, k.neck);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 + 4, top + 4, 3, bodyH - 8);
          ctx.fillStyle = '#333'; ctx.fillRect(x0, bottom - 2, k.w, 2);
          // целевая полоса
          const ty = bottom - v.cur * bodyH, th = v.tol * bodyH;
          ctx.fillStyle = 'rgba(60,220,60,0.45)'; ctx.fillRect(x0 - 10, ty - th, k.w + 20, th * 2);
          ctx.fillStyle = '#3ad040'; ctx.fillRect(x0 - 14, ty, 6, 1); ctx.fillRect(x0 + k.w + 8, ty, 6, 1);
          text(k.name, cx, TABLE + 24, { size: 6, color: '#f0e0c0' });
        }
        panel(W - 140, 30, 128, 22);
        text(`РАЗЛИТО ${Math.min(this.got, need)}/${need}`, W - 76, 37, { size: 8, color: '#ffdd55' });
        if (v && this.state === 'idle' && !this.slide && Math.sin(t * 6) > 0) text('ЗАЖМИ!', W / 2 + 100, 150, { size: 8, color: '#5a2a10', shadow: false });
        floats.draw();
        waves.draw(112);
      },
      onTimeout() { return 'lose'; },
    };
  },
};

// ======================================================================
// СОН ПРО АМЕРИКУ: не уснуть в аэропорту и успеть к гейту
// ======================================================================
GAMES.airport = {
  verb: 'НЕ СПАТЬ!', hint: 'тапай, чтобы не уснуть, и беги к гейту',
  rules: ['Стёпа засыпает — тапай, чтобы взбодрить', 'Объявили посадку — иди к нужному гейту', 'Не успел — рейс опять задержан', 'Успей на 3 посадки'],
  touch: 'тап — взбодриться, веди пальцем — идти', keys: 'пробел — взбодриться, ← → идти (или мышь)',
  create({ fails, params }) {
    const GATES = [{ n: '9', x: 70 }, { n: '10', x: 180 }, { n: '12', x: 300 }, { n: '26', x: 410 }];
    const floats = makeFloats();
    const waves = makeWaves(['ЗАДЕРЖКА', 'ГЕЙТ ПОМЕНЯЛИ', 'ПОСЛЕДНИЙ ВЫЗОВ']);
    const P = new Player(); P.x = 224; P.speed = 150;
    const OK = ['УСПЕЛ! ...РЕЙС ПЕРЕНЕСЛИ', 'УСПЕЛ! ...СМЕНА ЭКИПАЖА'];
    return {
      time: params.time || 55, result: null, got: 0,
      sleep: 0, asleep: false, st: 'wait', waitT: 2.5, boardT: 0, gate: 0, swap: 0, plane: -100,
      update(dt, t) {
        floats.update(dt); waves.update(dt);
        const w = waves.n;
        this.sleep = clamp(this.sleep + [0.07, 0.09, 0.115][w - 1] * (1 - fails * 0.15) * dt, 0, 1);
        if (Input.action) {
          this.sleep = Math.max(0, this.sleep - 0.1); Sound.tone(700, 0.04, 'triangle', 0.05);
          if (Math.random() < 0.15) floats.add(P.x + 16, P.y - 8, choice(['КОФЕ', 'БОДРИТ', 'Я НЕ СПЛЮ']), '#c8a0ff', 0.8);
        }
        if (!this.asleep && this.sleep >= 1) { this.asleep = true; Sound.seq([300, 250, 200], 0.2, 'sine', 0.06); floats.add(P.x + 16, P.y - 10, 'ХРРР...', '#aab', 1.5); }
        if (this.asleep && this.sleep < 0.55) { this.asleep = false; floats.add(P.x + 16, P.y - 10, 'А? ЧТО? Я НЕ СПАЛ', '#fff'); }
        if (!this.asleep) {
          P.speed = 150 * (1 - this.sleep * 0.6);
          P.update(dt);
        } else {
          P.moving = false;
          if (Math.random() < dt * 3) FX.add({ x: P.x + 26, y: P.y, vx: 10, vy: -20, g: 0, life: 1.2, size: 3, color: '#ddd' });
        }
        this.plane += dt * 40; if (this.plane > W + 80) this.plane = -120;
        if (this.st === 'wait') {
          this.waitT -= dt;
          if (this.waitT <= 0) {
            this.st = 'board'; this.boardT = [6.5, 5.5, 4.8][w - 1] + fails * 1.2;
            const near = GATES.reduce((b, g, i) => Math.abs(g.x - P.x) < Math.abs(GATES[b].x - P.x) ? i : b, 0);
            this.gate = choice([0, 1, 2, 3].filter(i => i !== near));
            this.swap = w >= 2 && Math.random() < 0.6 ? this.boardT * 0.55 : 0;
            Sound.seq([659, 523, 784], 0.15, 'triangle', 0.08);
            floats.add(W / 2, 120, `ПОСАДКА! ГЕЙТ ${GATES[this.gate].n}`, '#80ff20', 1.6);
          }
        } else {
          this.boardT -= dt;
          if (this.swap && this.boardT < this.swap) {
            this.swap = 0; this.gate = choice([0, 1, 2, 3].filter(i => i !== this.gate));
            this.boardT += 1.5; Sound.nope();
            floats.add(W / 2, 120, `ГЕЙТ ПОМЕНЯЛИ: ${GATES[this.gate].n}`, '#ffdd55', 1.6);
          }
          if (!this.asleep && Math.abs(P.x + P.w / 2 - GATES[this.gate].x) < 18) {
            this.got++; Sound.win();
            if (this.got >= 3) { this.result = 'win'; floats.add(W / 2, 120, 'ПОСАДКА! ...А СОН БЫЛ ПРО ОЖИДАНИЕ', '#ffdd55', 2); return; }
            floats.add(W / 2, 120, OK[this.got - 1], '#ffdd55', 1.8);
            waves.set(this.got + 1);
            this.st = 'wait'; this.waitT = rand(2, 3);
          } else if (this.boardT <= 0) {
            Sound.lose(); floats.add(W / 2, 120, 'ОПОЗДАЛ. РЕЙС ЗАДЕРЖАН', '#ff7070', 1.6);
            this.st = 'wait'; this.waitT = rand(1.5, 2.5);
          }
        }
      },
      draw(t) {
        // терминал
        ctx.fillStyle = '#d8dde4'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#9ecbf0'; ctx.fillRect(0, 70, W, 70);
        ctx.fillStyle = '#c8e0f5'; ctx.fillRect(0, 70, W, 20);
        for (let x = 0; x < W; x += 60) { ctx.fillStyle = '#7a8088'; ctx.fillRect(x, 70, 4, 70); }
        // самолёт за окном (так и не прилетит)
        ctx.fillStyle = '#f4f4f4'; ctx.fillRect(this.plane, 100, 60, 8); ctx.fillRect(this.plane + 20, 92, 14, 24); ctx.fillRect(this.plane + 50, 94, 8, 8);
        ctx.fillStyle = '#b0b4ba'; ctx.fillRect(0, GROUND_Y - 30, W, H);
        ctx.fillStyle = '#a0a4aa'; for (let x = 0; x < W; x += 24) ctx.fillRect(x, GROUND_Y - 30, 1, H);
        // гейты
        GATES.forEach((g, i) => {
          const hot = this.st === 'board' && i === this.gate;
          ctx.fillStyle = '#5a6068'; ctx.fillRect(g.x - 20, 150, 40, GROUND_Y - 150);
          ctx.fillStyle = hot ? '#3ad040' : '#2a3038'; ctx.fillRect(g.x - 16, 154, 32, GROUND_Y - 154);
          panel(g.x - 24, 140, 48, 16);
          text(g.n, g.x, 145, { size: 6, color: hot ? '#80ff20' : '#ffdd55' });
          if (hot) text('V', g.x, 124 + Math.sin(t * 8) * 3, { size: 10, color: '#80ff20' });
        });
        // табло
        panel(W / 2 - 110, 18, 220, 44);
        text('СПБ - НЬЮ-ЙОРК', W / 2 - 98, 26, { size: 6, color: '#ffdd55', align: 'left' });
        const status = this.st === 'board' ? `ПОСАДКА ГЕЙТ ${GATES[this.gate].n}  ${Math.ceil(this.boardT)}` : 'ЗАДЕРЖАН';
        text(status, W / 2 - 98, 42, { size: 8, color: this.st === 'board' ? '#80ff20' : '#ff6060', align: 'left' });
        text(`${this.got}/3`, W / 2 + 98, 26, { size: 6, color: '#ccc', align: 'right' });
        P.draw();
        if (this.asleep) text('Z z z', P.x + 30, P.y - 14, { size: 8, color: '#eee' });
        // шкала сна
        ctx.fillStyle = '#000'; ctx.fillRect(8, 40, 10, 102);
        ctx.fillStyle = this.sleep > 0.75 ? '#ff5030' : '#8a6aff'; ctx.fillRect(9, 41 + 100 * (1 - this.sleep), 8, 100 * this.sleep);
        text('СОН', 13, 146, { size: 6, color: '#334' , shadow: false });
        floats.draw();
        waves.draw(96);
        // веки
        if (this.sleep > 0.45) {
          const k = (this.sleep - 0.45) / 0.55, eh = k * (H / 2 - 10) + (this.asleep ? 20 : 0);
          ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, W, eh); ctx.fillRect(0, H - eh, W, eh);
          if (this.asleep) text('ТАПАЙ, ЧТОБЫ ПРОСНУТЬСЯ!', W / 2, H / 2 - 4, { size: 8, color: '#ffdd55' });
        }
      },
      onTimeout() { return 'lose'; },
    };
  },
};

// ======================================================================
// ЧЕЛЛЕНДЖ ДО АПРЕЛЯ: отказываться от выпивки, но не от чая
// ======================================================================
GAMES.challenge = {
  verb: 'ДЕРЖИСЬ!', hint: 'тап по выпивке — НЕТ. Чай и авокадо не трогай',
  rules: ['Челлендж: не пить до апреля', 'Зовут выпить — жми «НЕТ» на карточке', 'Чай, авокадо, катка — НЕ отказывайся', 'Не отказал вовремя — срыв. 3 срыва — всё'],
  touch: 'тап по кнопке «НЕТ»', keys: 'клик по кнопке «НЕТ»',
  create({ fails, params }) {
    const DAYS = 62, DAY = 0.6;   // 29 января → 1 апреля
    const floats = makeFloats();
    const waves = makeWaves(['ФЕВРАЛЬ', 'МАРТ', 'ФИНИШНАЯ ПРЯМАЯ']);
    const maxFails = 3 + fails;
    const ALCO = ['БУХАТЬ БУДЕШЬ?', 'ПО ПИВУ?', 'БУРБОНА ВЫПЬЕМ?', 'ОБМЫТЬ ТО НАДО', 'НУ РОМ ТОГДА', 'ВИСКИ НА ТРОИХ', 'ПЯТНИЦА ЖЕ!', 'ПОД ХОЛОДНЕНЬКОЕ', 'ДОМАШНЕЕ ВИНО ГОТОВО'];
    const SAFE = ['ЧАЙ БУДЕШЬ?', 'ГО КС', 'ГО В МАЙН', 'АВОКАДО ХОЧЕШЬ?', 'ШАШЛЫК В ВСК', 'ВОДИЧКИ?', 'ГО ГУЛЯТЬ'];
    const SLOTS = [{ x: 18, y: 76 }, { x: 262, y: 76 }, { x: 18, y: 124 }, { x: 262, y: 124 }, { x: 18, y: 172 }, { x: 262, y: 172 }];
    const MONTHS = [['ЯНВАРЯ', 31], ['ФЕВРАЛЯ', 28], ['МАРТА', 31], ['АПРЕЛЯ', 30]];
    const dateOf = d => {
      let day = 29 + d, m = 0;
      while (day > MONTHS[m][1]) { day -= MONTHS[m][1]; m++; }
      return `${day} ${MONTHS[m][0]}`;
    };
    const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    return {
      time: params.time || 45, result: null, penalty: 0, day: 0, clock: 0, cards: [], cd: 0.8, broke: 0, refused: 0,
      update(dt) {
        floats.update(dt); waves.update(dt);
        this.clock += dt;
        const prev = this.day;
        this.day = Math.min(DAYS, Math.floor(this.clock / DAY));
        if (this.day >= DAYS) {
          this.result = 'win';
          floats.add(W / 2, 110, '1 АПРЕЛЯ! А ТЕПЕРЬ БУРБОН', '#ffdd55', 2);
          return;
        }
        waves.set(this.day < 21 ? 1 : this.day < 45 ? 2 : 3);
        const sunday = (3 + this.day) % 7 === 6;
        if (sunday && prev !== this.day) floats.add(W / 2, 64, 'ВОСКРЕСЕНЬЕ: Я НЕ ПЬЮ ПО ВСК', '#8fd3ff', 1.2);
        const w = waves.n;
        this.cd -= dt;
        const free = SLOTS.filter(s => !this.cards.some(c => c.s === s));
        if (this.cd <= 0 && free.length && this.cards.length < w + 1) {
          this.cd = [1.1, 0.8, 0.6][w - 1] * (1 + fails * 0.2);
          const alco = Math.random() > [0.15, 0.35, 0.4][w - 1];
          this.cards.push({ s: choice(free), alco, txt: choice(alco ? ALCO : SAFE), age: 0,
            life: [2.6, 2.1, 1.7][w - 1] + fails * 0.5, icon: alco ? choice([SPR.whisky, SPR.beer]) : choice([SPR.avocado, null]) });
          Sound.tone(alco ? 520 : 880, 0.05, 'triangle', 0.05);
        }
        for (const c of this.cards) {
          c.age += dt;
          if (c.age > c.life && !c.dead) {
            c.dead = true;
            if (c.alco) {
              if (sunday) floats.add(c.s.x + 100, c.s.y, 'НЕ ПО ВСК', '#8fd3ff');
              else {
                this.broke++; Sound.lose(); Game.flash('#ff8000', 0.2); Game.shake(0.2, 2);
                floats.add(c.s.x + 100, c.s.y, 'СОРВАЛСЯ!', '#ff7070', 1.2);
                if (this.broke >= maxFails) { this.result = 'lose'; return; }
              }
            }
          }
        }
        if (Input.tapped) {
          for (const c of this.cards) {
            if (c.dead || Input.x < c.s.x || Input.x > c.s.x + 200 || Input.y < c.s.y || Input.y > c.s.y + 38) continue;
            c.dead = true;
            if (c.alco) {
              this.refused++; Sound.hit();
              floats.add(c.s.x + 100, c.s.y, choice(['НЕТ!', 'Я В ЗАВЯЗКЕ', 'ДО АПРЕЛЯ!', 'НЕ-НЕ-НЕ']), '#ff5050');
            } else {
              this.penalty += 2; Sound.nope();
              floats.add(c.s.x + 100, c.s.y, c.txt.includes('ЧАЙ') ? 'ЭТО ЖЕ ЧАЙ! -2 СЕК' : 'ЭТО МОЖНО БЫЛО! -2 СЕК', '#ffaa40');
            }
            break;
          }
        }
        this.cards = this.cards.filter(c => !c.dead);
      },
      draw(t) {
        drawWorld(t, {});
        ctx.fillStyle = 'rgba(10,10,30,0.35)'; ctx.fillRect(0, 0, W, H);
        // отрывной календарь
        const sunday = (3 + this.day) % 7 === 6;
        ctx.fillStyle = '#f4f0e6'; ctx.fillRect(W / 2 - 56, 18, 112, 44);
        ctx.fillStyle = '#c03030'; ctx.fillRect(W / 2 - 56, 18, 112, 10);
        text(WD[(3 + this.day) % 7], W / 2, 20, { size: 6, color: '#fff', shadow: false });
        text(dateOf(this.day), W / 2, 36, { size: 8, color: sunday ? '#c03030' : '#222', shadow: false });
        const k = this.day / DAYS;
        ctx.fillStyle = '#ccc'; ctx.fillRect(W / 2 - 50, 52, 100, 4);
        ctx.fillStyle = '#3ad040'; ctx.fillRect(W / 2 - 50, 52, Math.round(100 * k), 4);
        // карточки-соблазны
        for (const c of this.cards) {
          const left = 1 - c.age / c.life;
          panel(c.s.x, c.s.y, 200, 38);
          if (c.icon) spr(c.icon, c.s.x + 8, c.s.y + (c.icon === SPR.avocado ? 9 : 7), c.icon === SPR.avocado ? 2 : 2);
          else { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(c.s.x + 8, c.s.y + 14, 12, 12); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(c.s.x + 9, c.s.y + 15, 10, 4); }
          text(c.txt, c.s.x + 30, c.s.y + 15, { size: 6, align: 'left' });
          ctx.fillStyle = '#888'; ctx.fillRect(c.s.x + 30, c.s.y + 30, Math.round(116 * left), 2);
          // кнопка «НЕТ» — есть на всех карточках, но жать только на выпивку
          ctx.fillStyle = '#000'; ctx.fillRect(c.s.x + 151, c.s.y + 7, 42, 24);
          ctx.fillStyle = '#c02828'; ctx.fillRect(c.s.x + 152, c.s.y + 8, 40, 22);
          ctx.fillStyle = '#e85050'; ctx.fillRect(c.s.x + 152, c.s.y + 8, 40, 2);
          text('НЕТ', c.s.x + 172, c.s.y + 15, { size: 8 });
        }
        spr(SPR.stepa[0], W / 2 - 16, GROUND_Y - 66, 2);
        text(`СРЫВЫ ${this.broke}/${maxFails}`, 12, 22, { size: 6, color: this.broke ? '#ff7070' : '#ccc', align: 'left' });
        text(`ОТКАЗОВ ${this.refused}`, W - 12, 22, { size: 6, color: '#ccc', align: 'right' });
        floats.draw();
        waves.draw(222);
      },
      onTimeout() { return 'lose'; },
    };
  },
};

// ======================================================================
// СЦЕНАРИЙ. Каждый пройденный уровень = +1 год (19 → 26).
// story — предыстория от рассказчика, quote — реальная цитата Стёпы из чата.
// ======================================================================
const LEVELS = [
  {
    game: 'catch', title: 'ПИВО НЕ ПРИВЕТСТВУЕТСЯ',
    story: 'Однажды Стёпе предложили взять пива. Ответ вошёл в историю и в эту игру.',
    quote: 'Пиво в моём доме не приветствуется', date: '12.04.2024',
  },
  {
    game: 'avocado', title: 'АВОКАДНЫЙ ЛОВЕЛАС',
    story: 'Цветы вянут. Конфеты кончаются. А плюшевое авокадо — навсегда. Этим секретным оружием Стёпа покорял всех своих бывших и просто девушек, проходивших мимо. Где-то в городе живёт целая армия плюшевых авокадо. Статистика успеха засекречена. Продолжи дело мастера.',
  },
  {
    game: 'runner', title: 'ПЛАТФОРМА 9¾',
    story: 'Стёпа знает, как попасть в Хогвартс, и щедро делится инструкцией.',
    quote: 'Всё, что тебе надо сделать — это хорошенько разбежаться вон в ту стену. Между платформой 9 и 10', date: '18.05.2024',
  },
  {
    game: 'wine', title: 'ДОМАШНИЙ ВИНОКУР',
    story: 'Пиво в доме Стёпы не приветствуется. Зато вино там делают сами. Литрами. С планами на виски.',
    quote: 'Пока 5 литров. А после вина будем виски делать', date: '26.03.2025',
  },
  {
    game: 'grill', title: 'МАСТЕР МАНГАЛА',
    story: 'Стёпа — шашлычник от бога. Сам считает килограммы на компанию, сам маринует, сам жарит, сам потом рассказывает, как надо было. Сегодня мангал доверили тебе. Не опозорь мастера.',
    quote: 'Ещё могу взять на завтра мяса. И сделать ахитительный маринад', date: '08.08.2025',
  },
  {
    game: 'airport', title: 'СОН ПРО АМЕРИКУ',
    story: 'Стёпе приснилась поездка в Америку. Мечта! Только весь сон он провёл в аэропорту. Досмотри его за Стёпу — и не усни внутри сна.',
    quote: 'И сон сука был не про то, как мы были в Америке, а про то, что мы ждали самолёт нахуй', date: '09.02.2026',
  },
  {
    game: 'challenge', title: 'ЧЕЛЛЕНДЖ ДО АПРЕЛЯ',
    story: 'В конце января Стёпа решил: хватит. Объявил челлендж. Календарь пошёл. Соблазны тоже.',
    quote: 'Блять. Предлагаю. Челлендж. Не пить. Хотя бы до апреля', date: '29.01.2026',
  },
];

const SPLASHES = ['26 ЛЕТ!', 'ТЕПЕРЬ В 2D!', 'БЕЗ ДОНАТА!', 'КРИПЕРЫ ВНУТРИ!', 'АВОКАДО ВНУТРИ!', 'ПИВО НЕ ПРИВЕТСТВУЕТСЯ!', 'ЖИВОЙ УГОЛЬ!'];
const WIN_QUIPS = ['ЕСТЬ!', 'КРАСАВА!', 'ЛЕГЧАЙШАЯ', 'ИЗИ', 'ЗБС'];
const LOSE_QUIPS = ['МИМО!', 'ЛОХ', 'НУ ТЫ И НУБ', 'ДАВАЙ ЕЩЁ', 'ЧЕЛ...'];
const FINAL_TEXT = 'Стёпа, с днюхой! Ты тот самый друг, который всегда первым напишет, позовёт, накормит шашлыком и не даст заскучать. С тобой даже сон про ожидание самолёта превращается в приключение. Оставайся таким же: модным, красивым и с плюшевым авокадо наготове. 26 — отличный уровень. Дальше только круче!';

// Реклама после смерти (пародия на рекламу в мобильных играх). Все клиники вымышленные.
const ADS = [
  {
    brand: 'НАРКОЛОГИЯ «ТРЕЗВЫЙ КРИПЕР»',
    head: 'ВЫВЕДЕМ ИЗ ЗАПОЯ ЗА 1 ТИК',
    lines: ['Капельница со вкусом авокадо', 'Анонимно. Даже от друзей', 'Скидка 26% именинникам'],
    phone: '8-800-СТЁ-ПА-26', bg: ['#0b5d3b', '#13a86a'], beforeAfter: true,
  },
  {
    brand: 'РЕХАБ «ОБСИДИАН»',
    head: '28 ДНЕЙ В ОБСИДИАНОВОЙ КОРОБКЕ',
    lines: ['Без бурбона. Без Майнкрафта', 'Только вода и авокадо', 'Выход — через Незер'],
    phone: '8-800-555-КРАФТ', bg: ['#1a0b33', '#5b2a9a'],
  },
  {
    brand: 'КОДИРОВАНИЕ «ПО МЕТОДУ СТИВА»',
    head: 'ЗАКОДИРУЕМ ДАЖЕ НА JAVA EDITION',
    lines: ['Одна сессия — и виски не нужен', '...через неделю снова нужен', 'Гарантия 3 попытки'],
    phone: '8-800-БЕЗ-ВИСКИ', bg: ['#5a1010', '#c43030'],
  },
  {
    brand: 'ГОРЯЧАЯ ЛИНИЯ «ТЫ НЕ ОДИН»',
    head: 'ПРОИГРАЛ В МИНИ-ИГРУ?',
    lines: ['Ты не один. Нас много', 'Мы тоже словили пиво', 'Звони, пока трезвый'],
    phone: '8-800-ЧЕЛ-ЧЕЛ', bg: ['#0b2a5a', '#2a6ad0'],
  },
];
