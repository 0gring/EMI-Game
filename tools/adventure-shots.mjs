// Walks Emi's Magic Island in a real browser: boots it, opens every activity
// at a tablet and a phone size, plays a little in each, screenshots the lot
// into tools/shots/adventure/ and fails on any console or page error.
//
//   node tools/adventure-shots.mjs            multi-file build
//   node tools/adventure-shots.mjs --bundle   dist/emi-adventure.html

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'tools/shots/adventure');
const PORT = 8000 + Math.floor(Math.random() * 900);
const BUNDLE = process.argv.includes('--bundle');
await mkdir(OUT, { recursive: true });

const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 600));

// PW_CHROMIUM points at a browser binary when the one Playwright expects is absent.
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
const SIZES = [
  { name: 'tablet', width: 1280, height: 800 },
  { name: 'phone', width: 412, height: 860 },
];
const SCENES = ['cake', 'puzzle', 'memory', 'feed', 'coloring', 'garden'];

// Runs inside the page: completes one round of the current scene by calling
// the same methods a finger would reach.
const PLAY = async (id) => {
  const e = window.game.engine;
  const sc = e.scene;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tap = (x, y) => {
    const p = { id: 999, x, y, px: x, py: y, startX: x, startY: y, moved: 0, data: null };
    sc.onDown(p, e);
    sc.onUp?.(p, e);
  };
  if (id === 'cake') {
    while (sc.step !== 'sponge') await wait(50);
    sc.choose(sc.choices[1], e);
    while (sc.step !== 'icing') await wait(50);
    sc.choose(sc.choices[2], e);
    while (sc.step !== 'decorate') await wait(50);
    for (let i = 0; i < sc.tune.need; i++) {
      const c = sc.choices[i % (sc.choices.length - 1)];
      tap(c.x, c.y);
      await wait(80);
    }
    while (sc.step !== 'candles' || sc.candles.some((c) => c.lit < 1)) await wait(50);
    for (const c of sc.candles) tap(c.x, c.y - c.h * 1.2);
  } else if (id === 'puzzle') {
    for (const pc of [...sc.pieces]) {
      const p = { id: 7, x: pc.x, y: pc.y, moved: 0, data: null };
      sc.onDown(p, e);
      p.x = pc.hx; p.y = pc.hy;
      sc.onMove(p, e);
      sc.onUp(p, e);
    }
  } else if (id === 'memory') {
    while (sc.locked) await wait(50);
    const seen = new Set();
    for (const c of sc.cards) {
      if (seen.has(c.a)) continue;
      seen.add(c.a);
      for (const k of sc.cards.filter((x) => x.a === c.a)) tap(k.x, k.y);
      await wait(600);
    }
  } else if (id === 'feed') {
    while (sc.walk < 1 || sc.bubble.target !== 1) await wait(50);
    for (let i = 0; i < sc.want; i++) {
      const f = sc.foods.find((k) => !k.gone);
      tap(f.x, f.y);
      await wait(60);
    }
  } else if (id === 'coloring') {
    for (const r of sc.regions) {
      sc.fill(r, 50, 50, { x: e.cx, y: e.cy }, e);
      sc.sel = (sc.sel + 1) % sc.paints.length;
    }
  } else if (id === 'garden') {
    for (let k = 0; k < 4; k++) {
      for (const pl of sc.plots) sc.growUp(pl, e);
    }
  }
};

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, hasTouch: true });
  // A 404 is reported by URL below; the console line for it carries none.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${size.name}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${size.name}: ${r.status()} ${r.url()}`); });
  page.on('pageerror', (err) => errors.push(`${size.name}: ${err.message} ${(err.stack || '').split('\n').slice(1, 4).join(' | ')}`));
  const url = BUNDLE ? `http://127.0.0.1:${PORT}/dist/emi-adventure.html` : `http://127.0.0.1:${PORT}/adventure.html`;
  await page.goto(url);
  await page.waitForFunction(() => !!window.game);
  await page.mouse.click(size.width / 2, size.height / 2);
  await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${size.name}-title.png`) });
  await page.evaluate(() => window.game.goHub());
  await page.waitForFunction(() => window.game.engine.scene?.nodes, null, { timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, `${size.name}-island.png`) });

  for (const id of SCENES) {
    await page.evaluate((s) => window.game.goScene(s), id);
    await page.waitForFunction((s) => window.game.engine.scene?.id === s && !window.game.engine.next, id, { timeout: 8000 });
    await page.waitForTimeout(900);
    // play a little: a handful of taps across the screen, so every scene's
    // touch handling runs at least once
    for (let i = 0; i < 8; i++) {
      await page.mouse.click(size.width * (0.15 + (i % 4) * 0.23), size.height * (0.3 + Math.floor(i / 4) * 0.4));
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `${size.name}-${id}.png`) });
    // Then finish a round through the scene's own handlers, so every
    // completion path - reward, level score, next round - runs for real.
    const before = await page.evaluate(() => window.game.state.stars);
    await page.evaluate(PLAY, id);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(OUT, `${size.name}-${id}-done.png`) });
    const after = await page.evaluate(() => window.game.state.stars);
    if (!(after > before)) errors.push(`${size.name}: finishing ${id} awarded no stars (${before} -> ${after})`);
  }
  await page.close();
}

await browser.close();
server.kill();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`ok - screenshots in ${OUT}`);
