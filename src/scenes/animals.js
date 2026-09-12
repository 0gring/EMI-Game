// Peek-a-boo meadow.
//
// Six hiding places. Touch one, an animal springs out, says its name and its
// sound, and goes into the album. This is the language activity: the Hebrew word
// appears large while the call plays, and every animal has a distinct voice
// built by bending a real instrument sample.
//
// The hiding places cycle through a shuffled bag rather than picking at random,
// so she meets all thirteen animals instead of the same cat six times.

import {
  TAU, Spring, Schedule, rand, pick, shuffled, clamp, lerp, ease,
} from '../core/util.js';
import { C, SKIES, CONFETTI } from '../core/palette.js';
import {
  circle, roundRect, label, sun, cloud, lighten, darken, blob, flower, groundShadow, hill,
  grassTufts, quadY,
} from '../core/gfx.js';
import { SceneBase } from '../core/ui.js';
import { LAND, drawEmi, EMI_FEET } from '../core/creatures.js';
import { collect, state } from '../core/state.js';

// The six kinds of hiding place, drawn in a unit space of radius 1.
const HIDES = ['bush', 'haystack', 'log', 'barrel', 'flowers', 'rock'];

class Spot {
  constructor(kind, i) {
    this.kind = kind;
    this.i = i;
    this.x = 0;
    this.y = 0;
    this.s = 1;
    this.state = 'hidden';
    this.timer = 0;
    this.rise = new Spring(0, 150, 12);   // 0 hidden, 1 fully out
    this.excite = new Spring(0, 200, 13);
    this.shake = new Spring(0, 340, 14);
    this.animal = null;
    this.walk = 0;
    this.dir = 1;
  }
}

// The meadow gets busier rather than trickier. Higher levels have more hiding
// places popping out on their own and waiting to be touched, and each animal
// stays out a little less long - so there is always something to run to, and
// never anything to miss.
const TUNING = [
  { autoOut: 0.35, stay: 6.0, parade: 4 },
  { autoOut: 0.6, stay: 5.2, parade: 4 },
  { autoOut: 0.9, stay: 4.6, parade: 3 },
  { autoOut: 1.3, stay: 4.0, parade: 3 },
];

export class AnimalScene extends SceneBase {
  constructor(game) {
    super(game, {
      sky: SKIES.animals, music: 'play', id: 'animals', hue: C.lime,
      goals: [4, 6, 8, 10],
    });
    this.tune = TUNING[0];
    this.spots = HIDES.map((k, i) => new Spot(k, i));
    this.bag = shuffled(LAND);
    this.bagIdx = 0;
    this.found = new Set();
    this.sched = new Schedule();
    this.parade = null;
    this.clouds = Array.from({ length: 4 }, () => ({ x: rand(1), y: rand(0.06, 0.26), s: rand(0.7, 1.2), v: rand(0.005, 0.012) }));
    this.wordT = 0;
    this.word = null;
    this.emiCheer = new Spring(0, 160, 11);
  }

  nextAnimal() {
    if (this.bagIdx >= this.bag.length) {
      this.bag = shuffled(LAND);
      this.bagIdx = 0;
    }
    return this.bag[this.bagIdx++];
  }

  enter(e) {
    super.enter();
    this.audio.play('open', { vol: 0.6 });
    this.tune = this.levels.pick(TUNING);
    // Pre-load each spot so the first touch is instant.
    this.spots.forEach((s) => { s.animal = this.nextAnimal(); });
    // One animal is already peeking, as an invitation.
    const first = pick(this.spots);
    first.state = 'peek';
    first.rise.to(0.34);
  }

  layout(e) {
    super.layout(e);
    this.horizon = e.h * 0.24;
    // Two rows on a wide screen, three on a tall one; back row smaller so the
    // meadow has depth.
    const cols = e.portrait ? 2 : 3;
    const rows = e.portrait ? 3 : 2;
    const top = e.h * 0.42;
    const bottom = e.h * 0.9;
    const gapY = rows > 1 ? (bottom - top) / (rows - 1) : 0;
    this.spots.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      s.x = e.w * ((col + 0.5) / cols) + (row % 2 ? e.w * 0.06 / cols : -e.w * 0.04 / cols);
      s.y = top + row * gapY;
      s.s = e.min * (0.115 + row * 0.014);
    });
    this.emiS = e.min * 0.075;
  }

  onDown(p, e) {
    if (this.hudDown(p, e)) return;
    for (const s of this.spots) {
      const r = s.s * 1.25;
      const cy = s.y - s.s * 0.3;
      if (Math.hypot(p.x - s.x, p.y - cy) < r) {
        this.poke(s, e);
        return;
      }
    }
    this.p.petals(p.x, p.y, [C.pink, C.yellow, C.white], 5);
    this.audio.play('plink', { vol: 0.25, rate: rand(0.9, 1.4) });
  }

  onUp(p) { this.hud.onUp(p); }

  poke(s, e) {
    s.shake.set(0);
    s.shake.kick(9);
    if (s.state === 'hidden' || s.state === 'peek') {
      this.reveal(s, e);
    } else {
      // Already out: touching again repeats the sound and makes it hop. This
      // matters - toddlers want the same sound over and over.
      s.excite.set(1);
      s.excite.to(0);
      this.audio.voice(s.animal.voice);
      this.audio.play('boing', { vol: 0.35 });
      this.say(s.animal);
      this.p.sparkle(s.x, s.y - s.s * 1.2, ['#fff', C.yellow], 8, e.min * 0.15);
    }
  }

  reveal(s, e) {
    s.state = 'out';
    s.timer = this.tune.stay;
    s.rise.to(1);
    s.rise.kick(5);
    s.excite.set(1);
    s.excite.to(0);
    const an = s.animal;

    this.audio.play('expand', { vol: 0.5 });
    this.audio.voice(an.voice);
    this.p.puff(s.x, s.y - s.s * 0.3, 'rgba(255,255,255,0.7)', 10);
    this.p.sparkle(s.x, s.y - s.s * 1.1, ['#fff', C.yellow, an.color], 12, e.min * 0.2);
    this.say(an);

    const isNew = !state.stickers[an.id];
    collect(an.id);
    this.found.add(an.id);

    if (isNew) {
      this.reward(s.x, s.y - s.s * 1.2, { stars: 2, big: true, colors: [an.color, C.yellow, '#fff'] });
      this.emiCheer.set(1);
      this.emiCheer.to(0);
    } else {
      this.p.confetti(s.x, s.y - s.s, [an.color, lighten(an.color, 0.4), '#fff'], 14, e.min * 0.55);
    }

    if (this.scoreLevel(1, e)) return;   // a level-up throws its own parade

    // Every few different animals in one sitting throws a parade.
    if (this.found.size > 0 && this.found.size % this.tune.parade === 0 && !this.parade) {
      this.sched.in(1.1, () => this.startParade(e));
    }
  }

  onLevelUp(level, e) {
    this.tune = this.levels.pick(TUNING);
    // Everyone comes out to mark it.
    this.startParade(e);
  }

  say(an) {
    this.word = an;
    this.wordT = 2.2;
  }

  // A line of animals walks across the meadow, then everyone hides again.
  startParade(e) {
    const cast = shuffled(LAND).slice(0, 5);
    this.parade = {
      t: 0,
      dur: 7.5,
      cast: cast.map((a, i) => ({ a, off: i * 0.11, hop: rand(10) })),
    };
    this.audio.play('fanfare', { throttle: 0 });
    this.audio.arp('harp', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7', 'E7'], { step: 0.07, vol: 0.55 });
    this.p.confetti(e.cx, e.h * 0.35, CONFETTI, 60, e.min * 1.2);
    this.emiCheer.set(1);
    this.emiCheer.to(0);
  }

  update(dt, e) {
    this.updateBase(dt, e);
    this.sched.update(dt);
    this.emiCheer.update(dt);
    if (this.wordT > 0) this.wordT -= dt;

    this.spots.forEach((s) => {
      s.rise.update(dt);
      s.excite.update(dt);
      s.shake.update(dt);
      if (s.state === 'out') {
        s.timer -= dt;
        // Wander a little while out, then duck back down.
        s.walk += dt;
        if (s.timer <= 0) {
          s.state = 'hiding';
          s.rise.to(0);
          this.audio.play('close', { vol: 0.3 });
        }
      } else if (s.state === 'hiding') {
        if (s.rise.value < 0.05) {
          s.state = 'hidden';
          s.animal = this.nextAnimal();
        }
      }
    });

    // Hiding places come alive on their own, more of them at higher levels, so
    // the meadow always has something waiting to be touched. This doubles as
    // the attract loop: after a few idle seconds it speeds up.
    const out = this.spots.filter((s) => s.state === 'out').length;
    const rate = this.tune.autoOut * (this.idle > 4.5 ? 2 : 1);
    if (out < Math.ceil(this.levels.level / 1.5) && Math.random() < dt * rate) {
      const hidden = this.spots.filter((s) => s.state === 'hidden');
      if (hidden.length) {
        const s = pick(hidden);
        s.state = 'peek';
        s.rise.to(0.3);
        s.shake.set(0);
        s.shake.kick(5);
        this.audio.play('swipe', { vol: 0.22 });
      }
    }
    this.spots.forEach((s) => {
      if (s.state === 'peek' && s.rise.idle && Math.random() < dt * 0.4) {
        s.state = 'hidden';
        s.rise.to(0);
      }
    });

    if (this.parade) {
      this.parade.t += dt;
      if (this.parade.t > this.parade.dur) this.parade = null;
    }
    this.clouds.forEach((c) => {
      c.x += c.v * dt;
      if (c.x > 1.3) c.x = -0.3;
    });
  }

  // The meadow behind the hiding places: hills, trees and grass.
  paintBackdrop(g, e) {
    const t = 0;
    hill(g, e.w * 0.25, this.horizon + e.h * 0.09, e.w * 0.6, e.h * 0.1, '#a5dd7f');
    hill(g, e.w * 0.8, this.horizon + e.h * 0.07, e.w * 0.55, e.h * 0.09, '#98d772');
    g.fillStyle = '#b7e88c';
    g.beginPath();
    g.moveTo(0, this.horizon + e.h * 0.05);
    g.quadraticCurveTo(e.w * 0.5, this.horizon - e.h * 0.01, e.w, this.horizon + e.h * 0.04);
    g.lineTo(e.w, e.h);
    g.lineTo(0, e.h);
    g.closePath();
    g.fill();
    // a couple of trees on the ridge
    [0.12, 0.68, 0.88].forEach((fx, i) => {
      const x = fx * e.w;
      const y = this.horizon + e.h * 0.05;
      const s = e.min * (0.07 + i * 0.008);
      g.save();
      g.translate(x, y);
      g.fillStyle = '#8d5836';
      roundRect(g, -s * 0.1, -s * 0.6, s * 0.2, s * 0.7, s * 0.06);
      g.fill();
      g.save();
      g.translate(0, -s * 0.9);
      g.fillStyle = '#5fb356';
      blob(g, s * 0.62, 0.09, t * 0.7 + i, 6);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      blob(g, s * 0.4, 0.12, t * 0.7 + i + 1, 6);
      g.fill();
      g.restore();
      g.restore();
    });
    const ridge = (x) => quadY(x / e.w, this.horizon + e.h * 0.05, this.horizon - e.h * 0.01, this.horizon + e.h * 0.04);
    grassTufts(g, e.w, Math.max(10, Math.round(e.w / 42)), 'rgba(82,160,62,0.5)', ridge, e.min * 0.028);
  }

  draw(g, e) {
    this.drawBackdrop(g, e);
    const t = this.t;

    sun(g, e.w * 0.9, e.h * 0.09, e.min * 0.055, t);
    this.clouds.forEach((c) => {
      g.save();
      g.translate(c.x * e.w * 1.3 - e.w * 0.15, c.y * e.h);
      g.fillStyle = 'rgba(255,255,255,0.88)';
      cloud(g, e.min * 0.26 * c.s, e.min * 0.07 * c.s, t + c.x * 7);
      g.fill();
      g.restore();
    });

    // spots, back rows first so front ones overlap correctly
    const order = this.spots.slice().sort((a, b) => a.y - b.y);
    order.forEach((s) => this.drawSpot(g, e, s, t));

    // Emi watching from the corner
    g.save();
    g.translate(e.w * 0.055, e.h - e.min * 0.012 - this.emiS * EMI_FEET);
    groundShadow(g, 0, 0, this.emiS * 0.6, 0.16);
    g.scale(this.emiS, this.emiS);
    drawEmi(g, t, this.emiCheer.value, { wave: this.emiCheer.value });
    g.restore();

    if (this.parade) this.drawParade(g, e);

    this.p.draw(g);

    // the spoken word
    if (this.wordT > 0 && this.word) {
      const a = clamp(this.wordT / 0.4, 0, 1) * clamp((2.2 - this.wordT) / 0.15, 0, 1);
      const pop = ease.outBack(clamp((2.2 - this.wordT) / 0.35, 0, 1));
      g.save();
      g.globalAlpha = a;
      g.translate(e.w / 2, e.h * 0.115);
      g.scale(pop, pop);
      const s1 = Math.max(26, e.min * 0.095);
      label(g, this.word.name, 0, 0, s1, C.ink, { stroke: '#fff', sw: s1 * 0.24 });
      const s2 = Math.max(17, e.min * 0.055);
      label(g, this.word.says, 0, s1 * 0.85, s2, this.word.color === '#fdfdfd' ? C.inkSoft : darken(this.word.color, 0.3), {
        stroke: '#fff', sw: s2 * 0.26,
      });
      g.restore();
    }

    if (this.idle > 6) {
      const s = this.spots.find((x) => x.state === 'hidden') || this.spots[0];
      const pulse = this.attractPulse(1.7);
      g.save();
      g.globalAlpha = 0.3 + pulse * 0.45;
      g.strokeStyle = '#fff';
      g.lineWidth = e.min * 0.011;
      circle(g, s.x, s.y - s.s * 0.35, s.s * (1.2 + pulse * 0.15));
      g.stroke();
      g.restore();
    }

    this.drawHud(g, e);
  }

  drawSpot(g, e, s, t) {
    const rise = clamp(s.rise.value, 0, 1.2);
    const ex = s.excite.value;
    const shake = s.shake.value;
    g.save();
    g.translate(s.x + Math.sin(t * 30) * shake * 0.8, s.y);
    groundShadow(g, 0, s.s * 0.16, s.s * 0.9, 0.18);

    // The animal rises out from behind the prop: clip so it appears to come out
    // of the bush rather than float in front of it.
    if (rise > 0.01) {
      g.save();
      g.beginPath();
      g.rect(-s.s * 2, -s.s * 4.2, s.s * 4, s.s * 4.2 + s.s * 0.1);
      g.clip();
      const lift = lerp(-s.s * 0.05, -s.s * 1.02, ease.outCubic(clamp(rise, 0, 1)));
      g.save();
      g.translate(0, lift + Math.sin(t * 3) * s.s * 0.03 * rise);
      // squash on the way out
      const sq = 1 + Math.sin(clamp(rise, 0, 1) * Math.PI) * 0.14 + ex * 0.1;
      g.scale(1 / sq, sq);
      g.scale(s.s * 0.72, s.s * 0.72);
      s.animal.draw(g, t + s.i, ex, s.i);
      g.restore();
      g.restore();
    }

    g.save();
    g.rotate(shake * 0.03);
    HIDE_ART[s.kind](g, s.s, t + s.i * 1.7, s.i);
    g.restore();
    g.restore();
  }

  drawParade(g, e) {
    const pr = this.parade;
    const y = e.h * 0.965;
    const s = e.min * 0.085;
    pr.cast.forEach((c, i) => {
      const p = clamp(pr.t / pr.dur - c.off, 0, 1);
      if (p <= 0) return;
      // RTL parade: walks from the right edge to the left.
      const x = lerp(e.w + s * 2, -s * 2, p);
      const hop = Math.abs(Math.sin(pr.t * 6 + c.hop)) * s * 0.16;
      g.save();
      g.translate(x, y - hop);
      groundShadow(g, 0, hop * 0.5, s * 0.55, 0.16);
      g.scale(s, s);
      g.scale(-1, 1);   // face the direction of travel
      c.a.draw(g, this.t + i, 0.7, i);
      g.restore();
    });
    // ribbon banner over the parade
    g.save();
    g.globalAlpha = 0.9;
    const by = e.h * 0.72;
    g.fillStyle = C.magenta;
    roundRect(g, e.w * 0.5 - e.min * 0.28, by, e.min * 0.56, e.min * 0.1, e.min * 0.05);
    g.fill();
    label(g, 'מצעד החיות!', e.w * 0.5, by + e.min * 0.05, Math.max(15, e.min * 0.055), '#fff', { stroke: null });
    g.restore();
  }
}

// Hiding places. Each draws around the origin with the ground at y = 0.
const HIDE_ART = {
  bush(g, s, t) {
    g.save();
    g.translate(0, -s * 0.32);
    g.fillStyle = '#4fa844';
    blob(g, s * 0.9, 0.07, t * 0.8, 7);
    g.fill();
    g.fillStyle = '#63c257';
    blob(g, s * 0.72, 0.09, t * 0.8 + 2, 6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    blob(g, s * 0.42, 0.12, t * 0.8 + 4, 5);
    g.fill();
    // berries
    g.fillStyle = C.red;
    [[-0.5, 0.1], [0.42, -0.18], [0.1, 0.3]].forEach(([x, y]) => {
      circle(g, x * s, y * s, s * 0.075);
      g.fill();
    });
    g.restore();
  },
  haystack(g, s, t) {
    g.save();
    g.translate(0, -s * 0.28);
    g.fillStyle = '#e8b842';
    g.beginPath();
    g.moveTo(-s * 0.95, s * 0.34);
    g.quadraticCurveTo(-s * 0.7, -s * 0.75, 0, -s * 0.8);
    g.quadraticCurveTo(s * 0.7, -s * 0.75, s * 0.95, s * 0.34);
    g.closePath();
    g.fill();
    g.strokeStyle = '#c99a2c';
    g.lineWidth = s * 0.05;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.3, s * 0.3);
      g.quadraticCurveTo(i * s * 0.24, -s * 0.2, i * s * 0.16, -s * 0.62);
      g.stroke();
    }
    g.fillStyle = '#f5d67a';
    for (let i = 0; i < 5; i++) {
      const a = -1.6 + i * 0.7;
      g.save();
      g.rotate(a * 0.2 + Math.sin(t + i) * 0.03);
      roundRect(g, -s * 0.03, -s * 0.9, s * 0.06, s * 0.22, s * 0.03);
      g.fill();
      g.restore();
    }
    g.restore();
  },
  log(g, s, t) {
    g.save();
    g.translate(0, -s * 0.24);
    g.fillStyle = '#8d5836';
    roundRect(g, -s * 0.95, -s * 0.42, s * 1.9, s * 0.84, s * 0.3);
    g.fill();
    g.fillStyle = '#b5794f';
    g.save();
    g.translate(-s * 0.86, 0);
    g.beginPath();
    g.ellipse(0, 0, s * 0.16, s * 0.42, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#8d5836';
    g.lineWidth = s * 0.035;
    for (let i = 1; i <= 2; i++) {
      g.beginPath();
      g.ellipse(0, 0, s * 0.16 * (i / 3), s * 0.42 * (i / 3), 0, 0, TAU);
      g.stroke();
    }
    g.restore();
    g.fillStyle = '#5fb356';
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate(s * (0.1 + i * 0.32), -s * 0.42);
      g.rotate(Math.sin(t + i) * 0.1);
      g.beginPath();
      g.ellipse(0, -s * 0.06, s * 0.14, s * 0.08, 0.3, 0, TAU);
      g.fill();
      g.restore();
    }
    g.restore();
  },
  barrel(g, s, t) {
    g.save();
    g.translate(0, -s * 0.3);
    g.fillStyle = '#b5794f';
    g.beginPath();
    g.moveTo(-s * 0.62, -s * 0.6);
    g.quadraticCurveTo(-s * 0.86, 0, -s * 0.62, s * 0.6);
    g.lineTo(s * 0.62, s * 0.6);
    g.quadraticCurveTo(s * 0.86, 0, s * 0.62, -s * 0.6);
    g.closePath();
    g.fill();
    g.fillStyle = '#8d5836';
    // Bands hug the barrel's silhouette rather than jutting out like crate slats.
    [[-0.34, 0.7], [0.06, 0.8], [0.42, 0.68]].forEach(([y, wide]) => {
      roundRect(g, -s * wide, y * s, s * wide * 2, s * 0.1, s * 0.05);
      g.fill();
    });
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = s * 0.04;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.32, -s * 0.58);
      g.lineTo(i * s * 0.32, s * 0.58);
      g.stroke();
    }
    g.restore();
  },
  flowers(g, s, t) {
    g.save();
    g.translate(0, -s * 0.18);
    g.fillStyle = '#5fb356';
    blob(g, s * 0.85, 0.06, t, 8);
    g.fill();
    const cols = [C.pink, C.yellow, C.magenta, C.white, C.orange];
    for (let i = 0; i < 5; i++) {
      const x = (-0.6 + i * 0.3) * s;
      const y = (-0.2 - (i % 2) * 0.22) * s;
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(t * 1.6 + i) * 0.1);
      g.strokeStyle = '#4fa844';
      g.lineWidth = s * 0.045;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, s * 0.3);
      g.stroke();
      g.fillStyle = cols[i];
      flower(g, 5, s * 0.1, s * 0.085);
      g.fillStyle = C.yellow;
      circle(g, 0, 0, s * 0.055);
      g.fill();
      g.restore();
    }
    g.restore();
  },
  rock(g, s, t) {
    g.save();
    g.translate(0, -s * 0.24);
    g.fillStyle = '#9aa3b2';
    g.beginPath();
    g.moveTo(-s * 0.92, s * 0.4);
    g.quadraticCurveTo(-s * 0.8, -s * 0.5, -s * 0.2, -s * 0.62);
    g.quadraticCurveTo(s * 0.55, -s * 0.7, s * 0.9, s * 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#b3bbc7';
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.1);
    g.quadraticCurveTo(-s * 0.2, -s * 0.56, s * 0.2, -s * 0.3);
    g.quadraticCurveTo(-s * 0.1, -s * 0.12, -s * 0.5, -s * 0.1);
    g.closePath();
    g.fill();
    g.fillStyle = '#5fb356';
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate((-0.5 + i * 0.5) * s, s * 0.38);
      g.rotate(Math.sin(t + i) * 0.12);
      g.beginPath();
      g.ellipse(0, -s * 0.06, s * 0.13, s * 0.07, 0.4, 0, TAU);
      g.fill();
      g.restore();
    }
    g.restore();
  },
};
