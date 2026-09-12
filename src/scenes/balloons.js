// Balloons.
//
// The simplest possible loop and the one that hooks a two year old first: things
// float up, you touch them, they burst. No aiming, no timing, no way to lose.
//
// The depth comes from what the popping does. Notes climb a pentatonic scale as
// she keeps up a streak, so a run of pops plays a little tune; every so often a
// golden balloon carries a sticker; and after enough pops the sky fills with a
// shower of them.

import { TAU, Spring, rand, randInt, pick, clamp, ease } from '../core/util.js';
import { C, SKIES, CONFETTI } from '../core/palette.js';
import {
  circle, label, sun, cloud, radial, lighten, darken, star as starPath, groundShadow,
  grassTufts, quadY, alpha,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { drawEmi, LAND, EMI_FEET } from '../core/creatures.js';
import { collect } from '../core/state.js';

const NOTES = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];
const COLORS = [C.red, C.orange, C.yellow, C.lime, C.green, C.teal, C.sky, C.blue, C.indigo, C.purple, C.pink, C.magenta];

class Balloon {
  constructor(e, opts = {}) {
    this.reset(e, opts);
  }
  reset(e, opts = {}) {
    this.r = e.min * rand(0.075, 0.115) * (opts.big ? 1.35 : 1);
    this.x = opts.x ?? rand(this.r * 1.3, e.w - this.r * 1.3);
    this.y = opts.y ?? e.h + this.r * rand(1.2, 3.5);
    this.vy = -e.min * rand(0.055, 0.1) * (opts.fast ? 1.5 : 1) * (opts.rise || 1);
    this.ph = rand(10);
    this.sway = rand(0.4, 1.1);
    this.golden = opts.golden || false;
    this.color = this.golden ? C.yellow : pick(COLORS);
    this.pop = 0;             // >0 once burst, drives the burst animation
    this.dead = false;
    this.squash = new Spring(1, 260, 14);
    this.rot = rand(-0.1, 0.1);
    this.face = opts.golden ? null : (Math.random() < 0.25 ? randInt(0, LAND.length - 1) : null);
  }
  update(dt, e) {
    if (this.pop > 0) {
      this.pop += dt * 5;
      if (this.pop > 1) this.dead = true;
      return;
    }
    this.y += this.vy * dt;
    this.x += Math.sin(this.ph + performance.now() * 0.0009 * this.sway) * e.min * 0.05 * dt * 6;
    this.x = clamp(this.x, this.r, e.w - this.r);
    this.squash.update(dt);
    if (this.y < -this.r * 3) this.dead = true;
  }
  draw(g, e, t) {
    const r = this.r;
    if (this.pop > 0) {
      // Burst: a quick expanding ring of shreds. Reads as a pop without needing
      // a sprite sheet.
      const k = ease.outQuad(clamp(this.pop, 0, 1));
      g.save();
      g.translate(this.x, this.y);
      g.globalAlpha = 1 - k;
      g.strokeStyle = this.color;
      g.lineWidth = r * 0.22 * (1 - k);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + this.ph;
        const d = r * (0.6 + k * 1.5);
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        g.stroke();
      }
      g.restore();
      g.globalAlpha = 1;
      return;
    }
    const sq = this.squash.value;
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot + Math.sin(t * 1.4 + this.ph) * 0.09);
    g.scale(1 / sq, sq);
    // Everything below is in unit space so the body gradient is cached per
    // colour instead of per balloon size.
    g.scale(r, r);

    // string
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = Math.max(1.2 / r, 0.055);
    g.beginPath();
    g.moveTo(0, 1.12);
    g.quadraticCurveTo(0.32 * Math.sin(t * 2 + this.ph), 1.9, 0, 2.6);
    g.stroke();

    if (this.golden) {
      g.save();
      g.globalAlpha = 0.5 + Math.sin(t * 6) * 0.25;
      g.fillStyle = C.yellow;
      circle(g, 0, 0, 1.35);
      g.fill();
      g.restore();
    }

    // body
    g.fillStyle = radial(g, -0.32, -0.42, 2.1, [
      lighten(this.color, 0.55), this.color, darken(this.color, 0.22),
    ]);
    g.beginPath();
    g.ellipse(0, 0, 0.88, 1, 0, 0, TAU);
    g.fill();
    // knot
    g.fillStyle = darken(this.color, 0.18);
    g.beginPath();
    g.moveTo(-0.13, 0.98);
    g.lineTo(0.13, 0.98);
    g.lineTo(0, 1.2);
    g.closePath();
    g.fill();
    // highlight
    g.save();
    g.globalAlpha = 0.6;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-0.3, -0.38, 0.22, 0.13, -0.5, 0, TAU);
    g.fill();
    g.restore();

    if (this.golden) {
      g.fillStyle = '#fff';
      starPath(g, 5, 0.42, 0.2, Math.sin(t * 2) * 0.3);
      g.fill();
    } else if (this.face !== null) {
      // Some balloons have an animal printed on them - a small surprise that
      // keeps the sky from being just coloured ovals.
      g.save();
      g.beginPath();
      g.ellipse(0, 0, 0.88, 1, 0, 0, TAU);
      g.clip();
      g.globalAlpha = 0.85;
      g.translate(0, 0.1);
      g.scale(0.5, 0.5);
      LAND[this.face].draw(g, t * 0.6 + this.ph, 0, this.face);
      g.restore();
    }
    g.restore();
  }
}

// Each level puts more in the sky, rising a little faster, with golden balloons
// turning up more often. Nothing gets harder to hit: the balloons stay the same
// size and a miss still costs nothing.
const TUNING = [
  { cap: 9, rise: 1.0, gap: [0.45, 1.10], golden: 0.09 },
  { cap: 12, rise: 1.15, gap: [0.38, 0.90], golden: 0.11 },
  { cap: 15, rise: 1.3, gap: [0.30, 0.75], golden: 0.13 },
  { cap: 18, rise: 1.45, gap: [0.24, 0.60], golden: 0.15 },
];

export class BalloonScene extends SceneBase {
  constructor(game) {
    super(game, {
      sky: SKIES.balloons, music: 'play', id: 'balloons', hue: C.red,
      goals: [8, 12, 16, 20],
    });
    this.tune = TUNING[0];
    this.balloons = [];
    this.spawnTimer = 0;
    this.popped = 0;
    this.showerAt = 12;
    this.shower = 0;
    this.birds = Array.from({ length: 3 }, () => ({ x: rand(1), y: rand(0.12, 0.3), v: rand(0.03, 0.06), ph: rand(10) }));
    this.emiCheer = new Spring(0, 160, 11);
    this.clouds = Array.from({ length: 4 }, () => ({ x: rand(1), y: rand(0.08, 0.3), s: rand(0.7, 1.2), v: rand(0.005, 0.012) }));
  }

  enter(e) {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.tune = this.levels.pick(TUNING);
    // Start with a few already in the air so the screen is never empty.
    for (let i = 0; i < 5; i++) {
      this.balloons.push(new Balloon(e, { y: e.h * rand(0.35, 1.05), rise: this.tune.rise }));
    }
  }

  onLevelUp(level, e) {
    this.tune = this.levels.pick(TUNING);
    // The new level arrives as a skyful rather than a number going up.
    this.startShower(e);
  }

  layout(e) {
    super.layout(e);
    this.groundY = e.h * 0.94;
    this.emiS = e.min * 0.07;
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    let hitOne = false;
    // Back to front, so the balloon drawn on top is the one that pops.
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.pop > 0) continue;
      const dx = (p.x - b.x) / (b.r * 1.02);
      const dy = (p.y - b.y) / (b.r * 1.16);
      if (dx * dx + dy * dy <= 1) {
        this.burst(b, e);
        hitOne = true;
        break;
      }
    }
    if (!hitOne) {
      // A miss still does something: a puff of cloud and a soft note.
      this.p.puff(p.x, p.y, 'rgba(255,255,255,0.6)', 6);
      this.audio.play('tap', { vol: 0.25, rate: rand(0.9, 1.3) });
    }
  }

  onUp(p) {
    this.hud.onUp(p);
  }

  burst(b, e) {
    b.pop = 0.001;
    this.popped++;
    this.combo++;
    this.comboTimer = 1.8;

    const pitch = clamp(this.combo - 1, 0, NOTES.length - 1);
    this.audio.play('pop', { vol: 0.85, rate: rand(0.92, 1.12), throttle: 0 });
    this.audio.note('xylophone', NOTES[pitch], { vol: 0.7, pan: (b.x / e.w) * 1.4 - 0.7 });

    const set = b.golden ? [C.yellow, '#fff8c0', C.orange, '#fff'] : [b.color, lighten(b.color, 0.4), '#fff'];
    this.p.confetti(b.x, b.y, set, b.golden ? 44 : 20, e.min * (b.golden ? 1.0 : 0.65));
    this.p.sparkle(b.x, b.y, ['#fff', lighten(b.color, 0.5)], 10, e.min * 0.22);
    this.p.ring(b.x, b.y, alpha(b.color, 0.9), b.r * 1.1, 0.4);

    if (b.golden) {
      // Golden balloon: a sticker for the album plus the big flourish.
      const an = pick(LAND);
      collect(an.id);
      this.reward(b.x, b.y, { stars: 3, big: true, colors: [C.yellow, C.orange, '#fff8c0'] });
      this.audio.voice(an.voice);
      this.emiCheer.set(1);
      this.emiCheer.to(0);
      this.p.petals(b.x, b.y, [C.yellow, C.orange, '#fff'], 14);
    } else {
      if (this.combo > 0 && this.combo % 6 === 0) {
        this.reward(b.x, b.y, { stars: 1, colors: set });
        this.emiCheer.set(1);
        this.emiCheer.to(0);
      }
      // Nudge nearby balloons so a pop feels like it displaced air.
      for (const o of this.balloons) {
        if (o === b || o.pop > 0) continue;
        const d = Math.hypot(o.x - b.x, o.y - b.y);
        if (d < b.r * 4) {
          const f = (1 - d / (b.r * 4)) * e.min * 0.06;
          o.x += ((o.x - b.x) / (d || 1)) * f;
          o.squash.kick(-3);
        }
      }
    }

    if (this.scoreLevel(1, e)) return;   // a level-up throws its own shower

    if (this.popped === this.showerAt) {
      this.showerAt += 14;
      this.startShower(e);
    }
  }

  // Reward for sticking with it: the whole sky fills up at once.
  startShower(e) {
    this.shower = 1;
    this.audio.play('levelup', { throttle: 0 });
    this.audio.arp('harp', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], { step: 0.05, vol: 0.6 });
    for (let i = 0; i < 14; i++) {
      this.balloons.push(new Balloon(e, {
        x: rand(e.min * 0.1, e.w - e.min * 0.1),
        y: e.h + e.min * rand(0.1, 1.4),
        fast: true,
        rise: this.tune.rise,
      }));
    }
    this.p.confetti(e.cx, e.h * 0.5, CONFETTI, 60, e.min * 1.3);
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.emiCheer.update(dt);
    if (this.shower > 0) this.shower = Math.max(0, this.shower - dt * 0.5);

    this.spawnTimer -= dt;
    const cap = this.shower > 0 ? this.tune.cap + 14 : this.tune.cap;
    if (this.spawnTimer <= 0 && this.balloons.length < cap) {
      this.spawnTimer = rand(this.tune.gap[0], this.tune.gap[1]);
      // Golden balloons are rare enough to feel like luck, common enough that
      // she will see one in a short sitting.
      const golden = this.popped > 3 && Math.random() < this.tune.golden;
      this.balloons.push(new Balloon(e, { golden, big: golden, rise: this.tune.rise }));
    }

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.update(dt, e);
      if (b.dead) this.balloons.splice(i, 1);
    }
    this.birds.forEach((b) => {
      b.x += b.v * dt;
      if (b.x > 1.2) { b.x = -0.2; b.y = rand(0.1, 0.32); }
    });
    this.clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.3;
    });
  }

  paintBackdrop(g, e) {
    g.fillStyle = '#8ed36f';
    g.beginPath();
    g.moveTo(0, this.groundY);
    g.quadraticCurveTo(e.w * 0.5, this.groundY - e.h * 0.02, e.w, this.groundY);
    g.lineTo(e.w, e.h);
    g.lineTo(0, e.h);
    g.closePath();
    g.fill();
    const ridge = (x) => quadY(x / e.w, this.groundY, this.groundY - e.h * 0.02, this.groundY);
    grassTufts(g, e.w, Math.max(10, Math.round(e.w / 44)), 'rgba(86,166,66,0.55)', ridge, e.min * 0.03);
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    sun(g, e.w * 0.88, e.h * 0.1, e.min * 0.06, t);
    this.clouds.forEach((c) => {
      g.save();
      g.translate(c.x * e.w * 1.3 - e.w * 0.15, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      cloud(g, e.min * 0.28 * c.s, e.min * 0.075 * c.s, t + c.x * 7);
      g.fill();
      g.restore();
    });

    // birds: two arcs each, flapping
    this.birds.forEach((b) => {
      const x = b.x * e.w;
      const y = b.y * e.h + Math.sin(t * 1.6 + b.ph) * e.min * 0.02;
      const s = e.min * 0.022;
      const flap = Math.sin(t * 9 + b.ph) * 0.5;
      g.strokeStyle = 'rgba(70,60,90,0.55)';
      g.lineWidth = Math.max(1.5, s * 0.22);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - s, y + flap * s * 0.4);
      g.quadraticCurveTo(x - s * 0.4, y - s * 0.5 - flap * s * 0.3, x, y);
      g.quadraticCurveTo(x + s * 0.4, y - s * 0.5 - flap * s * 0.3, x + s, y + flap * s * 0.4);
      g.stroke();
    });

    this.balloons.forEach((b) => b.draw(g, e, t));

    // Emi on the grass, cheering after a good streak
    g.save();
    g.translate(e.w * 0.12, this.groundY + e.h * 0.02 - this.emiS * EMI_FEET);
    groundShadow(g, 0, 0, this.emiS * 0.6, 0.18);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.emiCheer.value, { wave: this.emiCheer.value });
    g.restore();

    this.p.draw(g);

    if (this.combo >= 3 && this.comboTimer > 0) {
      const a = clamp(this.comboTimer / 1.8, 0, 1);
      g.save();
      g.globalAlpha = a;
      const s = Math.max(20, e.min * 0.07) * (1 + (1 - a) * 0.25);
      label(g, `${this.combo}!`, e.w / 2, e.h * 0.24, s, C.magentaDark, { stroke: '#fff', sw: s * 0.22 });
      g.restore();
    }

    if (this.idle > 5 && this.balloons.length) {
      // Point at a balloon she has not touched.
      const b = this.balloons[0];
      const pulse = this.attractPulse(1.6);
      g.save();
      g.globalAlpha = 0.35 + pulse * 0.5;
      g.strokeStyle = '#fff';
      g.lineWidth = e.min * 0.012;
      circle(g, b.x, b.y, b.r * (1.25 + pulse * 0.18));
      g.stroke();
      g.restore();
    }

    this.drawHud(g, e);
  }
}
