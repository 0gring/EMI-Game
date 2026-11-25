# Memory cards: a glossy starry lilac back, a white face with a pastel window
# for the animal, and the stack of cards that stands for the place on the hub.
# Runs inside make_art.py, so every helper there is in scope.

import math

CW, CH, CR = 360, 470, 46          # card size and corner radius on a 512 canvas
CX0, CY0 = (512 - CW) / 2, (512 - CH) / 2


def rrect(x, y, w, h, r):
    return (f'M{x + r},{y} L{x + w - r},{y} Q{x + w},{y} {x + w},{y + r} L{x + w},{y + h - r} '
            f'Q{x + w},{y + h} {x + w - r},{y + h} L{x + r},{y + h} Q{x},{y + h} {x},{y + h - r} '
            f'L{x},{y + r} Q{x},{y} {x + r},{y} Z')


def star4(cx, cy, s):
    return (f'M{cx},{cy - s} C{cx + s * 0.12},{cy - s * 0.12} {cx + s * 0.12},{cy - s * 0.12} {cx + s},{cy} '
            f'C{cx + s * 0.12},{cy + s * 0.12} {cx + s * 0.12},{cy + s * 0.12} {cx},{cy + s} '
            f'C{cx - s * 0.12},{cy + s * 0.12} {cx - s * 0.12},{cy + s * 0.12} {cx - s},{cy} '
            f'C{cx - s * 0.12},{cy - s * 0.12} {cx - s * 0.12},{cy - s * 0.12} {cx},{cy - s} Z')


def star5(cx, cy, ro, ri, rot=0.0):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + rot + i * math.pi / 5
        r = ro if i % 2 == 0 else ri
        pts.append(f'{cx + math.cos(a) * r:.1f},{cy + math.sin(a) * r:.1f}')
    return 'M' + ' L'.join(pts) + ' Z'


def card_back(x0=CX0, y0=CY0, w=CW, h=CH, r=CR):
    body = rrect(x0, y0, w, h, r)
    inner = rrect(x0 + 22, y0 + 22, w - 44, h - 44, r - 16)
    sparkles = ''
    # a little constellation, scaled into the card
    pts = [(0.2, 0.18, 14), (0.78, 0.14, 10), (0.84, 0.42, 16), (0.16, 0.56, 11), (0.3, 0.84, 15),
           (0.74, 0.8, 12), (0.52, 0.12, 8), (0.88, 0.66, 8), (0.12, 0.34, 7), (0.6, 0.9, 7)]
    for fx, fy, s in pts:
        sparkles += f'<path d="{star4(x0 + fx * w, y0 + fy * h, s * w / CW)}" fill="#ffffff" fill-opacity="0.75"/>'
    dots = ''.join(f'<circle cx="{x0 + fx * w:.1f}" cy="{y0 + fy * h:.1f}" r="{3.5 * w / CW:.1f}" fill="#ffffff" fill-opacity="0.45"/>'
                   for fx, fy in [(0.35, 0.3), (0.66, 0.28), (0.25, 0.7), (0.8, 0.55), (0.45, 0.76), (0.6, 0.62)])
    cx, cy = x0 + w / 2, y0 + h / 2
    big = star5(cx, cy, 82 * w / CW, 36 * w / CW)
    return (f'<path d="{rrect(x0 + 6, y0 + 14, w, h, r)}" fill="#3a2470" fill-opacity="0.28"/>'
            f'<path d="{body}" fill="url(#mback)"/>'
            f'<path d="{body}" fill="url(#mrim)"/>'
            f'{dots}{sparkles}'
            f'<path d="{inner}" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="{9 * w / CW:.1f}" '
            f'stroke-dasharray="{2 * w / CW:.1f} {18 * w / CW:.1f}" stroke-linecap="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{105 * w / CW:.1f}" fill="url(#mhalo)"/>'
            f'<path d="{big}" fill="url(#mgold)"/>'
            f'<path d="{big}" fill="none" stroke="#e8a01a" stroke-width="{8 * w / CW:.1f}" stroke-linejoin="round"/>'
            f'<ellipse cx="{cx - 18 * w / CW:.1f}" cy="{cy - 30 * w / CW:.1f}" rx="{16 * w / CW:.1f}" ry="{24 * w / CW:.1f}" '
            f'transform="rotate(-30 {cx - 18 * w / CW:.1f} {cy - 30 * w / CW:.1f})" fill="#ffffff" fill-opacity="0.65"/>'
            f'<path d="M{x0 + 30},{y0 + 60} C{x0 + 60},{y0 + 26} {x0 + 140 * w / CW},{y0 + 20} {x0 + 190 * w / CW},{y0 + 22} '
            f'L{x0 + 60},{y0 + 150 * h / CH} C{x0 + 34},{y0 + 120 * h / CH} {x0 + 26},{y0 + 90} {x0 + 30},{y0 + 60} Z" '
            f'fill="#ffffff" fill-opacity="0.22"/>'
            f'<path d="{body}" fill="none" stroke="#5a3fc0" stroke-width="10"/>')


MEM_DEFS = (radial('mback', [(0, '#c9b8ff', 1), (0.55, '#8f7cff', 1), (1, '#5b44d6', 1)], 0.35, 0.25, 0.95)
            + radial('mrim', [(0.65, '#000000', 0), (1, '#1a0a50', 0.25)], 0.45, 0.4, 0.7)
            + radial('mhalo', [(0, '#fff6c8', 0.75), (1, '#fff6c8', 0)], 0.5, 0.5, 0.5)
            + radial('mgold', [(0, '#fffbe0', 1), (0.45, '#ffd84a', 1), (1, '#f0a81a', 1)], 0.4, 0.3, 0.8)
            + linear('mface', [(0, '#ffffff', 1), (1, '#e9e6f4', 1)])
            + radial('mwin', [(0, '#ffffff', 1), (0.7, '#f2f2f2', 1), (1, '#d8d8d8', 1)], 0.5, 0.35, 0.8))

write('memory_back', svg(card_back(), MEM_DEFS))

face = rrect(CX0, CY0, CW, CH, CR)
win = rrect(CX0 + 24, CY0 + 24, CW - 48, CH - 48, CR - 18)
write('memory_face', svg(
    f'<path d="{rrect(CX0 + 6, CY0 + 14, CW, CH, CR)}" fill="#3a2470" fill-opacity="0.22"/>'
    f'<path d="{face}" fill="url(#mface)"/>'
    f'<path d="{face}" fill="none" stroke="#c9c2e8" stroke-width="10"/>', MEM_DEFS))
# the pastel window behind the animal: grey, tinted per animal at runtime
write('memory_window', svg(f'<path d="{win}" fill="url(#mwin)"/>', MEM_DEFS))
# a soft halo that glows round a matched card
write('memory_glow', svg(
    f'<path d="{rrect(CX0 - 30, CY0 - 30, CW + 60, CH + 60, CR + 30)}" fill="url(#mglow)"/>',
    radial('mglow', [(0.55, '#fff3a0', 0.9), (1, '#fff3a0', 0)], 0.5, 0.5, 0.55)))

# --- the hub object: a fan of three cards, one turned to show a star -----------------------

def placed(content, angle, dx, dy, s):
    return f'<g transform="translate({256 + dx},{300 + dy}) rotate({angle}) scale({s}) translate(-256,-256)">{content}</g>'


front = (f'<path d="{rrect(CX0 + 6, CY0 + 14, CW, CH, CR)}" fill="#3a2470" fill-opacity="0.22"/>'
         f'<path d="{face}" fill="url(#mface)"/>'
         f'<path d="{win}" fill="#ffe3ef"/>'
         f'<path d="{star5(256, 250, 110, 48)}" fill="url(#mgold)"/>'
         f'<path d="{star5(256, 250, 110, 48)}" fill="none" stroke="#e8a01a" stroke-width="10" stroke-linejoin="round"/>'
         f'<circle cx="222" cy="240" r="14" fill="#3b2560"/><circle cx="290" cy="240" r="14" fill="#3b2560"/>'
         f'<circle cx="226" cy="235" r="5" fill="#fff"/><circle cx="294" cy="235" r="5" fill="#fff"/>'
         f'<path d="M232,280 C246,298 270,298 284,280" fill="none" stroke="#3b2560" stroke-width="9" stroke-linecap="round"/>'
         f'<path d="{face}" fill="none" stroke="#c9c2e8" stroke-width="10"/>')
write('memory_portal', svg(
    placed(card_back(), -18, -95, 14, 0.54)
    + placed(card_back(), 15, 95, 10, 0.54)
    + placed(front, -2, 0, -14, 0.64)
    + f'<path d="{star4(110, 90, 26)}" fill="#ffffff"/>'
    + f'<path d="{star4(420, 120, 18)}" fill="#fff3a0"/>'
    + f'<path d="{star4(400, 60, 12)}" fill="#ffffff"/>', MEM_DEFS))
