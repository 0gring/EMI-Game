# Art for the garden (godot/scripts/garden.gd). Runs inside make_art.py, so
# svg, radial, linear, shaded, fs, shine, blob, write and TINT_DEFS are in scope.
#
# Plants are drawn with their base at the bottom centre of the canvas; the scene
# offsets them so they grow up out of the soil. Petals of the tintable flowers
# are grey (like the animals' bodies) and take the flower's colour in the game.

import math as _m

GD = (radial('gsoil', [(0, '#b07a4c', 1), (0.6, '#7a4c2a', 1), (1, '#5a341a', 1)], 0.45, 0.3, 0.8)
      + radial('gmound', [(0, '#9a6a40', 1), (1, '#5e3a1c', 1)], 0.45, 0.3, 0.8)
      + linear('gstem', [(0, '#7fd157', 1), (1, '#3f9a3a', 1)], 0, 0, 1, 0)
      + radial('gleaf', [(0, '#b8f07a', 1), (0.6, '#5fbf4a', 1), (1, '#2f8a30', 1)], 0.35, 0.3, 0.9)
      + radial('gsunp', [(0, '#fff3a0', 1), (0.6, '#ffc61a', 1), (1, '#e8930a', 1)], 0.5, 0.2, 0.9)
      + radial('gsunc', [(0, '#a06a3a', 1), (0.7, '#5a3418', 1), (1, '#3a2010', 1)], 0.4, 0.35, 0.8)
      + radial('gdaisyc', [(0, '#fff6a0', 1), (1, '#f0b020', 1)], 0.4, 0.35, 0.8)
      + radial('gmagic', [(0, '#ffffff', 1), (0.35, '#fff3b0', 1), (0.75, '#ff9ee0', 1), (1, '#b98cff', 1)], 0.5, 0.5, 0.6)
      + radial('gmglow', [(0, '#fff6c0', 0.9), (1, '#ff9ee0', 0)], 0.5, 0.5, 0.5)
      + radial('gsun', [(0, '#fffbe0', 1), (0.5, '#ffe066', 1), (1, '#ffb52a', 1)], 0.4, 0.35, 0.75)
      + linear('gcan', [(0, '#9fdcff', 1), (0.5, '#57b8f0', 1), (1, '#2f8fd0', 1)], 0, 0, 1, 0)
      + radial('gpud', [(0, '#c8f0ff', 1), (1, '#5ab4e8', 1)], 0.4, 0.3, 0.8)
      + linear('gwrap', [(0, '#ffd0e6', 1), (1, '#ff7ab8', 1)], 0, 0, 1, 0)
      + radial('gbee', [(0, '#fff3a0', 1), (1, '#f0b010', 1)], 0.4, 0.3, 0.8))
GDT = TINT_DEFS + GD

# --- the ground ----------------------------------------------------------------------------

# A raised bed of dark soil, wider than tall, with a lighter crumbly top.
SOIL = 'M40,150 C40,92 140,66 256,66 C372,66 472,92 472,150 C472,206 372,232 256,232 C140,232 40,206 40,150 Z'
write('garden_soil', svg(
    '<ellipse cx="256" cy="176" rx="226" ry="64" fill="#3a2a10" fill-opacity="0.25"/>'
    + fs(SOIL, 'url(#gsoil)', '#4a2a10', 10)
    + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.6:.1f}" fill="{c}"/>' for x, y, r, c in
              [(140, 120, 12, '#c89a6a'), (300, 104, 9, '#c89a6a'), (380, 150, 11, '#4a2a10'), (200, 180, 8, '#4a2a10'),
               (330, 190, 10, '#c89a6a'), (110, 168, 7, '#4a2a10'), (250, 140, 6, '#d8aa7a'), (420, 120, 7, '#d8aa7a')])
    + '<path d="M90,112 C160,84 340,84 420,108" stroke="#d8aa7a" stroke-width="8" stroke-opacity="0.5" fill="none" stroke-linecap="round"/>',
    GD, 512, 256))
write('garden_mound', svg(
    fs('M150,200 C160,130 352,130 362,200 Z', 'url(#gmound)', '#4a2a10', 10)
    + '<ellipse cx="220" cy="168" rx="18" ry="9" fill="#c89a6a"/>', GD, 512, 256))
write('garden_seed', svg(
    fs('M64,20 C100,30 110,90 64,110 C18,90 28,30 64,20 Z', '#c8884a', '#6a3a14', 6)
    + shine(52, 50, 8, 18, 20, 0.6), '', 128, 128))
write('garden_puddle', svg(
    fs('M40,140 C30,90 140,70 220,82 C300,60 470,80 476,136 C482,196 330,214 240,206 C140,214 50,190 40,140 Z', 'url(#gpud)', '#3a8ac8', 8)
    + shine(170, 112, 60, 14, -5, 0.7) + shine(360, 150, 30, 8, -5, 0.5), GD, 512, 256))

# --- plants ------------------------------------------------------------------------------------

LEAF = 'M0,0 C30,-40 90,-50 130,-20 C90,10 40,20 0,0 Z'


def leaf(x, y, rot, s=1.0):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})">'
            + fs(LEAF, 'url(#gleaf)', '#2f8a30', 7)
            + '<path d="M6,-2 C50,-20 90,-22 120,-18" stroke="#2f8a30" stroke-width="4" fill="none" stroke-opacity="0.6"/></g>')


write('garden_sprout', svg(
    '<path d="M128,250 C126,210 130,180 128,150" stroke="url(#gstem)" stroke-width="16" fill="none" stroke-linecap="round"/>'
    + leaf(128, 156, -160, 0.8) + leaf(128, 150, -20, 0.8), GD, 256, 256))
# Tall stem with two leaves; base at the bottom, the head goes at the top (y=40).
write('garden_stem', svg(
    '<path d="M128,506 C116,400 142,300 124,200 C112,130 132,80 128,40" stroke="#2f8a30" stroke-width="26" fill="none" stroke-linecap="round"/>'
    '<path d="M128,506 C116,400 142,300 124,200 C112,130 132,80 128,40" stroke="url(#gstem)" stroke-width="16" fill="none" stroke-linecap="round"/>'
    + leaf(126, 360, -150, 1.0) + leaf(130, 270, -30, 0.95), GD, 256, 512))
# Bud: grey petal tip (tinted) and green sepals cupping it.
write('garden_bud', svg(shaded('M128,40 C180,70 190,150 128,196 C66,150 76,70 128,40 Z',
                               gloss(110, 100, 14, 30, 10)), GDT, 256, 256))
write('garden_sepal', svg(
    fs('M70,150 C90,190 110,206 128,212 C146,206 166,190 186,150 C160,180 140,170 128,140 C116,170 96,180 70,150 Z', '#5fbf4a', '#2f8a30', 6),
    '', 256, 256))

# Flower heads, centred.
petals = ''
for i in range(10):
    a = i * 36
    petals += (f'<g transform="rotate({a} 256 256)">'
               + shaded('M256,256 C196,200 206,70 256,52 C306,70 316,200 256,256 Z') + '</g>')
write('garden_daisy', svg(petals, GDT))
write('garden_daisy_c', svg(
    '<circle cx="128" cy="128" r="70" fill="url(#gdaisyc)"/>'
    '<circle cx="128" cy="128" r="70" fill="none" stroke="#c8800a" stroke-width="8"/>'
    + ''.join(f'<circle cx="{128 + _m.cos(k * 2.4) * (12 + k * 4):.1f}" cy="{128 + _m.sin(k * 2.4) * (12 + k * 4):.1f}" r="5" fill="#c8800a" fill-opacity="0.6"/>' for k in range(12))
    + shine(105, 100, 18, 10, -30, 0.7), GD, 256, 256))

TULIP = ('M256,420 C150,420 110,320 120,170 C160,200 190,210 206,190 C220,140 236,110 256,90 '
         'C276,110 292,140 306,190 C322,210 352,200 392,170 C402,320 362,420 256,420 Z')
write('garden_tulip', svg(
    shaded(TULIP, gloss(190, 260, 30, 80, 10))
    + '<path d="M256,420 C220,360 214,260 256,170" stroke="#000000" stroke-opacity="0.12" stroke-width="10" fill="none"/>', GDT))

rose = ''
for ring, (rr, n, off) in enumerate([(170, 7, 0), (125, 6, 20), (80, 5, 40)]):
    for i in range(n):
        a = _m.radians(i * 360 / n + off)
        cx, cy = 256 + _m.cos(a) * rr * 0.55, 256 + _m.sin(a) * rr * 0.55
        rose += shaded(ellipse_path(round(cx, 1), round(cy, 1), round(rr * 0.6, 1), round(rr * 0.5, 1)))
rose += shaded(ellipse_path(256, 256, 46, 40))
rose += '<path d="M236,250 C236,226 280,226 282,252 C284,276 246,280 244,258" stroke="#555" stroke-opacity="0.5" stroke-width="8" fill="none" stroke-linecap="round"/>'
write('garden_rose', svg(rose, GDT))

sun_p = ''
for i in range(18):
    sun_p += (f'<g transform="rotate({i * 20} 256 256)">'
              + fs('M256,256 C232,190 236,90 256,52 C276,90 280,190 256,256 Z', 'url(#gsunp)', '#c87a0a', 6) + '</g>')
write('garden_sunflower', svg(
    sun_p + '<circle cx="256" cy="256" r="104" fill="url(#gsunc)"/>'
    + ''.join(f'<circle cx="{256 + _m.cos(k * 2.4) * (8 + k * 3.4):.1f}" cy="{256 + _m.sin(k * 2.4) * (8 + k * 3.4):.1f}" r="5" fill="#e8b060" fill-opacity="0.45"/>' for k in range(26))
    + '<circle cx="256" cy="256" r="104" fill="none" stroke="#3a2010" stroke-width="8"/>', GD))

star = ''
pts = []
for i in range(12):
    r = 230 if i % 2 == 0 else 110
    a = _m.radians(i * 30 - 90)
    pts.append(f'{256 + _m.cos(a) * r:.1f},{256 + _m.sin(a) * r:.1f}')
STAR = 'M' + ' L'.join(pts) + ' Z'
write('garden_magic', svg(
    '<circle cx="256" cy="256" r="250" fill="url(#gmglow)"/>'
    + fs(STAR, 'url(#gmagic)', '#c878e0', 10)
    + '<circle cx="256" cy="256" r="56" fill="#fff8d0"/><circle cx="240" cy="236" r="16" fill="#ffffff"/>', GD))

# --- tools, sky friends, visitors ------------------------------------------------------------

write('garden_can', svg(
    fs('M150,210 L370,210 C388,210 396,226 394,246 L380,400 C378,424 360,438 338,438 L182,438 C160,438 142,424 140,400 L126,246 '
       'C124,226 132,210 150,210 Z', 'url(#gcan)', '#1f6aa8', 12)
    + fs('M140,270 L40,170 L22,190 L60,206 L130,318 Z', 'url(#gcan)', '#1f6aa8', 12)
    + fs('M10,150 C40,140 62,160 60,190 C40,210 10,200 0,180 Z', '#9fdcff', '#1f6aa8', 10)
    + '<path d="M180,210 C180,120 340,120 340,210" stroke="#1f6aa8" stroke-width="22" fill="none"/>'
    + '<path d="M180,210 C180,120 340,120 340,210" stroke="#57b8f0" stroke-width="10" fill="none"/>'
    + shine(190, 300, 18, 70, 0, 0.5)
    + '<circle cx="290" cy="330" r="34" fill="#ffd84a"/><circle cx="290" cy="330" r="14" fill="#ff85c8"/>', GD))

rays = ''.join(f'<g transform="rotate({i * 30} 256 256)"><path d="M256,6 L284,86 L228,86 Z" fill="#ffd23d"/></g>' for i in range(12))
write('garden_sun', svg(
    rays + '<circle cx="256" cy="256" r="160" fill="url(#gsun)"/>'
    '<circle cx="256" cy="256" r="160" fill="none" stroke="#f0a018" stroke-width="10"/>'
    + shine(200, 180, 50, 30, -30, 0.45), GD))

write('garden_bee', svg(
    '<ellipse cx="110" cy="70" rx="40" ry="56" transform="rotate(-25 110 70)" fill="#ffffff" fill-opacity="0.85" stroke="#9ab" stroke-width="5"/>'
    '<ellipse cx="160" cy="66" rx="36" ry="50" transform="rotate(20 160 66)" fill="#ffffff" fill-opacity="0.85" stroke="#9ab" stroke-width="5"/>'
    + fs('M40,150 C40,100 90,86 136,86 C190,86 226,116 226,152 C226,194 186,214 136,214 C86,214 40,196 40,150 Z', 'url(#gbee)', '#5a4010', 8)
    + '<path d="M100,92 C90,130 90,170 100,210 M150,88 C140,130 140,170 150,212" stroke="#3a2a10" stroke-width="22" fill="none"/>'
    + '<circle cx="196" cy="140" r="12" fill="#1c1030"/><circle cx="200" cy="136" r="4" fill="#fff"/>'
    + '<path d="M196,170 C204,180 214,178 218,168" stroke="#3a2a10" stroke-width="6" fill="none" stroke-linecap="round"/>'
    + '<path d="M40,150 L14,160 L40,166 Z" fill="#3a2a10"/>', GD, 256, 256))

write('garden_wrap', svg(
    fs('M70,120 L442,120 L280,490 L232,490 Z', 'url(#gwrap)', '#d8508c', 10)
    + '<path d="M110,150 L250,470 M200,130 L262,470 M330,130 L270,470" stroke="#ffffff" stroke-opacity="0.35" stroke-width="10"/>'
    + fs('M210,330 C150,290 130,340 170,360 C190,370 220,350 240,340 C260,350 290,370 310,360 C350,340 330,290 270,330 Z', '#ffd84a', '#c8a010', 8)
    + '<circle cx="256" cy="340" r="22" fill="#ffd84a" stroke="#c8a010" stroke-width="6"/>', GD))

# --- the hub's sign-post for this place: a bed in bloom and a watering can -----------------

portal = (
    '<ellipse cx="256" cy="470" rx="230" ry="34" fill="#2a4a10" fill-opacity="0.25"/>'
    + fs('M36,420 C36,370 150,350 256,350 C362,350 476,370 476,420 C476,466 362,486 256,486 C150,486 36,466 36,420 Z', 'url(#gsoil)', '#4a2a10', 10)
    + '<path d="M150,410 C148,330 152,280 150,230" stroke="#3f9a3a" stroke-width="14" fill="none" stroke-linecap="round"/>'
    + '<path d="M256,420 C254,320 258,220 256,140" stroke="#3f9a3a" stroke-width="16" fill="none" stroke-linecap="round"/>'
    + '<path d="M360,410 C358,340 362,300 360,260" stroke="#3f9a3a" stroke-width="14" fill="none" stroke-linecap="round"/>'
    + leaf(256, 300, -150, 0.7) + leaf(256, 260, -30, 0.7) + leaf(150, 330, -30, 0.55) + leaf(360, 340, -150, 0.55))
# sunflower in the middle
for i in range(14):
    portal += (f'<g transform="rotate({i * 360 / 14:.1f} 256 140)">'
               + fs('M256,140 C244,110 246,62 256,44 C266,62 268,110 256,140 Z', 'url(#gsunp)', '#c87a0a', 4) + '</g>')
portal += '<circle cx="256" cy="140" r="44" fill="url(#gsunc)"/><circle cx="256" cy="140" r="44" fill="none" stroke="#3a2010" stroke-width="6"/>'
# pink tulip left, white daisy right
portal += fs('M150,240 C108,240 94,200 98,150 C112,162 124,166 132,158 C138,140 144,128 150,120 C156,128 162,140 168,158 '
             'C176,166 188,162 202,150 C206,200 192,240 150,240 Z', '#ff6fa8', '#c83a7a', 6)
for i in range(9):
    portal += (f'<g transform="rotate({i * 40} 360 250)">'
               + fs('M360,250 C350,228 350,200 360,192 C370,200 370,228 360,250 Z', '#ffffff', '#b0b0c0', 4) + '</g>')
portal += '<circle cx="360" cy="250" r="16" fill="#ffd23d" stroke="#c8800a" stroke-width="4"/>'
# little watering can, front right
portal += ('<g transform="translate(300 296) scale(0.42)">'
           + fs('M150,210 L370,210 C388,210 396,226 394,246 L380,400 C378,424 360,438 338,438 L182,438 C160,438 142,424 140,400 L126,246 '
                'C124,226 132,210 150,210 Z', 'url(#gcan)', '#1f6aa8', 14)
           + fs('M140,270 L40,170 L22,190 L60,206 L130,318 Z', 'url(#gcan)', '#1f6aa8', 14)
           + '<path d="M180,210 C180,120 340,120 340,210" stroke="#1f6aa8" stroke-width="22" fill="none"/></g>')
write('garden_portal', svg(portal, GD))
