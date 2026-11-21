// Title screen for the island.
//
// The first tap unlocks sound (browsers insist on a touch first) and starts
// loading the samples; the screen keeps something moving the whole time so a
// three year old never stares at a frozen picture.

import { TAU, Spring, clamp } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, label, sun, cloud, radial, verticalGradient, star as starPath, lighten, groundShadow, rainbow } from '../../core/gfx.js';
import { Particles } from '../../core/fx.js';
import { drawEmi, EMI_FEET } from '../../core/creatures.js';
import { state } from '../../core/state.js';
import {
  ISLAND_SKY, paintSea, paintIsland, palm, castle, shoreWaves, hotAirBalloon, boat, makeMotes, drawMotes, seaGlints, sunBeams } from '../scenery.js';
import { glow, twinkle } from '../art.js';
import { speak } from '../speech.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.musicName = 'island';
    this.t = 0;
    this.p = new Particles();
    this.phase = 'idle';
    this.progress = 0;
    this.shown = 0;
    this.press = new Spring(0, 300, 16);
    this.pop = new Spring(0, 150, 11);
    this.motes = makeMotes(30);
    this.clouds = Array.from({ length: 4 }, (_, i) => ({ x: i / 4 + 0.1, y: 0.08 + (i % 2) * 0.1, s: 0.8 + (i % 3) * 0.2 }));
  }

  layout(e) {
    const P = e.portrait;
    this.horizon = e.h * (P ? 0.5 : 0.52);
    this.isl = { cx: e.w / 2, cy: e.h * (P ? 0.66 : 0.7), rx: Math.min(e.w * 0.46, e.min * (P ? 0.48 : 0.75)), ry: e.h * (P ? 0.13 : 0.17) };
    this.btn = { x: e.w / 2, y: e.h * (P ? 0.8 : 0.78), r: clamp(e.min * 0.105, 46, 100) };
    this.emiS = e.min * (P ? 0.1 : 0.115);
    this.emiX = e.w / 2 + (P ? 0 : e.min * 0.42);
    this.emiY = P ? this.btn.y - this.btn.r * 1.3 : this.isl.cy;
    if (P) this.emiX = e.w / 2;
    this.bake(e);
  }

  // Sky, sea and island never move: painted once per layout.
  bake(e) {
    const c = this.back || (this.back = document.createElement('canvas'));
    c.width = Math.max(1, Math.round(e.w * e.dpr));
    c.height = Math.max(1, Math.round(e.h * e.dpr));
    const g = c.getContext('2d');
    g.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    g.fillStyle = verticalGradient(g, 0, this.horizon, ISLAND_SKY);
    g.fillRect(0, 0, e.w, this.horizon + 2);
    rainbow(g, e.w * 0.5, this.horizon, e.min * 0.62, e.min * 0.03, 0.32);
    paintSea(g, e, this.horizon);
    const I = this.isl;
    paintIsland(g, I.cx, I.cy, I.rx, I.ry);
    castle(g, I.cx - I.rx * 0.05, I.cy - I.ry * 0.35, I.ry * 1.25);
    palm(g, I.cx - I.rx * 0.68, I.cy + I.ry * 0.1, I.ry * 1.0, 1);
    palm(g, I.cx + I.rx * 0.7, I.cy + I.ry * 0.15, I.ry * 0.85, -1);
    palm(g, I.cx - I.rx * 0.45, I.cy + I.ry * 0.45, I.ry * 0.7, -1);
  }

  enter() { /* waiting on the first touch */ }
  exit() { this.p.clear(); }

  onDown(p, e) {
    this.press.to(1);
    this.p.sparkle(p.x, p.y, ['#fff', C.yellow, C.pink], 12, e.min * 0.2);
    if (this.phase === 'idle') this.begin();
    else if (this.phase === 'ready') this.launch();
  }

  onUp() { this.press.to(0); }

  async begin() {
    this.phase = 'loading';
    const bus = this.game.audio;
    bus.init();
    bus.resume();
    bus.setMuted(state.muted);
    await bus.preload(['xylophone', 'harp', 'flute', 'piano'], (v) => { this.progress = v; });
    this.progress = 1;
    this.phase = 'ready';
    this.pop.set(0);
    this.pop.to(1);
    this.game.music.play('island');
    bus.arp('harp', ['F5', 'A5', 'C6', 'F6', 'A6', 'C7'], { step: 0.08, vol: 0.6 });
    speak('האי הקסום של אמי', { music: this.game.music });
    this.game.magic?.fireworks(4);
  }

  launch() {
    const e = this.game.engine;
    this.game.audio.play('start');
    this.p.confetti(this.btn.x, this.btn.y, CONFETTI, 44, e.min * 1.0);
    this.game.goHub();
  }

  update(dt, e) {
    this.t += dt;
    this.press.update(dt);
    this.pop.update(dt);
    this.p.update(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 5);
    for (const c of this.clouds) {
      c.x += dt * 0.01;
      if (c.x > 1.25) c.x = -0.25;
    }
    if (this.phase === 'ready' && Math.random() < dt * 1.5) {
      this.p.sparkle(Math.random() * e.w, Math.random() * this.horizon, ['#fff', C.yellow], 5, e.min * 0.08);
    }
  }

  draw(g, e) {
    const t = this.t;
    if (this.back) g.drawImage(this.back, 0, 0, this.back.width, this.back.height, 0, 0, e.w, e.h);
    sunBeams(g, e.w * 0.85, e.h * 0.12, e.max * 0.55, t);
    sun(g, e.w * 0.85, e.h * 0.12, e.min * 0.07, t);
    for (const c of this.clouds) {
      g.save();
      g.translate(c.x * e.w, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      cloud(g, e.min * 0.26 * c.s, e.min * 0.07 * c.s, t + c.x * 8);
      g.fill();
      g.restore();
    }
    hotAirBalloon(g, e.w * 0.14, e.h * 0.25, e.min * 0.1, t);
    boat(g, e.w * 0.86, this.horizon + (e.h - this.horizon) * 0.2, e.min * 0.07, t);
    const I = this.isl;
    seaGlints(g, e, this.horizon, t);
    shoreWaves(g, I.cx, I.cy, I.rx, I.ry, t);

    // title, with a soft glow and orbiting stars
    const size = Math.max(30, e.min * (e.portrait ? 0.105 : 0.12));
    const ty = e.h * (e.portrait ? 0.2 : 0.22);
    glow(g, e.w / 2, ty, size * 3.2, '#fff4c8', 0.45);
    g.save();
    g.translate(e.w / 2, ty);
    g.rotate(Math.sin(t * 1.4) * 0.02);
    label(g, 'האי הקסום', 0, -size * 0.55, size, '#a245d9', { stroke: '#fff', sw: size * 0.26 });
    label(g, 'של אמי', 0, size * 0.62, size * 0.85, '#ff5fa2', { stroke: '#fff', sw: size * 0.24 });
    for (let i = 0; i < 5; i++) {
      const a = t * 0.9 + (i / 5) * TAU;
      twinkle(g, Math.cos(a) * size * 2.8, Math.sin(a) * size * 0.95, size * (0.14 + 0.06 * Math.sin(t * 4 + i)),
        [C.yellow, '#fff', C.pink, C.sky, '#fff'][i]);
    }
    g.restore();

    // Emi
    g.save();
    g.translate(this.emiX, this.emiY - this.emiS * EMI_FEET);
    groundShadow(g, 0, this.emiS * EMI_FEET, this.emiS * 0.7, 0.16);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.phase === 'ready' ? 0.8 : 0, { wave: this.phase === 'ready' ? 1 : 0.4 });
    g.restore();

    drawMotes(g, e, this.motes, t);

    // button
    const b = this.btn;
    const beat = this.phase === 'ready' ? 1 + Math.sin(t * 3.4) * 0.05 : 1;
    const r = b.r * beat * (1 - this.press.value * 0.07);
    g.save();
    g.translate(b.x, b.y);
    if (this.phase === 'loading') {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      circle(g, 0, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.08)';
      g.lineWidth = r * 0.14;
      circle(g, 0, 0, r * 0.78);
      g.stroke();
      g.strokeStyle = '#ff5fa2';
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, 0, r * 0.78, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(this.shown, 0.02, 1));
      g.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 2.4 + (i / 3) * TAU;
        g.fillStyle = [C.sky, C.yellow, C.lime][i];
        g.save();
        g.translate(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38);
        starPath(g, 5, r * 0.14, r * 0.06, a);
        g.fill();
        g.restore();
      }
    } else {
      glow(g, 0, 0, r * 1.9, '#fff3a0', 0.4 * (this.phase === 'ready' ? 1 : 0.5));
      g.fillStyle = 'rgba(60,30,90,0.2)';
      circle(g, 0, r * 0.1, r);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 2, [lighten('#ff7ac0', 0.45), '#ff5fa2', '#d93d7f']);
      circle(g, 0, 0, r);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = r * 0.08;
      circle(g, 0, 0, r * 0.9);
      g.stroke();
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
      : 'יוצאות להרפתקה!';
    label(g, cap, e.w / 2, b.y + b.r * 1.42, Math.max(15, e.min * 0.042), C.ink, { stroke: '#fff', sw: e.min * 0.016 });

    this.p.draw(g);
  }
}
