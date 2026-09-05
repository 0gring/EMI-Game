// Entry point. Wires the engine, audio and scenes together.

import { Engine } from './core/engine.js';
import { AudioBus, Music } from './core/audio.js';
import { state, visited } from './core/state.js';
import { TitleScene } from './scenes/title.js';
import { HubScene } from './scenes/hub.js';
import { BalloonScene } from './scenes/balloons.js';
import { AnimalScene } from './scenes/animals.js';
import { MusicScene } from './scenes/music.js';
import { ShapeScene } from './scenes/shapes.js';
import { PaintScene } from './scenes/paint.js';
import { OceanScene } from './scenes/ocean.js';

const SCENES = {
  balloons: BalloonScene,
  animals: AnimalScene,
  music: MusicScene,
  shapes: ShapeScene,
  paint: PaintScene,
  ocean: OceanScene,
};

// Extra instruments each activity wants. The first two are loaded up front;
// these stream in the background the first time she opens the activity, so the
// initial download stays small.
const SCENE_INSTRUMENTS = {
  music: ['piano', 'flute'],
  animals: ['piano', 'flute'],
  ocean: ['flute'],
  paint: ['flute'],
};

class Game {
  constructor() {
    // Exposed so a parent (or a test) can inspect progress from the console.
    this.state = state;
    this.canvas = document.getElementById('stage');
    this.engine = new Engine(this.canvas);
    this.audio = new AudioBus('');
    this.music = new Music(this.audio);
    this.loaded = new Set();

    // Any touch is a chance to get sound back: browsers suspend the audio
    // context whenever they feel like it, and a silent game reads as broken.
    this.engine.onAnyTouch = () => this.audio.resume();

    this.engine.onVisibility = (hidden) => {
      if (hidden) this.music.stop();
      else {
        this.audio.resume();
        this.music.play(this.engine.scene?.musicName || 'hub');
      }
    };

    this.engine.setScene(new TitleScene(this));
    this.engine.start();

    // Music has to be re-scheduled every frame, and it must keep running even
    // while a scene is mid-transition.
    const pump = () => {
      this.music.update();
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  }

  goHub() {
    this.engine.go(new HubScene(this), '#fff8e7');
  }

  goScene(id) {
    const Cls = SCENES[id];
    if (!Cls) return this.goHub();
    visited(id);
    const extra = SCENE_INSTRUMENTS[id];
    if (extra && !this.loaded.has(id)) {
      this.loaded.add(id);
      extra.forEach((i) => this.audio.loadInstrument(i));
    }
    this.engine.go(new Cls(this), '#ffffff');
  }
}

// A tablet handed to a toddler will get long-pressed, double-tapped, pinched
// and swiped from the edge. Shut all of that down at the document level.
function lockDownBrowser() {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem('emi-world-v1', JSON.stringify(state)); } catch { /* ignore */ }
  });
}

lockDownBrowser();

// Ask for both bundled faces up front. Canvas text does not re-flow when a font
// arrives late, and we repaint every frame anyway, but kicking the load here
// means the title screen is already using the right face.
if (document.fonts) {
  Promise.all([
    document.fonts.load("400 40px 'Secular One'", 'עולם'),
    document.fonts.load("400 40px 'Varela Round'", 'אמי'),
  ]).catch(() => { /* system font is a fine fallback */ });
}

window.game = new Game();

// Offline support, so the game keeps working on a tablet with no signal. The
// single-file build has nothing to cache - it is already one file - and sets a
// flag so it does not go looking for a worker that is not there.
if (!globalThis.__EMI_SINGLE_FILE && 'serviceWorker' in navigator
    && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* fine without it */ });
  });
}
