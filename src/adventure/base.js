// Base class for the island's places: the shared scene behaviour, plus the
// magic layer's light on every success - a glowing burst for a small win,
// fireworks for a finished round, a whole sky of them for a new level.

import { SceneBase } from '../core/ui.js';

export class IslandBase extends SceneBase {
  reward(x, y, opts = {}) {
    super.reward(x, y, opts);
    const magic = this.game.magic;
    if (!magic) return;
    magic.burst(x, y, { power: opts.big ? 1.25 : 0.75, n: opts.big ? 48 : 28 });
    if (opts.big) magic.fireworks(4);
  }

  celebrateLevel(e) {
    super.celebrateLevel(e);
    this.game.magic?.fireworks(9);
  }
}
