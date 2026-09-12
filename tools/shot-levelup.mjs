// Captures the level-up moment, which the normal verify pass deliberately skips.
import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = await new Promise((ok) => {
  const s = createServer(async (req, res) => {
    try {
      let p = new URL(req.url, 'http://x').pathname;
      if (p === '/') p = '/index.html';
      const b = await readFile(join(ROOT, p));
      res.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' });
      res.end(b);
    } catch { res.writeHead(404).end(); }
  });
  s.listen(8148, () => ok(s));
});
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
await page.goto('http://127.0.0.1:8148/index.html');
await page.waitForFunction(() => !!window.game);
await page.mouse.click(590, 590);
await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 30000 });
await page.mouse.click(590, 590);
await page.waitForTimeout(1200);
await page.evaluate(() => window.game.goScene('animals'));
await page.waitForTimeout(900);
await page.evaluate(() => {
  const s = window.game.engine.scene;
  while (s.levels.level < 2) s.scoreLevel(1, window.game.engine);
});
await page.waitForTimeout(420);   // catch the banner at full size
await page.screenshot({ path: join(ROOT, 'tools/shots/levelup.png') });
await browser.close();
server.close();
console.log('tools/shots/levelup.png');
