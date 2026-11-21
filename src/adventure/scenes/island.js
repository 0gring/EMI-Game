// The island map: six magical places around Emi, each a glowing medallion.
//
// Places sit on an ellipse around the middle of the island, so the same layout
// works on a wide tablet and a tall phone. A tap bounces the place, says its
// name, and Emi skips over to it before the scene opens - the small delay is
// what makes it feel like going somewhere rather than pressing a menu.

import { TAU, Spring, rand, clamp, ease, lerp } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, label, sun, cloud, radial, lighten, darken, groundShadow, roundRect, star as starPath, rainbow, verticalGradient, flower } from '../../core/gfx.js';
import { IslandBase } from '../base.js';
import { drawEmi, EMI_FEET, LAND } from '../../core/creatures.js';
import { levelOf, MAX_LEVEL } from '../../core/levels.js';
import { ISLAND_SKY, paintSea, paintIsland, palm, castle, shoreWaves, hotAirBalloon, boat, gull, makeMotes, drawMotes,
  seaGlints, sunBeams, dolphin, butterfly } from '../scenery.js';
import { glow, rays, twinkle, drawTier, drawCandle, drawBloom, drawCarrot, PAINTS } from '../art.js';
import { speak } from '../speech.js';

export const PLACES = [
  { id: 'cake', label: 'עוגה', say: 'בואי נאפה עוגה', hue: '#ff7ab8' },
  { id: 'puzzle', label: 'פאזל', say: 'פאזל', hue: '#ffa53d' },
  { id: 'memory', label: 'זיכרון', say: 'משחק זיכרון', hue: '#8f7cff' },
  { id: 'feed', label: 'חיות רעבות', say: 'החיות רעבות', hue: '#5fcf6f' },
  { id: 'coloring', label: 'צביעה', say: 'צובעים', hue: '#4fb0ff' },
  { id: 'garden', label: 'גינה', say: 'הגינה הקסומה', hue: '#ffcf3d' },
];

// --- medallion icons, unit radius 1 ------------------------------------------

function iconCake(g, t) {
  g.save();
  g.translate(0, 0.55);
  drawTier(g, 1.3, 0.55, '#f5c983', '#ff85c8', t, 1);
  g.translate(0, -0.55);
  drawTier(g, 0.9, 0.45, '#f5c983', '#ffffff', t, 2);
  g.translate(0, -0.45);
  drawCandle(g, 0.42, '#57c7ff', 1, t, 0);
  g.restore();
}

function iconPuzzle(g) {
  const piece = (col, x, y, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = radial(g, -0.2, -0.2, 0.9, [lighten(col, 0.35), col, darken(col, 0.2)]);
    g.beginPath();
    g.moveTo(-0.4, -0.4);
    g.lineTo(-0.1, -0.4);
    g.arc(0, -0.45, 0.13, Math.PI * 0.8, Math.PI * 0.2, false);
    g.lineTo(0.4, -0.4);
    g.lineTo(0.4, -0.1);
    g.arc(0.45, 0, 0.13, -Math.PI * 0.7, Math.PI * 0.7, false);
    g.lineTo(0.4, 0.4);
    g.lineTo(-0.4, 0.4);
    g.closePath();
    g.fill();
    g.restore();
  };
  piece('#ffd93d', -0.28, -0.2, -0.15);
  piece('#ff6b8a', 0.32, 0.25, 0.2);
}

function iconMemory(g, t) {
  for (const [x, rot, face] of [[-0.32, -0.18, false], [0.32, 0.16, true]]) {
    g.save();
    g.translate(x, 0.05);
    g.rotate(rot);
    g.fillStyle = 'rgba(40,20,80,0.2)';
    roundRect(g, -0.36, -0.46, 0.72, 0.98, 0.12);
    g.fill();
    g.fillStyle = face ? '#fffaf0' : radial(g, -0.1, -0.2, 0.9, ['#b8a8ff', '#8f7cff', '#6a54e0']);
    roundRect(g, -0.36, -0.52, 0.72, 0.98, 0.12);
    g.fill();
    if (face) {
      g.fillStyle = '#ff6b8a';
      g.save();
      g.translate(0, -0.03);
      starPath(g, 5, 0.26, 0.12, Math.sin(t) * 0.2);
      g.fill();
      g.restore();
    } else {
      label(g, '?', 0, -0.02, 0.5, '#fff', { stroke: null });
    }
    g.restore();
  }
}

function iconFeed(g, t) {
  g.save();
  g.translate(-0.12, 0.05);
  g.scale(0.62, 0.62);
  LAND.find((a) => a.id === 'bunny').draw(g, t, 0.3, 3);
  g.restore();
  g.save();
  g.translate(0.55, 0.35);
  g.scale(0.38, 0.38);
  g.rotate(Math.sin(t * 2) * 0.15);
  drawCarrot(g);
  g.restore();
}

function iconColoring(g, t) {
  const cols = [PAINTS[0].c, PAINTS[2].c, PAINTS[3].c, PAINTS[4].c, PAINTS[5].c];
  cols.forEach((c, i) => {
    g.save();
    g.rotate(-0.8 + i * 0.4);
    g.translate(0, -0.05 + Math.sin(t * 2 + i) * 0.03);
    g.fillStyle = c;
    roundRect(g, -0.1, -0.2, 0.2, 0.85, 0.06);
    g.fill();
    g.beginPath();
    g.moveTo(-0.1, -0.2);
    g.lineTo(0, -0.5);
    g.lineTo(0.1, -0.2);
    g.closePath();
    g.fillStyle = '#f7dcb4';
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-0.035, -0.4);
    g.lineTo(0, -0.5);
    g.lineTo(0.035, -0.4);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(-0.1, 0.1, 0.2, 0.08);
    g.restore();
  });
}

function iconGarden(g, t) {
  const stem = (x, h) => {
    g.strokeStyle = '#3fae49';
    g.lineWidth = 0.07;
    g.beginPath();
    g.moveTo(x, 0.6);
    g.lineTo(x, 0.6 - h);
    g.stroke();
  };
  stem(-0.42, 0.7); stem(0, 0.95); stem(0.42, 0.65);
  for (const [x, y, k, c, s] of [[-0.42, -0.1, 'tulip', '#ff5d7a', 0.32], [0, -0.35, 'sunflower', '#ffcf3d', 0.4], [0.42, -0.05, 'daisy', '#ffffff', 0.3]]) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    drawBloom(g, k, c, 1, t + x);
    g.restore();
  }
  g.fillStyle = '#8a5a3c';
  roundRect(g, -0.7, 0.55, 1.4, 0.25, 0.12);
  g.fill();
}

const ICONS = { cake: iconCake, puzzle: iconPuzzle, memory: iconMemory, feed: iconFeed, coloring: iconColoring, garden: iconGarden };

export class IslandScene extends IslandBase {
  constructor(game) {
    super(game, { sky: ISLAND_SKY, music: 'island', home: false });
    this.nodes = PLACES.map((pl, i) => ({
      ...pl, i, x: 0, y: 0, r: 0,
      press: new Spring(0, 300, 16),
      pop: new Spring(0, 120, 9),
    }));
    this.clouds = Array.from({ length: 4 }, () => ({ x: rand(1), y: rand(0.04, 0.2), s: rand(0.6, 1.2), v: rand(0.004, 0.012) }));
    this.gulls = Array.from({ length: 3 }, () => ({ x: rand(1), y: rand(0.08, 0.3), v: rand(0.02, 0.04), ph: rand(10) }));
    this.motes = makeMotes(22);
    this.emi = { x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, k: 1, jump: new Spring(0, 200, 11) };
    this.going = null;
    this.goT = 0;
    // A dolphin leaps out of the sea every few seconds, somewhere new each time.
    this.dolphin = { k: -1, next: 2.5 };
    this.flies = Array.from({ length: 3 }, (_, i) => ({ ph: rand(10), c: ['#ff85c8', '#ffd93d', '#9fd8ff'][i], a: rand(TAU) }));
  }

  // A leap that stays in open water: start and end both clear of the island.
  newLeap(e) {
    const I = this.isl;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const span = e.min * 0.22;
    const roomBelow = I.cy + I.ry * 1.2 < e.h - e.min * 0.06;
    let x0, y0;
    if (roomBelow && Math.random() < 0.5) {
      x0 = rand(e.w * 0.15, e.w * 0.85 - span);
      y0 = rand(I.cy + I.ry * 1.22, e.h - e.min * 0.03);
    } else {
      const left = Math.random() < 0.5;
      x0 = left ? rand(e.w * 0.02, Math.max(e.w * 0.03, I.cx - I.rx * 1.12 - span))
        : rand(Math.min(e.w * 0.97 - span, I.cx + I.rx * 1.12), e.w * 0.97 - span);
      y0 = rand(this.horizon + e.min * 0.1, this.horizon + (e.h - this.horizon) * 0.3);
    }
    Object.assign(this.dolphin, { k: 0, x0: dir > 0 ? x0 : x0 + span, y0, dir, span, h: e.min * 0.14, splashed: false });
    this.p.splash(this.dolphin.x0, y0, '#d8f4ff', 10);
  }

  enter() {
    super.enter();
    this.audio.play('start', { vol: 0.6 });
    // Places pop in one after another, like the island waking up.
    this.nodes.forEach((n) => n.pop.set(0));
    this.t = 0;
  }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    const top = e.topBand || 0;
    this.horizon = e.h * (P ? 0.2 : 0.24);
    this.isl = {
      cx: e.w / 2,
      cy: P ? e.h * 0.58 : e.h * 0.6,
      rx: P ? e.w * 0.47 : Math.min(e.w * 0.47, e.h * 0.95),
      ry: P ? e.h * 0.37 : e.h * 0.36,
    };
    const I = this.isl;
    this.nodeR = clamp(Math.min(e.min * (P ? 0.15 : 0.125), (P ? e.w : e.h) * 0.15), 34, 120);
    // Ring of places, starting at the top and going round. Pulled in from the
    // island edge by the node radius so labels never fall into the sea.
    const rx = I.rx - this.nodeR * 1.35;
    const ry = I.ry - this.nodeR * 1.05;
    this.nodes.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / this.nodes.length) * TAU + Math.PI / 6;
      n.x = I.cx + Math.cos(a) * rx;
      n.y = Math.max(top + this.nodeR * 1.2, I.cy + Math.sin(a) * ry - this.nodeR * 0.15);
      n.r = this.nodeR;
    });
    this.emiS = this.nodeR * 0.62;
    this.emi.x = this.emi.fx = this.emi.tx = I.cx;
    this.emi.y = this.emi.fy = this.emi.ty = I.cy + this.emiS * 0.6;
  }

  paintBackdrop(g, e) {
    g.fillStyle = verticalGradient(g, 0, this.horizon, ISLAND_SKY.slice(0, 3));
    g.fillRect(0, 0, e.w, this.horizon + 1);
    paintSea(g, e, this.horizon);
    const I = this.isl;
    rainbow(g, e.w * 0.78, this.horizon + 2, e.min * 0.2, e.min * 0.018, 0.4);
    paintIsland(g, I.cx, I.cy, I.rx, I.ry);
    // Dotted path linking the places, a loop round the island.
    g.save();
    g.strokeStyle = 'rgba(255,240,200,0.9)';
    g.lineWidth = Math.max(4, this.nodeR * 0.16);
    g.lineCap = 'round';
    g.setLineDash([this.nodeR * 0.02, this.nodeR * 0.3]);
    g.beginPath();
    this.nodes.forEach((n, i) => (i ? g.lineTo(n.x, n.y) : g.moveTo(n.x, n.y)));
    g.closePath();
    g.stroke();
    g.restore();
    // decorations scattered between places
    castle(g, I.cx, I.cy - this.emiS * 0.9, this.nodeR * 1.1);
    const s = this.nodeR * 0.8;
    palm(g, I.cx - I.rx * 0.9, I.cy + I.ry * 0.1, s, 1);
    palm(g, I.cx + I.rx * 0.9, I.cy - I.ry * 0.05, s * 0.9, -1);
    palm(g, I.cx + I.rx * 0.55, I.cy + I.ry * 0.8, s * 0.75, -1);
    const fcols = ['#ff85c8', '#ffd93d', '#ffffff', '#c6a4ff'];
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, rr = 0.3 + ((i * 37) % 60) / 100;
      const x = I.cx + Math.cos(a) * I.rx * rr * 0.85;
      const y = I.cy + Math.sin(a) * I.ry * rr * 0.8;
      g.fillStyle = fcols[i % 4];
      g.save();
      g.translate(x, y);
      flower(g, 5, this.nodeR * 0.05, this.nodeR * 0.045);
      g.fillStyle = '#ffd93d';
      circle(g, 0, 0, this.nodeR * 0.03);
      g.fill();
      g.restore();
    }
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (this.going) return;
    for (const n of this.nodes) {
      if (Math.hypot(p.x - n.x, p.y - n.y) < n.r * 1.3) {
        this.pick(n, e);
        return;
      }
    }
    // Empty island still answers: a little shower of sparkles and a note.
    this.p.sparkle(p.x, p.y, ['#fff', C.yellow, C.pink], 10, e.min * 0.12);
    this.audio.randomNote('harp', 'pentatonicHigh', { vol: 0.35 });
    this.emi.jump.kick(-8);
  }

  pick(n, e) {
    this.going = n;
    this.goT = 0;
    n.press.to(1);
    n.press.kick(-10);
    this.audio.play('open', { vol: 0.8 });
    this.audio.arp('harp', ['C5', 'E5', 'G5', 'C6'], { step: 0.05, vol: 0.5 });
    this.p.confetti(n.x, n.y, CONFETTI, 22, e.min * 0.6);
    this.p.sparkle(n.x, n.y, ['#fff', C.yellow], 14, n.r);
    speak(n.say, { music: this.game.music });
    const em = this.emi;
    em.fx = em.x; em.fy = em.y;
    em.tx = lerp(this.isl.cx, n.x, 0.6);
    em.ty = lerp(this.emi.y, n.y + n.r * 0.6, 0.6);
    em.k = 0;
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.nodes.forEach((n, i) => {
      if (this.t > 0.15 + i * 0.09 && n.pop.target === 0) n.pop.to(1);
      n.pop.update(dt);
      n.press.update(dt);
      if (n.press.target === 1 && n.press.value > 0.9) n.press.to(0);
    });
    const em = this.emi;
    em.jump.update(dt);
    if (em.k < 1) {
      em.k = Math.min(1, em.k + dt * 1.9);
      const k = ease.inOutQuad(em.k);
      em.x = lerp(em.fx, em.tx, k);
      em.y = lerp(em.fy, em.ty, k) - Math.abs(Math.sin(k * Math.PI * 3)) * this.emiS * 0.35;
    }
    if (this.going) {
      this.goT += dt;
      if (this.goT > 0.65) {
        const id = this.going.id;
        this.going = { id: null };
        if (id) this.game.goScene(id);
      }
    }
    const d = this.dolphin;
    if (d.k < 0) {
      d.next -= dt;
      if (d.next <= 0) this.newLeap(e);
    } else {
      d.k += dt / 1.3;
      if (d.k > 0.92 && !d.splashed) {
        d.splashed = true;
        this.p.splash(d.x0 + d.dir * d.span, d.y0, '#d8f4ff', 14);
        this.audio.play('drop', { vol: 0.3 });
      }
      if (d.k >= 1) { d.k = -1; d.next = rand(4, 7); }
    }
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.3;
    }
    for (const gl of this.gulls) {
      gl.x += gl.v * dt;
      if (gl.x > 1.2) { gl.x = -0.2; gl.y = rand(0.06, 0.28); }
    }
    // After a few idle seconds one place sparkles to suggest itself.
    if (this.idle > 4 && Math.random() < dt * 1.2) {
      const n = this.nodes[Math.floor(this.t / 3) % this.nodes.length];
      this.p.sparkle(n.x + rand(-n.r, n.r), n.y + rand(-n.r, n.r), ['#fff', C.yellow], 3, n.r * 0.4);
    }
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    sunBeams(g, e.w * 0.1, this.horizon * 0.45, e.max * 0.5, t);
    sun(g, e.w * 0.1, this.horizon * 0.45, e.min * 0.055, t);
    for (const c of this.clouds) {
      g.save();
      g.translate(c.x * e.w, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      cloud(g, e.min * 0.2 * c.s, e.min * 0.055 * c.s, t + c.x * 6);
      g.fill();
      g.restore();
    }
    for (const gl of this.gulls) gull(g, gl.x * e.w, gl.y * this.horizon + e.min * 0.02, e.min * 0.018, t, gl.ph);
    hotAirBalloon(g, e.w * 0.9, this.horizon * 0.55 + e.min * 0.05, e.min * 0.06, t);
    const I = this.isl;
    boat(g, e.w * 0.08 + Math.sin(t * 0.1) * e.w * 0.02, Math.min(e.h - e.min * 0.06, I.cy + I.ry * 1.08), e.min * 0.05, t);
    seaGlints(g, e, this.horizon, t);
    const dl = this.dolphin;
    if (dl.k >= 0) {
      // position along a parabola, nose following the direction of travel
      const x = dl.x0 + dl.dir * dl.span * dl.k;
      const y = dl.y0 - Math.sin(dl.k * Math.PI) * dl.h;
      const rot = Math.atan2(-Math.cos(dl.k * Math.PI) * Math.PI * dl.h, dl.span);
      g.save();
      g.translate(x, y);
      g.scale(dl.dir, 1);
      dolphin(g, 0, 0, e.min * 0.06, rot);
      g.restore();
    }
    shoreWaves(g, I.cx, I.cy, I.rx, I.ry, t);

    // Emi, drawn before the medallions so a place she skips toward stays on top.
    const em = this.emi;
    g.save();
    g.translate(em.x, em.y - this.emiS * EMI_FEET + em.jump.value * this.emiS * 0.05);
    groundShadow(g, 0, this.emiS * EMI_FEET, this.emiS * 0.6, 0.16);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.going ? 1 : 0.2, { wave: this.idle > 2 ? 0.8 : 0.3 });
    g.restore();

    const hint = this.idle > 4 ? this.nodes[Math.floor(this.t / 3) % this.nodes.length] : null;
    for (const n of this.nodes) this.drawNode(g, e, n, t, n === hint);

    for (const f of this.flies) {
      const a = t * 0.35 + f.a;
      const x = I.cx + Math.cos(a) * I.rx * 0.75 + Math.sin(t * 1.7 + f.ph) * e.min * 0.04;
      const y = I.cy + Math.sin(a * 1.3) * I.ry * 0.7 + Math.cos(t * 2.3 + f.ph) * e.min * 0.03;
      butterfly(g, x, y, e.min * 0.02, t, f.c, f.ph);
    }
    drawMotes(g, e, this.motes, t);
    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawNode(g, e, n, t, hinted) {
    const pop = ease.outBack(clamp(n.pop.value, 0, 1.2));
    if (pop <= 0.01) return;
    const r = n.r * pop * (1 - n.press.value * 0.08) * (hinted ? 1 + Math.sin(t * 6) * 0.04 : 1);
    const bob = Math.sin(t * 1.6 + n.i) * r * 0.04;
    g.save();
    g.translate(n.x, n.y + bob);
    glow(g, 0, 0, r * 1.7, lighten(n.hue, 0.5), hinted ? 0.6 : 0.32);
    if (hinted) rays(g, 0, 0, r * 1.6, t, 'rgba(255,250,200,0.35)', 12);
    groundShadow(g, 0, r * 0.98, r * 0.85, 0.2);
    // medallion
    g.fillStyle = radial(g, -r * 0.35, -r * 0.45, r * 2, [lighten(n.hue, 0.55), n.hue, darken(n.hue, 0.25)]);
    circle(g, 0, 0, r);
    g.fill();
    g.fillStyle = radial(g, 0, -r * 0.1, r * 0.9, ['#ffffff', '#fff7fb', lighten(n.hue, 0.7)]);
    circle(g, 0, 0, r * 0.8);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = r * 0.07;
    circle(g, 0, 0, r * 0.9);
    g.stroke();
    // icon
    g.save();
    g.scale(r * 0.8, r * 0.8);
    ICONS[n.id](g, t + n.i);
    g.restore();
    // a band of light sweeps across each medallion now and then
    const sw = ((t * 0.35 + n.i * 0.17) % 1) * 3 - 1;
    if (sw > -0.6 && sw < 1.6) {
      g.save();
      circle(g, 0, 0, r * 0.98);
      g.clip();
      g.rotate(-0.6);
      const bx = (sw - 0.5) * r * 2.4;
      const sg = g.createLinearGradient(bx - r * 0.3, 0, bx + r * 0.3, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg;
      g.fillRect(bx - r * 0.3, -r * 1.5, r * 0.6, r * 3);
      g.restore();
    }
    for (let k = 0; k < 2; k++) {
      const a = t * (1.1 + n.i * 0.07) + k * Math.PI + n.i;
      const ss = r * (0.1 + 0.05 * Math.sin(t * 5 + k + n.i));
      twinkle(g, Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, ss, k ? '#fff6c0' : '#ffffff');
    }
    // gloss
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(-r * 0.35, -r * 0.55, r * 0.32, r * 0.14, -0.5, 0, TAU);
    g.fill();
    // level stars along the bottom of the rim
    const lv = levelOf(n.id);
    for (let k = 0; k < MAX_LEVEL; k++) {
      const a = Math.PI / 2 + (k - (MAX_LEVEL - 1) / 2) * 0.36;
      g.save();
      g.translate(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
      g.fillStyle = k < lv ? '#ffd93d' : 'rgba(255,255,255,0.85)';
      starPath(g, 5, r * 0.13, r * 0.06);
      g.fill();
      g.strokeStyle = k < lv ? '#e8a91f' : 'rgba(120,100,160,0.35)';
      g.lineWidth = r * 0.025;
      g.stroke();
      g.restore();
    }
    // ribbon label
    const fs = Math.max(13, r * 0.3);
    label(g, n.label, 0, r * 1.36, fs, darken(n.hue, 0.35), { stroke: '#fff', sw: fs * 0.32 });
    g.restore();
  }
}
