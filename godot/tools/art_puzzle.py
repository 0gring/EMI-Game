# Art for the puzzle place (run inside make_art.py, its helpers in scope).
#
#   puzzle_portal.svg  - the hub's sign for this place: three big jigsaw pieces
#                        leaning together on a little wooden stand

import math as _m


def _jig_piece(x, y, w, h, tabs):
    """Path of a jigsaw piece at (x, y) size (w, h). tabs = (top, right,
    bottom, left), each +1 (tab out), -1 (hole) or 0 (flat)."""
    s = min(w, h)

    def edge(x0, y0, x1, y1, d):
        if d == 0:
            return f'L{x1:.1f},{y1:.1f} '
        L = _m.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = uy, -ux

        def P(a, b):
            al = L / 2 + (a - 0.5) * s
            return (x0 + ux * al + nx * b * s * d, y0 + uy * al + ny * b * s * d)

        pts = [P(0.36, 0), P(0.42, 0.06), P(0.28, 0.26), P(0.5, 0.27), P(0.72, 0.26), P(0.58, 0.06), P(0.64, 0)]
        f = lambda p: f'{p[0]:.1f},{p[1]:.1f}'
        return (f'L{f(pts[0])} C{f(pts[1])} {f(pts[2])} {f(pts[3])} '
                f'C{f(pts[4])} {f(pts[5])} {f(pts[6])} L{x1:.1f},{y1:.1f} ')

    t, r, b, l = tabs
    d = f'M{x:.1f},{y:.1f} '
    d += edge(x, y, x + w, y, t)
    d += edge(x + w, y, x + w, y + h, r)
    d += edge(x + w, y + h, x, y + h, b)
    d += edge(x, y + h, x, y, l)
    return d + 'Z'


_PZ_DEFS = (radial('pzO', [(0, '#ffd59a', 1), (0.55, '#ff9a1f', 1), (1, '#d8700a', 1)], 0.35, 0.3, 0.85)
            + radial('pzB', [(0, '#c4e6ff', 1), (0.55, '#4fa8ff', 1), (1, '#2a78d0', 1)], 0.35, 0.3, 0.85)
            + radial('pzP', [(0, '#ffd0e6', 1), (0.55, '#ff6fb0', 1), (1, '#d8408a', 1)], 0.35, 0.3, 0.85)
            + linear('pzWood', [(0, '#d89a5a', 1), (1, '#9a6230', 1)]))


def _placed(path, fill, line, rot, cx, cy, extra=''):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<path d="{path}" fill="#3a2010" fill-opacity="0.18" transform="translate(8,12)"/>'
            + fs(path, fill, line, 11) + extra + '</g>')


_blue = _jig_piece(70, 150, 190, 190, (0, 1, 0, 0))
_pink = _jig_piece(250, 120, 190, 190, (0, 0, 1, -1))
_orange = _jig_piece(150, 250, 210, 190, (-1, 0, 0, 0))

write('puzzle_portal', svg(
    # the little stand
    fs('M90,440 L422,440 L410,470 L102,470 Z', 'url(#pzWood)', '#6a4020', 9)
    + _placed(_blue, 'url(#pzB)', '#1f5aa0', -12, 165, 245,
              '<circle cx="130" cy="205" r="22" fill="#ffffff" fill-opacity="0.35"/>')
    + _placed(_pink, 'url(#pzP)', '#a82a68', 10, 345, 215,
              '<circle cx="300" cy="175" r="22" fill="#ffffff" fill-opacity="0.35"/>')
    + _placed(_orange, 'url(#pzO)', '#a8520a', -2, 255, 345,
              # a smiley on the front piece: the puzzle pictures are of friends
              '<circle cx="225" cy="330" r="13" fill="#3a1d2e"/><circle cx="290" cy="330" r="13" fill="#3a1d2e"/>'
              '<circle cx="230" cy="325" r="4" fill="#fff"/><circle cx="295" cy="325" r="4" fill="#fff"/>'
              '<path d="M220,370 C240,400 280,400 300,370" fill="none" stroke="#3a1d2e" stroke-width="10" stroke-linecap="round"/>'
              '<ellipse cx="205" cy="362" rx="16" ry="10" fill="#ff7fa8" fill-opacity="0.6"/>'
              '<ellipse cx="316" cy="362" rx="16" ry="10" fill="#ff7fa8" fill-opacity="0.6"/>'
              '<circle cx="190" cy="290" r="20" fill="#ffffff" fill-opacity="0.35"/>'),
    _PZ_DEFS))
