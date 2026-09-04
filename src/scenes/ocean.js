// Under the sea.
//
// The calm activity. Fish drift past, bubbles rise, seaweed sways, light shafts
// move across the sand. Touching anything makes it react: fish wiggle and blow
// bubbles, the octopus curls up, bubbles pop, and the treasure chest on the sand
// opens for a handful of stars.
//
// Slower and quieter than the other scenes on purpose - it works as the
// wind-down activity before the tablet goes away.

import { TAU, Spring, rand, randInt, pick } from '../core/util.js';
import { C, SKIES } from '../core/palette.js';
import {
  circle, roundRect, radial, lighten, star as starPath, alpha,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { SEA } from '../core/creatures.js';
import { collect, state } from '../core/state.js';

class Swimmer {
  constructor(e, spec, opts = {}) {
    this.spec = spec;
    this.s = e.min * rand(0.075, 0.11) * (spec.size || 1) * (opts.scale || 1);
    this.dir = opts.dir ?? pick([-1, 1]);
    this.x = opts.x ?? (this.dir > 0 ? -this.s * 2 : e.w + this.s * 2);
    this.y = opts.y ?? rand(e.h * 0.16, e.h * 0.82);
    this.v = e.min * rand(0.035, 0.08) * (opts.fast ? 2.2 : 1);
    this.ph = rand(10);
    this.bobA = rand(0.5, 1.4);
    this.excite = new Spring(0, 200, 12);
    this.dead = false;
    this.seed = rand(100);
    this.tapped = 0;
  }
  update(dt, e) {
    this.x += this.v * this.dir * dt;
    this.excite.update(dt);
    if (this.tapped > 0) this.tapped -= dt;
    const pad = this.s * 3;
    if (this.x < -pad || this.x > e.w + pad) this.dead = true;
  }
  get drawY() {
    return this.y + Math.sin(this.x * 0.01 + this.ph) * this.s * 0.22 * this.bobA;
  }
  draw(g, t) {
    g.save();
    g.translate(this.x, this.drawY);
    g.scale(this.s, this.s);
    // Creatures are drawn facing left, so flip when swimming right.
    if (this.dir > 0) g.scale(-1, 1);
    const wob = 1 + Math.sin(t * 3 + this.ph) * 0.02;
    g.scale(wob, 1 / wob);
    this.spec.draw(g, t + this.seed, this.excite.value, this.seed);
    g.restore();
  }
}

export class OceanScene extends SceneBase {
  constructor(game) {
    super(game, { sky: SKIES.ocean, music: 'calm' });
    this.swimmers = [];
    this.bubbles = [];
    this.spawnT = 0;
    this.bubbleT = 0;
    this.eventT = 9;
    this.chest = { open: false, t: 0, press: new Spring(0, 240, 14), cool: 0 };
    this.motes = Array.from({ length: 28 }, () => ({
      x: rand(1), y: rand(1), r: rand(0.6, 2.4), v: rand(0.01, 0.04), ph: rand(10),
    }));
    this.weeds = [];
    this.corals = [];
    this.found = new Set();
  }

  enter(e) {
    super.enter();
    this.audio.play('sleep', { vol: 0.5 });
    this.audio.arp('harp', ['C4', 'G4', 'C5', 'E5'], { step: 0.12, vol: 0.4 });
    for (let i = 0; i < 5; i++) {
      this.swimmers.push(new Swimmer(e, pick(SEA), { x: rand(e.w * 0.1, e.w * 0.9) }));
    }
  }

  layout(e) {
    super.layout(e);
    this.sandY = e.h * 0.86;
    this.chest.x = e.w * 0.5;
    this.chest.y = this.sandY + e.h * 0.045;
    this.chest.s = e.min * 0.085;
    // Sea floor decoration is laid out once per size, deterministically enough
    // that a resize does not reshuffle the whole garden.
    this.weeds = Array.from({ length: Math.max(6, Math.round(e.w / 90)) }, (_, i) => ({
      x: ((i + 0.5) / Math.max(6, Math.round(e.w / 90))) * e.w + rand(-14, 14),
      h: e.min * rand(0.085, 0.19),
      ph: rand(10),
      c: pick(['#2f8f5b', '#3aa86b', '#57b87a', '#248a63']),
      blades: randInt(3, 5),
    }));
    this.corals = Array.from({ length: 5 }, () => ({
      x: rand(e.w * 0.05, e.w * 0.95),
      s: e.min * rand(0.065, 0.11),
      c: pick([C.magenta, C.orange, C.purple, C.pink]),
      ph: rand(10),
      kind: randInt(0, 1),
    }));
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;

    // bubbles first: they float over everything
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.5) {
        this.bubbles.splice(i, 1);
        this.audio.play('pop', { vol: 0.5, rate: rand(1.1, 1.7) });
        this.audio.note('xylophone', pick(['C6', 'E6', 'G6', 'C7']), { vol: 0.4 });
        this.p.sparkle(b.x, b.y, ['#fff', '#cfefff'], 7, e.min * 0.1);
        this.p.ring(b.x, b.y, 'rgba(255,255,255,0.8)', b.r, 0.3);
        return;
      }
    }

    for (let i = this.swimmers.length - 1; i >= 0; i--) {
      const s = this.swimmers[i];
      if (Math.hypot(p.x - s.x, p.y - s.drawY) < s.s * 1.25) {
        this.pokeSwimmer(s, e);
        return;
      }
    }

    if (Math.hypot(p.x - this.chest.x, p.y - this.chest.y) < this.chest.s * 1.4) {
      this.openChest(e);
      return;
    }

    // Touching open water sends up a stream of bubbles.
    this.p.bubbles(p.x, p.y, 7, e.min * 0.22);
    this.audio.play('tap', { vol: 0.2, rate: rand(1.1, 1.6) });
    this.audio.note('harp', pick(['C5', 'E5', 'G5', 'A5']), { vol: 0.3 });
  }

  onUp(p) { this.hud.onUp(p); }

  pokeSwimmer(s, e) {
    s.excite.set(1);
    s.excite.to(0);
    s.v *= 1.35;
    s.tapped = 0.6;
    this.audio.voice(s.spec.voice);
    this.p.bubbles(s.x - s.dir * s.s * 0.8, s.drawY - s.s * 0.2, 8, e.min * 0.26);
    this.p.sparkle(s.x, s.drawY, ['#fff', lighten(s.spec.color, 0.4)], 8, e.min * 0.14);

    const isNew = !state.stickers[s.spec.id];
    collect(s.spec.id);
    this.found.add(s.spec.id);
    if (isNew) {
      this.reward(s.x, s.drawY, { stars: 2, big: true, colors: [s.spec.color, '#fff', C.sky] });
    } else if (this.combo % 5 === 4) {
      this.reward(s.x, s.drawY, { stars: 1, colors: [s.spec.color, '#fff'] });
    } else {
      this.combo++;
      this.comboTimer = 2;
    }
  }

  openChest(e) {
    const c = this.chest;
    c.press.set(1);
    c.press.to(0);
    if (c.cool > 0) {
      // Already emptied: it still rattles, so the touch is never ignored.
      this.audio.play('nope', { vol: 0.3 });
      this.p.bubbles(c.x, c.y - c.s, 4, e.min * 0.15);
      return;
    }
    c.open = true;
    c.t = 1;
    c.cool = 9;
    this.audio.play('achievement', { throttle: 0 });
    this.audio.arp('harp', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], { step: 0.055, vol: 0.6 });
    this.reward(c.x, c.y - c.s * 0.8, { stars: 5, big: true, colors: [C.yellow, C.orange, '#fff8c0'], sound: false });
    this.p.bubbles(c.x, c.y - c.s, 16, e.min * 0.4);
    for (let i = 0; i < 8; i++) {
      this.p.star(c.x + rand(-c.s, c.s), c.y - c.s * 0.6, C.yellow, e.min * 0.03, 1.2);
    }
  }

  // Occasional set pieces keep a long session from flattening out.
  runEvent(e) {
    const kind = pick(['school', 'whale', 'jellies']);
    if (kind === 'school') {
      const spec = pick(SEA.filter((s) => s.id.startsWith('fish')));
      const dir = pick([-1, 1]);
      const y = rand(e.h * 0.25, e.h * 0.7);
      for (let i = 0; i < 9; i++) {
        this.swimmers.push(new Swimmer(e, spec, {
          dir,
          x: (dir > 0 ? -1 : 1) * (e.min * 0.2 + i * e.min * 0.15) + (dir > 0 ? 0 : e.w),
          y: y + rand(-e.min * 0.12, e.min * 0.12),
          scale: 0.7,
        }));
      }
      this.audio.play('swipe', { vol: 0.35 });
    } else if (kind === 'whale') {
      const spec = SEA.find((s) => s.id === 'whale');
      this.swimmers.push(new Swimmer(e, spec, { scale: 1.25, y: rand(e.h * 0.28, e.h * 0.58) }));
      this.audio.voice(spec.voice);
    } else {
      const spec = SEA.find((s) => s.id === 'jelly');
      for (let i = 0; i < 4; i++) {
        this.swimmers.push(new Swimmer(e, spec, {
          y: rand(e.h * 0.2, e.h * 0.7),
          x: rand(e.w * 0.1, e.w * 0.9),
          scale: 0.85,
        }));
      }
      this.audio.play('chime', { vol: 0.4 });
    }
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.chest.press.update(dt);
    if (this.chest.cool > 0) {
      this.chest.cool -= dt;
      if (this.chest.cool <= 0) this.chest.open = false;
    }
    if (this.chest.t > 0) this.chest.t = Math.max(0, this.chest.t - dt * 0.8);

    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.swimmers.length < 12) {
      this.spawnT = rand(1.1, 2.6);
      this.swimmers.push(new Swimmer(e, pick(SEA)));
    }
    for (let i = this.swimmers.length - 1; i >= 0; i--) {
      const s = this.swimmers[i];
      s.update(dt, e);
      if (s.dead) this.swimmers.splice(i, 1);
    }

    // ambient bubbles from the sea floor
    this.bubbleT -= dt;
    if (this.bubbleT <= 0 && this.bubbles.length < 16) {
      this.bubbleT = rand(0.5, 1.6);
      this.bubbles.push({
        x: rand(e.w * 0.05, e.w * 0.95),
        y: this.sandY + rand(0, e.h * 0.05),
        r: e.min * rand(0.018, 0.042),
        v: e.min * rand(0.05, 0.1),
        ph: rand(10),
      });
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.v * dt;
      b.x += Math.sin(b.y * 0.02 + b.ph) * e.min * 0.02 * dt * 4;
      if (b.y < -b.r * 2) this.bubbles.splice(i, 1);
    }

    this.eventT -= dt;
    if (this.eventT <= 0) {
      this.eventT = rand(14, 24);
      this.runEvent(e);
    }

    this.motes.forEach((m) => {
      m.y -= m.v * dt * 0.2;
      if (m.y < -0.05) { m.y = 1.05; m.x = rand(1); }
    });
  }

  // Light shafts, sand and coral are fixed; only the creatures, bubbles,
  // seaweed and surface ripple move.
  paintBackdrop(g, e) {
    // shafts of light from the surface
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = ((i + 0.5) / 4) * e.w;
      const w = e.min * (0.1 + i * 0.02);
      const grad = g.createLinearGradient(x, 0, x + w * 0.6, e.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.24)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - w * 0.5, 0);
      g.lineTo(x + w * 0.5, 0);
      g.lineTo(x + w * 1.6, e.h);
      g.lineTo(x + w * 0.3, e.h);
      g.closePath();
      g.fill();
    }
    g.restore();

    this.paintFloor(g, e);
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    // surface ripple
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = e.min * 0.008;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = 0; x <= e.w; x += 24) {
        const y = e.h * 0.012 + k * e.min * 0.02 + Math.sin(x * 0.02 + t * 1.6 + k) * e.min * 0.008;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();

    // drifting motes for depth
    g.fillStyle = 'rgba(255,255,255,0.35)';
    this.motes.forEach((m) => {
      circle(g, m.x * e.w + Math.sin(t * 0.5 + m.ph) * 12, m.y * e.h, m.r);
      g.fill();
    });

    this.drawLive(g, e, t);
  }

  // The sea floor: sand, grains and coral, all painted into the backdrop.
  paintFloor(g, e) {
    const t = 0;
    g.fillStyle = '#f0dfae';
    g.beginPath();
    g.moveTo(0, this.sandY);
    for (let x = 0; x <= e.w; x += e.w / 8) {
      g.quadraticCurveTo(
        x + e.w / 16, this.sandY - e.min * 0.02 * Math.sin(x * 0.01),
        x + e.w / 8, this.sandY + e.min * 0.012 * Math.cos(x * 0.008)
      );
    }
    g.lineTo(e.w, e.h);
    g.lineTo(0, e.h);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = '#e2caa0';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 97) % 100) / 100 * e.w;
      const y = this.sandY + ((i * 53) % 40) / 40 * (e.h - this.sandY);
      circle(g, x, y, e.min * 0.005);
      g.fill();
    }
    g.restore();

    // corals
    this.corals.forEach((c) => {
      g.save();
      g.translate(c.x, this.sandY + e.min * 0.026);
      const sway = Math.sin(t * 0.9 + c.ph) * 0.05;
      g.rotate(sway);
      if (c.kind === 0) {
        // branching coral
        g.strokeStyle = c.c;
        g.lineWidth = c.s * 0.22;
        g.lineCap = 'round';
        [[0, -1], [-0.5, -0.75], [0.5, -0.8]].forEach(([dx, dy]) => {
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(dx * c.s * 0.4, dy * c.s * 0.6, dx * c.s, dy * c.s);
          g.stroke();
        });
      } else {
        // fan coral
        g.fillStyle = alpha(c.c, 0.85);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-c.s * 0.9, -c.s * 0.6, -c.s * 0.3, -c.s * 1.2);
        g.quadraticCurveTo(0, -c.s * 0.8, c.s * 0.3, -c.s * 1.2);
        g.quadraticCurveTo(c.s * 0.9, -c.s * 0.6, 0, 0);
        g.closePath();
        g.fill();
      }
      g.restore();
    });
  }

  // Everything that moves on the sea floor and above it.
  drawLive(g, e, t) {
    // seaweed: filled leaves that taper to a point and sway from the base
    this.weeds.forEach((w) => {
      g.save();
      g.translate(w.x, this.sandY + e.min * 0.014);
      g.fillStyle = w.c;
      for (let b = 0; b < w.blades; b++) {
        const off = (b - (w.blades - 1) / 2) * e.min * 0.018;
        const sway = Math.sin(t * 1.1 + w.ph + b * 0.6) * w.h * 0.24;
        const wide = e.min * 0.013;
        g.beginPath();
        g.moveTo(off - wide, 0);
        g.quadraticCurveTo(off + sway * 0.4 - wide * 0.5, -w.h * 0.55, off + sway, -w.h);
        g.quadraticCurveTo(off + sway * 0.4 + wide * 0.7, -w.h * 0.5, off + wide, 0);
        g.closePath();
        g.fill();
      }
      g.restore();
    });

    // treasure chest
    this.drawChest(g, e, t);

    // creatures
    this.swimmers
      .slice()
      .sort((a, b) => a.s - b.s)
      .forEach((s) => s.draw(g, t));

    // bubbles
    this.bubbles.forEach((b) => {
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = Math.max(1.4, b.r * 0.16);
      circle(g, b.x, b.y, b.r);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      circle(g, b.x, b.y, b.r * 0.92);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      circle(g, b.x - b.r * 0.32, b.y - b.r * 0.34, b.r * 0.2);
      g.fill();
      g.restore();
    });

    this.p.draw(g);

    if (this.idle > 6 && this.swimmers.length) {
      const s = this.swimmers[0];
      const pulse = this.attractPulse(1.8);
      g.save();
      g.globalAlpha = 0.3 + pulse * 0.4;
      g.strokeStyle = '#fff';
      g.lineWidth = e.min * 0.011;
      circle(g, s.x, s.drawY, s.s * (1.3 + pulse * 0.15));
      g.stroke();
      g.restore();
    }

    this.drawHud(g, e);
  }

  drawChest(g, e, t) {
    const c = this.chest;
    const s = c.s * (1 - c.press.value * 0.06);
    g.save();
    g.translate(c.x, c.y);
    g.save();
    g.globalAlpha = 0.2;
    g.fillStyle = '#8a6a3a';
    g.beginPath();
    g.ellipse(0, s * 0.5, s * 1.1, s * 0.22, 0, 0, TAU);
    g.fill();
    g.restore();

    if (c.open) {
      // glow from inside
      g.save();
      g.globalAlpha = 0.4 + Math.sin(t * 5) * 0.2;
      g.fillStyle = radial(g, 0, -s * 0.3, s * 2, ['rgba(255,240,160,0.9)', 'rgba(255,220,90,0)']);
      circle(g, 0, -s * 0.3, s * 2);
      g.fill();
      g.restore();
    }

    // body
    g.fillStyle = '#8d5836';
    roundRect(g, -s, -s * 0.34, s * 2, s * 0.84, s * 0.12);
    g.fill();
    g.fillStyle = '#b5794f';
    roundRect(g, -s * 0.94, -s * 0.28, s * 1.88, s * 0.7, s * 0.1);
    g.fill();
    g.fillStyle = C.yellowDark;
    roundRect(g, -s * 1.02, -s * 0.06, s * 2.04, s * 0.16, s * 0.06);
    g.fill();
    for (const sd of [-1, 1]) {
      g.fillStyle = C.yellow;
      roundRect(g, sd * s * 0.62 - s * 0.09, -s * 0.3, s * 0.18, s * 0.74, s * 0.05);
      g.fill();
    }
    if (c.open) {
      // coins spilling out
      g.fillStyle = C.yellow;
      for (let i = 0; i < 5; i++) {
        const a = -2.2 + i * 0.45;
        circle(g, Math.cos(a) * s * 0.6, -s * 0.36 + Math.sin(a) * s * 0.16, s * 0.13);
        g.fill();
      }
      g.fillStyle = '#fff';
      starPath(g, 5, s * 0.2, s * 0.09, t);
      g.fill();
    }
    // lid
    g.save();
    g.translate(0, -s * 0.34);
    g.rotate(c.open ? -1.05 : -0.02 + Math.sin(t * 2) * 0.015);
    g.fillStyle = '#a06a3c';
    g.beginPath();
    g.moveTo(-s, 0);
    g.quadraticCurveTo(-s, -s * 0.68, 0, -s * 0.68);
    g.quadraticCurveTo(s, -s * 0.68, s, 0);
    g.closePath();
    g.fill();
    g.fillStyle = C.yellowDark;
    g.beginPath();
    g.moveTo(-s * 0.14, 0);
    g.quadraticCurveTo(-s * 0.14, -s * 0.66, 0, -s * 0.66);
    g.quadraticCurveTo(s * 0.14, -s * 0.66, s * 0.14, 0);
    g.closePath();
    g.fill();
    g.restore();
    // lock
    if (!c.open) {
      g.fillStyle = C.yellow;
      roundRect(g, -s * 0.14, -s * 0.42, s * 0.28, s * 0.3, s * 0.07);
      g.fill();
      g.fillStyle = '#8d5836';
      circle(g, 0, -s * 0.27, s * 0.05);
      g.fill();
    }
    g.restore();

    if (!c.open && c.cool <= 0 && this.idle > 8) {
      const pulse = this.attractPulse(2);
      g.save();
      g.globalAlpha = 0.3 + pulse * 0.4;
      g.strokeStyle = C.yellow;
      g.lineWidth = e.min * 0.012;
      circle(g, c.x, c.y, c.s * (1.5 + pulse * 0.12));
      g.stroke();
      g.restore();
    }
  }
}
