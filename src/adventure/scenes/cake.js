// The bakery: build a birthday cake from scratch.
//
//   1. pick a sponge     - the tiers drop onto the plate one by one
//   2. pick an icing     - it pours over the top and drips down the sides
//   3. decorate          - tap a topping and it hops onto the cake, or drag it
//                          to exactly the spot she wants
//   4. blow the candles  - three of them, because she is three; touching a
//                          flame puffs it out, and the last one starts the
//                          birthday song
//
// Each step is one tap away from the next and none of them can go wrong: any
// sponge, any icing, any topping anywhere is a beautiful cake.

import { TAU, Spring, rand, pick, clamp, ease, lerp, Schedule } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, label, radial, lighten, darken, roundRect, verticalGradient } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { drawEmi, EMI_FEET, LAND } from '../../core/creatures.js';
import { drawTier, drawCandle, TOPPINGS, SPONGES, ICINGS, sprinkle, SPRINKLE_COLORS, glow, rays, card } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#ffd6ea', '#ffe8f2', '#fff6ea'];

// Tiers grow, more toppings to choose from, and more go on before the candles.
const TUNING = [
  { tiers: 1, toppings: 4, need: 5 },
  { tiers: 2, toppings: 6, need: 6 },
  { tiers: 2, toppings: 8, need: 8 },
  { tiers: 3, toppings: 8, need: 10 },
];

const TIER_W = [1, 0.74, 0.5];
const TIER_H = [0.34, 0.3, 0.27];
const CANDLES = ['#57c7ff', '#ff85c8', '#ffd93d'];

// Happy Birthday, in C. [note, beats]
const SONG = [
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
];

export class CakeScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'play', id: 'cake', hue: '#ff5fa2', goals: [1, 2, 2, 2] });
    this.sched = new Schedule();
    this.guest = pick(LAND.filter((a) => ['bunny', 'cat', 'dog', 'pig', 'penguin', 'monkey'].includes(a.id)));
    this.guestJoy = new Spring(0, 160, 10);
    this.emiJoy = new Spring(0, 160, 10);
    this.reset();
  }

  reset() {
    this.tune = this.levels.pick(TUNING);
    this.step = 'sponge';
    this.sponge = null;
    this.icing = null;
    this.tiers = [];        // { drop: Spring, icing: 0..1 }
    this.items = [];        // placed toppings
    this.sprinkles = [];
    this.candles = [];
    this.placed = 0;
    this.choices = [];
    this.flying = [];
    this.doneT = 0;
    this.buildChoices();
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.sched.in(0.5, () => speak('איזו עוגה נאפה?', { music: this.game.music }));
  }

  onLevelUp() { /* the next cake picks up the new tuning in reset() */ }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    this.W = Math.min(e.min * (P ? 0.62 : 0.5), e.w * 0.62);
    this.plateY = e.h * (P ? 0.66 : 0.67);
    this.cx = e.w / 2;
    this.trayY = e.h * (P ? 0.86 : 0.875);
    this.btnR = clamp(Math.min(e.min * 0.075, e.w / 22), 26, 62);
    this.emiS = e.min * 0.095;
    this.layoutChoices(e);
  }

  paintBackdrop(g, e) {
    // A warm bakery: striped wallpaper, a shelf, and a table top.
    const tableY = this.plateY + this.W * 0.06;
    g.save();
    g.globalAlpha = 0.35;
    const stripe = Math.max(18, e.min * 0.06);
    for (let x = 0; x < e.w; x += stripe * 2) {
      g.fillStyle = '#ffffff';
      g.fillRect(x, 0, stripe, tableY);
    }
    g.restore();
    // bunting
    g.save();
    const n = Math.ceil(e.w / (e.min * 0.09));
    const by = (e.topBand || e.min * 0.12) + e.min * 0.02;
    g.strokeStyle = 'rgba(160,100,140,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, by);
    g.quadraticCurveTo(e.w / 2, by + e.min * 0.06, e.w, by);
    g.stroke();
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * e.w;
      const tt = x / e.w;
      const y = by + 4 * tt * (1 - tt) * e.min * 0.03;
      g.fillStyle = CONFETTI[i % CONFETTI.length];
      g.beginPath();
      g.moveTo(x - e.min * 0.025, y);
      g.lineTo(x + e.min * 0.025, y);
      g.lineTo(x, y + e.min * 0.055);
      g.closePath();
      g.fill();
    }
    g.restore();
    // table
    g.fillStyle = verticalGradient(g, tableY, e.h, ['#ffc9a8', '#f6a985', '#e48f6c']);
    g.fillRect(0, tableY, e.w, e.h - tableY);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, tableY, e.w, Math.max(3, e.min * 0.01));
    // gingham cloth band
    const cell = Math.max(14, e.min * 0.04);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = 0; x < e.w; x += cell * 2) g.fillRect(x, tableY, cell, e.h - tableY);
    for (let y = tableY; y < e.h; y += cell * 2) g.fillRect(0, y, e.w, cell);
  }

  // --- choices along the bottom ----------------------------------------------

  buildChoices() {
    const s = this.step;
    if (s === 'sponge') this.choices = SPONGES.map((sp) => ({ kind: 'sponge', v: sp }));
    else if (s === 'icing') this.choices = ICINGS.map((ic) => ({ kind: 'icing', v: ic }));
    else if (s === 'decorate') {
      this.choices = TOPPINGS.slice(0, this.tune.toppings).map((tp) => ({ kind: 'top', v: tp }));
      this.choices.push({ kind: 'sprinkles', v: { name: 'סוכריות' } });
    } else this.choices = [];
    this.choices.forEach((c, i) => {
      c.press = new Spring(0, 300, 16);
      c.pop = new Spring(0, 140, 10);
      c.delay = i * 0.06;
    });
    if (this.game.engine.w) this.layoutChoices(this.game.engine);
  }

  layoutChoices(e) {
    const n = this.choices.length;
    if (!n) return;
    const r = Math.min(this.btnR, (e.w * 0.92) / n / 2.3);
    const gap = Math.min(r * 2.5, (e.w * 0.94) / n);
    this.choices.forEach((c, i) => {
      c.r = r;
      // right-to-left, the way she will see it read
      c.x = e.w / 2 + ((n - 1) / 2 - i) * gap;
      c.y = this.trayY;
    });
  }

  // --- cake geometry ------------------------------------------------------------

  tierRect(i) {
    const W = this.W;
    let y = this.plateY;
    for (let k = 0; k < i; k++) y -= TIER_H[k] * W;
    return { x: this.cx - (TIER_W[i] * W) / 2, y: y - TIER_H[i] * W, w: TIER_W[i] * W, h: TIER_H[i] * W };
  }

  topOfCake() {
    const r = this.tierRect(this.tune.tiers - 1);
    return { x: this.cx, y: r.y, w: r.w };
  }

  onCake(x, y) {
    for (let i = 0; i < this.tiers.length; i++) {
      const r = this.tierRect(i);
      if (x > r.x - r.h * 0.2 && x < r.x + r.w + r.h * 0.2 && y > r.y - r.h * 0.35 && y < r.y + r.h) return i;
    }
    return -1;
  }

  // A free spot on the cake, spreading toppings out instead of piling them.
  autoSpot() {
    let best = null, bestD = -1;
    for (let k = 0; k < 14; k++) {
      const ti = Math.floor(Math.random() * this.tiers.length);
      const r = this.tierRect(ti);
      const x = rand(r.x + r.w * 0.12, r.x + r.w * 0.88);
      const y = rand(r.y + r.h * 0.3, r.y + r.h * 0.78);
      let d = Infinity;
      for (const it of this.items) d = Math.min(d, Math.hypot(it.x - x, it.y - y));
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  // --- input ----------------------------------------------------------------------

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (this.step === 'candles') {
      for (const c of this.candles) {
        if (c.lit > 0.5 && Math.hypot(p.x - c.x, p.y - (c.y - c.h * 1.2)) < Math.max(this.W * 0.14, 40)) {
          this.blow(c, e);
          return;
        }
      }
      // anywhere near the cake counts as a big puff, so she is never stuck
      if (Math.hypot(p.x - this.cx, p.y - this.topOfCake().y) < this.W * 0.6) {
        const c = this.candles.find((k) => k.lit > 0.5);
        if (c) this.blow(c, e);
      }
      return;
    }
    for (const c of this.choices) {
      if (Math.hypot(p.x - c.x, p.y - c.y) < c.r * 1.25) {
        c.press.to(1);
        if (c.kind === 'top') {
          p.data = { drag: c, x: p.x, y: p.y };
          return;
        }
        this.choose(c, e);
        return;
      }
    }
    // touching the cake itself makes it wobble and giggle
    if (this.onCake(p.x, p.y) >= 0) {
      this.tiers.forEach((t) => t.drop.kick(-6));
      this.audio.play('boing', { vol: 0.5 });
      this.guestJoy.kick(6);
    } else {
      this.p.sparkle(p.x, p.y, ['#fff', C.pink, C.yellow], 8, e.min * 0.1);
    }
  }

  onMove(p) {
    if (p.data?.drag) {
      p.data.x = p.x;
      p.data.y = p.y;
    }
  }

  onUp(p, e) {
    this.hud.onUp(p);
    for (const c of this.choices) c.press.to(0);
    const d = p.data?.drag;
    if (!d) return;
    if (this.step !== 'decorate') return;
    // A short tap (or a drop off the cake) sends it to a free spot; a drop on
    // the cake puts it exactly where her finger let go.
    const ti = p.moved > 18 ? this.onCake(p.x, p.y) : -1;
    const to = ti >= 0 ? { x: p.x, y: p.y } : this.autoSpot();
    this.flying.push({ top: d.v, fx: p.moved > 18 ? p.x : d.x, fy: p.moved > 18 ? p.y : d.y, tx: to.x, ty: to.y, k: 0 });
    this.audio.play('swipe', { vol: 0.5 });
  }

  choose(c, e) {
    if (this.step === 'sponge') {
      this.sponge = c.v.c;
      speak(c.v.name, { music: this.game.music });
      this.audio.play('drop', { vol: 0.7 });
      for (let i = 0; i < this.tune.tiers; i++) {
        const tr = { drop: new Spring(-1, 140, 11), icing: 0 };
        this.tiers.push(tr);
        this.sched.in(i * 0.35, () => {
          tr.drop.to(0);
          this.audio.play('snap', { vol: 0.6 });
          this.audio.note('xylophone', ['C5', 'E5', 'G5'][i], { vol: 0.5 });
        });
      }
      this.next('icing', 0.35 * this.tune.tiers + 0.5, 'איזה קרם?');
    } else if (this.step === 'icing') {
      this.icing = c.v.c;
      speak(c.v.name, { music: this.game.music });
      this.audio.play('expand', { vol: 0.7 });
      this.audio.glissando('harp', 'C5', 'C6', 8, { step: 0.07, vol: 0.45 });
      this.pouring = 0;
      this.next('decorate', 1.4, 'עכשיו מקשטים!');
    } else if (this.step === 'decorate' && c.kind === 'sprinkles') {
      this.shake(e);
    }
  }

  next(step, delay, say) {
    this.step = 'wait';
    this.choices = [];
    this.sched.in(delay, () => {
      this.step = step;
      this.buildChoices();
      if (say) speak(say, { music: this.game.music });
    });
  }

  shake(e) {
    const top = this.topOfCake();
    for (let i = 0; i < 26; i++) {
      const ti = Math.floor(Math.random() * this.tiers.length);
      const r = this.tierRect(ti);
      this.sprinkles.push({
        ti, u: rand(0.06, 0.94), v: rand(0.08, 0.5), rot: rand(TAU), c: pick(SPRINKLE_COLORS),
        fall: rand(0, 0.4), k: 0,
      });
      void r;
    }
    this.p.sparkle(top.x, top.y - this.W * 0.15, SPRINKLE_COLORS, 16, this.W * 0.3);
    this.audio.play('chime', { vol: 0.6 });
    this.audio.arp('xylophone', ['E6', 'G6', 'C7', 'E7'], { step: 0.04, vol: 0.4 });
    this.score(e, top.x, top.y);
  }

  land(f, e) {
    this.items.push({ top: f.top, x: f.tx, y: f.ty, rot: rand(-0.3, 0.3), pop: new Spring(0.4, 260, 12).to(1) });
    this.audio.play('pop', { vol: 0.7 });
    this.audio.note('xylophone', ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'][this.placed % 6], { vol: 0.5 });
    speak(f.top.name, { music: this.game.music });
    this.p.sparkle(f.tx, f.ty, ['#fff', C.yellow], 8, e.min * 0.08);
    this.game.magic?.burst(f.tx, f.ty, { n: 12, power: 0.35 });
    this.score(e, f.tx, f.ty);
  }

  score(e, x, y) {
    this.placed++;
    this.guestJoy.kick(8);
    this.emiJoy.kick(6);
    if (this.placed >= this.tune.need && this.step === 'decorate') {
      this.reward(x, y, { stars: 1 });
      this.next('candles', 1.0, null);
      this.sched.in(1.0, () => this.lightCandles(e));
    }
  }

  lightCandles(e) {
    const top = this.topOfCake();
    this.candles = CANDLES.map((col, i) => ({
      x: top.x + (i - 1) * top.w * 0.26, y: top.y + top.w * 0.02, h: this.W * 0.16,
      col, lit: 0, grow: new Spring(0, 200, 12),
    }));
    this.candles.forEach((c, i) => this.sched.in(0.25 + i * 0.3, () => {
      c.grow.to(1);
      c.lit = 1;
      this.audio.play('plink', { vol: 0.6 });
      this.audio.note('harp', ['G5', 'C6', 'E6'][i], { vol: 0.5 });
    }));
    this.sched.in(1.4, () => speak('לנשוף על הנרות!', { music: this.game.music }));
  }

  blow(c, e) {
    c.lit = 0;
    this.audio.play('swipe', { vol: 0.8, rate: 0.8 });
    for (let i = 0; i < 6; i++) {
      this.p.spawn('puff', c.x + rand(-6, 6), c.y - c.h * 1.2, {
        vx: rand(-20, 20), vy: -rand(40, 90), g: -10, life: rand(0.8, 1.4), size: rand(6, 14), color: '#d8d8e6',
      });
    }
    if (this.candles.every((k) => k.lit < 0.5)) this.finish(e);
  }

  finish(e) {
    this.step = 'party';
    this.doneT = 0;
    const top = this.topOfCake();
    this.reward(top.x, top.y, { stars: 3, big: true });
    this.guestJoy.kick(14);
    this.emiJoy.kick(14);
    this.scoreLevel(1, e);
    speak('יום הולדת שמח!', { music: this.game.music });
    this.playSong();
    for (let i = 0; i < 4; i++) {
      this.sched.in(0.6 + i * 0.9, () => this.p.confetti(rand(e.w * 0.15, e.w * 0.85), e.h * 0.3, CONFETTI, 28, e.min * 0.9));
    }
  }

  playSong() {
    const bus = this.audio;
    if (!bus.ctx) return;
    this.game.music.stop();
    const beat = 0.4;
    let tt = bus.ctx.currentTime + 1.4;
    for (const [n, b] of SONG) {
      bus.note('piano', n, { vol: 0.55, when: tt, dur: b * beat * 0.95, verb: 0.5 });
      bus.note('xylophone', n, { vol: 0.25, when: tt, verb: 0.5 });
      tt += b * beat;
    }
    this.songEnd = (tt - bus.ctx.currentTime) + 0.8;
  }

  // --- frame ------------------------------------------------------------------------

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.guestJoy.update(dt);
    this.emiJoy.update(dt);
    for (const c of this.choices) {
      c.press.update(dt);
      c.delay -= dt;
      if (c.delay <= 0 && c.pop.target === 0) c.pop.to(1);
      c.pop.update(dt);
    }
    for (const t of this.tiers) {
      t.drop.update(dt);
      if (this.icing && t.icing < 1) t.icing = Math.min(1, t.icing + dt * 0.9);
    }
    for (const it of this.items) it.pop.update(dt);
    for (const s of this.sprinkles) {
      if (s.fall > 0) s.fall -= dt;
      else s.k = Math.min(1, s.k + dt * 3.5);
    }
    for (const c of this.candles) c.grow.update(dt);
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.k += dt * 2.6;
      if (f.k >= 1) {
        this.flying.splice(i, 1);
        this.land(f, e);
      }
    }
    if (this.step === 'party') {
      this.doneT += dt;
      if (Math.random() < dt * 3) this.p.sparkle(rand(e.w), rand(e.h * 0.6), ['#fff', C.yellow, C.pink], 5, e.min * 0.08);
      if (this.doneT > (this.songEnd || 6) + 0.5) {
        this.game.music.play('play');
        this.reset();
        speak('עוד עוגה?', { music: this.game.music });
      }
    }
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    const W = this.W;

    if (this.step === 'party') {
      rays(g, this.cx, this.topOfCake().y, e.max * 0.6, t, 'rgba(255,255,255,0.28)', 16);
    }

    // plate
    g.fillStyle = 'rgba(90,40,60,0.16)';
    g.beginPath();
    g.ellipse(this.cx, this.plateY + W * 0.05, W * 0.7, W * 0.075, 0, 0, TAU);
    g.fill();
    g.fillStyle = radial(g, this.cx - W * 0.2, this.plateY - W * 0.05, W, ['#ffffff', '#f4f1ff', '#d9d3f0']);
    g.beginPath();
    g.ellipse(this.cx, this.plateY + W * 0.01, W * 0.66, W * 0.07, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(180,170,220,0.4)';
    g.beginPath();
    g.ellipse(this.cx, this.plateY + W * 0.035, W * 0.6, W * 0.03, 0, 0, Math.PI);
    g.fill();

    // guest and Emi at either side of the table
    const side = Math.min(e.w * 0.36, W * 0.95);
    const gs = e.min * 0.1 * (1 + this.guestJoy.value * 0.02);
    g.save();
    g.translate(this.cx + side, this.plateY - gs * 0.95 - Math.max(0, this.guestJoy.value) * gs * 0.08);
    g.scale(gs, gs);
    this.guest.draw(g, t, clamp(0.3 + this.guestJoy.value * 0.1, 0, 1), 7);
    g.restore();
    g.save();
    g.translate(this.cx - side, this.plateY - this.emiS * EMI_FEET - Math.max(0, this.emiJoy.value) * this.emiS * 0.08);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.step === 'party' ? 1 : 0.3, { wave: this.step === 'party' ? 1 : 0.2 });
    g.restore();

    // tiers, bottom up
    for (let i = 0; i < this.tiers.length; i++) {
      const tr = this.tiers[i];
      const r = this.tierRect(i);
      const dy = tr.drop.value * e.h * 0.8;
      g.save();
      g.translate(this.cx, r.y + r.h + dy);
      const squash = 1 + clamp(-tr.drop.vel * 0.002, -0.08, 0.08);
      g.scale(1 / squash, squash);
      drawTier(g, r.w, r.h, this.sponge, null, t, i);
      if (this.icing && tr.icing > 0) {
        g.save();
        g.beginPath();
        g.rect(-r.w, -r.h * 1.1, r.w * 2, r.h * (0.1 + 0.62 * ease.outCubic(tr.icing)));
        g.clip();
        drawTier(g, r.w, r.h, this.sponge, this.icing, t, i);
        g.restore();
      }
      // sprinkles on this tier
      for (const s of this.sprinkles) {
        if (s.ti !== i || s.k <= 0) continue;
        const sx = -r.w / 2 + s.u * r.w;
        const sy = -r.h + s.v * r.h - (1 - s.k) * r.h * 1.5;
        sprinkle(g, sx, sy, W * 0.035, s.rot, s.c);
      }
      g.restore();
    }

    // toppings
    const ts = W * 0.095;
    for (const it of this.items) {
      g.save();
      g.translate(it.x, it.y);
      g.rotate(it.rot + Math.sin(t * 2 + it.x) * 0.04);
      const s = ts * it.top.size * it.pop.value;
      g.scale(s, s);
      it.top.draw(g);
      g.restore();
    }

    // candles
    for (const c of this.candles) {
      const k = c.grow.value;
      if (k <= 0.01) continue;
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, k);
      drawCandle(g, c.h, c.col, c.lit, t, c.x);
      g.restore();
      if (c.lit > 0.5 && this.idle > 2) {
        glow(g, c.x, c.y - c.h * 1.2, c.h * (0.9 + Math.sin(t * 5) * 0.15), '#ffe9a0', 0.4);
      }
    }

    // toppings in flight
    for (const f of this.flying) {
      const k = ease.inOutQuad(f.k);
      const x = lerp(f.fx, f.tx, k);
      const y = lerp(f.fy, f.ty, k) - Math.sin(k * Math.PI) * e.min * 0.15;
      g.save();
      g.translate(x, y);
      g.rotate(k * TAU);
      const s = ts * f.top.size * (1.3 - k * 0.3);
      g.scale(s, s);
      f.top.draw(g);
      g.restore();
    }

    this.drawTray(g, e);

    // a topping being dragged rides under her finger
    for (const p of e.pointers.values()) {
      const d = p.data?.drag;
      if (!d || p.moved < 18) continue;
      g.save();
      g.translate(p.x, p.y - e.min * 0.04);
      const s = ts * d.v.size * 1.3;
      g.scale(s, s);
      d.v.draw(g);
      g.restore();
    }

    if (this.step === 'party' && !(this.levels.justLeveled > 0)) {
      const fs = Math.max(30, e.min * 0.1);
      label(g, 'יום הולדת שמח!', e.w / 2, (e.topBand || 60) + fs * 0.9, fs, '#ff5fa2', { stroke: '#fff', sw: fs * 0.26 });
    }

    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawTray(g, e) {
    if (!this.choices.length) return;
    const t = this.t;
    const pulse = this.attractPulse();
    const first = this.choices[0];
    const last = this.choices[this.choices.length - 1];
    const pad = first.r * 0.5;
    card(g, last.x - first.r - pad, first.y - first.r - pad, first.x - last.x + (first.r + pad) * 2, (first.r + pad) * 2, first.r * 0.7,
      { fill: 'rgba(255,255,255,0.75)' });
    this.choices.forEach((c, i) => {
      const pop = ease.outBack(clamp(c.pop.value, 0, 1.2));
      if (pop <= 0.01) return;
      const wig = pulse * Math.sin(t * 8 + i) * 0.08;
      const r = c.r * pop * (1 - c.press.value * 0.1) * (1 + pulse * 0.06);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(wig);
      if (c.kind === 'sponge') {
        g.save();
        g.translate(0, r * 0.45);
        drawTier(g, r * 1.6, r * 0.9, c.v.c, '#fff6ec', t, i + 3);
        g.fillStyle = '#ff3d55';
        circle(g, 0, -r * 1.0, r * 0.16);
        g.fill();
        g.restore();
      } else if (c.kind === 'icing') {
        // a little bowl of icing
        g.fillStyle = radial(g, -r * 0.3, -r * 0.3, r * 1.6, [lighten(c.v.c, 0.3), c.v.c, darken(c.v.c, 0.15)]);
        g.beginPath();
        g.ellipse(0, -r * 0.1, r * 0.8, r * 0.35, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.arc(0, -r * 0.3, r * 0.45, Math.PI, 0);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(-r * 0.9, 0);
        g.quadraticCurveTo(-r * 0.8, r * 0.8, 0, r * 0.8);
        g.quadraticCurveTo(r * 0.8, r * 0.8, r * 0.9, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = '#d9d3f0';
        g.lineWidth = r * 0.06;
        g.stroke();
      } else if (c.kind === 'sprinkles') {
        g.fillStyle = radial(g, -r * 0.2, -r * 0.3, r * 1.4, ['#ffffff', '#f0f4ff', '#c9d4f0']);
        roundRect(g, -r * 0.45, -r * 0.55, r * 0.9, r * 1.2, r * 0.2);
        g.fill();
        g.fillStyle = '#ff85c8';
        roundRect(g, -r * 0.48, -r * 0.78, r * 0.96, r * 0.3, r * 0.12);
        g.fill();
        for (let k = 0; k < 8; k++) sprinkle(g, -r * 0.28 + (k % 3) * r * 0.28, -r * 0.2 + Math.floor(k / 3) * r * 0.3, r * 0.22, k, SPRINKLE_COLORS[k % 7]);
      } else {
        const s = r * 0.62 * c.v.size;
        g.scale(s, s);
        c.v.draw(g);
      }
      g.restore();
    });
  }
}
