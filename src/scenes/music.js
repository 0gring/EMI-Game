// Xylophone.
//
// Eight bars, real sampled instruments, and four voices to switch between. Two
// modes share the same keyboard:
//
//   free play - every bar always sounds, tuned to a major scale so nothing she
//   does is wrong;
//   follow the lights - a bar glows and waits. Any bar still plays its note, but
//   the song only advances on the right one, so there is no way to fail, only a
//   way to be helped along.

import { TAU, Spring, clamp } from '../core/util.js';
import { C, SKIES } from '../core/palette.js';
import {
  circle, roundRect, label, radial, lighten, darken, linearGradient,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { drawEmi } from '../core/creatures.js';

const SCALE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const BAR_COLORS = [C.red, C.orange, C.yellow, C.lime, C.teal, C.sky, C.indigo, C.magenta];

const VOICES = [
  { id: 'xylophone', label: 'קסילופון', color: C.orange, oct: 12 },
  { id: 'piano', label: 'פסנתר', color: C.indigo, oct: 0 },
  { id: 'harp', label: 'נבל', color: C.teal, oct: 0 },
  { id: 'flute', label: 'חלילית', color: C.magenta, oct: 0 },
];

// Scale degrees; -1 is a rest. Kept short so a two year old reaches the end.
const SONGS = [
  { name: 'כוכב קטן', notes: [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 1, 1, 0] },
  { name: 'לכבשה יש', notes: [2, 1, 0, 1, 2, 2, 2, -1, 1, 1, 1, -1, 2, 4, 4] },
  { name: 'יום הולדת', notes: [0, 0, 1, 0, 3, 2, -1, 0, 0, 1, 0, 4, 3] },
  { name: 'לדוד משה', notes: [4, 4, 4, 1, 2, 2, 1, -1, 6, 6, 5, 5, 4] },
];

class Bar {
  constructor(i) {
    this.i = i;
    this.press = new Spring(0, 420, 17);
    this.glow = 0;
    this.hitT = 0;
  }
}

// Music levels are the songs themselves. Level one is free play - bash the bars
// until the shape of the thing is clear - and finishing it turns on follow-the-
// lights with the first tune. Each level after that is the next, slightly longer
// tune. A wrong bar never fails anything at any level; it just plays its note.
const TUNING = [
  { song: -1, hint: 1.4 },    // free play, no song
  { song: 0, hint: 1.4 },
  { song: 1, hint: 1.2 },
  { song: 2, hint: 1.0 },
];

export class MusicScene extends SceneBase {
  constructor(game) {
    super(game, {
      sky: SKIES.music, music: null, id: 'music', hue: C.indigo,
      // Level one counts taps; the rest count finished songs.
      goals: [14, 1, 1, 2],
    });
    this.tune = TUNING[0];
    this.bars = SCALE.map((_, i) => new Bar(i));
    this.voice = 0;
    this.mode = 'free';
    this.song = 0;
    this.step = 0;
    this.notes = [];       // floating note visuals
    this.songT = 0;
    this.emiDance = 0;
    this.voicePress = VOICES.map(() => new Spring(0, 300, 16));
    this.songPress = new Spring(0, 300, 16);
    this.celebrate = 0;
    this.lastPlay = 0;
  }

  enter(e) {
    // The instrument is the soundtrack here, so the background music steps out
    // of the way entirely.
    this.game.music.stop();
    this.audio.play('open', { vol: 0.5 });
    this.audio.arp('xylophone', ['C4', 'E4', 'G4', 'C5'], { step: 0.07, vol: 0.5 });
    this.applyLevel();
  }

  // Levels two and up open on their song already lit, so the new thing is
  // visible the moment the level starts.
  applyLevel() {
    this.tune = this.levels.pick(TUNING);
    if (this.tune.song < 0) {
      this.mode = 'free';
    } else {
      this.mode = 'song';
      this.song = this.tune.song % SONGS.length;
      this.step = 0;
    }
  }

  onLevelUp(level, e) {
    this.applyLevel();
  }

  exit() {
    super.exit();
    this.game.music.play('hub');
  }

  layout(e) {
    super.layout(e);
    const pad = e.min * 0.03;
    const hudR = this.hud.r;
    // The toolbar has to clear the home button on one side and the speaker plus
    // star counter on the other, so its height follows the chrome.
    this.topH = Math.max(e.min * 0.15, hudR * 2.6);
    this.vertical = e.portrait;
    const top = this.topH + pad;
    // The frame's inner box: bars must end inside it, not run off the screen.
    this.frame = {
      x: this.vertical ? e.w * 0.02 : e.min * 0.02,
      y: top - pad * 0.5,
      w: this.vertical ? e.w * 0.96 : e.w - e.min * 0.04,
      h: e.h - top - e.min * 0.05,
    };
    const inner = this.frame.h - pad;

    if (this.vertical) {
      const h = inner / SCALE.length;
      this.bars.forEach((b, i) => {
        const w = this.frame.w * (0.95 - i * 0.02);
        b.x = this.frame.x + (this.frame.w - w) / 2;
        b.y = this.frame.y + pad * 0.5 + i * h + h * 0.08;
        b.w = w;
        b.h = h * 0.84;
      });
    } else {
      const w = this.frame.w / SCALE.length;
      this.bars.forEach((b, i) => {
        // RTL: the low note sits on the right, and bars shorten as they climb.
        b.h = inner * (1 - i * 0.055);
        b.x = this.frame.x + this.frame.w - (i + 1) * w + w * 0.08;
        b.y = this.frame.y + (this.frame.h - b.h) / 2;
        b.w = w * 0.84;
      });
    }

    // Instrument buttons run leftward from just inside the star counter.
    const btnR = Math.min(e.min * 0.045, this.topH * 0.32);
    const rightEdge = this.hud.starX - this.hud.starW / 2 - e.min * 0.02;
    this.voiceBtns = VOICES.map((v, i) => ({
      x: rightEdge - btnR - i * btnR * 2.5,
      y: this.topH * 0.48,
      r: btnR,
      v,
      i,
    }));
    // Song button sits just right of the home button.
    this.songBtn = { x: this.hud.homeX + hudR + btnR * 1.12 + e.min * 0.035, y: this.topH * 0.48, r: btnR * 1.12 };
    this.emiS = Math.min(e.min * 0.05, this.topH * 0.36);
    // She only appears if the toolbar has a real gap for her. On a narrow
    // screen the buttons win, and she is simply not drawn.
    const gapFrom = this.songBtn.x + this.songBtn.r;
    const gapTo = this.voiceBtns[VOICES.length - 1].x - btnR;
    this.emiX = gapTo - gapFrom > this.emiS * 2.6 ? (gapFrom + gapTo) / 2 : null;
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    for (const b of this.voiceBtns) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3) {
        this.voice = b.i;
        this.voicePress[b.i].set(1);
        this.voicePress[b.i].to(0);
        this.audio.play('toggle-on', { vol: 0.5 });
        this.audio.loadInstrument(b.v.id);
        this.audio.note(b.v.id, 'C5', { vol: 0.6 });
        p.data = 'ui';
        return;
      }
    }
    if (Math.hypot(p.x - this.songBtn.x, p.y - this.songBtn.y) < this.songBtn.r * 1.35) {
      this.songPress.set(1);
      this.songPress.to(0);
      if (this.mode === 'free') {
        // Free play is level one's whole job; the button previews a song but
        // the level still advances on taps.
        this.mode = 'song';
        this.song = 0;
        this.step = 0;
      } else {
        this.song = (this.song + 1) % SONGS.length;
        this.step = 0;
        if (this.tune.song < 0 && this.song === 0) this.mode = 'free';
      }
      this.audio.play(this.mode === 'song' ? 'start' : 'toggle-off', { vol: 0.6 });
      p.data = 'ui';
      return;
    }
    const b = this.barAt(p.x, p.y);
    if (b) {
      p.data = b;
      this.strike(b, e);
    }
  }

  onMove(p, e) {
    // Dragging across the bars glissandos, which is how most toddlers actually
    // play a xylophone.
    if (p.data === 'ui' || p.data === 'hud') return;
    const b = this.barAt(p.x, p.y);
    if (b && b !== p.data) {
      p.data = b;
      this.strike(b, e, 0.8);
    }
  }

  onUp(p) {
    this.hud.onUp(p);
  }

  barAt(x, y) {
    for (const b of this.bars) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  strike(b, e, vol = 1) {
    b.press.set(1);
    b.press.to(0);
    b.hitT = 1;
    const v = VOICES[this.voice];
    const note = SCALE[b.i];
    const midi = v.oct;
    this.audio.note(v.id, noteUp(note, midi), {
      vol: 0.85 * vol,
      pan: clamp(((this.vertical ? b.y / e.h : b.x / e.w) - 0.5) * 1.2, -0.7, 0.7),
      verb: 0.45,
    });
    this.audio.play('tap', { vol: 0.18 * vol, throttle: 0.02 });

    const cx = b.x + b.w / 2;
    const cy = this.vertical ? b.y + b.h / 2 : b.y + b.h * 0.14;
    this.notes.push({ x: cx, y: cy, t: 0, c: BAR_COLORS[b.i], glyph: (Math.random() * 3) | 0 });
    this.p.sparkle(cx, cy, ['#fff', lighten(BAR_COLORS[b.i], 0.4)], 7, e.min * 0.14);
    this.emiDance = 1;

    if (this.mode === 'song') this.checkSong(b, e);
    else this.scoreLevel(1, e);   // level one is simply "play with it a while"
  }

  checkSong(b, e) {
    const song = SONGS[this.song];
    let want = song.notes[this.step];
    while (want === -1) {
      this.step++;
      want = song.notes[this.step];
    }
    if (b.i !== want) return;   // wrong bar still played its note; nothing bad happens
    this.step++;
    this.p.confetti(b.x + b.w / 2, this.vertical ? b.y + b.h / 2 : b.y + b.h * 0.14,
      [BAR_COLORS[b.i], '#fff'], 10, e.min * 0.45);
    this.audio.play('check', { vol: 0.45 });
    while (song.notes[this.step] === -1) this.step++;
    if (this.step >= song.notes.length) {
      // finished the tune
      this.step = 0;
      this.celebrate = 2.6;
      this.reward(e.cx, e.h * 0.45, { stars: 3, big: true });
      this.audio.arp('harp', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], { step: 0.06, vol: 0.6 });
      if (this.scoreLevel(1, e)) return;
      this.song = (this.song + 1) % SONGS.length;
    }
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.bars.forEach((b) => {
      b.press.update(dt);
      if (b.hitT > 0) b.hitT = Math.max(0, b.hitT - dt * 2.4);
    });
    this.voicePress.forEach((s) => s.update(dt));
    this.songPress.update(dt);
    this.songT += dt;
    if (this.celebrate > 0) this.celebrate -= dt;
    this.emiDance = Math.max(0, this.emiDance - dt * 1.6);

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.t += dt;
      if (n.t > 1.6) this.notes.splice(i, 1);
    }

    // Idle in song mode: play the next note itself so she hears what to do.
    if (this.mode === 'song' && this.idle > 6) {
      const want = SONGS[this.song].notes[this.step];
      if (want >= 0 && this.songT > this.tune.hint) {
        this.songT = 0;
        const b = this.bars[want];
        b.press.set(1);
        b.press.to(0);
        const v = VOICES[this.voice];
        this.audio.note(v.id, noteUp(SCALE[want], v.oct), { vol: 0.35 });
      }
    }
  }

  // Stage glow and the instrument's wooden frame never move, so they are baked.
  paintBackdrop(g, e) {
    const glow = g.createRadialGradient(e.cx, e.h * 0.55, e.min * 0.1, e.cx, e.h * 0.55, e.max * 0.7);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, e.w, e.h);

    g.fillStyle = 'rgba(80,60,120,0.22)';
    roundRect(g, this.frame.x, this.frame.y, this.frame.w, this.frame.h, e.min * 0.04);
    g.fill();
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    // floating notes, drawn behind the bars
    this.notes.forEach((n) => {
      const k = n.t / 1.6;
      g.save();
      g.globalAlpha = (1 - k) * 0.9;
      g.translate(n.x + Math.sin(n.t * 4) * e.min * 0.03, n.y - k * e.min * 0.34);
      g.scale(1 + k * 0.4, 1 + k * 0.4);
      g.rotate(Math.sin(n.t * 3) * 0.25);
      g.fillStyle = n.c;
      drawNote(g, e.min * 0.035, n.glyph);
      g.restore();
    });
    g.globalAlpha = 1;

    const want = this.mode === 'song' ? SONGS[this.song].notes[this.step] : -1;

    this.bars.forEach((b, i) => {
      const press = b.press.value;
      const col = BAR_COLORS[i];
      const isNext = i === want;
      const pulse = isNext ? 0.5 + Math.sin(t * 5) * 0.5 : 0;
      g.save();
      // pressed bars sink and squash
      const shift = press * (this.vertical ? b.h * 0.1 : b.h * 0.02);
      g.translate(this.vertical ? press * b.w * 0.01 : 0, shift);

      if (isNext) {
        g.save();
        g.globalAlpha = 0.35 + pulse * 0.45;
        g.fillStyle = '#fff';
        roundRect(g, b.x - e.min * 0.014, b.y - e.min * 0.014, b.w + e.min * 0.028, b.h + e.min * 0.028, e.min * 0.03);
        g.fill();
        g.restore();
      }

      const r = Math.min(b.w, b.h) * 0.22;
      // shadow
      g.fillStyle = 'rgba(50,35,80,0.28)';
      roundRect(g, b.x, b.y + b.h * 0.02, b.w, b.h, r);
      g.fill();
      // bar
      g.fillStyle = this.vertical
        ? linearGradient(g, b.x, 0, b.x + b.w, 0, [lighten(col, 0.22), col, darken(col, 0.24)])
        : linearGradient(g, 0, b.y, 0, b.y + b.h, [lighten(col, 0.22), col, darken(col, 0.24)]);
      roundRect(g, b.x, b.y, b.w, b.h * (1 - press * 0.02), r);
      g.fill();
      // gloss
      g.save();
      g.globalAlpha = 0.2 - press * 0.12;
      g.fillStyle = '#fff';
      if (this.vertical) {
        roundRect(g, b.x + b.w * 0.02, b.y + b.h * 0.1, b.w * 0.96, b.h * 0.22, b.h * 0.11);
      } else {
        roundRect(g, b.x + b.w * 0.12, b.y + b.h * 0.02, b.w * 0.3, b.h * 0.96, b.w * 0.15);
      }
      g.fill();
      g.restore();
      // struck flash
      if (b.hitT > 0) {
        g.save();
        g.globalAlpha = b.hitT * 0.55;
        g.fillStyle = '#fff';
        roundRect(g, b.x, b.y, b.w, b.h, r);
        g.fill();
        g.restore();
      }
      // the two mounting pins, like a real xylophone
      g.fillStyle = 'rgba(255,255,255,0.5)';
      if (this.vertical) {
        circle(g, b.x + b.w * 0.08, b.y + b.h / 2, Math.min(b.h * 0.12, e.min * 0.008));
        g.fill();
        circle(g, b.x + b.w * 0.92, b.y + b.h / 2, Math.min(b.h * 0.12, e.min * 0.008));
        g.fill();
      } else {
        circle(g, b.x + b.w / 2, b.y + b.h * 0.08, Math.min(b.w * 0.12, e.min * 0.008));
        g.fill();
        circle(g, b.x + b.w / 2, b.y + b.h * 0.92, Math.min(b.w * 0.12, e.min * 0.008));
        g.fill();
      }
      g.restore();
    });

    // instrument switcher
    this.voiceBtns.forEach((b) => {
      const sel = b.i === this.voice;
      const press = this.voicePress[b.i].value;
      const r = b.r * (1 - press * 0.12) * (sel ? 1.12 : 1);
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = sel ? '#fff' : 'rgba(255,255,255,0.42)';
      circle(g, 0, 0, r * 1.16);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.4, r * 1.8, [lighten(b.v.color, 0.4), b.v.color, darken(b.v.color, 0.2)]);
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      g.scale(r, r);
      VOICE_ICONS[b.v.id](g, t);
      g.restore();
      g.restore();
    });

    // song button
    const sb = this.songBtn;
    g.save();
    g.translate(sb.x, sb.y);
    const sr = sb.r * (1 - this.songPress.value * 0.1);
    g.fillStyle = this.mode === 'song' ? C.yellow : 'rgba(255,255,255,0.8)';
    circle(g, 0, 0, sr);
    g.fill();
    g.fillStyle = this.mode === 'song' ? C.orangeDark : C.indigoDark;
    g.save();
    g.scale(sr, sr);
    g.save();
    g.rotate(this.mode === 'song' ? Math.sin(t * 4) * 0.14 : 0);
    drawNote(g, 0.5, 0);
    g.restore();
    g.restore();
    g.restore();
    label(g, this.mode === 'song' ? SONGS[this.song].name : 'שיר',
      sb.x, sb.y + sb.r * 1.5, Math.max(11, e.min * 0.032), C.ink, { stroke: '#fff', sw: e.min * 0.012 });

    // Emi dancing in the corner
    if (this.emiX !== null) {
    g.save();
    const dance = this.emiDance;
    g.translate(this.emiX, this.topH * 0.5);
    g.rotate(Math.sin(t * 6) * 0.1 * dance);
    g.scale(this.emiS, this.emiS);
    g.translate(0, -0.1);
    drawEmi(g, t, dance, { wave: dance });
    g.restore();
    }

    this.p.draw(g);

    if (this.celebrate > 0) {
      const a = clamp(this.celebrate / 0.5, 0, 1);
      g.save();
      g.globalAlpha = a;
      const s = Math.max(22, e.min * 0.08);
      label(g, 'איזה יופי!', e.w / 2, e.h * 0.42, s, C.magentaDark, { stroke: '#fff', sw: s * 0.24 });
      g.restore();
    }

    if (this.idle > 5 && this.mode === 'free') {
      const pulse = this.attractPulse(1.8);
      const b = this.bars[3];
      g.save();
      g.globalAlpha = 0.25 + pulse * 0.4;
      g.strokeStyle = '#fff';
      g.lineWidth = e.min * 0.01;
      roundRect(g, b.x, b.y, b.w, b.h, Math.min(b.w, b.h) * 0.22);
      g.stroke();
      g.restore();
    }

    this.drawHud(g, e);
  }
}

// Shift a note name by a number of semitones, keeping the letter naming simple
// by going through midi. Used to put the xylophone samples an octave up where
// they sound best.
function noteUp(name, semis) {
  if (!semis) return name;
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) return name;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  const midi = base + (parseInt(m[3], 10) + 1) * 12 + semis;
  return midi;   // the sampler accepts raw midi numbers
}

function drawNote(g, s, kind = 0) {
  g.beginPath();
  g.ellipse(0, 0, s * 0.62, s * 0.48, -0.35, 0, TAU);
  g.fill();
  g.fillRect(s * 0.42, -s * 2.1, s * 0.18, s * 2.1);
  if (kind === 1) {
    g.beginPath();
    g.moveTo(s * 0.6, -s * 2.1);
    g.quadraticCurveTo(s * 1.5, -s * 1.7, s * 0.6, -s * 1.1);
    g.closePath();
    g.fill();
  } else if (kind === 2) {
    g.beginPath();
    g.ellipse(s * 1.5, -s * 0.4, s * 0.62, s * 0.48, -0.35, 0, TAU);
    g.fill();
    g.fillRect(s * 1.92, -s * 2.5, s * 0.18, s * 2.1);
    g.fillRect(s * 0.42, -s * 2.3, s * 1.68, s * 0.24);
  }
}

const VOICE_ICONS = {
  xylophone(g) {
    [C.red, C.yellow, C.teal, C.indigo].forEach((c, i) => {
      g.fillStyle = c;
      roundRect(g, -0.6 + i * 0.31, -0.4 + i * 0.05, 0.2, 0.75 - i * 0.1, 0.07);
      g.fill();
    });
  },
  piano(g) {
    g.fillStyle = '#fff';
    roundRect(g, -0.62, -0.42, 1.24, 0.84, 0.1);
    g.fill();
    g.fillStyle = '#3b2f4a';
    for (let i = 0; i < 4; i++) {
      g.fillRect(-0.44 + i * 0.28, -0.42, 0.14, 0.5);
    }
    g.strokeStyle = '#cfc6dd';
    g.lineWidth = 0.04;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-0.3 + i * 0.3, 0.08);
      g.lineTo(-0.3 + i * 0.3, 0.42);
      g.stroke();
    }
  },
  harp(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 0.11;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-0.45, 0.55);
    g.quadraticCurveTo(-0.6, -0.5, 0.3, -0.62);
    g.stroke();
    g.beginPath();
    g.moveTo(-0.45, 0.55);
    g.lineTo(0.5, 0.55);
    g.stroke();
    g.lineWidth = 0.035;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) {
      const x = -0.3 + i * 0.17;
      g.beginPath();
      g.moveTo(x, 0.52);
      g.lineTo(x * 0.6 + 0.06, -0.48 + i * 0.08);
      g.stroke();
    }
  },
  flute(g) {
    g.save();
    g.rotate(-0.5);
    g.fillStyle = '#fff';
    roundRect(g, -0.72, -0.11, 1.44, 0.22, 0.11);
    g.fill();
    g.fillStyle = '#5a4a72';
    for (let i = 0; i < 4; i++) {
      circle(g, -0.36 + i * 0.26, 0, 0.062);
      g.fill();
    }
    g.restore();
  },
};
