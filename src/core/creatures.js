// Characters, drawn as vector paths.
//
// Every creature draws inside a unit space: body roughly one unit across,
// centred on the origin, feet near y = +1.1. Scenes translate and scale, so the
// same cow works as a thumbnail on the map and as a two-hand-tall animal on a
// tablet.
//
// `t` is scene time, used for idle motion. `s` is a 0..1 "excited" amount that
// scenes push up when the creature is tapped.

import { TAU } from './util.js';
import { C } from './palette.js';
import { circle, eyes, smile, cheeks, openMouth, radial, lighten, darken, roundRect, star, blob } from './gfx.js';

// Shared bits ---------------------------------------------------------------

function body(g, rx, ry, color, dark) {
  g.fillStyle = radial(g, -rx * 0.3, -ry * 0.45, rx * 2, [lighten(color, 0.3), color, dark]);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, TAU);
  g.fill();
}

function ear(g, x, y, r, rot, color, inner) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-r * 0.7, r * 0.6);
  g.quadraticCurveTo(-r * 0.9, -r * 1.1, 0, -r * 1.15);
  g.quadraticCurveTo(r * 0.9, -r * 1.1, r * 0.7, r * 0.6);
  g.closePath();
  g.fill();
  if (inner) {
    g.fillStyle = inner;
    g.beginPath();
    g.moveTo(-r * 0.38, r * 0.4);
    g.quadraticCurveTo(-r * 0.5, -r * 0.6, 0, -r * 0.68);
    g.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.38, r * 0.4);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function roundEar(g, x, y, r, color, inner) {
  g.fillStyle = color;
  circle(g, x, y, r);
  g.fill();
  if (inner) {
    g.fillStyle = inner;
    circle(g, x, y, r * 0.55);
    g.fill();
  }
}

function legs(g, y, spread, w, h, color, wiggle = 0) {
  g.fillStyle = color;
  for (const s of [-1, 1]) {
    g.save();
    g.translate(s * spread, y);
    g.rotate(s * wiggle);
    roundRect(g, -w / 2, 0, w, h, w / 2);
    g.fill();
    g.restore();
  }
}

function nose(g, x, y, w, h, color = '#4a3b52') {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-w + x, y - h * 0.3);
  g.quadraticCurveTo(x, y + h * 1.2, w + x, y - h * 0.3);
  g.quadraticCurveTo(x, y - h, -w + x, y - h * 0.3);
  g.closePath();
  g.fill();
}

// Blink schedule: eyes stay open, then snap shut for a beat. Randomised per
// creature via `seed` so a row of animals never blinks in unison.
export function blinkAmount(t, seed = 0) {
  const cycle = 3.4 + (seed % 7) * 0.31;
  const p = ((t + seed * 1.7) % cycle) / cycle;
  if (p > 0.94) return Math.sin(((p - 0.94) / 0.06) * Math.PI);
  return 0;
}

const breathe = (t, spd = 1.6, amt = 0.03) => 1 + Math.sin(t * spd) * amt;

// Land animals --------------------------------------------------------------

function drawCat(g, t, s, seed) {
  const bob = Math.sin(t * 2.2) * 0.02 + s * 0.05;
  const col = '#ffb04d', dark = '#e2882b';
  // tail
  g.save();
  g.strokeStyle = col;
  g.lineWidth = 0.17;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.72, 0.5);
  const sway = Math.sin(t * 3 + 1) * 0.35 + s * 0.3;
  g.quadraticCurveTo(1.2, 0.35 + sway * 0.4, 1.05, -0.35 + sway);
  g.stroke();
  g.restore();

  legs(g, 0.72, 0.36, 0.26, 0.35, dark, Math.sin(t * 6) * s * 0.25);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2, 0.035));
  body(g, 0.82, 0.78, col, dark);
  // belly patch
  g.fillStyle = 'rgba(255,248,225,0.85)';
  g.beginPath();
  g.ellipse(0, 0.3, 0.44, 0.42, 0, 0, TAU);
  g.fill();
  g.restore();

  g.save();
  g.translate(0, -0.62 - bob + s * 0.04);
  ear(g, -0.46, -0.34, 0.3, -0.32, col, '#ffd9a8');
  ear(g, 0.46, -0.34, 0.3, 0.32, col, '#ffd9a8');
  g.fillStyle = col;
  circle(g, 0, 0, 0.62);
  g.fill();
  g.fillStyle = 'rgba(255,248,225,0.9)';
  g.beginPath();
  g.ellipse(0, 0.2, 0.36, 0.28, 0, 0, TAU);
  g.fill();
  eyes(g, 0.24, 0.15, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0, lookY: 0.2 });
  nose(g, 0, 0.24, 0.07, 0.06, '#ff8fa3');
  g.strokeStyle = '#4a3b52';
  g.lineWidth = 0.035;
  g.lineCap = 'round';
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(sd * 0.12, 0.26);
      g.quadraticCurveTo(sd * 0.4, 0.2 + i * 0.06 - 0.06, sd * 0.62, 0.12 + i * 0.11 - 0.11);
      g.stroke();
    }
  }
  g.save();
  g.translate(0, 0.34);
  smile(g, 0.13, 0.1, '#4a3b52', 0.04);
  g.restore();
  cheeks(g, 0.42, 0.1);
  g.restore();
}

function drawDog(g, t, s, seed) {
  const bob = Math.sin(t * 2.4) * 0.025 + s * 0.06;
  const col = '#c08552', dark = '#9a6539';
  g.save();
  g.strokeStyle = col;
  g.lineWidth = 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.7, 0.4);
  const wag = Math.sin(t * (7 + s * 12)) * (0.35 + s * 0.35);
  g.quadraticCurveTo(1.1, 0.1, 1.0 + wag * 0.2, -0.3 + wag);
  g.stroke();
  g.restore();

  legs(g, 0.7, 0.38, 0.28, 0.36, dark, Math.sin(t * 7) * s * 0.3);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2.2, 0.04));
  body(g, 0.84, 0.76, col, dark);
  g.fillStyle = '#f3ddc0';
  g.beginPath();
  g.ellipse(0, 0.32, 0.42, 0.38, 0, 0, TAU);
  g.fill();
  g.restore();

  g.save();
  g.translate(0, -0.6 - bob);
  g.fillStyle = col;
  circle(g, 0, 0, 0.64);
  g.fill();
  // floppy ears
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.56, -0.14);
    g.rotate(sd * (0.2 + Math.sin(t * 3 + sd) * 0.08 + s * 0.25));
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(0, 0.28, 0.22, 0.44, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.fillStyle = '#f8e7cd';
  g.beginPath();
  g.ellipse(0, 0.26, 0.34, 0.26, 0, 0, TAU);
  g.fill();
  // eye patch
  g.fillStyle = 'rgba(120,78,45,0.5)';
  circle(g, -0.26, -0.04, 0.22);
  g.fill();
  eyes(g, 0.25, 0.16, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0, lookY: 0.15 });
  nose(g, 0, 0.24, 0.1, 0.08);
  g.save();
  g.translate(0, 0.38);
  if (s > 0.4) openMouth(g, 0.17, 0.14);
  else smile(g, 0.15, 0.09, '#4a3b52', 0.045);
  g.restore();
  g.restore();
}

function drawCow(g, t, s, seed) {
  const bob = Math.sin(t * 1.7) * 0.02 + s * 0.05;
  const col = '#fdfdfd', dark = '#dcd6cf';
  legs(g, 0.68, 0.42, 0.3, 0.4, '#4a3b52', Math.sin(t * 5) * s * 0.2);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 1.6, 0.03));
  body(g, 0.92, 0.76, col, dark);
  // spots
  g.fillStyle = '#4a3b52';
  [[-0.42, -0.2, 0.22], [0.34, 0.1, 0.26], [-0.1, 0.36, 0.16]].forEach(([x, y, r]) => {
    g.save();
    g.translate(x, y);
    blob(g, r, 0.16, seed + x * 3, 6);
    g.fill();
    g.restore();
  });
  g.restore();

  g.save();
  g.translate(0, -0.62 - bob);
  // horns
  g.fillStyle = '#f0e2c0';
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.42, -0.5);
    g.rotate(sd * 0.5);
    g.beginPath();
    g.ellipse(0, 0, 0.1, 0.17, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  roundEar(g, -0.6, -0.18, 0.17, col, '#ffd0d8');
  roundEar(g, 0.6, -0.18, 0.17, col, '#ffd0d8');
  g.fillStyle = col;
  circle(g, 0, 0, 0.6);
  g.fill();
  eyes(g, 0.25, 0.17, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0, lookY: 0.1 });
  // muzzle
  g.fillStyle = '#ffc0cb';
  g.beginPath();
  g.ellipse(0, 0.34, 0.34, 0.24, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#e39aab';
  circle(g, -0.12, 0.3, 0.055);
  g.fill();
  circle(g, 0.12, 0.3, 0.055);
  g.fill();
  g.save();
  g.translate(0, 0.44);
  smile(g, 0.13, 0.07, '#c07d8c', 0.04);
  g.restore();
  g.restore();
}

function drawDuck(g, t, s, seed) {
  const bob = Math.sin(t * 2.6) * 0.03 + s * 0.07;
  const col = C.yellow, dark = C.yellowDark;
  // feet
  g.fillStyle = C.orange;
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.26, 0.82);
    g.beginPath();
    g.moveTo(0, -0.06);
    g.lineTo(sd * 0.3, 0.14);
    g.lineTo(sd * -0.12, 0.14);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(0, -bob);
  g.scale(breathe(t, 2.4, 0.03), breathe(t, 2.4, 0.04));
  body(g, 0.8, 0.72, col, dark);
  // wing
  g.save();
  g.translate(0.3, 0.02);
  g.rotate(Math.sin(t * (4 + s * 16)) * (0.12 + s * 0.5));
  g.fillStyle = lighten(col, 0.25);
  g.beginPath();
  g.ellipse(0, 0, 0.34, 0.24, 0.2, 0, TAU);
  g.fill();
  g.restore();
  g.restore();

  g.save();
  g.translate(-0.06, -0.66 - bob);
  g.fillStyle = col;
  circle(g, 0, 0, 0.48);
  g.fill();
  // tuft
  g.strokeStyle = dark;
  g.lineWidth = 0.07;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, -0.44);
  g.quadraticCurveTo(0.12, -0.7, -0.1, -0.72);
  g.stroke();
  eyes(g, 0.18, 0.13, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  // beak
  g.fillStyle = C.orange;
  g.beginPath();
  g.moveTo(-0.14, 0.2);
  g.quadraticCurveTo(-0.5 - s * 0.08, 0.16, -0.46, 0.3);
  g.quadraticCurveTo(-0.3, 0.4, -0.12, 0.32);
  g.closePath();
  g.fill();
  g.restore();
}

function drawFrog(g, t, s, seed) {
  const hop = s * 0.16;
  const col = '#6fcf5f', dark = '#4aa63c';
  legs(g, 0.5, 0.62, 0.3, 0.3, dark, Math.sin(t * 4) * 0.1);
  g.save();
  g.translate(0, -hop);
  g.scale(breathe(t, 2.6, 0.05), breathe(t, 2.6, -0.04));
  body(g, 0.92, 0.7, col, dark);
  g.fillStyle = '#dff5c8';
  g.beginPath();
  g.ellipse(0, 0.3, 0.46, 0.3, 0, 0, TAU);
  g.fill();
  // eye bumps sit on the body, frog style
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.42, -0.56);
    g.fillStyle = col;
    circle(g, 0, 0, 0.28);
    g.fill();
    eyes(g, 0, 0.19, { blink: blinkAmount(t, seed + sd), pupil: 0.55 });
    g.restore();
  }
  g.save();
  g.translate(0, 0.14);
  if (s > 0.35) {
    openMouth(g, 0.4, 0.24, '#c9506a', '#ff9db0');
  } else {
    g.strokeStyle = dark;
    g.lineWidth = 0.06;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-0.4, 0);
    g.quadraticCurveTo(0, 0.22, 0.4, 0);
    g.stroke();
  }
  g.restore();
  cheeks(g, 0.55, 0.12, 'rgba(255,140,160,0.35)');
  g.restore();
}

function drawBunny(g, t, s, seed) {
  const bob = Math.sin(t * 2.8) * 0.03 + s * 0.1;
  const col = '#f6e7ef', dark = '#dcc6d3';
  legs(g, 0.7, 0.34, 0.28, 0.32, dark);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2.8, 0.04));
  body(g, 0.72, 0.74, col, dark);
  g.fillStyle = '#fff';
  circle(g, 0.72, 0.42, 0.18);
  g.fill();
  g.restore();

  g.save();
  g.translate(0, -0.68 - bob);
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.22, -0.42);
    g.rotate(sd * (0.16 + Math.sin(t * 2.3 + sd) * 0.07 - s * 0.1));
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(0, -0.42, 0.15, 0.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#ffc4d6';
    g.beginPath();
    g.ellipse(0, -0.42, 0.08, 0.36, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.fillStyle = col;
  circle(g, 0, 0, 0.56);
  g.fill();
  eyes(g, 0.23, 0.16, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  nose(g, 0, 0.22, 0.07, 0.06, '#ff8fa3');
  g.strokeStyle = '#a98b9a';
  g.lineWidth = 0.035;
  g.beginPath();
  g.moveTo(0, 0.26);
  g.lineTo(0, 0.34);
  g.stroke();
  g.save();
  g.translate(0, 0.36);
  for (const sd of [-1, 1]) {
    g.strokeStyle = '#a98b9a';
    g.beginPath();
    g.arc(sd * 0.09, 0, 0.09, sd > 0 ? Math.PI : 0, sd > 0 ? 0 : Math.PI, sd < 0);
    g.stroke();
  }
  g.restore();
  cheeks(g, 0.4, 0.1);
  g.restore();
}

function drawBee(g, t, s, seed) {
  const fly = Math.sin(t * 4) * 0.05;
  const col = C.yellow, dark = '#3b2f4a';
  // wings behind
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.34, -0.42);
    g.rotate(sd * (0.5 + Math.sin(t * 34) * 0.35));
    g.fillStyle = 'rgba(220,245,255,0.72)';
    g.beginPath();
    g.ellipse(0, -0.28, 0.22, 0.44, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(0, fly);
  g.scale(breathe(t, 3, 0.03), breathe(t, 3, 0.04));
  body(g, 0.84, 0.68, col, C.yellowDark);
  g.save();
  g.beginPath();
  g.ellipse(0, 0, 0.84, 0.68, 0, 0, TAU);
  g.clip();
  g.fillStyle = dark;
  for (let i = -1; i <= 2; i++) {
    g.save();
    g.translate(i * 0.42 + 0.1, 0);
    g.rotate(0.12);
    g.fillRect(-0.11, -0.8, 0.22, 1.6);
    g.restore();
  }
  g.restore();
  // stinger
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(0.82, -0.05);
  g.lineTo(1.05, 0.02);
  g.lineTo(0.82, 0.12);
  g.closePath();
  g.fill();
  g.restore();

  g.save();
  g.translate(-0.5, -0.4 + fly);
  // antennae
  g.strokeStyle = dark;
  g.lineWidth = 0.05;
  g.lineCap = 'round';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(sd * 0.1, -0.34);
    g.quadraticCurveTo(sd * 0.24, -0.62, sd * 0.06 - 0.06, -0.68);
    g.stroke();
    g.fillStyle = dark;
    circle(g, sd * 0.06 - 0.06, -0.7, 0.06);
    g.fill();
  }
  g.fillStyle = col;
  circle(g, 0, 0, 0.42);
  g.fill();
  eyes(g, 0.17, 0.13, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.save();
  g.translate(0, 0.2);
  smile(g, 0.12, 0.08, dark, 0.04);
  g.restore();
  cheeks(g, 0.3, 0.08);
  g.restore();
}

function drawPig(g, t, s, seed) {
  const bob = Math.sin(t * 2) * 0.02 + s * 0.05;
  const col = '#ffb3c9', dark = '#e58aa6';
  // curly tail
  g.save();
  g.strokeStyle = dark;
  g.lineWidth = 0.09;
  g.lineCap = 'round';
  g.beginPath();
  const w = Math.sin(t * 5) * 0.1 * (1 + s * 3);
  g.moveTo(0.76, 0.2);
  g.quadraticCurveTo(1.05, 0.1 + w, 0.94, -0.1 + w);
  g.quadraticCurveTo(0.86, -0.24, 1.0, -0.24);
  g.stroke();
  g.restore();
  legs(g, 0.66, 0.4, 0.28, 0.36, dark, Math.sin(t * 5) * s * 0.2);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2, 0.035));
  body(g, 0.88, 0.74, col, dark);
  g.restore();
  g.save();
  g.translate(0, -0.6 - bob);
  ear(g, -0.4, -0.4, 0.24, -0.42, dark, null);
  ear(g, 0.4, -0.4, 0.24, 0.42, dark, null);
  g.fillStyle = col;
  circle(g, 0, 0, 0.58);
  g.fill();
  eyes(g, 0.25, 0.14, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.fillStyle = dark;
  g.beginPath();
  g.ellipse(0, 0.3, 0.26, 0.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#c9718c';
  circle(g, -0.09, 0.3, 0.05);
  g.fill();
  circle(g, 0.09, 0.3, 0.05);
  g.fill();
  cheeks(g, 0.42, 0.1, 'rgba(230,90,130,0.3)');
  g.restore();
}

function drawSheep(g, t, s, seed) {
  const bob = Math.sin(t * 1.9) * 0.02 + s * 0.05;
  legs(g, 0.62, 0.36, 0.22, 0.4, '#4a3b52');
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 1.9, 0.03));
  // woolly body made of overlapping lobes
  g.fillStyle = '#fdfbf5';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    circle(g, Math.cos(a) * 0.6, Math.sin(a) * 0.46, 0.36 + Math.sin(t * 2 + i) * 0.015);
    g.fill();
  }
  g.fillStyle = '#fff';
  circle(g, 0, 0, 0.62);
  g.fill();
  g.restore();
  g.save();
  g.translate(-0.1, -0.6 - bob);
  roundEar(g, -0.44, 0.02, 0.15, '#4a3b52', null);
  roundEar(g, 0.44, 0.02, 0.15, '#4a3b52', null);
  g.fillStyle = '#4a3b52';
  g.beginPath();
  g.ellipse(0, 0.06, 0.4, 0.42, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#fdfbf5';
  for (let i = 0; i < 4; i++) {
    circle(g, -0.3 + i * 0.2, -0.34 + (i % 2) * 0.06, 0.19);
    g.fill();
  }
  eyes(g, 0.16, 0.11, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.save();
  g.translate(0, 0.26);
  smile(g, 0.1, 0.07, '#fdfbf5', 0.035);
  g.restore();
  g.restore();
}

function drawLion(g, t, s, seed) {
  const bob = Math.sin(t * 2) * 0.02 + s * 0.06;
  const col = '#f0b352', dark = '#cf8f34';
  g.save();
  g.strokeStyle = dark;
  g.lineWidth = 0.12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.7, 0.4);
  g.quadraticCurveTo(1.1, 0.3 + Math.sin(t * 3) * 0.2, 1.0, -0.1 + Math.sin(t * 3) * 0.25);
  g.stroke();
  g.fillStyle = '#a5651f';
  circle(g, 1.0, -0.16 + Math.sin(t * 3) * 0.25, 0.12);
  g.fill();
  g.restore();
  legs(g, 0.68, 0.4, 0.3, 0.38, dark, Math.sin(t * 5) * s * 0.2);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2, 0.03));
  body(g, 0.86, 0.74, col, dark);
  g.restore();
  g.save();
  g.translate(0, -0.62 - bob);
  // mane
  g.fillStyle = '#c9761f';
  const puff = 1 + s * 0.12;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + t * 0.15;
    circle(g, Math.cos(a) * 0.62 * puff, Math.sin(a) * 0.62 * puff, 0.28);
    g.fill();
  }
  roundEar(g, -0.44, -0.4, 0.14, col, '#ffd9a8');
  roundEar(g, 0.44, -0.4, 0.14, col, '#ffd9a8');
  g.fillStyle = col;
  circle(g, 0, 0, 0.56);
  g.fill();
  eyes(g, 0.23, 0.15, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.fillStyle = '#fff2d8';
  g.beginPath();
  g.ellipse(0, 0.3, 0.3, 0.22, 0, 0, TAU);
  g.fill();
  nose(g, 0, 0.2, 0.09, 0.07, '#8d5836');
  g.save();
  g.translate(0, 0.34);
  if (s > 0.4) openMouth(g, 0.2, 0.18);
  else smile(g, 0.14, 0.08, '#8d5836', 0.04);
  g.restore();
  g.restore();
}

function drawElephant(g, t, s, seed) {
  const bob = Math.sin(t * 1.5) * 0.02 + s * 0.05;
  const col = '#a8b6d1', dark = '#8593ad';
  legs(g, 0.66, 0.44, 0.34, 0.4, dark);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 1.5, 0.03));
  body(g, 0.94, 0.78, col, dark);
  g.restore();
  g.save();
  g.translate(-0.06, -0.6 - bob);
  // big flappy ears
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.6, -0.02);
    g.rotate(sd * (0.1 + Math.sin(t * 2.4 + sd) * 0.1 + s * 0.2));
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(0, 0, 0.36, 0.46, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#c0a3b8';
    g.beginPath();
    g.ellipse(sd * -0.04, 0.02, 0.24, 0.32, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.fillStyle = col;
  circle(g, 0, 0, 0.56);
  g.fill();
  eyes(g, 0.24, 0.13, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  // trunk, curls up when excited
  const curl = 0.3 + s * 0.9;
  g.strokeStyle = col;
  g.lineWidth = 0.24;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0.24);
  g.quadraticCurveTo(0.06, 0.62, 0.2 + curl * 0.18, 0.7 - curl * 0.18);
  g.stroke();
  g.strokeStyle = dark;
  g.lineWidth = 0.05;
  for (let i = 1; i <= 3; i++) {
    g.beginPath();
    g.moveTo(-0.09, 0.3 + i * 0.1);
    g.lineTo(0.09, 0.28 + i * 0.1);
    g.stroke();
  }
  g.restore();
}

function drawPenguin(g, t, s, seed) {
  const bob = Math.sin(t * 2.4) * 0.025 + s * 0.06;
  const col = '#3b3f52', dark = '#2a2d3c';
  g.fillStyle = C.orange;
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.3, 0.86);
    g.beginPath();
    g.ellipse(0, 0, 0.24, 0.1, sd * 0.2, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2.4, 0.03));
  body(g, 0.72, 0.86, col, dark);
  g.fillStyle = '#fdfbf5';
  g.beginPath();
  g.ellipse(0, 0.14, 0.5, 0.68, 0, 0, TAU);
  g.fill();
  // flippers
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.68, 0);
    g.rotate(sd * (0.2 + Math.sin(t * (3 + s * 14)) * (0.15 + s * 0.5)));
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(0, 0.16, 0.15, 0.42, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.restore();
  g.save();
  g.translate(0, -0.62 - bob);
  g.fillStyle = col;
  circle(g, 0, 0, 0.5);
  g.fill();
  g.fillStyle = '#fdfbf5';
  g.beginPath();
  g.ellipse(0, 0.16, 0.32, 0.28, 0, 0, TAU);
  g.fill();
  eyes(g, 0.19, 0.13, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.fillStyle = C.orange;
  g.beginPath();
  g.moveTo(-0.13, 0.2);
  g.lineTo(0.13, 0.2);
  g.lineTo(0, 0.36 + s * 0.05);
  g.closePath();
  g.fill();
  g.restore();
}

function drawMonkey(g, t, s, seed) {
  const bob = Math.sin(t * 2.6) * 0.03 + s * 0.08;
  const col = '#b07a4f', dark = '#8d5c37';
  g.save();
  g.strokeStyle = dark;
  g.lineWidth = 0.11;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.66, 0.34);
  const w = Math.sin(t * 3.4) * 0.3;
  g.quadraticCurveTo(1.16, 0.3 + w, 0.98, -0.24 + w * 0.6);
  g.stroke();
  g.restore();
  legs(g, 0.66, 0.34, 0.24, 0.34, dark, Math.sin(t * 6) * s * 0.3);
  g.save();
  g.translate(0, -bob);
  g.scale(1, breathe(t, 2.6, 0.04));
  body(g, 0.74, 0.72, col, dark);
  g.fillStyle = '#f2d6b8';
  g.beginPath();
  g.ellipse(0, 0.2, 0.42, 0.44, 0, 0, TAU);
  g.fill();
  g.restore();
  g.save();
  g.translate(0, -0.66 - bob);
  roundEar(g, -0.56, 0.02, 0.2, col, '#f2d6b8');
  roundEar(g, 0.56, 0.02, 0.2, col, '#f2d6b8');
  g.fillStyle = col;
  circle(g, 0, 0, 0.56);
  g.fill();
  g.fillStyle = '#f7e2c8';
  g.beginPath();
  g.ellipse(0, 0.12, 0.42, 0.36, 0, 0, TAU);
  g.fill();
  eyes(g, 0.2, 0.15, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  nose(g, -0.06, 0.22, 0.04, 0.03, '#8d5c37');
  nose(g, 0.06, 0.22, 0.04, 0.03, '#8d5c37');
  g.save();
  g.translate(0, 0.32);
  if (s > 0.4) openMouth(g, 0.19, 0.14, '#b8506a', '#ff9db0');
  else smile(g, 0.16, 0.1, '#8d5c37', 0.04);
  g.restore();
  g.restore();
}

// Sea creatures -------------------------------------------------------------

function drawFish(g, t, s, seed, color = C.orange) {
  const dark = darken(color, 0.22);
  const wig = Math.sin(t * (5 + s * 8) + seed);
  g.save();
  // tail
  g.save();
  g.translate(-0.72, 0);
  g.rotate(wig * 0.4);
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(-0.46, -0.42, -0.5, 0);
  g.quadraticCurveTo(-0.46, 0.42, 0, 0);
  g.closePath();
  g.fill();
  g.restore();
  // fins
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-0.1, -0.42);
  g.quadraticCurveTo(0.02, -0.86 - Math.abs(wig) * 0.06, 0.24, -0.36);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(-0.1, 0.42);
  g.quadraticCurveTo(0.02, 0.8, 0.24, 0.36);
  g.closePath();
  g.fill();
  g.save();
  g.scale(1 + wig * 0.02, 1 - wig * 0.02);
  body(g, 0.76, 0.54, color, dark);
  // A pale belly and a few dots instead of scale arcs: arcs across the middle
  // of the body read as a row of teeth next to the eye.
  g.save();
  g.beginPath();
  g.ellipse(0, 0, 0.76, 0.54, 0, 0, TAU);
  g.clip();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath();
  g.ellipse(0.05, 0.28, 0.6, 0.24, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.32)';
  [[-0.4, -0.16], [-0.16, 0.04], [-0.44, 0.2]].forEach(([dx, dy]) => {
    circle(g, dx, dy, 0.075);
    g.fill();
  });
  g.restore();
  g.restore();
  eyes(g, 0, 0.14, { blink: blinkAmount(t, seed), lookX: 0.3 });
  g.save();
  g.translate(0.48, 0.16);
  g.strokeStyle = dark;
  g.lineWidth = 0.05;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, 0.1, -0.4, 1.6);
  g.stroke();
  g.restore();
  g.restore();
}

function drawOctopus(g, t, s, seed) {
  const col = C.purple, dark = C.purpleDark;
  g.save();
  // eight curling arms
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.9;
    const wob = Math.sin(t * 3 + i * 0.9) * (0.2 + s * 0.35);
    g.strokeStyle = i % 2 ? dark : col;
    g.lineWidth = 0.17;
    g.lineCap = 'round';
    g.beginPath();
    const x0 = Math.cos(a) * 0.5;
    g.moveTo(x0, 0.3);
    g.quadraticCurveTo(x0 * 1.5, 0.75 + wob * 0.3, x0 * 1.7 + wob * 0.25, 1.02);
    g.stroke();
  }
  g.save();
  g.scale(breathe(t, 2.2, 0.04), breathe(t, 2.2, -0.03));
  g.fillStyle = radial(g, -0.2, -0.3, 1.4, [lighten(col, 0.3), col, dark]);
  g.beginPath();
  g.moveTo(-0.8, 0.34);
  g.quadraticCurveTo(-0.86, -0.9, 0, -0.9);
  g.quadraticCurveTo(0.86, -0.9, 0.8, 0.34);
  g.quadraticCurveTo(0, 0.6, -0.8, 0.34);
  g.closePath();
  g.fill();
  g.restore();
  g.save();
  g.translate(0, -0.28);
  eyes(g, 0.28, 0.19, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.save();
  g.translate(0, 0.32);
  smile(g, 0.14, 0.1, '#5a3a72', 0.045);
  g.restore();
  cheeks(g, 0.48, 0.12, 'rgba(255,140,190,0.35)');
  g.restore();
  g.restore();
}

function drawTurtle(g, t, s, seed) {
  const shell = '#5fae5a', shellDark = '#3f8a3d', skin = '#9dd67a';
  g.save();
  legs(g, 0.4, 0.62, 0.24, 0.26, skin, Math.sin(t * 3) * 0.15);
  // head
  g.save();
  g.translate(-0.82, 0.06 + Math.sin(t * 2) * 0.03);
  g.fillStyle = skin;
  circle(g, 0, 0, 0.3);
  g.fill();
  eyes(g, 0.12, 0.1, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0, lookX: -0.3 });
  g.save();
  g.translate(-0.06, 0.16);
  smile(g, 0.09, 0.06, '#3f8a3d', 0.035);
  g.restore();
  g.restore();
  // tail
  g.fillStyle = skin;
  g.beginPath();
  g.moveTo(0.78, 0.16);
  g.lineTo(1.0, 0.24);
  g.lineTo(0.78, 0.32);
  g.closePath();
  g.fill();
  g.save();
  g.scale(1, breathe(t, 1.8, 0.03));
  g.fillStyle = radial(g, -0.2, -0.4, 1.3, [lighten(shell, 0.28), shell, shellDark]);
  g.beginPath();
  g.ellipse(0, 0, 0.86, 0.6, 0, Math.PI, TAU);
  g.quadraticCurveTo(0, 0.3, -0.86, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = shellDark;
  g.lineWidth = 0.055;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(i * 0.3, -0.02);
    g.lineTo(i * 0.16, -0.56);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, 0, 0.44, 0.3, 0, Math.PI, TAU);
  g.stroke();
  g.restore();
  g.restore();
}

function drawCrab(g, t, s, seed) {
  const col = '#ff6b5d', dark = '#d94436';
  g.save();
  // legs
  g.strokeStyle = dark;
  g.lineWidth = 0.1;
  g.lineCap = 'round';
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = Math.sin(t * 6 + i * 1.2 + (sd > 0 ? 0 : 1.6)) * (0.06 + s * 0.1);
      g.beginPath();
      g.moveTo(sd * 0.5, 0.2 + i * 0.14);
      g.quadraticCurveTo(sd * 0.85, 0.4 + i * 0.16 + w, sd * (0.78 + i * 0.1), 0.76 + w);
      g.stroke();
    }
  }
  // claws
  for (const sd of [-1, 1]) {
    g.save();
    const open = 0.2 + s * 0.5 + Math.sin(t * 4 + sd) * 0.1;
    g.translate(sd * 0.95, -0.28);
    g.rotate(sd * 0.3);
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(0, 0.12, 0.16, 0.3, 0, 0, TAU);
    g.fill();
    g.fillStyle = dark;
    g.save();
    g.rotate(-open);
    g.beginPath();
    g.ellipse(0, -0.22, 0.14, 0.2, 0, 0, TAU);
    g.fill();
    g.restore();
    g.save();
    g.rotate(open * 0.6);
    g.beginPath();
    g.ellipse(0, -0.16, 0.12, 0.16, 0, 0, TAU);
    g.fill();
    g.restore();
    g.restore();
  }
  g.save();
  g.scale(breathe(t, 3, 0.03), 1);
  g.fillStyle = radial(g, -0.2, -0.3, 1.2, [lighten(col, 0.3), col, dark]);
  g.beginPath();
  g.ellipse(0, 0, 0.72, 0.5, 0, 0, TAU);
  g.fill();
  g.restore();
  // eye stalks
  for (const sd of [-1, 1]) {
    g.strokeStyle = col;
    g.lineWidth = 0.07;
    g.beginPath();
    g.moveTo(sd * 0.22, -0.3);
    g.lineTo(sd * 0.26, -0.62);
    g.stroke();
    g.save();
    g.translate(sd * 0.26, -0.68);
    eyes(g, 0, 0.14, { blink: blinkAmount(t, seed + sd), pupil: 0.5 });
    g.restore();
  }
  g.save();
  g.translate(0, 0.14);
  smile(g, 0.18, 0.1, '#8d2a20', 0.05);
  g.restore();
  g.restore();
}

function drawWhale(g, t, s, seed) {
  const col = '#5b9ddb', dark = '#3f79b5';
  g.save();
  const wig = Math.sin(t * 2.4 + seed);
  g.save();
  g.translate(0.8, 0);
  g.rotate(wig * 0.22);
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(0.34, -0.14, 0.56, -0.5);
  g.quadraticCurveTo(0.22, -0.24, 0.1, -0.06);
  g.quadraticCurveTo(0.24, 0.2, 0.5, 0.44);
  g.quadraticCurveTo(0.2, 0.2, 0, 0.06);
  g.closePath();
  g.fill();
  g.restore();
  g.save();
  g.scale(1, breathe(t, 1.8, 0.03));
  g.fillStyle = radial(g, -0.3, -0.4, 1.5, [lighten(col, 0.3), col, dark]);
  g.beginPath();
  g.moveTo(-0.9, 0.06);
  g.quadraticCurveTo(-0.86, -0.62, -0.1, -0.6);
  g.quadraticCurveTo(0.74, -0.58, 0.82, 0.02);
  g.quadraticCurveTo(0.6, 0.56, -0.2, 0.56);
  g.quadraticCurveTo(-0.86, 0.54, -0.9, 0.06);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(-0.3, 0.3, 0.5, 0.22, 0.06, 0, TAU);
  g.fill();
  // spout, so a whale still reads as a whale in silhouette
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 0.07;
  g.lineCap = 'round';
  for (const sd of [-1, 0, 1]) {
    g.beginPath();
    g.moveTo(-0.2, -0.56);
    g.quadraticCurveTo(-0.2 + sd * 0.16, -0.8, -0.2 + sd * 0.3, -0.98);
    g.stroke();
  }
  g.restore();
  g.save();
  g.translate(-0.42, -0.14);
  eyes(g, 0.22, 0.14, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0, lookX: -0.2 });
  g.save();
  g.translate(-0.1, 0.3);
  smile(g, 0.14, 0.09, dark, 0.045);
  g.restore();
  g.restore();
  g.restore();
}

function drawJelly(g, t, s, seed) {
  const col = '#ff9ad5';
  g.save();
  const pulse = 1 + Math.sin(t * 2.6 + seed) * 0.07 + s * 0.06;
  for (let i = 0; i < 6; i++) {
    const x = -0.5 + (i / 5) * 1.0;
    const w = Math.sin(t * 3 + i * 0.7) * 0.14;
    g.strokeStyle = 'rgba(255,154,213,0.8)';
    g.lineWidth = 0.08;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, 0.2);
    g.quadraticCurveTo(x + w, 0.6, x - w, 1.0);
    g.stroke();
  }
  g.save();
  g.scale(pulse, 1 / pulse);
  g.fillStyle = radial(g, -0.2, -0.4, 1.2, ['rgba(255,240,250,0.95)', col, '#e56fb4']);
  g.beginPath();
  g.moveTo(-0.72, 0.2);
  g.quadraticCurveTo(-0.76, -0.72, 0, -0.72);
  g.quadraticCurveTo(0.76, -0.72, 0.72, 0.2);
  g.quadraticCurveTo(0.36, 0.34, 0, 0.2);
  g.quadraticCurveTo(-0.36, 0.34, -0.72, 0.2);
  g.closePath();
  g.fill();
  g.restore();
  g.save();
  g.translate(0, -0.2);
  eyes(g, 0.22, 0.14, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.save();
  g.translate(0, 0.28);
  smile(g, 0.12, 0.08, '#c04f8f', 0.04);
  g.restore();
  g.restore();
  g.restore();
}

function drawSeahorse(g, t, s, seed) {
  const col = C.yellow, dark = C.orangeDark;
  g.save();
  g.rotate(Math.sin(t * 2 + seed) * 0.06);
  g.fillStyle = radial(g, -0.2, -0.4, 1.3, [lighten(col, 0.3), col, dark]);
  g.beginPath();
  g.moveTo(-0.1, -0.8);
  g.quadraticCurveTo(0.42, -0.66, 0.32, -0.1);
  g.quadraticCurveTo(0.22, 0.44, 0.44, 0.7);
  g.quadraticCurveTo(0.1, 0.94, -0.12, 0.6);
  g.quadraticCurveTo(-0.3, 0.1, -0.34, -0.3);
  g.quadraticCurveTo(-0.4, -0.76, -0.1, -0.8);
  g.closePath();
  g.fill();
  // snout + crest
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-0.3, -0.62);
  g.quadraticCurveTo(-0.68, -0.56, -0.62, -0.4);
  g.quadraticCurveTo(-0.4, -0.36, -0.28, -0.44);
  g.closePath();
  g.fill();
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(0.02 + i * 0.06, -0.82 + i * 0.16);
    g.lineTo(0.3 + i * 0.05, -0.92 + i * 0.18);
    g.lineTo(0.16 + i * 0.06, -0.7 + i * 0.16);
    g.closePath();
    g.fill();
  }
  g.save();
  g.translate(-0.12, -0.56);
  eyes(g, 0, 0.12, { blink: blinkAmount(t, seed), lookX: -0.3 });
  g.restore();
  g.restore();
}

function drawStarfish(g, t, s, seed) {
  const col = '#ff8fb0', dark = '#e05c88';
  g.save();
  g.rotate(Math.sin(t * 1.4 + seed) * 0.1 + s * 0.3);
  g.fillStyle = radial(g, -0.2, -0.3, 1.2, [lighten(col, 0.3), col, dark]);
  star(g, 5, 0.95 + s * 0.06, 0.42);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    circle(g, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.07);
    g.fill();
  }
  eyes(g, 0.2, 0.14, { blink: blinkAmount(t, seed), happy: s > 0.6 ? 1 : 0 });
  g.save();
  g.translate(0, 0.26);
  smile(g, 0.12, 0.08, dark, 0.04);
  g.restore();
  g.restore();
}

// Registry ------------------------------------------------------------------
//
// `voice` describes how the animal sounds. There are no animal recordings in
// the asset pack, so each one is a bent instrument sample: contour is what a
// toddler recognises, and this way every call stays in key with the music.

export const LAND = [
  {
    id: 'cat', name: 'חתול', says: 'מיאו', color: '#ffb04d', draw: drawCat,
    voice: { inst: 'flute', note: 'A5', dur: 0.5, vol: 0.6, bend: [[0, 0.86], [0.12, 1.1], [0.45, 0.72]] },
  },
  {
    id: 'dog', name: 'כלב', says: 'האו האו', color: '#c08552', draw: drawDog,
    voice: { inst: 'piano', note: 'C3', dur: 0.3, vol: 0.75, parts: [
      { at: 0, note: 'C3', dur: 0.22, bend: [[0, 1.2], [0.16, 0.85]] },
      { at: 0.24, note: 'C3', dur: 0.26, bend: [[0, 1.1], [0.2, 0.8]] },
    ] },
  },
  {
    id: 'cow', name: 'פרה', says: 'מוווו', color: '#fdfdfd', draw: drawCow,
    voice: { inst: 'piano', note: 'C3', dur: 1.1, vol: 0.7, bend: [[0, 0.55], [0.25, 0.62], [1.0, 0.42]] },
  },
  {
    id: 'duck', name: 'ברווז', says: 'גע גע', color: C.yellow, draw: drawDuck,
    voice: { inst: 'flute', note: 'D6', dur: 0.18, vol: 0.5, parts: [
      { at: 0, dur: 0.14, bend: [[0, 1.1], [0.1, 0.8]] },
      { at: 0.17, dur: 0.16, bend: [[0, 1.05], [0.12, 0.78]] },
    ] },
  },
  {
    id: 'frog', name: 'צפרדע', says: 'קווה קווה', color: '#6fcf5f', draw: drawFrog,
    voice: { inst: 'piano', note: 'E3', dur: 0.16, vol: 0.6, parts: [
      { at: 0, dur: 0.12, bend: [[0, 0.8], [0.09, 1.15]] },
      { at: 0.2, dur: 0.14, bend: [[0, 0.8], [0.1, 1.2]] },
    ] },
  },
  {
    id: 'bunny', name: 'ארנב', says: 'קפיצה!', color: '#f6e7ef', draw: drawBunny,
    voice: { inst: 'xylophone', note: 'C6', dur: 0.4, vol: 0.6, parts: [
      { at: 0, note: 'G5' }, { at: 0.09, note: 'C6' }, { at: 0.18, note: 'E6' },
    ] },
  },
  {
    id: 'bee', name: 'דבורה', says: 'זזזז', color: C.yellow, draw: drawBee,
    voice: { inst: 'flute', note: 'A4', dur: 0.9, vol: 0.4, bend: [[0, 1.0], [0.2, 1.05], [0.4, 0.98], [0.6, 1.06], [0.9, 1.0]] },
  },
  {
    id: 'pig', name: 'חזיר', says: 'נחר נחר', color: '#ffb3c9', draw: drawPig,
    voice: { inst: 'piano', note: 'D3', dur: 0.2, vol: 0.6, parts: [
      { at: 0, dur: 0.14, bend: [[0, 0.7], [0.12, 1.0]] },
      { at: 0.18, dur: 0.16, bend: [[0, 0.72], [0.13, 1.05]] },
      { at: 0.38, dur: 0.18, bend: [[0, 0.68], [0.14, 0.95]] },
    ] },
  },
  {
    id: 'sheep', name: 'כבשה', says: 'בעעע', color: '#fdfbf5', draw: drawSheep,
    voice: { inst: 'flute', note: 'F4', dur: 0.8, vol: 0.55, bend: [[0, 1.0], [0.12, 1.04], [0.26, 0.96], [0.4, 1.03], [0.55, 0.95], [0.8, 0.88]] },
  },
  {
    id: 'lion', name: 'אריה', says: 'רררר', color: '#f0b352', draw: drawLion,
    voice: { inst: 'piano', note: 'C3', dur: 1.2, vol: 0.8, bend: [[0, 0.5], [0.3, 0.58], [1.1, 0.36]] },
  },
  {
    id: 'elephant', name: 'פיל', says: 'פררר', color: '#a8b6d1', draw: drawElephant,
    voice: { inst: 'flute', note: 'C4', dur: 1.0, vol: 0.7, bend: [[0, 0.6], [0.2, 1.5], [0.6, 1.45], [1.0, 1.2]] },
  },
  {
    id: 'penguin', name: 'פינגווין', says: 'קוואק', color: '#3b3f52', draw: drawPenguin,
    voice: { inst: 'flute', note: 'E6', dur: 0.3, vol: 0.5, bend: [[0, 0.9], [0.08, 1.2], [0.3, 0.95]] },
  },
  {
    id: 'monkey', name: 'קוף', says: 'או או!', color: '#b07a4f', draw: drawMonkey,
    voice: { inst: 'flute', note: 'C6', dur: 0.2, vol: 0.5, parts: [
      { at: 0, dur: 0.14, bend: [[0, 0.85], [0.1, 1.3]] },
      { at: 0.16, dur: 0.14, bend: [[0, 0.9], [0.1, 1.4]] },
      { at: 0.34, dur: 0.2, bend: [[0, 1.0], [0.16, 1.5]] },
    ] },
  },
];

export const SEA = [
  {
    id: 'fish-orange', size: 0.95, name: 'דג', color: C.orange,
    draw: (g, t, s, seed) => drawFish(g, t, s, seed, C.orange),
    voice: { inst: 'xylophone', note: 'C6', dur: 0.3, vol: 0.5 },
  },
  {
    id: 'fish-pink', size: 0.9, name: 'דג', color: C.magenta,
    draw: (g, t, s, seed) => drawFish(g, t, s, seed, C.magenta),
    voice: { inst: 'xylophone', note: 'E6', dur: 0.3, vol: 0.5 },
  },
  {
    id: 'fish-lime', size: 1.0, name: 'דג', color: C.lime,
    draw: (g, t, s, seed) => drawFish(g, t, s, seed, C.lime),
    voice: { inst: 'xylophone', note: 'G6', dur: 0.3, vol: 0.5 },
  },
  {
    id: 'octopus', size: 1.25, name: 'תמנון', color: C.purple, draw: drawOctopus,
    voice: { inst: 'harp', note: 'C4', dur: 0.9, vol: 0.6, bend: [[0, 0.7], [0.4, 1.1]] },
  },
  {
    id: 'turtle', size: 1.15, name: 'צב', color: '#5fae5a', draw: drawTurtle,
    voice: { inst: 'piano', note: 'G3', dur: 0.7, vol: 0.55, bend: [[0, 0.8], [0.5, 1.0]] },
  },
  {
    id: 'crab', size: 1.05, name: 'סרטן', color: '#ff6b5d', draw: drawCrab,
    voice: { inst: 'xylophone', note: 'C7', dur: 0.2, vol: 0.45, parts: [{ at: 0 }, { at: 0.08 }, { at: 0.16 }] },
  },
  {
    id: 'whale', size: 2.0, name: 'לווייתן', color: '#5b9ddb', draw: drawWhale,
    voice: { inst: 'flute', note: 'C4', dur: 1.6, vol: 0.7, bend: [[0, 0.5], [0.5, 0.75], [1.6, 0.55]] },
  },
  {
    id: 'jelly', size: 1.1, name: 'מדוזה', color: '#ff9ad5', draw: drawJelly,
    voice: { inst: 'harp', note: 'A5', dur: 0.8, vol: 0.5, bend: [[0, 1.0], [0.8, 1.3]] },
  },
  {
    id: 'seahorse', size: 1.0, name: 'סוסון ים', color: C.yellow, draw: drawSeahorse,
    voice: { inst: 'harp', note: 'E5', dur: 0.6, vol: 0.5, bend: [[0, 0.9], [0.5, 1.25]] },
  },
  {
    id: 'starfish', size: 0.95, name: 'כוכב ים', color: '#ff8fb0', draw: drawStarfish,
    voice: { inst: 'xylophone', note: 'A6', dur: 0.4, vol: 0.5, parts: [{ at: 0, note: 'C6' }, { at: 0.08, note: 'E6' }, { at: 0.16, note: 'A6' }] },
  },
];

export const ALL = [...LAND, ...SEA];
export const byId = (id) => ALL.find((a) => a.id === id);

// How far below the origin Emi's shoes reach, so scenes can stand her exactly
// on a ground line: y = groundY - scale * EMI_FEET.
export const EMI_FEET = 1.06;

// The player character: a small round girl with a big hair bow. She is on the
// map, waves at the camera, and pops up to applaud after a reward.
export function drawEmi(g, t, s = 0, { blink = -1, wave = 0 } = {}) {
  const skin = '#f7d3b5', hair = '#4a3226', dress = C.magenta;
  const bob = Math.sin(t * 2.2) * 0.03 + s * 0.06;
  g.save();
  legs(g, 0.62, 0.24, 0.2, 0.34, skin);
  g.fillStyle = '#fff';
  for (const sd of [-1, 1]) {
    g.save();
    g.translate(sd * 0.24, 0.98);
    roundRect(g, -0.15, -0.07, 0.3, 0.15, 0.07);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(0, -bob);
  // dress
  g.fillStyle = radial(g, -0.2, -0.3, 1.2, [lighten(dress, 0.3), dress, C.magentaDark]);
  g.beginPath();
  g.moveTo(-0.32, -0.42);
  g.quadraticCurveTo(-0.74, 0.5, -0.62, 0.66);
  g.quadraticCurveTo(0, 0.82, 0.62, 0.66);
  g.quadraticCurveTo(0.74, 0.5, 0.32, -0.42);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(0, 0.2, 0.3, 0.12, 0, 0, TAU);
  g.fill();
  // Arms. The right one waves when she is excited; otherwise both hang with a
  // gentle sway. Drawn as a stroke plus a hand dot so they read at thumbnail
  // size on the map.
  // Arms swing clear of the dress so they read against the background rather
  // than disappearing into a skin-on-pink silhouette.
  const wv = wave > 0 ? Math.sin(t * 11) * wave : 0;
  const idleSwing = Math.sin(t * 1.8) * 0.06;
  g.strokeStyle = skin;
  g.lineWidth = 0.18;
  g.lineCap = 'round';
  // left arm, out and down
  g.beginPath();
  g.moveTo(-0.26, -0.34);
  g.quadraticCurveTo(-0.66, -0.2 + idleSwing, -0.8, 0.1 + idleSwing * 1.4);
  g.stroke();
  g.fillStyle = skin;
  circle(g, -0.8, 0.12 + idleSwing * 1.4, 0.105);
  g.fill();
  // right arm: raised and waving when excited, otherwise mirrored
  const upX = wave > 0 ? 0.78 + wv * 0.12 : 0.8;
  const upY = wave > 0 ? -0.72 - wv * 0.14 : 0.1 - idleSwing * 1.4;
  g.beginPath();
  g.moveTo(0.26, -0.34);
  g.quadraticCurveTo(wave > 0 ? 0.72 : 0.66, wave > 0 ? -0.44 : -0.2 - idleSwing, upX, upY);
  g.stroke();
  circle(g, upX, upY, 0.105);
  g.fill();
  g.restore();

  g.save();
  g.translate(0, -0.86 - bob);
  // hair behind
  g.fillStyle = hair;
  circle(g, 0, 0.06, 0.56);
  g.fill();
  g.beginPath();
  g.ellipse(-0.48, 0.36, 0.2, 0.34, 0.2, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(0.48, 0.36, 0.2, 0.34, -0.2, 0, TAU);
  g.fill();
  // face
  g.fillStyle = radial(g, -0.15, -0.2, 0.9, [lighten(skin, 0.2), skin, '#e2b393']);
  circle(g, 0, 0.06, 0.5);
  g.fill();
  // fringe
  g.fillStyle = hair;
  g.beginPath();
  g.moveTo(-0.5, 0.02);
  g.quadraticCurveTo(-0.44, -0.5, 0.06, -0.46);
  g.quadraticCurveTo(0.5, -0.44, 0.5, 0.0);
  g.quadraticCurveTo(0.22, -0.2, -0.02, -0.06);
  g.quadraticCurveTo(-0.24, 0.04, -0.5, 0.02);
  g.closePath();
  g.fill();
  // bow
  g.save();
  g.translate(0.42, -0.34);
  g.rotate(-0.3 + Math.sin(t * 3) * 0.05);
  g.fillStyle = C.red;
  g.beginPath();
  g.ellipse(-0.16, 0, 0.17, 0.12, -0.3, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(0.16, 0, 0.17, 0.12, 0.3, 0, TAU);
  g.fill();
  g.fillStyle = C.redDark;
  circle(g, 0, 0, 0.07);
  g.fill();
  g.restore();
  g.save();
  g.translate(0, 0.12);
  eyes(g, 0.2, 0.14, {
    blink: blink >= 0 ? blink : blinkAmount(t, 3),
    happy: s > 0.5 ? 1 : 0,
  });
  g.save();
  g.translate(0, 0.26);
  if (s > 0.5) openMouth(g, 0.13, 0.11, '#c9506a', '#ff9db0');
  else smile(g, 0.13, 0.09, '#8a5a4a', 0.04);
  g.restore();
  cheeks(g, 0.34, 0.1);
  g.restore();
  g.restore();
  g.restore();
}
