// Island scenery shared by the title screen and the map: sea, beach, palm
// trees, the castle on the hill, a hot-air balloon and a little sailing boat.
//
// Static pieces are drawn into the scene's baked backdrop; the animated ones
// (waves, balloon, boat, gulls) are cheap enough to draw every frame.

import { TAU, rand } from '../core/util.js';

import { circle, radial, roundRect, lighten, verticalGradient, linearGradient } from '../core/gfx.js';

export const ISLAND_SKY = ['#7fc4ff', '#b6e0ff', '#ffe1f0', '#fff1dc'];

// Distant sea along the horizon, with a few bands of lighter water.
export function paintSea(g, e, y0) {
  g.fillStyle = verticalGradient(g, y0, e.h, ['#5ec8ef', '#3aa7dc', '#2f8fd0']);
  g.fillRect(0, y0, e.w, e.h - y0);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 6; i++) {
    const y = y0 + (e.h - y0) * (0.08 + i * 0.16);
    g.fillRect(0, y, e.w, Math.max(1, e.min * 0.004));
  }
}

// The island itself: a soft organic shape with a sand rim, sitting in the sea.
export function islandPath(g, cx, cy, rx, ry) {
  g.beginPath();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const wob = 1 + Math.sin(a * 3 + 0.6) * 0.045 + Math.cos(a * 5 - 0.3) * 0.03;
    const x = cx + Math.cos(a) * rx * wob;
    const y = cy + Math.sin(a) * ry * wob;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function paintIsland(g, cx, cy, rx, ry) {
  // shallow water glow around the shore
  g.save();
  g.fillStyle = 'rgba(160,240,255,0.55)';
  islandPath(g, cx, cy + ry * 0.04, rx * 1.09, ry * 1.12);
  g.fill();
  // sand
  g.fillStyle = radial(g, cx, cy - ry * 0.3, rx * 1.3, ['#fff3c4', '#ffe29a', '#f3c770']);
  islandPath(g, cx, cy, rx * 1.02, ry * 1.04);
  g.fill();
  // grass
  g.fillStyle = radial(g, cx - rx * 0.2, cy - ry * 0.5, rx * 1.4, ['#b8f27a', '#7fd95a', '#4fb84a']);
  islandPath(g, cx, cy - ry * 0.03, rx * 0.9, ry * 0.88);
  g.fill();
  // soft lighter patches so the meadow is not flat
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 7; i++) {
    const a = i * 1.7;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.45, rx * 0.16, ry * 0.08, a, 0, TAU);
    g.fill();
  }
  g.restore();
}

export function palm(g, x, y, s, flip = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip, s);
  g.strokeStyle = '#a0703f';
  g.lineWidth = 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(0.25, -0.6, 0.12, -1.25);
  g.stroke();
  g.strokeStyle = 'rgba(90,50,20,0.35)';
  g.lineWidth = 0.05;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const px = 0.25 * 2 * t * (1 - t) + 0.12 * t * t;
    const py = -0.6 * 2 * t * (1 - t) - 1.25 * t * t;
    g.beginPath();
    g.moveTo(px - 0.08, py);
    g.lineTo(px + 0.08, py + 0.03);
    g.stroke();
  }
  g.translate(0.12, -1.25);
  for (const a of [-2.7, -2.1, -1.4, -0.7, -0.15]) {
    g.save();
    g.rotate(a);
    g.fillStyle = a < -1.2 ? '#3fae49' : '#56c35a';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(0.45, -0.32, 0.95, 0.06);
    g.quadraticCurveTo(0.5, -0.05, 0, 0.08);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#8a5a2c';
  circle(g, -0.06, 0.08, 0.09);
  g.fill();
  circle(g, 0.08, 0.1, 0.09);
  g.fill();
  g.restore();
}

// Pastel fairy-tale castle, base at (x, y), roughly `s` wide.
export function castle(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const wall = '#ffe6f2', shade = '#f5c9de', roof = '#b98cff', roofDark = '#8e62e0';
  const tower = (tx, w, h, rh) => {
    g.fillStyle = linearGradient(g, tx - w / 2, 0, tx + w / 2, 0, [wall, wall, shade]);
    g.fillRect(tx - w / 2, -h, w, h);
    g.fillStyle = linearGradient(g, tx - w / 2, 0, tx + w / 2, 0, [lighten(roof, 0.2), roof, roofDark]);
    g.beginPath();
    g.moveTo(tx - w * 0.62, -h);
    g.lineTo(tx, -h - rh);
    g.lineTo(tx + w * 0.62, -h);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff6bb0';
    g.beginPath();
    g.moveTo(tx, -h - rh);
    g.lineTo(tx, -h - rh - 0.16);
    g.lineTo(tx + 0.14, -h - rh - 0.11);
    g.lineTo(tx, -h - rh - 0.07);
    g.fill();
    g.fillStyle = '#7a64c8';
    roundRect(g, tx - w * 0.15, -h * 0.72, w * 0.3, h * 0.2, w * 0.15);
    g.fill();
  };
  tower(-0.38, 0.22, 0.75, 0.32);
  tower(0.38, 0.22, 0.75, 0.32);
  g.fillStyle = linearGradient(g, -0.3, 0, 0.3, 0, [wall, wall, shade]);
  g.fillRect(-0.3, -0.55, 0.6, 0.55);
  for (let i = 0; i < 4; i++) g.fillRect(-0.3 + i * 0.17, -0.63, 0.1, 0.1);
  tower(0, 0.26, 0.95, 0.42);
  g.fillStyle = '#9a6ad8';
  g.beginPath();
  g.moveTo(-0.1, 0);
  g.lineTo(-0.1, -0.2);
  g.arc(0, -0.2, 0.1, Math.PI, 0);
  g.lineTo(0.1, 0);
  g.closePath();
  g.fill();
  g.restore();
}

// Waves lapping the shore of an elliptical island. Drawn every frame: a
// dashed white ring that drifts outward and fades, so the sea is never still.
export function shoreWaves(g, cx, cy, rx, ry, t) {
  g.save();
  g.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const p = ((t * 0.18 + k * 0.5) % 1);
    const sc = 1.1 + p * 0.12;
    g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
    g.lineWidth = Math.max(1.5, Math.min(rx, ry) * 0.012);
    g.setLineDash([Math.min(rx, ry) * 0.12, Math.min(rx, ry) * 0.08]);
    g.lineDashOffset = t * 8 + k * 30;
    islandPath(g, cx, cy + ry * 0.04, rx * sc, ry * (sc + 0.03));
    g.stroke();
  }
  g.setLineDash([]);
  g.restore();
}

export function hotAirBalloon(g, x, y, s, t) {
  g.save();
  g.translate(x, y + Math.sin(t * 0.9) * s * 0.12);
  g.rotate(Math.sin(t * 0.7) * 0.05);
  g.scale(s, s);
  g.strokeStyle = '#7a5a3a';
  g.lineWidth = 0.025;
  g.beginPath();
  g.moveTo(-0.32, 0.45);
  g.lineTo(-0.14, 0.85);
  g.moveTo(0.32, 0.45);
  g.lineTo(0.14, 0.85);
  g.stroke();
  g.fillStyle = '#c98a4a';
  roundRect(g, -0.17, 0.82, 0.34, 0.22, 0.05);
  g.fill();
  const cols = ['#ff6b8a', '#ffd93d', '#57c7ff', '#a8e05f', '#c17bff'];
  g.save();
  g.beginPath();
  g.moveTo(0, -0.62);
  g.bezierCurveTo(0.7, -0.62, 0.68, 0.15, 0.25, 0.55);
  g.lineTo(-0.25, 0.55);
  g.bezierCurveTo(-0.68, 0.15, -0.7, -0.62, 0, -0.62);
  g.clip();
  for (let i = 0; i < 5; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.ellipse(0, 0, 0.7 - i * 0.14, 1, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.ellipse(-0.25, -0.25, 0.12, 0.26, 0.3, 0, TAU);
  g.fill();
  g.restore();
  g.restore();
}

export function boat(g, x, y, s, t) {
  g.save();
  g.translate(x, y + Math.sin(t * 1.6) * s * 0.05);
  g.rotate(Math.sin(t * 1.2) * 0.06);
  g.scale(s, s);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0.02, -0.15);
  g.lineTo(0.02, -1.0);
  g.quadraticCurveTo(0.5, -0.5, 0.48, -0.15);
  g.closePath();
  g.fill();
  g.fillStyle = '#ff9ac6';
  g.beginPath();
  g.moveTo(-0.04, -0.15);
  g.lineTo(-0.04, -0.85);
  g.quadraticCurveTo(-0.38, -0.45, -0.38, -0.15);
  g.closePath();
  g.fill();
  g.strokeStyle = '#8a5a2c';
  g.lineWidth = 0.05;
  g.beginPath();
  g.moveTo(0, -0.1);
  g.lineTo(0, -1.02);
  g.stroke();
  g.fillStyle = '#ff6b5d';
  g.beginPath();
  g.moveTo(-0.6, -0.12);
  g.lineTo(0.6, -0.12);
  g.quadraticCurveTo(0.45, 0.2, 0.3, 0.2);
  g.lineTo(-0.3, 0.2);
  g.quadraticCurveTo(-0.45, 0.2, -0.6, -0.12);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  circle(g, -0.2, 0.03, 0.05);
  g.fill();
  circle(g, 0.05, 0.03, 0.05);
  g.fill();
  circle(g, 0.3, 0.03, 0.05);
  g.fill();
  g.restore();
}

export function gull(g, x, y, s, t, ph = 0) {
  const flap = Math.sin(t * 6 + ph) * 0.35;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = 'rgba(70,60,100,0.6)';
  g.lineWidth = 0.12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-1, -flap);
  g.quadraticCurveTo(-0.5, -0.5 - flap, 0, 0);
  g.quadraticCurveTo(0.5, -0.5 - flap, 1, -flap);
  g.stroke();
  g.restore();
}

// A starry, sparkling field of dust motes, refreshed per scene.
export function makeMotes(n = 26) {
  return Array.from({ length: n }, () => ({
    x: rand(1), y: rand(1), s: rand(0.4, 1), ph: rand(10), v: rand(0.006, 0.02),
  }));
}

export function drawMotes(g, e, motes, t, color = '#fffbe6') {
  for (const m of motes) {
    m.y -= m.v * 0.016;
    if (m.y < -0.05) { m.y = 1.05; m.x = rand(1); }
    const a = 0.35 + Math.sin(t * 2 + m.ph) * 0.35;
    if (a <= 0.02) continue;
    const x = m.x * e.w + Math.sin(t * 0.6 + m.ph) * e.min * 0.02;
    const y = m.y * e.h;
    g.globalAlpha = a;
    g.fillStyle = color;
    circle(g, x, y, e.min * 0.005 * m.s + 1);
    g.fill();
  }
  g.globalAlpha = 1;
}

// --- living details ---------------------------------------------------------------

// Sunlight on the water: little four-point glints that wink on and off at
// fixed spots, each on its own beat, so the sea always shimmers.
export function seaGlints(g, e, y0, t, n = 26) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = ((i * 0.618 + 0.13) % 1) * e.w;
    const y = y0 + ((i * 0.377 + 0.07) % 1) * (e.h - y0);
    const k = Math.sin(t * (1.3 + (i % 5) * 0.31) + i * 2.1);
    if (k < 0.55) continue;
    const s = e.min * 0.018 * (k - 0.55) / 0.45;
    g.globalAlpha = (k - 0.55) / 0.45;
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x + s * 0.1, y - s * 0.1, x + s * 1.6, y);
    g.quadraticCurveTo(x + s * 0.1, y + s * 0.1, x, y + s);
    g.quadraticCurveTo(x - s * 0.1, y + s * 0.1, x - s * 1.6, y);
    g.quadraticCurveTo(x - s * 0.1, y - s * 0.1, x, y - s);
    g.fill();
  }
  g.restore();
}

// Soft beams of light fanning slowly out of the sun.
export function sunBeams(g, x, y, len, t, n = 9) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.translate(x, y);
  g.rotate(t * 0.05);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 0.08 + 0.04 * Math.sin(t * 0.8 + i);
    const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grad.addColorStop(0, 'rgba(255,245,200,0.14)');
    grad.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, len, a - w, a + w);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// A happy dolphin, unit length about 2, nose toward +x.
export function dolphin(g, x, y, s, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = radial(g, -0.2, -0.3, 1.4, ['#bfe7ff', '#6fb8ec', '#3f86c6']);
  g.beginPath();
  g.moveTo(1.0, 0.05);
  g.quadraticCurveTo(0.9, -0.42, 0.1, -0.4);
  g.quadraticCurveTo(-0.6, -0.36, -0.95, 0.02);
  g.lineTo(-1.25, -0.28);
  g.lineTo(-1.18, 0.05);
  g.lineTo(-1.3, 0.3);
  g.lineTo(-0.95, 0.12);
  g.quadraticCurveTo(-0.3, 0.32, 0.5, 0.2);
  g.quadraticCurveTo(0.85, 0.18, 1.0, 0.05);
  g.fill();
  // fin
  g.beginPath();
  g.moveTo(-0.1, -0.38);
  g.quadraticCurveTo(-0.15, -0.72, -0.42, -0.72);
  g.quadraticCurveTo(-0.3, -0.5, -0.35, -0.34);
  g.fill();
  // belly
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(0.25, 0.12, 0.5, 0.1, 0.05, 0, TAU);
  g.fill();
  // eye and smile
  g.fillStyle = '#2b2440';
  circle(g, 0.62, -0.12, 0.06);
  g.fill();
  g.strokeStyle = '#2b2440';
  g.lineWidth = 0.035;
  g.beginPath();
  g.arc(0.78, -0.02, 0.12, 0.3, 1.4);
  g.stroke();
  g.restore();
}

export function butterfly(g, x, y, s, t, color, ph = 0) {
  const flap = Math.abs(Math.sin(t * 13 + ph));
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (const sd of [-1, 1]) {
    g.save();
    g.scale(sd * (0.25 + flap * 0.75), 1);
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0.42, -0.28, 0.45, 0.36, -0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(0.3, 0.3, 0.3, 0.26, 0.5, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    circle(g, 0.48, -0.3, 0.11);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#4a3b52';
  g.beginPath();
  g.ellipse(0, 0, 0.08, 0.36, 0, 0, TAU);
  g.fill();
  g.restore();
}
