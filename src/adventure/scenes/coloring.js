// Colouring book.
//
// A line drawing made of closed regions. She picks a crayon, touches a region,
// and the colour spreads out from her finger to fill it - no going over the
// lines, no half-coloured blobs, so every picture looks like she meant it.
// Touching a coloured region again with another crayon just recolours it.
//
// When every region has colour the picture celebrates and a big arrow offers
// the next page; she can also keep colouring the one she has.
//
// Pictures are Path2D regions in a 100x100 space, hit-tested top-most first.

import { TAU, Spring, rand, clamp, ease, Schedule } from '../../core/util.js';
import { C } from '../../core/palette.js';
import { circle, radial, roundRect } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { PAINTS, glow, rays, card, twinkle } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#d6ecff', '#eef7ff', '#fffaf2'];

// --- picture builders ------------------------------------------------------------

const E = (cx, cy, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot, 0, TAU); return p; };
const R = (x, y, w, h, r = 0) => {
  const p = new Path2D();
  if (!r) { p.rect(x, y, w, h); return p; }
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
  return p;
};
const Poly = (...pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const Line = (fn) => { const p = new Path2D(); fn(p); return p; };
const BG = () => R(0, 0, 100, 100);

// Each picture: regions (bottom to top) and line-only details drawn over them.
const PICTURES = [
  {
    id: 'ball', name: 'כדור', regions: () => [
      BG(),
      E(50, 92, 40, 7),
      E(50, 52, 34, 34),
      Line((p) => { p.moveTo(50, 18); p.bezierCurveTo(30, 35, 30, 70, 50, 86); p.bezierCurveTo(70, 70, 70, 35, 50, 18); p.closePath(); }),
    ],
    details: () => [],
  },
  {
    id: 'icecream', name: 'גלידה', regions: () => [
      BG(),
      Poly([34, 52], [66, 52], [50, 95]),
      E(50, 50, 20, 9),
      E(38, 40, 14, 14),
      E(62, 40, 14, 14),
      E(50, 26, 15, 15),
      E(50, 9, 5, 5),
    ],
    details: () => [Line((p) => { p.moveTo(40, 62); p.lineTo(58, 74); p.moveTo(60, 62); p.lineTo(43, 80); p.moveTo(50, 9 - 5); p.quadraticCurveTo(52, 1, 57, 1); })],
  },
  {
    id: 'flower', name: 'פרח', regions: () => [
      BG(),
      Poly([30, 78], [70, 78], [64, 98], [36, 98]),
      R(47.5, 46, 5, 33),
      E(37, 64, 11, 5, -0.5),
      E(63, 60, 11, 5, 0.5),
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * TAU - Math.PI / 2;
        return E(50 + Math.cos(a) * 15, 30 + Math.sin(a) * 15, 10, 7, a);
      }),
      E(50, 30, 9, 9),
    ],
    details: () => [],
  },
  {
    id: 'butterfly', name: 'פרפר', regions: () => [
      BG(),
      E(30, 36, 20, 16, -0.4),
      E(70, 36, 20, 16, 0.4),
      E(33, 64, 14, 12, 0.4),
      E(67, 64, 14, 12, -0.4),
      E(28, 35, 7, 6),
      E(72, 35, 7, 6),
      E(34, 65, 5, 4),
      E(66, 65, 5, 4),
      E(50, 52, 5, 22),
      E(50, 27, 6, 6),
    ],
    details: () => [Line((p) => { p.moveTo(48, 22); p.quadraticCurveTo(42, 10, 36, 9); p.moveTo(52, 22); p.quadraticCurveTo(58, 10, 64, 9); })],
  },
  {
    id: 'fish', name: 'דג', regions: () => [
      BG(),
      Line((p) => { p.moveTo(0, 88); p.quadraticCurveTo(50, 80, 100, 88); p.lineTo(100, 100); p.lineTo(0, 100); p.closePath(); }),
      Poly([72, 50], [94, 32], [94, 68]),
      Line((p) => { p.moveTo(40, 32); p.quadraticCurveTo(52, 16, 62, 34); p.closePath(); }),
      E(46, 50, 30, 19),
      Line((p) => { p.moveTo(36, 33); p.quadraticCurveTo(28, 50, 36, 67); p.quadraticCurveTo(44, 50, 36, 33); }),
      E(18, 18, 5, 5), E(10, 30, 3.5, 3.5), E(24, 8, 3, 3),
      Line((p) => { p.moveTo(8, 100); p.quadraticCurveTo(2, 88, 8, 72); p.quadraticCurveTo(14, 88, 12, 100); p.closePath(); }),
    ],
    details: () => [Line((p) => { p.arc(28, 46, 3, 0, TAU); p.moveTo(18, 56); p.quadraticCurveTo(22, 60, 26, 57); })],
  },
  {
    id: 'house', name: 'בית', regions: () => [
      BG(),
      Line((p) => { p.moveTo(0, 82); p.quadraticCurveTo(50, 72, 100, 82); p.lineTo(100, 100); p.lineTo(0, 100); p.closePath(); }),
      E(84, 14, 9, 9),
      R(62, 20, 8, 18),
      R(24, 48, 52, 38),
      Poly([18, 50], [50, 22], [82, 50]),
      R(44, 62, 13, 24, 6),
      R(29, 56, 11, 11, 2),
      R(61, 56, 11, 11, 2),
      E(14, 22, 10, 6), E(24, 19, 9, 7),
    ],
    details: () => [Line((p) => { p.moveTo(34.5, 56); p.lineTo(34.5, 67); p.moveTo(29, 61.5); p.lineTo(40, 61.5); p.moveTo(66.5, 56); p.lineTo(66.5, 67); p.moveTo(61, 61.5); p.lineTo(72, 61.5); p.moveTo(54, 75); p.arc(53, 75, 1, 0, TAU); })],
  },
  {
    id: 'rainbow', name: 'קשת', regions: () => [
      BG(),
      ...[42, 36, 30, 24, 18].map((r) => Line((p) => { p.arc(50, 74, r, Math.PI, 0); p.arc(50, 74, r - 6, 0, Math.PI, true); p.closePath(); })),
      E(18, 76, 14, 9), E(30, 72, 10, 8),
      E(82, 76, 14, 9), E(70, 72, 10, 8),
      E(84, 14, 9, 9),
    ],
    details: () => [],
  },
  {
    id: 'car', name: 'מכונית', regions: () => [
      BG(),
      R(0, 80, 100, 20),
      Line((p) => { p.moveTo(30, 52); p.lineTo(38, 34); p.lineTo(64, 34); p.lineTo(74, 52); p.closePath(); }),
      R(12, 50, 76, 22, 8),
      Poly([34, 50], [40, 38], [50, 38], [50, 50]),
      Poly([54, 50], [54, 38], [62, 38], [69, 50]),
      E(30, 74, 10, 10), E(70, 74, 10, 10),
      E(30, 74, 4, 4), E(70, 74, 4, 4),
      E(86, 58, 3, 3),
    ],
    details: () => [Line((p) => { p.moveTo(52, 54); p.lineTo(52, 68); p.moveTo(56, 58); p.lineTo(60, 58); })],
  },
];

const TUNING = [
  { pics: ['ball', 'icecream', 'flower'], paints: 8, magic: false },
  { pics: ['butterfly', 'icecream', 'fish', 'flower'], paints: 9, magic: false },
  { pics: ['house', 'butterfly', 'fish', 'rainbow'], paints: 10, magic: true },
  { pics: ['car', 'house', 'rainbow', 'butterfly', 'fish'], paints: 10, magic: true },
];

const RAINBOW = ['#ff4d5e', '#ff9a1f', '#ffd93d', '#5fcf5f', '#4fa8ff', '#a774ff'];

export class ColoringScene extends IslandBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'calm', id: 'coloring', hue: '#4fa8ff', goals: [1, 2, 2, 2] });
    this.sched = new Schedule();
    this.hitCtx = document.createElement('canvas').getContext('2d');
    this.page = 0;
    this.sel = 0;
    this.nextBtn = { press: new Spring(0, 300, 16), pop: new Spring(0, 150, 10) };
    this.newPicture();
  }

  newPicture() {
    this.tune = this.levels.pick(TUNING);
    const id = this.tune.pics[this.page % this.tune.pics.length];
    this.page++;
    const def = PICTURES.find((p) => p.id === id);
    this.pic = def;
    this.regions = def.regions().map((path) => ({ path, color: null, prev: null, k: 1, ox: 50, oy: 50 }));
    this.details = def.details();
    this.done = false;
    this.doneT = 0;
    this.bounce = new Spring(1, 200, 10);
    this.nextBtn.pop.set(0);
    this.paints = PAINTS.slice(0, this.tune.paints).map((p) => ({ ...p, press: new Spring(0, 300, 16) }));
    if (this.tune.magic) {
      this.paints.push({ c: 'rainbow', name: 'קשת', press: new Spring(0, 300, 16) });
      this.paints.push({ c: 'gold', name: 'זהב', press: new Spring(0, 300, 16) });
    }
    this.sel = Math.min(this.sel, this.paints.length - 1);
    if (this.game.engine.w) this.layout(this.game.engine);
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.sched.in(0.5, () => speak(`בואי נצבע ${this.pic.name}`, { music: this.game.music }));
  }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    const top = (e.topBand || 0) + e.min * 0.02;
    const n = this.paints.length;
    if (P) {
      // Two rows on a narrow screen: one row of ten would make each crayon
      // smaller than a fingertip.
      const rows = n > 6 ? 2 : 1;
      const perRow = Math.ceil(n / rows);
      this.crayR = clamp(Math.min(e.w / perRow / 2.3, e.min * 0.07), 18, 46);
      const trayH = rows * this.crayR * 3 + this.crayR;
      const size = Math.min(e.w * 0.92, e.h - top - trayH - e.min * 0.04);
      this.pg = { x: (e.w - size) / 2, y: top + (e.h - top - trayH - size) / 2, s: size };
      const gap = Math.min(this.crayR * 2.3, (e.w * 0.94) / perRow);
      this.paints.forEach((p, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const inRow = Math.min(perRow, n - r * perRow);
        p.x = e.w / 2 + ((inRow - 1) / 2 - c) * gap;
        p.y = e.h - trayH + this.crayR * 1.8 + r * this.crayR * 3;
      });
    } else {
      this.crayR = clamp(Math.min((e.h - top) / n / 2.25, e.min * 0.06), 18, 46);
      const size = Math.min(e.h - top - e.min * 0.04, e.w - this.crayR * 7);
      this.pg = { x: (e.w - this.crayR * 4 - size) / 2, y: top + (e.h - top - size) / 2, s: size };
      const gap = Math.min(this.crayR * 2.25, (e.h - top) / n);
      const midY = top + (e.h - top) / 2;
      this.paints.forEach((p, i) => {
        p.x = e.w - this.crayR * 2.6;
        p.y = midY + (i - (n - 1) / 2) * gap;
      });
    }
    this.nextBtn.x = this.pg.x + this.pg.s - this.pg.s * 0.02;
    this.nextBtn.y = this.pg.y + this.pg.s - this.pg.s * 0.02;
    this.nextBtn.r = clamp(e.min * 0.075, 30, 64);
  }

  toUnit(x, y) {
    return [((x - this.pg.x) / this.pg.s) * 100, ((y - this.pg.y) / this.pg.s) * 100];
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    // next page arrow
    const nb = this.nextBtn;
    if (this.done && nb.pop.value > 0.5 && Math.hypot(p.x - nb.x, p.y - nb.y) < nb.r * 1.3) {
      nb.press.to(1);
      this.audio.play('swipe', { vol: 0.7 });
      this.newPicture();
      speak(`עכשיו ${this.pic.name}`, { music: this.game.music });
      return;
    }
    for (let i = 0; i < this.paints.length; i++) {
      const c = this.paints[i];
      if (Math.hypot(p.x - c.x, p.y - c.y) < this.crayR * 1.15) {
        this.sel = i;
        c.press.kick(-12);
        this.audio.play('tap', { vol: 0.6 });
        this.audio.note('xylophone', ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'G6', 'C7'][i], { vol: 0.45 });
        speak(c.name, { music: this.game.music });
        return;
      }
    }
    const [ux, uy] = this.toUnit(p.x, p.y);
    if (ux < 0 || uy < 0 || ux > 100 || uy > 100) {
      this.p.sparkle(p.x, p.y, ['#fff', C.sky], 6, e.min * 0.08);
      return;
    }
    const hc = this.hitCtx;
    for (let i = this.regions.length - 1; i >= 0; i--) {
      if (hc.isPointInPath(this.regions[i].path, ux, uy)) {
        this.fill(this.regions[i], ux, uy, p, e);
        return;
      }
    }
  }

  fill(r, ux, uy, p, e) {
    const paint = this.paints[this.sel];
    if (r.color === paint.c && r.k >= 1) {
      this.p.sparkle(p.x, p.y, ['#fff'], 5, e.min * 0.06);
      return;
    }
    r.prev = r.color;
    r.color = paint.c;
    r.k = 0;
    r.ox = ux;
    r.oy = uy;
    this.audio.play('pop', { vol: 0.5 });
    this.audio.randomNote('harp', 'pentatonicHigh', { vol: 0.4 });
    const col = paint.c === 'rainbow' ? RAINBOW[Math.floor(rand(6))] : paint.c === 'gold' ? '#ffd23d' : paint.c;
    this.p.sparkle(p.x, p.y, ['#fff', col], 10, e.min * 0.1);
    this.game.magic?.burst(p.x, p.y, { n: 14, power: 0.4, colors: [col.startsWith('#') && col.length === 7 ? col : '#ffd93d', '#ffffff'] });
    if (!this.done && this.regions.every((k) => k.color)) this.sched.in(0.5, () => this.complete(e));
  }

  complete(e) {
    if (this.done) return;
    this.done = true;
    this.doneT = 0;
    this.bounce.kick(4);
    const cx = this.pg.x + this.pg.s / 2, cy = this.pg.y + this.pg.s / 2;
    this.reward(cx, cy, { stars: 2, big: true });
    speak(`איזה ${this.pic.name} יפה!`, { music: this.game.music });
    this.scoreLevel(1, e);
    this.sched.in(1.2, () => { this.nextBtn.pop.to(1); this.audio.play('chime', { vol: 0.5 }); });
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.bounce.update(dt);
    for (const r of this.regions) if (r.k < 1) r.k = Math.min(1, r.k + dt * 2.6);
    for (const c of this.paints) c.press.update(dt);
    this.nextBtn.press.update(dt);
    if (this.nextBtn.press.target === 1 && this.nextBtn.press.value > 0.9) this.nextBtn.press.to(0);
    this.nextBtn.pop.update(dt);
    if (this.done) this.doneT += dt;
  }

  // Resolves a stored colour (plain, rainbow or gold) into a fill style in the
  // picture's 100x100 space.
  style(g, c) {
    if (c === 'rainbow') {
      const gr = g.createLinearGradient(0, 0, 100, 100);
      RAINBOW.forEach((col, i) => gr.addColorStop(i / (RAINBOW.length - 1), col));
      return gr;
    }
    if (c === 'gold') {
      const gr = g.createLinearGradient(0, 0, 100, 100);
      ['#fff2a8', '#ffd23d', '#e8a91f', '#fff2a8', '#ffcf3d'].forEach((col, i) => gr.addColorStop(i / 4, col));
      return gr;
    }
    return c;
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    const pg = this.pg;
    if (this.done) rays(g, pg.x + pg.s / 2, pg.y + pg.s / 2, e.max * 0.7, t, 'rgba(255,255,255,0.35)', 18);

    // page
    const b = this.bounce.value;
    g.save();
    g.translate(pg.x + pg.s / 2, pg.y + pg.s / 2);
    g.scale(b, b);
    g.translate(-pg.s / 2, -pg.s / 2);
    card(g, -pg.s * 0.02, -pg.s * 0.02, pg.s * 1.04, pg.s * 1.04, pg.s * 0.04, { fill: '#ffffff' });
    const k = pg.s / 100;
    g.scale(k, k);
    g.save();
    g.beginPath();
    g.rect(0, 0, 100, 100);
    g.clip();
    for (const r of this.regions) {
      if (r.prev && r.k < 1) {
        g.fillStyle = this.style(g, r.prev);
        g.fill(r.path);
      }
      if (r.color) {
        g.save();
        g.clip(r.path);
        g.fillStyle = this.style(g, r.color);
        if (r.k < 1) {
          g.beginPath();
          g.arc(r.ox, r.oy, 150 * ease.outCubic(r.k), 0, TAU);
          g.fill();
        } else {
          g.fill(r.path);
        }
        // a soft inner shading so flat fills look painted
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fill(r.path);
        g.restore();
      }
    }
    g.restore();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = '#3d3a52';
    g.lineWidth = 0.95;
    // the background rect needs no outline
    for (let i = 1; i < this.regions.length; i++) g.stroke(this.regions[i].path);
    g.lineWidth = 0.8;
    for (const d of this.details) g.stroke(d);
    // gold leaves a twinkle or two behind
    for (const r of this.regions) {
      if (r.color !== 'gold') continue;
      const s = 1.8 + Math.sin(t * 4 + r.ox) * 1.2;
      if (s > 0.5) twinkle(g, r.ox, r.oy, s, '#ffffff');
    }
    g.restore();

    // crayons
    this.paints.forEach((c, i) => this.drawCrayon(g, c, i === this.sel, t));

    // next page arrow
    const nb = this.nextBtn;
    const np = ease.outBack(clamp(nb.pop.value, 0, 1.2));
    if (np > 0.01) {
      const r = nb.r * np * (1 + Math.sin(t * 4) * 0.05) * (1 - nb.press.value * 0.1);
      g.save();
      g.translate(nb.x, nb.y);
      glow(g, 0, 0, r * 2, '#fff3a0', 0.5);
      g.fillStyle = 'rgba(30,60,120,0.2)';
      circle(g, 0, r * 0.1, r);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 2, ['#9fd8ff', '#4fa8ff', '#2f7ed6']);
      circle(g, 0, 0, r);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = r * 0.08;
      circle(g, 0, 0, r * 0.88);
      g.stroke();
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(-r * 0.42, 0);
      g.lineTo(r * 0.05, -r * 0.4);
      g.lineTo(r * 0.05, -r * 0.16);
      g.lineTo(r * 0.42, -r * 0.16);
      g.lineTo(r * 0.42, r * 0.16);
      g.lineTo(r * 0.05, r * 0.16);
      g.lineTo(r * 0.05, r * 0.4);
      g.closePath();
      g.fill();
      g.restore();
    }

    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawCrayon(g, c, selected, t) {
    const r = this.crayR;
    const P = this.game.engine.portrait;
    g.save();
    g.translate(c.x, c.y);
    // the chosen crayon slides out toward the page and glows
    const out = selected ? r * 0.55 : 0;
    if (P) g.translate(0, -out + c.press.value * r * 0.2);
    else g.translate(-out + c.press.value * r * 0.2, 0);
    g.rotate(P ? 0 : -Math.PI / 2);
    if (selected) glow(g, 0, -r * 0.3, r * 1.6, '#ffffff', 0.7);
    const fill = c.c === 'rainbow'
      ? (() => { const gr = g.createLinearGradient(0, -r, 0, r); RAINBOW.forEach((col, i) => gr.addColorStop(i / 5, col)); return gr; })()
      : c.c === 'gold' ? radial(g, -r * 0.2, -r * 0.3, r * 1.4, ['#fff6c0', '#ffd23d', '#d99a12']) : c.c;
    const w = r * 0.78, h = r * 2;
    g.fillStyle = 'rgba(40,30,60,0.2)';
    roundRect(g, -w / 2 + r * 0.08, -h / 2 + r * 0.6, w, h, r * 0.15);
    g.fill();
    g.fillStyle = fill;
    roundRect(g, -w / 2, -h / 2 + r * 0.5, w, h, r * 0.15);
    g.fill();
    // paper wrapper
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(-w / 2, -h / 2 + r * 1.2, w, r * 0.5);
    // tip
    g.fillStyle = '#f7dcb4';
    g.beginPath();
    g.moveTo(-w / 2, -h / 2 + r * 0.52);
    g.lineTo(0, -h / 2 - r * 0.25);
    g.lineTo(w / 2, -h / 2 + r * 0.52);
    g.closePath();
    g.fill();
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(-w * 0.2, -h / 2 + r * 0.06);
    g.lineTo(0, -h / 2 - r * 0.25);
    g.lineTo(w * 0.2, -h / 2 + r * 0.06);
    g.closePath();
    g.fill();
    if (c.c === '#ffffff') {
      g.strokeStyle = 'rgba(60,60,90,0.35)';
      g.lineWidth = 1.5;
      roundRect(g, -w / 2, -h / 2 + r * 0.5, w, h, r * 0.15);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(-w * 0.32, -h / 2 + r * 0.6, w * 0.14, h * 0.8);
    g.restore();
    void t;
  }
}
