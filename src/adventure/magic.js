// The magic layer: everything that glows, drawn above whatever scene is open.
//
//   * a rainbow trail of light that follows every finger
//   * fireworks - rockets that climb, burst into glowing stars and rain down
//   * floating fairy dust that drifts up through every scene
//   * the transition between scenes: a sparkling iris that closes onto the
//     place she touched and opens again on the next scene
//
// Light is drawn with pre-rendered glow sprites and additive blending, so a
// burst of two hundred sparks costs two hundred cheap drawImage calls rather
// than two hundred gradients, and overlapping sparks add up to a hot white
// core the way real light does.

import { TAU, rand, pick, clamp, ease } from '../core/util.js';

const RAINBOW = ['#ff3d6e', '#ff8a1f', '#ffc61a', '#3fcf4f', '#1fb0ff', '#5a6cff', '#b45cff', '#ff4fc0'];
const GOLD = ['#ffd93d', '#ffb3dd', '#9fd8ff', '#ffe08a'];
const MAX = 900;

// --- glow sprites ---------------------------------------------------------------

const sprites = new Map();
function sprite(color) {
  let c = sprites.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  // A saturated body with only a pin-prick of white: the game's skies are
  // bright pastels, and additive white-hot light just bleaches out on them.
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.1, color);
  grad.addColorStop(0.34, color);
  grad.addColorStop(0.55, hexA(color, 0.4));
  grad.addColorStop(1, hexA(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, c);
  return c;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}

// Four-point star, the shape of a twinkle.
function star4(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + s * 0.12, y - s * 0.12, x + s, y);
  g.quadraticCurveTo(x + s * 0.12, y + s * 0.12, x, y + s);
  g.quadraticCurveTo(x - s * 0.12, y + s * 0.12, x - s, y);
  g.quadraticCurveTo(x - s * 0.12, y - s * 0.12, x, y - s);
  g.fill();
}

export class Magic {
  constructor(game) {
    this.game = game;
    this.pool = Array.from({ length: MAX }, () => ({ life: 0 }));
    this.head = 0;
    this.rockets = [];
    this.queue = [];
    this.flashes = [];
    this.hue = 0;
    this.motes = Array.from({ length: 22 }, () => ({ x: rand(1), y: rand(1), s: rand(0.5, 1.2), ph: rand(10), v: rand(0.01, 0.03), c: pick(GOLD) }));
    this.iris = { x: 0.5, y: 0.5 };
    this.t = 0;
    this.ambient = true;
  }

  spark(x, y, o) {
    let p = null;
    for (let n = 0; n < MAX; n++) {
      const q = this.pool[this.head];
      this.head = (this.head + 1) % MAX;
      if (q.life <= 0) { p = q; break; }
    }
    if (!p) { p = this.pool[this.head]; this.head = (this.head + 1) % MAX; }
    p.x = x; p.y = y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.g = o.g || 0; p.drag = o.drag ?? 0.985;
    p.life = p.max = o.life || 1;
    p.size = o.size || 10;
    p.color = o.color || '#ffffff';
    p.twinkle = o.twinkle || 0;
    p.star = o.star || false;
    p.ph = rand(10);
    return p;
  }

  // --- touch ------------------------------------------------------------------------

  onDown(p, e) {
    this.iris.x = p.x / e.w;
    this.iris.y = p.y / e.h;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const s = e.min * rand(0.25, 0.45);
      this.spark(p.x, p.y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.9, life: rand(0.35, 0.6),
        size: e.min * 0.035, color: RAINBOW[(this.hue + i) % RAINBOW.length], star: i % 2 === 0,
      });
    }
    this.hue++;
    p._mx = p.x; p._my = p.y;
  }

  onMove(p, e) {
    const step = Math.max(5, e.min * 0.012);
    let dx = p.x - (p._mx ?? p.x), dy = p.y - (p._my ?? p.y);
    let d = Math.hypot(dx, dy);
    if (d < step) return;
    const n = Math.min(12, Math.floor(d / step));
    for (let i = 1; i <= n; i++) {
      const x = p._mx + (dx * i) / n, y = p._my + (dy * i) / n;
      this.hue = (this.hue + 1) % (RAINBOW.length * 4);
      this.spark(x, y, {
        vx: rand(-20, 20), vy: rand(-30, 10), g: 40, drag: 0.96, life: rand(0.7, 1.1),
        size: e.min * rand(0.04, 0.065), color: RAINBOW[Math.floor(this.hue / 4)], star: Math.random() < 0.25, twinkle: 1,
      });
    }
    p._mx = p.x; p._my = p.y;
  }

  // --- bursts and fireworks -----------------------------------------------------------

  // A round burst of glowing stars at a point - for a match, a placed piece, a
  // finished picture.
  burst(x, y, { colors = RAINBOW, n = 36, power = 1 } = {}) {
    const e = this.game.engine;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1);
      const s = e.min * rand(0.35, 0.8) * power;
      this.spark(x, y, {
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: e.min * 0.5, drag: 0.94,
        life: rand(0.7, 1.2), size: e.min * rand(0.035, 0.06), color: pick(colors), star: Math.random() < 0.35, twinkle: 1,
      });
    }
    this.flashes.push({ x, y, r: e.min * 0.35 * power, t: 0, life: 0.35, color: pick(colors) });
  }

  // `count` rockets launched over a second or two from along the bottom.
  fireworks(count = 5) {
    for (let i = 0; i < count; i++) this.queue.push({ at: this.t + i * 0.28 + rand(0, 0.15) });
  }

  launch(e) {
    const x = e.w * rand(0.15, 0.85);
    const ty = e.h * rand(0.15, 0.42);
    this.rockets.push({
      x, y: e.h + 10, vx: rand(-30, 30), vy: -Math.sqrt(2 * e.h * 1.2 * (e.h + 10 - ty)),
      ty, colors: [pick(RAINBOW), pick(RAINBOW), '#ffffff'], shape: pick(['ring', 'ring', 'heart', 'star', 'willow']),
    });
    this.game.audio.play('swipe', { vol: 0.35, rate: 1.4 });
  }

  explode(r, e) {
    const n = r.shape === 'willow' ? 54 : 42;
    const big = e.min * 0.75;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      let vx = Math.cos(a), vy = Math.sin(a);
      if (r.shape === 'heart') {
        // parametric heart, so the burst draws a heart in the sky
        const t = a;
        vx = (16 * Math.sin(t) ** 3) / 16;
        vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      } else if (r.shape === 'star') {
        const k = 0.55 + 0.45 * Math.abs(Math.cos((a * 5) / 2));
        vx *= k; vy *= k;
      }
      const s = big * (r.shape === 'ring' ? rand(0.85, 1) : rand(0.9, 1));
      this.spark(r.x, r.y, {
        vx: vx * s, vy: vy * s, g: e.min * (r.shape === 'willow' ? 0.55 : 0.35), drag: r.shape === 'willow' ? 0.965 : 0.955,
        life: rand(1.1, 1.7), size: e.min * rand(0.03, 0.05), color: r.colors[i % r.colors.length], twinkle: 1, star: i % 4 === 0,
      });
    }
    this.flashes.push({ x: r.x, y: r.y, r: e.min * 0.5, t: 0, life: 0.4, color: r.colors[0] });
    this.game.audio.play('pop', { vol: 0.55, rate: 0.55, throttle: 0 });
    this.game.audio.note('xylophone', pick(['C6', 'E6', 'G6', 'A6', 'C7']), { vol: 0.35 });
  }

  // --- frame ------------------------------------------------------------------------

  update(dt, e) {
    this.t += dt;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= this.t) { this.queue.splice(i, 1); this.launch(e); }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vy += e.h * 1.2 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      this.spark(r.x, r.y, { vx: rand(-15, 15), vy: rand(10, 40), drag: 0.9, life: rand(0.25, 0.45), size: e.min * 0.025, color: '#ffd27a' });
      if (r.vy >= 0 || r.y <= r.ty) { this.rockets.splice(i, 1); this.explode(r, e); }
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t >= f.life) this.flashes.splice(i, 1);
    }
    for (const m of this.motes) {
      m.y -= m.v * dt;
      if (m.y < -0.05) { m.y = 1.05; m.x = rand(1); }
    }
  }

  draw(g, e) {
    const t = this.t;
    g.save();
    if (this.ambient) {
      for (const m of this.motes) {
        const a = 0.2 + 0.2 * Math.sin(t * 1.7 + m.ph);
        const s = e.min * 0.022 * m.s;
        g.globalAlpha = a;
        g.drawImage(sprite(m.c), m.x * e.w + Math.sin(t * 0.7 + m.ph) * e.min * 0.03 - s, m.y * e.h - s, s * 2, s * 2);
      }
    }
    for (const f of this.flashes) {
      const k = f.t / f.life;
      const r = f.r * (0.6 + k * 0.8);
      g.globalAlpha = (1 - k) * 0.45;
      g.drawImage(sprite(f.color), f.x - r, f.y - r, r * 2, r * 2);
    }
    for (const r of this.rockets) {
      const s = e.min * 0.05;
      g.globalAlpha = 1;
      g.drawImage(sprite('#ffd27a'), r.x - s, r.y - s, s * 2, s * 2);
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      const k = clamp(p.life / p.max, 0, 1);
      let a = Math.min(1, k * 1.8);
      if (p.twinkle) a *= 0.65 + 0.35 * Math.sin(t * 25 + p.ph);
      const s = p.size * (0.5 + k * 0.6);
      g.globalAlpha = a;
      g.drawImage(sprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
      if (p.star && s > 6) {
        g.fillStyle = '#ffffff';
        star4(g, p.x, p.y, s * 0.75);
      }
    }
    g.restore();
  }

  // The scene change: a soft pink curtain with a sparkling rim closes in a
  // circle onto the place she touched, and opens again from the same spot.
  drawTransition(g, e, fade) {
    const k = ease.inOutQuad(clamp(fade, 0, 1));
    const cx = this.iris.x * e.w, cy = this.iris.y * e.h;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(e.w - cx, cy), Math.hypot(cx, e.h - cy), Math.hypot(e.w - cx, e.h - cy));
    const r = fade >= 1 ? 0 : far * (1 - k) * 1.02;
    g.save();
    const grad = g.createRadialGradient(cx, cy, r, cx, cy, far + 1);
    grad.addColorStop(0, '#ffb3dd');
    grad.addColorStop(0.5, '#e3a8ff');
    grad.addColorStop(1, '#a8c8ff');
    g.fillStyle = grad;
    g.beginPath();
    g.rect(0, 0, e.w, e.h);
    if (r > 0) g.arc(cx, cy, r, 0, TAU, true);
    g.fill('evenodd');
    if (r > 2) {
      // a ring of stars riding the edge of the circle
      g.globalCompositeOperation = 'lighter';
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t * 1.5;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const s = e.min * (0.05 + 0.02 * Math.sin(this.t * 9 + i));
        g.globalAlpha = 0.9;
        g.drawImage(sprite(RAINBOW[i % RAINBOW.length]), x - s, y - s, s * 2, s * 2);
        g.fillStyle = '#fff';
        star4(g, x, y, s * 0.6);
      }
    }
    g.restore();
  }
}

export { RAINBOW, GOLD };
