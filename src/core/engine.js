// Canvas engine: sizing, the frame loop, multi-touch input and scene switching.
//
// Toddler-specific choices worth knowing about:
//   * All ten fingers are tracked. A two year old plants a whole palm on the
//     glass, so scenes get a map of live pointers rather than a single cursor.
//   * The layout is expressed in a virtual 1000x1000-ish space and fitted to
//     whatever the device is, so the same code fills a phone, a tablet in either
//     orientation and a desktop window.
//   * dt is clamped. A dropped frame must never teleport anything.

import { clamp } from './util.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.scene = null;
    this.next = null;
    this.pointers = new Map();
    this.time = 0;
    this.frame = 0;
    this.fade = 0;          // 1 = fully covered, used for scene transitions
    this.fadeDir = 0;
    this.fadeColor = '#ffffff';
    this.paused = false;
    this.onTransition = null;
    this.shake = 0;
    this._raf = null;
    this._last = 0;
    this._acc = 0;
    this._fps = 60;
    this.quality = 1;      // scales the backing-store resolution
    this.lowQuality = false; // scenes drop decorations when this is set
    this._slow = 0;

    this._bindInput();
    this._bindResize();
    this.resize();
  }

  // --- sizing -------------------------------------------------------------

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));
    const cssH = Math.max(320, Math.round(rect.height || window.innerHeight));
    const dpr = this.pickDpr(cssW, cssH);
    if (this.w === cssW && this.h === cssH && this.dpr === dpr) return;
    this.w = cssW;
    this.h = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.min = Math.min(cssW, cssH);
    this.max = Math.max(cssW, cssH);
    this.cx = cssW / 2;
    this.cy = cssH / 2;
    this.portrait = cssH > cssW;
    // One number every scene multiplies its sizes by, so art scales instead of
    // being laid out in raw pixels.
    this.u = this.min / 100;
    if (this.scene) {
      this.scene.layout?.(this);
      this.scene.postLayout?.(this);
    }
  }

  // Pixel budget rather than a flat DPR cap. A 3x buffer on a big tablet costs
  // four times the fill of a 1.5x one and looks all but identical at arm's
  // length, so the backing store is capped by total pixels and then scaled down
  // further if the measured frame rate says the device cannot keep up.
  pickDpr(cssW, cssH) {
    const want = clamp(window.devicePixelRatio || 1, 1, 3);
    const fit = Math.sqrt(2.9e6 / (cssW * cssH));
    return clamp(Math.min(want, fit) * this.quality, 0.7, 3);
  }

  // Called from the loop: if we spend a couple of seconds below target, step
  // quality down. It never steps back up, because oscillating resolution is
  // more distracting than a slightly soft picture.
  checkQuality() {
    if (this.quality <= 0.62 || this.time < 3) return;
    if (this._fps < 46) {
      this._slow += 1;
      if (this._slow > 90) {
        this._slow = 0;
        this.quality *= 0.8;
        this.lowQuality = this.quality < 0.9;
        this.dpr = 0;      // force resize() to rebuild the backing store
        this.resize();
      }
    } else if (this._slow > 0) {
      this._slow -= 1;
    }
  }

  _bindResize() {
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(onResize, 220), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize, { passive: true });
    }
  }

  // --- input --------------------------------------------------------------

  _point(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      id: e.pointerId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
      dx: 0,
      dy: 0,
      t: this.time,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      moved: 0,
      data: null, // scenes hang per-finger state here (dragged piece, brush...)
    };
  }

  _bindInput() {
    const c = this.canvas;
    const down = (e) => {
      // Capture keeps a finger that slides off the canvas reporting to us. It
      // throws if the pointer is already gone, which is harmless.
      try { c.setPointerCapture?.(e.pointerId); } catch { /* pointer already released */ }
      this.onAnyTouch?.();
      const p = this._point(e);
      this.pointers.set(p.id, p);
      this.scene?.onDown?.(p, this);
    };
    const move = (e) => {
      const p = this.pointers.get(e.pointerId);
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!p) {
        this.hoverX = x;
        this.hoverY = y;
        return;
      }
      p.px = p.x;
      p.py = p.y;
      p.x = x;
      p.y = y;
      p.dx = x - p.px;
      p.dy = y - p.py;
      p.moved += Math.hypot(p.dx, p.dy);
      this.scene?.onMove?.(p, this);
    };
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(p.id);
      this.scene?.onUp?.(p, this);
    };

    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    // A finger leaving the glass mid-drag has to release, or the scene keeps a
    // ghost pointer forever.
    c.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') up(e); });

    // Nothing in a toddler game should ever open a context menu, select text or
    // trigger a browser gesture.
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dragstart', (e) => e.preventDefault());
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((n) =>
      c.addEventListener(n, (e) => e.preventDefault())
    );
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  // --- scenes -------------------------------------------------------------

  // Scenes swap behind a colour wash, so the change reads as a wipe rather than
  // a jarring cut.
  go(scene, color = '#fff8e7') {
    if (this.next) return;
    this.next = scene;
    this.fadeColor = color;
    this.fadeDir = 1;
  }

  setScene(scene) {
    this.scene?.exit?.(this);
    this.scene = scene;
    scene.layout?.(this);
    scene.postLayout?.(this);
    scene.enter?.(this);
  }

  kickShake(v = 6) {
    this.shake = Math.min(18, this.shake + v);
  }

  // --- loop ---------------------------------------------------------------

  start() {
    this._last = performance.now();
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.1) dt = 0.1;      // a tab coming back must not fast-forward
      if (dt <= 0) return;
      this._fps += ((1 / dt) - this._fps) * 0.05;
      this.time += dt;
      this.frame++;
      this.update(dt);
      this.draw();
      this.checkQuality();
    };
    this._raf = requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!document.hidden) this._last = performance.now();
      this.onVisibility?.(document.hidden);
    });
  }

  update(dt) {
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * 3.2;
      if (this.fade >= 1 && this.fadeDir > 0) {
        this.fade = 1;
        this.fadeDir = -1;
        if (this.next) {
          this.pointers.clear();
          this.setScene(this.next);
          this.next = null;
          this.onTransition?.(this.scene);
        }
      } else if (this.fade <= 0 && this.fadeDir < 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 28);
    if (!this.paused) this.scene?.update?.(dt, this);
  }

  draw() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      g.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake
      );
    }
    this.scene?.draw?.(g, this);
    if (this.fade > 0) {
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.globalAlpha = this.fade;
      g.fillStyle = this.fadeColor;
      g.fillRect(0, 0, this.w, this.h);
      g.globalAlpha = 1;
    }
  }
}
