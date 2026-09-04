// Audio engine.
//
// Two sound sources, both real recordings rather than system beeps:
//   * assets/sfx      - CC0 sound-design one-shots (uisfx, MIT code / CC0 audio)
//   * assets/instruments - CC-BY 3.0 sampled xylophone / harp / flute / piano
//     from nbrosowsky/tonejs-instruments
//
// Only a handful of notes per instrument are sampled, so any note in between is
// produced by pitch-shifting the nearest sample. Everything is routed through a
// convolution reverb and a soft limiter, which is what keeps a hundred taps in a
// row from turning into a harsh mess.

import { clamp, rand, pick } from './util.js';

const NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name) {
  const m = /^([A-G])([#sb]?)(-?\d)$/.exec(name);
  if (!m) return 60;
  let v = NOTE_OFFSET[m[1]];
  if (m[2] === '#' || m[2] === 's') v += 1;
  else if (m[2] === 'b') v -= 1;
  return v + (parseInt(m[3], 10) + 1) * 12;
}

// Scales chosen so that *any* combination of taps sounds consonant. A two year
// old plays by mashing, so the instrument has to be incapable of a wrong note.
export const SCALES = {
  pentatonic: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
  pentatonicHigh: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'],
  major: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  lydian: ['C4', 'D4', 'E4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'],
};

const SFX_NAMES = [
  'pop', 'tap', 'plink', 'success', 'achievement', 'reward', 'bonus', 'levelup',
  'streak', 'start', 'open', 'close', 'swipe', 'snap', 'drop', 'grab', 'check',
  'wake', 'sleep', 'toggle-on', 'toggle-off', 'back', 'badge', 'expand', 'chime',
  'nope', 'boing', 'fanfare',
];

const INSTRUMENTS = {
  xylophone: ['C5', 'C6', 'C7', 'C8', 'G4', 'G5', 'G6', 'G7'],
  harp: ['C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5', 'B5', 'D6', 'F6', 'A6'],
  flute: ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6', 'E6', 'A6'],
  piano: ['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'],
};

export class AudioBus {
  constructor(base = '') {
    this.base = base;
    this.ctx = null;
    this.ready = false;
    this.sfx = new Map();       // name -> AudioBuffer
    this.inst = new Map();      // instrument -> [{midi, buffer}] sorted
    this.pending = new Map();   // url -> Promise
    this.muted = false;
    this.lastPlay = new Map();  // crude per-sound throttle
    this._voices = 0;
  }

  // Must be called from inside a user gesture or mobile browsers keep us silent.
  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.34;

    // A short, bright hall. Sampled instruments straight out of the file sound
    // dry and clinical; a touch of this makes the xylophone sound like a toy in
    // a room instead of a click.
    this.verb = ctx.createConvolver();
    this.verb.buffer = makeImpulse(ctx, 1.9, 2.6);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.5;

    this.sfxGain.connect(this.limiter);
    this.musicGain.connect(this.limiter);
    this.verbGain.connect(this.verb);
    this.verb.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(ctx.destination);

    return ctx;
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.05);
    }
  }

  get time() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  async _load(url) {
    if (this.pending.has(url)) return this.pending.get(url);
    const p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`audio ${res.status} ${url}`);
      const raw = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(raw);
    })();
    this.pending.set(url, p);
    return p;
  }

  // Loads the whole one-shot library plus the instruments a scene asked for.
  // `onProgress` drives the loading screen.
  async preload(instruments = ['xylophone', 'harp'], onProgress) {
    this.init();
    const jobs = [];
    for (const n of SFX_NAMES) {
      jobs.push(
        this._load(`${this.base}assets/sfx/${n}.mp3`)
          .then((b) => this.sfx.set(n, b))
          .catch(() => {})
      );
    }
    for (const inst of instruments) jobs.push(...this._instJobs(inst));

    let done = 0;
    const total = jobs.length;
    await Promise.all(
      jobs.map((j) =>
        j.then(() => {
          done++;
          if (onProgress) onProgress(done / total);
        })
      )
    );
    this.ready = true;
  }

  _instJobs(inst) {
    const notes = INSTRUMENTS[inst];
    if (!notes) return [];
    if (!this.inst.has(inst)) this.inst.set(inst, []);
    const list = this.inst.get(inst);
    return notes.map((n) =>
      this._load(`${this.base}assets/instruments/${inst}/${n}.mp3`)
        .then((b) => {
          list.push({ midi: noteToMidi(n), buffer: b });
          list.sort((a, c) => a.midi - c.midi);
        })
        .catch(() => {})
    );
  }

  // Load in the background; a scene stays playable while its extra instrument
  // streams in, it just falls back to another one until then.
  loadInstrument(inst) {
    if (!this.ctx) this.init();
    return Promise.all(this._instJobs(inst));
  }

  _src(buffer, { vol = 1, rate = 1, pan = 0, when = 0, verb = 0.25, attack = 0, dur = 0, bend = null, offset = 0 } = {}) {
    if (!this.ctx || !buffer) return null;
    if (this._voices > 28) return null; // hard voice cap: mashing stays clean
    const ctx = this.ctx;
    const t = when || ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    // Pitch glide: [[secondsFromStart, rateMultiplier], ...]. This is what
    // turns a flute sample into a bird call and a piano into a cow.
    if (bend) {
      src.playbackRate.setValueAtTime(rate * (bend[0][1] ?? 1), t);
      for (let i = 0; i < bend.length; i++) {
        src.playbackRate.linearRampToValueAtTime(rate * bend[i][1], t + bend[i][0]);
      }
    }

    const g = ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
    } else {
      g.gain.setValueAtTime(vol, t);
    }

    let node = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      node = p;
    }

    src.connect(g);
    node.connect(this.sfxGain);
    if (verb > 0) {
      const vg = ctx.createGain();
      vg.gain.value = verb;
      node.connect(vg);
      vg.connect(this.verbGain);
    }

    if (dur > 0) {
      // gentle release so cutting a note short never clicks
      g.gain.setTargetAtTime(0, t + dur, 0.08);
    }

    this._voices++;
    src.onended = () => {
      this._voices--;
      try { src.disconnect(); g.disconnect(); } catch { /* already gone */ }
    };
    // start() must come before stop(), or Chrome throws.
    src.start(t, offset > 0 ? offset : 0);
    if (dur > 0) src.stop(t + dur + 0.5);
    return src;
  }

  // One-shot sound effect. `spread` adds a little random pitch so the tenth pop
  // in a row does not sound like a stuck key.
  play(name, { vol = 1, rate = 1, spread = 0.06, pan = 0, throttle = 0.035, verb = 0.18 } = {}) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (throttle) {
      const last = this.lastPlay.get(name) || 0;
      if (now - last < throttle) return;
      this.lastPlay.set(name, now);
    }
    const buf = this.sfx.get(name);
    if (!buf) return;
    this._src(buf, { vol, rate: rate * (1 + rand(-spread, spread)), pan, verb });
  }

  // Sampled instrument note. Picks the closest recorded note and pitch-shifts,
  // which is why five samples can cover three octaves.
  note(inst, note, { vol = 0.9, when = 0, dur = 0, pan = 0, verb = 0.4, attack = 0, bend = null, offset = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    let list = this.inst.get(inst);
    if (!list || !list.length) {
      for (const alt of this.inst.values()) if (alt.length) { list = alt; break; }
      if (!list || !list.length) return;
    }
    const midi = typeof note === 'number' ? note : noteToMidi(note);
    let best = list[0];
    let bestD = Math.abs(best.midi - midi);
    for (let i = 1; i < list.length; i++) {
      const d = Math.abs(list[i].midi - midi);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    const rate = Math.pow(2, (midi - best.midi) / 12);
    return this._src(best.buffer, { vol, rate, when, dur, pan, verb, attack, bend, offset });
  }

  // Animal "voices". There are no animal recordings in the asset set, so each
  // call is built by bending a real instrument sample around: a piano dropped
  // two octaves and slid downward reads as a moo, a flute wobbled fast reads as
  // a bird. Toddlers respond to the contour, and it stays in tune with the
  // music instead of fighting it.
  voice(spec) {
    if (this.muted || !this.ctx) return;
    const { inst = 'flute', note = 'C5', dur = 0.5, vol = 0.8, bend, parts } = spec;
    if (parts) {
      const t0 = this.ctx.currentTime + 0.01;
      parts.forEach((p) => {
        this.note(p.inst || inst, p.note || note, {
          vol: (p.vol ?? 1) * vol, dur: p.dur ?? dur, when: t0 + (p.at || 0),
          bend: p.bend || bend, verb: p.verb ?? 0.45, attack: p.attack ?? 0.01,
        });
      });
      return;
    }
    this.note(inst, note, { vol, dur, bend, verb: 0.45, attack: 0.01 });
  }

  // Rising/falling run of notes - the reward flourish used all over the game.
  arp(inst, notes, { step = 0.055, vol = 0.75, dur = 0, verb = 0.5 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.01;
    notes.forEach((n, i) => {
      this.note(inst, n, { vol, when: t0 + i * step, dur, verb, pan: (i / notes.length) * 0.6 - 0.3 });
    });
  }

  glissando(inst, from = 'C4', to = 'C6', count = 12, opts = {}) {
    const a = noteToMidi(from), b = noteToMidi(to);
    const notes = [];
    const scale = [0, 2, 4, 7, 9];
    for (let i = 0; i < count; i++) {
      const m = Math.round(a + ((b - a) * i) / (count - 1));
      const oct = Math.floor(m / 12) * 12;
      notes.push(oct + scale[Math.round(((m - oct) / 12) * 4) % 5]);
    }
    this.arp(inst, notes, opts);
  }

  randomNote(inst, scale = 'pentatonic', opts) {
    return this.note(inst, pick(SCALES[scale]), opts);
  }
}

// --- background music -----------------------------------------------------
//
// The soundtrack is played live from the same instrument samples rather than
// streamed as a big mp3: a few kilobytes of notes give an endless, never quite
// repeating tune, and each scene gets its own arrangement.

const SONGS = {
  hub: {
    bpm: 96, inst: 'harp', bass: 'piano', lead: 'flute',
    chords: [['C3', 'E3', 'G3'], ['A2', 'C3', 'E3'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    melody: ['E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'E5', 'C5', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5'],
  },
  play: {
    bpm: 112, inst: 'harp', bass: 'piano', lead: 'xylophone',
    chords: [['C3', 'G3', 'C4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C3', 'E3', 'G3']],
    melody: ['C5', 'E5', 'G5', 'E5', 'A5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'A5', 'G5'],
  },
  calm: {
    bpm: 68, inst: 'harp', bass: 'harp', lead: 'flute',
    chords: [['C3', 'E3', 'G3'], ['F3', 'A3', 'C4'], ['A2', 'C3', 'E3'], ['G3', 'B3', 'D4']],
    melody: ['G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'G4', 'A4', 'C5', 'D5', 'C5', 'A4', 'G4', 'E4', 'D4', 'E4'],
  },
};

export class Music {
  constructor(bus) {
    this.bus = bus;
    this.song = null;
    this.name = null;
    this.step = 0;
    this.nextTime = 0;
    this.playing = false;
    this.gainTarget = 1;
  }

  play(name) {
    if (!this.bus.ctx) return;
    if (this.name === name && this.playing) return;
    const song = SONGS[name] || SONGS.hub;
    this.song = song;
    this.name = name;
    this.step = 0;
    this.nextTime = this.bus.ctx.currentTime + 0.12;
    this.playing = true;
    this.duck(1);
  }

  stop() {
    this.playing = false;
  }

  // Pull the music down under a big reward sound, then let it back up.
  duck(level = 0.35, seconds = 0.25) {
    if (!this.bus.musicGain) return;
    const t = this.bus.ctx.currentTime;
    const g = this.bus.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.34 * level, t, seconds * 0.4);
    if (level < 1) g.setTargetAtTime(0.34, t + seconds, 0.5);
  }

  // Lookahead scheduler: called every frame, but only ever queues notes that
  // are about to happen, so timing never depends on frame rate.
  update() {
    if (!this.playing || !this.song || !this.bus.ctx) return;
    const ctx = this.bus.ctx;
    const s = this.song;
    const beat = 60 / s.bpm;
    const stepDur = beat / 2; // eighth notes
    const horizon = ctx.currentTime + 0.4;

    while (this.nextTime < horizon) {
      const t = this.nextTime;
      const i = this.step;
      const bar = Math.floor(i / 8) % s.chords.length;
      const chord = s.chords[bar];
      const inBar = i % 8;

      if (inBar === 0) {
        // rolled chord, slightly humanised
        chord.forEach((n, k) =>
          this.bus.note(s.inst, n, {
            vol: 0.3, when: t + k * 0.035, verb: 0.7, dur: beat * 3.4, pan: k * 0.2 - 0.2,
          })
        );
        this.bus.note(s.bass, chord[0], { vol: 0.22, when: t, verb: 0.3, dur: beat * 2 });
      }
      if (inBar === 4) {
        this.bus.note(s.bass, chord[Math.min(2, chord.length - 1)], {
          vol: 0.14, when: t, verb: 0.4, dur: beat,
        });
      }

      // Melody sits on the off-steps and drops a note now and then so the loop
      // does not feel mechanical after the twentieth pass.
      const mi = i % s.melody.length;
      if (inBar % 2 === 0 || (inBar === 3 && Math.random() < 0.5)) {
        if (Math.random() > 0.18) {
          this.bus.note(s.lead, s.melody[mi], {
            vol: 0.2 + Math.random() * 0.08,
            when: t + Math.random() * 0.012,
            verb: 0.65,
            dur: stepDur * 1.6,
            pan: Math.sin(i * 0.7) * 0.35,
          });
        }
      }

      this.step = (i + 1) % (s.melody.length * 4);
      this.nextTime += stepDur;
    }
  }
}

// Noise-burst impulse response. Cheap, and much friendlier than shipping a
// reverb sample nobody can hear the difference in.
function makeImpulse(ctx, seconds = 2, decay = 2.5) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // early reflections thin out over time
      const n = (Math.random() * 2 - 1) * (i < rate * 0.01 ? 1 : 0.7);
      d[i] = n * Math.pow(1 - t, decay);
    }
  }
  return buf;
}
