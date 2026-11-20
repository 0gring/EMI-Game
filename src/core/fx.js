// Pooled particle system.
//
// Every particle is reused from a fixed pool, so a toddler holding down eight
// fingers on the glass does not trigger the garbage collector mid-animation.
// One flat array keeps the draw loop cache friendly; `kind` picks the shape.

import { TAU, rand, pick, clamp } from './util.js';

const MAX = 1100;

export class Particles {
  constructor() {
    this.pool = new Array(MAX);
    for (let i = 0; i < MAX; i++) this.pool[i] = blank();
    this.head = 0;
    this.live = 0;
  }

  clear() {
    for (let i = 0; i < MAX; i++) this.pool[i].life = 0;
    this.live = 0;
  }

  _take() {
    // Ring buffer: when full, the oldest particle is recycled. Losing the tail
    // of an old burst is invisible; stalling is not.
    for (let n = 0; n < MAX; n++) {
      const p = this.pool[this.head];
      this.head = (this.head + 1) % MAX;
      if (p.life <= 0) { this.live++; return p; }
    }
    const p = this.pool[this.head];
    this.head = (this.head + 1) % MAX;
    return p;
  }

  spawn(kind, x, y, o = {}) {
    const p = this._take();
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0.999;
    p.life = o.life ?? 1;
    p.max = p.life;
    p.size = o.size ?? 8;
    p.color = o.color ?? '#fff';
    p.color2 = o.color2 ?? null;
    p.rot = o.rot ?? rand(TAU);
    p.spin = o.spin ?? rand(-6, 6);
    p.wob = o.wob ?? 0;
    p.seed = rand(100);
    p.alpha = o.alpha ?? 1;
    p.shape = o.shape ?? 0;
    return p;
  }

  // --- ready made bursts --------------------------------------------------

  confetti(x, y, colors, count = 26, power = 320) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      const s = rand(power * 0.35, power);
      this.spawn('confetti', x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - power * 0.35,
        g: 620,
        drag: 0.986,
        life: rand(0.9, 1.7),
        size: rand(7, 15),
        color: pick(colors),
        spin: rand(-11, 11),
        shape: (Math.random() * 3) | 0,
      });
    }
  }

  sparkle(x, y, colors, count = 12, spread = 90) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      const s = rand(spread * 0.3, spread);
      this.spawn('sparkle', x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: -30,
        drag: 0.93,
        life: rand(0.4, 0.95),
        size: rand(4, 11),
        color: pick(colors),
      });
    }
  }

  ring(x, y, color, size = 60, life = 0.5) {
    this.spawn('ring', x, y, { life, size, color });
  }

  bubbles(x, y, count = 8, rise = 110, tint = 'rgba(255,255,255,0.85)') {
    for (let i = 0; i < count; i++) {
      this.spawn('bubble', x + rand(-14, 14), y + rand(-8, 8), {
        vx: rand(-22, 22),
        vy: -rand(rise * 0.5, rise),
        g: -14,
        drag: 0.995,
        life: rand(1.3, 2.8),
        size: rand(5, 17),
        color: tint,
        wob: rand(1.2, 3.4),
      });
    }
  }

  splash(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = rand(90, 300);
      this.spawn('drop', x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: 900,
        life: rand(0.5, 1.1),
        size: rand(4, 10),
        color,
      });
    }
  }

  petals(x, y, colors, count = 10) {
    for (let i = 0; i < count; i++) {
      this.spawn('petal', x + rand(-20, 20), y, {
        vx: rand(-60, 60),
        vy: rand(-140, -30),
        g: 180,
        drag: 0.99,
        life: rand(1.6, 3),
        size: rand(8, 16),
        color: pick(colors),
        wob: rand(1.5, 3.5),
      });
    }
  }

  puff(x, y, color = 'rgba(255,255,255,0.7)', count = 8) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU);
      this.spawn('puff', x, y, {
        vx: Math.cos(a) * rand(20, 90),
        vy: Math.sin(a) * rand(20, 90) - 20,
        drag: 0.9,
        life: rand(0.5, 1),
        size: rand(14, 30),
        color,
      });
    }
  }

  star(x, y, color, size = 22, life = 0.8) {
    this.spawn('bigstar', x, y, { life, size, color, vy: -90, g: 120, drag: 0.97 });
  }

  trail(x, y, color, size = 14) {
    this.spawn('trail', x, y, { life: 0.55, size, color, drag: 0.9, vy: rand(-20, 20), vx: rand(-20, 20) });
  }

  // --- simulation ---------------------------------------------------------

  update(dt) {
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      live++;
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.wob) p.x += Math.sin((p.max - p.life) * p.wob * 3 + p.seed) * 26 * dt;
    }
    this.live = live;
  }

  draw(g) {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;
      const t = clamp(p.life / p.max, 0, 1);
      g.save();
      switch (p.kind) {
        case 'confetti': {
          g.globalAlpha = Math.min(1, t * 2.2) * p.alpha;
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillStyle = p.color;
          const w = p.size;
          const h = p.size * (0.45 + Math.abs(Math.sin(p.rot * 1.7)) * 0.75);
          if (p.shape === 0) {
            g.fillRect(-w / 2, -h / 2, w, h);
          } else if (p.shape === 1) {
            g.beginPath();
            g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
            g.fill();
          } else {
            g.beginPath();
            g.moveTo(0, -h / 2);
            g.lineTo(w / 2, h / 2);
            g.lineTo(-w / 2, h / 2);
            g.closePath();
            g.fill();
          }
          break;
        }
        case 'sparkle': {
          const s = p.size * (0.4 + t * 1.1);
          g.globalAlpha = t * p.alpha;
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillStyle = p.color;
          fourPointStar(g, s);
          break;
        }
        case 'bigstar': {
          g.globalAlpha = Math.min(1, t * 1.6);
          g.translate(p.x, p.y);
          g.rotate(p.rot * 0.4);
          const s = p.size * (1.25 - t * 0.35);
          g.fillStyle = p.color;
          fivePointStar(g, s);
          break;
        }
        case 'ring': {
          const r = p.size * (1 - t) * 1.9 + 6;
          g.globalAlpha = t * 0.8;
          g.strokeStyle = p.color;
          g.lineWidth = 3 + 9 * t;
          g.beginPath();
          g.arc(p.x, p.y, r, 0, TAU);
          g.stroke();
          break;
        }
        case 'bubble': {
          g.globalAlpha = Math.min(1, t * 1.4) * 0.9;
          g.strokeStyle = p.color;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, TAU);
          g.stroke();
          g.globalAlpha *= 0.5;
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x - p.size * 0.32, p.y - p.size * 0.34, p.size * 0.26, 0, TAU);
          g.fill();
          break;
        }
        case 'drop': {
          g.globalAlpha = Math.min(1, t * 1.8);
          g.fillStyle = p.color;
          g.beginPath();
          g.ellipse(p.x, p.y, p.size * 0.6, p.size, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, TAU);
          g.fill();
          break;
        }
        case 'petal': {
          g.globalAlpha = Math.min(1, t * 1.6);
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillStyle = p.color;
          g.beginPath();
          g.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU);
          g.fill();
          break;
        }
        case 'heart': {
          // Floats up and sways; used when a fed animal is happy.
          g.globalAlpha = Math.min(1, t * 1.6);
          g.translate(p.x, p.y);
          g.rotate(Math.sin(p.rot) * 0.3);
          const s = p.size * (1.1 - t * 0.2);
          g.fillStyle = p.color;
          g.beginPath();
          g.moveTo(0, s * 0.32);
          g.bezierCurveTo(-s * 1.25, -s * 0.5, -s * 0.5, -s * 1.2, 0, -s * 0.45);
          g.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.25, -s * 0.5, 0, s * 0.32);
          g.fill();
          break;
        }
        case 'puff': {
          g.globalAlpha = t * 0.55;
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size * (1.5 - t * 0.7), 0, TAU);
          g.fill();
          break;
        }
        case 'trail': {
          g.globalAlpha = t * 0.9;
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size * t, 0, TAU);
          g.fill();
          break;
        }
      }
      g.restore();
    }
    g.globalAlpha = 1;
  }
}

function blank() {
  return {
    kind: 'confetti', x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 1,
    size: 8, color: '#fff', color2: null, rot: 0, spin: 0, wob: 0, seed: 0,
    alpha: 1, shape: 0,
  };
}

export function fourPointStar(g, s) {
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.16, -s * 0.16, s, 0);
  g.quadraticCurveTo(s * 0.16, s * 0.16, 0, s);
  g.quadraticCurveTo(-s * 0.16, s * 0.16, -s, 0);
  g.quadraticCurveTo(-s * 0.16, -s * 0.16, 0, -s);
  g.fill();
}

export function fivePointStar(g, s, inner = 0.47) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const r = i % 2 === 0 ? s : s * inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}
