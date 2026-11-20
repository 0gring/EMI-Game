// Renders the Magic Island app icon from the game's own artwork - the same
// island, castle, palms and rainbow she sees on the title screen - at every size
// Android and the web app want.
//
//   PW_CHROMIUM=/path/to/chrome node tools/make-island-icons.mjs

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const RES = join(ROOT, 'android/app/src/main/res');
const PORT = 8900 + Math.floor(Math.random() * 90);

const server = spawn(process.execPath, [join(ROOT, 'tools/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/adventure.html`);
await page.waitForFunction(() => !!window.game);

// shape: 'square' (full bleed), 'rounded', 'circle'
const render = (size, shape) => page.evaluate(async ({ size, shape }) => {
  const S = await import('/src/adventure/scenery.js');
  const G = await import('/src/core/gfx.js');
  const A = await import('/src/adventure/art.js');
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size;
  if (shape !== 'square') {
    g.beginPath();
    if (shape === 'circle') g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    else G.roundRect(g, 0, 0, s, s, s * 0.2);
    g.clip();
  }
  g.fillStyle = G.verticalGradient(g, 0, s * 0.62, S.ISLAND_SKY);
  g.fillRect(0, 0, s, s);
  G.rainbow(g, s * 0.5, s * 0.64, s * 0.36, s * 0.035, 0.75);
  G.sun(g, s * 0.8, s * 0.2, s * 0.07, 0);
  g.fillStyle = G.verticalGradient(g, s * 0.62, s, ['#5ec8ef', '#3aa7dc', '#2f8fd0']);
  g.fillRect(0, s * 0.62, s, s * 0.38);
  S.paintIsland(g, s * 0.5, s * 0.7, s * 0.4, s * 0.12);
  S.palm(g, s * 0.22, s * 0.72, s * 0.15, 1);
  S.palm(g, s * 0.79, s * 0.73, s * 0.13, -1);
  S.castle(g, s * 0.5, s * 0.69, s * 0.34);
  for (const [x, y, r] of [[0.2, 0.22, 0.05], [0.32, 0.12, 0.03], [0.68, 0.38, 0.035]]) A.twinkle(g, s * x, s * y, s * r, '#ffffff');
  return c.toDataURL('image/png');
}, { size, shape });

const save = async (file, size, shape) => {
  const url = await render(size, shape);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${size}px ${shape}  ${file.replace(ROOT + '/', '')}`);
};

const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  await save(join(RES, `mipmap-${d}/ic_launcher.png`), Math.round(48 * k), 'rounded');
  await save(join(RES, `mipmap-${d}/ic_launcher_round.png`), Math.round(48 * k), 'circle');
  // Adaptive icon layer: 108dp, full bleed - the launcher picks the mask.
  await save(join(RES, `mipmap-${d}/ic_launcher_foreground.png`), Math.round(108 * k), 'square');
}
await save(join(RES, 'drawable/splash_icon.png'), 512, 'rounded');
await save(join(ROOT, 'assets/island-192.png'), 192, 'rounded');
await save(join(ROOT, 'assets/island-512.png'), 512, 'square');

await browser.close();
server.kill();
