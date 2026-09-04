// Shared chrome and the base class every activity extends.
//
// Deliberately tiny: two buttons tucked into the top corners and a star count.
// The home button needs a short press-and-hold with a filling ring, because a
// palm landing on the screen must not throw her out of the activity she is
// enjoying - but a real, intentional press still gets out in half a second.

import { TAU, clamp, Spring, ease } from './util.js';
import { C } from './palette.js';
import { Particles } from './fx.js';
import { circle, iconButton, homeIcon, speakerIcon, verticalGradient, star as starPath, label, alpha } from './gfx.js';
import { state, save, addStar } from './state.js';

const HOLD = 0.45;

export class Hud {
  constructor({ home = true } = {}) {
    this.showHome = home;
    this.hold = 0;
    this.holdId = null;
    this.homePress = new Spring(0, 260, 18);
    this.mutePress = new Spring(0, 260, 18);
    this.starPop = new Spring(1, 220, 12);
    this.flyers = [];
    this.r = 0;
  }

  layout(e) {
    this.r = clamp(e.min * 0.062, 26, 52);
    const m = this.r + e.min * 0.035;
    this.homeX = m;
    this.homeY = m;
    this.muteX = e.w - m;
    this.muteY = m;
    // The counter sits beside the speaker rather than in the middle: the top
    // centre is the one place every activity wants for its big Hebrew word.
    this.starW = this.r * 2.5;
    this.starX = e.w - m - this.r * 1.05 - this.starW / 2;
    this.starY = m;
    // Scenes read this to know how much room the chrome has taken.
    e.topBand = m + this.r;
  }

  // Returns 'home' | 'mute' | null - the scene decides what to do with it.
  onDown(p, e) {
    if (this.showHome && Math.hypot(p.x - this.homeX, p.y - this.homeY) < this.r * 1.25) {
      this.hold = 0;
      this.holdId = p.id;
      this.homePress.to(1);
      p.data = 'hud';
      return 'home-start';
    }
    if (Math.hypot(p.x - this.muteX, p.y - this.muteY) < this.r * 1.25) {
      this.mutePress.to(1);
      this.mutePress.kick(-8);
      p.data = 'hud';
      return 'mute';
    }
    return null;
  }

  onUp(p) {
    if (p.id === this.holdId) {
      this.holdId = null;
      this.hold = 0;
      this.homePress.to(0);
    }
    return null;
  }

  // Called every frame; returns true on the frame the hold completes.
  update(dt) {
    this.homePress.update(dt);
    this.mutePress.update(dt);
    if (this.mutePress.target === 1 && this.mutePress.idle) this.mutePress.to(0);
    this.starPop.update(dt);
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        this.flyers.splice(i, 1);
        this.starPop.set(1);
        this.starPop.kick(9);
      }
    }
    if (this.holdId !== null) {
      this.hold += dt;
      if (this.hold >= HOLD) {
        this.holdId = null;
        this.hold = 0;
        this.homePress.to(0);
        return true;
      }
    }
    return false;
  }

  // A star flying from wherever it was earned into the counter. Small thing,
  // but it is what makes a reward feel like it went somewhere.
  fly(x, y) {
    this.flyers.push({ x, y, t: 0, dur: 0.55 });
  }

  draw(g, e) {
    const r = this.r;
    // star counter
    g.save();
    const sp = this.starPop.value;
    g.translate(this.starX, this.starY);
    g.globalAlpha = 0.9;
    g.fillStyle = 'rgba(255,255,255,0.62)';
    const w = this.starW, h = r * 1.15;
    g.beginPath();
    g.roundRect ? g.roundRect(-w / 2, -h / 2, w, h, h / 2) : circle(g, 0, 0, h / 2);
    g.fill();
    g.globalAlpha = 1;
    g.save();
    g.translate(-w * 0.28, 0);
    g.scale(sp, sp);
    g.fillStyle = C.yellow;
    starPath(g, 5, r * 0.4, r * 0.19);
    g.fill();
    g.strokeStyle = C.yellowDark;
    g.lineWidth = r * 0.06;
    g.stroke();
    g.restore();
    label(g, String(state.stars), w * 0.18, 1, r * 0.62, C.ink, { stroke: null, align: 'center' });
    g.restore();

    // flying stars
    for (const f of this.flyers) {
      const t = ease.inOutQuad(f.t);
      const x = f.x + (this.starX - w * 0.28 - f.x) * t;
      const y = f.y + (this.starY - f.y) * t - Math.sin(t * Math.PI) * e.min * 0.16;
      g.save();
      g.translate(x, y);
      const s = 1 - t * 0.4;
      g.rotate(f.t * 6);
      g.fillStyle = C.yellow;
      starPath(g, 5, r * 0.5 * s, r * 0.24 * s);
      g.fill();
      g.restore();
    }

    if (this.showHome) {
      const pr = iconButton(g, this.homeX, this.homeY, r, { press: this.homePress.value, color: 'rgba(255,255,255,0.9)' });
      homeIcon(g, this.homeX, this.homeY + this.homePress.value * r * 0.06, pr * 0.5);
      if (this.holdId !== null) {
        const t = clamp(this.hold / HOLD, 0, 1);
        g.save();
        g.strokeStyle = C.magenta;
        g.lineWidth = pr * 0.16;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(this.homeX, this.homeY, pr * 1.08, -Math.PI / 2, -Math.PI / 2 + TAU * t);
        g.stroke();
        g.restore();
      }
    }
    const mr = iconButton(g, this.muteX, this.muteY, r, { press: this.mutePress.value, color: 'rgba(255,255,255,0.9)' });
    speakerIcon(g, this.muteX, this.muteY, mr * 0.52, !state.muted);
  }
}

export class SceneBase {
  constructor(game, { sky, music = 'play', home = true } = {}) {
    this.game = game;
    this.sky = sky;
    this.musicName = music;
    this.p = new Particles();
    this.hud = new Hud({ home });
    this.t = 0;
    this.idle = 0;          // seconds since the last touch, drives attract mode
    this.combo = 0;
    this.comboTimer = 0;
  }

  get audio() { return this.game.audio; }

  enter() {
    this.game.music.play(this.musicName);
  }

  layout(e) {
    this.hud.layout(e);
    this.bg = verticalGradient(e.g, 0, e.h, this.sky);
  }

  // Runs after the scene's own layout, so the backdrop is painted with the
  // final geometry rather than whatever super.layout() saw.
  postLayout(e) {
    this.buildBackdrop(e);
  }

  // Scenery that never moves - sky, hills, sand, wood grain, coral - is painted
  // once into an offscreen canvas and blitted each frame. Without this, every
  // frame repaints several full-screen gradients, which is the single biggest
  // cost on a tablet with a weak GPU.
  buildBackdrop(e) {
    if (!this.paintBackdrop) return;
    const w = Math.max(1, Math.round(e.w * e.dpr));
    const h = Math.max(1, Math.round(e.h * e.dpr));
    if (!this.backdrop) this.backdrop = document.createElement('canvas');
    this.backdrop.width = w;
    this.backdrop.height = h;
    const bg = this.backdrop.getContext('2d');
    bg.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    bg.fillStyle = verticalGradient(bg, 0, e.h, this.sky);
    bg.fillRect(0, 0, e.w, e.h);
    this.paintBackdrop(bg, e);
  }

  drawBackdrop(g, e) {
    if (this.backdrop) {
      g.drawImage(this.backdrop, 0, 0, this.backdrop.width, this.backdrop.height, 0, 0, e.w, e.h);
    } else {
      this.drawSky(g, e);
    }
  }

  exit() {
    this.p.clear();
  }

  // Every scene calls this first from its own onDown.
  hudDown(p, e) {
    const r = this.hud.onDown(p, e);
    if (r === 'mute') {
      state.muted = !state.muted;
      save();
      this.audio.setMuted(state.muted);
      if (!state.muted) this.audio.play('toggle-on');
      return true;
    }
    return r === 'home-start';
  }

  updateBase(dt, e) {
    this.t += dt;
    this.idle = e.pointers.size ? 0 : this.idle + dt;
    this.p.update(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.hud.update(dt)) {
      this.audio.play('back');
      this.game.goHub();
    }
  }

  drawSky(g, e) {
    g.fillStyle = this.bg || '#fff';
    g.fillRect(0, 0, e.w, e.h);
  }

  // One place for "she did a good thing". Escalates with a streak so that
  // repeated success keeps feeling better instead of flattening out.
  reward(x, y, { stars = 1, big = false, colors = null, sound = true } = {}) {
    this.combo++;
    this.comboTimer = 2.6;
    const e = this.game.engine;
    const set = colors || [C.red, C.orange, C.yellow, C.lime, C.teal, C.sky, C.pink, C.purple];
    const power = e.min * (big ? 1.1 : 0.7);
    this.p.confetti(x, y, set, big ? 46 : 24, power);
    this.p.sparkle(x, y, ['#fff', C.yellow, '#fff8e0'], big ? 22 : 12, e.min * 0.28);
    this.p.ring(x, y, '#ffffff', e.min * 0.12, 0.45);
    if (stars > 0) {
      addStar(stars);
      this.hud.fly(x, y);
      this.p.star(x, y, C.yellow, e.min * 0.045);
    }
    if (sound) {
      const tier = Math.min(4, this.combo);
      this.game.music.duck(0.4, 0.5);
      this.audio.play(big ? 'fanfare' : ['success', 'reward', 'bonus', 'achievement'][tier - 1] || 'success', { throttle: 0 });
      const scale = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];
      const from = Math.min(4, this.combo - 1);
      this.audio.arp('xylophone', scale.slice(from, from + 4), { step: 0.06, vol: 0.55 });
    }
    if (big) e.kickShake(7);
  }

  // Gentle "look here" pulse used by every scene after a few idle seconds, so
  // the game always suggests the next thing to touch.
  attractPulse(period = 2.4) {
    if (this.idle < 3) return 0;
    const t = ((this.idle - 3) % period) / period;
    return Math.sin(t * Math.PI) * clamp((this.idle - 3) / 2, 0, 1);
  }

  drawHud(g, e) {
    this.hud.draw(g, e);
  }
}

// Soft vignette that keeps the busy middle of the screen readable against the
// HUD without a hard panel behind it.
export function vignette(g, e, amount = 0.18) {
  const grad = g.createRadialGradient(e.cx, e.cy, e.min * 0.3, e.cx, e.cy, e.max * 0.78);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(30,20,50,${amount})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, e.w, e.h);
}

export { alpha };
