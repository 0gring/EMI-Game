// Measures whether the audio output actually clips.
//
// Crackle in a web game is nearly always samples running past full scale and
// being hard-clipped by the sound card. Guessing at that is a waste of time, so
// this renders the game's real audio graph in an OfflineAudioContext, fires the
// worst bursts the game can produce, and counts the samples that came back over
// full scale.
//
//   node tools/audio-headroom.mjs

import pkg from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const { chromium } = pkg;
const ROOT = resolve(import.meta.dirname, '..');
const PORT = 8146;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
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

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext()).newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => !!window.game);
await page.mouse.click(400, 500);
await page.waitForFunction(() => window.game.engine.scene?.phase === 'ready', null, { timeout: 30000 });
// The music scene's instruments are loaded on demand; the measurement needs them.
await page.evaluate(async () => {
  await Promise.all([window.game.audio.loadInstrument('piano'), window.game.audio.loadInstrument('flute')]);
});

const scenarios = await page.evaluate(async () => {
  const live = window.game.audio;

  // Rebuild the exact same graph on an offline context and hand it the buffers
  // the live bus already decoded.
  async function render(fire, seconds = 4) {
    const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
    const { AudioBus } = window.__emiAudioModule;
    const bus = new AudioBus('');
    bus.init(off);
    for (const [k, v] of live.sfx) bus.sfx.set(k, v);
    for (const [k, v] of live.inst) bus.inst.set(k, v.slice());
    fire(bus);
    const rendered = await off.startRendering();

    let peak = 0;
    let clipped = 0;
    let total = 0;
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const d = rendered.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        if (v >= 1) clipped++;
        total++;
      }
    }
    return { peak, clipped, clippedPct: (clipped / total) * 100 };
  }

  const out = {};

  // A single tap: the quietest thing the game does.
  out['one tap'] = await render((b) => b.play('pop', { throttle: 0 }));

  // A toddler mashing the xylophone with both hands.
  out['mashing the keyboard'] = await render((b) => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    for (let i = 0; i < 24; i++) {
      b.note('xylophone', notes[i % 8], { vol: 0.85, when: b.ctx.currentTime + i * 0.04 });
      b.play('tap', { throttle: 0 });
    }
  });

  // A big reward: fanfare plus an arpeggio plus a burst of pops, all at once.
  out['a big reward'] = await render((b) => {
    b.play('fanfare', { throttle: 0 });
    b.arp('xylophone', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], { step: 0.06, vol: 0.75 });
    for (let i = 0; i < 8; i++) b.play('pop', { throttle: 0, vol: 0.85 });
  });

  // The worst case the voice cap allows: everything firing on the same sample.
  out['everything at once'] = await render((b) => {
    const names = ['pop', 'success', 'reward', 'bonus', 'levelup', 'fanfare', 'chime', 'badge'];
    names.forEach((n) => b.play(n, { throttle: 0, vol: 0.9 }));
    ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6'].forEach((n) => {
      b.note('harp', n, { vol: 0.9 });
      b.note('piano', n, { vol: 0.9 });
    });
  });

  return out;
});

console.log('\n  scenario                  peak      clipped samples');
console.log('  ' + '-'.repeat(52));
for (const [name, r] of Object.entries(scenarios)) {
  const flag = r.clipped > 0 ? '  <-- CRACKLE' : '';
  console.log(
    `  ${name.padEnd(24)} ${r.peak.toFixed(3).padStart(6)}    ` +
    `${String(r.clipped).padStart(7)} (${r.clippedPct.toFixed(3)}%)${flag}`
  );
}

const worst = Math.max(...Object.values(scenarios).map((r) => r.peak));
console.log(`\n  worst peak ${worst.toFixed(3)} (1.000 is full scale; anything above is clipped)\n`);

await browser.close();
server.close();
