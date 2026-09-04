// Magic painting.
//
// Drawing is where a toddler will happily spend twenty minutes, so this one is
// built to reward pure scribbling: the brush leaves glowing paint, sparkles trail
// the finger, and the stroke plays notes as it moves - height picks the pitch, so
// a scribble sounds like a run up and down the scale.
//
// Strokes are drawn onto an offscreen layer, which keeps the frame rate flat no
// matter how much she has drawn.

import { TAU, Spring, rand, pick, clamp } from '../core/util.js';
import { C, SKIES, SPARKS } from '../core/palette.js';
import {
  circle, roundRect, label, radial, lighten, darken, star as starPath, heart, flower, hsl,
  alpha,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { drawEmi, EMI_FEET } from '../core/creatures.js';

const PAINTS = [
  { color: C.red, note: 'C5' },
  { color: C.orange, note: 'D5' },
  { color: C.yellow, note: 'E5' },
  { color: C.lime, note: 'G5' },
  { color: C.teal, note: 'A5' },
  { color: C.sky, note: 'C6' },
  { color: C.indigo, note: 'D6' },
  { color: C.magenta, note: 'E6' },
  { color: 'rainbow', note: 'G6' },
];

const STAMPS = ['star', 'heart', 'flower', 'butterfly', 'sun'];
const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];

export class PaintScene extends SceneBase {
  constructor(game) {
    super(game, { sky: SKIES.paint, music: 'calm' });
    this.paint = 0;
    this.tool = 'brush';       // 'brush' | 'stamp'
    this.stamp = 0;
    this.layer = null;
    this.lctx = null;
    this.hue = 0;
    this.clearing = 0;
    this.strokeCount = 0;
    this.btnPress = PAINTS.map(() => new Spring(0, 300, 16));
    this.toolPress = new Spring(0, 300, 16);
    this.clearPress = new Spring(0, 300, 16);
    this.emiCheer = new Spring(0, 160, 11);
    this.noteT = 0;
  }

  enter() {
    super.enter();
    this.audio.play('open', { vol: 0.5 });
  }

  layout(e) {
    super.layout(e);
    // One tray along the bottom in every orientation: nine colours plus the
    // brush/stamp toggle and the sponge is more than fits down a short edge, and
    // the bottom is also the easiest reach for short arms.
    const n = PAINTS.length;
    const slots = n + 2.8;                    // colours + two slightly larger tools
    const slot = e.w / slots;
    const btn = Math.min(slot * 0.42, e.min * 0.055);
    this.btnR = btn;
    this.paletteW = Math.max(btn * 2.7, e.min * 0.13);
    const trayY = e.h - this.paletteW / 2;
    // RTL: brush on the right, colours in the middle, sponge on the left.
    this.toolBtn = { x: e.w - slot * 0.75, y: trayY, r: btn * 1.14 };
    this.clearBtn = { x: slot * 0.75, y: trayY, r: btn * 1.14 };
    const first = e.w - slot * 1.8 - slot * 0.5;
    this.paintBtns = PAINTS.map((p, i) => ({
      x: first - i * slot, y: trayY, r: btn, i, p,
    }));
    this.canvasRect = { x: 0, y: 0, w: e.w, h: e.h - this.paletteW };
    this.emiS = Math.min(e.min * 0.05, this.paletteW * 0.34);
    this.rebuildLayer(e);
  }

  // Keep the artwork across a resize or rotation by scaling the old layer into
  // the new one. Losing a drawing to a rotated tablet would be a real loss.
  rebuildLayer(e) {
    const w = Math.max(1, Math.round(e.w * e.dpr));
    const h = Math.max(1, Math.round(e.h * e.dpr));
    const next = document.createElement('canvas');
    next.width = w;
    next.height = h;
    const ctx = next.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (this.layer && this.layer.width > 1) {
      ctx.drawImage(this.layer, 0, 0, this.layer.width, this.layer.height, 0, 0, w, h);
    }
    this.layer = next;
    this.lctx = ctx;
    this.lscale = e.dpr;
  }

  inCanvas(x, y) {
    const r = this.canvasRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    for (const b of this.paintBtns) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3) {
        this.paint = b.i;
        this.btnPress[b.i].set(1);
        this.btnPress[b.i].to(0);
        this.audio.play('toggle-on', { vol: 0.45 });
        this.audio.note('harp', b.p.note, { vol: 0.5 });
        p.data = 'ui';
        return;
      }
    }
    if (Math.hypot(p.x - this.toolBtn.x, p.y - this.toolBtn.y) < this.toolBtn.r * 1.3) {
      if (this.tool === 'brush') {
        this.tool = 'stamp';
      } else {
        this.stamp = (this.stamp + 1) % STAMPS.length;
        if (this.stamp === 0) this.tool = 'brush';
      }
      this.toolPress.set(1);
      this.toolPress.to(0);
      this.audio.play('toggle-on', { vol: 0.5 });
      p.data = 'ui';
      return;
    }
    if (Math.hypot(p.x - this.clearBtn.x, p.y - this.clearBtn.y) < this.clearBtn.r * 1.3) {
      this.clearPress.set(1);
      this.clearPress.to(0);
      this.startClear(e);
      p.data = 'ui';
      return;
    }
    if (!this.inCanvas(p.x, p.y)) return;

    p.data = { last: null, hue: rand(360), notes: 0 };
    if (this.tool === 'stamp') {
      this.putStamp(p.x, p.y, e);
    } else {
      this.strokeTo(p, p.x, p.y, e, true);
    }
  }

  onMove(p, e) {
    const d = p.data;
    if (!d || typeof d !== 'object' || d.last === undefined) return;
    if (!this.inCanvas(p.x, p.y)) return;
    if (this.tool === 'stamp') {
      // Dragging in stamp mode sprinkles a trail of them, spaced out.
      if (!d.last || Math.hypot(p.x - d.last.x, p.y - d.last.y) > this.btnR * 1.6) {
        this.putStamp(p.x, p.y, e);
        d.last = { x: p.x, y: p.y };
      }
      return;
    }
    this.strokeTo(p, p.x, p.y, e, false);
  }

  onUp(p, e) {
    this.hud.onUp(p);
    const d = p.data;
    if (d && typeof d === 'object' && d.last) {
      this.strokeCount++;
      // Every few strokes she gets a star, so drawing also feeds the counter.
      if (this.strokeCount % 5 === 0) {
        this.reward(p.x, p.y, { stars: 1, colors: [C.pink, C.yellow, C.sky] });
        this.emiCheer.set(1);
        this.emiCheer.to(0);
      }
    }
    p.data = null;
  }

  strokeTo(p, x, y, e, first) {
    const d = p.data;
    const ctx = this.lctx;
    const s = this.lscale;
    const paint = PAINTS[this.paint];
    const rainbow = paint.color === 'rainbow';
    const w = e.min * 0.045;

    const from = d.last || { x, y };
    d.hue = (d.hue + 6) % 360;
    const col = rainbow ? hsl(d.hue, 88, 60) : paint.color;

    // One opaque pass per segment. Anything translucent piles up at the joins
    // and turns a smooth scribble into a chain of blobs.
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = col;
    ctx.lineWidth = w * s;
    ctx.beginPath();
    ctx.moveTo(from.x * s, from.y * s);
    ctx.lineTo(x * s, y * s);
    ctx.stroke();

    d.last = { x, y };

    if (Math.random() < 0.5) this.p.sparkle(x, y, SPARKS, 2, e.min * 0.07);

    // Pitch follows height, so drawing up the screen plays up the scale.
    const moved = Math.hypot(x - from.x, y - from.y);
    d.notes += moved;
    const stride = e.min * 0.11;
    if (first || d.notes > stride) {
      d.notes = 0;
      const k = clamp(1 - y / this.canvasRect.h, 0, 1);
      const note = SCALE[Math.round(k * (SCALE.length - 1))];
      this.audio.note('harp', note, {
        vol: 0.42, verb: 0.6, pan: clamp((x / e.w) * 1.4 - 0.7, -0.7, 0.7),
      });
    }
  }

  putStamp(x, y, e) {
    const ctx = this.lctx;
    const s = this.lscale;
    const kind = STAMPS[this.stamp];
    const paint = PAINTS[this.paint];
    const col = paint.color === 'rainbow' ? hsl(rand(360), 88, 62) : paint.color;
    const size = e.min * rand(0.055, 0.085);
    ctx.save();
    ctx.translate(x * s, y * s);
    ctx.scale(s, s);
    ctx.rotate(rand(-0.4, 0.4));
    drawStamp(ctx, kind, size, col);
    ctx.restore();

    this.audio.play('plink', { vol: 0.5, rate: rand(0.85, 1.4), throttle: 0.02 });
    this.audio.note('xylophone', pick(SCALE), { vol: 0.45 });
    this.p.sparkle(x, y, [col, '#fff', C.yellow], 10, e.min * 0.16);
    this.p.ring(x, y, alpha(col, 0.7), size, 0.35);
  }

  startClear(e) {
    if (this.clearing > 0) return;
    this.clearing = 1;
    this.audio.play('swipe', { vol: 0.6 });
    this.audio.glissando('harp', 'C6', 'C4', 10, { step: 0.04, vol: 0.4 });
    this.p.confetti(e.cx, e.cy, [C.white, C.sky, C.pink], 26, e.min * 0.8);
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.btnPress.forEach((s) => s.update(dt));
    this.toolPress.update(dt);
    this.clearPress.update(dt);
    this.emiCheer.update(dt);
    this.hue = (this.hue + dt * 60) % 360;
    if (this.clearing > 0) {
      this.clearing -= dt * 1.6;
      // Wipe from one side, so it reads as a sweep rather than a blink.
      const k = 1 - clamp(this.clearing, 0, 1);
      const ctx = this.lctx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      const w = this.layer.width;
      ctx.fillRect(w - k * w * 1.15, 0, w * 0.2, this.layer.height);
      ctx.restore();
      if (this.clearing <= 0) {
        ctx.clearRect(0, 0, this.layer.width, this.layer.height);
        this.clearing = 0;
      }
    }
  }

  // Paper: a faint dot grid so an empty canvas is not a blank void.
  paintBackdrop(g, e) {
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    const step = e.min * 0.09;
    for (let x = step / 2; x < this.canvasRect.w; x += step) {
      for (let y = step / 2; y < this.canvasRect.h; y += step) {
        circle(g, x, y, e.min * 0.004);
        g.fill();
      }
    }
    g.restore();
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    // the artwork
    g.drawImage(this.layer, 0, 0, this.layer.width, this.layer.height, 0, 0, e.w, e.h);

    // live brush cursor for any finger currently down
    e.pointers.forEach((p) => {
      if (!p.data || typeof p.data !== 'object' || p.data.last === undefined) return;
      const paint = PAINTS[this.paint];
      const col = paint.color === 'rainbow' ? hsl(this.hue, 88, 62) : paint.color;
      g.save();
      g.globalAlpha = 0.6;
      g.strokeStyle = '#fff';
      g.lineWidth = e.min * 0.008;
      circle(g, p.x, p.y, e.min * 0.03 + Math.sin(t * 8) * e.min * 0.004);
      g.stroke();
      g.fillStyle = col;
      circle(g, p.x, p.y, e.min * 0.014);
      g.fill();
      g.restore();
    });

    this.p.draw(g);

    // palette tray
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.72)';
    roundRect(g, -e.min * 0.05, e.h - this.paletteW, e.w + e.min * 0.1, this.paletteW + e.min * 0.05, e.min * 0.05);
    g.fill();
    g.restore();

    this.paintBtns.forEach((b) => {
      const sel = b.i === this.paint;
      const press = this.btnPress[b.i].value;
      const r = b.r * (1 - press * 0.12) * (sel ? 1.14 : 1);
      g.save();
      g.translate(b.x, b.y);
      if (sel) {
        g.fillStyle = '#fff';
        circle(g, 0, 0, r * 1.22);
        g.fill();
        g.strokeStyle = C.magenta;
        g.lineWidth = r * 0.12;
        circle(g, 0, 0, r * 1.22);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,30,60,0.16)';
      circle(g, 0, r * 0.1, r);
      g.fill();
      if (b.p.color === 'rainbow') {
        const grad = g.createLinearGradient(-r, -r, r, r);
        for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, hsl((this.hue + i * 55) % 360, 88, 60));
        g.fillStyle = grad;
      } else {
        g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 2, [lighten(b.p.color, 0.45), b.p.color, darken(b.p.color, 0.2)]);
      }
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      g.globalAlpha = 0.45;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(-r * 0.3, -r * 0.36, r * 0.28, r * 0.16, -0.5, 0, TAU);
      g.fill();
      g.restore();
      g.restore();
    });

    // tool button
    const tb = this.toolBtn;
    g.save();
    g.translate(tb.x, tb.y);
    const tr = tb.r * (1 - this.toolPress.value * 0.12);
    g.fillStyle = '#fff';
    circle(g, 0, 0, tr);
    g.fill();
    g.strokeStyle = C.magenta;
    g.lineWidth = tr * 0.1;
    circle(g, 0, 0, tr * 0.95);
    g.stroke();
    g.save();
    g.scale(tr, tr);
    if (this.tool === 'brush') drawBrushIcon(g);
    else drawStampIcon(g, STAMPS[this.stamp]);
    g.restore();
    g.restore();

    // clear button
    const cb = this.clearBtn;
    g.save();
    g.translate(cb.x, cb.y);
    const cr = cb.r * (1 - this.clearPress.value * 0.12);
    g.fillStyle = '#fff';
    circle(g, 0, 0, cr);
    g.fill();
    g.strokeStyle = C.sky;
    g.lineWidth = cr * 0.1;
    circle(g, 0, 0, cr * 0.95);
    g.stroke();
    g.save();
    g.scale(cr, cr);
    // a little sponge
    g.fillStyle = C.sky;
    roundRect(g, -0.5, -0.3, 1.0, 0.6, 0.18);
    g.fill();
    g.fillStyle = '#fff';
    [[-0.24, -0.06], [0.06, 0.08], [0.28, -0.1]].forEach(([x, y]) => {
      circle(g, x, y, 0.1);
      g.fill();
    });
    g.restore();
    g.restore();

    // Emi peeking at the drawing
    g.save();
    g.translate(e.min * 0.055, e.h - this.paletteW - e.min * 0.008 - this.emiS * EMI_FEET);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.emiCheer.value, { wave: this.emiCheer.value });
    g.restore();

    if (this.idle > 6 && this.strokeCount === 0) {
      const pulse = this.attractPulse(2);
      g.save();
      g.globalAlpha = 0.4 + pulse * 0.4;
      const s = Math.max(16, e.min * 0.05);
      label(g, 'לצייר עם האצבע', this.canvasRect.w / 2, this.canvasRect.h * 0.5, s, C.magentaDark, {
        stroke: '#fff', sw: s * 0.24,
      });
      g.restore();
    }

    this.drawHud(g, e);
  }
}

function drawStamp(ctx, kind, size, col) {
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = size * 0.1;
  switch (kind) {
    case 'star':
      starPath(ctx, 5, size, size * 0.45);
      ctx.fill();
      ctx.stroke();
      break;
    case 'heart':
      heart(ctx, size * 0.95);
      ctx.fill();
      ctx.stroke();
      break;
    case 'flower':
      flower(ctx, 6, size * 0.5, size * 0.36);
      ctx.fillStyle = '#fff8c0';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.26, 0, TAU);
      ctx.fill();
      break;
    case 'butterfly':
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.scale(s, 1);
        ctx.beginPath();
        ctx.ellipse(size * 0.42, -size * 0.24, size * 0.42, size * 0.3, 0.3, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(size * 0.34, size * 0.3, size * 0.3, size * 0.22, -0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#4a3b52';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.1, size * 0.44, 0, 0, TAU);
      ctx.fill();
      break;
    case 'sun': {
      ctx.save();
      for (let i = 0; i < 10; i++) {
        ctx.rotate(TAU / 10);
        ctx.beginPath();
        ctx.moveTo(-size * 0.12, -size * 0.6);
        ctx.lineTo(0, -size * 1.05);
        ctx.lineTo(size * 0.12, -size * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(-size * 0.18, -size * 0.2, size * 0.16, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

function drawBrushIcon(g) {
  g.save();
  g.rotate(-0.6);
  g.fillStyle = '#b5794f';
  roundRect(g, -0.09, -0.15, 0.18, 0.8, 0.09);
  g.fill();
  g.fillStyle = C.magenta;
  g.beginPath();
  g.moveTo(-0.16, -0.15);
  g.quadraticCurveTo(0, -0.68, 0.16, -0.15);
  g.closePath();
  g.fill();
  g.restore();
}

function drawStampIcon(g, kind) {
  g.save();
  g.scale(0.62, 0.62);
  drawStamp(g, kind, 1, C.magenta);
  g.restore();
}
