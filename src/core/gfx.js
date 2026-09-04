// Drawing toolkit.
//
// All the art in this game is drawn with canvas paths rather than bitmaps: it
// stays razor sharp on a retina tablet, weighs nothing to download, and lets
// characters squash, blink and breathe per frame instead of cycling frames.
//
// Convention: shape helpers draw around the origin so callers can translate,
// rotate and scale freely.

import { TAU, clamp, lerp } from './util.js';
import { C } from './palette.js';

// Gradient cache.
//
// Building a CanvasGradient is not free, and the characters ask for one per body
// part per frame. Gradient coordinates are interpreted in user space at paint
// time, so a gradient defined in a unit space stays correct under any translate,
// rotate or scale - which means one cached object serves every cow on screen at
// every size. Call sites that scale to unit space before filling therefore get a
// cache hit every time.
const gradCache = new WeakMap();

function cached(g, key, make) {
  let map = gradCache.get(g);
  if (!map) {
    map = new Map();
    gradCache.set(g, map);
  }
  let grad = map.get(key);
  if (grad === undefined) {
    // Pixel-space callers vary their key, so keep a lid on it.
    if (map.size > 400) map.clear();
    grad = make();
    map.set(key, grad);
  }
  return grad;
}

const stopsKey = (stops) => stops.join('|');

export function verticalGradient(g, y0, y1, stops) {
  return cached(g, `v${y0.toFixed(1)},${y1.toFixed(1)},${stopsKey(stops)}`, () => {
    const grad = g.createLinearGradient(0, y0, 0, y1);
    const n = stops.length - 1;
    stops.forEach((c, i) => grad.addColorStop(i / n, c));
    return grad;
  });
}

export function linearGradient(g, x0, y0, x1, y1, stops) {
  return cached(g, `l${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)},${stopsKey(stops)}`, () => {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    const n = stops.length - 1;
    stops.forEach((c, i) => grad.addColorStop(i / n, c));
    return grad;
  });
}

export function radial(g, x, y, r, stops) {
  return cached(g, `r${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)},${stopsKey(stops)}`, () => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const n = stops.length - 1;
    stops.forEach((c, i) => grad.addColorStop(i / n, c));
    return grad;
  });
}

export function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

export function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

// A soft, slightly irregular blob. `wobble` + `phase` animate the outline so
// bushes and clouds are never perfectly still.
export function blob(g, r, wobble = 0.06, phase = 0, lobes = 7) {
  g.beginPath();
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const rr = r * (1 + Math.sin(a * lobes + phase) * wobble + Math.cos(a * (lobes - 3) - phase * 0.7) * wobble * 0.5);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function star(g, points, outer, inner, rot = 0) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2 + rot;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function heart(g, s) {
  g.beginPath();
  g.moveTo(0, s * 0.32);
  g.bezierCurveTo(-s * 1.25, -s * 0.5, -s * 0.5, -s * 1.2, 0, -s * 0.45);
  g.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.25, -s * 0.5, 0, s * 0.32);
  g.closePath();
}

export function flower(g, petals, r, petalR) {
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    g.beginPath();
    g.ellipse(Math.cos(a) * r, Math.sin(a) * r, petalR, petalR * 0.78, a, 0, TAU);
    g.fill();
  }
}

export function cloud(g, w, h, phase = 0) {
  const lobes = [
    [-w * 0.34, h * 0.1, h * 0.62],
    [-w * 0.05, -h * 0.18, h * 0.92],
    [w * 0.28, h * 0.02, h * 0.7],
    [w * 0.5, h * 0.2, h * 0.46],
  ];
  g.beginPath();
  lobes.forEach(([lx, ly, lr], i) => {
    const wob = Math.sin(phase + i * 1.3) * h * 0.05;
    g.moveTo(lx + lr + wob, ly + h * 0.32);
    g.arc(lx, ly + wob, lr, 0, TAU);
  });
  g.rect(-w * 0.44, h * 0.16, w * 1.0, h * 0.34);
  g.closePath();
}

// Drop shadow used under every character. Cheap ellipse, no blur filter, which
// matters for frame rate on tablets.
export function groundShadow(g, x, y, w, alpha = 0.16) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#2a2140';
  g.beginPath();
  g.ellipse(x, y, w, w * 0.28, 0, 0, TAU);
  g.fill();
  g.restore();
}

// A rounded body with a lighter top - the base of most characters and props.
export function bubbleBody(g, r, color, dark, highlight = true) {
  g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 1.7, [lighten(color, 0.35), color, dark]);
  circle(g, 0, 0, r);
  g.fill();
  if (highlight) {
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-r * 0.34, -r * 0.42, r * 0.28, r * 0.19, -0.5, 0, TAU);
    g.fill();
    g.restore();
  }
}

// --- faces ----------------------------------------------------------------

// Big glossy eyes with a moving pupil, a highlight and a lid for blinking.
// `blink` 0..1, `look` is a direction vector the pupils track.
export function eyes(g, spacing, r, { blink = 0, lookX = 0, lookY = 0, pupil = 0.5, happy = 0 } = {}) {
  for (const s of [-1, 1]) {
    const x = s * spacing;
    g.save();
    g.translate(x, 0);
    if (happy > 0.5) {
      // closed, upturned "^_^" eye
      g.strokeStyle = C.ink;
      g.lineWidth = r * 0.42;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, r * 0.35, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      g.restore();
      continue;
    }
    const open = 1 - blink;
    g.beginPath();
    g.ellipse(0, 0, r, r * Math.max(0.04, open), 0, 0, TAU);
    g.fillStyle = '#fff';
    g.fill();
    if (open > 0.25) {
      g.save();
      g.beginPath();
      g.ellipse(0, 0, r, r * open, 0, 0, TAU);
      g.clip();
      const pr = r * pupil;
      g.fillStyle = C.ink;
      circle(g, lookX * r * 0.34, lookY * r * 0.34, pr);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      circle(g, lookX * r * 0.34 - pr * 0.36, lookY * r * 0.34 - pr * 0.4, pr * 0.32);
      g.fill();
      g.restore();
    }
    g.restore();
  }
}

export function smile(g, w, h, color = C.ink, lw = 0) {
  g.strokeStyle = color;
  g.lineWidth = lw || w * 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-w, 0);
  g.quadraticCurveTo(0, h, w, 0);
  g.stroke();
}

export function openMouth(g, w, h, color = '#c94f6d', tongue = '#ff8fa3') {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-w, 0);
  g.quadraticCurveTo(0, h * 1.5, w, 0);
  g.quadraticCurveTo(0, -h * 0.28, -w, 0);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = tongue;
  g.beginPath();
  g.ellipse(0, h * 1.1, w * 0.6, h * 0.6, 0, 0, TAU);
  g.fill();
  g.restore();
}

export function cheeks(g, spacing, r, color = 'rgba(255,120,140,0.4)') {
  g.fillStyle = color;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * spacing, 0, r, r * 0.7, 0, 0, TAU);
    g.fill();
  }
}

// --- environment ----------------------------------------------------------

export function sun(g, x, y, r, t, color = '#ffe066', ray = 'rgba(255,224,102,0.45)') {
  g.save();
  g.translate(x, y);
  g.save();
  g.rotate(t * 0.22);
  g.fillStyle = ray;
  for (let i = 0; i < 12; i++) {
    g.rotate(TAU / 12);
    const len = r * (1.55 + Math.sin(t * 1.6 + i) * 0.14);
    g.beginPath();
    g.moveTo(-r * 0.14, -r * 0.95);
    g.lineTo(0, -len);
    g.lineTo(r * 0.14, -r * 0.95);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = radial(g, -r * 0.2, -r * 0.25, r * 1.4, ['#fffbe0', color, '#ffc93c']);
  circle(g, 0, 0, r);
  g.fill();
  g.restore();
}

export function rainbow(g, x, y, r, width, alpha = 0.85) {
  const bands = ['#ff6b6b', '#ffa130', '#ffd93d', '#5ecb7a', '#57c7ff', '#8b7dff'];
  g.save();
  g.globalAlpha = alpha;
  g.lineWidth = width;
  bands.forEach((c, i) => {
    g.strokeStyle = c;
    g.beginPath();
    g.arc(x, y, r - i * width, Math.PI, TAU);
    g.stroke();
  });
  g.restore();
}

export function hill(g, x, y, w, h, color, phase = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x - w, y + h);
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const px = lerp(x - w, x + w, t);
    const py = y - Math.sin(t * Math.PI) * h + Math.sin(t * 7 + phase) * h * 0.03;
    g.lineTo(px, py);
  }
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
}

// Height of a quadratic curve whose x endpoints span the full width, which is
// how every ground line in the game is drawn. Lets decoration sit exactly on
// the curve instead of on a straight line near it.
export const quadY = (t, y0, yc, y1) =>
  (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y1;

// Tufts of tapered grass along a ground line. Filled shapes rather than
// strokes: stroked blades read as a row of little fence posts.
export function grassTufts(g, w, count, color, yAt, h) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count) * w + (((i * 37) % 11) - 5);
    const y = yAt(x);
    const hh = h * (0.6 + (((i * 53) % 40) / 55));
    for (let b = -1; b <= 1; b++) {
      const lean = b * 0.4 + ((((i * 29) % 7) - 3) * 0.06);
      g.beginPath();
      g.moveTo(x - hh * 0.1, y);
      g.quadraticCurveTo(x + lean * hh * 0.45, y - hh * 0.6, x + lean * hh, y - hh);
      g.quadraticCurveTo(x + lean * hh * 0.3, y - hh * 0.45, x + hh * 0.1, y);
      g.closePath();
      g.fill();
    }
  }
}

export function grassBlades(g, y, w, count, color, t) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = (i / count) * w + ((i * 37) % 13);
    const h = 10 + ((i * 53) % 22);
    const sway = Math.sin(t * 1.5 + i * 0.6) * 5;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + sway * 0.5, y - h * 0.6, x + sway, y - h);
    g.stroke();
  }
}

// --- ui -------------------------------------------------------------------

// Display face for the big words, rounded face for everything else. Both are
// bundled with the game and both cover Hebrew.
export const FONT = "'Secular One', 'Varela Round', 'Arial Hebrew', system-ui, sans-serif";
export const FONT_BODY = "'Varela Round', 'Arial Hebrew', system-ui, sans-serif";

export function label(g, text, x, y, size, color = C.ink, { align = 'center', stroke = '#fff', weight = 400, sw = 0 } = {}) {
  g.save();
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.direction = 'rtl';
  if (stroke) {
    g.lineWidth = sw || size * 0.28;
    g.strokeStyle = stroke;
    g.lineJoin = 'round';
    g.miterLimit = 2;
    g.strokeText(text, x, y);
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

// Chunky circular button - the only chrome in the game, sized for a small
// finger and always in a screen corner where a toddler is unlikely to hit it.
export function iconButton(g, x, y, r, { press = 0, color = '#ffffff', ring = 'rgba(0,0,0,0.1)' } = {}) {
  const rr = r * (1 - press * 0.1);
  g.save();
  g.translate(x, y + press * r * 0.06);
  g.fillStyle = 'rgba(40,30,60,0.16)';
  circle(g, 0, rr * 0.12, rr);
  g.fill();
  g.fillStyle = color;
  circle(g, 0, 0, rr);
  g.fill();
  g.strokeStyle = ring;
  g.lineWidth = rr * 0.08;
  circle(g, 0, 0, rr * 0.96);
  g.stroke();
  g.restore();
  return rr;
}

export function homeIcon(g, x, y, s, color = C.indigoDark) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -s);
  g.lineTo(s, -s * 0.05);
  g.lineTo(s * 0.62, -s * 0.05);
  g.lineTo(s * 0.62, s * 0.85);
  g.lineTo(-s * 0.62, s * 0.85);
  g.lineTo(-s * 0.62, -s * 0.05);
  g.lineTo(-s, -s * 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  roundRect(g, -s * 0.22, s * 0.15, s * 0.44, s * 0.7, s * 0.1);
  g.fill();
  g.restore();
}

export function speakerIcon(g, x, y, s, on = true, color = C.indigoDark) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-s * 0.75, -s * 0.28);
  g.lineTo(-s * 0.3, -s * 0.28);
  g.lineTo(0.05 * s, -s * 0.7);
  g.lineTo(0.05 * s, s * 0.7);
  g.lineTo(-s * 0.3, s * 0.28);
  g.lineTo(-s * 0.75, s * 0.28);
  g.closePath();
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = s * 0.16;
  g.lineCap = 'round';
  if (on) {
    for (let i = 1; i <= 2; i++) {
      g.beginPath();
      g.arc(s * 0.1, 0, s * (0.2 + i * 0.28), -0.8, 0.8);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.moveTo(s * 0.35, -s * 0.35);
    g.lineTo(s * 0.85, s * 0.35);
    g.moveTo(s * 0.85, -s * 0.35);
    g.lineTo(s * 0.35, s * 0.35);
    g.stroke();
  }
  g.restore();
}

// --- colour maths ---------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map((c) => parseInt(c + c, 16))
    : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return v;
}

export function lighten(hex, amt) {
  if (!hex.startsWith('#')) return hex;
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.round(clamp(v + (255 - v) * amt, 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function darken(hex, amt) {
  if (!hex.startsWith('#')) return hex;
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.round(clamp(v * (1 - amt), 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function alpha(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function hsl(h, s, l, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}
