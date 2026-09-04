# עולם של אמי — Emi's World

A touch game for a two-year-old. Six activities, no score to lose, no timers,
nothing that can be failed. Runs in any modern browser on a tablet, a phone or
a computer, and keeps working with no signal once it has been opened once.

Everything is Hebrew and right-to-left. The child needs no reading: the words
are there for the grown-up and for hearing a name spoken alongside a picture.

## Getting to it

Three ways in, in order of least setup:

1. **One file.** `npm run bundle` produces `dist/emi-world.html` — the whole
   game, every sample and both fonts inlined, 2.8MB, no server and no network
   needed. Open it from anywhere, mail it, put it on a USB stick. A test asserts
   the page makes exactly one request: itself.
2. **GitHub Pages.** The workflow turns Pages on itself on its first run, so
   there is nothing to configure: the game lives at
   `https://<user>.github.io/EMI-Game/`, with the standalone copy alongside it
   at `/emi-world.html`. This is the one to add to a tablet's home screen,
   because the service worker then keeps it working with no signal.
3. **Locally**, for development — see below.

## Playing it

**On a computer**, open `index.html` through a local server (a file:// URL
cannot load ES modules or decode audio):

```
npm start          # serves at http://localhost:8080
```

Then open the address it prints. Click once to start — browsers will not let a
page make sound until someone touches it, which is what the title screen's first
tap is for.

**On a tablet**, open the same URL over your network or the published site,
then tap **מסך מלא** (full screen) in the corner. On iPad, *Share → Add to Home
Screen*; on Android Chrome, *Install app*. Launched that way it opens full
screen with no browser chrome and no address bar for small fingers to find.

## The six activities

| | Activity | What she does | What it is for |
| --- | --- | --- | --- |
| 🎈 | **בלונים** Balloons | Balloons rise, she pops them | cause and effect, the first thing that hooks a toddler. A streak of pops climbs a pentatonic scale, so a run plays a little tune. Golden balloons carry a sticker; every dozen pops fills the sky |
| 🐱 | **חיות** Animals | Touch a bush, a haystack, a log — an animal springs out | vocabulary. Thirteen animals, each with its Hebrew name, its sound in Hebrew, and its own voice. Four different ones in a sitting triggers a parade |
| 🎵 | **מוזיקה** Music | An eight-bar xylophone with four instruments | free play in a major scale, so no combination sounds wrong. A second mode lights the next bar of a nursery tune; a wrong bar still plays its note and nothing is lost |
| 🔶 | **צורות** Shapes | Drag shapes into matching holes | shape matching, with a snap radius three times the hole and a hint that glows brighter the closer she gets. Two hands at once works |
| 🎨 | **ציור** Painting | Finger paint with nine colours, a rainbow brush and five stamps | the one she will sit with longest. Height on the screen picks the pitch, so a scribble sounds like a run up and down the scale |
| 🐠 | **ים** Sea | Fish drift past, bubbles rise, a treasure chest opens | the wind-down activity. Slower and quieter, with a whale that swims by and schools of fish that cross now and then |

Stars collect in the corner and animals collect in an album on the map, so
coming back has a point without anything ever being taken away.

## Design rules it follows

These are the reasons behind most of the code:

- **Nothing can be failed.** No timers, no lives, no losing state, no red
  crosses. A wrong shape gets a soft nudge and a hint, never a buzzer.
- **Every touch does something.** Touching empty sky still puffs a cloud and
  plays a note. A screen that ignores a toddler loses her.
- **All ten fingers work.** A two-year-old plants a palm on the glass, so the
  engine tracks every pointer rather than one cursor.
- **Nothing sounds wrong.** Instruments are tuned to pentatonic and major
  scales, so mashing produces music. Everything goes through a limiter, and the
  soundtrack ducks under a reward instead of fighting it.
- **The way out needs intent.** The home button fills a ring over half a second
  of holding, so a stray palm cannot throw her out of an activity mid-play. The
  speaker button is one tap, because a grown-up may need silence now.
- **It suggests the next thing.** After a few idle seconds something pulses,
  rustles or peeks.
- **Sound is real, not synthetic beeps.** See [assets/CREDITS.md](assets/CREDITS.md).
- **It loads fast.** The whole game, audio included, is 2.7MB. That matters when
  the tablet is on a phone connection and a two year old is already waiting.

## How it is built

Plain ES modules and canvas 2D, no framework. The game itself has no build step —
serve the directory and it runs. The two build tools are optional and their
output is committed: one trims the audio, the other folds everything into the
standalone single file.

```
index.html              the shell: fonts, full-screen button, feature gate
manifest.webmanifest    installable app metadata
sw.js                   offline cache (shell network-first, audio cache-first)
src/main.js             wires the engine, audio and scenes together
src/core/
  engine.js             canvas sizing, frame loop, multi-touch, scene stack
  audio.js              sampler, animal voices, live music sequencer
  creatures.js          every character, drawn as vector paths
  gfx.js                drawing toolkit and the gradient cache
  fx.js                 pooled particle system
  ui.js                 shared chrome and the scene base class
  state.js              saved stars and stickers
  util.js               easing, springs, small maths
src/scenes/             title, hub and the six activities
tools/                  test, verify, profile, bundle, audio and icon build
```

Two performance decisions carry the frame rate, and both are worth keeping:

- **Static scenery is baked.** Sky, hills, sand, wood grain and coral are drawn
  once into an offscreen canvas per layout and blitted each frame. Repainting
  full-screen gradients every frame was costing more than half the frame budget.
- **Gradients are cached.** Canvas gradient coordinates are interpreted in user
  space at paint time, so a gradient defined in unit space is reused by every
  creature at every size.

Together they took the game from 24–50fps to a flat 60fps in software rendering,
which is the worst case a cheap tablet can present. The engine also caps its
backing store by total pixels and steps resolution down if it measures sustained
slow frames.

## Working on it

```
npm start            # local server, prints the address to use on a tablet
npm test             # 41 functional checks in real Chromium
npm run test:bundle  # the same checks against the single-file build (42)
npm run verify       # screenshots every scene at four sizes, fails on any error
npm run bundle       # dist/emi-world.html, the standalone copy
npm run profile      # per-scene frame rate
node tools/stress.mjs         # frame rate with the particle pool full
node tools/make-icons.mjs     # re-render the PNG icons from icon.svg
node tools/shrink-audio.mjs   # re-trim and re-encode the samples (--write)
```

`npm test` drives the actual game — it pops a balloon and asserts a star was
awarded, drags a shape and asserts it snapped, checks that a wrong bar cannot
fail the song, that a quick tap on home does not exit but a hold does, and that
the audio samples really decoded. `npm run verify` catches layout problems by
walking every scene at tablet, phone and desktop sizes and failing on any
console error, page error or dropped frame rate.

## Publishing it

`.github/workflows/pages.yml` deploys on any push to `main` or a `claude/*`
branch, and can be run by hand from the Actions tab. It enables Pages through
the API on its first run, so no repository setting has to be changed first. If
an account policy blocks that, turn it on under *Settings → Pages → Source:
GitHub Actions* and re-run the workflow.
