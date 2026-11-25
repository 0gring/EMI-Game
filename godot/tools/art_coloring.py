# Colouring book art, run from make_art.py with its helpers in scope.

# The hub's sign for this place: a wooden easel holding a half-coloured flower
# picture, a tray of crayons, and a pot of brushes beside it. The feet stand at
# the bottom of the canvas.
EASEL_DEFS = (linear('cwood', [(0, '#d89a5a', 1), (1, '#9a6230', 1)], 0, 0, 1, 0)
              + radial('cpaper', [(0, '#ffffff', 1), (1, '#f1ecff', 1)], 0.4, 0.3, 0.9)
              + radial('cpetal', [(0, '#ffc2df', 1), (1, '#ff5fa2', 1)], 0.4, 0.3, 0.8)
              + radial('csun', [(0, '#fff6b0', 1), (1, '#ffc61a', 1)], 0.4, 0.3, 0.8))
legs = ''.join(fs(d, 'url(#cwood)', '#6a4020', 10) for d in [
    'M150,170 L180,170 L118,500 L92,500 Z',
    'M332,170 L362,170 L420,500 L394,500 Z',
    'M244,300 L268,300 L268,470 L244,470 Z'])
board = fs('M96,60 L416,60 C428,60 436,68 436,80 L436,316 C436,328 428,336 416,336 L96,336 '
           'C84,336 76,328 76,316 L76,80 C76,68 84,60 96,60 Z', 'url(#cpaper)', '#6a4020', 12)
import math
petals = ''
for i in range(6):
    a = i / 6 * math.tau - math.pi / 2
    cx, cy = 220 + math.cos(a) * 42, 170 + math.sin(a) * 42
    coloured = i < 3
    d = (f'M{cx - 30},{cy} a30,21 0 1,0 60,0 a30,21 0 1,0 -60,0 Z')
    petals += (f'<path d="{d}" transform="rotate({math.degrees(a):.0f} {cx:.0f} {cy:.0f})" fill="{"url(#cpetal)" if coloured else "#ffffff"}"/>'
               f'<path d="{d}" transform="rotate({math.degrees(a):.0f} {cx:.0f} {cy:.0f})" fill="none" stroke="#3d3a52" stroke-width="7"/>')
flower = ('<path d="M220,200 L220,300" stroke="#3d3a52" stroke-width="18" stroke-linecap="round"/>'
          '<path d="M220,200 L220,300" stroke="#5fcf5f" stroke-width="8" stroke-linecap="round"/>'
          + petals
          + fs('M196,170 a24,24 0 1,0 48,0 a24,24 0 1,0 -48,0 Z', 'url(#csun)', '#3d3a52', 7)
          + fs('M330,110 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0 Z', '#ffffff', '#3d3a52', 7))
tray = fs('M70,336 L442,336 L442,362 L70,362 Z', 'url(#cwood)', '#6a4020', 8)
crayons = ''
for i, c in enumerate(['#ff4d5e', '#ffd93d', '#4fa8ff', '#5fcf5f', '#a774ff']):
    x = 110 + i * 62
    crayons += (fs(f'M{x},{326} L{x + 40},{326} L{x + 40},{300} L{x + 20},{282} L{x},{300} Z', c, '#3d3a52', 5)
                + f'<rect x="{x}" y="306" width="40" height="10" fill="#ffffff" fill-opacity="0.55"/>')
splash = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r, c in
                 [(330, 470, 16, '#ff85c8'), (360, 488, 10, '#4fa8ff'), (300, 492, 8, '#ffd93d')])
write('coloring_portal', svg(legs + board + flower + crayons + tray + splash, EASEL_DEFS))
