// The magic garden: plant, water, watch it grow.
//
// Touch bare soil and a seed goes in. Touch a planted spot and the watering can
// tips over it, and the plant grows a stage: seed, sprout, bud, flower. The rain
// cloud waters everything at once, which is the big satisfying button. Every
// flower that opens is named with its colour, and brings a visitor - a
// butterfly or a bee - that flutters around it.
//
// A garden in full bloom is the goal: a rainbow comes out, everything sparkles,
// and a fresh bed is dug for the next one. More beds and more kinds of flower
// unlock with the levels, up to glowing star-flowers.

import { TAU, Spring, rand, pick, clamp, ease, lerp, Schedule } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, radial, lighten, darken, roundRect, verticalGradient, hill, sun, cloud, rainbow, groundShadow } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { byId, drawEmi, EMI_FEET } from '../../core/creatures.js';
import { drawBloom, PAINTS, glow, rays } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#8fd3ff', '#c4ecff', '#f1fbff'];
const STAGES = 4;   // 1 seed, 2 sprout, 3 bud, 4 flower

const TUNING = [
  { plots: 3, kinds: ['daisy', 'tulip'] },
  { plots: 4, kinds: ['daisy', 'tulip', 'sunflower'] },
  { plots: 5, kinds: ['daisy', 'tulip', 'sunflower', 'rose'] },
  { plots: 6, kinds: ['tulip', 'sunflower', 'rose', 'magic', 'daisy'] },
];

const FLOWER_COLORS = PAINTS.filter((p) => ['אדום', 'כתום', 'צהוב', 'כחול', 'סגול', 'ורוד', 'לבן'].includes(p.name));

function drawButterfly(g, t, color, ph) {
  const flap = Math.abs(Math.sin(t * 14 + ph));
  g.save();
  for (const sd of [-1, 1]) {
    g.save();
    g.scale(sd * (0.25 + flap * 0.75), 1);
    g.fillStyle = radial(g, 0.3, -0.3, 1, [lighten(color, 0.4), color, darken(color, 0.2)]);
    g.beginPath();
    g.ellipse(0.42, -0.28, 0.45, 0.36, -0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(0.3, 0.3, 0.3, 0.26, 0.5, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    circle(g, 0.48, -0.3, 0.1);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#4a3b52';
  g.beginPath();
  g.ellipse(0, 0, 0.08, 0.38, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#4a3b52';
  g.lineWidth = 0.04;
  g.beginPath();
  g.moveTo(-0.03, -0.34);
  g.quadraticCurveTo(-0.12, -0.6, -0.2, -0.62);
  g.moveTo(0.03, -0.34);
  g.quadraticCurveTo(0.12, -0.6, 0.2, -0.62);
  g.stroke();
  g.restore();
}

export class GardenScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'calm', id: 'garden', hue: '#f2b81f', goals: [1, 2, 2, 2] });
    this.sched = new Schedule();
    this.bee = byId('bee');
    this.can = { x: 0, y: 0, tilt: new Spring(0, 160, 12), show: 0, target: null };
    this.rain = 0;
    this.cloudPress = new Spring(0, 260, 14);
    this.sunPress = new Spring(0, 200, 10);
    this.emiJoy = new Spring(0, 160, 10);
    this.newGarden();
  }

  newGarden() {
    this.tune = this.levels.pick(TUNING);
    this.plots = Array.from({ length: this.tune.plots }, (_, i) => ({
      i, stage: 0, grow: new Spring(0, 150, 9), kind: pick(this.tune.kinds), col: pick(FLOWER_COLORS),
      x: 0, y: 0, wobble: new Spring(0, 200, 8),
    }));
    this.visitors = [];
    this.done = false;
    this.doneT = 0;
    this.rainbowK = 0;
    if (this.game.engine.w) this.layout(this.game.engine);
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.sched.in(0.5, () => speak('בואי נשתול פרחים', { music: this.game.music }));
  }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    const n = this.plots.length;
    this.groundY = e.h * (P ? 0.42 : 0.5);
    const rows = P && n > 3 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    this.pw = Math.min((e.w * 0.86) / perRow * 0.9, e.min * 0.24);
    this.plantH = this.pw * 1.25;
    this.plots.forEach((p, i) => {
      const r = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - r * perRow);
      const c = i % perRow;
      p.x = e.w / 2 + ((inRow - 1) / 2 - c) * (e.w * 0.86) / perRow;
      p.y = rows === 1 ? e.h * (P ? 0.78 : 0.82) : e.h * (0.68 + r * 0.2);
    });
    this.cloudX = e.w * (P ? 0.32 : 0.3);
    this.cloudY = (e.topBand || 0) + e.min * 0.1;
    this.cloudW = e.min * 0.2;
    this.sunX = e.w * 0.75;
    this.sunY = (e.topBand || 0) + e.min * 0.08;
    this.emiS = e.min * 0.085;
    this.emiX = P ? e.w * 0.85 : e.w * 0.92;
  }

  paintBackdrop(g, e) {
    hill(g, e.w * 0.15, this.groundY, e.w * 0.8, e.h * 0.12, '#b5e88a');
    hill(g, e.w * 0.75, this.groundY, e.w * 0.9, e.h * 0.15, '#9edc76');
    g.fillStyle = verticalGradient(g, this.groundY, e.h, ['#8fd468', '#74c757', '#5db546']);
    g.fillRect(0, this.groundY, e.w, e.h - this.groundY);
    // white picket fence along the horizon
    const fy = this.groundY + e.min * 0.01;
    const step = Math.max(18, e.min * 0.045);
    g.fillStyle = '#ffffff';
    g.fillRect(0, fy - step * 0.9, e.w, step * 0.16);
    g.fillRect(0, fy - step * 0.45, e.w, step * 0.16);
    for (let x = step * 0.3; x < e.w; x += step) {
      g.beginPath();
      g.moveTo(x, fy);
      g.lineTo(x, fy - step * 1.1);
      g.lineTo(x + step * 0.2, fy - step * 1.35);
      g.lineTo(x + step * 0.4, fy - step * 1.1);
      g.lineTo(x + step * 0.4, fy);
      g.closePath();
      g.fill();
    }
    // grass tufts
    g.fillStyle = 'rgba(60,140,40,0.35)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97) % 100) / 100 * e.w;
      const y = this.groundY + e.min * 0.05 + ((i * 53) % 100) / 100 * (e.h - this.groundY - e.min * 0.05);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3, y - 10);
      g.lineTo(x + 6, y);
      g.fill();
    }
    // soil beds
    for (const p of this.plots) {
      g.fillStyle = 'rgba(60,30,10,0.2)';
      g.beginPath();
      g.ellipse(p.x, p.y + this.pw * 0.06, this.pw * 0.44, this.pw * 0.15, 0, 0, TAU);
      g.fill();
      g.fillStyle = radial(g, p.x - this.pw * 0.1, p.y - this.pw * 0.05, this.pw * 0.5, ['#a0704a', '#7a4f2f', '#5e3a20']);
      g.beginPath();
      g.ellipse(p.x, p.y, this.pw * 0.42, this.pw * 0.13, 0, 0, TAU);
      g.fill();
    }
  }

  // --- input ----------------------------------------------------------------------

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (Math.hypot(p.x - this.cloudX, p.y - this.cloudY) < this.cloudW * 0.9) {
      this.makeRain(e);
      return;
    }
    if (Math.hypot(p.x - this.sunX, p.y - this.sunY) < e.min * 0.1) {
      this.sunPress.kick(12);
      this.audio.arp('harp', ['C6', 'E6', 'G6', 'C7'], { step: 0.05, vol: 0.4 });
      this.p.sparkle(this.sunX, this.sunY, ['#fff', C.yellow, '#ffe9a0'], 18, e.min * 0.2);
      speak('שמש', { music: this.game.music });
      return;
    }
    let best = null, bestD = Infinity;
    for (const pl of this.plots) {
      const top = pl.y - this.plantH * clamp(pl.stage / STAGES, 0.15, 1);
      const inX = Math.abs(p.x - pl.x) < this.pw * 0.5;
      const inY = p.y > top - this.pw * 0.35 && p.y < pl.y + this.pw * 0.3;
      if (inX && inY) {
        const d = Math.abs(p.x - pl.x);
        if (d < bestD) { best = pl; bestD = d; }
      }
    }
    if (best) {
      this.tend(best, e);
      return;
    }
    this.p.sparkle(p.x, p.y, ['#fff', C.lime], 6, e.min * 0.08);
  }

  tend(pl, e) {
    if (pl.stage === 0) {
      pl.stage = 1;
      pl.grow.set(0);
      pl.grow.to(1);
      this.audio.play('drop', { vol: 0.6 });
      this.audio.note('xylophone', 'C5', { vol: 0.4 });
      for (let i = 0; i < 4; i++) {
        this.p.spawn('drop', pl.x + rand(-8, 8), pl.y - this.pw * 0.6, { vy: rand(50, 120), g: 600, life: 0.45, size: 4, color: '#6b4226' });
      }
      return;
    }
    if (pl.stage >= STAGES) {
      // a grown flower just sways and shows off
      pl.wobble.kick(10);
      this.audio.note('harp', pick(['C6', 'E6', 'G6', 'A6']), { vol: 0.45 });
      this.p.petals(pl.x, pl.y - this.plantH, [pl.col.c, '#fff'], 4);
      speak(`פרח ${pl.col.name}`, { music: this.game.music });
      return;
    }
    // watering can tips over the plant
    this.can.target = pl;
    this.can.show = 1;
    this.can.x = pl.x + this.pw * 0.55;
    this.can.y = pl.y - this.plantH - this.pw * 0.2;
    this.can.tilt.set(0);
    this.can.tilt.to(1);
    this.audio.play('swipe', { vol: 0.5, rate: 1.2 });
    this.sched.in(0.25, () => this.water(pl, e, true));
  }

  water(pl, e, fromCan) {
    if (fromCan) {
      for (let i = 0; i < 12; i++) {
        this.p.spawn('drop', this.can.x - this.pw * 0.45 + rand(-5, 5), this.can.y + rand(-4, 4), {
          vx: rand(-40, 10), vy: rand(40, 120), g: 700, life: rand(0.4, 0.7), size: rand(3, 6), color: '#7ccfff',
        });
      }
    }
    this.sched.in(0.35, () => this.growUp(pl, e));
  }

  growUp(pl, e) {
    if (pl.stage === 0) pl.stage = 1;
    else if (pl.stage < STAGES) pl.stage++;
    else return;
    pl.grow.set(0.6);
    pl.grow.to(1);
    pl.wobble.kick(8);
    const notes = ['C5', 'E5', 'G5', 'C6'];
    this.audio.note('harp', notes[pl.stage - 1], { vol: 0.55 });
    this.audio.play('expand', { vol: 0.35 });
    if (pl.stage === STAGES) this.bloom(pl, e);
  }

  bloom(pl, e) {
    const top = pl.y - this.plantH;
    this.p.sparkle(pl.x, top, ['#fff', pl.col.c, C.yellow], 18, this.pw * 0.8);
    this.p.ring(pl.x, top, '#ffffff', this.pw * 0.5, 0.5);
    this.game.magic?.burst(pl.x, top, { n: 22, power: 0.6, colors: [pl.col.c === '#ffffff' ? '#fff3a0' : pl.col.c, '#ffffff', '#ffd93d'] });
    this.audio.play('chime', { vol: 0.6 });
    this.audio.arp('xylophone', ['G5', 'C6', 'E6', 'G6'], { step: 0.05, vol: 0.45 });
    speak(`פרח ${pl.col.name}`, { music: this.game.music });
    this.emiJoy.kick(8);
    // a visitor arrives
    const fromLeft = Math.random() < 0.5;
    this.visitors.push({
      kind: this.visitors.length % 3 === 2 ? 'bee' : 'fly',
      col: pick([C.pink, C.sky, C.yellow, C.purple, C.orange]),
      x: fromLeft ? -40 : e.w + 40, y: rand(e.h * 0.2, e.h * 0.45),
      home: pl, ph: rand(10), k: 0,
    });
    if (this.plots.every((k) => k.stage >= STAGES)) this.sched.in(0.8, () => this.complete(e));
  }

  makeRain(e) {
    this.cloudPress.kick(-10);
    this.rain = 2.2;
    this.audio.play('swipe', { vol: 0.5, rate: 0.7 });
    this.audio.glissando('harp', 'C6', 'C5', 8, { step: 0.08, vol: 0.4 });
    speak('גשם!', { music: this.game.music });
    // rain waters every planted bed; bare soil gets a seed for free
    this.plots.forEach((pl, i) => this.sched.in(0.5 + i * 0.12, () => this.growUp(pl, e)));
  }

  complete(e) {
    if (this.done) return;
    this.done = true;
    this.doneT = 0;
    this.reward(e.cx, this.groundY, { stars: 3, big: true });
    this.emiJoy.kick(16);
    speak('איזו גינה יפה!', { music: this.game.music });
    this.scoreLevel(1, e);
    for (let i = 0; i < 3; i++) this.sched.in(0.5 + i * 0.6, () => this.p.confetti(rand(e.w * 0.2, e.w * 0.8), e.h * 0.35, CONFETTI, 22, e.min * 0.8));
  }

  // --- frame -------------------------------------------------------------------------

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.cloudPress.update(dt);
    this.sunPress.update(dt);
    this.emiJoy.update(dt);
    this.can.tilt.update(dt);
    if (this.can.show > 0 && this.can.tilt.idle) this.can.show = Math.max(0, this.can.show - dt * 2);
    for (const pl of this.plots) { pl.grow.update(dt); pl.wobble.update(dt); }
    if (this.rain > 0) {
      this.rain -= dt;
      const n = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const xs = this.plots.map((k) => k.x);
        const lo = Math.min(...xs) - this.pw * 0.6, hi = Math.max(...xs) + this.pw * 0.6;
        this.p.spawn('drop', rand(lo, hi), rand(this.cloudY, this.groundY), {
          vx: 0, vy: rand(250, 380), g: 500, life: 1.4, size: rand(3, 5), color: '#7ccfff',
        });
      }
    }
    for (const v of this.visitors) {
      v.k = Math.min(1, v.k + dt * 0.5);
      const hx = v.home.x + Math.cos(this.t * 1.3 + v.ph) * this.pw * 0.45;
      const hy = v.home.y - this.plantH * 1.15 + Math.sin(this.t * 2.1 + v.ph) * this.pw * 0.25;
      v.x = lerp(v.x, hx, Math.min(1, dt * 1.6 * (0.3 + v.k)));
      v.y = lerp(v.y, hy, Math.min(1, dt * 1.6 * (0.3 + v.k)));
    }
    if (this.done) {
      this.doneT += dt;
      this.rainbowK = Math.min(1, this.rainbowK + dt * 0.8);
      if (this.doneT > 5.5) {
        for (const pl of this.plots) this.p.petals(pl.x, pl.y - this.plantH, [pl.col.c, '#fff'], 6);
        this.audio.play('swipe', { vol: 0.5 });
        this.newGarden();
        speak('עוד גינה!', { music: this.game.music });
      }
    }
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);

    // sky things
    const sp = 1 + this.sunPress.value * 0.03;
    if (this.done) rays(g, this.sunX, this.sunY, e.max * 0.8, t, 'rgba(255,250,210,0.3)', 16);
    g.save();
    g.translate(this.sunX, this.sunY);
    g.scale(sp, sp);
    sun(g, 0, 0, e.min * 0.07, t);
    g.restore();
    if (this.rainbowK > 0) {
      g.save();
      g.globalAlpha = this.rainbowK;
      // grows from part size: the innermost band must never get a negative radius
      rainbow(g, e.w / 2, this.groundY, e.min * 0.45 * (0.6 + 0.4 * ease.outBack(this.rainbowK)), e.min * 0.035, 0.8);
      g.restore();
    }
    // rain cloud
    const cp = 1 + this.cloudPress.value * 0.01;
    g.save();
    g.translate(this.cloudX + Math.sin(t * 0.5) * e.min * 0.02, this.cloudY);
    g.scale(cp, 1 / cp);
    const pulse = this.attractPulse(2.4);
    if (pulse > 0) glow(g, 0, 0, this.cloudW * 1.2, '#ffffff', pulse * 0.5);
    g.fillStyle = this.rain > 0 ? '#b8c8e0' : '#ffffff';
    cloud(g, this.cloudW, this.cloudW * 0.3, t);
    g.fill();
    // a friendly face, so it reads as something to touch
    g.fillStyle = '#4a3b52';
    circle(g, -this.cloudW * 0.12, -this.cloudW * 0.02, this.cloudW * 0.025);
    g.fill();
    circle(g, this.cloudW * 0.12, -this.cloudW * 0.02, this.cloudW * 0.025);
    g.fill();
    g.strokeStyle = '#4a3b52';
    g.lineWidth = this.cloudW * 0.018;
    g.beginPath();
    g.arc(0, this.cloudW * 0.03, this.cloudW * 0.06, 0.2, Math.PI - 0.2);
    g.stroke();
    g.restore();

    // Emi watches from the side and cheers each flower
    g.save();
    g.translate(this.emiX, this.groundY + e.min * 0.08 - this.emiS * EMI_FEET - Math.max(0, this.emiJoy.value) * this.emiS * 0.06);
    groundShadow(g, 0, this.emiS * EMI_FEET, this.emiS * 0.55, 0.15);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.done ? 1 : 0.3, { wave: this.done ? 1 : 0.2 });
    g.restore();

    // plants
    for (const pl of this.plots) this.drawPlant(g, pl, t);

    // watering can
    if (this.can.show > 0) {
      const c = this.can;
      g.save();
      g.globalAlpha = clamp(c.show * 2, 0, 1);
      g.translate(c.x, c.y);
      g.rotate(-c.tilt.value * 0.6);
      const s = this.pw * 0.32;
      g.fillStyle = radial(g, -s * 0.3, -s * 0.3, s * 1.6, ['#9fdcff', '#57b8f0', '#2f8fd0']);
      roundRect(g, -s * 0.6, -s * 0.5, s * 1.2, s, s * 0.25);
      g.fill();
      g.beginPath();
      g.moveTo(-s * 0.55, -s * 0.1);
      g.lineTo(-s * 1.35, -s * 0.55);
      g.lineTo(-s * 1.3, -s * 0.38);
      g.lineTo(-s * 0.55, s * 0.15);
      g.fill();
      g.strokeStyle = '#2f8fd0';
      g.lineWidth = s * 0.14;
      g.beginPath();
      g.arc(s * 0.1, -s * 0.5, s * 0.38, Math.PI, 0);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      roundRect(g, -s * 0.45, -s * 0.38, s * 0.25, s * 0.6, s * 0.1);
      g.fill();
      g.restore();
    }

    // visitors
    for (const v of this.visitors) {
      g.save();
      g.translate(v.x, v.y);
      const s = this.pw * (v.kind === 'bee' ? 0.18 : 0.2);
      g.scale(s, s);
      if (v.kind === 'bee') this.bee.draw(g, t + v.ph, 0.5, 2);
      else drawButterfly(g, t, v.col, v.ph);
      g.restore();
    }

    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawPlant(g, pl, t) {
    const st = pl.stage;
    const pw = this.pw;
    const gr = pl.grow.value;
    const sway = Math.sin(t * 1.5 + pl.i) * 0.03 + pl.wobble.value * 0.01 * Math.sin(t * 12);
    g.save();
    g.translate(pl.x, pl.y);
    if (st === 0) {
      // a gentle hint that bare soil wants a seed
      const pulse = this.attractPulse(2);
      if (pulse > 0) {
        g.fillStyle = `rgba(255,255,255,${pulse * 0.5})`;
        g.beginPath();
        g.ellipse(0, 0, pw * 0.42, pw * 0.13, 0, 0, TAU);
        g.fill();
      }
      g.restore();
      return;
    }
    if (st === 1) {
      // seed mound
      g.fillStyle = '#6b4226';
      g.beginPath();
      g.ellipse(0, -pw * 0.03 * gr, pw * 0.16 * gr, pw * 0.08 * gr, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = '#f5d78a';
      g.beginPath();
      g.ellipse(0, -pw * 0.08 * gr, pw * 0.04, pw * 0.03, 0.4, 0, TAU);
      g.fill();
      g.restore();
      return;
    }
    const h = this.plantH * [0, 0, 0.35, 0.7, 1][st] * (0.85 + gr * 0.15);
    g.rotate(sway);
    // stem
    g.strokeStyle = '#3fae49';
    g.lineWidth = pw * 0.06;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(pw * 0.06, -h * 0.5, 0, -h);
    g.stroke();
    // leaves
    for (const [sd, y] of [[-1, 0.35], [1, 0.55]]) {
      if (st < 3 && y > 0.4) continue;
      g.save();
      g.translate(0, -h * y);
      g.rotate(sd * (0.9 + Math.sin(t * 2 + pl.i) * 0.05));
      g.fillStyle = '#56c35a';
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(pw * 0.14, -pw * 0.12, pw * 0.3 * gr, 0);
      g.quadraticCurveTo(pw * 0.14, pw * 0.1, 0, 0);
      g.fill();
      g.restore();
    }
    g.translate(0, -h);
    if (st === 3) {
      // bud
      g.fillStyle = radial(g, -pw * 0.03, -pw * 0.05, pw * 0.15, [lighten(pl.col.c === '#ffffff' ? '#f0f0f0' : pl.col.c, 0.3), pl.col.c, '#3fae49']);
      g.beginPath();
      g.ellipse(0, -pw * 0.06, pw * 0.08 * gr, pw * 0.12 * gr, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#3fae49';
      g.beginPath();
      g.moveTo(-pw * 0.08, -pw * 0.02);
      g.quadraticCurveTo(0, pw * 0.04, pw * 0.08, -pw * 0.02);
      g.lineTo(0, -pw * 0.08);
      g.fill();
    } else if (st >= STAGES) {
      const s = pw * 0.3 * (0.6 + gr * 0.4);
      if (this.done) glow(g, 0, 0, s * 2, '#fff7c0', 0.35);
      g.scale(s, s);
      drawBloom(g, pl.kind, pl.col.c, ease.outBack(clamp(gr, 0, 1)), t + pl.i);
    }
    g.restore();
  }
}
