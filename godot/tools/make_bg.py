#!/usr/bin/env python3
"""Turns the generated scenery images into game backgrounds.

  sky   - used as is (art/bg/sky.jpg)
  hills - the generator filled the area above the hills with magenta (as
          asked) but also painted a strip of hills above that. Everything down
          to the end of the magenta band is dropped, the remaining magenta
          fringe is keyed out, and the hills are saved as art/bg/hills.png
          with a transparent top edge.

    python3 godot/tools/make_bg.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'art_src', ROOT / 'art' / 'bg'
OUT.mkdir(parents=True, exist_ok=True)

Image.open(SRC / 'bg_sky.jpg').convert('RGB').save(OUT / 'sky.jpg', quality=92)

rgb = np.asarray(Image.open(SRC / 'bg_hills.jpg').convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
magenta = (np.minimum(r, b) - g) / 255.0          # > 0.4 is the key colour
rows = (magenta > 0.4).mean(axis=1)
band = np.where(rows > 0.5)[0]
top = int(band.max()) + 1                          # first row below the band
hills = rgb[top:]
m = magenta[top:]
alpha = 1.0 - np.clip((m - 0.12) / 0.3, 0, 1)
# soften the very top edge so the hills melt into the sky
fade = np.clip(np.arange(hills.shape[0]) / 18.0, 0, 1)[:, None]
alpha = alpha * fade
excess = np.clip(np.minimum(hills[..., 0], hills[..., 2]) - hills[..., 1], 0, None)
hills[..., 0] -= excess
hills[..., 2] -= excess
out = np.dstack([hills, alpha * 255]).clip(0, 255).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(OUT / 'hills.png')
print(f'sky.jpg, hills.png ({out.shape[1]}x{out.shape[0]}, cut at row {top})')
