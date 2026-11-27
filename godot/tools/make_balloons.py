#!/usr/bin/env python3
"""The balloon sheet came on white, not a key colour, and every balloon has a
face painted on. This cuts the pieces out by flooding the white in from the
edges (the dark outlines stop it), wipes the face off one balloon, turns it to
grey so the game can tint it any colour while keeping the painted shine, and
saves it with the gift box as art/p/balloon.png and art/p/present.png.
Run from godot/:  python3 tools/make_balloons.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

import make_props

im = np.asarray(Image.open('art_src/props_balloons.jpg').convert('RGB')).astype(np.float32)
white = (im.min(axis=2) > 225) & (im.max(axis=2) - im.min(axis=2) < 25)
lab, _ = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
# soft edge: a pixel next to the background fades with how white it is
near = ndimage.binary_dilation(bg, iterations=2) & ~bg
wh = np.clip((im.min(axis=2) - 170) / 70, 0, 1)
alpha = np.where(bg, 0.0, np.where(near, 1 - wh, 1.0))
solid = ndimage.binary_fill_holes(~bg)
pl, n = ndimage.label(solid)
boxes = [s for i, s in enumerate(ndimage.find_objects(pl), 1) if (pl[s] == i).sum() > 20000]
boxes.sort(key=lambda s: (round(s[0].start / 250), s[1].start))


def piece(s):
    rgba = np.dstack([im[s], alpha[s] * 255]).clip(0, 255).astype(np.uint8)
    return rgba


# --- the yellow balloon, faceless and grey
s = boxes[1]
rgb = im[s].copy()
a = alpha[s]
h, w = a.shape
lum = rgb @ np.array([0.3, 0.55, 0.15])
face = np.zeros_like(a, bool)
face[int(h * 0.25):int(h * 0.62), int(w * 0.15):int(w * 0.85)] = True
dark = face & (lum < lum[face].mean() - 25)
dark = ndimage.binary_dilation(dark, iterations=6) & face
# fill the face by letting the surrounding colour diffuse in
known = (~dark).astype(np.float32)
for _ in range(300):
    num = ndimage.uniform_filter(rgb * known[..., None], size=(5, 5, 1))
    den = ndimage.uniform_filter(known, size=5)
    est = num / np.maximum(den, 1e-4)[..., None]
    grow = dark & (den > 0.05)
    rgb = np.where(grow[..., None], est, rgb)
    known = np.where(grow, 1.0, known)
lum = rgb @ np.array([0.3, 0.55, 0.15])
body = np.median(lum[a > 0.9])
grey = np.clip(lum / body * 0.88 * 255, 0, 255)
out = Image.fromarray(np.dstack([grey, grey, grey, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
make_props.BOX['balloon'] = (512, 512, 75, 40, 362, 430)
make_props.BOX['present'] = (512, 512, 84, 112, 344, 344)
make_props.fit(out, 'balloon').save('art/p/balloon.png')
make_props.fit(Image.fromarray(piece(boxes[7]), 'RGBA'), 'present').save('art/p/present.png')
print(len(boxes), 'pieces; balloon.png, present.png')
