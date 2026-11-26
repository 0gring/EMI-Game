#!/usr/bin/env python3
"""Cuts generated art sheets into game-ready transparent pieces.

The sheets come from an image generator: separate pieces laid out on a flat
#00FF00 green (or #FF00FF magenta) background, usually as JPEG. This keys the
background out with a soft edge, removes the green fringe JPEG compression
leaves round every piece, splits the sheet into its separate pieces, and saves
each as a trimmed PNG.

    python3 godot/tools/cutout.py SHEET OUTDIR [--key magenta] [--names a,b,c...]

Without --names it writes piece_00.png ... in reading order plus
OUTDIR/_index.png, a contact sheet numbering every piece so they can be named.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def key_alpha(rgb: np.ndarray, key: str) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if key == 'magenta':
        k = np.minimum(r, b) - g            # how much more magenta than not
    else:
        k = g - np.maximum(r, b)            # how much greener than red or blue
    k = k / 255.0
    # fully solid below 0.12, fully gone above 0.42, smooth in between
    a = 1.0 - np.clip((k - 0.12) / 0.30, 0.0, 1.0)
    return a


def despill(rgb: np.ndarray, key: str) -> np.ndarray:
    out = rgb.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    if key == 'magenta':
        # red and blue together can never run ahead of green
        excess = np.clip(np.minimum(r, b) - g, 0, None)
        out[..., 0] = r - excess
        out[..., 2] = b - excess
    else:
        # green can never exceed the brighter of red and blue
        out[..., 1] = np.minimum(g, np.maximum(r, b))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('outdir')
    ap.add_argument('--key', default='green', choices=['green', 'magenta'])
    ap.add_argument('--names', default='')
    ap.add_argument('--min-area', type=float, default=0.0015, help='fraction of the sheet; smaller blobs are dropped')
    args = ap.parse_args()

    img = Image.open(args.sheet).convert('RGB')
    rgb = np.asarray(img).astype(np.float32)
    alpha = key_alpha(rgb, args.key)
    rgb = despill(rgb, args.key)

    # separate pieces: label the solid areas, bridging hairline gaps inside a piece
    solid = alpha > 0.5
    solid = ndimage.binary_closing(solid, iterations=3)
    solid = ndimage.binary_fill_holes(solid)
    labels, n = ndimage.label(solid)
    h, w = solid.shape
    pieces = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        area = (labels[sl] == i).sum()
        if area < args.min_area * h * w:
            continue
        pieces.append((i, sl))
    # reading order: rows of roughly equal top, then left to right
    pieces.sort(key=lambda p: (round(p[1][0].start / (h / 8)), p[1][1].start))

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    names = [s.strip() for s in args.names.split(',')] if args.names else []
    index = img.copy().convert('RGB')
    draw = ImageDraw.Draw(index)
    pad = 6
    for k, (i, sl) in enumerate(pieces):
        y0, y1 = max(0, sl[0].start - pad), min(h, sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(w, sl[1].stop + pad)
        # keep only this piece's own soft edge, not a neighbour's
        own = ndimage.binary_dilation(labels[y0:y1, x0:x1] == i, iterations=4)
        a = alpha[y0:y1, x0:x1] * own
        rgba = np.dstack([rgb[y0:y1, x0:x1], a * 255.0]).clip(0, 255).astype(np.uint8)
        name = names[k] if k < len(names) and names[k] else f'piece_{k:02d}'
        if name == '-':
            continue
        Image.fromarray(rgba, 'RGBA').save(out / f'{name}.png')
        draw.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=4)
        draw.text((x0 + 8, y0 + 8), f'{k} {name}', fill=(0, 0, 0))
        print(f'{k:2d} {name:16s} {x1 - x0}x{y1 - y0} at ({x0},{y0})')
    if not names:
        index.save(out / '_index.png')


if __name__ == '__main__':
    main()
