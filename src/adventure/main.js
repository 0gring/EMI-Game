// Entry point for "האי הקסום של אמי" - Emi's Magic Island.
//
// A second game, for a three year old, built on the same engine as the first:
// same canvas loop, multi-touch, audio graph, particles and save file. What is
// new is everything she sees and does - an island map and six activities that
// ask a little more of her than popping balloons: decorate a cake, put a
// picture back together, find the pairs, count food into a hungry animal, colour
// in a picture, grow a garden.

import { Engine } from '../core/engine.js';
import { AudioBus, Music } from '../core/audio.js';
import { state, visited } from '../core/state.js';
import { TitleScene } from './scenes/title.js';
import { IslandScene } from './scenes/island.js';
import { CakeScene } from './scenes/cake.js';
import { PuzzleScene } from './scenes/puzzle.js';
import { MemoryScene } from './scenes/memory.js';
import { FeedScene } from './scenes/feed.js';
import { ColoringScene } from './scenes/coloring.js';
import { GardenScene } from './scenes/garden.js';

export const SCENES = {
  cake: CakeScene,
  puzzle: PuzzleScene,
  memory: MemoryScene,
  feed: FeedScene,
  coloring: ColoringScene,
  garden: GardenScene,
};

class Game {
  constructor() {
    this.state = state;
    this.canvas = document.getElementById('stage');
    this.engine = new Engine(this.canvas);
    this.audio = new AudioBus('');
    this.music = new Music(this.audio);

    this.engine.onAnyTouch = () => this.audio.resume();
    this.engine.onVisibility = (hidden) => {
      if (hidden) this.music.stop();
      else {
        this.audio.resume();
        this.music.play(this.engine.scene?.musicName || 'island');
      }
    };

    this.engine.setScene(new TitleScene(this));
    this.engine.start();

    const pump = () => {
      this.music.update();
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  }

  goHub() {
    this.engine.go(new IslandScene(this), '#fff4fb');
  }

  goScene(id) {
    const Cls = SCENES[id];
    if (!Cls) return this.goHub();
    visited(id);
    this.engine.go(new Cls(this), '#ffffff');
  }
}

function lockDownBrowser() {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem('emi-world-v1', JSON.stringify(state)); } catch { /* ignore */ }
  });
}

lockDownBrowser();

if (document.fonts) {
  Promise.all([
    document.fonts.load("400 40px 'Secular One'", 'האי'),
    document.fonts.load("400 40px 'Varela Round'", 'אמי'),
  ]).catch(() => { /* system font is a fine fallback */ });
}

window.game = new Game();

// Inside the Android app the system back button would otherwise close the
// whole app the moment a small thumb brushes it. It goes back to the island
// instead, and from the island it does nothing at all.
const capApp = globalThis.Capacitor?.Plugins?.App;
if (capApp?.addListener) {
  capApp.addListener('backButton', () => {
    const scene = window.game.engine.scene;
    if (scene && !(scene instanceof IslandScene) && !(scene instanceof TitleScene)) window.game.goHub();
  });
}

if (!globalThis.__EMI_SINGLE_FILE && 'serviceWorker' in navigator
    && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* fine without it */ });
  });
}
