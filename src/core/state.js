// Saved progress.
//
// The only "progression" in the game is a sticker album that fills up. There is
// no score to lose and nothing to fail, which is the point: a two year old comes
// back because the album is nearly full, not because a number went up.

const KEY = 'emi-world-v1';

const fresh = () => ({
  stars: 0,
  stickers: {},   // creature / prop id -> times found
  plays: {},      // scene id -> visits
  muted: false,
  best: {},
  seen: false,
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return Object.assign(fresh(), JSON.parse(raw));
  } catch {
    return fresh();
  }
}

export const state = load();

let saveTimer = 0;
export function save() {
  // Batched: scenes call this on every star, and a tablet does not need a
  // synchronous write forty times a minute.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* private mode - the game still works, it just forgets */ }
  }, 400);
}

export function addStar(n = 1) {
  state.stars += n;
  save();
  return state.stars;
}

export function collect(id) {
  state.stickers[id] = (state.stickers[id] || 0) + 1;
  save();
  return state.stickers[id];
}

export function visited(scene) {
  state.plays[scene] = (state.plays[scene] || 0) + 1;
  save();
}

export const stickerCount = () => Object.keys(state.stickers).length;
