#!/usr/bin/env python3
"""Generates the artwork for Emi's Magic Island (the Godot rebuild).

Every character is built from separate parts - head, body, ears, eyes, mouths,
tail - so the engine can animate them independently: ears that flop, eyes that
blink and follow her finger, a mouth that talks, a body that squashes and
stretches. Parts are SVG with gradient shading, a soft tinted outline and glossy
highlights.

Body parts are drawn in greys so one set serves every animal: the game tints
them with the species colour (modulate), and the light-to-dark greys become
light-to-dark shades of that colour, outline included. Eyes, mouths, noses and
inner ears keep their own colours.

Each part's pivot is the centre of its canvas, so a Sprite2D centred on it
rotates an ear around its base and a leg around the hip.

    python3 godot/tools/make_art.py      -> godot/art/*.svg
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'art'
OUT.mkdir(parents=True, exist_ok=True)

S = 512                      # canvas size of a part
C = S / 2                    # pivot

GREY = ['#ffffff', '#ececec', '#c9c9c9']      # light, base, shadow (tinted later)
LINE = '#6a6a6a'                               # outline, tinted darker by the colour
LW = 14                                        # outline width


def svg(body, defs='', w=S, h=S):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<defs>{defs}</defs>{body}</svg>')


def radial(id_, stops, cx=0.35, cy=0.3, r=0.85):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}" fx="{cx}" fy="{cy}">{s}</radialGradient>'


def linear(id_, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>'


SHADE = radial('shade', [(0, GREY[0], 1), (0.55, GREY[1], 1), (1, GREY[2], 1)])
GLOSS = radial('gloss', [(0, '#ffffff', 0.75), (1, '#ffffff', 0)], 0.5, 0.5, 0.5)
SHADOW_IN = radial('rim', [(0.6, '#000000', 0), (1, '#000000', 0.10)], 0.42, 0.38, 0.62)


def shaded(path, extra=''):
    """A grey, tintable shape: gradient fill, inner rim shadow, outline."""
    return (f'<path d="{path}" fill="url(#shade)"/>'
            f'<path d="{path}" fill="url(#rim)"/>{extra}'
            f'<path d="{path}" fill="none" stroke="{LINE}" stroke-width="{LW}" stroke-linejoin="round"/>')


def gloss(cx, cy, rx, ry, rot=-30):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" fill="url(#gloss)"/>'


def ellipse_path(cx, cy, rx, ry):
    return (f'M{cx - rx},{cy} a{rx},{ry} 0 1,0 {2 * rx},0 a{rx},{ry} 0 1,0 {-2 * rx},0 Z')


def write(name, content):
    (OUT / f'{name}.svg').write_text(content)


TINT_DEFS = SHADE + GLOSS + SHADOW_IN

# --- heads and bodies (tinted) ------------------------------------------------------

# A big round head, slightly wider than tall, the shape every cute character
# shares. Cheeks bulge a touch at the bottom.
HEAD = ('M256,70 C380,70 462,150 462,262 C462,372 382,446 256,446 '
        'C130,446 50,372 50,262 C50,150 132,70 256,70 Z')
write('head', svg(shaded(HEAD, gloss(190, 150, 90, 50)), TINT_DEFS))

# A soft bean of a body, wider at the bottom so it sits.
BODY = ('M256,96 C356,96 420,170 430,268 C442,388 368,452 256,452 '
        'C144,452 70,388 82,268 C92,170 156,96 256,96 Z')
write('body', svg(shaded(BODY, gloss(200, 170, 70, 40)), TINT_DEFS))

# Pale belly / muzzle patches (tinted with a light colour).
write('belly', svg(f'<ellipse cx="256" cy="300" rx="120" ry="130" fill="url(#shade)"/>', TINT_DEFS))
write('muzzle', svg(shaded(ellipse_path(256, 256, 150, 105), gloss(205, 215, 55, 25)), TINT_DEFS))

# Legs: a stubby rounded column, hip at the canvas centre, foot below.
LEG = 'M196,236 C196,206 316,206 316,236 L322,420 C324,470 188,470 190,420 Z'
write('leg', svg(shaded(LEG, gloss(232, 300, 18, 50, 0)), TINT_DEFS))

# Arms / paws hang from the shoulder at the centre.
ARM = 'M222,240 C222,218 290,218 290,240 L300,372 C302,412 214,412 212,372 Z'
write('arm', svg(shaded(ARM), TINT_DEFS))

# --- ears (tinted outer, separate pink inner) -----------------------------------------
# Base of every ear at the canvas centre, ear growing upward.

EARS = {
    'round': 'M256,300 C150,300 140,150 256,150 C372,150 362,300 256,300 Z',
    'pointy': 'M170,290 C186,200 220,110 256,70 C292,110 326,200 342,290 C300,312 212,312 170,290 Z',
    'long': 'M206,300 C176,190 196,30 256,24 C316,30 336,190 306,300 C290,316 222,316 206,300 Z',
    'floppy': 'M200,250 C160,250 120,330 130,420 C140,476 210,478 238,430 C262,388 280,300 300,262 C292,240 230,240 200,250 Z',
    'pig': 'M180,290 C180,230 220,150 300,130 C312,190 320,250 326,290 C290,312 216,312 180,290 Z',
}
INNER = {
    'round': 'M256,280 C190,280 186,190 256,190 C326,190 322,280 256,280 Z',
    'pointy': 'M206,282 C218,214 236,150 256,122 C276,150 294,214 306,282 C282,296 230,296 206,282 Z',
    'long': 'M228,292 C210,200 222,80 256,74 C290,80 302,200 284,292 C274,302 238,302 228,292 Z',
    'floppy': 'M206,290 C186,320 170,380 180,420 C188,446 220,444 232,418 C246,384 254,330 262,296 C248,284 218,282 206,290 Z',
    'pig': 'M208,282 C210,240 236,188 286,170 C294,212 298,252 300,282 C276,296 228,296 208,282 Z',
}
INNER_DEFS = radial('pink', [(0, '#ffd3e2', 1), (1, '#ff9fbf', 1)], 0.5, 0.35, 0.7)
for k, d in EARS.items():
    write(f'ear_{k}', svg(shaded(d), TINT_DEFS))
    write(f'ear_{k}_in', svg(f'<path d="{INNER[k]}" fill="url(#pink)"/>', INNER_DEFS))

# --- tails ------------------------------------------------------------------------------

write('tail_puff', svg(shaded('M256,170 C330,150 360,230 340,290 C320,350 230,360 196,310 '
                              'C160,260 190,186 256,170 Z', gloss(240, 210, 30, 20)), TINT_DEFS))
write('tail_long', svg(shaded('M256,256 C300,250 360,220 380,150 C392,110 440,110 440,150 '
                              'C436,240 360,300 268,296 C240,294 236,260 256,256 Z'), TINT_DEFS))
write('tail_curl', svg(
    f'<path d="M256,256 C300,256 330,226 320,196 C310,166 270,170 272,200 C274,222 300,222 300,206" '
    f'fill="none" stroke="{LINE}" stroke-width="34" stroke-linecap="round"/>'
    f'<path d="M256,256 C300,256 330,226 320,196 C310,166 270,170 272,200 C274,222 300,222 300,206" '
    f'fill="none" stroke="#e6e6e6" stroke-width="18" stroke-linecap="round"/>', TINT_DEFS))

# --- face parts (own colours) -------------------------------------------------------------

EYE_DEFS = (radial('iris', [(0, '#7a5ab0', 1), (0.55, '#3b2560', 1), (1, '#1c1030', 1)], 0.5, 0.65, 0.6)
            + radial('irisring', [(0.7, '#9f7fe0', 0), (1, '#c8a8ff', 0.55)], 0.5, 0.5, 0.5))
# Big, glossy, mostly-iris eyes - the single most important thing for cute.
write('eye', svg(
    '<ellipse cx="256" cy="256" rx="150" ry="178" fill="#1c1030"/>'
    '<ellipse cx="256" cy="262" rx="136" ry="164" fill="url(#iris)"/>'
    '<ellipse cx="256" cy="262" rx="136" ry="164" fill="url(#irisring)"/>'
    '<ellipse cx="300" cy="180" rx="58" ry="66" fill="#ffffff"/>'
    '<circle cx="196" cy="330" r="26" fill="#ffffff" fill-opacity="0.9"/>'
    '<circle cx="330" cy="262" r="14" fill="#ffffff" fill-opacity="0.7"/>', EYE_DEFS))
# A closed happy eye ^ ^, for laughing.
write('eye_happy', svg(
    '<path d="M136,300 C170,170 342,170 376,300" fill="none" stroke="#1c1030" stroke-width="46" '
    'stroke-linecap="round"/>'))

# Mouths. Fill and outline are separate shapes: Godot's SVG importer drops a
# path that has both a gradient fill and a stroke.
MOUTH_DEFS = (radial('mouthin', [(0, '#b23a5a', 1), (1, '#6a1530', 1)], 0.5, 0.3, 0.8)
              + radial('tongue', [(0, '#ffb0c4', 1), (1, '#ff6f96', 1)], 0.5, 0.3, 0.7))


def mouth(path, inner='', stroke=18):
    return (f'<path d="{path}" fill="#8a2340"/>{inner}'
            f'<path d="{path}" fill="none" stroke="#3a1d2e" stroke-width="{stroke}" stroke-linejoin="round"/>')


write('mouth_smile', svg(
    '<path d="M156,226 C196,320 316,320 356,226" fill="none" stroke="#3a1d2e" stroke-width="30" '
    'stroke-linecap="round"/>', MOUTH_DEFS))
write('mouth_open', svg(mouth(
    'M150,210 C170,360 342,360 362,210 C300,236 212,236 150,210 Z',
    '<path d="M200,300 C220,250 292,250 312,300 C292,336 220,336 200,300 Z" fill="#ff8aa8"/>'), MOUTH_DEFS))
write('mouth_o', svg(mouth(
    'M256,180 C300,180 322,220 322,262 C322,304 300,344 256,344 C212,344 190,304 190,262 C190,220 212,180 256,180 Z',
    '<ellipse cx="256" cy="300" rx="40" ry="28" fill="#ff8aa8"/>'), MOUTH_DEFS))
write('mouth_grin', svg(mouth(
    'M110,200 C130,400 382,400 402,200 C320,236 192,236 110,200 Z',
    '<path d="M136,214 C200,234 312,234 376,214 L370,240 C300,258 212,258 142,240 Z" fill="#ffffff"/>'
    '<path d="M196,330 C220,280 292,280 316,330 C292,360 220,360 196,330 Z" fill="#ff8aa8"/>'), MOUTH_DEFS))
write('mouth_tongue', svg(
    '<path d="M170,226 C210,300 302,300 342,226" fill="none" stroke="#3a1d2e" stroke-width="28" '
    'stroke-linecap="round"/>'
    '<path d="M226,270 C226,380 300,380 300,272 C280,290 246,290 226,270 Z" fill="#ff8aa8"/>'
    '<path d="M226,270 C226,380 300,380 300,272 C280,290 246,290 226,270 Z" fill="none" '
    'stroke="#3a1d2e" stroke-width="12"/>', MOUTH_DEFS))

NOSE_DEFS = radial('nose', [(0, '#6a4a6a', 1), (1, '#2a1626', 1)], 0.4, 0.3, 0.8)
write('nose', svg(
    '<path d="M196,226 C196,196 316,196 316,226 C316,262 276,300 256,300 C236,300 196,262 196,226 Z" '
    'fill="url(#nose)"/><ellipse cx="236" cy="222" rx="22" ry="12" fill="#ffffff" fill-opacity="0.6"/>', NOSE_DEFS))
PIGNOSE_DEFS = radial('pn', [(0, '#ffd0de', 1), (1, '#ff98b8', 1)], 0.4, 0.3, 0.8)
write('nose_pig', svg(
    '<ellipse cx="256" cy="256" rx="110" ry="80" fill="url(#pn)"/>'
    '<ellipse cx="256" cy="256" rx="110" ry="80" fill="none" stroke="#c06080" stroke-width="12"/>'
    '<ellipse cx="216" cy="262" rx="20" ry="30" fill="#a04060"/>'
    '<ellipse cx="296" cy="262" rx="20" ry="30" fill="#a04060"/>', PIGNOSE_DEFS))
write('cheek', svg('<ellipse cx="256" cy="256" rx="190" ry="120" fill="url(#blush)"/>',
                   radial('blush', [(0, '#ff7fa8', 0.7), (1, '#ff7fa8', 0)], 0.5, 0.5, 0.5)))
write('eye_patch', svg(shaded('M256,90 C360,90 420,200 400,300 C380,400 300,430 236,410 '
                              'C150,384 110,300 130,210 C148,140 190,90 256,90 Z'), TINT_DEFS))
write('whisker', svg('<path d="M60,240 L210,256 M60,300 L210,276" stroke="#5a4a5a" stroke-width="10" '
                     'stroke-linecap="round" fill="none"/>'))

# --- the unicorn's own pieces ----------------------------------------------------------------

HORN_DEFS = linear('horn', [(0, '#fff6c8', 1), (0.5, '#ffd84a', 1), (1, '#e8a31a', 1)], 0, 0, 1, 0)
write('horn', svg(
    '<path d="M222,330 L256,60 L290,330 C276,346 236,346 222,330 Z" fill="url(#horn)"/>'
    '<path d="M222,330 L256,60 L290,330 C276,346 236,346 222,330 Z" fill="none" '
    'stroke="#c98a10" stroke-width="10" stroke-linejoin="round"/>'
    '<path d="M228,300 L284,270 M236,236 L276,214 M244,170 L270,156 M250,110 L264,102" '
    'stroke="#c98a10" stroke-width="9" stroke-linecap="round"/>', HORN_DEFS))
MANE = [('#ff9ecf', '#ff6fb0'), ('#c9a4ff', '#9a6cf0'), ('#9fdcff', '#5ab4f0'), ('#ffe08a', '#ffc23d')]
for i, (a, b) in enumerate(MANE):
    d = radial(f'm{i}', [(0, '#ffffff', 1), (0.35, a, 1), (1, b, 1)], 0.35, 0.3, 0.8)
    write(f'mane_{i}', svg(
        f'<path d="M256,256 C190,250 150,190 176,130 C196,86 260,80 290,110 C330,90 380,120 370,170 '
        f'C364,214 320,256 256,256 Z" fill="url(#m{i})"/>', d))
d = ''.join(radial(f't{i}', [(0, '#ffffff', 1), (0.4, a, 1), (1, b, 1)], 0.4, 0.3, 0.9) for i, (a, b) in enumerate(MANE))
write('tail_rainbow', svg(''.join(
    f'<path d="M256,256 C{300 + i * 18},{250 - i * 30} {380 + i * 10},{200 - i * 40} {420 - i * 6},{120 - i * 18} '
    f'C{440 - i * 6},{170 - i * 20} {400 + i * 6},{270 - i * 20} 256,{276 - i * 4} Z" fill="url(#t{i})"/>'
    for i in range(4)), d))

# --- the world ---------------------------------------------------------------------------------

BALLOON_DEFS = (radial('bshade', [(0, '#ffffff', 1), (0.25, '#f4f4f4', 1), (0.8, '#bdbdbd', 1), (1, '#9a9a9a', 1)], 0.36, 0.3, 0.8)
                + radial('bgloss', [(0, '#ffffff', 0.95), (1, '#ffffff', 0)], 0.5, 0.5, 0.5))
write('balloon', svg(
    '<path d="M256,40 C376,40 440,140 436,236 C430,350 340,440 256,446 C172,440 82,350 76,236 '
    'C72,140 136,40 256,40 Z" fill="url(#bshade)"/>'
    '<path d="M234,446 L278,446 L266,470 L246,470 Z" fill="#b0b0b0"/>'
    '<ellipse cx="180" cy="150" rx="46" ry="76" transform="rotate(28 180 150)" fill="url(#bgloss)"/>'
    '<ellipse cx="330" cy="370" rx="20" ry="34" transform="rotate(28 330 370)" fill="#ffffff" fill-opacity="0.25"/>',
    BALLOON_DEFS, S, 512))

SPARK_DEFS = radial('sp', [(0, '#ffffff', 1), (0.18, '#ffffff', 0.9), (0.45, '#ffffff', 0.25), (1, '#ffffff', 0)], 0.5, 0.5, 0.5)
write('glow', svg('<circle cx="128" cy="128" r="128" fill="url(#sp)"/>', SPARK_DEFS, 256, 256))
write('star4', svg('<path d="M128,8 C138,96 160,118 248,128 C160,138 138,160 128,248 C118,160 96,138 8,128 '
                   'C96,118 118,96 128,8 Z" fill="#ffffff"/>', '', 256, 256))
write('star5', svg('<path d="M128,12 L160,92 L246,98 L180,152 L202,236 L128,190 L54,236 L76,152 L10,98 L96,92 Z" '
                   'fill="#ffffff" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>', '', 256, 256))
write('confetti', svg('<rect x="40" y="88" width="176" height="80" rx="20" fill="#ffffff"/>', '', 256, 256))
write('heart', svg('<path d="M128,226 C40,160 16,110 40,70 C64,34 112,40 128,82 C144,40 192,34 216,70 '
                   'C240,110 216,160 128,226 Z" fill="#ffffff"/>', '', 256, 256))


# --- scenery (own colours) --------------------------------------------------------------------

def blob(cx, cy, r, n=9, wob=0.12, seed=1):
    """A soft cauliflower outline: circles round a centre, as one smooth path."""
    import math
    pts = []
    for i in range(n):
        a = i / n * math.tau
        rr = r * (1 + wob * math.sin(i * 2.3 + seed))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.86))
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f} '
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ox, oy = mx - cx, my - cy
        k = 0.55
        d += f'Q{mx + ox * k:.1f},{my + oy * k:.1f} {x1:.1f},{y1:.1f} '
    return d + 'Z'


TREE_DEFS = (radial('leaf', [(0, '#c8f58a', 1), (0.5, '#7fd157', 1), (1, '#3f9a3a', 1)], 0.38, 0.3, 0.85)
             + radial('leaf2', [(0, '#a8e86a', 1), (1, '#3a8a35', 1)], 0.4, 0.3, 0.9)
             + linear('trunk', [(0, '#b07a4a', 1), (0.5, '#8a5a32', 1), (1, '#6a4224', 1)], 0, 0, 1, 0)
             + radial('apple', [(0, '#ffb0a0', 1), (0.4, '#ff4d5e', 1), (1, '#c8203a', 1)], 0.35, 0.3, 0.8))
canopy = blob(256, 200, 170, 11, 0.1, 2)
write('tree', svg(
    '<path d="M228,470 C236,400 234,320 220,250 L292,250 C278,320 276,400 284,470 Z" fill="url(#trunk)"/>'
    f'<path d="{blob(256, 225, 150, 9, 0.1, 5)}" fill="url(#leaf2)"/>'
    f'<path d="{canopy}" fill="url(#leaf)"/>'
    f'<path d="{canopy}" fill="none" stroke="#3a8a35" stroke-width="10"/>'
    '<ellipse cx="200" cy="130" rx="70" ry="40" transform="rotate(-25 200 130)" fill="#ffffff" fill-opacity="0.25"/>'
    + ''.join(f'<circle cx="{x}" cy="{y}" r="17" fill="url(#apple)"/><circle cx="{x - 5}" cy="{y - 6}" r="5" fill="#fff" fill-opacity="0.7"/>'
              for x, y in [(180, 200), (300, 150), (340, 250), (230, 290), (150, 280)]),
    TREE_DEFS, 512, 512))
write('bush', svg(
    f'<path d="{blob(256, 300, 160, 10, 0.12, 7)}" fill="url(#leaf)"/>'
    f'<path d="{blob(256, 300, 160, 10, 0.12, 7)}" fill="none" stroke="#3a8a35" stroke-width="10"/>'
    + ''.join(f'<circle cx="{x}" cy="{y}" r="14" fill="#ff85c8"/><circle cx="{x}" cy="{y}" r="6" fill="#ffe07a"/>'
              for x, y in [(180, 260), (300, 230), (350, 320), (220, 350), (140, 330)]),
    TREE_DEFS, 512, 512))
CLOUD_DEFS = radial('cl', [(0, '#ffffff', 1), (0.7, '#ffffff', 1), (1, '#e2ecff', 1)], 0.45, 0.3, 0.8)
CLOUD = ('M120,330 C60,330 40,260 96,236 C90,170 170,140 214,180 C236,110 340,104 366,176 '
         'C420,150 480,200 456,262 C500,290 480,340 430,340 Z')
write('cloud', svg(f'<path d="{CLOUD}" fill="url(#cl)"/>'
                   '<path d="M130,330 C200,350 400,350 440,334 L430,340 L120,340 Z" fill="#d6e4ff" fill-opacity="0.8"/>',
                   CLOUD_DEFS, 512, 512))
for name, petal, centre in [('flower_pink', '#ff85c8', '#ffd84a'), ('flower_yellow', '#ffd84a', '#ff9a3d'),
                            ('flower_white', '#ffffff', '#ffd84a'), ('flower_blue', '#8fc8ff', '#ffffff')]:
    import math
    petals = ''.join(
        f'<ellipse cx="{128 + math.cos(i / 6 * math.tau) * 46:.1f}" cy="{96 + math.sin(i / 6 * math.tau) * 46:.1f}" '
        f'rx="34" ry="24" transform="rotate({i * 60} {128 + math.cos(i / 6 * math.tau) * 46:.1f} '
        f'{96 + math.sin(i / 6 * math.tau) * 46:.1f})" fill="{petal}" stroke="#00000022" stroke-width="3"/>'
        for i in range(6))
    write(name, svg(
        '<path d="M128,250 C124,200 132,160 128,110" stroke="#4fb84a" stroke-width="10" fill="none"/>'
        '<path d="M128,200 C100,190 86,170 92,156 C112,160 126,176 128,200 Z" fill="#5fcf5f"/>'
        f'{petals}<circle cx="128" cy="96" r="26" fill="{centre}"/>'
        '<circle cx="120" cy="88" r="8" fill="#ffffff" fill-opacity="0.6"/>', '', 256, 256))
write('grass', svg(''.join(
    f'<path d="M{x},256 Q{x + d},{150} {x + d * 2},{h} Q{x + d + 8},{150} {x + 16},256 Z" fill="{c}"/>'
    for x, d, h, c in [(10, 6, 60, '#5fbf4a'), (40, -8, 30, '#7fd65a'), (70, 10, 50, '#4fae3f'),
                       (100, -4, 20, '#8fe06a'), (130, 8, 40, '#5fbf4a'), (160, -10, 60, '#7fd65a'),
                       (190, 6, 30, '#4fae3f'), (220, -6, 50, '#6fcf52')]), '', 256, 256))
BASKET_DEFS = (linear('wick', [(0, '#e8b46a', 1), (1, '#a8702e', 1)])
               + linear('cloth', [(0, '#ff8aa8', 1), (1, '#e0507a', 1)]))
write('basket', svg(
    '<path d="M120,200 C120,80 392,80 392,200" fill="none" stroke="#a8702e" stroke-width="22"/>'
    '<path d="M150,130 C200,90 320,90 362,130 L380,210 L130,210 Z" fill="url(#cloth)"/>'
    '<circle cx="200" cy="150" r="34" fill="#ff4d5e"/><circle cx="270" cy="140" r="30" fill="#ffd84a"/>'
    '<circle cx="320" cy="165" r="28" fill="#7fd157"/>'
    '<path d="M90,200 L422,200 L392,430 C380,456 132,456 120,430 Z" fill="url(#wick)"/>'
    + ''.join(f'<path d="M{100 + i * 4},{240 + i * 45} L{412 - i * 4},{240 + i * 45}" stroke="#8a5a24" stroke-width="8" stroke-opacity="0.5"/>' for i in range(4))
    + '<path d="M90,200 L422,200 L392,430 C380,456 132,456 120,430 Z" fill="none" stroke="#7a4a1a" stroke-width="12" stroke-linejoin="round"/>',
    BASKET_DEFS))
write('butterfly_wing', svg(
    '<path d="M256,256 C300,140 430,120 440,200 C450,270 360,290 256,256 Z" fill="#ffffff"/>'
    '<path d="M256,256 C330,280 400,330 370,380 C340,420 280,360 256,256 Z" fill="#ffffff"/>'
    '<circle cx="380" cy="200" r="26" fill="#ffffff" fill-opacity="0.5" stroke="#00000030" stroke-width="6"/>'))


# --- food --------------------------------------------------------------------------------------
# Fill and outline are separate shapes again (see the mouths).


def fs(d, fill, stroke, w=12):
    return f'<path d="{d}" fill="{fill}"/><path d="{d}" fill="none" stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"/>'


def shine(cx, cy, rx, ry, rot=-30, a=0.6):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" fill="#ffffff" fill-opacity="{a}"/>'


LEAF = '#4fb84a'
FD = (radial('apl', [(0, '#ff9a9a', 1), (0.45, '#ff3d4e', 1), (1, '#b81830', 1)], 0.35, 0.3, 0.8)
      + radial('car', [(0, '#ffc078', 1), (1, '#f06a10', 1)], 0.3, 0.3, 0.9)
      + radial('str', [(0, '#ff9aa5', 1), (1, '#d8203a', 1)], 0.35, 0.3, 0.8)
      + radial('fsh', [(0, '#c8ecff', 1), (1, '#3f96d6', 1)], 0.35, 0.3, 0.8)
      + radial('bone', [(0, '#ffffff', 1), (1, '#e9dcc0', 1)], 0.35, 0.3, 0.8)
      + radial('ck', [(0, '#f6c47a', 1), (1, '#c98a3a', 1)], 0.35, 0.3, 0.8)
      + radial('grp', [(0, '#e0c0ff', 1), (1, '#7a3ad0', 1)], 0.35, 0.3, 0.8)
      + radial('chz', [(0, '#fff3a0', 1), (1, '#f6c22a', 1)], 0.35, 0.3, 0.8)
      + radial('ban', [(0, '#fff6b0', 1), (1, '#f0c020', 1)], 0.35, 0.3, 0.8))
write('food_apple', svg(
    fs('M256,140 C320,90 430,120 420,250 C412,370 330,440 256,420 C182,440 100,370 92,250 C82,120 192,90 256,140 Z', 'url(#apl)', '#8a1020')
    + '<path d="M256,150 C258,110 270,80 290,64" stroke="#6a4226" stroke-width="16" fill="none" stroke-linecap="round"/>'
    + fs('M280,90 C320,50 380,60 392,80 C360,110 310,110 280,90 Z', LEAF, '#2f8a30', 8) + shine(180, 210, 34, 60), FD))
write('food_carrot', svg(
    fs('M180,120 C230,100 330,120 360,160 C330,280 260,400 190,450 C170,380 160,240 180,120 Z', 'url(#car)', '#b84a08')
    + ''.join(f'<path d="M{200 + i * 8},{200 + i * 60} L{250 + i * 4},{210 + i * 60}" stroke="#c8580a" stroke-width="8" stroke-linecap="round"/>' for i in range(3))
    + fs('M250,120 C230,60 240,30 260,20 C276,50 270,90 262,120 Z', LEAF, '#2f8a30', 8)
    + fs('M270,124 C300,70 340,60 360,64 C350,100 310,120 270,124 Z', LEAF, '#2f8a30', 8)
    + fs('M236,126 C200,80 170,76 152,84 C170,116 206,128 236,126 Z', LEAF, '#2f8a30', 8), FD))
write('food_strawberry', svg(
    fs('M256,160 C360,130 440,200 410,280 C380,370 300,440 256,450 C212,440 132,370 102,280 C72,200 152,130 256,160 Z', 'url(#str)', '#9a1028')
    + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="9" ry="14" fill="#ffe9a8"/>' for x, y in
              [(190, 230), (256, 220), (322, 230), (160, 300), (220, 300), (290, 300), (350, 300), (200, 370), (256, 380), (312, 370)])
    + fs('M256,170 C220,130 170,130 150,140 C180,170 220,176 256,170 C292,176 332,170 362,140 C342,130 292,130 256,170 Z', LEAF, '#2f8a30', 8)
    + shine(180, 230, 22, 40), FD))
write('food_fish', svg(
    fs('M90,256 C150,160 300,150 380,240 L460,180 C450,240 450,272 460,332 L380,272 C300,362 150,352 90,256 Z', 'url(#fsh)', '#2a6aa8')
    + '<circle cx="160" cy="236" r="20" fill="#ffffff"/><circle cx="156" cy="236" r="11" fill="#1c1030"/>'
    + '<path d="M230,200 C250,240 250,272 230,312" stroke="#2a6aa8" stroke-width="10" fill="none" stroke-linecap="round"/>'
    + shine(260, 210, 60, 16, -10, 0.5), FD))
write('food_bone', svg(
    fs('M150,180 C110,150 130,90 180,110 C200,70 260,100 236,150 L330,250 C380,226 420,280 380,310 C410,350 350,390 320,350 L226,250 '
       'C176,274 136,220 176,196 C164,190 156,186 150,180 Z', 'url(#bone)', '#a89070'), FD))
write('food_cookie', svg(
    fs('M256,90 C360,90 430,160 430,256 C430,352 360,422 256,422 C152,422 82,352 82,256 C82,160 152,90 256,90 Z', 'url(#ck)', '#8a5a24')
    + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="22" ry="18" fill="#5a3418" transform="rotate({r} {x} {y})"/>' for x, y, r in
              [(190, 190, 10), (300, 170, -20), (330, 280, 30), (220, 300, -10), (160, 270, 40), (270, 360, 5), (360, 220, 0)])
    + shine(180, 160, 50, 22), FD))
write('food_grapes', svg(
    '<path d="M256,100 C258,70 270,50 290,40" stroke="#6a4226" stroke-width="14" fill="none" stroke-linecap="round"/>'
    + fs('M270,80 C320,40 380,60 390,90 C350,110 300,104 270,80 Z', LEAF, '#2f8a30', 8)
    + ''.join(fs(f'M{x - 44},{y} a44,44 0 1,0 88,0 a44,44 0 1,0 -88,0 Z', 'url(#grp)', '#5a2aa0', 8) + shine(x - 14, y - 16, 10, 16, -30, 0.6)
              for x, y in [(200, 150), (290, 150), (160, 230), (250, 230), (340, 230), (200, 310), (300, 310), (250, 390)]), FD))
write('food_cheese', svg(
    fs('M90,330 L250,140 C330,150 400,190 430,240 L430,380 L90,380 Z', 'url(#chz)', '#c89a10')
    + fs('M90,330 L430,240 L430,250 L90,340 Z', '#ffe680', '#c89a10', 6)
    + '<circle cx="180" cy="340" r="22" fill="#e8b018"/><circle cx="330" cy="320" r="30" fill="#e8b018"/><circle cx="260" cy="270" r="14" fill="#e8b018"/>', FD))
write('food_banana', svg(
    fs('M110,170 C140,330 300,420 430,330 C420,310 410,300 400,296 C300,340 190,300 150,150 C140,150 120,160 110,170 Z', 'url(#ban)', '#b88a10')
    + '<path d="M110,170 L96,140 L130,150 Z" fill="#6a4a20"/>', FD))
write('plate', svg(
    '<ellipse cx="256" cy="270" rx="220" ry="150" fill="#d9dcf5"/>'
    '<ellipse cx="256" cy="256" rx="220" ry="150" fill="#ffffff"/>'
    '<ellipse cx="256" cy="256" rx="150" ry="98" fill="#f1f2ff"/>'
    '<ellipse cx="256" cy="256" rx="220" ry="150" fill="none" stroke="#c9cdf0" stroke-width="10"/>'))
write('present', svg(
    fs('M110,230 L402,230 L392,450 L120,450 Z', '#ff6fb0', '#c83a7a')
    + fs('M90,170 L422,170 L422,240 L90,240 Z', '#ff8ac4', '#c83a7a')
    + '<rect x="234" y="170" width="44" height="280" fill="#ffd84a"/>'
    + fs('M256,170 C200,90 140,110 170,160 C190,180 230,176 256,170 C282,176 322,180 342,160 C372,110 312,90 256,170 Z', '#ffd84a', '#d8a010', 8)))
print(f'wrote {len(list(OUT.glob("*.svg")))} parts to {OUT}')
