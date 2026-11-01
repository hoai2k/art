#!/usr/bin/env python3
"""The film edition's climbing surfaces, read from the painted cloths.

Act V climbs two delivered cloths, cliff-face-tall-2 and tower-wall-tall,
anywhere on their painted face. This reads each cloth into a grid of what
the climber's hands find there, and measures the ledges he can stand and
walk on, and writes them to src/acts/climb-map.js:

    v  ivy        green leaves and vine: the fastest climbing
    k  crack      the dark seams between blocks and the corners where a
                  face turns (and the curve of the tower's sides): fast
    r  rock       bare painted rock or stone: steady
    s  slick      the cliff's deep cleft, the tower's window openings:
                  dark, wet, slow
    .  none       off the cloth (past its painted edge): no climbing

Ledges are the walkable top faces. Each starts from a ledge measured by
hand on the cloth (FILM_CLIFF and TOWER_HOLDS in src/acts/act5film.js, read
here) and runs left and right along the painted top face for as far as it
stays a pale, smooth band.

    python3 kingdomofthefairies/design/source/build_climb_map.py           # write
    python3 kingdomofthefairies/design/source/build_climb_map.py --check   # verify up to date
    python3 kingdomofthefairies/design/source/build_climb_map.py --overlay DIR   # also draw check images
"""
import json
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'src', 'acts', 'climb-map.js')
ACT = os.path.join(ROOT, 'src', 'acts', 'act5film.js')
CELL = 12                     # world px per grid cell

# How each cloth is hung (src/acts/act5-art.js TALL2, act5film-art.js):
# left x, drawn width, foot at world y -30, world y upward.
WALLS = {
    'cliff': {'file': 'cliff-face-tall-2.webp', 'x0': 230, 'w': 820, 'h': 3600 * (1990 + 30) / (3600 - 12), 'top': 1990, 'list': 'FILM_CLIFF', 'reach': 95, 'shore': 24, 'openTop': True},
    'tower': {'file': 'tower-wall-tall.webp', 'x0': 260, 'w': 760, 'top': 1700, 'list': 'TOWER_HOLDS', 'reach': 48, 'shore': 60, 'stones': True},
}
FOOT = -30


def seeds(name):
    """The hand-measured ledges (x, y) of a hold list in act5film.js."""
    src = open(ACT).read()
    body = src[src.index(f'export const {name} = ['):]
    body = body[:body.index('\n];')]
    out = []
    for line in body.splitlines():
        if "kind: 'ledge'" not in line and "kind: 'top'" not in line:
            continue
        m = re.search(r'x:\s*(\d+),\s*y:\s*(\d+)', line)
        if m:
            out.append((int(m.group(1)), int(m.group(2)), "'top'" in line))
    return out


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def classify(cfg):
    im = Image.open(os.path.join(ROOT, 'assets', cfg['file'])).convert('RGBA')
    W, H = im.size
    s = cfg['w'] / W                                   # image px -> world px, across
    height = cfg.get('h', H * s)                       # drawn height (the cliff is hung to the climb's height)
    t = height / H                                     # image px -> world px, up
    cols = int(cfg['w'] // CELL)
    rows = int(min(height, cfg['top'] - FOOT + 40) // CELL)
    px = im.load()

    def img_xy(wx, wy):                                # world -> image px
        return (wx - cfg['x0']) / s, H - (wy - FOOT) / t

    stats = []
    for r in range(rows):
        row = []
        for c in range(cols):
            x0, y1 = img_xy(cfg['x0'] + c * CELL, FOOT + r * CELL)
            x1, y0 = img_xy(cfg['x0'] + (c + 1) * CELL, FOOT + (r + 1) * CELL)
            xs = range(int(x0), max(int(x0) + 1, int(x1)), 2)
            ys = range(max(0, int(y0)), min(H, max(int(y0) + 1, int(y1))), 2)
            n = a = green = dark = 0
            L = []
            for y in ys:
                line = []
                for x in xs:
                    if x >= W:
                        continue
                    p = px[x, y]
                    n += 1
                    if p[3] < 128:
                        continue
                    a += 1
                    l = lum(p)
                    line.append(l)
                    if p[1] > p[0] + 6 and p[1] >= p[2] - 10 and l < 170:
                        green += 1
                    if l < 92:
                        dark += 1
                L.append(line)
            flat = [v for line in L for v in line]
            mean = sum(flat) / len(flat) if flat else 0
            # vertical seams: neighbouring columns that differ a lot
            grad = 0
            cnt = 0
            for line in L:
                for i in range(1, len(line)):
                    grad += abs(line[i] - line[i - 1])
                    cnt += 1
            row.append({'alpha': a / n if n else 0, 'green': green / a if a else 0, 'dark': dark / a if a else 0,
                        'mean': mean, 'grad': grad / cnt if cnt else 0})
        stats.append(row)

    grads = sorted(st['grad'] for row in stats for st in row if st['alpha'] > 0.5)
    seam = grads[int(len(grads) * 0.8)] if grads else 99
    grid = []
    for r, row in enumerate(stats):
        line = ''
        wy = FOOT + (r + 0.5) * CELL
        for c, st in enumerate(row):
            if st['alpha'] < 0.5 or wy > cfg['top'] + 10 or wy < cfg.get('shore', -1e9):
                ch = '.'
            elif st['green'] > 0.3:
                ch = 'v'
            elif st['dark'] > 0.5:
                ch = 's'
            elif st['grad'] >= seam or 0.18 < st['dark'] <= 0.5:
                ch = 'k'
            else:
                ch = 'r'
            line += ch
        grid.append(line)
    # The painted edge of the cloth (the tower's curving sides): the turn of
    # the wall gives good holds, so a band along it climbs fast.
    for r in range(rows):
        line = list(grid[r])
        for c in range(cols):
            if line[c] in 'r' and (c == 0 or c == cols - 1 or grid[r][c - 1] == '.' or grid[r][c + 1] == '.'):
                line[c] = 'k'
        grid[r] = ''.join(line)

    def top_band(wx, wy):
        """Is the painted top face here: pale, smooth, not ivy? Samples the
        strip just above where his feet go (the face seen from a little above)."""
        ok = 0
        tot = 0
        for dy in (4, 9, 14):
            ix, iy = img_xy(wx, wy + dy)
            if not (0 <= ix < W and 0 <= iy < H):
                continue
            p = px[int(ix), int(iy)]
            tot += 1
            if p[3] > 128 and lum(p) > 150 and not (p[1] > p[0] + 6 and p[1] >= p[2] - 10):
                ok += 1
        return tot and ok >= 2

    ledges = []
    for x, y, top in seeds(cfg['list']):
        if top:
            continue
        # Stand him on the painted top face: the hand-measured height can sit
        # a little down the face, so rise to the first height where the strip
        # above is the pale top across his width.
        for dy in range(-6, 34, 2):
            if all(top_band(x + ox, y + dy) for ox in (-14, 0, 14)):
                y += dy
                break
        reach = cfg['reach']
        lo = hi = x
        miss = 0
        while lo > x - reach and lo > cfg['x0'] + 6:
            if top_band(lo - 4, y):
                miss = 0
            else:
                miss += 1
                if miss > 2:
                    break
            lo -= 4
        miss = 0
        while hi < x + reach and hi < cfg['x0'] + cfg['w'] - 6:
            if top_band(hi + 4, y):
                miss = 0
            else:
                miss += 1
                if miss > 2:
                    break
            hi += 4
        half = 26 if cfg['reach'] < 60 else 34       # every measured ledge holds him
        lo, hi = min(lo + 8, x - half), max(hi - 8, x + half)
        ledges.append({'x0': int(lo), 'x1': int(hi), 'y': y})
    # The tower's other jutting stones and sills: a pale block on its own dark
    # shadow, at least four cells wide, found in the grid; its top face is the
    # top of the pale block.
    if cfg.get('stones'):
        for r in range(2, rows - 6):
            c = 0
            while c < cols:
                run = 0
                while (c + run < cols and grid[r][c + run] != '.' and stats[r][c + run]['mean'] < stats[r + 1][c + run]['mean'] - 35
                       and stats[r + 1][c + run]['mean'] > 130 and stats[r + 1][c + run]['green'] < 0.45):
                    run += 1
                if run >= 3:
                    top = r + 1
                    while top + 1 < rows and top - r < 3 and stats[top + 1][c + run // 2]['mean'] > 130 and stats[top + 1][c + run // 2]['grad'] < seam:
                        top += 1
                    wy = FOOT + (top + 1) * CELL
                    x0w, x1w = cfg['x0'] + c * CELL, cfg['x0'] + (c + run) * CELL
                    if not any(abs(l['y'] - wy) < 40 and x0w < l['x1'] and x1w > l['x0'] for l in ledges):
                        ledges.append({'x0': int(x0w), 'x1': int(x1w), 'y': int(wy)})
                c += max(run, 1)
    # Two measured ledges on one top face become one.
    ledges.sort(key=lambda l: (l['y'], l['x0']))
    merged = []
    for l in ledges:
        m = next((o for o in merged if abs(o['y'] - l['y']) <= 4 and l['x0'] <= o['x1'] + 6 and l['x1'] >= o['x0'] - 6), None)
        if m:
            m['x0'], m['x1'] = min(m['x0'], l['x0']), max(m['x1'], l['x1'])
        else:
            merged.append(dict(l))
    return {'x0': cfg['x0'], 'y0': FOOT, 'cell': CELL, 'cols': cols, 'rows': rows, 'top': cfg['top'], 'openTop': cfg.get('openTop', False),
            'grid': grid, 'ledges': merged}, im, (s, t)


def render(maps):
    out = ['// Generated by design/source/build_climb_map.py from the painted cloths;',
           '// edit that script, not this file. Grid rows run bottom (world y0) to top,',
           '// one character per CELL world px: v ivy, k crack, r rock, s slick, . none.',
           '// Ledges are walkable top faces: world x0..x1 at height y.',
           'export const CLIMB_MAPS = {']
    for name, m in maps.items():
        out.append(f'  {name}: {{')
        out.append(f"    x0: {m['x0']}, y0: {m['y0']}, cell: {m['cell']}, cols: {m['cols']}, rows: {m['rows']}, top: {m['top']}, openTop: {'true' if m['openTop'] else 'false'},")
        out.append('    ledges: [')
        for l in m['ledges']:
            out.append(f"      {{ x0: {l['x0']}, x1: {l['x1']}, y: {l['y']} }},")
        out.append('    ],')
        out.append('    grid: [')
        for line in m['grid']:
            out.append(f"      '{line}',")
        out.append('    ],')
        out.append('  },')
    out.append('};')
    return '\n'.join(out) + '\n'


COLS = {'v': (60, 200, 80, 120), 'k': (240, 200, 40, 110), 'r': (0, 0, 0, 0), 's': (60, 60, 230, 120), '.': (230, 30, 30, 90)}


def overlay(name, m, im, s, outdir):
    base = im.convert('RGBA').resize((int(im.width * s[0]), int(im.height * s[1])))
    lay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    H = base.height
    for r, line in enumerate(m['grid']):
        for c, ch in enumerate(line):
            x = c * CELL
            y = H - (r + 1) * CELL - 0 + FOOT * 0
            y = H - ((m['y0'] + (r + 1) * CELL) - FOOT)
            d.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=COLS[ch])
    for l in m['ledges']:
        y = H - (l['y'] - FOOT)
        d.line([l['x0'] - m['x0'], y, l['x1'] - m['x0'], y], fill=(255, 255, 255, 255), width=3)
    Image.alpha_composite(base, lay).save(os.path.join(outdir, f'climb-map-{name}.png'))


def main():
    maps = {}
    for name, cfg in WALLS.items():
        m, im, s = classify(cfg)
        maps[name] = m
        if '--overlay' in sys.argv:
            overlay(name, m, im, s, sys.argv[sys.argv.index('--overlay') + 1])
    text = render(maps)
    if '--check' in sys.argv:
        if not os.path.exists(OUT) or open(OUT).read() != text:
            print('climb-map.js is out of date: run build_climb_map.py')
            sys.exit(1)
        print('Climb map up to date')
        return
    open(OUT, 'w').write(text)
    for name, m in maps.items():
        counts = {ch: sum(line.count(ch) for line in m['grid']) for ch in 'vkrs.'}
        print(f"{name}: {m['cols']}x{m['rows']} cells {counts}, {len(m['ledges'])} ledges")


if __name__ == '__main__':
    main()
