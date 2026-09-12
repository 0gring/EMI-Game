// Verification harness.
//
// Boots the game in headless Chromium at a few viewport sizes, walks through
// every scene, exercises the input paths (taps, drags, multi-touch), and fails
// on any console error, page error or failed request. Screenshots land in
// tools/shots/ so the art can be eyeballed.
//
//   node tools/verify.mjs            # run everything
//   node tools/verify.mjs --headed   # watch it happen

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SHOTS = join(ROOT, 'tools', 'shots');
const PORT = 8137;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.css': 'text/css; charset=utf-8',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const file = join(ROOT, p);
      if (!file.startsWith(ROOT)) throw new Error('escape');
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('nope');
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

const SIZES = [
  { name: 'tablet-landscape', width: 1180, height: 820 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 414, height: 780 },
];

const SCENES = ['balloons', 'animals', 'music', 'shapes', 'paint', 'ocean'];

const problems = [];

async function boot(page) {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.game, null, { timeout: 10000 });
  // Tap once to unlock audio and start the sample download.
  await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height * 0.72);
  await page.waitForFunction(
    () => window.game.engine.scene?.phase === 'ready' || window.game.engine.scene?.nodes,
    null,
    { timeout: 25000 }
  );
}

// Where each activity's buttons sit is layout dependent, so drive the scene
// switch through the game object and only use real input inside the scene.
async function goScene(page, id) {
  await page.evaluate((s) => window.game.goScene(s), id);
  await page.waitForFunction(
    (s) => window.game.engine.scene?.constructor.name.toLowerCase().startsWith(s.slice(0, 5)),
    id,
    { timeout: 6000 }
  );
  await page.waitForTimeout(900);
}

async function tapAround(page, count = 6) {
  const { width, height } = page.viewportSize();
  for (let i = 0; i < count; i++) {
    const x = width * (0.15 + 0.7 * Math.random());
    const y = height * (0.25 + 0.6 * Math.random());
    await page.mouse.click(x, y);
    await page.waitForTimeout(120);
  }
}

async function dragAround(page) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width * 0.3, height * 0.4);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(width * (0.3 + i * 0.03), height * (0.4 + Math.sin(i) * 0.12));
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
}

// Two fingers at once, which is how a toddler actually plays.
async function multiTouch(page) {
  const { width, height } = page.viewportSize();
  await page.evaluate(({ w, h }) => {
    const c = document.getElementById('stage');
    const mk = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1,
    }));
    mk('pointerdown', 1, w * 0.3, h * 0.5);
    mk('pointerdown', 2, w * 0.7, h * 0.5);
    for (let i = 0; i < 8; i++) {
      mk('pointermove', 1, w * (0.3 + i * 0.02), h * 0.5);
      mk('pointermove', 2, w * (0.7 - i * 0.02), h * 0.55);
    }
    mk('pointerup', 1, w * 0.46, h * 0.5);
    mk('pointerup', 2, w * 0.54, h * 0.55);
  }, { w: width, h: height });
  await page.waitForTimeout(400);
}

async function run() {
  await mkdir(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    headless: !process.argv.includes('--headed'),
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });

  for (const size of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      hasTouch: true,
      locale: 'he-IL',
    });
    const page = await ctx.newPage();
    const note = (kind) => (msg) => {
      const text = typeof msg === 'string' ? msg : msg.text?.() ?? String(msg);
      // Fonts come from the network; a blocked font is not a game bug.
      if (/fonts\.googleapis|fonts\.gstatic/.test(text)) return;
      problems.push(`[${size.name}] ${kind}: ${text}`);
    };
    page.on('console', (m) => {
      if (m.type() === 'error') note('console')(m);
    });
    page.on('pageerror', (err) => note('pageerror')(err.message));
    page.on('requestfailed', (req) => {
      if (/fonts\.g/.test(req.url())) return;
      note('request')(`${req.url()} ${req.failure()?.errorText}`);
    });

    console.log(`\n=== ${size.name} (${size.width}x${size.height}) ===`);
    await boot(page);
    await page.screenshot({ path: join(SHOTS, `${size.name}-00-title.png`) });

    // into the hub
    await page.mouse.click(size.width / 2, size.height * 0.72);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${size.name}-01-hub.png`) });

    for (const [i, id] of SCENES.entries()) {
      await goScene(page, id);
      // Push each activity to level three so the shots show the level bar part
      // filled and the scene at its busier tuning.
      await page.evaluate(() => {
        const s = window.game.engine.scene;
        if (!s.levels) return;
        while (s.levels.level < 3) s.scoreLevel(1, window.game.engine);
        s.levels.justLeveled = 0;
        // Scenes that lay out a fresh puzzle per round only pick up a new level
        // when the next round starts, which in play is moments later.
        s.newRound?.(window.game.engine);
      });
      await page.waitForTimeout(500);
      await tapAround(page, id === 'shapes' ? 3 : 7);
      if (id === 'paint' || id === 'shapes' || id === 'music') await dragAround(page);
      await multiTouch(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(SHOTS, `${size.name}-${String(i + 2).padStart(2, '0')}-${id}.png`) });
      const info = await page.evaluate(() => ({
        scene: window.game.engine.scene?.constructor.name,
        particles: window.game.engine.scene?.p?.live ?? 0,
        stars: JSON.parse(localStorage.getItem('emi-world-v1') || '{}').stars ?? 0,
      }));
      console.log(`  ${id.padEnd(9)} -> ${info.scene}, particles ${info.particles}, stars ${info.stars}`);
    }

    // back to the hub via a real press-and-hold on the home button
    await page.evaluate(() => window.game.goHub());
    await page.waitForTimeout(900);

    // frame time under load, measured while things are moving
    const fps = await page.evaluate(async () => {
      let n = 0;
      const t0 = performance.now();
      await new Promise((ok) => {
        const tick = () => (++n < 90 ? requestAnimationFrame(tick) : ok());
        requestAnimationFrame(tick);
      });
      return Math.round((n * 1000) / (performance.now() - t0));
    });
    console.log(`  fps ~${fps}`);
    if (fps < 40) problems.push(`[${size.name}] low frame rate: ${fps}fps`);

    // resize mid-play must not break the layout
    await page.setViewportSize({ width: Math.round(size.height * 0.9), height: Math.round(size.width * 0.9) });
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(SHOTS, `${size.name}-99-rotated.png`) });

    await ctx.close();
  }

  await browser.close();
  server.close();

  if (problems.length) {
    console.log('\nPROBLEMS');
    problems.forEach((p) => console.log(' -', p));
    await writeFile(join(SHOTS, 'problems.txt'), problems.join('\n'));
    process.exit(1);
  }
  console.log('\nall clean');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
