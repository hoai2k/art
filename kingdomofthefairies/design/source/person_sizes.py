#!/usr/bin/env python3
"""Person size: one consistent size for every sprite of a character.

Each character has a reference sprite (standing) and a head box in it (art px,
per look: original and tinted art are painted separately). Every other sprite
of the character is measured against it by the head, searched over size,
rotation and mirroring, and checked by eye (BY_EYE overrides a measure the
template can't read). The result, per sprite:

    px  the character's standing height as painted in this sprite, art px
        (the reference figure's painted height x the head ratio)

so a scene draws any of a character's sprites at one person height H with
scale H / px (drawPerson in src/pose.js), and they all match. The prince and
the crew have their own audit (audit_sprites.py: WALK_FIT, POSE_FIT).

  python3 design/source/person_sizes.py           write src/person-size.js, design/person-sizes.md
  python3 design/source/person_sizes.py --check   fail if a measured sprite or a setting here changed
                                                  since they were written (a fingerprint; no re-measure)
  python3 design/source/person_sizes.py --sheet DIR   also write a sheet per character
                                                      (every sprite at one person height)
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'assets'
OUT_JS = ROOT / 'src' / 'person-size.js'
REPORT = ROOT / 'design' / 'person-sizes.md'

# who: (reference, {look: head box x0, y0, x1, y1}, [sprites], rotation searched)
CAST = {
    'prince-court': ('prince-court', {'': (58, 8, 114, 65), '-tinted': (58, 8, 114, 65)}, ['prince-court-stairs-a', 'prince-court-stairs-b'], 45),
    # The strike is drawn through drawPerson; its extended sword makes the
    # figure much smaller within its canvas than the standing prince.
    'prince-armed': ('prince-stand', {'': (119, 34, 148, 75), '-tinted': (119, 34, 148, 75)},
                     ['prince-strike', 'prince-set-down', 'prince-caught-lobster', 'prince-caught-human'], 30),
    'azurine': ('azurine-stand', {'': (60, 8, 115, 60), '-tinted': (55, 8, 105, 58)},
                ['azurine-stairs-a', 'azurine-stairs-b', 'azurine-walk-a', 'azurine-walk-b', 'azurine-pass-a', 'azurine-pass-b', 'azurine-swoon', 'azurine-jump', 'azurine-asleep', 'azurine-window'], 100),
    'aurora': ('aurora-stand', {'': (105, 58, 152, 110), '-tinted': (108, 55, 152, 106)},
               ['aurora-point', 'aurora-glide-a', 'aurora-glide-b'], 45),
    'witch': ('witch-hooded', {'': (55, 60, 97, 115), '-tinted': (25, 68, 72, 120)},
              ['witch-cloud', 'witch-swoop', 'witch-storm', 'witch-barrel', 'witch-barrel-anger-a', 'witch-barrel-anger-b', 'witch-cast', 'witch-recoil'], 100),
    # her disguise, the fair lady (and in her moon boat)
    'witch-fair': ('witch-stand', {'': (80, 35, 125, 95)}, ['witch-stand-idle-b', 'witch-stand-idle-c', 'witch-moonboat'], 30),
    'demon-red': ('demon-red', {'': (125, 88, 165, 145), '-tinted': (110, 88, 150, 140)}, ['demon-red-carry'], 45),
    'demon-teal': ('demon-teal', {'': (118, 88, 165, 145), '-tinted': (108, 88, 152, 145)}, ['demon-teal-carry'], 45),
    'water-fairy': ('water-fairy-stand', {'': (108, 38, 152, 95), '-tinted': (90, 28, 135, 90)},
                    ['water-fairy-stand-idle-b', 'water-fairy-stand-idle-c'], 30),
    'king': ('king-stand', {'': (75, 50, 135, 120), '-tinted': (60, 50, 115, 120)}, [], 0),
    'queen': ('queen-stand', {'': (90, 40, 140, 100), '-tinted': (90, 30, 140, 95)}, [], 0),
    'fairy-ring': ('fairy-ring', {'': (85, 45, 130, 100), '-tinted': (85, 45, 130, 100)}, ['fairy-ring-empty'], 30),
    'fairy-crown': ('fairy-crown', {'': (95, 40, 140, 95), '-tinted': (95, 40, 140, 95)}, ['fairy-crown-empty'], 30),
    'fairy-gold': ('fairy-gold', {'': (95, 40, 140, 95), '-tinted': (95, 40, 140, 95)}, ['fairy-gold-empty'], 30),
    'attendant-blue': ('attendant-blue', {'': (75, 25, 120, 80), '-tinted': (75, 25, 120, 80)}, ['attendant-blue-tumble'], 180),
    'attendant-green': ('attendant-green', {'': (75, 25, 125, 80), '-tinted': (75, 25, 125, 80)}, ['attendant-green-tumble'], 180),
    'attendant-pink': ('attendant-pink', {'': (75, 40, 125, 95), '-tinted': (75, 40, 125, 95)}, ['attendant-pink-tumble'], 180),
}
# Head ratio (sprite / reference) set by eye where the template misreads a
# pose; looked at on the sheets, every sprite at one person height.
# Measured brow to chin against the reference at native scale, 30 Oct 2026.
BY_EYE = {
    # Paired setting-down cutout: Azurine stands at the same 140px person
    # height as the prince; the prince is lower only while kneeling.
    'prince-set-down': 1.15000000,
    'prince-set-down-tinted': 1.15041783,
    # Stair frames calibrated at the same full person height; reviewed in play.
    'azurine-stairs-a': 1.15789474,
    'azurine-stairs-b': 1.15789474,
    'azurine-stairs-a-tinted': 1.15789474,
    'azurine-stairs-b-tinted': 1.15789474,
    'prince-court-stairs-a': 1.24645892,
    'prince-court-stairs-b': 1.24645892,
    'prince-court-stairs-a-tinted': 1.24293785,
    'prince-court-stairs-b-tinted': 1.24293785,
    # In the barrel her head is painted about twice its size in her duel
    # poses (hood to chin 90 art px tinted, against 53 hooded): measured by
    # the head, checked by eye on a sheet (1 Nov 2026). The barrel itself is
    # drawn at its own prop size (BARREL_WITCH in src/acts/act5film-art.js).
    'witch-barrel-anger-a': 1.59779614, 'witch-barrel-anger-b': 1.59779614,
    'witch-barrel-anger-a-tinted': 1.48351648, 'witch-barrel-anger-b-tinted': 1.48351648,

    # Compact celebration pose: same painted crown-to-hem height as standing,
    # with face and palette checked on the v2 review sheet.
    'azurine-jump': 1.17895,
    'azurine-jump-tinted': 1.10526,

    # Cliff duel: one person size in every pose, by the head (hood top to
    # chin and hood width against the hooded reference), checked by eye side
    # by side (1 Nov 2026). The crouching cast and the upright recoil have
    # other silhouettes, not other sizes.
    'witch-cast': 0.82644628, 'witch-cast-tinted': 0.87912088,
    'witch-recoil': 1.04683196, 'witch-recoil-tinted': 1.03021978,
    # her swoon is painted larger than her standing figure: her face 26-30 px
    # eye to chin, tipped back, against 18-20 standing (the template, thrown
    # by the raised arm, read 0.42-0.48; 1.0 by a glance was wrong, seen in
    # play 31 Oct 2026)
    'azurine-swoon': 1.28, 'azurine-swoon-tinted': 1.28,
    # the window is a close bust: her face 33 px brow to chin against 21
    'azurine-window': 1.5, 'azurine-window-tinted': 1.5,
    # the witch's face 35 px in the swoop, 40 in the barrel and the storm,
    # against 45 hooded
    'witch-swoop': 0.8, 'witch-swoop-tinted': 0.8, 'witch-barrel': 0.9, 'witch-barrel-tinted': 0.9,
    'witch-storm': 0.9, 'witch-storm-tinted': 0.9,
    # idle frames are painted on their standing figure
    'water-fairy-stand-idle-b': 1.0, 'water-fairy-stand-idle-c': 1.0,
    # seated in her moon boat: her face 28 px against 35 standing
    'witch-moonboat': 0.8,
}
TRUST = 0.55          # below this match score the template measure isn't used


def slots():
    return json.loads((ASSETS / 'manifest.json').read_text())['slots']


def load(aid):
    im = Image.open(ASSETS / f'{aid}.webp').convert('RGBA')
    a = np.asarray(im)
    g = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
    al = a[:, :, 3]
    g[al < 40] = 128
    return g, al


def painted_height(al):
    rows = np.where(al.max(1) > 40)[0]
    return int(rows.max() - rows.min() + 1)


def head_ratio(ref, box, aid, rot):
    """The best (score, size) of `ref`'s head (box) found in `aid`, over size,
    rotation and mirroring."""
    g, _ = load(ref)
    x0, y0, x1, y1 = box
    tpl0 = g[y0:y1, x0:x1]
    G, _ = load(aid)
    best = (-1.0, 1.0)
    for tpl in (tpl0, tpl0[:, ::-1].copy()):
        for ang in range(-rot, rot + 1, 10) if rot else (0,):
            for s in np.arange(0.4, 2.0, 0.02):
                T = cv2.resize(tpl, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
                if ang:
                    M = cv2.getRotationMatrix2D((T.shape[1] / 2, T.shape[0] / 2), ang, 1)
                    T = cv2.warpAffine(T, M, (T.shape[1], T.shape[0]), borderValue=128)
                if T.shape[0] >= G.shape[0] or T.shape[1] >= G.shape[1] or min(T.shape) < 8:
                    continue
                v = float(cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED).max())
                if v > best[0]:
                    best = (v, float(s))
    return best


def fingerprint():
    """The inputs: every measured sprite's file and the settings above. --check
    compares it rather than measure again (several minutes)."""
    h = hashlib.sha1(repr((CAST, BY_EYE, TRUST)).encode())
    for who, (ref, boxes, sprites, _) in CAST.items():
        for look in boxes:
            for i in (ref, *sprites):
                f = ASSETS / f'{i}{look}.webp'
                h.update(f.name.encode() + (f.read_bytes() if f.exists() else b'-'))
    return h.hexdigest()[:16]


def measure():
    S = slots()
    have = lambda i: S.get(i, {}).get('status') == 'delivered' and (ASSETS / f'{i}.webp').exists()
    rows, data = [], {}
    for who, (ref, boxes, sprites, rot) in CAST.items():
        for look, box in boxes.items():
            rid = ref + look
            if not have(rid):
                continue
            _, al = load(rid)
            H = painted_height(al)
            data[rid] = {'who': who, 'px': H}
            rows.append((who, rid, rid, 1.0, None, 'reference', H))
            for sp in sprites:
                pid = sp + look
                if not have(pid):
                    continue
                if pid in BY_EYE:
                    r, q, how = BY_EYE[pid], None, 'by eye'
                else:
                    q, r = head_ratio(rid, box, pid, rot)
                    how = 'template' if q >= TRUST and 0.42 < r < 1.96 else 'unread: as the reference'
                    if how != 'template':
                        r = 1.0
                px = round(H * r)
                data[pid] = {'who': who, 'px': px}
                rows.append((who, pid, rid, r, q, how, px))
    return rows, data


def render(rows, data):
    lines = ['# Person sizes', '',
             'Generated by `design/source/person_sizes.py`. Every sprite of a character against its reference, by the '
             'head: `px` is the character\'s standing height as painted in that sprite (art px), so a scene draws any '
             'of them at one person height `H` with scale `H / px` (`drawPerson` in `src/pose.js`) and the character '
             'keeps one size from pose to pose. The prince and the crew are covered by `design/sprite-audit.md`.', '',
             '| Character | Sprite | Reference | Head ratio | Match | How | px |', '| --- | --- | --- | --- | --- | --- | --- |']
    for who, pid, rid, r, q, how, px in rows:
        lines.append(f'| {who} | `{pid}` | `{rid}` | {r:.2f} | {"—" if q is None else f"{q:.2f}"} | {how} | {px} |')
    lines.append('')
    js = ['// Generated by design/source/person_sizes.py: each sprite\'s character',
          '// standing height as painted in it (art px), measured by the head against',
          '// the character\'s reference sprite. Draw with drawPerson (src/pose.js) so',
          '// every sprite of a character comes out at one person size.',
          f'// Inputs fingerprint {fingerprint()} (person_sizes.py --check).',
          'export const PERSON = {']
    js += [f"  '{k}': {{ who: '{v['who']}', px: {v['px']} }}," for k, v in data.items()]
    js += ['};', '', '// Each character\'s reference sprite (standing).', 'export const PERSON_REF = {']
    js += [f"  '{who}': '{ref}'," for who, (ref, *_) in CAST.items()]
    js += ['};', '']
    return '\n'.join(lines), '\n'.join(js)


def sheets(rows, data, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    H = 300
    by = {}
    for who, pid, *_ in rows:
        by.setdefault(who, []).append(pid)
    for who, ids in by.items():
        tiles = []
        for pid in ids:
            im = Image.open(ASSETS / f'{pid}.webp').convert('RGBA')
            s = H / data[pid]['px']
            tiles.append((pid, im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))))
        W = sum(t.width for _, t in tiles) + 20 * len(tiles)
        Ht = max(t.height for _, t in tiles) + 10
        sheet = Image.new('RGBA', (W, Ht), (110, 110, 110, 255))
        x = 0
        for _, t in tiles:
            sheet.alpha_composite(t, (x, Ht - t.height))
            x += t.width + 20
        g = np.asarray(sheet).copy()
        for y in range(Ht - H, Ht, 30):
            g[y, :, :3] = (80, 80, 80)
        Image.fromarray(g).convert('RGB').save(out / f'{who}.jpg', quality=85)


if __name__ == '__main__':
    if '--check' in sys.argv:
        if not REPORT.exists() or f'fingerprint {fingerprint()} ' not in OUT_JS.read_text():
            raise SystemExit('person-sizes.md or person-size.js is out of date: rerun person_sizes.py')
        print('Person sizes up to date')
    else:
        rows, data = measure()
        report, js = render(rows, data)
        REPORT.write_text(report)
        OUT_JS.write_text(js)
        if '--sheet' in sys.argv:
            sheets(rows, data, sys.argv[sys.argv.index('--sheet') + 1])
        print(report)
