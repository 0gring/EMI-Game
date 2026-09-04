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
      res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
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
    sampleRate: a.ctx.sampleRate,
  };
});
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
  // six in a row should cross a reward threshold
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
