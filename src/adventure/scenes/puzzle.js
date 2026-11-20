// Jigsaw puzzles.
//
// A picture of one of the animals, cut into real jigsaw pieces with tabs. The
// board shows a faint ghost of the picture so she can match by looking, and a
// piece dropped anywhere near its home snaps in. A piece dropped somewhere else
// simply stays where she put it - there is no wrong move, only "not yet".
//
// When the last piece goes in, the picture comes alive: the animal starts
// moving, says its name and makes its sound.
//
// Pieces are baked into their own small canvases at layout time, so a frame
// costs one drawImage per piece no matter how intricate the cut.

import { Spring, rand, clamp, lerp, shuffled, Schedule } from '../../core/util.js';
import { C, CONFETTI } from '../../core/palette.js';
import { circle, label, verticalGradient, sun, hill, cloud, rainbow } from '../../core/gfx.js';
import { SceneBase } from '../../core/ui.js';
import { LAND, SEA } from '../../core/creatures.js';
import { glow, rays, card } from '../art.js';
import { speak } from '../speech.js';

const SKY = ['#ffe2b8', '#fff0d6', '#fff8ea'];

const TUNING = [
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 3, rows: 3 },
  { cols: 4, rows: 3 },
];

const SUBJECTS = [
  ...LAND.filter((a) => a.id !== 'bee').map((a) => ({ a, sea: false })),
  ...SEA.filter((a) => ['octopus', 'turtle', 'crab', 'whale', 'seahorse', 'jelly'].includes(a.id)).map((a) => ({ a, sea: true })),
];

// --- the picture ----------------------------------------------------------------

function paintScene(g, w, h, sea, seed) {
  if (sea) {
    g.fillStyle = verticalGradient(g, 0, h, ['#4fc3ef', '#2f9ad6', '#1f6fb0']);
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(w * (0.1 + i * 0.2), 0);
      g.lineTo(w * (0.18 + i * 0.2), 0);
      g.lineTo(w * (0.05 + i * 0.22), h);
      g.lineTo(w * (-0.05 + i * 0.22), h);
      g.fill();
    }
    g.fillStyle = verticalGradient(g, h * 0.82, h, ['#ffe3a0', '#f3c770']);
    g.beginPath();
    g.moveTo(0, h * 0.86);
    g.quadraticCurveTo(w * 0.5, h * 0.78, w, h * 0.86);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    const weed = ['#3fae49', '#56c35a', '#7fd95a'];
    for (let i = 0; i < 6; i++) {
      const x = w * ((i * 0.19 + seed * 0.07) % 1);
      g.strokeStyle = weed[i % 3];
      g.lineWidth = w * 0.025;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, h);
      g.quadraticCurveTo(x + w * 0.05, h * 0.82, x - w * 0.02, h * 0.68);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 9; i++) {
      circle(g, w * ((i * 0.37 + 0.1) % 1), h * ((i * 0.23 + 0.15) % 0.7), w * (0.01 + (i % 3) * 0.008));
      g.fill();
    }
    return;
  }
  const skies = [['#7fc4ff', '#bfe6ff', '#e8f8ff'], ['#ffb3d1', '#ffd9e8', '#fff2f7'], ['#b9a8ff', '#d9cfff', '#f1edff']];
  g.fillStyle = verticalGradient(g, 0, h, skies[seed % 3]);
  g.fillRect(0, 0, w, h);
  rainbow(g, w * 0.5, h * 0.75, w * 0.42, w * 0.035, 0.45);
  sun(g, w * 0.84, h * 0.17, w * 0.08, 0);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.save();
  g.translate(w * 0.2, h * 0.16);
  cloud(g, w * 0.22, h * 0.06, 1);
  g.fill();
  g.restore();
  hill(g, w * 0.25, h * 0.78, w * 0.9, h * 0.2, '#8fdc6a');
  hill(g, w * 0.8, h * 0.8, w * 0.8, h * 0.16, '#6fcf5f');
  g.fillStyle = verticalGradient(g, h * 0.8, h, ['#7fd95a', '#4fb84a']);
  g.fillRect(0, h * 0.82, w, h * 0.18);
  const fc = ['#ff85c8', '#ffd93d', '#ffffff'];
  for (let i = 0; i < 12; i++) {
    g.fillStyle = fc[i % 3];
    circle(g, w * ((i * 0.083 + 0.04)), h * (0.88 + (i % 3) * 0.035), w * 0.012);
    g.fill();
  }
}

function paintSubject(g, w, h, sub, t, s = 0.2) {
  const k = Math.min(w, h) * (sub.sea ? 0.27 : 0.25) / (sub.a.size || 1) ** 0.3;
  g.save();
  g.translate(w / 2, h * (sub.sea ? 0.5 : 0.5));
  g.scale(k, k);
  sub.a.draw(g, t, s, 4);
  g.restore();
}

// --- jigsaw cuts ------------------------------------------------------------------

function edge(g, x0, y0, x1, y1, d) {
  if (!d) {
    g.lineTo(x1, y1);
    return;
  }
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const nx = uy, ny = -ux;   // outward for a clockwise walk in screen space
  const P = (a, b) => [x0 + ux * a * L + nx * b * L * d, y0 + uy * a * L + ny * b * L * d];
  g.lineTo(...P(0.36, 0));
  g.bezierCurveTo(...P(0.42, 0.06), ...P(0.28, 0.24), ...P(0.5, 0.25));
  g.bezierCurveTo(...P(0.72, 0.24), ...P(0.58, 0.06), ...P(0.64, 0));
  g.lineTo(x1, y1);
}

function piecePath(g, L, tabs) {
  g.beginPath();
  g.moveTo(0, 0);
  edge(g, 0, 0, L, 0, tabs.top);
  edge(g, L, 0, L, L, tabs.right);
  edge(g, L, L, 0, L, tabs.bottom);
  edge(g, 0, L, 0, 0, tabs.left);
  g.closePath();
}

export class PuzzleScene extends SceneBase {
  constructor(game) {
    super(game, { sky: SKY, music: 'think', id: 'puzzle', hue: '#ff9a1f', goals: [2, 2, 2, 3] });
    this.sched = new Schedule();
    this.deck = shuffled(SUBJECTS);
    this.round = 0;
    this.newPuzzle();
  }

  newPuzzle() {
    this.tune = this.levels.pick(TUNING);
    this.sub = this.deck[this.round % this.deck.length];
    this.round++;
    this.seed = Math.floor(rand(100));
    const { cols, rows } = this.tune;
    const H = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < 0.5 ? 1 : -1)));
    const V = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < 0.5 ? 1 : -1)));
    this.pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.pieces.push({
          r, c,
          tabs: {
            top: r === 0 ? 0 : -H[r - 1][c],
            bottom: r === rows - 1 ? 0 : H[r][c],
            left: c === 0 ? 0 : -V[r][c - 1],
            right: c === cols - 1 ? 0 : V[r][c],
          },
          fx: 0, fy: 0,        // position inside the tray, 0..1
          x: 0, y: 0,
          placed: false,
          held: null,
          tilt: rand(-0.25, 0.25),
          lift: new Spring(0, 260, 16),
          snap: 0,
          sprite: null,
        });
      }
    }
    // scatter positions in the tray, spread on a jittered grid so pieces start
    // apart and every one is easy to grab
    const order = shuffled(this.pieces);
    const n = order.length;
    const tc = Math.ceil(Math.sqrt(n * (this.tray ? this.tray.w / Math.max(1, this.tray.h) : 1))), tr = Math.ceil(n / tc);
    order.forEach((p, i) => {
      p.fx = ((i % tc) + 0.5) / tc + rand(-0.05, 0.05);
      p.fy = (Math.floor(i / tc) + 0.5) / tr + rand(-0.05, 0.05);
    });
    this.done = false;
    this.doneT = 0;
    this.alive = 0;
    if (this.game.engine.w) {
      this.layout(this.game.engine);
      this.postLayout(this.game.engine);
    }
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.sched.in(0.6, () => speak('בואי נרכיב את התמונה', { music: this.game.music }));
  }

  layout(e) {
    super.layout(e);
    const P = e.portrait;
    const { cols, rows } = this.tune;
    const top = (e.topBand || 0) + e.min * 0.03;
    let bx, by, bw, bh;
    if (P) {
      bw = e.w * 0.86;
      bh = e.h * 0.42;
      bx = (e.w - bw) / 2;
      by = top;
      this.tray = { x: e.w * 0.08, y: by + bh + e.min * 0.1, w: e.w * 0.84, h: e.h - (by + bh + e.min * 0.1) - e.min * 0.08 };
    } else {
      bw = e.w * 0.5;
      bh = e.h - top - e.min * 0.08;
      // Board on the right, pieces on the left: in Hebrew the eye starts right.
      bx = e.w * 0.47;
      by = top;
      this.tray = { x: e.w * 0.07, y: top + e.min * 0.06, w: e.w * 0.33, h: e.h - top - e.min * 0.18 };
    }
    const L = Math.floor(Math.min(bw / cols, bh / rows));
    this.L = L;
    // Loose pieces wait in the tray at a smaller size so they all fit beside
    // the board without piling up; picked up, a piece grows to its real size.
    const n = this.pieces.length;
    const tc = Math.max(1, Math.ceil(Math.sqrt(n * (this.tray.w / Math.max(1, this.tray.h))))), tr = Math.ceil(n / tc);
    this.trayScale = clamp(Math.min(this.tray.w / tc, this.tray.h / tr) / (L * 1.3), 0.35, 1);
    this.board = { x: bx + (bw - L * cols) / 2, y: by + (bh - L * rows) / 2, w: L * cols, h: L * rows };
    for (const p of this.pieces) {
      p.hx = this.board.x + p.c * L + L / 2;
      p.hy = this.board.y + p.r * L + L / 2;
      if (p.placed) {
        p.x = p.hx;
        p.y = p.hy;
      } else if (!p.held) {
        p.x = this.tray.x + p.fx * this.tray.w;
        p.y = this.tray.y + p.fy * this.tray.h;
      }
    }
  }

  postLayout(e) {
    super.postLayout(e);
    this.bakePicture(e);
  }

  bakePicture(e) {
    const { w, h } = this.board;
    const dpr = e.dpr;
    const mk = () => document.createElement('canvas');
    this.bgPic = this.bgPic || mk();
    this.fullPic = this.fullPic || mk();
    for (const c of [this.bgPic, this.fullPic]) {
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
    }
    let g = this.bgPic.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene(g, w, h, this.sub.sea, this.seed);
    g = this.fullPic.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(this.bgPic, 0, 0, w, h);
    paintSubject(g, w, h, this.sub, 0.6);

    // one sprite per piece, including its tabs and a bevelled edge
    const L = this.L, pad = Math.ceil(L * 0.3);
    for (const p of this.pieces) {
      // the drop shadow is its own sprite, so pieces on the board can go without
      const sh = p.shade || (p.shade = mk());
      sh.width = Math.max(1, Math.round((L + pad * 2) * dpr));
      sh.height = sh.width;
      const hg = sh.getContext('2d');
      hg.setTransform(dpr, 0, 0, dpr, 0, 0);
      hg.translate(pad, pad);
      hg.fillStyle = 'rgba(70,40,20,0.3)';
      piecePath(hg, L, p.tabs);
      hg.fill();
      const c = p.sprite || (p.sprite = mk());
      c.width = Math.max(1, Math.round((L + pad * 2) * dpr));
      c.height = c.width;
      const sg = c.getContext('2d');
      sg.setTransform(dpr, 0, 0, dpr, 0, 0);
      sg.translate(pad, pad);
      sg.save();
      piecePath(sg, L, p.tabs);
      sg.clip();
      sg.drawImage(this.fullPic, -p.c * L, -p.r * L, w, h);
      // inner bevel: light from the top-left
      sg.strokeStyle = 'rgba(255,255,255,0.55)';
      sg.lineWidth = Math.max(2, L * 0.04);
      sg.translate(L * 0.012, L * 0.012);
      piecePath(sg, L, p.tabs);
      sg.stroke();
      sg.restore();
      sg.strokeStyle = 'rgba(90,60,40,0.45)';
      sg.lineWidth = Math.max(1, L * 0.012);
      piecePath(sg, L, p.tabs);
      sg.stroke();
      p.pad = pad;
    }
  }

  // --- input -------------------------------------------------------------------

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    if (this.done) {
      this.cheer(e, p.x, p.y);
      return;
    }
    // topmost loose piece under the finger; generous radius for small fingers
    let best = null, bestD = Infinity;
    for (const pc of this.pieces) {
      if (pc.placed || pc.held) continue;
      const d = Math.hypot(p.x - pc.x, p.y - pc.y);
      if (d < this.L * 0.75 * this.trayScale + 12 && d < bestD) { best = pc; bestD = d; }
    }
    if (best) {
      best.held = p.id;
      best.ox = best.x - p.x;
      best.oy = best.y - p.y;
      best.lift.to(1);
      p.data = best;
      // bring to the top of the pile
      this.pieces.splice(this.pieces.indexOf(best), 1);
      this.pieces.push(best);
      this.audio.play('grab', { vol: 0.6 });
      return;
    }
    this.p.sparkle(p.x, p.y, ['#fff', C.yellow], 6, e.min * 0.08);
  }

  onMove(p) {
    const pc = p.data;
    if (!pc || pc === 'hud' || pc.held !== p.id) return;
    pc.x = p.x + pc.ox;
    pc.y = p.y + pc.oy;
  }

  onUp(p, e) {
    this.hud.onUp(p);
    const pc = p.data;
    if (!pc || pc === 'hud' || pc.held !== p.id) return;
    pc.held = null;
    pc.lift.to(0);
    const d = Math.hypot(pc.x - pc.hx, pc.y - pc.hy);
    if (d < this.L * 0.62) {
      this.place(pc, e);
    } else {
      // remember where she left it, relative to the tray, for relayouts
      pc.fx = clamp((pc.x - this.tray.x) / Math.max(1, this.tray.w), -0.2, 2.2);
      pc.fy = clamp((pc.y - this.tray.y) / Math.max(1, this.tray.h), -0.2, 1.4);
      this.audio.play('drop', { vol: 0.5 });
      // after a near miss, light up where it goes
      if (d < this.L * 1.6) pc.hint = 1.6;
    }
  }

  place(pc, e) {
    pc.placed = true;
    pc.snap = 1;
    pc.fromX = pc.x;
    pc.fromY = pc.y;
    pc.x = pc.hx;
    pc.y = pc.hy;
    const n = this.pieces.filter((k) => k.placed).length;
    this.audio.play('snap', { vol: 0.8 });
    this.audio.note('xylophone', ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7'][n - 1] || 'C7', { vol: 0.55 });
    this.p.sparkle(pc.hx, pc.hy, ['#fff', C.yellow, '#ffe0a0'], 12, this.L * 0.6);
    this.p.ring(pc.hx, pc.hy, '#ffffff', this.L * 0.5, 0.45);
    if (n === this.pieces.length) this.complete(e);
  }

  complete(e) {
    this.done = true;
    this.doneT = 0;
    const b = this.board;
    this.sched.in(0.35, () => {
      this.reward(b.x + b.w / 2, b.y + b.h / 2, { stars: 2, big: true });
      this.audio.voice(this.sub.a.voice);
      speak(this.sub.a.name, { music: this.game.music });
    });
    this.sched.in(0.9, () => this.scoreLevel(1, e));
    this.sched.in(2.4, () => this.audio.voice(this.sub.a.voice));
  }

  cheer(e, x, y) {
    this.audio.voice(this.sub.a.voice);
    this.alive = Math.max(this.alive, 0.5);
    this.p.confetti(x, y, CONFETTI, 14, e.min * 0.5);
  }

  // --- frame ----------------------------------------------------------------------

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    for (const pc of this.pieces) {
      pc.lift.update(dt);
      if (pc.snap > 0) pc.snap = Math.max(0, pc.snap - dt * 5);
      if (pc.hint > 0) pc.hint -= dt;
      if (pc.held === null || pc.held === undefined) pc.tilt *= pc.placed ? 0.7 : 1;
    }
    if (this.done) {
      this.doneT += dt;
      this.alive = Math.min(1, this.alive + dt * 1.5);
      if (this.doneT > 5.2) this.newPuzzle();
    }
    // idle hint: after a while, the next piece glows over its home
    if (!this.done && this.idle > 6) {
      const pc = this.pieces.find((k) => !k.placed);
      if (pc && (pc.hint || 0) <= 0) pc.hint = 2;
    }
  }

  draw(g, e) {
    const t = this.t;
    this.drawBackdrop(g, e);
    const b = this.board, L = this.L;

    if (this.done) rays(g, b.x + b.w / 2, b.y + b.h / 2, e.max * 0.7, t, 'rgba(255,255,255,0.3)', 18);

    // wooden frame and the ghost picture
    const fp = L * 0.14;
    card(g, b.x - fp, b.y - fp, b.w + fp * 2, b.h + fp * 2, fp * 1.2, { fill: '#c98a55', shadow: 'rgba(90,50,20,0.3)' });
    g.fillStyle = '#fff6e6';
    g.fillRect(b.x, b.y, b.w, b.h);
    if (this.bgPic) {
      g.save();
      g.globalAlpha = this.done ? 1 : 0.28;
      g.drawImage(this.done ? this.bgPic : this.fullPic, b.x, b.y, b.w, b.h);
      g.restore();
    }
    // grid lines so each home is easy to see
    if (!this.done) {
      g.strokeStyle = 'rgba(150,110,80,0.25)';
      g.lineWidth = 1.5;
      g.setLineDash([6, 6]);
      for (let c = 1; c < this.tune.cols; c++) {
        g.beginPath(); g.moveTo(b.x + c * L, b.y); g.lineTo(b.x + c * L, b.y + b.h); g.stroke();
      }
      for (let r = 1; r < this.tune.rows; r++) {
        g.beginPath(); g.moveTo(b.x, b.y + r * L); g.lineTo(b.x + b.w, b.y + r * L); g.stroke();
      }
      g.setLineDash([]);
    }

    // hints glow over the home a piece belongs in
    for (const pc of this.pieces) {
      if (pc.placed || !(pc.hint > 0)) continue;
      const a = clamp(pc.hint, 0, 1) * (0.5 + Math.sin(t * 8) * 0.3);
      glow(g, pc.hx, pc.hy, L * 0.8, '#fff3a0', a);
    }

    if (this.done) {
      // the picture comes alive: background baked, animal drawn live
      g.save();
      g.beginPath();
      g.rect(b.x, b.y, b.w, b.h);
      g.clip();
      g.translate(b.x, b.y);
      paintSubject(g, b.w, b.h, this.sub, t, 0.5 + Math.sin(t * 3) * 0.3 * this.alive);
      g.restore();
      const fs = Math.max(26, e.min * 0.085);
      // inside the frame's bottom edge, so it never falls off a short screen
      label(g, this.sub.a.name, b.x + b.w / 2, b.y + b.h - fs * 0.7, fs, '#e0701a', { stroke: '#fff', sw: fs * 0.26 });
    } else {
      // pieces: placed ones first, then loose, then any being held on top
      const order = [...this.pieces].sort((a, c) => (a.placed === c.placed ? (a.held ? 1 : 0) - (c.held ? 1 : 0) : a.placed ? -1 : 1));
      for (const pc of order) this.drawPiece(g, pc, t);
    }

    this.p.draw(g);
    this.drawHud(g, e);
  }

  drawPiece(g, pc, t) {
    if (!pc.sprite) return;
    const L = this.L, pad = pc.pad;
    const lift = pc.lift.value;
    const loose = !pc.placed;
    const breathe = loose && !pc.held ? Math.sin(t * 2 + pc.r + pc.c * 2) * 0.012 : 0;
    const base = loose ? lerp(this.trayScale || 1, 1, clamp(lift, 0, 1)) : 1;
    const s = base * (1 + lift * 0.06 + breathe) + pc.snap * 0.08;
    const tilt = loose ? pc.tilt * (1 - lift) : 0;
    const size = L + pad * 2;
    g.save();
    g.translate(pc.x, pc.y);
    g.rotate(tilt);
    g.scale(s, s);
    if (loose && pc.shade) {
      g.drawImage(pc.shade, 0, 0, pc.shade.width, pc.shade.height,
        -size / 2 + L * 0.04 * (1 + lift), -size / 2 + L * 0.06 * (1 + lift * 2), size, size);
    }
    g.drawImage(pc.sprite, 0, 0, pc.sprite.width, pc.sprite.height, -size / 2, -size / 2, size, size);
    g.restore();
  }
}
