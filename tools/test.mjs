// Functional tests: drive the real game in Chromium and assert on its state.
//
// These cover the things a screenshot cannot show - that the samples actually
// decoded, that a pop awards a star, that a shape snaps home, that the song mode
// cannot be failed, and that the home button needs a deliberate hold.
//
//   node tools/test.mjs

import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const PORT = 8142;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` - ${detail}` : ''}`);
};

// `--bundle` runs the exact same checks against the single-file build, so the
// distributed copy is verified rather than assumed.
const BUNDLE = process.argv.includes('--bundle');

const server = await new Promise((ok) => {
  const s = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      if (BUNDLE && p === '/index.html') p = '/dist/emi-world.html';
      const body = await readFile(join(ROOT, p));
      const headers = { 'content-type': TYPES[extname(p)] || 'application/octet-stream' };
      // The single file gets published into a sandbox with a strict policy, so
      // test it under one. connect-src 'none' is the part that matters: it stops
      // the page reaching the network - including, less obviously, fetch() on a
      // data: URL, which is how the inlined samples used to be read.
      if (BUNDLE) {
        headers['content-security-policy'] =
          "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'";
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  s.listen(PORT, () => ok(s));
});

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 780 }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
const requested = [];
page.on('request', (r) => requested.push(r.url()));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game);
await page.mouse.click(550, 580);   // unlock audio, start loading
await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 30000 });

// --- audio -----------------------------------------------------------------

const audio = await page.evaluate(() => {
  const a = window.game.audio;
  const durations = [...a.sfx.values()].map((b) => b.duration);
  const inst = {};
  for (const [k, v] of a.inst) inst[k] = { count: v.length, dur: v[0]?.buffer.duration ?? 0 };
  return {
    ctxState: a.ctx.state,
    sfx: a.sfx.size,
    minDur: Math.min(...durations),
    maxDur: Math.max(...durations),
    inst,
    failed: a.failed,
    sampleRate: a.ctx.sampleRate,
  };
});
// The bug this guards: under a strict CSP every sample failed to load, each
// failure was swallowed, and the game ran perfectly and completely silent.
check('no sample failed to load', audio.failed === 0, `${audio.failed} failed`);
check('sound effect library decoded', audio.sfx === 28, `${audio.sfx} files`);
check('every effect has audible length', audio.minDur > 0.02 && audio.maxDur < 6,
  `${audio.minDur.toFixed(2)}s - ${audio.maxDur.toFixed(2)}s`);
check('xylophone samples decoded', audio.inst.xylophone?.count === 8, `${audio.inst.xylophone?.count} notes`);
check('harp samples decoded', audio.inst.harp?.count === 14, `${audio.inst.harp?.count} notes`);
check('instrument samples are real recordings', (audio.inst.harp?.dur ?? 0) > 0.3,
  `first harp note ${audio.inst.harp?.dur.toFixed(2)}s`);

// Notes pick the nearest sampled pitch and shift from there.
const pitch = await page.evaluate(() => {
  const a = window.game.audio;
  const list = a.inst.get('xylophone');
  const pick = (midi) => {
    let best = list[0], bd = Math.abs(best.midi - midi);
    for (const s of list) { const d = Math.abs(s.midi - midi); if (d < bd) { bd = d; best = s; } }
    return { from: best.midi, rate: Math.pow(2, (midi - best.midi) / 12) };
  };
  return { c5: pick(72), between: pick(74) };
});
check('note nearest-sample lookup is exact when sampled', Math.abs(pitch.c5.rate - 1) < 1e-9,
  `rate ${pitch.c5.rate.toFixed(4)}`);
check('note between samples is pitch-shifted', pitch.between.rate > 1 && pitch.between.rate < 1.3,
  `rate ${pitch.between.rate.toFixed(4)}`);

// Playing sounds must not throw and must respect the voice cap.
const voices = await page.evaluate(async () => {
  const a = window.game.audio;
  let threw = null;
  try {
    for (let i = 0; i < 60; i++) {
      a.play('pop', { throttle: 0 });
      a.note('xylophone', 60 + i, { vol: 0.1, dur: 0.2 });
      a.voice({ inst: 'harp', note: 'C5', dur: 0.3, bend: [[0, 0.8], [0.3, 1.2]] });
    }
  } catch (err) { threw = String(err); }
  return { threw, voices: a._voices };
});
check('mashing does not throw in the audio graph', voices.threw === null, voices.threw || '');
check('voice cap holds under mashing', voices.voices <= 30, `${voices.voices} live voices`);

// Output must never leave the graph above full scale: samples past 1.0 are
// hard-clipped by the sound card, which is heard as crackle. Rendering the real
// graph offline is the only way to know rather than hope.
const headroom = await page.evaluate(async () => {
  const live = window.game.audio;
  const { AudioBus } = window.__emiAudioModule;
  const off = new OfflineAudioContext(2, 44100 * 4, 44100);
  const bus = new AudioBus('');
  bus.init(off);
  for (const [k, v] of live.sfx) bus.sfx.set(k, v);
  for (const [k, v] of live.inst) bus.inst.set(k, v.slice());

  // Everything the game can fire on one millisecond, at once.
  ['pop', 'success', 'reward', 'bonus', 'levelup', 'fanfare', 'chime', 'badge']
    .forEach((n) => bus.play(n, { throttle: 0, vol: 0.9 }));
  ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6'].forEach((n) => {
    bus.note('harp', n, { vol: 0.9 });
    bus.note('xylophone', n, { vol: 0.9 });
  });

  const out = await off.startRendering();
  let peak = 0;
  let clipped = 0;
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      if (v >= 1) clipped++;
    }
  }
  return { peak, clipped };
});
check('the loudest possible moment does not clip', headroom.clipped === 0,
  `peak ${headroom.peak.toFixed(3)}, ${headroom.clipped} clipped samples`);

// --- music engine ----------------------------------------------------------

const music = await page.evaluate(async () => {
  const m = window.game.music;
  m.play('hub');
  const first = m.nextTime;
  m.update();
  await new Promise((r) => setTimeout(r, 250));
  m.update();
  return { playing: m.playing, advanced: m.nextTime > first, step: m.step };
});
check('background music schedules ahead', music.playing && music.advanced, `step ${music.step}`);

// --- into the game ---------------------------------------------------------

await page.mouse.click(550, 580);
await page.waitForFunction(() => window.game.engine.scene?.nodes, null, { timeout: 8000 });
check('title leads to the hub', true);

const goto = async (id) => {
  await page.evaluate((s) => window.game.goScene(s), id);
  await page.waitForFunction((s) => {
    const n = window.game.engine.scene?.constructor.name.toLowerCase();
    return n && n.startsWith(s.slice(0, 5));
  }, id, { timeout: 6000 });
  await page.waitForTimeout(400);
};

// balloons: a pop must award pitch, particles and eventually a star
await goto('balloons');
const pop = await page.evaluate(() => {
  const s = window.game.engine.scene;
  const e = window.game.engine;
  const before = window.game.state.stars;
  const b = s.balloons[0];
  b.x = e.w / 2;
  b.y = e.h / 2;
  b.golden = false;
  const hit = (x, y) => {
    const c = document.getElementById('stage');
    c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 90, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
    c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 90, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
  };
  hit(b.x, b.y);
  const popped = s.popped;
  // Six more in a row should cross a reward threshold. How many balloons happen
  // to be floating is up to the spawner, so top the sky up first rather than
  // letting the run depend on timing.
  while (s.balloons.filter((x) => x.pop === 0).length < 8) {
    s.balloons.push(new s.balloons[0].constructor(e));
  }
  for (let i = 0; i < 6; i++) {
    const n = s.balloons.find((x) => x.pop === 0);
    if (!n) break;
    n.x = e.w / 2;
    n.y = e.h / 2;
    hit(n.x, n.y);
  }
  return { popped, combo: s.combo, before, after: window.game.state.stars, live: s.p.live };
});
check('tapping a balloon pops it', pop.popped === 1, `popped ${pop.popped}`);
check('popping throws particles', pop.live > 10, `${pop.live} particles`);
check('a streak awards stars', pop.after > pop.before, `${pop.before} -> ${pop.after}`);

// animals: revealing an animal records a sticker and says its name
await goto('animals');
const animal = await page.evaluate(() => {
  const s = window.game.engine.scene;
  const e = window.game.engine;
  const spot = s.spots[0];
  spot.state = 'hidden';
  s.poke(spot, e);
  return {
    state: spot.state,
    word: s.word?.name,
    says: s.word?.says,
    sticker: window.game.state.stickers[spot.animal.id] > 0,
    id: spot.animal.id,
    rise: spot.rise.target,
  };
});
check('poking a hiding place reveals an animal', animal.state === 'out' && animal.rise === 1);
check('the animal says its Hebrew name', !!animal.word && !!animal.says, `${animal.word} / ${animal.says}`);
check('found animals go into the album', animal.sticker);

// shapes: correct hole snaps, wrong hole is harmless
await goto('shapes');
const shapes = await page.evaluate(() => {
  const s = window.game.engine.scene;
  const c = document.getElementById('stage');
  const send = (type, x, y, id = 91) => c.dispatchEvent(new PointerEvent(type, {
    pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true,
  }));
  // wrong hole first
  const piece = s.pieces[0];
  const wrong = s.holes.find((h) => h.kind !== piece.kind);
  send('pointerdown', piece.x, piece.y);
  send('pointermove', wrong.x, wrong.y);
  send('pointerup', wrong.x, wrong.y);
  const afterWrong = { placed: piece.placed, done: s.done, misses: s.misses };

  // then the right one
  const own = s.holes.find((h) => h.kind === piece.kind);
  send('pointerdown', piece.x, piece.y);
  send('pointermove', own.x, own.y);
  send('pointerup', own.x, own.y);
  const afterRight = { placed: piece.placed, done: s.done, filled: own.filled };

  // a generous drop, well short of the hole, should still count
  const p2 = s.pieces.find((p) => !p.placed);
  const h2 = s.holes.find((h) => h.kind === p2.kind);
  send('pointerdown', p2.x, p2.y, 92);
  send('pointermove', h2.x + s.holeR * 2.2, h2.y + s.holeR * 1.2, 92);
  send('pointerup', h2.x + s.holeR * 2.2, h2.y + s.holeR * 1.2, 92);
  return { afterWrong, afterRight, generous: p2.placed };
});
check('a wrong hole never places the piece', !shapes.afterWrong.placed && shapes.afterWrong.done === 0);
check('a wrong hole costs nothing but a nudge', shapes.afterWrong.misses === 1);
check('the matching hole snaps the piece home', shapes.afterRight.placed && shapes.afterRight.filled);
check('the snap radius forgives a sloppy drop', shapes.generous);

// music: any bar sounds, only the right one advances the song
await goto('music');
const song = await page.evaluate(() => {
  const s = window.game.engine.scene;
  const e = window.game.engine;
  s.mode = 'song';
  s.song = 0;
  s.step = 0;
  const want = s.bars[0];        // first note of the first song is degree 0
  const wrong = s.bars[5];
  s.strike(wrong, e);
  const afterWrong = s.step;
  s.strike(want, e);
  const afterRight = s.step;
  // glissando across every bar must not throw
  let threw = null;
  try { s.bars.forEach((b) => s.strike(b, e, 0.7)); } catch (err) { threw = String(err); }
  return { afterWrong, afterRight, threw, notes: s.notes.length };
});
check('a wrong bar still plays and does not fail the song', song.afterWrong === 0);
check('the right bar advances the song', song.afterRight === 1);
check('dragging across the whole keyboard is safe', song.threw === null, song.threw || '');

// ocean: the chest pays out once, then rattles
await goto('ocean');
const ocean = await page.evaluate(() => {
  const s = window.game.engine.scene;
  const e = window.game.engine;
  const before = window.game.state.stars;
  s.openChest(e);
  const mid = window.game.state.stars;
  s.openChest(e);
  const after = window.game.state.stars;
  const sizes = {};
  s.swimmers.forEach((x) => { sizes[x.spec.id] = x.s; });
  s.runEvent(e);
  return { gain: mid - before, second: after - mid, open: s.chest.open, swimmers: s.swimmers.length };
});
check('the treasure chest pays out', ocean.gain === 5, `+${ocean.gain} stars`);
check('the chest cannot be farmed', ocean.second === 0);
check('scheduled sea events spawn creatures', ocean.swimmers > 4, `${ocean.swimmers} creatures`);

// Progress is written to localStorage, debounced, so a closed tab keeps it.
await page.waitForTimeout(700);
const saved = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('emi-world-v1') || '{}');
  return { stars: raw.stars, live: window.game.state.stars, stickers: Object.keys(raw.stickers || {}).length };
});
check('progress is saved to the device', saved.stars === saved.live && saved.stars > 0,
  `${saved.stars} stars, ${saved.stickers} stickers`);

// paint: strokes land on the layer and survive a resize
await goto('paint');
const paint = await page.evaluate(async () => {
  const s = window.game.engine.scene;
  const c = document.getElementById('stage');
  const send = (type, x, y) => c.dispatchEvent(new PointerEvent(type, {
    pointerId: 93, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true,
  }));
  send('pointerdown', 300, 300);
  for (let i = 0; i < 20; i++) send('pointermove', 300 + i * 12, 300 + Math.sin(i) * 40);
  send('pointerup', 540, 300);
  const ink = () => {
    const d = s.lctx.getImageData(0, 0, s.layer.width, s.layer.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 8) n++;
    return n;
  };
  const drawn = ink();
  window.game.engine.resize();
  s.rebuildLayer(window.game.engine);
  return { drawn, kept: ink(), strokes: s.strokeCount };
});
check('drawing marks the canvas', paint.drawn > 20, `${paint.drawn} inked samples`);
check('a stroke is counted', paint.strokes === 1);
check('artwork survives a relayout', paint.kept > paint.drawn * 0.5, `${paint.kept} kept`);

// --- levels ----------------------------------------------------------------
//
// Every activity has four of them, and each must actually change the activity,
// persist, and never be reachable in a state she could be stuck in.

// A compact fingerprint of whatever knob a scene turns per level.
const TUNE_KEYS = ['cap', 'rise', 'holes', 'colors', 'stamps', 'autoOut', 'song'];

for (const id of ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean']) {
  // Start this activity from scratch so the walk-through is deterministic, and
  // wait for the scene to really be on screen before driving it.
  await page.evaluate((s) => { window.game.state.levels[s] = 1; }, id);
  await goto(id);

  const r = await page.evaluate((keys) => {
    const s = window.game.engine.scene;
    const e = window.game.engine;
    const snap = () => JSON.stringify(keys.map((k) => (s.tune || {})[k]));
    const seen = [];
    let guard = 0;
    // Drive it through the scoring call the scene itself makes, one point at a
    // time, recording the tuning each time a level turns over.
    while (s.levels.level < 4 && guard++ < 400) {
      const before = s.levels.level;
      s.scoreLevel(1, e);
      if (s.levels.level !== before) seen.push(snap());
    }
    // Finishing the top level again must not push past it.
    for (let i = 0; i < s.levels.goal + 2; i++) s.scoreLevel(1, e);
    return {
      scene: s.constructor.name,
      reached: s.levels.level,
      maxed: !!s.levels.maxedOut,
      saved: window.game.state.levels[s.levels.id],
      tunings: seen,
      goals: s.levels.goals,
    };
  }, TUNE_KEYS);

  check(`${id}: climbs to level 4`, r.reached === 4, `${r.scene}, reached ${r.reached}`);
  check(`${id}: level 4 is the ceiling`, r.maxed === true && r.saved === 4,
    `saved ${r.saved}, maxed ${r.maxed}`);
  const distinct = new Set(r.tunings).size;
  check(`${id}: each level really changes the activity`, distinct === r.tunings.length,
    `${r.tunings.length} steps, ${distinct} distinct`);
  check(`${id}: goals stay reachable in one sitting`,
    r.goals.every((g) => g > 0 && g <= 20), r.goals.join(', '));
}

// A level she has reached is still there after closing the game.
await page.reload();
await page.waitForFunction(() => !!window.game);
const persisted = await page.evaluate(() => window.game.state.levels);
check('levels survive closing the game',
  ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean'].every((k) => persisted[k] === 4),
  JSON.stringify(persisted));

// Back in, audio re-unlocked, and into a play scene for the checks below.
await page.mouse.click(550, 580);
await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 30000 });
await page.mouse.click(550, 580);
await page.waitForFunction(() => window.game.engine.scene?.nodes, null, { timeout: 8000 });
await goto('paint');

// --- chrome ----------------------------------------------------------------

const hud = await page.evaluate(async () => {
  const e = window.game.engine;
  const s = e.scene;
  const c = document.getElementById('stage');
  const send = (type, x, y) => c.dispatchEvent(new PointerEvent(type, {
    pointerId: 94, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true,
  }));
  // mute toggle
  const before = window.game.state.muted;
  send('pointerdown', s.hud.muteX, s.hud.muteY);
  send('pointerup', s.hud.muteX, s.hud.muteY);
  await new Promise((r) => setTimeout(r, 60));
  const muted = window.game.audio.muted;
  send('pointerdown', s.hud.muteX, s.hud.muteY);
  send('pointerup', s.hud.muteX, s.hud.muteY);

  // a quick tap on home must NOT leave the activity
  send('pointerdown', s.hud.homeX, s.hud.homeY);
  s.hud.update(0.15);
  send('pointerup', s.hud.homeX, s.hud.homeY);
  const quick = s.hud.update(0.15);

  // a deliberate hold must
  send('pointerdown', s.hud.homeX, s.hud.homeY);
  let fired = false;
  for (let i = 0; i < 12; i++) fired = s.hud.update(0.05) || fired;
  return { before, muted, quickExit: quick, holdExit: fired };
});
check('the speaker button mutes', hud.muted === true);
check('a stray tap on home does not exit', hud.quickExit === false);
check('a deliberate hold on home exits', hud.holdExit === true);

// resize / rotation across every scene
const rotate = await page.evaluate(async () => {
  const out = [];
  for (const id of ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean']) {
    window.game.goScene(id);
    await new Promise((r) => setTimeout(r, 260));
    try {
      window.game.engine.resize();
      const s = window.game.engine.scene;
      s.layout(window.game.engine);
      s.postLayout?.(window.game.engine);
      s.update(0.016, window.game.engine);
      s.draw(window.game.engine.g, window.game.engine);
      out.push([id, 'ok']);
    } catch (err) {
      out.push([id, String(err)]);
    }
  }
  return out;
});
rotate.forEach(([id, r]) => check(`${id} survives a relayout`, r === 'ok', r === 'ok' ? '' : r));

// A shake must not be a bare translate of an opaque canvas that nothing clears:
// that leaves a strip of the previous frame along one edge, and since the
// offset is random per frame the strip flickers like a badly tuned television.
// Poison the buffer, draw one frame at full shake, and insist nothing shows
// through.
const shakeLeak = await page.evaluate(async () => {
  const out = [];
  for (const id of ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean']) {
    window.game.goScene(id);
    await new Promise((r) => setTimeout(r, 260));
    const e = window.game.engine;
    const g = e.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#ff00ff';
    g.fillRect(0, 0, e.canvas.width, e.canvas.height);
    const was = e.shake;
    e.shake = 18;
    e.draw();
    e.shake = was;
    const px = g.getImageData(0, 0, e.canvas.width, e.canvas.height).data;
    let leaked = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 240 && px[i + 1] < 40 && px[i + 2] > 240) leaked++;
    }
    out.push([id, leaked]);
  }
  return out;
});
shakeLeak.forEach(([id, leaked]) =>
  check(`${id} repaints every pixel while shaking`, leaked === 0, `${leaked} px of the previous frame left showing`));

// The whole point of the one-file build is that it needs nothing else. Prove
// it: the document itself should be the only thing the page ever asks for.
if (BUNDLE) {
  const outside = requested.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}/index.html`));
  check('the single file fetches nothing else', outside.length === 0,
    outside.length ? outside.slice(0, 3).join(' | ') : `${requested.length} request`);
}

check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
