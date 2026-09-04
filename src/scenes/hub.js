// The map. Six activity buttons on a hillside, with Emi standing in the middle.
//
// Layout is 3x2 in landscape and 2x3 in portrait, computed from the viewport
// every time it changes, so the same code fills a laptop window and a tablet
// held either way.

import { TAU, Spring, rand, pick } from '../core/util.js';
import { C, SKIES, TOYS, CONFETTI } from '../core/palette.js';
import {
  circle, roundRect, sun, cloud, hill, grassTufts, quadY, label, radial, star as starPath,
  lighten, darken, groundShadow, rainbow, flower, alpha,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { drawEmi, LAND, EMI_FEET } from '../core/creatures.js';
import { state, stickerCount } from '../core/state.js';

export class HubScene extends SceneBase {
  constructor(game) {
    super(game, { sky: SKIES.hub, music: 'hub', home: false });
    this.nodes = TOYS.map((toy, i) => ({
      ...toy,
      i,
      x: 0, y: 0, r: 0,
      press: new Spring(0, 300, 16),
      pop: new Spring(1, 130, 9),
      hover: 0,
    }));
    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: rand(1), y: rand(0.08, 0.34), s: rand(0.6, 1.25), v: rand(0.004, 0.013), ph: rand(10),
    }));
    this.flowers = Array.from({ length: 14 }, () => ({
      x: rand(1), y: rand(0.72, 0.99), c: pick([C.pink, C.yellow, C.white, C.magenta]), s: rand(0.7, 1.3),
    }));
    this.emiWave = new Spring(0, 120, 10);
    this.emiJump = new Spring(0, 200, 11);
    this.showAlbum = false;
    this.albumT = new Spring(0, 190, 15);
    this.butterflies = Array.from({ length: 3 }, () => ({
      x: rand(1), y: rand(0.4, 0.7), ph: rand(10), v: rand(0.02, 0.05), dir: pick([-1, 1]),
    }));
  }

  enter(e) {
    super.enter();
    this.audio.play('start', { vol: 0.7 });
    this.emiWave.set(1);
    this.emiWave.to(0);
    this.t = 0;
  }

  layout(e) {
    super.layout(e);
    const cols = e.portrait ? 2 : 3;
    const rows = e.portrait ? 3 : 2;
    // Buttons live in the lower two thirds; the sky above stays clear so the
    // scene reads as a place rather than a menu.
    const top = e.h * (e.portrait ? 0.24 : 0.3);
    const bottom = e.h * 0.93;
    const gapY = (bottom - top) / rows;
    const gapX = e.w / cols;
    const r = Math.min(gapX * 0.34, gapY * 0.36, e.min * 0.15);
    this.nodes.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // RTL: first activity sits on the right, matching how the labels read.
      n.x = e.w - (col + 0.5) * gapX;
      n.y = top + (row + 0.5) * gapY;
      n.r = r;
    });
    this.horizon = e.h * (e.portrait ? 0.2 : 0.26);
    this.emiS = e.min * (e.portrait ? 0.07 : 0.085);
    // She stands in the gap between two columns of buttons, feet on the bottom
    // edge, so she never sits on top of a label.
    this.emiX = e.w * (1 - 1 / cols);
    this.emiY = e.h - e.min * 0.012 - this.emiS * EMI_FEET;
    // The album goes in the top-left corner: the hub has no home button, so
    // that corner is the only piece of chrome-free screen left.
    this.albumBtn = { x: this.hud.r + e.min * 0.035, y: this.hud.r + e.min * 0.035, r: this.hud.r };
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (this.showAlbum) {
      this.showAlbum = false;
      this.albumT.to(0);
      this.audio.play('close');
      return;
    }
    for (const n of this.nodes) {
      if (Math.hypot(p.x - n.x, p.y - n.y) < n.r * 1.15) {
        p.data = n;
        n.press.to(1);
        this.audio.play('tap', { vol: 0.5 });
        this.audio.note('xylophone', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'][n.i], { vol: 0.55 });
        return;
      }
    }
    // Emi herself is tappable - she jumps and giggles. Nothing on this screen
    // should be inert.
    if (Math.hypot(p.x - this.emiX, p.y - (this.emiY - this.emiS * 0.7)) < this.emiS * 1.5) {
      this.emiJump.set(0);
      this.emiJump.kick(9);
      this.emiWave.set(1);
      this.emiWave.to(0);
      this.audio.play('boing', { vol: 0.6 });
      this.audio.arp('xylophone', ['C6', 'E6', 'G6'], { step: 0.05, vol: 0.5 });
      this.p.sparkle(this.emiX, this.emiY - this.emiS * 1.6, ['#fff', C.yellow, C.pink], 14, e.min * 0.2);
      return;
    }
    if (Math.hypot(p.x - this.albumBtn.x, p.y - this.albumBtn.y) < this.albumBtn.r * 1.3) {
      this.showAlbum = true;
      this.albumT.to(1);
      this.audio.play('open');
      return;
    }
    // Tapping anywhere else drops a little flower, so exploring is rewarded.
    this.p.petals(p.x, p.y, [C.pink, C.yellow, C.white, C.magenta], 6);
    this.audio.play('plink', { vol: 0.3, rate: rand(0.9, 1.5) });
  }

  onUp(p, e) {
    this.hud.onUp(p);
    const n = p.data;
    if (n && n.press) {
      n.press.to(0);
      if (Math.hypot(p.x - n.x, p.y - n.y) < n.r * 1.4) {
        this.audio.play('start', { vol: 0.8 });
        this.p.confetti(n.x, n.y, CONFETTI, 20, e.min * 0.7);
        this.game.goScene(n.id);
      }
    }
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.nodes.forEach((n) => {
      n.press.update(dt);
      n.pop.update(dt);
    });
    this.emiWave.update(dt);
    this.emiJump.update(dt);
    this.albumT.update(dt);
    this.clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > 1.25) c.x = -0.3;
    });
    this.butterflies.forEach((b) => {
      b.x += b.dir * b.v * dt;
      if (b.x > 1.1) b.dir = -1;
      if (b.x < -0.1) b.dir = 1;
    });
    // Idle: one button breathes at a time, cycling, as a hint to touch it.
    if (this.idle > 4) {
      const which = Math.floor(this.idle / 1.6) % this.nodes.length;
      const n = this.nodes[which];
      if (n.pop.idle) {
        n.pop.set(1);
        n.pop.kick(3.4);
      }
    }
  }

  // The hillside itself: hills, meadow, grass and flowers. Baked once, because
  // repainting a full-screen landscape every frame is what makes a canvas game
  // stutter on a tablet.
  paintBackdrop(g, e) {
    const t = 0;
    if (stickerCount() > 3) {
      rainbow(g, e.w * 0.8, this.horizon * 1.5, e.min * 0.3, e.min * 0.022, 0.5);
    }
    hill(g, e.w * 0.2, this.horizon + e.h * 0.1, e.w * 0.7, e.h * 0.16, '#8ed36f', 0);
    hill(g, e.w * 0.85, this.horizon + e.h * 0.08, e.w * 0.6, e.h * 0.13, '#7bc75f', 1);
    g.fillStyle = '#96da78';
    g.beginPath();
    g.moveTo(0, this.horizon + e.h * 0.06);
    g.quadraticCurveTo(e.w * 0.5, this.horizon - e.h * 0.02, e.w, this.horizon + e.h * 0.05);
    g.lineTo(e.w, e.h);
    g.lineTo(0, e.h);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath();
    g.moveTo(0, this.horizon + e.h * 0.06);
    g.quadraticCurveTo(e.w * 0.5, this.horizon - e.h * 0.02, e.w, this.horizon + e.h * 0.05);
    g.quadraticCurveTo(e.w * 0.5, this.horizon + e.h * 0.06, 0, this.horizon + e.h * 0.09);
    g.closePath();
    g.fill();

    const ridge = (x) => quadY(x / e.w, this.horizon + e.h * 0.06, this.horizon - e.h * 0.02, this.horizon + e.h * 0.05);
    grassTufts(g, e.w, Math.max(10, Math.round(e.w / 46)), 'rgba(86,166,66,0.55)', ridge, e.min * 0.03);

    this.flowers.forEach((f) => {
      g.save();
      g.translate(f.x * e.w, f.y * e.h);
      g.scale(f.s, f.s);
      g.rotate(Math.sin(t * 1.4 + f.x * 9) * 0.08);
      g.strokeStyle = '#5aa845';
      g.lineWidth = e.min * 0.006;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -e.min * 0.032);
      g.stroke();
      g.translate(0, -e.min * 0.04);
      g.fillStyle = f.c;
      flower(g, 5, e.min * 0.015, e.min * 0.012);
      g.fillStyle = C.yellow;
      circle(g, 0, 0, e.min * 0.009);
      g.fill();
      g.restore();
    });
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    sun(g, e.w * 0.14, this.horizon * 0.5, e.min * 0.075, t);

    this.clouds.forEach((c) => {
      g.save();
      g.translate(c.x * e.w * 1.2 - e.w * 0.1, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      cloud(g, e.min * 0.3 * c.s, e.min * 0.085 * c.s, t * 0.6 + c.ph);
      g.fill();
      g.restore();
    });

    this.butterflies.forEach((b) => {
      const y = b.y * e.h + Math.sin(t * 2.4 + b.ph) * e.min * 0.03;
      g.save();
      g.translate(b.x * e.w, y);
      g.scale(b.dir, 1);
      const flap = Math.sin(t * 16 + b.ph);
      g.fillStyle = C.pink;
      for (const s of [-1, 1]) {
        g.save();
        g.scale(1, s);
        g.rotate(flap * 0.3);
        g.beginPath();
        g.ellipse(0, -e.min * 0.012, e.min * 0.016, e.min * 0.01, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.fillStyle = C.ink;
      roundRect(g, -e.min * 0.003, -e.min * 0.008, e.min * 0.006, e.min * 0.018, e.min * 0.003);
      g.fill();
      g.restore();
    });

    // activity buttons
    this.nodes.forEach((n) => {
      const press = n.press.value;
      const pop = n.pop.value;
      const att = this.attractPulse(2.4);
      const r = n.r * (1 - press * 0.09) * pop;
      g.save();
      g.translate(n.x, n.y + press * n.r * 0.05);
      groundShadow(g, 0, r * 1.02, r * 0.86, 0.18);

      // ring of colour
      g.fillStyle = alpha(n.hue, 0.28);
      circle(g, 0, 0, r * (1.16 + att * 0.05));
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 1.8, [lighten(n.hue, 0.42), n.hue, darken(n.hue, 0.18)]);
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      g.globalAlpha = 0.4;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(-r * 0.32, -r * 0.42, r * 0.34, r * 0.2, -0.5, 0, TAU);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = r * 0.07;
      circle(g, 0, 0, r * 0.94);
      g.stroke();

      g.save();
      g.scale(r, r);
      ICONS[n.id](g, t, n.i);
      g.restore();
      g.restore();

      label(g, n.label, n.x, n.y + r * 1.34, Math.max(13, r * 0.34), C.ink, { stroke: '#fff', sw: r * 0.14 });
    });

    // Emi
    const jump = Math.max(0, this.emiJump.value) * e.min * 0.06;
    g.save();
    g.translate(this.emiX, this.emiY - jump);
    groundShadow(g, 0, jump * 0.4, this.emiS * 0.6, 0.2 - jump * 0.0015);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.emiWave.value * 0.6, { wave: this.emiWave.value });
    g.restore();

    // sticker album button
    const ab = this.albumBtn;
    g.save();
    g.translate(ab.x, ab.y);
    g.fillStyle = 'rgba(40,30,60,0.16)';
    circle(g, 0, ab.r * 0.1, ab.r);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    circle(g, 0, 0, ab.r);
    g.fill();
    g.fillStyle = C.magenta;
    starPath(g, 5, ab.r * 0.62, ab.r * 0.3);
    g.fill();
    label(g, `${stickerCount()}`, 0, ab.r * 0.06, ab.r * 0.46, '#fff', { stroke: null });
    g.restore();

    this.p.draw(g);

    if (this.albumT.value > 0.01) this.drawAlbum(g, e);
    this.drawHud(g, e);

    if (this.idle > 9 && !this.showAlbum) {
      label(g, 'תבחרי משחק!', e.w / 2, this.horizon * 0.62, Math.max(20, e.min * 0.055), C.ink, {
        stroke: '#fff', sw: e.min * 0.02,
      });
      g.globalAlpha = 1;
    }
  }

  // The album: every creature and prop she has found, greyed out until then.
  drawAlbum(g, e) {
    const a = this.albumT.value;
    g.save();
    g.globalAlpha = a * 0.55;
    g.fillStyle = '#2a2140';
    g.fillRect(0, 0, e.w, e.h);
    g.globalAlpha = 1;
    const w = Math.min(e.w * 0.92, e.min * 1.5);
    const h = e.h * 0.76;
    const x = (e.w - w) / 2;
    const y = (e.h - h) / 2 + (1 - a) * e.h * 0.4;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = C.offWhite;
    roundRect(g, x, y, w, h, e.min * 0.06);
    g.fill();
    g.strokeStyle = C.magenta;
    g.lineWidth = e.min * 0.012;
    g.stroke();
    label(g, 'האוסף של אמי', e.w / 2, y + h * 0.09, Math.max(18, e.min * 0.05), C.magentaDark, { stroke: null });

    const cols = e.portrait ? 4 : 6;
    const cell = w / (cols + 0.6);
    const startX = x + w - cell * 0.9;
    const startY = y + h * 0.2;
    LAND.forEach((an, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX - col * cell;
      const cy = startY + row * cell * 1.15;
      const have = state.stickers[an.id];
      g.save();
      g.translate(cx, cy);
      g.fillStyle = have ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.06)';
      circle(g, 0, 0, cell * 0.42);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(0, 0, cell * 0.42, 0, TAU);
      g.clip();
      g.translate(0, cell * 0.06);
      g.scale(cell * 0.3, cell * 0.3);
      if (have) {
        an.draw(g, this.t + i, 0, i);
      } else {
        g.globalAlpha = 0.25;
        g.fillStyle = '#6b5b7a';
        circle(g, 0, 0, 0.9);
        g.fill();
      }
      g.restore();
      if (have > 1) {
        g.fillStyle = C.magenta;
        circle(g, cell * 0.3, -cell * 0.3, cell * 0.15);
        g.fill();
        label(g, String(have), cell * 0.3, -cell * 0.29, cell * 0.2, '#fff', { stroke: null });
      }
      g.restore();
    });
    label(g, 'לגעת בכל מקום כדי לחזור', e.w / 2, y + h * 0.94, Math.max(12, e.min * 0.03), C.inkSoft, { stroke: null });
    g.restore();
    g.restore();
  }
}

// Button icons, drawn in a unit circle of radius 1.
const ICONS = {
  balloons(g, t) {
    const sway = Math.sin(t * 1.8) * 0.06;
    [[-0.3, C.red, 0], [0.3, C.sky, 1.1], [0, C.yellow, 2.2]].forEach(([x, c, ph], i) => {
      g.save();
      g.translate(x + Math.sin(t * 1.5 + ph) * 0.04, -0.1 + Math.cos(t * 1.2 + ph) * 0.05 + (i === 2 ? -0.28 : 0));
      g.rotate(sway);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 0.035;
      g.beginPath();
      g.moveTo(0, 0.38);
      g.quadraticCurveTo(0.06, 0.62, 0, 0.82);
      g.stroke();
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(0, 0, 0.28, 0.34, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(-0.1, -0.13, 0.08, 0.05, -0.5, 0, TAU);
      g.fill();
      g.restore();
    });
  },
  animals(g, t) {
    g.save();
    g.scale(0.62, 0.62);
    g.translate(0, 0.1);
    LAND[0].draw(g, t, 0, 1);
    g.restore();
  },
  music(g, t) {
    const cols = [C.red, C.orange, C.yellow, C.lime, C.teal];
    cols.forEach((c, i) => {
      const bounce = Math.max(0, Math.sin(t * 3 - i * 0.5)) * 0.07;
      g.fillStyle = c;
      roundRect(g, -0.56 + i * 0.23, -0.42 - bounce + i * 0.03, 0.17, 0.72 - i * 0.06, 0.06);
      g.fill();
    });
    g.fillStyle = '#fff';
    g.save();
    g.translate(0.42, -0.5);
    g.rotate(Math.sin(t * 2) * 0.3);
    roundRect(g, -0.04, 0, 0.08, 0.5, 0.04);
    g.fill();
    circle(g, 0, 0.02, 0.1);
    g.fill();
    g.restore();
  },
  shapes(g, t) {
    g.save();
    g.rotate(Math.sin(t * 1.2) * 0.1);
    g.fillStyle = C.red;
    circle(g, -0.32, -0.2, 0.26);
    g.fill();
    g.fillStyle = C.sky;
    g.save();
    g.translate(0.3, -0.22);
    g.rotate(t * 0.4);
    roundRect(g, -0.24, -0.24, 0.48, 0.48, 0.07);
    g.fill();
    g.restore();
    g.fillStyle = C.yellow;
    g.beginPath();
    g.moveTo(0, 0.12);
    g.lineTo(0.32, 0.6);
    g.lineTo(-0.32, 0.6);
    g.closePath();
    g.fill();
    g.restore();
  },
  paint(g, t) {
    g.save();
    g.rotate(-0.3);
    g.fillStyle = '#fff8e7';
    g.beginPath();
    g.ellipse(0, 0.05, 0.62, 0.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    circle(g, 0.3, 0.16, 0.12);
    g.fill();
    [[-0.28, -0.16, C.red], [0.02, -0.26, C.yellow], [0.3, -0.12, C.teal], [-0.22, 0.18, C.indigo]].forEach(([x, y, c]) => {
      g.fillStyle = c;
      circle(g, x, y, 0.13);
      g.fill();
    });
    g.restore();
    g.save();
    g.translate(0.3, -0.42);
    g.rotate(0.5 + Math.sin(t * 3) * 0.2);
    g.fillStyle = '#b5794f';
    roundRect(g, -0.05, -0.1, 0.1, 0.62, 0.05);
    g.fill();
    g.fillStyle = C.magenta;
    g.beginPath();
    g.moveTo(-0.09, -0.1);
    g.quadraticCurveTo(0, -0.38, 0.09, -0.1);
    g.closePath();
    g.fill();
    g.restore();
  },
  ocean(g, t) {
    g.save();
    g.scale(0.72, 0.72);
    g.translate(0.1, 0.1);
    g.rotate(Math.sin(t * 2) * 0.08);
    g.scale(-1, 1);
    g.save();
    g.translate(-0.72, 0);
    g.rotate(Math.sin(t * 5) * 0.3);
    g.fillStyle = C.orangeDark;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-0.46, -0.42, -0.5, 0);
    g.quadraticCurveTo(-0.46, 0.42, 0, 0);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = C.orange;
    g.beginPath();
    g.ellipse(0, 0, 0.76, 0.54, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#fff';
    circle(g, 0.3, -0.1, 0.16);
    g.fill();
    g.fillStyle = C.ink;
    circle(g, 0.36, -0.1, 0.08);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 0.05;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(-0.45 + i * 0.1, 0.6 - i * 0.06, 0.1 + i * 0.03, 0, TAU);
      g.stroke();
    }
  },
};
