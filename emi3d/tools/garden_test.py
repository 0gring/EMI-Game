import numpy as np
import sand3d as s3d

s3d.empty_scene()
s3d.units("m")

def lollipop_tree(name, crown_d, h, color, seed):
    with s3d.facets(10, smooth=True):
        trunk = s3d.wire(name + "_trunk", s3d.spline([(0, 0, 0), (0.05, 0.02, h * 0.5), (0, 0, h)]), [(0, 0.28), (1, 0.16)])
    s3d.material(trunk, "bark", color="#8a5a3b")
    with s3d.facets(14, smooth=True):
        crown = s3d.sphere(name + "_crown", crown_d)
    s3d.displace(crown, crown_d * 0.05, crown_d * 0.4, seed=seed, step=crown_d / 12)
    s3d.material(crown, "leaf", color=color)
    s3d.at(crown, z=h - crown_d * 0.25)
    return s3d.group(name, trunk, crown)

with s3d.facets(48, smooth=True):
    island = s3d.dome("island", 16, 1.2)
s3d.displace(island, 0.25, 4, seed=3, direction="+Z", faces="side", step=0.4)
s3d.material(island, "grass", color=lambda x, y, z: np.stack(
    (0.42 + 0.06 * s3d.noise(x / 2, y / 2, 0, seed=1), 0.72 + 0.05 * s3d.noise(x / 2, y / 2, 0, seed=2), 0.30 + 0 * x), axis=-1))
trees = [lollipop_tree(f"tree{i}", d, h, c, i) for i, (d, h, c) in enumerate(
    [(2.2, 2.6, "#5cbf4a"), (1.8, 2.2, "#ff9fc8"), (2.0, 2.4, "#6fcf4f")])]
for t, (x, y) in zip(trees, [(-4, 3), (4.5, 2.5), (-5, -2.5)]):
    s3d.at(t, x=x, y=y, z=1.0)
with s3d.facets(12, smooth=True):
    rock = s3d.sphere("rock", 0.9)
s3d.displace(rock, 0.12, 0.5, seed=4, step=0.15)
s3d.material(rock, "rock", color="#a7a2b0")
s3d.at(rock, x=2, y=-3, z=1.0)
with s3d.facets(16, smooth=True):
    cap = s3d.dome("cap", 0.8, 0.45)
    stem = s3d.cylinder("stem", 0.25, 0.4)
s3d.material(cap, "plastic", color="#ff4b4b")
s3d.material(stem, "plastic", color="#fff4e0")
s3d.at(cap, z=0.38)
mush = s3d.group("mushroom", stem, cap)
s3d.at(mush, x=-1.5, y=-4, z=1.05)
scene = s3d.group("garden", island, *trees, rock, mush)
s3d.export(scene, "/tmp/claude-0/garden_test.glb", colors="vertex")
print("ok")
