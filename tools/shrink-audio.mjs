// Build step for the audio, run once and committed.
//
// The instrument samples arrive as long stereo recordings - some harp notes ring
// for nine seconds - which made the first load 6.8MB. The game never needs that
// much tail (the longest note it schedules is about three seconds, and it adds
// its own reverb), and it pans in software, so stereo is wasted too.
//
// So each sample is decoded, downmixed to mono, trimmed to the longest duration
// that instrument is actually asked for, faded out over the last 250ms so the
// cut is inaudible, and re-encoded as mono MP3.
//
//   node tools/shrink-audio.mjs           # report only
//   node tools/shrink-audio.mjs --write   # actually rewrite the files

import decode from 'audio-decode';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const WRITE = process.argv.includes('--write');

// lamejs 1.2.1's module entry point is broken (its internals reference globals
// that the CommonJS build never defines), but the browser bundle is fine. Run
// that in a sandbox and take the encoder from it.
const lame = (() => {
  const sandbox = { console };
  createContext(sandbox);
  runInContext(readFileSync(join(ROOT, 'node_modules/lamejs/lame.min.js'), 'utf8'), sandbox);
  return sandbox.lamejs;
})();

// Longest note each instrument is ever asked to hold, plus headroom. See the
// music sequencer and the animal voices in src/core/audio.js.
const LIMITS = {
  xylophone: { seconds: 2.0, kbps: 112 },
  harp: { seconds: 4.0, kbps: 112 },   // holds the chord beds at 68bpm
  flute: { seconds: 3.0, kbps: 112 },
  piano: { seconds: 3.5, kbps: 112 },
};

const FADE = 0.25;

// audio-decode hands back { channelData: [Float32Array...], sampleRate }.
function toMono(audio) {
  const chans = audio.channelData;
  const n = chans[0].length;
  const out = new Float32Array(n);
  for (const data of chans) {
    for (let i = 0; i < n; i++) out[i] += data[i] / chans.length;
  }
  return out;
}

function trimAndFade(samples, rate, seconds) {
  const keep = Math.min(samples.length, Math.round(rate * seconds));
  const out = samples.subarray(0, keep);
  const fade = Math.min(keep, Math.round(rate * FADE));
  // Only fade if we actually cut something; a note that ended on its own is
  // already silent and does not need shaping.
  if (keep < samples.length) {
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      out[keep - fade + i] *= 1 - k * k;   // gentle, not linear
    }
  }
  return out;
}

function encodeMp3(samples, rate, kbps) {
  const enc = new lame.Mp3Encoder(1, rate, kbps);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const chunks = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(Buffer.from(tail));
  return Buffer.concat(chunks);
}

let beforeTotal = 0;
let afterTotal = 0;
const rows = [];

for (const [inst, cfg] of Object.entries(LIMITS)) {
  const dir = join(ROOT, 'assets', 'instruments', inst);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mp3')).sort();
  for (const f of files) {
    const path = join(dir, f);
    const raw = await readFile(path);
    const audio = await decode(raw);
    const mono = toMono(audio);
    const trimmed = trimAndFade(mono, audio.sampleRate, cfg.seconds);
    const out = encodeMp3(trimmed, audio.sampleRate, cfg.kbps);

    beforeTotal += raw.length;
    afterTotal += out.length;
    rows.push({
      name: `${inst}/${basename(f)}`,
      was: raw.length,
      now: out.length,
      wasSec: audio.channelData[0].length / audio.sampleRate,
      nowSec: trimmed.length / audio.sampleRate,
      ch: audio.channelData.length,
    });
    if (WRITE) await writeFile(path, out);
  }
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
for (const r of rows) {
  console.log(
    `${r.name.padEnd(24)} ${kb(r.was).padStart(7)} -> ${kb(r.now).padStart(7)}` +
    `   ${r.wasSec.toFixed(1)}s -> ${r.nowSec.toFixed(1)}s  ${r.ch}ch -> 1ch`
  );
}
console.log(
  `\n${rows.length} samples: ${kb(beforeTotal)} -> ${kb(afterTotal)} ` +
  `(${(beforeTotal / afterTotal).toFixed(1)}x smaller)`
);
if (!WRITE) console.log('\ndry run - pass --write to rewrite the files');
