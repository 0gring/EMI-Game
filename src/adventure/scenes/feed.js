// Hungry animals: counting by feeding.
//
// An animal arrives hungry and shows how many it wants - a big number and that
// many empty plates in a speech bubble. Every food she taps flies into its
// mouth, fills a plate, and is counted out loud: "אחת... שתיים... שלוש!" When
// the plates are full the animal does a happy dance and the next one walks in.
//
// The count can never go wrong: once it is full the animal just pats its tummy
// and the food stays put. The numbers grow with the levels, from one-to-three
// up to ten.

import { TAU, Spring, rand, randInt, pick, clamp, ease, lerp, shuffled, Schedule } from '../../core/util.js';
import { C } from '../../core/palette.js';
import { circle, label, roundRect, groundShadow, verticalGradient, hill, cloud, sun } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { byId } from '../../core/creatures.js';
import { FOODS, glow, card } from '../art.js';
import { speak, NUMBERS } from '../speech.js';

const SKY = ['#9fe0ff', '#d4f4ff', '#f4ffe6'];

const DINERS = [
  { id: 'bunny', food: 'carrot' },
  { id: 'monkey', food: 'banana' },
  { id: 'elephant', food: 'apple' },
  { id: 'penguin', food: 'fish' },
  { id: 'dog', food: 'bone' },
  { id: 'pig', food: 'strawberry' },
  { id: 'cat', food: 'fish' },
  { id: 'cow', food: 'apple' },
  { id: 'sheep', food: 'grapes' },
  { id: 'duck', food: 'cherries' },
];

const TUNING = [
  { min: 1, max: 3 },
  { min: 2, max: 5 },
  { min: 3, max: 7 },
  { min: 4, max: 10 },
];

export class FeedScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'play', id: 'feed', hue: '#3fbf5f', goals: [3, 3, 4, 4] });
    this.sched = new Schedule();
    this.deck = shuffled(DINERS);
    this.round = 0;
    this.joy = new Spring(0, 160, 9);
    this.chew = 0;
    this.newDiner();
  }

  newDiner() {
    this.tune = this.levels.pick(TUNING);
    const d = this.deck[this.round % this.deck.length];
    this.round++;
    this.diner = { ...d, a: byId(d.id) };
    let want = randInt(this.tune.min, this.tune.max);
    if (want === this.want) want = clamp(want + 1, this.tune.min, this.tune.max);
    this.want = want;
    this.fed = 0;
    this.full = false;
    this.walk = 0;            // 0 offstage -> 1 in place
    this.leaving = 0;
    this.flying = [];
    this.plates = Array.from({ length: want }, () => ({ fill: new Spring(0, 260, 12) }));
    const n = Math.min(12, want + 3);
    this.foods = Array.from({ length: n }, (_, i) => ({
      i, gone: false, pop: new Spring(0, 160, 10), press: new Spring(0, 300, 16), x: 0, y: 0, rot: rand(-0.3, 0.3),
    }));
    this.foods.forEach((f, i) => this.sched.in(0.4 + i * 0.05, () => f.pop.to(1)));
    this.bubble = new Spring(0, 170, 12);
    this.sched.in(0.9, () => {
      this.bubble.to(1);
      this.audio.voice(this.diner.a.voice);
      speak(`${this.diner.a.name} רעב! ${NUMBERS[want]}`, { music: this.game.music });
    });
    if (this.game.engine.w) this.layout(this.game.engine);
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
  }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    const top = (e.topBand || 0);
    this.groundY = e.h * (P ? 0.5 : 0.76);
    this.aS = e.min * (P ? 0.15 : 0.14);
    this.ax = P ? e.w * 0.5 : e.w * 0.3;
    this.ay = this.groundY - this.aS * 1.0;
    // Bubble with the plates sits above the animal.
    const n = this.want;
    this.plateR = clamp(Math.min(e.min * 0.045, (P ? e.w * 0.8 : e.w * 0.42) / Math.min(n, 5) / 2.6), 14, 40);
    const perRow = Math.min(n, 5);
    this.bub = {
      x: P ? e.w * 0.5 : this.ax,
      y: 0,
      w: perRow * this.plateR * 2.5 + this.plateR * 4.4,
      h: (n > 5 ? 2 : 1) * this.plateR * 2.5 + this.plateR * 1.4,
    };
    // above the head (creatures reach about 1.4 units above their origin),
    // with room for the bubble's tail
    this.bub.y = Math.max(top + this.bub.h / 2 + e.min * 0.02, this.ay - this.aS * 1.7 - this.plateR * 1.2 - this.bub.h / 2);
    this.plates.forEach((p, i) => {
      const row = i < 5 ? 0 : 1;
      const inRow = row ? n - 5 : perRow;
      const col = row ? i - 5 : i;
      p.x = this.bub.x + this.plateR * 1.6 + ((inRow - 1) / 2 - col) * this.plateR * 2.5 - this.plateR * 1.2;
      p.y = this.bub.y + (n > 5 ? (row - 0.5) * this.plateR * 2.5 : 0);
    });
    this.numX = this.bub.x - this.bub.w / 2 + this.plateR * 1.6;
    // Food on a picnic blanket: on the right in landscape, below in portrait.
    const region = P
      ? { x: e.w * 0.08, y: this.groundY + e.min * 0.06, w: e.w * 0.84, h: e.h - this.groundY - e.min * 0.12 }
      : { x: e.w * 0.56, y: e.h * 0.32, w: e.w * 0.38, h: e.h * 0.6 };
    this.blanket = region;
    const m = this.foods.length;
    const cols = Math.ceil(Math.sqrt(m * (region.w / region.h)));
    const rows = Math.ceil(m / cols);
    this.foodR = Math.min(region.w / cols, region.h / rows, e.min * 0.25) * 0.42;
    this.foods.forEach((f, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, m - r * cols);
      f.x = region.x + region.w / 2 + ((inRow - 1) / 2 - c) * (region.w / cols);
      f.y = region.y + (r + 0.5) * (region.h / rows);
    });
  }

  paintBackdrop(g, e) {
    sun(g, e.w * 0.88, e.h * 0.12, e.min * 0.06, 0);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, s] of [[0.2, 0.14, 1], [0.6, 0.1, 0.8]]) {
      g.save();
      g.translate(e.w * x, e.h * y);
      cloud(g, e.min * 0.2 * s, e.min * 0.05 * s, x * 5);
      g.fill();
      g.restore();
    }
    hill(g, e.w * 0.2, this.groundY, e.w * 0.9, e.h * 0.12, '#a8e07a');
    hill(g, e.w * 0.85, this.groundY, e.w * 0.7, e.h * 0.09, '#8fd468');
    g.fillStyle = verticalGradient(g, this.groundY, e.h, ['#8fd468', '#6fc256', '#5aae47']);
    g.fillRect(0, this.groundY, e.w, e.h - this.groundY);
    // picnic blanket
    const b = this.blanket;
    const pad = this.foodR * 0.5;
    g.save();
    g.fillStyle = 'rgba(40,80,20,0.18)';
    roundRect(g, b.x - pad, b.y - pad + pad * 0.4, b.w + pad * 2, b.h + pad * 2, pad);
    g.fill();
    g.fillStyle = '#fff4f4';
    roundRect(g, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, pad);
    g.fill();
    g.clip();
    const cell = Math.max(16, this.foodR * 0.7);
    g.fillStyle = 'rgba(255,93,122,0.35)';
    for (let x = b.x - pad; x < b.x + b.w + pad; x += cell * 2) g.fillRect(x, b.y - pad, cell, b.h + pad * 2);
    for (let y = b.y - pad; y < b.y + b.h + pad; y += cell * 2) g.fillRect(b.x - pad, y, b.w + pad * 2, cell);
    g.restore();
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    for (const f of this.foods) {
      if (f.gone || f.pop.value < 0.5) continue;
      if (Math.hypot(p.x - f.x, p.y - f.y) < this.foodR * 1.3) {
        this.give(f, e);
        return;
      }
    }
    if (Math.hypot(p.x - this.ax, p.y - this.ay) < this.aS * 1.1) {
      this.joy.kick(8);
      this.audio.voice(this.diner.a.voice);
      speak(this.diner.a.name, { music: this.game.music });
      return;
    }
    this.p.sparkle(p.x, p.y, ['#fff', C.yellow], 6, e.min * 0.08);
  }

  give(f, e) {
    if (this.full || this.walk < 0.9) {
      f.press.kick(-10);
      this.audio.play('boing', { vol: 0.4 });
      return;
    }
    f.gone = true;
    this.fed++;
    const n = this.fed;
    this.flying.push({ x0: f.x, y0: f.y, k: 0, n });
    this.audio.play('swipe', { vol: 0.6 });
    if (n >= this.want) this.full = true;
  }

  eat(fl, e) {
    const n = fl.n;
    this.chew = 0.5;
    this.joy.kick(6);
    this.audio.play('pop', { vol: 0.7 });
    this.audio.note('xylophone', ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'][n - 1], { vol: 0.6 });
    const pl = this.plates[n - 1];
    pl.fill.set(0.3);
    pl.fill.to(1);
    this.p.sparkle(pl.x, pl.y, ['#fff', C.yellow], 8, this.plateR * 1.5);
    this.game.magic?.burst(pl.x, pl.y, { n: 14, power: 0.35 });
    this.bigNum = { n, t: 0 };
    speak(NUMBERS[n], { music: this.game.music, rate: 0.9 });
    if (n >= this.want) {
      this.sched.in(0.8, () => this.happy(e));
    }
  }

  happy(e) {
    this.joy.kick(18);
    this.audio.voice(this.diner.a.voice);
    this.reward(this.ax, this.ay - this.aS * 0.5, { stars: 1, big: this.want >= 5 });
    speak(`${NUMBERS[this.want]}! תודה!`, { music: this.game.music });
    for (let i = 0; i < 6; i++) {
      this.p.spawn('heart', this.ax + rand(-this.aS, this.aS) * 0.6, this.ay - this.aS * 0.6, {
        vx: rand(-40, 40), vy: -rand(80, 160), g: -20, life: rand(1.2, 2), size: rand(10, 20), color: pick([C.pink, C.red, C.magenta]),
      });
    }
    this.scoreLevel(1, e);
    this.sched.in(2.4, () => { this.leaving = 0.001; this.audio.play('swipe', { vol: 0.5 }); });
    this.sched.in(3.3, () => this.newDiner());
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.joy.update(dt);
    this.bubble.update(dt);
    if (this.chew > 0) this.chew -= dt;
    if (this.walk < 1) this.walk = Math.min(1, this.walk + dt * 1.4);
    if (this.leaving > 0) this.leaving = Math.min(1, this.leaving + dt * 1.6);
    for (const f of this.foods) { f.pop.update(dt); f.press.update(dt); }
    for (const p of this.plates) p.fill.update(dt);
    if (this.bigNum) {
      this.bigNum.t += dt;
      if (this.bigNum.t > 1.1) this.bigNum = null;
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const fl = this.flying[i];
      fl.k += dt * 2.4;
      if (fl.k >= 1) {
        this.flying.splice(i, 1);
        this.eat(fl, e);
      }
    }
  }

  dinerPos(e) {
    const inX = (1 - ease.outCubic(this.walk)) * -e.w * 0.6;
    const outX = ease.inCubic(this.leaving) * -e.w * 0.7;
    const hop = Math.abs(Math.sin((this.walk < 1 ? this.walk : this.leaving) * Math.PI * 4)) * this.aS * 0.25 * (this.walk < 1 || this.leaving > 0 ? 1 : 0);
    const dance = this.full && this.leaving === 0 ? Math.abs(Math.sin(this.t * 7)) * this.aS * 0.12 : 0;
    return { x: this.ax + inX + outX, y: this.ay - hop - dance };
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    const pos = this.dinerPos(e);
    const s = this.aS;
    const food = FOODS[this.diner.food];

    // diner
    groundShadow(g, pos.x, this.groundY - s * 0.02, s * 0.85, 0.2);
    g.save();
    g.translate(pos.x, pos.y);
    const sq = this.chew > 0 ? 1 + Math.sin(this.chew * 40) * 0.04 : 1;
    g.scale(s * (2 - sq), s * sq);
    if (this.full && this.leaving === 0) g.rotate(Math.sin(t * 7) * 0.08);
    const excited = this.flying.length ? 0.9 : this.full ? 0.9 : clamp(0.2 + this.joy.value * 0.08, 0, 1);
    this.diner.a.draw(g, t, excited, 3);
    g.restore();

    // speech bubble with the plates
    const bp = ease.outBack(clamp(this.bubble.value, 0, 1.2)) * (this.leaving > 0 ? 1 - this.leaving : 1);
    if (bp > 0.01) {
      const B = this.bub;
      g.save();
      g.translate(B.x, B.y);
      g.scale(bp, bp);
      g.translate(-B.x, -B.y);
      card(g, B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, this.plateR * 0.9, { fill: '#ffffff' });
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(B.x - this.plateR * 0.6, B.y + B.h / 2 - 1);
      g.lineTo(B.x + this.plateR * 0.6, B.y + B.h / 2 - 1);
      g.lineTo(B.x + this.plateR * 0.1, B.y + B.h / 2 + this.plateR * 1.1);
      g.closePath();
      g.fill();
      // the wanted number
      const fsN = this.plateR * 2.2;
      label(g, String(this.want), this.numX, B.y + fsN * 0.05, fsN, '#2f9e5c', { stroke: '#e8ffe0', sw: fsN * 0.16 });
      for (const pl of this.plates) {
        const f = pl.fill.value;
        g.fillStyle = '#eef3ff';
        circle(g, pl.x, pl.y, this.plateR);
        g.fill();
        g.strokeStyle = 'rgba(120,140,200,0.4)';
        g.lineWidth = this.plateR * 0.12;
        g.setLineDash(f > 0.05 ? [] : [this.plateR * 0.3, this.plateR * 0.2]);
        circle(g, pl.x, pl.y, this.plateR * 0.94);
        g.stroke();
        g.setLineDash([]);
        if (f > 0.02) {
          g.save();
          g.translate(pl.x, pl.y);
          g.scale(this.plateR * 0.75 * f, this.plateR * 0.75 * f);
          food(g);
          g.restore();
        }
      }
      g.restore();
    }

    // food on the blanket
    const pulse = this.attractPulse(1.6);
    for (const f of this.foods) {
      if (f.gone) continue;
      const pop = ease.outBack(clamp(f.pop.value, 0, 1.2));
      if (pop <= 0.01) continue;
      g.save();
      g.translate(f.x, f.y + Math.sin(t * 2 + f.i) * this.foodR * 0.04);
      g.rotate(f.rot + pulse * Math.sin(t * 10 + f.i) * 0.1 + f.press.value * 0.2);
      const r = this.foodR * pop;
      g.fillStyle = 'rgba(80,40,20,0.12)';
      g.beginPath();
      g.ellipse(0, r * 0.85, r * 0.7, r * 0.18, 0, 0, TAU);
      g.fill();
      g.scale(r, r);
      food(g);
      g.restore();
    }

    // food in flight to the mouth
    for (const fl of this.flying) {
      const k = ease.inOutQuad(fl.k);
      const mx = pos.x, my = pos.y - s * 0.25;
      const x = lerp(fl.x0, mx, k);
      const y = lerp(fl.y0, my, k) - Math.sin(k * Math.PI) * e.min * 0.2;
      g.save();
      g.translate(x, y);
      g.rotate(k * TAU);
      const r = this.foodR * (1 - k * 0.6);
      g.scale(r, r);
      food(g);
      g.restore();
    }

    // the count, big and bright, for a moment after each bite
    if (this.bigNum) {
      const k = this.bigNum.t / 1.1;
      const sc = ease.outBack(clamp(k * 4, 0, 1)) * (1 - clamp((k - 0.7) / 0.3, 0, 1));
      const fs = e.min * 0.2;
      g.save();
      g.translate(pos.x + s * 1.3, pos.y - s * 0.9);
      g.scale(sc, sc);
      glow(g, 0, 0, fs, '#fff3a0', 0.6);
      label(g, String(this.bigNum.n), 0, 0, fs, '#ff7a1f', { stroke: '#fff', sw: fs * 0.18 });
      g.restore();
    }

    this.p.draw(g);
    this.drawHud(g, e);
  }
}
