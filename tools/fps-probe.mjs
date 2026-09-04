// Per-scene frame-rate probe. Boots the game, drops into each scene, sprays
// input to get particles flying, then measures frames over a fixed window.
//
//   node tools/fps-probe.mjs

import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const PORT = 8138;
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

const measure = () => page.evaluate(async () => {
  let n = 0;
  const t0 = performance.now();
  await new Promise((ok) => {
    const f = () => (++n < 100 ? requestAnimationFrame(f) : ok());
    requestAnimationFrame(f);
  });
  const s = window.game.engine.scene;
  return { fps: Math.round((n * 1000) / (performance.now() - t0)), particles: s?.p?.live ?? 0 };
});

const spray = async (n = 12) => {
  for (let i = 0; i < n; i++) {
    await page.mouse.click(200 + Math.random() * 760, 200 + Math.random() * 460);
    await page.waitForTimeout(60);
  }
};

console.log('hub          ', await measure());
for (const id of ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean']) {
  await page.evaluate((s) => window.game.goScene(s), id);
  await page.waitForTimeout(900);
  const idle = await measure();
  await spray();
  const busy = await measure();
  console.log(`${id.padEnd(13)} idle ${String(idle.fps).padStart(3)}fps   busy ${String(busy.fps).padStart(3)}fps (${busy.particles} particles)`);
}

await b.close();
server.close();
