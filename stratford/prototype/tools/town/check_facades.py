#!/usr/bin/env python3
"""Validate game/data/facades.json (the Mapillary facade survey) against town.json.

Checks that every building id exists in town.json, that enumerated fields hold
known values, that colours are #rrggbb hex, that storeys are plausible against
the building's wall height, that confidence is in 0..1 and that photo ids look
like Mapillary ids, and that `year` (the capture year of
the newest frame relied on) is a plausible year. Prints errors and warnings; exits 1 if there are errors.

    python3 stratford/prototype/tools/town/check_facades.py [facades.json] [town.json]
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / 'game' / 'data'

MATERIALS = {'brick_red', 'brick_buff', 'brick_painted', 'stone', 'clapboard', 'stucco', 'siding', 'glass', 'metal'}
HEADS = {'round', 'segmental', 'flat', 'pointed'}
HOODS = {'stone', 'brick', 'none'}
CORNICES = {'bracketed', 'pressed_metal', 'corbelled_brick', 'stone', 'parapet_plain', 'none'}
ROOFS = {'gable_front', 'gable_side', 'hipped', 'mansard', 'flat', 'cross_gable'}
HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
PHOTO = re.compile(r'^\d{6,20}$')
KNOWN = {'storeys', 'material', 'wall', 'trim', 'windows', 'cornice', 'storefronts', 'bay',
         'corner_entrance', 'features', 'notes', 'photos', 'confidence', 'roof', 'roof_colour', 'sides', 'year'}


def check(facades, town):
    errors, warnings = [], []
    err = lambda m: errors.append(m)
    warn = lambda m: warnings.append(m)
    blds = {b['id']: b for b in town['buildings']}
    if facades.get('version') != 1:
        err('version must be 1')
    if not isinstance(facades.get('source'), str):
        err('source must be a string')
    fb = facades.get('buildings')
    if not isinstance(fb, dict):
        err('buildings must be an object')
        fb = {}

    def photos(where, v):
        if not isinstance(v, list):
            err(f'{where}: photos must be a list')
            return
        for p in v:
            if not isinstance(p, str) or not PHOTO.match(p):
                err(f'{where}: bad photo id {p!r}')

    def colour(where, k, v):
        if not isinstance(v, str) or not HEX.match(v):
            err(f'{where}: {k} {v!r} is not #rrggbb')

    for bid, f in fb.items():
        w = f'buildings.{bid}'
        if bid not in blds:
            err(f'{w}: id not in town.json')
            continue
        if not isinstance(f, dict):
            err(f'{w}: must be an object')
            continue
        b = blds[bid]
        for k in f:
            if k not in KNOWN:
                warn(f'{w}: unknown field {k!r}')
        s = f.get('storeys')
        if s is not None:
            if not isinstance(s, (int, float)) or not 1 <= s <= 12:
                err(f'{w}: storeys {s!r} outside 1..12')
            else:
                h = b.get('height') or 0
                # a storey is roughly 2.6-5.5 m; flag fronts the LiDAR height cannot hold
                if h and (s * 2.6 > h + 2.5 or s * 5.5 < h - 3):
                    warn(f'{w}: {s} storeys vs town.json height {h:.1f} m')
        if 'material' in f and f['material'] not in MATERIALS:
            err(f'{w}: material {f["material"]!r} not one of {sorted(MATERIALS)}')
        for k in ('wall', 'trim', 'roof_colour'):
            if k in f:
                colour(w, k, f[k])
        if 'cornice' in f and f['cornice'] not in CORNICES:
            err(f'{w}: cornice {f["cornice"]!r} not one of {sorted(CORNICES)}')
        if 'roof' in f and f['roof'] not in ROOFS:
            err(f'{w}: roof {f["roof"]!r} not one of {sorted(ROOFS)}')
        for k in ('bay', 'corner_entrance'):
            if k in f and not isinstance(f[k], bool):
                err(f'{w}: {k} must be true/false')
        if 'windows' in f:
            if not isinstance(f['windows'], list):
                err(f'{w}: windows must be a list')
            else:
                for n, win in enumerate(f['windows']):
                    ww = f'{w}.windows[{n}]'
                    st = win.get('storey')
                    if not isinstance(st, int) or st < 1:
                        err(f'{ww}: storey must be an integer >= 1')
                    elif isinstance(s, (int, float)) and st > s + 1:
                        err(f'{ww}: storey {st} above the building\'s {s} storeys')
                    c = win.get('count')
                    if c is not None and (not isinstance(c, int) or not 0 <= c <= 60):
                        err(f'{ww}: count {c!r} not an integer 0..60')
                    if 'head' in win and win['head'] not in HEADS:
                        err(f'{ww}: head {win["head"]!r} not one of {sorted(HEADS)}')
                    if 'hood' in win and win['hood'] not in HOODS:
                        err(f'{ww}: hood {win["hood"]!r} not one of {sorted(HOODS)}')
                    if 'paired' in win and not isinstance(win['paired'], bool):
                        err(f'{ww}: paired must be true/false')
        if 'storefronts' in f:
            if not isinstance(f['storefronts'], list):
                err(f'{w}: storefronts must be a list')
            else:
                for n, sf in enumerate(f['storefronts']):
                    if 'colour' in sf:
                        colour(f'{w}.storefronts[{n}]', 'colour', sf['colour'])
                    aw = sf.get('awning')
                    if aw is not None:
                        if not isinstance(aw, dict):
                            err(f'{w}.storefronts[{n}]: awning must be an object')
                        else:
                            for k in ('colour', 'stripes'):
                                if k in aw:
                                    colour(f'{w}.storefronts[{n}].awning', k, aw[k])
        if 'features' in f and (not isinstance(f['features'], list) or not all(isinstance(x, str) for x in f['features'])):
            err(f'{w}: features must be a list of strings')
        if 'notes' in f and not isinstance(f['notes'], str):
            err(f'{w}: notes must be a string')
        if 'photos' not in f or not f['photos']:
            err(f'{w}: no photos')
        else:
            photos(w, f['photos'])
        y = f.get('year')
        if y is not None and (not isinstance(y, int) or not 2000 <= y <= 2100):
            err(f'{w}: year {y!r} is not a capture year')
        c = f.get('confidence')
        if not isinstance(c, (int, float)) or not 0 <= c <= 1:
            err(f'{w}: confidence {c!r} not in 0..1')
    sq = facades.get('square')
    if sq is not None:
        if not isinstance(sq.get('notes'), str):
            err('square: notes must be a string')
        photos('square', sq.get('photos', []))
    for where, v in [('square', sq or {})] + [(f'landmarks.{k}', l) for k, l in (facades.get('landmarks') or {}).items()]:
        y = v.get('year')
        if y is not None and (not isinstance(y, int) or not 2000 <= y <= 2100):
            err(f'{where}: year {y!r} is not a capture year')
    lm_ids = {l['id'] for l in town.get('landmarks', [])}
    for lid, l in (facades.get('landmarks') or {}).items():
        if lid not in lm_ids:
            err(f'landmarks.{lid}: not a town.json landmark id')
        if not isinstance(l.get('notes'), str):
            err(f'landmarks.{lid}: notes must be a string')
        photos(f'landmarks.{lid}', l.get('photos', []))
    return errors, warnings


def main():
    fp = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / 'facades.json'
    tp = Path(sys.argv[2]) if len(sys.argv) > 2 else DATA / 'town.json'
    facades = json.loads(fp.read_text())
    town = json.loads(tp.read_text())
    errors, warnings = check(facades, town)
    for w in warnings:
        print('warning:', w)
    for e in errors:
        print('error:', e)
    n = len(facades.get('buildings', {}))
    print(f'{fp.name}: {n} buildings, {len(errors)} errors, {len(warnings)} warnings')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
