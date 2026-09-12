// Shape sorter.
//
// A wooden board with four holes and four loose shapes. Drag a shape anywhere
// near its hole and it snaps home. Several shapes can be dragged at once,
// because a toddler uses both hands.
//
// Forgiveness is the whole design: the snap radius is enormous, a wrong hole
// just nudges the piece back with a soft sound, and after a few misses the
// correct hole starts glowing.

import { TAU, Spring, rand, shuffled, clamp, lerp, ease } from '../core/util.js';
import { C, SKIES } from '../core/palette.js';
import {
  roundRect, label, radial, lighten, darken, star as starPath, heart, groundShadow, alpha,
  blob,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { drawEmi, EMI_FEET } from '../core/creatures.js';

const KINDS = [
  { id: 'circle', name: 'עיגול', note: 'C5' },
  { id: 'square', name: 'ריבוע', note: 'E5' },
  { id: 'triangle', name: 'משולש', note: 'G5' },
  { id: 'star', name: 'כוכב', note: 'A5' },
  { id: 'heart', name: 'לב', note: 'C6' },
  { id: 'hexagon', name: 'משושה', note: 'D5' },
];

const COLORS = [C.red, C.orange, C.yellow, C.lime, C.teal, C.sky, C.indigo, C.magenta, C.purple, C.pink];

// Shape outlines, unit radius 1, used for both the piece and its hole.
function path(g, kind, r) {
  switch (kind) {
    case 'circle':
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      break;
    case 'square':
      roundRect(g, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.18);
      break;
    case 'triangle': {
      const h = r * 1.05;
      g.beginPath();
      g.moveTo(0, -h);
      g.lineTo(r * 0.95, h * 0.72);
      g.lineTo(-r * 0.95, h * 0.72);
      g.closePath();
      break;
    }
    case 'star':
      starPath(g, 5, r * 1.05, r * 0.46);
      break;
    case 'heart':
      g.save();
      g.translate(0, r * 0.12);
      heart(g, r * 0.92);
      g.restore();
      break;
    case 'hexagon':
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      break;
  }
}

class Piece {
  constructor(kind, color, i) {
    this.kind = kind;
    this.color = color;
    this.i = i;
    this.x = 0; this.y = 0;
    this.homeX = 0; this.homeY = 0;
    this.r = 0;
    this.rot = rand(-0.25, 0.25);   // reset per round from the level's tilt
    this.held = null;
    this.placed = false;
    this.scale = new Spring(1, 220, 14);
    this.wrong = 0;
    this.settle = new Spring(0, 260, 15);
  }
}

// More shapes on the board each level, and they start a little more turned
// around. The snap radius shrinks only slightly and stays enormous - three hole
// widths even at the top level - because the lesson is which shape goes where,
// not how steady her hand is.
const TUNING = [
  { holes: 3, snap: 3.2, tilt: 0.15, boards: 2 },
  { holes: 4, snap: 3.0, tilt: 0.25, boards: 2 },
  { holes: 5, snap: 2.8, tilt: 0.4, boards: 2 },
  { holes: 6, snap: 2.6, tilt: 0.6, boards: 3 },
];

export class ShapeScene extends SceneBase {
  constructor(game) {
    super(game, {
      sky: SKIES.shapes, music: 'play', id: 'shapes', hue: C.orange,
      goals: [2, 2, 2, 3],
    });
    this.tune = TUNING[0];
    this.round = 0;
    this.pieces = [];
    this.holes = [];
    this.misses = 0;
    this.done = 0;
    this.cheer = 0;
    this.emiCheer = new Spring(0, 160, 11);
    this.roundT = 0;
  }

  enter(e) {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.tune = this.levels.pick(TUNING);
    this.newRound(e);
  }

  onLevelUp(level, e) {
    this.tune = this.levels.pick(TUNING);
  }

  layout(e) {
    super.layout(e);
    // Board across the top, loose pieces along the bottom. Six holes have to fit
    // across a phone as comfortably as three do, so the hole size follows the
    // count rather than only the screen.
    const n = this.tune.holes;
    this.holeR = Math.min(e.min * (e.portrait ? 0.1 : 0.11), (e.w / n) * 0.4);
    this.pieceR = this.holeR * 0.86;
    this.boardY = e.h * (e.portrait ? 0.33 : 0.34);
    this.boardH = this.holeR * 3.1;
    // Shorter drag on a tall screen: a two year old's reach is not long.
    this.trayY = e.h * (e.portrait ? 0.72 : 0.79);
    this.holes.forEach((h, i) => {
      h.x = e.w * ((i + 0.5) / n);
      h.y = this.boardY;
    });
    this.pieces.forEach((p, i) => {
      p.homeX = e.w * ((i + 0.5) / n);
      p.homeY = this.trayY;
      p.r = this.pieceR;
      if (!p.held && !p.placed) {
        p.x = p.homeX;
        p.y = p.homeY;
      }
      if (p.placed) {
        const h = this.holes.find((x) => x.kind === p.kind);
        p.x = h.x;
        p.y = h.y;
      }
    });
    this.emiS = e.min * 0.055;
  }

  newRound(e) {
    this.round++;
    this.misses = 0;
    this.done = 0;
    this.roundT = 0;
    const kinds = shuffled(KINDS).slice(0, this.tune.holes);
    const cols = shuffled(COLORS).slice(0, this.tune.holes);
    this.holes = kinds.map((k, i) => ({
      kind: k.id, name: k.name, note: k.note, x: 0, y: 0,
      glow: new Spring(0, 200, 14), filled: false, color: cols[i],
    }));
    // The pieces sit in a different order from the holes, or there is nothing
    // to work out.
    this.pieces = shuffled(kinds).map((k, i) => {
      const hole = this.holes.find((h) => h.kind === k.id);
      const piece = new Piece(k.id, hole.color, i);
      piece.rot = rand(-this.tune.tilt, this.tune.tilt);
      return piece;
    });
    this.layout(e);
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    // topmost unplaced piece under the finger
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const pc = this.pieces[i];
      if (pc.placed || pc.held) continue;
      if (Math.hypot(p.x - pc.x, p.y - pc.y) < pc.r * 1.45) {
        pc.held = p.id;
        pc.grabDX = pc.x - p.x;
        pc.grabDY = pc.y - p.y;
        pc.scale.to(1.18);
        p.data = pc;
        this.audio.play('grab', { vol: 0.5 });
        this.audio.note('xylophone', pc.kind === 'circle' ? 'C6' : 'E6', { vol: 0.35 });
        // bring to front
        this.pieces.splice(i, 1);
        this.pieces.push(pc);
        return;
      }
    }
    // Tapping a hole names the shape it wants - a small vocabulary lesson.
    for (const h of this.holes) {
      if (!h.filled && Math.hypot(p.x - h.x, p.y - h.y) < this.holeR * 1.3) {
        h.glow.set(1);
        h.glow.to(0);
        this.audio.play('plink', { vol: 0.4 });
        this.sayShape = { name: h.name, t: 1.6, x: h.x, y: h.y };
        return;
      }
    }
  }

  onMove(p, e) {
    const pc = p.data;
    if (!pc || !pc.kind) return;
    pc.x = p.x + pc.grabDX;
    pc.y = p.y + pc.grabDY;
    pc.rot = lerp(pc.rot, clamp(p.dx * 0.01, -0.3, 0.3), 0.2);
    // The matching hole lights up as she gets close, which is the hint that
    // teaches the match without words.
    const h = this.holes.find((x) => x.kind === pc.kind);
    if (h && !h.filled) {
      const d = Math.hypot(pc.x - h.x, pc.y - h.y);
      h.glow.to(d < this.holeR * 3.4 ? 1 : 0);
    }
  }

  onUp(p, e) {
    this.hud.onUp(p);
    const pc = p.data;
    if (!pc || !pc.kind) return;
    pc.held = null;
    pc.scale.to(1);
    p.data = null;

    const own = this.holes.find((h) => h.kind === pc.kind);
    // Generous: anywhere within three hole radii counts.
    const snapR = this.holeR * this.tune.snap;
    if (own && !own.filled && Math.hypot(pc.x - own.x, pc.y - own.y) < snapR) {
      this.place(pc, own, e);
      return;
    }
    // Landed on the wrong hole: bounce back, no penalty, no scary sound.
    const near = this.holes.find((h) => !h.filled && Math.hypot(pc.x - h.x, pc.y - h.y) < this.holeR * 1.5);
    if (near) {
      this.misses++;
      this.audio.play('nope', { vol: 0.4 });
      pc.wrong = 0.5;
      this.p.puff(pc.x, pc.y, 'rgba(255,255,255,0.5)', 5);
      if (own) {
        own.glow.set(1);
        own.glow.to(0);
      }
    }
    // Everything unplaced drifts back to the tray.
    pc.settle.set(0);
    pc.settle.to(1);
    pc.fromX = pc.x;
    pc.fromY = pc.y;
  }

  place(pc, hole, e) {
    pc.placed = true;
    hole.filled = true;
    pc.x = hole.x;
    pc.y = hole.y;
    pc.rot = 0;
    pc.scale.set(1.3);
    pc.scale.to(1);
    hole.glow.to(0);
    this.done++;

    this.audio.play('snap', { vol: 0.85, throttle: 0 });
    this.audio.note('xylophone', hole.note, { vol: 0.8 });
    this.p.confetti(hole.x, hole.y, [pc.color, lighten(pc.color, 0.4), '#fff'], 18, e.min * 0.6);
    this.p.ring(hole.x, hole.y, '#fff', this.holeR * 1.2, 0.45);
    this.sayShape = { name: hole.name, t: 1.6, x: hole.x, y: hole.y };
    e.kickShake(3);

    if (this.done >= this.holes.length) {
      this.cheer = 2.4;
      this.emiCheer.set(1);
      this.emiCheer.to(0);
      this.reward(e.cx, this.boardY, { stars: 3, big: true });
      this.scoreLevel(1, e);
      // Short pause to enjoy the finished board, then a fresh set.
      setTimeout(() => {
        if (this.game.engine.scene === this) this.newRound(this.game.engine);
      }, 2300);
    } else {
      this.reward(hole.x, hole.y, { stars: 1, sound: false });
    }
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.emiCheer.update(dt);
    this.roundT += dt;
    if (this.cheer > 0) this.cheer -= dt;
    if (this.sayShape) {
      this.sayShape.t -= dt;
      if (this.sayShape.t <= 0) this.sayShape = null;
    }
    this.holes.forEach((h) => h.glow.update(dt));
    this.pieces.forEach((p) => {
      p.scale.update(dt);
      p.settle.update(dt);
      if (p.wrong > 0) p.wrong = Math.max(0, p.wrong - dt * 2);
      if (!p.held && !p.placed && p.settle.target === 1) {
        const k = ease.outBack(clamp(p.settle.value, 0, 1));
        p.x = lerp(p.fromX, p.homeX, k);
        p.y = lerp(p.fromY, p.homeY, k);
        p.rot = lerp(p.rot, 0, dt * 6);
      }
    });
    // Long idle: the hole for the first unplaced piece pulses.
    if (this.idle > 5) {
      const pc = this.pieces.find((x) => !x.placed);
      if (pc) {
        const h = this.holes.find((x) => x.kind === pc.kind);
        if (h) h.glow.to(0.5 + Math.sin(this.t * 4) * 0.5);
      }
    }
  }

  // Playroom wall, floor and the wooden board. Only the holes and the pieces
  // move, so all of this is baked.
  paintBackdrop(g, e) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) {
      const x = (i / 5) * e.w;
      g.save();
      g.globalAlpha = 0.1;
      g.translate(x, e.h * 0.1 + Math.sin(i) * e.h * 0.03);
      blob(g, e.min * 0.1, 0.1, i, 6);
      g.fill();
      g.restore();
    }
    g.fillStyle = '#f0c98a';
    g.beginPath();
    g.moveTo(0, e.h * 0.62);
    g.quadraticCurveTo(e.w * 0.5, e.h * 0.58, e.w, e.h * 0.62);
    g.lineTo(e.w, e.h);
    g.lineTo(0, e.h);
    g.closePath();
    g.fill();

    const bw = e.w * 0.94;
    const bx = (e.w - bw) / 2;
    g.save();
    g.fillStyle = '#c58f4f';
    roundRect(g, bx, this.boardY - this.boardH / 2, bw, this.boardH, e.min * 0.05);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(g, bx, this.boardY - this.boardH / 2, bw, this.boardH * 0.3, e.min * 0.05);
    g.fill();
    g.strokeStyle = '#a06f36';
    g.lineWidth = e.min * 0.008;
    roundRect(g, bx + e.min * 0.012, this.boardY - this.boardH / 2 + e.min * 0.012, bw - e.min * 0.024, this.boardH - e.min * 0.024, e.min * 0.04);
    g.stroke();
    // wood grain
    g.save();
    g.globalAlpha = 0.12;
    g.strokeStyle = '#7d5324';
    g.lineWidth = e.min * 0.004;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(bx, this.boardY - this.boardH * 0.35 + i * this.boardH * 0.17);
      g.bezierCurveTo(
        bx + bw * 0.3, this.boardY - this.boardH * 0.3 + i * this.boardH * 0.17,
        bx + bw * 0.7, this.boardY - this.boardH * 0.4 + i * this.boardH * 0.17,
        bx + bw, this.boardY - this.boardH * 0.34 + i * this.boardH * 0.17
      );
      g.stroke();
    }
    g.restore();
    g.restore();
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    // holes
    this.holes.forEach((h) => {
      const gl = h.glow.value;
      g.save();
      g.translate(h.x, h.y);
      if (gl > 0.02) {
        g.save();
        g.globalAlpha = gl * 0.75;
        g.fillStyle = h.color;
        path(g, h.kind, this.holeR * (1.35 + gl * 0.14));
        g.fill();
        g.restore();
      }
      // recessed hole
      g.fillStyle = '#7d5324';
      path(g, h.kind, this.holeR * 1.06);
      g.fill();
      g.fillStyle = h.filled ? alpha(h.color, 0.35) : '#5e3c19';
      path(g, h.kind, this.holeR);
      g.fill();
      if (!h.filled) {
        g.save();
        g.globalAlpha = 0.25;
        g.strokeStyle = '#fff';
        g.lineWidth = this.holeR * 0.07;
        path(g, h.kind, this.holeR * 0.86);
        g.stroke();
        g.restore();
      }
      g.restore();
    });

    // pieces
    this.pieces.forEach((pc) => {
      const s = pc.scale.value;
      const wob = pc.wrong > 0 ? Math.sin(pc.wrong * 40) * this.pieceR * 0.16 : 0;
      g.save();
      g.translate(pc.x + wob, pc.y);
      if (!pc.placed) groundShadow(g, 0, pc.r * 1.2, pc.r * 0.8, pc.held ? 0.22 : 0.14);
      g.rotate(pc.rot + (pc.placed ? 0 : Math.sin(t * 1.6 + pc.i) * 0.03));
      g.scale(s, s);
      // body
      g.fillStyle = radial(g, -pc.r * 0.3, -pc.r * 0.4, pc.r * 2, [
        lighten(pc.color, 0.45), pc.color, darken(pc.color, 0.2),
      ]);
      path(g, pc.kind, pc.r);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.65)';
      g.lineWidth = pc.r * 0.09;
      path(g, pc.kind, pc.r * 0.93);
      g.stroke();
      // gloss
      g.save();
      path(g, pc.kind, pc.r);
      g.clip();
      g.globalAlpha = 0.35;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(-pc.r * 0.28, -pc.r * 0.42, pc.r * 0.5, pc.r * 0.22, -0.5, 0, TAU);
      g.fill();
      g.restore();
      g.restore();
    });

    // Emi cheering
    g.save();
    g.translate(e.w * 0.07, e.h - e.min * 0.012 - this.emiS * EMI_FEET);
    groundShadow(g, 0, 0, this.emiS * 0.6, 0.16);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.emiCheer.value, { wave: this.emiCheer.value });
    g.restore();

    this.p.draw(g);

    if (this.sayShape) {
      const a = clamp(this.sayShape.t / 0.4, 0, 1);
      const pop = ease.outBack(clamp((1.6 - this.sayShape.t) / 0.3, 0, 1));
      g.save();
      g.globalAlpha = a;
      g.translate(e.w / 2, e.h * 0.1);
      g.scale(pop, pop);
      const s = Math.max(22, e.min * 0.085);
      label(g, this.sayShape.name, 0, 0, s, C.ink, { stroke: '#fff', sw: s * 0.24 });
      g.restore();
    }

    if (this.cheer > 0) {
      const a = clamp(this.cheer / 0.5, 0, 1);
      g.save();
      g.globalAlpha = a;
      const s = Math.max(22, e.min * 0.075);
      label(g, 'כל הכבוד אמי!', e.w / 2, e.h * 0.55, s, C.magentaDark, { stroke: '#fff', sw: s * 0.24 });
      g.restore();
    }

    this.drawHud(g, e);
  }
}
