'use strict';
// Сцены: титул → история → команда → мини-игра → результат → … → финал.
// Отладка: ?debug — клавиша N засчитывает уровень; ?level=3 — начать с 3-го уровня.

const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.has('debug');
const MAX_TRIES = 3;
const START_AGE = 26 - LEVELS.length;
const State = { level: 0, fails: 0, totalFails: 0, pities: 0 };

function TitleScene() {
  let t = 0;
  FX.clear();
  const splash = choice(SPLASHES);
  return {
    update(dt) {
      t += dt;
      if (t > 0.3 && Input.action) {
        Sound.unlock(); Sound.blip(); goFullscreen(); Music.start();
        Object.assign(State, { level: clamp((+PARAMS.get('level') || 1) - 1, 0, LEVELS.length - 1), fails: 0, totalFails: 0, pities: 0 });
        setScene(StoryScene());
      }
    },
    draw() {
      drawWorld(t);
      text('СТЁПА', W / 2, 34, { size: 40, color: '#f0f0f0', shadowColor: '#3a3a3a' });
      text('ВЫЖИВИ ДО 26', W / 2, 86, { size: 12, color: '#ffdd55', shadowColor: '#3f3f00' });
      ctx.save();
      ctx.translate(W / 2 + 150, 62);
      ctx.rotate(-0.35);
      const s = 1 + Math.sin(t * 8) * 0.07;
      ctx.scale(s, s);
      text(splash, 0, 0, { size: 8, color: '#ffff00', shadowColor: '#3f3f00', baseline: 'middle' });
      ctx.restore();
      spr(SPR.stepa[0], 44, GROUND_Y - 99, 3);
      spr(SPR.creeper, 392, GROUND_Y - 48, 6);
      button(W / 2 - 70, 140, 140, 22, 'ИГРАТЬ', Math.sin(t * 4) > 0);
      text('со звуком лучше', W / 2, 172, { size: 6, color: '#2a3a60', shadow: false });
      text('7 УРОВНЕЙ · 7 ЛЕТ · 1 СТЁПА', W / 2, 258, { size: 6, color: '#e8d8c0' });
    },
  };
}

const QUOTE_AT = 1.3;
function StoryScene() {
  const L = LEVELS[State.level];
  let t = 0, popped = false;
  return {
    // Тап до появления цитаты — сразу показать её, следующий тап — начать
    update(dt) {
      t += dt;
      if (L.quote && !popped && t > QUOTE_AT) { popped = true; Sound.pop(); }
      if (Input.action && t > 0.4) {
        if (L.quote && t < QUOTE_AT) { t = QUOTE_AT; }
        else { Sound.blip(); setScene(VerbScene()); }
      }
    },
    draw() {
      drawWorld(t * 0.3, { night: L.night });
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
      text(`УРОВЕНЬ ${State.level + 1}/${LEVELS.length} · ВОЗРАСТ ${START_AGE + State.level}`, W / 2, 14, { size: 6, color: '#ccc' });
      const title = wrap(L.title, W - 40, 14);
      title.forEach((l, i) => text(l, W / 2, 30 + i * 20, { size: 14, color: '#ffdd55', shadowColor: '#3f3f00' }));
      let y = 34 + title.length * 20;
      const story = wrap(L.story, W - 80, 8);
      story.forEach((l, i) => text(l, W / 2, y + i * 14, { size: 8, color: '#eee' }));
      y += story.length * 14 + 12;
      if (L.quote) {
        const bw = 330, bx = (W - bw) / 2;
        if (t < QUOTE_AT) {
          // «печатает…»
          panel(bx, y, 90, 22);
          const dots = '.'.repeat(1 + Math.floor(t * 4) % 3);
          text('Стёпа' + dots, bx + 10, y + 8, { size: 6, color: '#8fd3ff', align: 'left' });
        } else {
          const k = Math.min(1, (t - QUOTE_AT) / 0.2), s = lerp(0.6, 1, easeOutBack(k));
          const lines = wrap('«' + L.quote + '»', bw - 24, 8);
          const bh = lines.length * 14 + 30;
          ctx.save(); ctx.translate(bx, y); ctx.scale(s, s);
          panel(0, 0, bw, bh);
          text('Стёпа', 12, 9, { size: 6, color: '#8fd3ff', align: 'left' });
          if (L.date) text(L.date, bw - 10, 9, { size: 6, color: '#888', align: 'right' });
          lines.forEach((l, i) => text(l, 12, 24 + i * 14, { size: 8, align: 'left' }));
          ctx.restore();
        }
      }
      if (t > (L.quote ? QUOTE_AT + 0.4 : 0.6) && Math.floor(t * 2.5) % 2 === 0) text('ЖМИ, ЧТОБЫ НАЧАТЬ', W / 2, 250, { size: 8 });
    },
  };
}

function VerbScene() {
  const L = LEVELS[State.level], G = GAMES[L.game];
  let t = 0;
  Sound.verb();
  // Правила висят, пока игрок не нажмёт
  return {
    update(dt) {
      t += dt;
      if (t > 0.6 && Input.action) { Sound.blip(); setScene(PlayScene()); }
    },
    draw() {
      drawDirtBg();
      const k = Math.min(1, t / 0.25);
      const s = lerp(2.6, 1, easeOutBack(k));
      ctx.save();
      ctx.translate(W / 2, 34);
      ctx.scale(s, s);
      text(L.verb || G.verb, 0, 0, { size: 24, color: '#ffdd55', shadowColor: '#3f3f00', baseline: 'middle' });
      ctx.restore();
      const rules = G.rules || [G.hint];
      const ph = rules.length * 16 + 58;
      panel(36, 62, W - 72, ph);
      text('ПРАВИЛА', 52, 72, { size: 6, color: '#8fd3ff', align: 'left' });
      rules.forEach((r, i) => text('- ' + r, 52, 86 + i * 16, { size: 8, align: 'left' }));
      const cy = 86 + rules.length * 16 + 4;
      const touchFirst = Input.pointerType === 'touch';
      text((touchFirst ? 'ТЕЛЕФОН: ' : 'НОУТ: ') + (touchFirst ? G.touch : G.keys), 52, cy, { size: 6, color: '#b8f060', align: 'left' });
      text((touchFirst ? 'НОУТ: ' : 'ТЕЛЕФОН: ') + (touchFirst ? G.keys : G.touch), 52, cy + 12, { size: 6, color: '#999', align: 'left' });
      const by = 62 + ph + 10;
      if (State.fails) text(`ПОПЫТКА ${State.fails + 1} ИЗ ${MAX_TRIES}`, W / 2 - 50, by + 1, { size: 6, color: '#ff8080' });
      drawHearts(W / 2 + 70, by, MAX_TRIES - State.fails, MAX_TRIES);
      if (t > 0.6 && Math.floor(t * 2.5) % 2 === 0) text('ЖМИ, ЧТОБЫ НАЧАТЬ', W / 2, 250, { size: 8 });
    },
  };
}

function PlayScene() {
  const L = LEVELS[State.level], G = GAMES[L.game];
  FX.clear();
  const inst = G.create({ fails: State.fails, params: L.params || {}, night: L.night });
  const total = inst.time;
  let left = total, after = 0, t = 0, sounded = false;
  return {
    update(dt) {
      t += dt;
      if (!inst.result) {
        inst.update(dt, t);
        if (DEBUG && (Input.pressedKeys['n'] || Input.pressedKeys['т'])) inst.result = 'win';
        left -= dt + (inst.penalty || 0);
        inst.penalty = 0;
        if (left <= 0 && !inst.result) { left = 0; inst.result = inst.onTimeout(); }
      } else {
        after += dt;
        if (after > 1) setScene(ResultScene(inst.result));
      }
      if (inst.result && !sounded) {
        sounded = true;
        inst.result === 'win' ? Sound.win() : Sound.lose();
      }
    },
    draw() {
      inst.draw(t);
      // таймер в виде полосы опыта
      const frac = clamp(left / total, 0, 1), bw = 182, bx = (W - bw) / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, 7, bw + 2, 7);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(bx, 8, bw, 5);
      ctx.fillStyle = frac > 0.3 ? '#80ff20' : '#ff5530'; ctx.fillRect(bx, 8, Math.round(bw * frac), 5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, 8, Math.round(bw * frac), 1);
      text(`УР ${State.level + 1}/${LEVELS.length}`, 8, 7, { size: 6, align: 'left' });
      drawHearts(W - 6, 7, MAX_TRIES - State.fails, MAX_TRIES);
    },
  };
}

function ResultScene(res) {
  let t = 0;
  const win = res === 'win';
  let pity = false;
  if (win) { State.level++; State.fails = 0; }
  else {
    State.fails++; State.totalFails++;
    if (State.fails >= MAX_TRIES) { pity = true; State.pities++; State.level++; State.fails = 0; }
  }
  const done = State.level >= LEVELS.length;
  const msg = win ? choice(WIN_QUIPS) : pity ? 'ЗАСЧИТАНО ИЗ ЖАЛОСТИ' : choice(LOSE_QUIPS);
  if (pity) Sound.pity();
  return {
    update(dt) {
      t += dt;
      if (t > 0.7 && (Input.action || t > 2.8)) {
        setScene(done ? FinalScene() : (win || pity) ? StoryScene() : AdScene());
      }
    },
    draw() {
      drawDirtBg();
      const k = Math.min(1, t / 0.3), s = lerp(0.3, 1, easeOutBack(k));
      ctx.save();
      ctx.translate(W / 2, 80);
      ctx.scale(s, s);
      text(msg, 0, 0, { size: pity ? 12 : 22, color: win ? '#80ff20' : pity ? '#ffdd55' : '#ff5555', baseline: 'middle' });
      ctx.restore();
      if (win || pity) {
        text(`ВОЗРАСТ: ${START_AGE + State.level}`, W / 2, 120, { size: 10 });
        const bob = Math.abs(Math.sin(t * 8)) * 8;
        spr(SPR.stepa[0], W / 2 - 16, 150 - bob, 2);
      } else {
        drawHearts(W / 2 + 13, 116, MAX_TRIES - State.fails, MAX_TRIES);
        text(`ОСТАЛОСЬ ПОПЫТОК: ${MAX_TRIES - State.fails}`, W / 2, 136, { size: 8, color: '#ddd' });
      }
    },
  };
}

// Реклама после смерти: «пропустить» становится доступно через несколько секунд
let adIndex = 0;
function AdScene() {
  const ad = ADS[adIndex++ % ADS.length];
  const WAIT = 4;
  let t = 0, nope = 0;
  Sound.seq([523, 659, 784, 659, 523, 784], 0.1, 'square', 0.05);
  return {
    update(dt) {
      t += dt;
      nope = Math.max(0, nope - dt);
      if (Input.action) {
        if (t >= WAIT) { Sound.blip(); setScene(VerbScene()); }
        else if (t > 0.3) { nope = 0.6; Sound.nope(); }
      }
    },
    draw() {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // бегущие полосы для «рекламности»
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = -2; i < 14; i++) {
        const x = ((i * 48 + t * 30) % (W + 96)) - 48;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x - 56, H); ctx.lineTo(x - 80, H); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(6, 6, 58, 12);
      text('РЕКЛАМА', 35, 9, { size: 6, color: '#ddd', shadow: false });
      if (t < WAIT) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 150, 6, 144, 12);
        text(`пропустить через ${Math.ceil(WAIT - t)}`, W - 78, 9, { size: 6, color: nope ? '#ff8080' : '#ddd', shadow: false });
      } else {
        button(W - 130, 5, 124, 16, 'ПРОПУСТИТЬ >>', Math.sin(t * 6) > 0);
      }
      if (nope) text('ДОСМОТРИ РЕКЛАМУ', W - 78, 24, { size: 6, color: '#ff8080' });

      text(ad.brand, 24, 34, { size: 8, color: '#fff', align: 'left' });
      const head = wrap(ad.head, 270, 14);
      head.forEach((l, i) => text(l, 24, 54 + i * 22, { size: 14, color: '#fff', align: 'left' }));
      let y = 60 + head.length * 22;
      ad.lines.forEach(l => { text('- ' + l, 24, y, { size: 8, color: '#f0f0f0', align: 'left' }); y += 16; });
      const s = 1 + Math.sin(t * 6) * 0.05;
      ctx.save(); ctx.translate(24, y + 18); ctx.scale(s, s);
      text(ad.phone, 0, 0, { size: 12, color: '#ffee55', align: 'left', baseline: 'middle', shadowColor: '#3f3f00' });
      ctx.restore();

      if (ad.beforeAfter) {
        text('ДО', 352, 92, { size: 8 });
        spr(SPR.stepa[0], 336, 150, 2);
        spr(SPR.bottle, 330, 186, 2);
        text('ПОСЛЕ', 428, 92, { size: 8, color: '#b8f060' });
        spr(SPR.stepa[0], 412, 150, 2);
        spr(SPR.avocado, 440, 186, 2);
        if (Math.sin(t * 10) > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(450, 176, 2, 2); ctx.fillRect(404, 160, 2, 2); }
      } else {
        spr(SPR.stepa[0], 360, 116 + Math.sin(t * 3) * 3, 3);
        spr(SPR.avocado, 400, 190, 2);
      }
      text('Не является медицинской услугой. Есть противопоказания: Стёпа.', W / 2, 256, { size: 6, color: 'rgba(255,255,255,0.6)', shadow: false });
    },
  };
}

function FinalScene() {
  let t = 0, conf = 0, fw = 1.5;
  const COLORS = ['#ff3c3c', '#ffdd55', '#80ff20', '#3cc8ff', '#ff3ccf', '#fff'];
  Sound.fanfare();
  window.__finals = (window.__finals || 0) + 1;
  return {
    update(dt) {
      t += dt;
      conf -= dt;
      if (conf <= 0) {
        conf = 0.025;
        FX.add({ x: rand(0, W), y: -4, vx: rand(-20, 20), vy: rand(40, 90), g: 10, life: 4, size: randi(2, 3), color: choice(COLORS) });
      }
      fw -= dt;
      if (fw <= 0) {
        fw = rand(0.6, 1.4);
        const x = rand(60, W - 60), y = rand(30, 110), c = choice(COLORS);
        FX.burst(x, y, 30, [c, '#fff'], 110, { g: 60, life: 1.2 });
        Sound.noise(0.25, 0.05);
      }
      if (t > 4 && Input.action) setScene(TitleScene());
    },
    draw() {
      drawWorld(t, { night: true });
      text('С ДНЮХОЙ,', W / 2, 30, { size: 14 });
      const s = 1 + Math.sin(t * 4) * 0.05;
      ctx.save(); ctx.translate(W / 2, 70); ctx.scale(s, s);
      text('СТЁПА!', 0, 0, { size: 28, color: '#ffdd55', shadowColor: '#3f3f00', baseline: 'middle' });
      ctx.restore();
      const lines = wrap(FINAL_TEXT, 260, 8);
      const ph = lines.length * 14 + 20;
      panel(150, 100, 290, ph);
      lines.forEach((l, i) => text(l, 164, 110 + i * 14, { size: 8, align: 'left' }));
      text(`провалов: ${State.totalFails} · из жалости: ${State.pities}`, 295, 108 + ph, { size: 6, color: '#aab' });
      spr(SPR.stepa[0], 50, GROUND_Y - 66 - Math.abs(Math.sin(t * 5)) * 14, 2);
      // тост «Достижение получено»
      const tx = W - 166 + Math.max(0, 1 - (t - 1) * 3) * 180 + Math.max(0, (t - 6) * 3) * 180;
      if (t > 1 && t < 7) {
        panel(tx, 4, 160, 30);
        text('Достижение получено!', tx + 8, 10, { size: 6, color: '#ffdd55', align: 'left' });
        text('Дожить до 26', tx + 8, 22, { size: 6, align: 'left' });
      }
      if (t > 4 && Math.floor(t * 2) % 2 === 0) text('ЖМИ — ЕЩЁ РАЗ', W / 2, 248, { size: 6, color: '#ccc' });
    },
  };
}

// Старт после загрузки пиксельного шрифта (с кириллицей)
Promise.race([
  document.fonts ? document.fonts.load(`8px ${FONT}`, 'СТЁПА абв') : Promise.resolve(),
  new Promise(r => setTimeout(r, 2500)),
]).catch(() => {}).then(() => {
  // ?scene=story|verb|play|final — сразу открыть сцену (для отладки)
  const SpritesScene = () => ({
    update() {},
    draw() {
      drawWorld(0);
      SPR.girls.forEach((g, i) => spr(g[0], 20 + i * 40, GROUND_Y - 66, 2));
      spr(SPR.stepa[0], 230, GROUND_Y - 66, 2);
      spr(SPR.creeperFull, 280, GROUND_Y - 48, 2);
      spr(SPR.avocado, 320, GROUND_Y - 40, 2);
      spr(SPR.bottle, 350, GROUND_Y - 24, 2);
    },
  });
  const SCENES = { story: StoryScene, verb: VerbScene, play: PlayScene, final: FinalScene, ad: AdScene, sprites: SpritesScene };
  if (DEBUG) adIndex = +PARAMS.get('ad') || 0;
  const s = DEBUG && SCENES[PARAMS.get('scene')];
  if (s) State.level = clamp((+PARAMS.get('level') || 1) - 1, 0, LEVELS.length - 1);
  startLoop(s ? s() : TitleScene());
  // ?sim=N — прогнать N кадров со случайными тапами (бот для проверки логики)
  const sim = DEBUG && +PARAMS.get('sim');
  for (let i = 0; i < (sim || 0); i++) {
    if (i % 17 === 0) Object.assign(Input, { tapped: true, x: rand(40, W - 40), y: rand(60, 230), usingPointer: true, pointerType: 'touch' });
    Input.down = (i % 60) < 30;
    Game.scene.update(1 / 60); FX.update(1 / 60); Input.endFrame();
  }
  if (sim) console.log('SIM_DONE finals=' + (window.__finals || 0) + ' level=' + State.level + ' fails=' + State.fails + ' pities=' + State.pities);
});
