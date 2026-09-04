# Assets and licences

Everything shipped here is open-licensed and redistributable. Nothing in the
game uses system or stock UI sounds.

## Sound effects — `assets/sfx/`

28 hand-picked one-shots from **uisfx** by Romain Simon
(<https://github.com/romainsimon/uisfx>, published on npm as `uisfx`).

- Audio files: **CC0 1.0 Universal** (public domain dedication) — see the
  package's `LICENSE-AUDIO`. Attribution is appreciated, not required.
- Library code: MIT (not used here; only the audio files were taken).

Chosen from the `dreamy`, `glass`, `organic`, `rubber`, `soft`, `arcade`,
`zen` and `cinematic` themes and renamed for how the game uses them:

| File | Source | Used for |
| --- | --- | --- |
| `pop.mp3` | rubber/press | bursting a balloon, popping a bubble |
| `tap.mp3` | organic/press | a touch that hit nothing in particular |
| `plink.mp3` | glass/select | picking things up, small confirmations |
| `success.mp3`, `reward.mp3`, `bonus.mp3`, `achievement.mp3` | dreamy, arcade, glass | the escalating reward tiers |
| `levelup.mp3`, `streak.mp3`, `badge.mp3` | dreamy, arcade | balloon showers and streaks |
| `fanfare.mp3` | cinematic/complete | finishing a board or a tune |
| `start.mp3`, `open.mp3`, `close.mp3`, `back.mp3` | dreamy, soft, organic | entering and leaving activities |
| `snap.mp3`, `drop.mp3`, `grab.mp3`, `check.mp3` | rubber, organic, glass | the shape sorter |
| `swipe.mp3`, `expand.mp3`, `boing.mp3` | organic, glass, rubber | reveals and bounces |
| `wake.mp3`, `sleep.mp3`, `chime.mp3` | dreamy, zen | scene moods |
| `toggle-on.mp3`, `toggle-off.mp3` | glass | the sound and tool buttons |
| `nope.mp3` | organic/blocked | a gentle "not that one" — deliberately soft |

## Musical instruments — `assets/instruments/`

41 sampled notes from **tonejs-instruments** by N. P. Brosowsky
(<https://github.com/nbrosowsky/tonejs-instruments>).

- Samples: **CC-BY 3.0** — <https://creativecommons.org/licenses/by/3.0/>.
  Collected there from public-domain and Creative Commons sources, then
  trimmed, volume-matched and pitch-corrected by the author.
- Loader code: MIT (not used here; the game has its own sampler).

| Instrument | Notes taken | Used for |
| --- | --- | --- |
| xylophone | C5 C6 C7 C8 G4 G5 G6 G7 | taps, pops, reward flourishes, the toy keyboard |
| harp | C3 E3 G3 B3 D4 F4 A4 C5 E5 G5 B5 D6 F6 A6 | background chords, painting, glissandi |
| flute | C4 E4 A4 C5 E5 A5 C6 E6 A6 | melody lines, animal calls |
| piano | C3 E3 G3 C4 E4 G4 C5 E5 G5 C6 | bass notes, the deeper animal calls |

Notes that were not sampled are produced by pitch-shifting the nearest
recorded note, so a handful of files covers three octaves.

Nothing is streamed as a pre-rendered track: the soundtrack is played live from
these samples by the sequencer in `src/core/audio.js`, and the animal voices are
the same samples bent in pitch.

## Type — `assets/fonts/`

- **Varela Round** — SIL Open Font License 1.1. Rounded body face, covers
  Hebrew and Latin. Via `@fontsource/varela-round`.
- **Secular One** — SIL Open Font License 1.1. Heavy display face for the big
  words, covers Hebrew and Latin. Via `@fontsource/secular-one`.

Full licence texts are in this directory.

## Graphics

All original. Every character, prop and background in the game is drawn with
canvas paths in `src/core/gfx.js` and `src/core/creatures.js` — there are no
bitmaps, which is why the art stays sharp on a retina tablet and the whole game
downloads in a few hundred kilobytes plus audio. The app icon
(`assets/icon.svg`, and the PNGs rendered from it) is original too.
