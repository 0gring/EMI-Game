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
from scipy import ndimage

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

# meadow: a foreground strip of grass and wildflowers under a magenta sky.
# Keep it from the tallest stalk down, keyed, at most 1600 wide.
rgb = np.asarray(Image.open(SRC / 'bg_meadow.jpg').convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
magenta = (np.minimum(r, b) - g) / 255.0
alpha = 1.0 - np.clip((magenta - 0.04) / 0.2, 0, 1)
alpha = np.where(alpha > 0.35, alpha, 0.0)   # no pink haze round the stalks
top = int(np.where((alpha > 0.5).mean(axis=1) > 0.002)[0].min())
mead, alpha = rgb[top:], alpha[top:]
alpha = alpha * np.clip(np.arange(mead.shape[0]) / 40.0, 0, 1)[:, None]
excess = np.clip(np.minimum(mead[..., 0], mead[..., 2]) - mead[..., 1], 0, None)
mead[..., 0] -= excess
mead[..., 2] -= excess
# the stalk tips along the top edge carry a pink blend from the backdrop:
# there, nothing may be redder or bluer than it is green
band = (np.arange(mead.shape[0]) < 120)[:, None]
pink = band & (mead[..., 0] > mead[..., 1]) & (mead[..., 2] > mead[..., 1] * 0.85)
alpha = np.where(ndimage.binary_dilation(pink, iterations=2) & band, 0.0, alpha)
edge = band & (alpha < 0.98)
mead[..., 0] = np.where(edge, np.minimum(mead[..., 0], mead[..., 1] * 1.05), mead[..., 0])
mead[..., 2] = np.where(edge, np.minimum(mead[..., 2], mead[..., 1]), mead[..., 2])
out = Image.fromarray(np.dstack([mead, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
if out.width > 1600:
    out = out.resize((1600, round(out.height * 1600 / out.width)), Image.LANCZOS)
out.save(OUT / 'meadow.png')
print(f'meadow.png ({out.width}x{out.height}, cut at row {top})')
