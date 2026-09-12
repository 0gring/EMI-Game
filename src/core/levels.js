// Levels.
//
// Each activity has four of them. A level ends when she has done its thing
// enough times - popped eight balloons, found four animals, finished a board -
// and the next one turns the activity up: more on screen, moving a little
// faster, another toy unlocked.
//
// The rule that shapes all of it: a level raises how much there is to DO, never
// how hard it is to SUCCEED. There is no level she can be stuck on, nothing to
// lose, and no way back down. Reaching the end of level four does not close the
// activity; it keeps going at full tilt and every further goal is a celebration.

import { clamp } from './util.js';
import { state, save } from './state.js';

export const MAX_LEVEL = 4;

export class LevelTrack {
  // `goals[i]` is how many times the scene's thing must happen to finish level
  // i + 1. They grow, but gently: the fourth level should be reachable in one
  // sitting, not farmed for.
  constructor(sceneId, goals) {
    this.id = sceneId;
    this.goals = goals;
    if (!state.levels) state.levels = {};
    this.level = clamp(state.levels[sceneId] || 1, 1, MAX_LEVEL);
    this.done = 0;
    this.justLeveled = 0;   // counts down while the banner is on screen
  }

  get goal() {
    return this.goals[Math.min(this.level, MAX_LEVEL) - 1];
  }

  get progress() {
    return clamp(this.done / this.goal, 0, 1);
  }

  // True on the frame a level is completed. The scene reacts by celebrating and
  // re-reading its own difficulty.
  add(n = 1) {
    this.done += n;
    if (this.done < this.goal) return false;
    this.done = 0;
    this.maxedOut = this.level >= MAX_LEVEL;
    if (!this.maxedOut) {
      this.level++;
      state.levels[this.id] = this.level;
      save();
    }
    this.justLeveled = 2.6;
    return true;
  }

  update(dt) {
    if (this.justLeveled > 0) this.justLeveled = Math.max(0, this.justLeveled - dt);
  }

  // Picks this level's entry out of a table of four. Scenes keep their tuning in
  // one readable table rather than scattering `if (level > 2)` through the code.
  pick(table) {
    return table[Math.min(this.level, MAX_LEVEL) - 1];
  }
}

// How far each activity has been taken, for the map.
export const levelOf = (id) => clamp(state.levels?.[id] || 1, 1, MAX_LEVEL);
