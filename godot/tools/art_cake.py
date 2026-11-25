# Art for the bakery (cake). Runs inside make_art.py, so every helper there -
# svg, radial, linear, shaded, fs, shine, blob, write, TINT_DEFS - is in scope.
#
# Tiers and icing are drawn in greys so the game tints them with the chosen
# sponge and icing colour; everything else keeps its own colours.

import math as _m

# A tier, front view: a wide drum with an oval top. Canvas 512x320, the drum
# fills x 16..496; its base sits on the bottom edge area (y ~ 300).
_TIER_BODY = 'M16,70 C16,30 496,30 496,70 L496,262 C496,312 16,312 16,262 Z'
write('cake_tier', svg(
    f'<path d="{_TIER_BODY}" fill="url(#shade)"/>'
    f'<path d="{_TIER_BODY}" fill="url(#rim)"/>'
    '<ellipse cx="256" cy="70" rx="240" ry="40" fill="#ffffff" fill-opacity="0.35"/>'
    f'<path d="{_TIER_BODY}" fill="none" stroke="{LINE}" stroke-width="10" stroke-linejoin="round"/>',
    TINT_DEFS, 512, 320))
# cream filling stripe across the middle (own colour, drawn over the tint)
write('cake_filling', svg(
    '<path d="M20,170 C120,190 392,190 492,170 L492,196 C392,216 120,216 20,196 Z" fill="#fffaf2"/>'
    '<path d="M20,170 C120,190 392,190 492,170" fill="none" stroke="#e8d8c8" stroke-width="5"/>', '', 512, 320))
# Icing: covers the top and runs down the front in drips. Grey, tinted later.
# Icing: a cap over the top and a band down the front ending in round drips
# of different lengths, like cream really runs.
_drops = [(470, 70), (412, 120), (350, 54), (290, 100), (226, 64), (168, 128), (108, 60), (46, 96)]
_d = 'M10,70 C10,22 502,22 502,70 L502,104 '
for dx, ln in _drops:
    w = 22
    _d += (f'L{dx + w},104 L{dx + w},{104 + ln} '
           f'A{w},{w} 0 0,1 {dx - w},{104 + ln} L{dx - w},104 ')
_d += 'L10,104 Z'
ICING_DEFS = radial('ice', [(0, '#ffffff', 1), (0.6, '#f4f4f4', 1), (1, '#d2d2d2', 1)], 0.4, 0.2, 0.9)
write('cake_icing', svg(
    f'<path d="{_d}" fill="url(#ice)"/>'
    '<ellipse cx="170" cy="52" rx="90" ry="14" fill="#ffffff" fill-opacity="0.7"/>'
    f'<path d="{_d}" fill="none" stroke="#9a9a9a" stroke-width="7" stroke-linejoin="round"/>',
    ICING_DEFS, 512, 320))

# The cake stand: a pedestal plate.
STAND_DEFS = (linear('stand', [(0, '#ffffff', 1), (0.6, '#f1ecff', 1), (1, '#cfc4f0', 1)])
              + linear('stem', [(0, '#e9e2ff', 1), (0.5, '#ffffff', 1), (1, '#c9bdf0', 1)], 0, 0, 1, 0))
write('cake_stand', svg(
    fs('M200,120 L312,120 L290,250 L222,250 Z', 'url(#stem)', '#a99ad8', 8)
    + fs('M130,250 C130,226 382,226 382,250 L382,262 C382,286 130,286 130,262 Z', 'url(#stand)', '#a99ad8', 8)
    + fs('M14,70 C14,30 498,30 498,70 C498,110 14,110 14,70 Z', 'url(#stand)', '#a99ad8', 9)
    + '<ellipse cx="256" cy="62" rx="220" ry="26" fill="#ffffff" fill-opacity="0.8"/>',
    STAND_DEFS, 512, 300))

# A slice of sponge (for choosing a flavour): grey tintable wedge with cream
# layers and a strawberry on top.
_SLICE = 'M60,200 L420,120 L452,170 L452,380 L60,410 Z'
write('cake_slice', svg(
    f'<path d="{_SLICE}" fill="url(#shade)"/><path d="{_SLICE}" fill="url(#rim)"/>'
    '<path d="M60,290 L452,262 L452,286 L60,314 Z" fill="#fffaf2"/>'
    '<path d="M60,200 L420,120 L452,170 L60,236 Z" fill="#fffaf2"/>'
    f'<path d="{_SLICE}" fill="none" stroke="{LINE}" stroke-width="10" stroke-linejoin="round"/>',
    TINT_DEFS, 512, 512))

# A bowl of icing (the cream inside is tinted, the bowl keeps its colour).
BOWL_DEFS = linear('bowl', [(0, '#ffffff', 1), (1, '#d9d3f5', 1)])
write('cake_bowl', svg(
    fs('M60,230 L452,230 C452,380 360,450 256,450 C152,450 60,380 60,230 Z', 'url(#bowl)', '#a99ad8', 12)
    + '<ellipse cx="160" cy="300" rx="22" ry="60" fill="#ffffff" fill-opacity="0.8"/>', BOWL_DEFS))
write('cake_cream', svg(
    f'<path d="{blob(256, 210, 160, 9, 0.12, 3)}" fill="url(#ice)"/>'
    '<path d="M256,70 C300,90 300,140 256,150 C226,120 236,90 256,70 Z" fill="url(#ice)"/>'
    '<ellipse cx="200" cy="170" rx="50" ry="24" fill="#ffffff" fill-opacity="0.8"/>', ICING_DEFS))

# Toppings, own colours.
TOP_DEFS = (radial('cher', [(0, '#ff9aa0', 1), (0.45, '#e8243c', 1), (1, '#9a1028', 1)], 0.35, 0.3, 0.8)
            + radial('hrt', [(0, '#ffc4dd', 1), (1, '#e83d8a', 1)], 0.35, 0.3, 0.8)
            + radial('str5', [(0, '#fff8c0', 1), (1, '#f0a81a', 1)], 0.4, 0.3, 0.8)
            + radial('cand', [(0, '#ffffff', 1), (1, '#e8e8f8', 1)], 0.35, 0.3, 0.8)
            + radial('mac', [(0, '#c8f0ff', 1), (1, '#5ab4f0', 1)], 0.35, 0.3, 0.8))
write('cake_cherry', svg(
    '<path d="M256,250 C250,170 280,110 330,70" stroke="#4f8a2a" stroke-width="16" fill="none" stroke-linecap="round"/>'
    + fs('M330,70 C370,50 420,60 430,80 C400,104 356,100 330,70 Z', '#5fcf5f', '#2f8a30', 8)
    + fs('M256,190 C350,190 400,250 400,320 C400,400 330,450 256,450 C182,450 112,400 112,320 C112,250 162,190 256,190 Z',
         'url(#cher)', '#7a0a20', 12) + shine(200, 280, 26, 44), TOP_DEFS))
write('cake_heart', svg(
    fs('M256,440 C120,350 60,270 80,190 C100,110 200,90 256,170 C312,90 412,110 432,190 C452,270 392,350 256,440 Z',
       'url(#hrt)', '#b8205a', 12) + shine(170, 200, 30, 50), TOP_DEFS))
write('cake_star', svg(
    fs('M256,40 L318,180 L470,190 L352,290 L392,440 L256,360 L120,440 L160,290 L42,190 L194,180 Z',
       'url(#str5)', '#c88a10', 12) + shine(210, 200, 24, 44), TOP_DEFS))
write('cake_candy', svg(
    fs('M256,90 C350,90 420,160 420,256 C420,352 350,422 256,422 C162,422 92,352 92,256 C92,160 162,90 256,90 Z',
       'url(#cand)', '#c83a7a', 12)
    + ''.join(f'<path d="M256,256 L{256 + _m.cos(a) * 160:.1f},{256 + _m.sin(a) * 160:.1f} '
              f'A160,160 0 0,1 {256 + _m.cos(a + 0.5) * 160:.1f},{256 + _m.sin(a + 0.5) * 160:.1f} Z" fill="#ff5fa2"/>'
              for a in [i * _m.tau / 6 for i in range(6)])
    + '<circle cx="256" cy="256" r="166" fill="none" stroke="#c83a7a" stroke-width="12"/>'
    + shine(200, 190, 30, 50), TOP_DEFS))
write('cake_macaron', svg(
    fs('M100,200 C100,120 412,120 412,200 L412,230 L100,230 Z', 'url(#mac)', '#2f80c0', 10)
    + fs('M96,236 L416,236 L416,276 L96,276 Z', '#fffaf2', '#d8c8b8', 8)
    + fs('M100,282 L412,282 L412,312 C412,392 100,392 100,312 Z', 'url(#mac)', '#2f80c0', 10)
    + shine(180, 170, 50, 18, -10), TOP_DEFS))
write('cake_shaker', svg(
    fs('M170,170 L342,170 L362,450 L150,450 Z', '#ffffff', '#a99ad8', 12)
    + fs('M160,100 C160,60 352,60 352,100 L352,170 L160,170 Z', '#ff85c8', '#c83a7a', 12)
    + ''.join(f'<circle cx="{x}" cy="88" r="9" fill="#c83a7a"/>' for x in (210, 256, 302))
    + ''.join(f'<rect x="{x}" y="{y}" width="34" height="12" rx="6" fill="{c}" transform="rotate({r} {x} {y})"/>'
              for x, y, r, c in [(200, 250, 20, '#ff4d5e'), (270, 230, -30, '#4fa8ff'), (230, 320, 60, '#ffd23d'),
                                 (290, 310, 10, '#5fcf5f'), (210, 390, -20, '#a774ff'), (290, 400, 40, '#ff9a1f')]), ''))
write('cake_sprinkle', svg('<rect x="64" y="104" width="128" height="48" rx="24" fill="#ffffff"/>', '', 256, 256))

# Candle and flame.
write('cake_candle', svg(
    fs('M216,120 L296,120 L296,470 L216,470 Z', '#ffffff', '#c9bdf0', 8)
    + ''.join(f'<path d="M216,{150 + i * 70} L296,{120 + i * 70} L296,{150 + i * 70} L216,{180 + i * 70} Z" fill="#ff85c8"/>'
              for i in range(5))
    + '<path d="M256,120 L256,80" stroke="#4a3b52" stroke-width="10" stroke-linecap="round"/>', ''))
FLAME_DEFS = radial('flm', [(0, '#fffbe0', 1), (0.4, '#ffd23d', 1), (1, '#ff7a1f', 1)], 0.5, 0.7, 0.8)
write('cake_flame', svg(
    '<path d="M256,40 C300,140 340,200 330,280 C320,360 192,360 182,280 C172,200 212,140 256,40 Z" fill="url(#flm)"/>'
    '<path d="M256,180 C276,230 290,260 284,296 C278,330 234,330 228,296 C222,260 236,230 256,180 Z" fill="#ffffff" fill-opacity="0.85"/>',
    FLAME_DEFS))

# The portal on the hub meadow: a two-tier birthday cake on its stand, three
# candles lit.
PORTAL_DEFS = (STAND_DEFS + FLAME_DEFS
               + radial('pt1', [(0, '#ffe3b0', 1), (1, '#e8a85a', 1)], 0.35, 0.3, 0.9)
               + radial('pt2', [(0, '#ffffff', 1), (1, '#ffb0d4', 1)], 0.4, 0.2, 0.9))
write('cake_portal', svg(
    fs('M226,380 L286,380 L276,470 L236,470 Z', 'url(#stem)', '#a99ad8', 8)
    + fs('M150,470 C150,452 362,452 362,470 L362,480 C362,500 150,500 150,480 Z', 'url(#stand)', '#a99ad8', 8)
    + fs('M60,384 C60,360 452,360 452,384 C452,408 60,408 60,384 Z', 'url(#stand)', '#a99ad8', 8)
    + fs('M90,270 C90,250 422,250 422,270 L422,370 C422,396 90,396 90,370 Z', 'url(#pt1)', '#a8682a', 9)
    + fs('M86,272 C86,246 426,246 426,272 L426,300 C400,330 380,300 360,320 C340,340 320,300 290,318 C260,336 240,300 210,320 '
         'C180,340 160,300 130,318 C110,330 96,312 86,300 Z', 'url(#pt2)', '#d46aa0', 8)
    + fs('M150,170 C150,154 362,154 362,170 L362,256 C362,276 150,276 150,256 Z', 'url(#pt1)', '#a8682a', 9)
    + fs('M146,172 C146,150 366,150 366,172 L366,196 C340,224 320,196 300,214 C280,232 260,196 236,214 '
         'C214,232 190,200 170,214 C158,222 150,206 146,196 Z', 'url(#pt2)', '#d46aa0', 8)
    + ''.join(fs(f'M{x - 14},{70} L{x + 14},{70} L{x + 14},{160} L{x - 14},{160} Z', c, '#a99ad8', 5)
              + f'<path d="M{x},{68} C{x + 16},{40} {x + 12},{20} {x},{4} C{x - 12},{20} {x - 16},{40} {x},{68} Z" fill="url(#flm)"/>'
              for x, c in [(200, '#9fd8ff'), (256, '#ffd84a'), (312, '#c9a4ff')])
    + ''.join(f'<circle cx="{x}" cy="{y}" r="16" fill="#e8243c"/><circle cx="{x - 5}" cy="{y - 5}" r="5" fill="#fff" fill-opacity="0.7"/>'
              for x, y in [(130, 262), (382, 262), (256, 254)]),
    PORTAL_DEFS, 512, 512))
