// Hunts for the two things a player reads as flicker: frames that take far
// longer than their neighbours (judder), and frames that do not repaint the
// whole canvas (a strip of the previous frame left showing).
//
//   node tools/flicker-probe.mjs

import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const PORT = 8141;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

const server = await new Promise((ok) => {
  const s = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const body = await readFile(join(ROOT, p));
      res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  s.listen(PORT, () => ok(s));
});

const b = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game);
await page.mouse.click(590, 590);
await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 25000 });
await page.mouse.click(590, 590);
await page.waitForTimeout(1200);

// --- judder: frames that take much longer than the ones around them --------

const frameTimes = () => page.evaluate(async () => {
  const gaps = [];
  let last = performance.now();
  await new Promise((ok) => {
    const f = () => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      if (gaps.length < 240) requestAnimationFrame(f); else ok();
    };
    requestAnimationFrame(f);
  });
  gaps.shift();
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    median: +sorted[sorted.length >> 1].toFixed(1),
    p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(1),
    worst: +sorted[sorted.length - 1].toFixed(1),
    over32: gaps.filter((g) => g > 32).length,
    over50: gaps.filter((g) => g > 50).length,
  };
});

const spray = async (n = 14) => {
  for (let i = 0; i < n; i++) {
    await page.mouse.click(200 + Math.random() * 760, 200 + Math.random() * 460);
    await page.waitForTimeout(50);
  }
};

// --- coverage: does a shaken frame repaint every pixel? --------------------
//
// The buffer is poisoned with magenta, then one frame is drawn with the shake
// at full tilt. Any magenta left is a pixel the frame did not cover, which on
// a real screen is a strip of the previous frame showing through.
const shakeCoverage = () => page.evaluate(() => {
  const e = window.game.engine;
  const g = e.g;
  const before = e.shake;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#ff00ff';
  g.fillRect(0, 0, e.canvas.width, e.canvas.height);
  e.shake = 18;
  e.draw();
  e.shake = before;
  const px = g.getImageData(0, 0, e.canvas.width, e.canvas.height).data;
  let leaked = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > 240 && px[i + 1] < 40 && px[i + 2] > 240) leaked++;
  }
  return { leaked, total: px.length / 4 };
});

let worstJudder = 0;
let anyLeak = 0;
for (const id of ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean']) {
  await page.evaluate((s) => window.game.goScene(s), id);
  await page.waitForTimeout(900);
  await spray();
  const t = await frameTimes();
  const c = await shakeCoverage();
  worstJudder = Math.max(worstJudder, t.over32);
  anyLeak += c.leaked;
  console.log(
    `${id.padEnd(9)} median ${String(t.median).padStart(5)}ms  p99 ${String(t.p99).padStart(6)}ms  worst ${String(t.worst).padStart(6)}ms  ` +
    `>32ms ${String(t.over32).padStart(3)}  >50ms ${String(t.over50).padStart(3)}  shake leak ${c.leaked} px`
  );
}

await b.close();
server.close();

console.log(`\nlong frames (worst scene): ${worstJudder}    uncovered shake pixels: ${anyLeak}`);
if (anyLeak > 0) {
  console.log('FAIL: a shaken frame left part of the previous frame showing.');
  process.exitCode = 1;
}
