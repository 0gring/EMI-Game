// Colour balloons: pop the ones of the colour that is called.
//
// A colour is called ("בלונים אדומים!") and balloons with faces float up. The
// game is mostly about being silly:
//
//   * the right colour pops - and either an animal parachutes out of it,
//     waving and making its noise, or the balloon lets go and zooms round the
//     screen like a deflating balloon, blowing a long "pfffft"
//   * another colour never fails: it giggles, sticks its tongue out, says its
//     own colour ("אני צהוב!") and shoots off upward
//   * now and then a giant balloon comes up that swells with every tap until it
//     bursts in a shower of parachuting animals
//
// Each round wants a handful of pops of the called colour; then every balloon
// on screen pops at once, the fireworks go up and a new colour is called.

import { TAU, Spring, rand, pick, clamp, ease, shuffled, Schedule } from '../../core/util.js';
import { circle, radial, lighten, darken, eyes, smile, openMouth, cheeks, verticalGradient, hill, cloud, sun, groundShadow } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { drawEmi, EMI_FEET, LAND } from '../../core/creatures.js';
import { glow, card } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#7cc8ff', '#b4e2ff', '#fde6f6'];

// Colours with the plural used when calling them and the singular a balloon
// says about itself.
const COLORS = [
  { c: '#ff4d5e', many: 'אדומים', one: 'אדום' },
  { c: '#ffd23d', many: 'צהובים', one: 'צהוב' },
  { c: '#4fa8ff', many: 'כחולים', one: 'כחול' },
  { c: '#5fcf5f', many: 'ירוקים', one: 'ירוק' },
  { c: '#a774ff', many: 'סגולים', one: 'סגול' },
  { c: '#ff9a1f', many: 'כתומים', one: 'כתום' },
  { c: '#ff85c8', many: 'ורודים', one: 'ורוד' },
];

// More colours in the sky, more balloons, a little faster, a giant more often.
const TUNING = [
  { colors: 2, max: 5, need: 5, speed: 1.0, giant: 0 },
  { colors: 3, max: 6, need: 6, speed: 1.1, giant: 0.06 },
  { colors: 4, max: 7, need: 7, speed: 1.2, giant: 0.08 },
  { colors: 5, max: 8, need: 8, speed: 1.3, giant: 0.1 },
];

const FLYERS = LAND.filter((a) => ['cat', 'dog', 'pig', 'bunny', 'duck', 'frog', 'monkey', 'penguin', 'sheep', 'cow'].includes(a.id));

export class ColorPopScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'play', id: 'colorpop', hue: '#ff4d5e', goals: [2, 2, 3, 3] });
    this.sched = new Schedule();
    this.balloons = [];
    this.chutes = [];
    this.spawnT = 0;
    this.emiJoy = new Spring(0, 170, 9);
    this.banner = new Spring(0, 170, 11);
    this.clouds = Array.from({ length: 4 }, () => ({ x: rand(1), y: rand(0.08, 0.4), s: rand(0.6, 1.2), v: rand(0.006, 0.016) }));
    this.newRound(true);
  }

  newRound(first = false) {
    this.tune = this.levels.pick(TUNING);
    const prev = this.target;
    this.palette = shuffled(COLORS).slice(0, this.tune.colors);
    this.target = this.palette.find((p) => p !== prev) || this.palette[0];
    this.popped = 0;
    this.roundDone = false;
    this.banner.set(0);
    this.banner.to(1);
    this.sched.in(first ? 0.7 : 0.3, () => this.callColor());
  }

  callColor() {
    speak(`בלונים ${this.target.many}!`, { music: this.game.music });
    this.audio.play('chime', { vol: 0.5 });
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
  }

  onLevelUp() { this.tune = this.levels.pick(TUNING); }

  layout(e) {
    super.layout(e);
    this.groundY = e.h * 0.9;
    this.br = clamp(e.min * 0.085, 30, 80);
    this.emiS = e.min * 0.09;
  }

  paintBackdrop(g, e) {
    sun(g, e.w * 0.12, e.h * 0.2, e.min * 0.06, 0);
    hill(g, e.w * 0.25, this.groundY, e.w * 0.9, e.h * 0.12, '#a8e07a');
    hill(g, e.w * 0.8, this.groundY, e.w * 0.8, e.h * 0.09, '#8fd468');
    g.fillStyle = verticalGradient(g, this.groundY, e.h, ['#8fd468', '#6fc256']);
    g.fillRect(0, this.groundY, e.w, e.h - this.groundY);
  }

  // --- balloons ---------------------------------------------------------------------

  spawn(e) {
    const t = this.tune;
    // Keep the called colour common, so there is always one to reach for.
    // Keep at least one of the called colour up, never let it crowd out the
    // others: telling the colours apart is the whole game.
    const want = this.balloons.filter((b) => b.state === 'rise' && b.col === this.target).length;
    const others = this.palette.filter((p) => p !== this.target);
    const col = want < 1 ? this.target : want >= 3 ? pick(others) : Math.random() < 0.4 ? this.target : pick(others);
    const giant = !this.roundDone && col === this.target && Math.random() < t.giant && !this.balloons.some((b) => b.giant);
    const r = this.br * (giant ? 1.9 : rand(0.9, 1.1));
    this.balloons.push({
      x: rand(e.w * 0.1, e.w * 0.9), y: e.h + r * 1.5, r, col, giant, taps: 0,
      vy: -e.h * rand(0.07, 0.1) * t.speed * (giant ? 0.6 : 1), ph: rand(10),
      state: 'rise', t: 0, squash: new Spring(1, 260, 10), grow: 1, tongue: 0, look: rand(-1, 1),
    });
  }

  hitBalloon(x, y) {
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.state !== 'rise') continue;
      const r = b.r * b.grow;
      if (Math.hypot(x - b.x, (y - b.y) * 0.9) < r * 1.2) return b;
    }
    return null;
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    const b = this.hitBalloon(p.x, p.y);
    if (!b) {
      this.audio.randomNote('xylophone', 'pentatonicHigh', { vol: 0.25 });
      return;
    }
    if (b.col !== this.target || this.roundDone) {
      this.tickle(b, e);
      return;
    }
    if (b.giant) {
      b.taps++;
      b.grow = 1 + b.taps * 0.18;
      b.squash.kick(-12);
      this.audio.voice({ inst: 'flute', note: ['C5', 'E5', 'G5'][b.taps - 1] || 'C6', dur: 0.35, vol: 0.5, bend: [[0, 0.8], [0.3, 1.15]] });
      speak(['אחת', 'שתיים', 'שלוש'][b.taps - 1] || '', { music: this.game.music });
      if (b.taps >= 3) this.pop(b, e, true);
      return;
    }
    if (Math.random() < 0.32) this.deflate(b, e);
    else this.pop(b, e, false);
  }

  // The wrong colour giggles, pulls a face, says its colour and shoots off.
  tickle(b, e) {
    b.state = 'tickle';
    b.t = 0;
    b.squash.kick(-14);
    b.tongue = 1;
    this.audio.arp('xylophone', ['E7', 'C7', 'A6', 'G6', 'E6'], { step: 0.045, vol: 0.4 });
    this.audio.voice({ inst: 'flute', note: 'A5', dur: 0.5, vol: 0.4, bend: [[0, 1.1], [0.08, 0.95], [0.16, 1.12], [0.24, 0.94], [0.32, 1.1], [0.45, 0.9]] });
    speak(`אני ${b.col.one}!`, { music: this.game.music });
    this.emiJoy.kick(6);
  }

  // A classic pop: confetti in the balloon's colour and an animal parachutes out.
  pop(b, e, big) {
    b.state = 'gone';
    const n = big ? 4 : 1;
    this.audio.play('pop', { vol: 0.9, throttle: 0 });
    this.p.confetti(b.x, b.y, [b.col.c, lighten(b.col.c, 0.4), '#ffffff'], big ? 50 : 22, e.min * (big ? 1.1 : 0.6));
    this.p.ring(b.x, b.y, '#ffffff', b.r * b.grow, 0.4);
    for (let i = 0; i < n; i++) this.parachute(b.x + (i - (n - 1) / 2) * b.r * 0.9, b.y, b.col.c, e);
    this.score(b, e, big ? 2 : 1, big);
  }

  // The funny one: it lets go and zooms round the screen blowing a raspberry.
  deflate(b, e) {
    b.state = 'zoom';
    b.t = 0;
    b.ang = rand(TAU);
    b.spin = rand(-1, 1) < 0 ? -9 : 9;
    this.audio.voice({ inst: 'flute', note: 'E5', dur: 1.3, vol: 0.55, bend: [
      [0, 1.3], [0.1, 1.0], [0.2, 1.25], [0.3, 0.95], [0.4, 1.2], [0.5, 0.9], [0.6, 1.1], [0.75, 0.8], [0.9, 0.95], [1.1, 0.6], [1.3, 0.5],
    ] });
    this.score(b, e, 1, false);
  }

  parachute(x, y, color, e) {
    const a = pick(FLYERS);
    this.chutes.push({ a, x, y, x0: x, vy: e.h * rand(0.1, 0.14), t: 0, color, landed: 0, joy: new Spring(0, 200, 10) });
    this.sched.in(0.25, () => this.audio.voice(a.voice));
  }

  score(b, e, n, big) {
    this.popped += n;
    this.emiJoy.kick(10);
    this.game.magic?.burst(b.x, b.y, { n: big ? 40 : 16, power: big ? 1 : 0.45, colors: [b.col.c, '#ffffff', '#ffd93d'] });
    if (this.popped >= this.tune.need && !this.roundDone) this.finishRound(e);
  }

  finishRound(e) {
    this.roundDone = true;
    this.sched.in(0.4, () => {
      // every balloon left in the sky goes off, one after another
      const left = this.balloons.filter((b) => b.state === 'rise');
      left.forEach((b, i) => this.sched.in(i * 0.12, () => {
        if (b.state !== 'rise') return;
        b.state = 'gone';
        this.audio.play('pop', { vol: 0.6, throttle: 0 });
        this.p.confetti(b.x, b.y, [b.col.c, '#ffffff'], 16, e.min * 0.5);
      }));
      this.reward(e.cx, e.h * 0.4, { stars: 2, big: true });
      speak('כל הכבוד!', { music: this.game.music });
      this.scoreLevel(1, e);
    });
    this.sched.in(3.4, () => this.newRound());
  }

  // --- frame ------------------------------------------------------------------------

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.emiJoy.update(dt);
    this.banner.update(dt);
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.3;
    }
    const live = this.balloons.filter((b) => b.state === 'rise').length;
    this.spawnT -= dt;
    if (!this.roundDone && live < this.tune.max && this.spawnT <= 0) {
      this.spawn(e);
      this.spawnT = rand(0.5, 1.1) / this.tune.speed;
    }
    for (const b of this.balloons) {
      b.t += dt;
      b.squash.update(dt);
      if (b.state === 'rise') {
        b.y += b.vy * dt;
        b.x += Math.sin(this.t * 0.9 + b.ph) * e.min * 0.02 * dt;
        if (b.y < -b.r * 3) b.state = 'gone';
      } else if (b.state === 'tickle') {
        b.tongue = Math.max(0, 1 - b.t / 1.2);
        if (b.t > 0.7) b.y -= e.h * 1.1 * dt * Math.min(1, (b.t - 0.7) * 3);
        b.x += Math.sin(b.t * 30) * e.min * 0.2 * dt * Math.max(0, 1 - b.t);
        if (b.y < -b.r * 3) b.state = 'gone';
      } else if (b.state === 'zoom') {
        b.ang += b.spin * dt * (0.6 + Math.sin(b.t * 7) * 0.6);
        const sp = e.min * 1.4 * Math.max(0.2, 1 - b.t / 1.6);
        b.x += Math.cos(b.ang) * sp * dt;
        b.y += Math.sin(b.ang) * sp * dt;
        // bounce off the edges so it stays on screen while it zooms
        if (b.x < b.r || b.x > e.w - b.r) { b.ang = Math.PI - b.ang; b.x = clamp(b.x, b.r, e.w - b.r); }
        if (b.y < b.r || b.y > e.h - b.r) { b.ang = -b.ang; b.y = clamp(b.y, b.r, e.h - b.r); }
        b.grow = Math.max(0.25, 1 - b.t / 1.5);
        if (Math.random() < 0.6) this.p.spawn('puff', b.x, b.y, { life: 0.4, size: b.r * 0.25, color: 'rgba(255,255,255,0.8)' });
        if (b.t > 1.5) {
          b.state = 'gone';
          this.p.sparkle(b.x, b.y, ['#fff', b.col.c], 10, e.min * 0.1);
          this.audio.play('pop', { vol: 0.4, rate: 1.5 });
        }
      }
    }
    this.balloons = this.balloons.filter((b) => b.state !== 'gone');
    for (const c of this.chutes) {
      c.t += dt;
      c.joy.update(dt);
      if (!c.landed) {
        c.y += c.vy * dt;
        c.x = c.x0 + Math.sin(c.t * 2) * e.min * 0.05;
        if (c.y >= this.groundY - this.br * 0.6) {
          c.landed = 0.001;
          c.joy.kick(10);
          this.audio.play('boing', { vol: 0.45 });
        }
      } else c.landed += dt;
    }
    this.chutes = this.chutes.filter((c) => c.landed < 2.6);
    if (this.chutes.length > 10) this.chutes.splice(0, this.chutes.length - 10);
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    for (const c of this.clouds) {
      g.save();
      g.translate(c.x * e.w, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      cloud(g, e.min * 0.18 * c.s, e.min * 0.05 * c.s, t + c.x * 5);
      g.fill();
      g.restore();
    }

    // Emi in the corner, laughing at all of it
    const jy = Math.max(0, this.emiJoy.value) * this.emiS * 0.1;
    g.save();
    g.translate(e.w * 0.9, this.groundY - this.emiS * EMI_FEET - jy);
    groundShadow(g, 0, this.emiS * EMI_FEET + jy, this.emiS * 0.55, 0.15);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, clamp(0.3 + this.emiJoy.value * 0.1, 0, 1), { wave: this.emiJoy.value > 1 ? 1 : 0.3 });
    g.restore();

    for (const c of this.chutes) this.drawChute(g, c, t);
    for (const b of this.balloons) this.drawBalloon(g, b, t);

    this.drawBanner(g, e, t);
    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawBanner(g, e, t) {
    const k = ease.outBack(clamp(this.banner.value, 0, 1.2));
    if (k <= 0.01) return;
    const r = clamp(e.min * 0.045, 18, 40);
    const n = this.tune.need;
    const dot = r * 0.42;
    const w = r * 3.2 + n * dot * 2.6 + r;
    const h = r * 2.6;
    const x = e.w / 2, y = (e.topBand || 0) + h * 0.15;
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    card(g, -w / 2, -h / 2, w, h, h * 0.4, { fill: 'rgba(255,255,255,0.92)' });
    // the called colour, as a bobbing balloon on the right
    const bx = w / 2 - r * 1.6;
    g.save();
    g.translate(bx, Math.sin(t * 3) * r * 0.08);
    g.rotate(Math.sin(t * 2) * 0.1);
    this.balloonBody(g, 0, 0, r * 0.85, this.target.c);
    g.restore();
    // progress dots, filling right to left
    for (let i = 0; i < n; i++) {
      const dx = bx - r * 1.7 - i * dot * 2.6;
      const filled = i < this.popped;
      g.fillStyle = filled ? this.target.c : 'rgba(120,110,160,0.18)';
      circle(g, dx, 0, dot * (filled ? 1.1 : 0.9));
      g.fill();
      if (filled) {
        g.fillStyle = 'rgba(255,255,255,0.6)';
        circle(g, dx - dot * 0.35, -dot * 0.35, dot * 0.3);
        g.fill();
      }
    }
    g.restore();
  }

  balloonBody(g, x, y, r, col) {
    g.fillStyle = radial(g, x - r * 0.35, y - r * 0.45, r * 2, [lighten(col, 0.5), col, darken(col, 0.22)]);
    g.beginPath();
    g.ellipse(x, y, r * 0.88, r, 0, 0, TAU);
    g.fill();
    g.fillStyle = darken(col, 0.15);
    g.beginPath();
    g.moveTo(x - r * 0.12, y + r * 1.1);
    g.lineTo(x + r * 0.12, y + r * 1.1);
    g.lineTo(x, y + r * 0.96);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.17, r * 0.28, 0.5, 0, TAU);
    g.fill();
  }

  drawBalloon(g, b, t) {
    const r = b.r * b.grow;
    const sq = b.squash.value;
    g.save();
    g.translate(b.x, b.y);
    if (b.state === 'zoom') g.rotate(b.ang + Math.PI / 2);
    else g.rotate(Math.sin(t * 1.2 + b.ph) * 0.08);
    // string
    if (b.state !== 'zoom') {
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = Math.max(1.5, r * 0.04);
      g.beginPath();
      g.moveTo(0, r * 1.1);
      g.bezierCurveTo(r * 0.3, r * 1.6, -r * 0.3, r * 2.0, r * 0.1, r * 2.6);
      g.stroke();
    }
    if (b.giant) glow(g, 0, 0, r * 1.8, lighten(b.col.c, 0.5), 0.35);
    g.scale(1 / sq, sq);
    this.balloonBody(g, 0, 0, r, b.col.c);
    // face
    const fs = r * 0.5;
    g.save();
    g.translate(0, -r * 0.05);
    g.scale(fs, fs);
    const happy = b.state === 'tickle' || (b.giant && b.taps > 0);
    g.save();
    g.translate(0, -0.25);
    eyes(g, 0.42, 0.2, { blink: (t + b.ph) % 4 > 3.85 ? 1 : 0, lookX: b.look * 0.3, happy: happy ? 1 : 0 });
    g.restore();
    g.save();
    g.translate(0, 0.12);
    cheeks(g, 0.62, 0.14);
    g.restore();
    g.save();
    g.translate(0, 0.2);
    if (b.state === 'zoom') {
      openMouth(g, 0.2, 0.3);
    } else if (b.tongue > 0) {
      // tongue out: the funniest thing a balloon can do
      openMouth(g, 0.34, 0.2);
      g.fillStyle = '#ff6b8a';
      g.beginPath();
      g.ellipse(0, 0.3 + 0.1 * b.tongue, 0.15, 0.12 + 0.12 * b.tongue, 0, 0, TAU);
      g.fill();
    } else if (b.giant) {
      openMouth(g, 0.2 + b.taps * 0.06, 0.16 + b.taps * 0.07);
    } else {
      smile(g, 0.3, 0.2, '#3b2f4a', 0.08);
    }
    g.restore();
    g.restore();
    g.restore();
  }

  drawChute(g, c, t) {
    const s = this.br * 0.55;
    const land = c.landed > 0;
    g.save();
    g.translate(c.x, c.y);
    if (!land) {
      // canopy in the balloon's colour, lines down to the animal
      g.save();
      g.rotate(Math.sin(c.t * 2) * 0.15);
      g.fillStyle = radial(g, -s * 0.5, -s * 2.6, s * 3, [lighten(c.color, 0.45), c.color, darken(c.color, 0.2)]);
      g.beginPath();
      g.arc(0, -s * 1.9, s * 1.6, Math.PI, 0);
      g.quadraticCurveTo(s * 0.8, -s * 2.1, 0, -s * 1.9);
      g.quadraticCurveTo(-s * 0.8, -s * 2.1, -s * 1.6, -s * 1.9);
      g.fill();
      g.strokeStyle = 'rgba(80,60,100,0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      for (const sx of [-1.5, -0.5, 0.5, 1.5]) {
        g.moveTo(sx * s, -s * 1.92);
        g.lineTo(sx * 0.2 * s, -s * 0.5);
      }
      g.stroke();
      g.restore();
    }
    const hop = land ? Math.abs(Math.sin(c.landed * 8)) * s * 0.3 * Math.max(0, 1 - c.landed) : 0;
    const fade = land ? clamp((2.6 - c.landed) / 0.6, 0, 1) : 1;
    g.globalAlpha = fade;
    g.translate(0, -hop);
    g.scale(s, s);
    c.a.draw(g, t + c.x, land ? 0.9 : 0.5, 2);
    g.restore();
  }
}

