// Builds a single self-contained HTML file: every module, every sample, every
// font inlined. The result needs no server, no network and no unpacking - one
// file you can open from a USB stick, mail to someone, or publish anywhere.
//
//   node tools/bundle.mjs              -> dist/emi-world.html      (Emi's World)
//   node tools/bundle.mjs --adventure  -> dist/emi-adventure.html  (Emi's Magic Island)

import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'dist');

// Two games share the engine, the samples and the fonts; only the entry point,
// the title and the colour behind the canvas differ.
const GAMES = {
  world: { entry: 'src/main.js', title: 'עולם של אמי', bg: '#8fdcff', out: 'emi-world.html' },
  adventure: { entry: 'src/adventure/main.js', title: 'האי הקסום של אמי', bg: '#ffd6ea', out: 'emi-adventure.html' },
};
const GAME = GAMES[process.argv.includes('--adventure') ? 'adventure' : 'world'];

// --- 1. bundle the game code ------------------------------------------------

const result = await build({
  entryPoints: [join(ROOT, GAME.entry)],
  bundle: true,
  format: 'iife',
  target: ['es2021'],
  minify: true,
  // Scene classes are identified by name at runtime and in the tests.
  keepNames: true,
  legalComments: 'none',
  write: false,
});
const code = result.outputFiles[0].text;

// --- 2. inline every audio sample -------------------------------------------

async function* walk(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const assets = {};
let audioBytes = 0;
for await (const file of walk(join(ROOT, 'assets'))) {
  if (!file.endsWith('.mp3')) continue;
  const buf = await readFile(file);
  audioBytes += buf.length;
  // Keys match the paths the game asks for at runtime.
  assets[relative(ROOT, file)] = `data:audio/mpeg;base64,${buf.toString('base64')}`;
}

// --- 3. inline the fonts ----------------------------------------------------

const fontFace = async (family, file, range) => {
  const buf = await readFile(join(ROOT, 'assets/fonts', file));
  return `@font-face{font-family:'${family}';font-weight:400;font-display:block;` +
    `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');` +
    `unicode-range:${range}}`;
};

const HEBREW = 'U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F';
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2074,U+20AC,U+2212';

const fonts = (await Promise.all([
  fontFace('Varela Round', 'varela-round-hebrew.woff2', HEBREW),
  fontFace('Varela Round', 'varela-round-latin.woff2', LATIN),
  fontFace('Secular One', 'secular-one-hebrew.woff2', HEBREW),
  fontFace('Secular One', 'secular-one-latin.woff2', LATIN),
])).join('');

// --- 4. write the page ------------------------------------------------------
//
// Body content only, no <html>/<head>/<body>: this file is also published as an
// Artifact, which supplies its own document shell.

const html = `<title>${GAME.title}</title>
<style>
${fonts}
html,body{height:100%;width:100%;margin:0;overflow:hidden;background:${GAME.bg};
  font-family:'Varela Round','Arial Hebrew',system-ui,sans-serif;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent;touch-action:none;overscroll-behavior:none}
#stage{display:block;width:100%;height:100%;touch-action:none}
/* Small, in a corner a toddler will not reach for, gone once already full screen. */
#full{position:fixed;right:8px;bottom:8px;z-index:5;border:0;border-radius:999px;
  padding:4px 11px;font:inherit;font-size:11px;font-weight:700;color:#6b5b7a;
  background:rgba(255,255,255,.45);opacity:.42}
#full:active{transform:scale(.95)}
body.fs #full{display:none}
#fallback{position:fixed;inset:0;display:none;place-content:center;text-align:center;
  padding:24px;color:#3b2f4a;font-size:18px}
body.broken #fallback{display:grid}
body.broken #stage{display:none}
</style>

<canvas id="stage"></canvas>
<button id="full" type="button" dir="rtl">מסך מלא</button>
<div id="fallback" dir="rtl">
  <p>הדפדפן הזה לא תומך במשחק.<br>כדאי לנסות Chrome, Safari או Edge מעודכנים.</p>
</div>

<script>
// The document shell is not ours to write when this runs as an Artifact, so set
// the language and direction from here.
document.documentElement.lang = 'he';
document.documentElement.dir = 'rtl';
(function () {
  var c = document.createElement('canvas');
  var ok = !!(c.getContext && c.getContext('2d')) &&
    (window.AudioContext || window.webkitAudioContext) && 'PointerEvent' in window;
  if (!ok) document.body.classList.add('broken');
})();
(function () {
  var btn = document.getElementById('full');
  var target = document.documentElement;
  btn.addEventListener('click', function () {
    var fn = target.requestFullscreen || target.webkitRequestFullscreen;
    if (fn) { try { fn.call(target, { navigationUI: 'hide' }).catch(function () {}); } catch (e) {} }
  });
  function sync() {
    document.body.classList.toggle('fs',
      !!(document.fullscreenElement || document.webkitFullscreenElement));
  }
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  if (window.matchMedia('(display-mode: standalone)').matches) document.body.classList.add('fs');
})();
</script>

<script>window.__EMI_SINGLE_FILE=true;window.__EMI_ASSETS=${JSON.stringify(assets)};</script>
<script>${code}</script>
`;

await mkdir(OUT, { recursive: true });
const outFile = join(OUT, GAME.out);
await writeFile(outFile, html);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
console.log(`code    ${(code.length / 1024).toFixed(0)}KB`);
console.log(`audio   ${mb(audioBytes)} raw -> ${mb(audioBytes * 4 / 3)} base64 (${Object.keys(assets).length} files)`);
console.log(`fonts   ${(fonts.length / 1024).toFixed(0)}KB base64`);
console.log(`\n${relative(ROOT, outFile)}  ${mb(html.length)}`);
