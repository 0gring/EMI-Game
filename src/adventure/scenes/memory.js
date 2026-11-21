// Memory: find the pairs.
//
// Cards show the animals. Each new board begins with a peek - every card face
// up for a moment, then they all turn over together - because a three year old
// remembers far better when she has seen the whole board once.
//
// A pair stays face up and glows; a mismatch turns back over on its own, gently,
// and touching a third card turns them back straight away so she never waits.
// Every card she turns says its animal's name and sound, so even a mismatch
// teaches a word.

import { TAU, Spring, clamp, ease, shuffled, Schedule } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, radial, darken, roundRect, star as starPath } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { LAND, SEA } from '../../core/creatures.js';
import { glow, rays, twinkle } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#c9c0ff', '#e2dcff', '#f6f1ff'];

const TUNING = [
  { pairs: 2, peek: 2.2 },
  { pairs: 3, peek: 2.2 },
  { pairs: 4, peek: 1.8 },
  { pairs: 6, peek: 1.6 },
];

const FACES = ['#ffe3ef', '#fff2c8', '#dff7d8', '#d9f0ff', '#efe3ff', '#ffe6d6'];
const POOL = [...LAND.filter((a) => a.id !== 'bee'), ...SEA.filter((a) => ['octopus', 'turtle', 'crab', 'starfish', 'jelly'].includes(a.id))];

export class MemoryScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'think', id: 'memory', hue: '#8f7cff', goals: [2, 2, 2, 2] });
    this.sched = new Schedule();
    this.cards = [];
    this.open = [];
    this.newBoard();
  }

  newBoard() {
    this.tune = this.levels.pick(TUNING);
    const kinds = shuffled(POOL).slice(0, this.tune.pairs);
    const deck = shuffled([...kinds, ...kinds]);
    this.cards = deck.map((a, i) => ({
      a, i,
      face: FACES[POOL.indexOf(a) % FACES.length],
      flip: new Spring(1, 210, 17),     // 1 = face up, 0 = face down
      pop: new Spring(0, 150, 11),
      jump: new Spring(0, 260, 12),
      matched: false,
      up: true,
      x: 0, y: 0, w: 0, h: 0,
    }));
    this.open = [];
    this.locked = true;   // during the peek
    this.done = false;
    this.doneT = 0;
    this.cards.forEach((c, i) => this.sched.in(0.05 * i, () => c.pop.to(1)));
    this.sched.in(0.4 + this.tune.peek, () => {
      this.cards.forEach((c) => this.turn(c, false));
      this.audio.play('swipe', { vol: 0.5 });
      this.locked = false;
    });
    if (this.game.engine.w) this.layout(this.game.engine);
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.sched.in(0.5, () => speak('איפה הזוג?', { music: this.game.music }));
  }

  layout(e) {
    super.layout(e);
    const n = this.cards.length;
    if (!n) return;
    const top = (e.topBand || 0) + e.min * 0.04;
    const areaW = e.w * 0.92, areaH = e.h - top - e.min * 0.05;
    // pick the column count that makes the biggest cards
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      if (cols * rows - n >= cols) continue;
      const cw = Math.min(areaW / cols, (areaH / rows) / 1.25);
      if (!best || cw > best.cw) best = { cols, rows, cw };
    }
    const { cols, rows, cw } = best;
    const w = cw * 0.86, h = w * 1.22;
    const gx = cw, gy = cw * 1.25;
    const ox = e.w / 2 - ((cols - 1) * gx) / 2;
    const oy = top + areaH / 2 - ((rows - 1) * gy) / 2;
    this.cards.forEach((c, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const col = i % cols;
      // right to left, and a short last row is centred
      c.x = e.w / 2 + ((inRow - 1) / 2 - col) * gx;
      c.y = oy + row * gy;
      c.w = w;
      c.h = h;
    });
    void ox;
  }

  turn(c, up) {
    c.up = up;
    c.flip.to(up ? 1 : 0);
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (this.done) {
      this.p.confetti(p.x, p.y, CONFETTI, 12, e.min * 0.4);
      this.audio.randomNote('xylophone', 'pentatonicHigh', { vol: 0.4 });
      return;
    }
    const c = this.cards.find((k) => Math.abs(p.x - k.x) < k.w * 0.55 && Math.abs(p.y - k.y) < k.h * 0.55);
    if (!c) {
      this.p.sparkle(p.x, p.y, ['#fff', C.purple], 6, e.min * 0.08);
      return;
    }
    if (this.locked || c.matched) {
      c.jump.kick(-8);
      if (c.up) this.audio.voice(c.a.voice);
      return;
    }
    if (c.up) {
      c.jump.kick(-6);
      return;
    }
    // A third card while a mismatch is still showing: turn those back now.
    if (this.open.length >= 2) {
      this.open.forEach((k) => { if (!k.matched) this.turn(k, false); });
      this.open = [];
      this.sched.clear();
    }
    this.turn(c, true);
    c.jump.kick(-10);
    this.open.push(c);
    this.audio.play('swipe', { vol: 0.6 });
    this.audio.voice(c.a.voice);
    speak(c.a.name, { music: this.game.music });

    if (this.open.length === 2) {
      const [a, b] = this.open;
      if (a.a === b.a) {
        this.sched.in(0.45, () => this.match(a, b, e));
      } else {
        this.sched.in(1.4, () => {
          if (!a.matched) this.turn(a, false);
          if (!b.matched) this.turn(b, false);
          this.open = [];
          this.audio.play('swipe', { vol: 0.35, rate: 0.85 });
        });
      }
    }
  }

  match(a, b, e) {
    a.matched = b.matched = true;
    this.open = [];
    a.jump.kick(-14);
    b.jump.kick(-14);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    for (const c of [a, b]) {
      this.p.sparkle(c.x, c.y, ['#fff', C.yellow, '#e6dcff'], 16, c.w * 0.7);
      this.p.ring(c.x, c.y, '#ffffff', c.w * 0.6, 0.5);
      this.game.magic?.burst(c.x, c.y, { n: 20, power: 0.55 });
    }
    this.reward(mx, my, { stars: 1 });
    speak(`${a.a.name}! ${a.a.says || ''}`, { music: this.game.music });
    if (this.cards.every((c) => c.matched)) {
      this.done = true;
      this.doneT = 0;
      this.sched.in(0.9, () => {
        this.reward(e.cx, e.cy, { stars: 2, big: true });
        speak('כל הכבוד! מצאת את כולם!', { music: this.game.music });
        this.scoreLevel(1, e);
      });
      // a little parade of voices, one card after the other
      const seen = new Set();
      let k = 0;
      for (const c of this.cards) {
        if (seen.has(c.a)) continue;
        seen.add(c.a);
        this.sched.in(1.8 + k * 0.55, () => {
          this.audio.voice(c.a.voice);
          this.cards.filter((x) => x.a === c.a).forEach((x) => x.jump.kick(-14));
        });
        k++;
      }
    }
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    for (const c of this.cards) {
      c.flip.update(dt);
      c.pop.update(dt);
      c.jump.update(dt);
    }
    if (this.done) {
      this.doneT += dt;
      if (this.doneT > 6) {
        this.sched.clear();
        this.newBoard();
      }
    }
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    if (this.done) rays(g, e.cx, e.cy, e.max * 0.7, t, 'rgba(255,255,255,0.3)', 16);
    const pulse = this.attractPulse(2);
    for (const c of this.cards) this.drawCard(g, c, t, pulse);
    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawCard(g, c, t, pulse) {
    const pop = ease.outBack(clamp(c.pop.value, 0, 1.2));
    if (pop <= 0.01) return;
    const f = c.flip.value;               // 1 face, 0 back
    const sx = Math.abs(Math.cos((1 - clamp(f, 0, 1)) * Math.PI));
    const showFace = f > 0.5;
    const w = c.w * pop, h = c.h * pop;
    const r = w * 0.12;
    g.save();
    g.translate(c.x, c.y + c.jump.value * h * 0.02);
    if (!c.up && !this.locked) g.rotate(pulse * Math.sin(t * 9 + c.i) * 0.03);
    if (c.matched) glow(g, 0, 0, w * 1.0, '#fff3b0', 0.35 + Math.sin(t * 3 + c.i) * 0.1);
    g.scale(Math.max(0.02, sx), 1);
    // shadow
    g.fillStyle = 'rgba(60,40,110,0.22)';
    roundRect(g, -w / 2, -h / 2 + h * 0.04, w, h, r);
    g.fill();
    if (showFace) {
      g.fillStyle = '#ffffff';
      roundRect(g, -w / 2, -h / 2, w, h, r);
      g.fill();
      g.fillStyle = radial(g, 0, -h * 0.1, w * 0.9, ['#ffffff', c.face, darken(c.face, 0.06)]);
      roundRect(g, -w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.88, h - w * 0.12, r * 0.7);
      g.fill();
      const k = w * 0.27;
      g.save();
      g.translate(0, h * 0.02);
      g.scale(k, k);
      c.a.draw(g, t + c.i, c.matched ? 0.5 + Math.sin(t * 4) * 0.2 : 0.2, c.i);
      g.restore();
      if (c.matched) {
        for (let i = 0; i < 2; i++) {
          const a = t * 2 + i * Math.PI;
          twinkle(g, Math.cos(a) * w * 0.38, -h * 0.36 + Math.sin(a) * h * 0.04, w * 0.06, '#ffd93d');
        }
      }
    } else {
      g.fillStyle = radial(g, -w * 0.2, -h * 0.3, h * 1.1, ['#b8a8ff', '#8f7cff', '#5f48d6']);
      roundRect(g, -w / 2, -h / 2, w, h, r);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = w * 0.035;
      roundRect(g, -w / 2 + w * 0.07, -h / 2 + w * 0.07, w * 0.86, h - w * 0.14, r * 0.7);
      g.stroke();
      // a little constellation pattern
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 6; i++) {
        circle(g, Math.cos(i * 1.9) * w * 0.3, Math.sin(i * 2.7) * h * 0.32, w * 0.025);
        g.fill();
      }
      g.fillStyle = '#ffd93d';
      starPath(g, 5, w * 0.2, w * 0.09, Math.sin(t * 1.5 + c.i) * 0.15);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath();
      g.ellipse(-w * 0.18, -h * 0.3, w * 0.16, h * 0.05, -0.4, 0, TAU);
      g.fill();
    }
    g.restore();
  }
}
