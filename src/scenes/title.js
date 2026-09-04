// Title screen.
//
// It exists for two reasons beyond looking nice: browsers refuse to start audio
// until the user touches the page, and the sample library needs a moment to
// download. So the first tap both unlocks sound and starts loading, and the
// screen stays playful while it does.

import { TAU, Spring, rand, clamp } from '../core/util.js';
import { C, CONFETTI, SKIES } from '../core/palette.js';
import {
  circle, label, sun, cloud, radial, verticalGradient, star as starPath, lighten,
  groundShadow, rainbow,
} from '../core/gfx.js';
import { Particles } from '../core/fx.js';
import { drawEmi, EMI_FEET } from '../core/creatures.js';
import { state } from '../core/state.js';
import { HubScene } from './hub.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.musicName = 'hub';
    this.t = 0;
    this.p = new Particles();
    this.phase = 'idle';       // idle -> loading -> ready
    this.progress = 0;
    this.shown = 0;
    this.press = new Spring(0, 300, 16);
    this.pop = new Spring(0, 150, 11);
    this.clouds = Array.from({ length: 4 }, () => ({
      x: rand(1), y: rand(0.1, 0.3), s: rand(0.7, 1.3), v: rand(0.006, 0.016),
    }));
    this.balloons = Array.from({ length: 7 }, (_, i) => ({
      x: rand(0.08, 0.92), y: rand(0.3, 1.2), c: CONFETTI[i % CONFETTI.length],
      s: rand(0.7, 1.2), v: rand(0.03, 0.07), ph: rand(10),
    }));
  }

  layout(e) {
    this.bg = verticalGradient(e.g, 0, e.h, SKIES.hub);
    this.btn = { x: e.w / 2, y: e.h * (e.portrait ? 0.74 : 0.76), r: clamp(e.min * 0.14, 54, 120) };
    this.emiS = e.min * (e.portrait ? 0.11 : 0.13);
    // Emi stands on an invisible line above the button so the two never touch.
    this.emiY = this.btn.y - this.btn.r * 1.35;
  }

  enter() { /* audio cannot start yet - waiting on the first touch */ }
  exit() { this.p.clear(); }

  onDown(p, e) {
    this.press.to(1);
    this.p.sparkle(p.x, p.y, ['#fff', C.yellow, C.pink], 12, e.min * 0.2);
    if (this.phase === 'idle') {
      this.begin();
    } else if (this.phase === 'ready') {
      this.launch();
    }
  }

  onUp() {
    this.press.to(0);
  }

  async begin() {
    this.phase = 'loading';
    const bus = this.game.audio;
    bus.init();
    bus.resume();
    bus.setMuted(state.muted);
    // A click the instant she touches, before anything is decoded, so the
    // screen never feels dead.
    try {
      const ctx = bus.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    } catch { /* not important */ }

    await this.game.audio.preload(['xylophone', 'harp'], (v) => { this.progress = v; });
    this.progress = 1;
    this.phase = 'ready';
    this.pop.set(0);
    this.pop.to(1);
    this.game.music.play('hub');
    this.game.audio.arp('xylophone', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], { step: 0.07, vol: 0.6 });
  }

  launch() {
    const e = this.game.engine;
    this.game.audio.play('start');
    this.p.confetti(this.btn.x, this.btn.y, CONFETTI, 40, e.min * 1.0);
    this.game.engine.go(new HubScene(this.game), '#fff8e7');
  }

  update(dt, e) {
    this.t += dt;
    this.press.update(dt);
    this.pop.update(dt);
    this.p.update(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 5);
    this.clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.3;
    });
    this.balloons.forEach((b) => {
      b.y -= b.v * dt;
      if (b.y < -0.25) {
        b.y = 1.25;
        b.x = rand(0.06, 0.94);
      }
    });
    if (this.phase === 'ready' && this.t % 3 < dt) {
      this.p.sparkle(rand(e.w * 0.2, e.w * 0.8), rand(e.h * 0.2, e.h * 0.5), ['#fff', C.yellow], 6, e.min * 0.1);
    }
  }

  draw(g, e) {
    g.fillStyle = this.bg;
    g.fillRect(0, 0, e.w, e.h);
    const t = this.t;

    sun(g, e.w * 0.86, e.h * 0.14, e.min * 0.08, t);
    rainbow(g, e.w * 0.2, e.h * 0.42, e.min * 0.34, e.min * 0.02, 0.4);

    this.clouds.forEach((c) => {
      g.save();
      g.translate(c.x * e.w * 1.3 - e.w * 0.15, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      cloud(g, e.min * 0.3 * c.s, e.min * 0.08 * c.s, t + c.x * 8);
      g.fill();
      g.restore();
    });

    // drifting balloons
    this.balloons.forEach((b) => {
      const x = b.x * e.w + Math.sin(t * 1.1 + b.ph) * e.min * 0.03;
      const y = b.y * e.h;
      const r = e.min * 0.055 * b.s;
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(t * 1.3 + b.ph) * 0.1);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = Math.max(1, r * 0.07);
      g.beginPath();
      g.moveTo(0, r * 1.15);
      g.quadraticCurveTo(r * 0.3, r * 2, 0, r * 2.8);
      g.stroke();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 1.9, [lighten(b.c, 0.45), b.c, b.c]);
      g.beginPath();
      g.ellipse(0, 0, r * 0.86, r, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.ellipse(-r * 0.3, -r * 0.36, r * 0.22, r * 0.13, -0.5, 0, TAU);
      g.fill();
      g.restore();
    });

    // title
    const wob = Math.sin(t * 1.6) * 0.02;
    g.save();
    g.translate(e.w / 2, e.h * (e.portrait ? 0.17 : 0.15));
    g.rotate(wob);
    const size = Math.max(30, e.min * (e.portrait ? 0.13 : 0.15));
    label(g, 'עולם של אמי', 0, 0, size, C.magentaDark, { stroke: '#fff', sw: size * 0.24 });
    for (let i = 0; i < 3; i++) {
      const a = t * 1.4 + i * 2.1;
      const rx = Math.cos(a) * size * 2.3;
      const ry = Math.sin(a * 1.3) * size * 0.5;
      g.save();
      g.translate(rx, ry);
      g.rotate(a);
      g.fillStyle = [C.yellow, C.pink, C.sky][i];
      starPath(g, 5, size * 0.2, size * 0.09);
      g.fill();
      g.restore();
    }
    g.restore();

    // Emi
    g.save();
    g.translate(e.w / 2, this.emiY - this.emiS * EMI_FEET);
    groundShadow(g, 0, this.emiS * EMI_FEET, this.emiS * 0.7, 0.14);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.phase === 'ready' ? 0.8 : 0, { wave: this.phase === 'ready' ? 1 : 0.35 });
    g.restore();

    // button / progress
    const b = this.btn;
    const beat = this.phase === 'ready' ? 1 + Math.sin(t * 3.4) * 0.045 : 1;
    const r = b.r * beat * (1 - this.press.value * 0.07);
    g.save();
    g.translate(b.x, b.y);
    if (this.phase === 'loading') {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      circle(g, 0, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.08)';
      g.lineWidth = r * 0.14;
      circle(g, 0, 0, r * 0.8);
      g.stroke();
      g.strokeStyle = C.magenta;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, 0, r * 0.8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(this.shown, 0.02, 1));
      g.stroke();
      // spinning notes while it loads
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + (i / 3) * TAU;
        g.fillStyle = [C.sky, C.yellow, C.lime][i];
        circle(g, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.08);
        g.fill();
      }
    } else {
      g.fillStyle = 'rgba(40,30,60,0.18)';
      circle(g, 0, r * 0.1, r);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 2, [lighten(C.lime, 0.4), C.lime, C.greenDark]);
      circle(g, 0, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = r * 0.08;
      circle(g, 0, 0, r * 0.92);
      g.stroke();
      // play triangle (RTL: pointing left, the direction the language reads)
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(-r * 0.34, 0);
      g.lineTo(r * 0.24, -r * 0.34);
      g.lineTo(r * 0.24, r * 0.34);
      g.closePath();
      g.fill();
    }
    g.restore();

    const cap = this.phase === 'idle' ? 'לגעת כדי להתחיל'
      : this.phase === 'loading' ? 'רק רגע...'
      : 'יאללה, בואי נשחק!';
    label(g, cap, e.w / 2, b.y + b.r * 1.5, Math.max(15, e.min * 0.045), C.ink, { stroke: '#fff', sw: e.min * 0.018 });

    this.p.draw(g);
  }
}
