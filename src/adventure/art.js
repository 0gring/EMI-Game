// Shared artwork for Emi's island: food, flowers, cake parts, crayons and the
// soft glows that make the whole thing look lit rather than flat.
//
// Same convention as the core drawing toolkit: everything is drawn around the
// origin in a unit space roughly one unit across, so callers translate and
// scale freely and a strawberry works as a sprinkle or as a hand-sized prize.

import { TAU } from '../core/util.js';
import { C } from '../core/palette.js';
import { circle, radial, lighten, darken, roundRect, star as starPath, heart } from '../core/gfx.js';

// Colours with their Hebrew names. Order is the order on every palette, so the
// crayons in the colouring book and the icing in the bakery line up.
export const PAINTS = [
  { c: '#ff4d5e', name: 'אדום' },
  { c: '#ff9a1f', name: 'כתום' },
  { c: '#ffd93d', name: 'צהוב' },
  { c: '#5fcf5f', name: 'ירוק' },
  { c: '#4fa8ff', name: 'כחול' },
  { c: '#a774ff', name: 'סגול' },
  { c: '#ff85c8', name: 'ורוד' },
  { c: '#9a6440', name: 'חום' },
  { c: '#ffffff', name: 'לבן' },
  { c: '#3d3a52', name: 'שחור' },
];

// --- glow & light ------------------------------------------------------------

// A soft additive halo. This is most of what makes the island look magical:
// everything precious sits in a little pool of light.
export function glow(g, x, y, r, color = '#fff6c0', a = 0.55) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.fillStyle = radial(g, x, y, r, [color, 'rgba(255,255,255,0)']);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.restore();
}

// Rotating sunburst behind a prize or a finished picture.
export function rays(g, x, y, r, t, color = 'rgba(255,240,170,0.35)', n = 14) {
  g.save();
  g.translate(x, y);
  g.rotate(t * 0.25);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, a, a + TAU / n / 2);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// A four point twinkle, used for the sparkles that drift over finished things.
export function twinkle(g, x, y, s, color = '#fff') {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0);
  g.quadraticCurveTo(s * 0.12, s * 0.12, 0, s);
  g.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0);
  g.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s);
  g.fill();
  g.restore();
}

// Rounded white card with a soft drop shadow, the base of every panel.
export function card(g, x, y, w, h, r, { fill = '#fffdf6', shadow = 'rgba(60,40,90,0.18)', edge = null } = {}) {
  g.fillStyle = shadow;
  roundRect(g, x, y + r * 0.22, w, h, r);
  g.fill();
  g.fillStyle = fill;
  roundRect(g, x, y, w, h, r);
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = r * 0.12;
    roundRect(g, x + r * 0.06, y + r * 0.06, w - r * 0.12, h - r * 0.12, r * 0.94);
    g.stroke();
  }
}

// --- food --------------------------------------------------------------------

function shine(g, x, y, rx, ry, rot = -0.5, a = 0.55) {
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
}

function leaf(g, x, y, len, rot, color = '#55b84a') {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  g.fill();
  g.restore();
}

export function drawApple(g, color = '#ff4d5e') {
  g.fillStyle = radial(g, -0.3, -0.35, 1.3, [lighten(color, 0.35), color, darken(color, 0.25)]);
  g.beginPath();
  g.moveTo(0, -0.62);
  g.bezierCurveTo(0.45, -0.95, 1.05, -0.55, 0.88, 0.1);
  g.bezierCurveTo(0.75, 0.7, 0.35, 0.95, 0, 0.82);
  g.bezierCurveTo(-0.35, 0.95, -0.75, 0.7, -0.88, 0.1);
  g.bezierCurveTo(-1.05, -0.55, -0.45, -0.95, 0, -0.62);
  g.fill();
  g.strokeStyle = '#6b4226';
  g.lineWidth = 0.1;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -0.58);
  g.quadraticCurveTo(0.04, -0.85, 0.12, -0.98);
  g.stroke();
  leaf(g, 0.1, -0.86, 0.45, -0.5);
  shine(g, -0.4, -0.25, 0.16, 0.26, 0.4);
}

export function drawBanana(g) {
  g.save();
  g.rotate(-0.35);
  g.fillStyle = radial(g, 0, -0.4, 1.4, ['#fff2a0', '#ffd93d', '#e8b41f']);
  g.beginPath();
  g.moveTo(-0.95, -0.25);
  g.quadraticCurveTo(0, 0.95, 0.95, -0.3);
  g.quadraticCurveTo(0.9, -0.05, 0.75, 0.05);
  g.quadraticCurveTo(0, 0.55, -0.8, -0.05);
  g.closePath();
  g.fill();
  g.fillStyle = '#7a5a2a';
  circle(g, -0.92, -0.22, 0.07);
  g.fill();
  circle(g, 0.93, -0.28, 0.06);
  g.fill();
  g.restore();
}

export function drawCarrot(g) {
  g.save();
  g.rotate(0.5);
  for (const [a, l] of [[-0.45, 0.5], [0, 0.6], [0.45, 0.5]]) leaf(g, 0, -0.62, l, -Math.PI / 2 + a, '#4fb84a');
  g.fillStyle = radial(g, -0.15, -0.3, 1.2, ['#ffc078', '#ff8a1f', '#e06a10']);
  g.beginPath();
  g.moveTo(-0.32, -0.62);
  g.quadraticCurveTo(0, -0.72, 0.32, -0.62);
  g.quadraticCurveTo(0.2, 0.3, 0, 0.95);
  g.quadraticCurveTo(-0.2, 0.3, -0.32, -0.62);
  g.fill();
  g.strokeStyle = 'rgba(160,70,10,0.45)';
  g.lineWidth = 0.05;
  g.lineCap = 'round';
  for (const y of [-0.3, 0, 0.3]) {
    g.beginPath();
    g.moveTo(-0.18 + y * 0.2, y);
    g.lineTo(-0.02, y + 0.04);
    g.stroke();
  }
  g.restore();
}

export function drawStrawberry(g) {
  g.fillStyle = radial(g, -0.25, -0.3, 1.3, ['#ff9aa5', '#ff3d55', '#c8203a']);
  g.beginPath();
  g.moveTo(0, -0.55);
  g.bezierCurveTo(0.9, -0.75, 0.95, 0.1, 0, 0.9);
  g.bezierCurveTo(-0.95, 0.1, -0.9, -0.75, 0, -0.55);
  g.fill();
  g.fillStyle = '#ffe9a8';
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 0.3 + (Math.floor(i / 3) % 2) * 0.12;
    const y = -0.25 + Math.floor(i / 3) * 0.3;
    g.beginPath();
    g.ellipse(x * (1 - y * 0.4), y, 0.04, 0.065, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#3fae49';
  starPath(g, 5, 0.42, 0.16, Math.PI / 2);
  g.save();
  g.translate(0, -0.55);
  g.scale(1, 0.55);
  starPath(g, 5, 0.5, 0.18, Math.PI / 2);
  g.fill();
  g.restore();
  shine(g, -0.3, -0.2, 0.1, 0.18, 0.5, 0.5);
}

export function drawFishFood(g) {
  g.fillStyle = radial(g, -0.2, -0.3, 1.3, ['#bfe9ff', '#57b3f0', '#2f86c6']);
  g.beginPath();
  g.ellipse(-0.1, 0, 0.7, 0.42, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(0.5, 0);
  g.lineTo(0.95, -0.38);
  g.lineTo(0.95, 0.38);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  circle(g, -0.45, -0.08, 0.11);
  g.fill();
  g.fillStyle = '#2b2440';
  circle(g, -0.47, -0.08, 0.06);
  g.fill();
  shine(g, -0.05, -0.2, 0.25, 0.08, 0, 0.45);
}

export function drawBone(g) {
  g.save();
  g.rotate(-0.4);
  g.fillStyle = radial(g, -0.2, -0.3, 1.4, ['#ffffff', '#fbf2df', '#e5d3b0']);
  roundRect(g, -0.62, -0.17, 1.24, 0.34, 0.16);
  g.fill();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    circle(g, sx * 0.68, sy * 0.17, 0.24);
    g.fill();
  }
  g.restore();
}

export function drawCherries(g) {
  g.strokeStyle = '#4f8a2a';
  g.lineWidth = 0.08;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-0.38, 0.2);
  g.quadraticCurveTo(-0.2, -0.5, 0.15, -0.85);
  g.moveTo(0.38, 0.3);
  g.quadraticCurveTo(0.3, -0.4, 0.15, -0.85);
  g.stroke();
  leaf(g, 0.15, -0.85, 0.45, -0.2);
  for (const [x, y] of [[-0.38, 0.4], [0.38, 0.5]]) {
    g.fillStyle = radial(g, x - 0.12, y - 0.15, 0.6, ['#ff8a96', '#e8243c', '#a8102a']);
    circle(g, x, y, 0.36);
    g.fill();
    shine(g, x - 0.13, y - 0.14, 0.07, 0.11, 0.5, 0.6);
  }
}

export function drawOrange(g) {
  g.fillStyle = radial(g, -0.3, -0.35, 1.4, ['#ffd08a', '#ff9a1f', '#e0700f']);
  circle(g, 0, 0.05, 0.85);
  g.fill();
  g.fillStyle = 'rgba(200,90,0,0.25)';
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 0.25 + (i % 4) * 0.14;
    circle(g, Math.cos(a) * r, 0.05 + Math.sin(a) * r, 0.03);
    g.fill();
  }
  leaf(g, 0.05, -0.75, 0.42, -0.6);
  shine(g, -0.38, -0.3, 0.14, 0.22, 0.5);
}

export function drawGrapes(g) {
  g.strokeStyle = '#6b4a2a';
  g.lineWidth = 0.08;
  g.beginPath();
  g.moveTo(0, -0.62);
  g.lineTo(0.05, -0.9);
  g.stroke();
  leaf(g, 0.05, -0.82, 0.42, -0.3);
  const pts = [[-0.32, -0.45], [0, -0.48], [0.32, -0.45], [-0.18, -0.15], [0.16, -0.15], [-0.4, -0.12], [0.42, -0.12],
    [0, 0.14], [-0.26, 0.15], [0.26, 0.15], [-0.12, 0.42], [0.14, 0.42], [0, 0.68]];
  for (const [x, y] of pts) {
    g.fillStyle = radial(g, x - 0.06, y - 0.08, 0.35, ['#d8b0ff', '#9a5ae8', '#6a2ec0']);
    circle(g, x, y, 0.2);
    g.fill();
  }
  shine(g, -0.38, -0.5, 0.05, 0.08, 0.4, 0.6);
}

export const FOODS = {
  apple: (g) => drawApple(g),
  banana: drawBanana,
  carrot: drawCarrot,
  strawberry: drawStrawberry,
  fish: drawFishFood,
  bone: drawBone,
  cherries: drawCherries,
  orange: drawOrange,
  grapes: drawGrapes,
};

export const FOOD_NAMES = {
  apple: 'תפוח', banana: 'בננה', carrot: 'גזר', strawberry: 'תות', fish: 'דג',
  bone: 'עצם', cherries: 'דובדבנים', orange: 'תפוז', grapes: 'ענבים',
};

// --- flowers -----------------------------------------------------------------

// A bloom in unit space, `open` 0..1 unfurls it. Several kinds so a full
// garden looks like a garden and not a stamp.
export function drawBloom(g, kind, color, open = 1, t = 0) {
  const o = Math.max(0.001, open);
  g.save();
  g.scale(o, o);
  g.rotate(Math.sin(t * 1.3) * 0.06);
  const dark = darken(color, 0.18), light = lighten(color, 0.35);
  if (kind === 'tulip') {
    g.fillStyle = radial(g, -0.2, -0.5, 1.3, [light, color, dark]);
    g.beginPath();
    g.moveTo(-0.55, -0.5);
    g.lineTo(-0.3, -0.2);
    g.lineTo(0, -0.62);
    g.lineTo(0.3, -0.2);
    g.lineTo(0.55, -0.5);
    g.quadraticCurveTo(0.65, 0.45, 0, 0.5);
    g.quadraticCurveTo(-0.65, 0.45, -0.55, -0.5);
    g.fill();
    shine(g, -0.22, 0, 0.08, 0.22, 0.2, 0.4);
  } else if (kind === 'sunflower') {
    g.fillStyle = color;
    for (let i = 0; i < 16; i++) {
      g.save();
      g.rotate((i / 16) * TAU);
      g.beginPath();
      g.ellipse(0, -0.62, 0.13, 0.32, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    g.fillStyle = radial(g, -0.1, -0.1, 0.5, ['#a06a3a', '#6b4226', '#4a2c16']);
    circle(g, 0, 0, 0.38);
    g.fill();
    g.fillStyle = 'rgba(255,220,120,0.35)';
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = 0.08 + (i % 4) * 0.07;
      circle(g, Math.cos(a) * r, Math.sin(a) * r, 0.03);
      g.fill();
    }
  } else if (kind === 'rose') {
    for (let k = 0; k < 3; k++) {
      const r = 0.75 - k * 0.22;
      g.fillStyle = k % 2 ? light : color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + k * 0.6;
        circle(g, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.5);
        g.fill();
      }
    }
    g.strokeStyle = dark;
    g.lineWidth = 0.05;
    g.beginPath();
    g.arc(0, 0, 0.14, 0, TAU * 0.8);
    g.stroke();
  } else if (kind === 'magic') {
    // A star-flower that glows. It is the reward for the top level.
    glow(g, 0, 0, 1.4, lighten(color, 0.4), 0.5);
    g.fillStyle = radial(g, 0, 0, 1, ['#ffffff', light, color]);
    starPath(g, 6, 0.95, 0.42, t * 0.6);
    g.fill();
    g.fillStyle = '#fff8d0';
    circle(g, 0, 0, 0.22);
    g.fill();
  } else {
    // daisy
    g.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i / 8) * TAU);
      g.beginPath();
      g.ellipse(0, -0.5, 0.2, 0.38, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    g.fillStyle = radial(g, -0.08, -0.08, 0.4, ['#fff7b0', '#ffd93d', '#e8a91f']);
    circle(g, 0, 0, 0.26);
    g.fill();
  }
  g.restore();
}

// --- cake ----------------------------------------------------------------------

// One tier of cake, `w` wide and `h` tall, with its base at y = 0. `icing` is
// the drip layer on top; null leaves it bare sponge.
export function drawTier(g, w, h, sponge, icing, t = 0, seed = 0) {
  const x = -w / 2;
  g.fillStyle = radial(g, -w * 0.25, -h * 0.9, w * 1.2, [lighten(sponge, 0.25), sponge, darken(sponge, 0.18)]);
  roundRect(g, x, -h, w, h, Math.min(w, h) * 0.12);
  g.fill();
  // cream filling line
  g.fillStyle = 'rgba(255,255,255,0.75)';
  roundRect(g, x + w * 0.02, -h * 0.5 - h * 0.05, w * 0.96, h * 0.1, h * 0.05);
  g.fill();
  if (icing) {
    g.fillStyle = icing;
    g.beginPath();
    g.moveTo(x, -h + h * 0.12);
    g.quadraticCurveTo(x, -h, x + h * 0.12, -h);
    g.lineTo(-x - h * 0.12, -h);
    g.quadraticCurveTo(-x, -h, -x, -h + h * 0.12);
    const drips = Math.max(4, Math.round(w / (h * 0.32)));
    for (let i = drips; i >= 0; i--) {
      const px = x + (w * i) / drips;
      const len = h * (0.22 + 0.2 * Math.abs(Math.sin(i * 2.7 + seed)));
      g.lineTo(px, -h + len);
      if (i > 0) {
        const mx = px - w / drips / 2;
        g.quadraticCurveTo(mx, -h + len + h * 0.1, px - w / drips, -h + h * 0.24);
      }
    }
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    roundRect(g, x + w * 0.06, -h + h * 0.05, w * 0.4, h * 0.06, h * 0.03);
    g.fill();
  }
}

export function drawCandle(g, h, color, lit, t, seed = 0) {
  g.fillStyle = color;
  roundRect(g, -0.09 * h, -h, 0.18 * h, h, 0.05 * h);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 0.05 * h;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(-0.09 * h, -h + i * 0.26 * h + 0.06 * h);
    g.lineTo(0.09 * h, -h + i * 0.26 * h + 0.16 * h);
    g.stroke();
  }
  g.strokeStyle = '#4a3b52';
  g.lineWidth = 0.03 * h;
  g.beginPath();
  g.moveTo(0, -h);
  g.lineTo(0, -h - 0.08 * h);
  g.stroke();
  if (lit > 0) {
    const f = 1 + Math.sin(t * 17 + seed * 3) * 0.08 + Math.sin(t * 7 + seed) * 0.05;
    const fh = 0.36 * h * lit * f;
    glow(g, 0, -h - fh * 0.5, h * 0.5 * lit, '#ffd27a', 0.6);
    g.save();
    g.translate(0, -h - 0.06 * h);
    g.rotate(Math.sin(t * 5 + seed) * 0.08);
    g.fillStyle = radial(g, 0, -fh * 0.3, fh, ['#fffbe0', '#ffd23d', '#ff7a1f']);
    g.beginPath();
    g.moveTo(0, -fh);
    g.quadraticCurveTo(fh * 0.4, -fh * 0.3, 0, 0);
    g.quadraticCurveTo(-fh * 0.4, -fh * 0.3, 0, -fh);
    g.fill();
    g.restore();
  }
}

// Decorations that go on a cake. Each draws at unit size.
export const TOPPINGS = [
  { id: 'strawberry', name: 'תות', draw: drawStrawberry, size: 1 },
  { id: 'cherries', name: 'דובדבנים', draw: drawCherries, size: 1 },
  { id: 'heart', name: 'לב', size: 0.9, draw: (g) => {
    g.fillStyle = radial(g, -0.3, -0.3, 1.2, ['#ffc4dd', '#ff5fa2', '#d93d7f']);
    g.save(); g.translate(0, 0.1); heart(g, 0.85); g.fill(); g.restore();
    shine(g, -0.32, -0.25, 0.1, 0.16, 0.6, 0.6);
  } },
  { id: 'star', name: 'כוכב', size: 0.95, draw: (g) => {
    g.fillStyle = radial(g, -0.2, -0.3, 1.2, ['#fff8c0', '#ffd93d', '#e8a91f']);
    starPath(g, 5, 0.95, 0.45);
    g.fill();
    shine(g, -0.25, -0.25, 0.08, 0.14, 0.6, 0.6);
  } },
  { id: 'candy', name: 'סוכריה', size: 0.85, draw: (g) => {
    g.fillStyle = '#ffffff';
    circle(g, 0, 0, 0.8);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, 0.8, 0, TAU);
    g.clip();
    g.fillStyle = '#ff4d8a';
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i / 6) * TAU);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(0.5, -0.2, 0.9, 0.2);
      g.lineTo(0.9, 0.55);
      g.quadraticCurveTo(0.35, 0.15, 0, 0);
      g.fill();
      g.restore();
    }
    g.restore();
    shine(g, -0.3, -0.3, 0.12, 0.2, 0.6, 0.6);
  } },
  { id: 'flower', name: 'פרח', size: 1, draw: (g) => drawBloom(g, 'daisy', '#ffffff', 0.95) },
  { id: 'orange', name: 'תפוז', draw: drawOrange, size: 0.85 },
  { id: 'grapes', name: 'ענבים', draw: drawGrapes, size: 0.95 },
];

export const SPONGES = [
  { c: '#f5c983', name: 'וניל' },
  { c: '#8a5a3c', name: 'שוקולד' },
  { c: '#ff9fbf', name: 'תות' },
];

export const ICINGS = [
  { c: '#ffffff', name: 'לבן' },
  { c: '#ff85c8', name: 'ורוד' },
  { c: '#6b3f2a', name: 'שוקולד' },
  { c: '#9fd8ff', name: 'תכלת' },
  { c: '#c6a4ff', name: 'סגול' },
  { c: '#bff09a', name: 'ירוק' },
];

// Small colourful sprinkle; used scattered across icing.
export function sprinkle(g, x, y, len, rot, color) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  roundRect(g, -len / 2, -len * 0.18, len, len * 0.36, len * 0.18);
  g.fill();
  g.restore();
}

export const SPRINKLE_COLORS = [C.red, C.yellow, C.sky, C.lime, C.purple, C.orange, '#fff'];
