#!/usr/bin/env python3
"""Builds every 3D model of Emi's garden with sand3d and exports them as GLB
into emi3d/models/, plus models/layout.json: where things stand on the island
(in Godot's axes: x right, y up, z toward the camera).

Run with the sand3d venv:  python tools/build_models.py   (from emi3d/)

Style: soft, round, toy-like shapes; colours on the vertices (one matte look
in Godot, scripts/cozy.gdshader). Metres. sand3d is Z up; Godot is Y up:
sand3d (x, y, z) is Godot (x, z, -y).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import sand3d as s3d

OUT = Path(__file__).resolve().parent.parent / 'models'
OUT.mkdir(exist_ok=True)


def fresh():
    s3d.empty_scene()
    s3d.units('m')


def save(root, name):
    s3d.export(root, str(OUT / f'{name}.glb'), colors='vertex')
    print('  ', name)


def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def mottled(c1, c2, scale, seed=0):
    """A colour function: two colours mixed by soft noise, `scale` metres across."""
    a, b = rgb(c1), rgb(c2)

    def f(x, y, z):
        t = np.clip(0.5 + 0.7 * s3d.noise(x / scale, y / scale, z / scale, seed=seed), 0, 1)[:, None]
        return a * (1 - t) + b * t
    return f


# --- the island -----------------------------------------------------------------------------
ISLAND_W, ISLAND_D, TOP = 30.0, 26.0, 1.0
POND = (5.5, -4.0)          # sand3d x, y of the pond's centre
POND_R = 3.2
WATER_Z = 0.82


def island():
    fresh()
    with s3d.facets(64, smooth=True):
        land = s3d.extrude('land', s3d.superellipse(ISLAND_W, ISLAND_D, n=2.3), TOP)
    s3d.fillet(land, 0.45, edges='top')
    # gentle hummocks on the lawn; the rim stays put
    s3d.displace(land, 0.35, 5.0, faces='top', direction='+Z', seed=2, step=0.7)
    # the pond: a soft bowl pressed into the lawn
    with s3d.facets(32, smooth=True):
        bowl = s3d.sphere('bowl', POND_R * 2)
    s3d.scale(bowl, (1.0, 0.85, 0.22))
    bowl = s3d.at(bowl, x=POND[0], y=POND[1], z=0.45)
    land = s3d.cut(land, bowl)
    grass_a, grass_b = '#7ccf55', '#a6dc5e'

    def lawn(x, y, z):
        g = mottled(grass_a, grass_b, 3.5, seed=4)(x, y, z)
        # the bowl's sides and floor are earth and pebbles, the cliff edge earthy too
        d = np.hypot((x - POND[0]) / POND_R, (y - POND[1]) / (POND_R * 0.85))
        earth = rgb('#b98a5a')
        wet = (d < 0.97) & (z < TOP - 0.2)
        cliff = (z < TOP - 0.3) & (d > 1.3)
        out = np.where(wet[:, None], earth * 0.85, g)
        return np.where(cliff[:, None], rgb('#c79a63'), out)
    s3d.material(land, 'grass', color=lawn)
    with s3d.facets(64, smooth=True):
        beach = s3d.extrude('beach', s3d.superellipse(ISLAND_W + 3.2, ISLAND_D + 3.2, n=2.3), 0.55)
    s3d.fillet(beach, 0.35, edges='top')
    s3d.material(beach, 'sand', color=mottled('#f6dfa8', '#efd08e', 2.0, seed=7))
    s3d.at(beach, z=-0.2)
    s3d.at(land, z=-0.0)
    save(s3d.group('island', land, beach), 'island')


def grass_tufts():
    """Blades over the lawn, kept off the pond: one mesh."""
    fresh()
    with s3d.facets(48, smooth=True):
        carrier = s3d.extrude('carrier', s3d.superellipse(ISLAND_W - 1.6, ISLAND_D - 1.6, n=2.3), TOP)
    sites = []
    for f in s3d.scatter(3200, carrier, seed=5):
        if f.normal.z < 0.9:
            continue
        x, y = f.origin.x, f.origin.y
        if math.hypot((x - POND[0]) / (POND_R + 0.6), (y - POND[1]) / (POND_R * 0.85 + 0.6)) < 1:
            continue
        sites.append(f)
    tufts = s3d.tufts('grass', s3d.Frames(sites), height=0.16, width=0.05, blades=4, lean=25, seed=6)
    s3d.material(tufts, 'grass', color=mottled('#5fb845', '#93d65a', 2.5, seed=9))
    s3d.delete(carrier)
    save(tufts, 'grass')


# --- trees and plants ----------------------------------------------------------------------
def crown(name, d, colors, seed, blobs=4):
    """A cloud of round blobs blended into one soft crown."""
    rng = np.random.default_rng(seed)
    parts = []
    with s3d.facets(16, smooth=True):
        main = s3d.sphere(name, d)
        for i in range(blobs):
            a = rng.uniform(0, 2 * math.pi)
            r = d * rng.uniform(0.25, 0.38)
            b = s3d.sphere(f'{name}_b{i}', d * rng.uniform(0.5, 0.7))
            parts.append(s3d.at(b, x=math.cos(a) * r, y=math.sin(a) * r, z=d * rng.uniform(0.15, 0.45)))
    c = s3d.blend(main, *parts, r=d * 0.12, step=d / 20)
    s3d.displace(c, d * 0.03, d * 0.25, seed=seed, step=d / 18)
    s3d.material(c, 'leaf', color=mottled(*colors, d * 0.35, seed=seed))
    return c


def trunk(name, h, d):
    with s3d.facets(10, smooth=True):
        path = s3d.spline([(0, 0, 0), (0.08, 0.03, h * 0.45), (-0.04, 0.0, h)])
        t = s3d.wire(name, path, [(0, d), (0.15, d * 0.75), (1, d * 0.55)])
    s3d.material(t, 'bark', color=mottled('#8a5a3b', '#a06a45', 0.5, seed=3))
    return t


def tree(name, colors, seed, h=2.4, crown_d=2.6):
    fresh()
    t = trunk(name + '_trunk', h, 0.42)
    c = s3d.at(crown(name + '_crown', crown_d, colors, seed), z=h - crown_d * 0.3)
    save(s3d.group(name, t, c), name)
    return {'crown_y': h - crown_d * 0.3 + crown_d * 0.5, 'crown_r': crown_d * 0.55}


def bush(name, colors, seed, d=1.3, flowers=None):
    fresh()
    c = crown(name, d, colors, seed, blobs=5)
    s3d.scale(c, (1.25, 1.1, 0.75))
    parts = [c]
    if flowers:
        sites = s3d.Frames(f for f in s3d.scatter(26, c, seed=seed + 1) if f.normal.z > 0.1)
        with s3d.facets(8, smooth=True):
            for i, f in enumerate(sites):
                fl = s3d.sphere(f'{name}_fl{i}', 0.13)
                s3d.material(fl, 'plastic', color=flowers[i % len(flowers)])
                parts.append(s3d.at(fl, x=f.origin.x, y=f.origin.y, z=f.origin.z - 0.05))
    save(s3d.group(name, *parts), name)


def rock(name, d, seed, flat=0.6, colors=('#a9a3b6', '#c3bdcc')):
    fresh()
    with s3d.facets(14, smooth=True):
        r = s3d.sphere(name, d)
    s3d.displace(r, d * 0.1, d * 0.45, seed=seed, step=d / 10)
    s3d.scale(r, (1.0, 0.85, flat))
    s3d.at(r, z=-d * flat * 0.12)
    s3d.material(r, 'rock', color=mottled(*colors, d * 0.4, seed=seed))
    save(r, name)


def mushroom(name, cap_col, d=0.55):
    fresh()
    with s3d.facets(20, smooth=True):
        stem = s3d.revolve(name + '_stem', [(0, 0), (d * 0.24, 0), (d * 0.2, d * 0.5), (0, d * 0.55)])
    with s3d.facets(40, smooth=True):
        cap = s3d.dome(name + '_cap', d, d * 0.55)
    s3d.material(stem, 'plastic', color='#fff3df')
    spots = rgb('#ffffff')
    base = rgb(cap_col)

    # white spots: a few round patches spread over the cap
    dots = np.array([[math.cos(a) * r, math.sin(a) * r] for r, a in
                     [(0, 0)] + [(d * 0.27, k * 2.1) for k in range(3)] + [(d * 0.4, k * 1.26 + 0.5) for k in range(5)]])

    def cap_colour(x, y, z):
        dist = np.min(np.hypot(x[:, None] - dots[None, :, 0], y[:, None] - dots[None, :, 1]), axis=1)
        return np.where((dist < d * 0.075)[:, None], spots, base)
    s3d.material(cap, 'plastic', color=cap_colour)
    s3d.at(cap, z=d * 0.42)
    save(s3d.group(name, stem, cap), name)


def flower(name, petal, centre='#ffd84a'):
    """One small flower on a stem; Godot plants hundreds of it (MultiMesh)."""
    fresh()
    with s3d.facets(8, smooth=True):
        stem = s3d.cylinder(name + '_stem', 0.025, 0.28)
        head = s3d.sphere(name + '_c', 0.07)
        petals = [s3d.at(s3d.sphere(f'{name}_p{i}', 0.08), x=0.065 * math.cos(a), y=0.065 * math.sin(a))
                  for i, a in enumerate(np.linspace(0, 2 * math.pi, 6)[:-1])]
    s3d.material(stem, 'leaf', color='#4fa83a')
    s3d.material(head, 'plastic', color=centre)
    for p in petals:
        s3d.scale(p, (1.0, 1.0, 0.45))
        s3d.material(p, 'plastic', color=petal)
    head_g = s3d.group(name + '_head', head, *petals)
    s3d.at(head_g, z=0.26)
    save(s3d.group(name, stem, head_g), name)


# --- things to play with ---------------------------------------------------------------------
def apple(name='apple', col='#e8363a'):
    fresh()
    with s3d.facets(14, smooth=True):
        body = s3d.revolve(name, [(0, 0.01), (0.07, 0.0), (0.12, 0.06), (0.115, 0.15), (0.06, 0.2), (0, 0.18)])
        stalk = s3d.cylinder(name + '_stalk', 0.018, 0.07)
    s3d.material(body, 'plastic', color=mottled(col, '#ff6a5a' if col == '#e8363a' else '#c8f070', 0.08, seed=2))
    s3d.material(stalk, 'bark', color='#6b4226')
    s3d.at(stalk, z=0.17)
    with s3d.facets(6, smooth=True):
        leaf = s3d.sphere(name + '_leaf', 0.08)
    s3d.scale(leaf, (1.0, 0.45, 0.15))
    s3d.material(leaf, 'leaf', color='#5cbf4a')
    s3d.at(leaf, x=0.045, z=0.225, ry=-25)
    save(s3d.group(name, body, stalk, leaf), name)


def basket():
    fresh()
    with s3d.facets(24, smooth=True):
        body = s3d.revolve('basket', [(0, 0), (0.3, 0), (0.42, 0.32), (0.38, 0.32), (0.27, 0.04), (0, 0.04)])
        handle = s3d.torus('handle', 0.78, 0.05)

    def weave(x, y, z):
        a = np.arctan2(y, x)
        k = (np.floor(z / 0.06) + np.floor(a / (2 * math.pi) * 24)) % 2
        return np.where((k > 0)[:, None], rgb('#c9874a'), rgb('#e3a866'))
    s3d.material(body, 'plastic', color=weave)
    handle = s3d.split(handle, s3d.Frame((0, 0, 0), (0, 1, 0)), keep='above')
    s3d.at(handle, rx=90, z=0.3)
    s3d.material(handle, 'plastic', color='#c9874a')
    save(s3d.group('basket', body, handle), 'basket')


def fish(name, body_col, fin_col):
    """A round little fish: an egg of a body with a blunt nose, a wide tail fin,
    a fin on its back and big eyes. Nose toward -Y (Godot: -Z... it is turned
    by the game as it leaps)."""
    fresh()
    with s3d.facets(14, smooth=True):
        body = s3d.loft(name, s3d.station(0, 0.07, 0.06),
                        s3d.station(0.06, 0.17, 0.13), s3d.station(0.2, 0.21, 0.15),
                        s3d.station(0.34, 0.12, 0.08), s3d.station(0.42, 0.05, 0.04))
    s3d.material(body, 'plastic', color=body_col)
    with s3d.facets(10, smooth=True):
        tail = s3d.extrude(name + '_tail', s3d.poly([(0, 0), (0.17, 0.2), (0.06, 0.16), (0, 0.1),
                                                    (-0.06, 0.16), (-0.17, 0.2)], fillet=0.03), 0.03, both=True)
        fin = s3d.extrude(name + '_fin', s3d.poly([(0, 0), (0.12, 0.0), (0.02, 0.09)], fillet=0.02), 0.025, both=True)
        eye_l = s3d.sphere(name + '_eye', 0.06)
    s3d.material(tail, 'plastic', color=fin_col)
    s3d.material(fin, 'plastic', color=fin_col)
    s3d.at(tail, rx=90, z=0.39)
    s3d.at(fin, rx=90, rz=90, y=0.0, x=-0.0, z=0.12)
    s3d.at(fin, y=0.07)
    s3d.material(eye_l, 'plastic', color='#2b2233')
    eye_r = s3d.copy(eye_l)
    s3d.at(eye_l, x=0.08, y=0.02, z=0.07)
    s3d.at(eye_r, x=-0.08, y=0.02, z=0.07)
    save(s3d.group(name, body, tail, fin, eye_l, eye_r), name)


def lily():
    fresh()
    with s3d.facets(24, smooth=True):
        pad = s3d.cylinder('lily', 0.9, 0.04)
        notch = s3d.box('notch', 0.6, 0.12, 0.2)
    s3d.at(notch, x=0.3, z=-0.05, rz=10)
    pad = s3d.cut(pad, notch)
    s3d.material(pad, 'leaf', color=mottled('#4fae4a', '#6cc85a', 0.4, seed=5))
    save(pad, 'lily')


def stepping_stone():
    rock('stone', 0.9, 21, flat=0.28, colors=('#cfc6b8', '#e2dace'))


def main():
    only = set(sys.argv[1:])
    jobs = {
        'island': island, 'grass': grass_tufts,
        # low and wide, so its apples are in reach and in view
        'tree_apple': lambda: tree('tree_apple', ('#4fae4a', '#7ccf55'), 3, h=1.7, crown_d=2.9),
        'tree_blossom': lambda: tree('tree_blossom', ('#ff9fc8', '#ffc2dc'), 8, h=2.2, crown_d=2.4),
        'tree_round': lambda: tree('tree_round', ('#3f9e4a', '#69c45a'), 13, h=2.8, crown_d=2.2),
        'bush': lambda: bush('bush', ('#4fae4a', '#76c95a'), 4),
        'bush_flowers': lambda: bush('bush_flowers', ('#4fae4a', '#76c95a'), 6,
                                     flowers=['#ff7fb0', '#ffd84a', '#b48cff', '#ffffff']),
        'rock': lambda: rock('rock', 1.2, 4), 'rock_small': lambda: rock('rock_small', 0.6, 9),
        'stone': stepping_stone,
        'mushroom': lambda: mushroom('mushroom', '#ff4b4b'),
        'mushroom_big': lambda: mushroom('mushroom_big', '#ff7a3d', d=1.1),
        'flower_pink': lambda: flower('flower_pink', '#ff8fc0'),
        'flower_yellow': lambda: flower('flower_yellow', '#ffe14d', centre='#ff9a1f'),
        'flower_white': lambda: flower('flower_white', '#ffffff'),
        'flower_blue': lambda: flower('flower_blue', '#8fc8ff'),
        'apple': apple, 'apple_green': lambda: apple('apple_green', '#8fd14f'),
        'basket': basket,
        'fish_orange': lambda: fish('fish_orange', '#ff8a2a', '#ffb347'),
        'fish_blue': lambda: fish('fish_blue', '#4fa8ff', '#8fd0ff'),
        'lily': lily,
    }
    layout = {}
    for k, job in jobs.items():
        if only and k not in only:
            continue
        r = job()
        if isinstance(r, dict):
            layout[k] = r
    # where things are, in Godot's axes (x, y, z) with y up
    layout['pond'] = {'pos': [POND[0], WATER_Z, -POND[1]], 'r': POND_R, 'rz': POND_R * 0.85}
    layout['island'] = {'w': ISLAND_W, 'd': ISLAND_D, 'top': TOP}
    old = OUT / 'layout.json'
    if old.exists() and only:
        prev = json.loads(old.read_text())
        prev.update(layout)
        layout = prev
    old.write_text(json.dumps(layout, indent=1))


if __name__ == '__main__':
    main()
