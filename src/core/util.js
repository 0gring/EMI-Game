// Small math / random helpers shared by every scene.
// Kept allocation-free so it is safe to call inside the render loop.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const map = (v, a, b, c, d) => lerp(c, d, clamp(inv(a, b, v), 0, 1));

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;
export const sign = (v) => (v < 0 ? -1 : 1);

export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export const hit = (ax, ay, bx, by, r) => dist2(ax, ay, bx, by) <= r * r;

// --- easing ---------------------------------------------------------------

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.38;
    return Math.pow(2, -9 * t) * Math.sin(((t - p / 4) * TAU) / p) + 1;
  },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// A critically-damped-ish spring. Toddler UI lives or dies on this feeling
// squishy, so every pressable thing runs one of these.
export class Spring {
  constructor(value = 0, stiffness = 170, damping = 14) {
    this.value = value;
    this.target = value;
    this.vel = 0;
    this.k = stiffness;
    this.d = damping;
  }
  set(v) {
    this.value = v;
    this.target = v;
    this.vel = 0;
  }
  to(v) {
    this.target = v;
    return this;
  }
  kick(v) {
    this.vel += v;
    return this;
  }
  update(dt) {
    // sub-step so a long frame cannot blow the spring up
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 120);
      const a = (this.target - this.value) * this.k - this.vel * this.d;
      this.vel += a * h;
      this.value += this.vel * h;
      left -= h;
    }
    return this.value;
  }
  get idle() {
    return Math.abs(this.vel) < 0.001 && Math.abs(this.target - this.value) < 0.001;
  }
}

// Fire-and-forget timeline of callbacks, used for little scripted moments
// (an animal peeking out, a cake being lit) without nesting setTimeouts.
export class Schedule {
  constructor() {
    this.items = [];
  }
  in(delay, fn) {
    this.items.push({ t: delay, fn });
    return this;
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t -= dt;
      if (it.t <= 0) {
        this.items.splice(i, 1);
        it.fn();
      }
    }
  }
  clear() {
    this.items.length = 0;
  }
}
