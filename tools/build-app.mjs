// Prepares Emi's Magic Island for the Android app.
//
// The app shows one local page: the standalone single-file build (every
// module, sample and font inlined), wrapped in a proper document. The wrapper
// matters on Android - without a viewport tag the WebView lays the page out
// 980px wide and the whole game comes out tiny.
//
//   node tools/build-app.mjs          -> app/www/index.html, then `cap sync`
//   node tools/build-app.mjs --no-sync   skip the Capacitor sync step

import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WWW = join(ROOT, 'app/www');

execFileSync(process.execPath, [join(ROOT, 'tools/bundle.mjs'), '--adventure'], { stdio: 'inherit' });
const body = await readFile(join(ROOT, 'dist/emi-adventure.html'), 'utf8');

const page = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="light">
<style>#full{display:none!important}</style>
</head>
<body class="fs">
${body}
</body>
</html>
`;

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });
await writeFile(join(WWW, 'index.html'), page);
console.log(`app/www/index.html  ${(page.length / 1024 / 1024).toFixed(2)}MB`);

if (!process.argv.includes('--no-sync')) {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android'], { cwd: ROOT, stdio: 'inherit' });
}
