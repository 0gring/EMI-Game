// Renders assets/icon.svg into the PNG sizes the manifest and iOS ask for.
import pkg from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const svg = await readFile(join(ROOT, 'assets/icon.svg'), 'utf8');
const b = await chromium.launch({ headless: true });
for (const size of [180, 192, 512]) {
  const page = await (await b.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px">${svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)}</body>`);
  const buf = await page.screenshot({ omitBackground: true });
  await writeFile(join(ROOT, `assets/icon-${size}.png`), buf);
  console.log(`icon-${size}.png`, buf.length, 'bytes');
  await page.close();
}
await b.close();
