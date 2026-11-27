#!/usr/bin/env python3
"""Turns the generated prop sheets into drop-in replacements for drawn SVG art.

Each piece cut from a sheet (see cutout.py) is fitted into the box the old SVG
drawing filled on its canvas and saved as art/p/<name>.png at the same canvas
size, so World.tex(name) can hand it out in place of art/<name>.svg without any
caller changing its scale or offset. New props without an SVG get their own
canvas. Run from godot/:  python3 tools/make_props.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path('art_src')
OUT = Path('art/p')
# old drawing boxes on their canvas: name -> (canvas w, h, box x, y, w, h)  (measured in Godot)
BOX = {
    'tree': (512, 512, 35, 12, 437, 458), 'bush': (512, 512, 61, 133, 400, 342),
    'cloud': (512, 512, 62, 124, 419, 222),
    'cake_cherry': (512, 512, 106, 55, 328, 401), 'cake_heart': (512, 512, 70, 113, 372, 333),
    'cake_star': (512, 512, 36, 34, 440, 412), 'cake_macaron': (512, 512, 92, 135, 328, 242),
    'food_cookie': (512, 512, 76, 84, 360, 344), 'cake_candle': (512, 512, 212, 75, 88, 399),
    'cake_flame': (512, 512, 180, 40, 152, 300), 'cake_stand': (512, 300, 9, 35, 494, 249),
    'cake_shaker': (512, 512, 144, 64, 224, 392),
    'garden_can': (512, 512, 0, 131, 401, 313), 'garden_soil': (512, 256, 30, 61, 452, 179),
    'garden_seed': (128, 128, 30, 17, 68, 96), 'garden_bee': (256, 256, 14, 13, 216, 205),
    'mouth_smile': (512, 512, 141, 211, 230, 101), 'mouth_open': (512, 512, 141, 201, 230, 131),
    'mouth_o': (512, 512, 181, 171, 150, 182), 'mouth_grin': (512, 512, 101, 191, 310, 168),
    'cheek': (512, 512, 67, 136, 378, 239),
    'food_apple': (512, 512, 85, 56, 342, 374), 'food_carrot': (512, 512, 148, 16, 218, 440),
    'food_banana': (512, 512, 96, 140, 340, 232), 'food_strawberry': (512, 512, 89, 130, 334, 326),
    'food_cheese': (512, 512, 84, 134, 352, 252), 'food_grapes': (512, 512, 112, 33, 282, 405),
    'food_fish': (512, 512, 84, 171, 382, 170), 'food_bone': (512, 512, 122, 85, 281, 288),
    # new props: canvas = the piece itself, bottom-centred
    'tree_blossom': (512, 512, 35, 12, 437, 458),
    'shroom_red': (256, 256, 28, 20, 200, 216), 'shroom_brown': (256, 256, 28, 20, 200, 216),
    'rock': (512, 512, 16, 120, 480, 340), 'clump_a': (512, 512, 30, 60, 452, 400),
    'clump_b': (512, 512, 30, 60, 452, 400),
}
BOTTOM = {'tree', 'tree_blossom', 'bush', 'cake_candle', 'garden_soil', 'shroom_red', 'shroom_brown',
          'rock', 'clump_a', 'clump_b', 'cake_stand'}
# fill the old box's height even if wider: the candle's flame is placed by its top
FULL_HEIGHT = {'cake_candle'}
# sheet, key, min-area, {piece index: name}
SHEETS = [
    ('props_cake', 'green', '0.0005', {1: '-', 2: 'cake_stand', 3: 'cake_candle', 4: 'cake_flame', 5: 'cake_cherry',
                                       6: 'cake_heart', 7: 'cake_star', 8: 'cake_macaron', 9: 'food_cookie_mac',
                                       10: 'cake_shaker'}),
    ('props_garden', 'magenta', '0.0015', {0: 'garden_can', 1: 'garden_soil', 2: 'garden_seed', 10: 'garden_bee'}),
    ('props_scenery', 'magenta', '0.0015', {0: 'tree', 1: 'tree_blossom', 2: 'bush', 3: 'cloud', 4: 'shroom_brown',
                                            5: 'shroom_red', 6: 'clump_a', 7: 'rock', 8: 'clump_b'}),
    ('props_food', 'magenta strict', '0.0015', {0: 'food_carrot', 1: 'food_apple', 2: 'food_banana', 3: 'food_strawberry',
                                                 4: 'food_cookie', 5: 'food_cheese', 6: 'food_grapes', 7: 'food_fish',
                                                 8: 'food_bone'}),
    ('mouths', 'green', '0.0015', {0: 'cheek', 1: 'mouth_smile', 4: 'mouth_open', 6: 'mouth_o', 8: 'mouth_grin'}),
]


def cut(sheet, key, area, tmp):
    d = Path(tmp) / sheet
    key, *flags = key.split()
    subprocess.run([sys.executable, 'tools/cutout.py', str(SRC / f'{sheet}.jpg'), str(d), '--key', key,
                    '--min-area', area] + [f'--{x}' for x in flags], check=True, capture_output=True)
    return d


def strip_flame(im: Image.Image) -> Image.Image:
    """The painted candle came lit: keep only the striped stick below the wick."""
    a = np.asarray(im)[..., 3] > 128
    widths = a.sum(axis=1)
    body = widths.max()
    rows = np.nonzero(widths > body * 0.85)[0]
    return im.crop((0, rows[0], im.width, im.height))


def fit(im: Image.Image, name: str) -> Image.Image:
    cw, ch, bx, by, bw, bh = BOX[name]
    s = min(bw / im.width, bh / im.height)
    if name in FULL_HEIGHT:
        s = bh / im.height
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    piece = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    x = bx + (bw - w) // 2
    y = by + bh - h if name in BOTTOM else by + (bh - h) // 2
    canvas.alpha_composite(piece, (x, y))
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for sheet, key, area, names in SHEETS:
            d = cut(sheet, key, area, tmp)
            for i, name in names.items():
                if name not in BOX:
                    continue
                im = Image.open(d / f'piece_{i:02d}.png').convert('RGBA')
                if name == 'cake_candle':
                    im = strip_flame(im)
                fit(im, name).save(OUT / f'{name}.png')
                print(name)


if __name__ == '__main__':
    main()
