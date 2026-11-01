"""Audit the delivered character sprites for size and placement.

Run after every art delivery (python3 design/source/audit_sprites.py; add
--check to fail when the outputs are stale). It needs Pillow, numpy and
OpenCV, so CI does not run it.

1. Every bottom-centre figure in the manifest: the canvas matches the
   requested size, and the feet (the lowest opaque row) touch the canvas
   bottom, so the game's ground line is the sprite's.
2. Every walking cycle (contact A, passing A, contact B, passing B): the head
   top of each frame against the cycle's passing frames, and the painted body
   size against contact A (head-and-shoulders template match). A real walk
   dips the head about 2.5% of the figure's height at each contact; a frame
   that dips further makes the figure bob. Such a frame is scaled up from its
   feet (src/sprite-fit.js, generated here) until its head dips no more than
   that, and listed for redrawing.

Writes design/sprite-audit.md and src/sprite-fit.js.
"""
import json, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'assets'
REPORT = ROOT / 'design' / 'sprite-audit.md'
FIT = ROOT / 'src' / 'sprite-fit.js'
# Poses checked for character size against a reference sprite of the same
# look, by its head: (pose, reference, rotation searched, sprites that share
# the pose's correction). The model paints a pose to fill its canvas, so a
# kneeling or stooping figure can come out far larger than his standing self.
POSES = [
    *[(p, 'prince-stand', 45, ()) for p in ('prince-kneel-rise', 'prince-kneel', 'prince-collared', 'prince-lift', 'prince-crawl-a', 'prince-crawl-b')],
    ('prince-dive', 'prince-stand', 90, ()),
    # the back-view climbing set shows no face; the turn to the wall does, and
    # is drawn at the set's scale, so its correction is the set's
    ('prince-wall-step', 'prince-stand', 45, tuple(f'prince-wall-{f}' for f in ('up-a', 'up-b', 'up-c', 'up-d', 'side-a', 'side-b', 'side-c', 'side-d', 'idle', 'idle-b', 'leap', 'catch', 'hit')) + ('prince-mantle-a', 'prince-mantle-b', 'prince-mantle-c')),
    *[(p, 'prince-carry', 45, ()) for p in ('prince-carry-climb-a', 'prince-carry-climb-b')],
    *[(p, 'prince-court', 45, ()) for p in ('prince-court-leap', 'prince-court-fall', 'prince-court-reach')],
]
# The crew's poses, matched on each crewman's own face (box in his standing
# sprite, x0, y0, x1, y1 art px, per look); a hat, plume or halberd would
# spoil a template of the whole top of the figure.
CREW_FACES = {
    'squire': {'': (45, 90, 105, 150), '-tinted': (57, 103, 120, 150)},
    'bosun': {'': (95, 70, 140, 120), '-tinted': (73, 80, 127, 123)},
    'helmsman': {'': (60, 75, 110, 125), '-tinted': (73, 60, 133, 110)},
    'manatarms': {'': (80, 60, 140, 125), '-tinted': (77, 53, 143, 110)},
}
CREW_POSES = ('sit-up', 'crawl', 'tumble')
# Sprites no template can read (a sleeping face turned on its side), sized by
# eye against the standing crewman at the game's drawing scale, 16 Oct 2026:
# the lying squire is painted about 1.3x his standing size, the man-at-arms\' a little small.
BY_EYE = {'crew-asleep': 0.77, 'crew-asleep-tinted': 0.72, 'crew-asleep-b': 1.08, 'crew-asleep-b-tinted': 1.2,
          # the prince swimming, by his helmet against prince-stand at the drawing
          # scale, 31 Oct 2026 (the template misreads the underwater strokes): the
          # reaching stroke (a) and both underwater strokes are painted smaller
          'prince-swim-a': 1.163, 'prince-swim-a-tinted': 1.087, 'prince-swim-b': 1.0, 'prince-swim-b-tinted': 1.0,
          'prince-swim-under-a': 1.16, 'prince-swim-under-b': 1.16,
          'prince-swim-under-a-tinted': 1.18, 'prince-swim-under-b-tinted': 1.18}
# Checked by eye against their reference at the game's drawing scale, 30 Oct
# 2026, and drawn as painted: veils, raised arms and faces on their side throw
# the head template off (it read 0.5-0.76, or 0.74-1.08 for the sleepers, where
# the heads match). Each crewman asleep against his standing sprite, the
# armoury's and the abduction's poses against the figure they replace.
AS_PAINTED = {
    **{f'crew-{c}-asleep{t}': f'crew-{c}{t}' + ('-redo' if c == 'manatarms' else '')
       for c in ('squire', 'bosun', 'helmsman', 'manatarms') for t in ('', '-tinted')},
    **{f'{p}{t}': f'{r}{t}' for p, r in (('prince-struggle-a', 'prince-bound'), ('prince-struggle-b', 'prince-bound'),
                                          ('aurora-glide-a', 'aurora-stand'), ('aurora-glide-b', 'aurora-stand'),
                                          ('azurine-swoon', 'azurine-stand'), ('demon-red-carry', 'demon-red'),
                                          ('demon-teal-carry', 'demon-teal')) for t in ('', '-tinted')},
}
POSE_TOL = 0.06      # a head within 6% of the reference's is drawn as painted
POSE_MATCH = 0.55    # below this match score the measure is not trusted
DIP = 0.025          # the head's natural dip at a contact, of figure height
FEET_TOL = 3         # px of transparent margin under the feet allowed

# (cycle, contact id stem, passing id stem, looks)
CYCLES = [
    ('Prince, armed', 'prince-stride', 'prince-pass', ('', '-tinted')),
    ('Prince, court dress', 'prince-court-stride', 'prince-court-pass', ('', '-tinted')),
    ('Azurine', 'azurine-walk', 'azurine-pass', ('', '-tinted')),
    ('Prince carrying Azurine', 'prince-carry-walk', 'prince-carry-pass', ('', '-tinted')),
    ('Sailor', 'sailor-stride', 'sailor-pass', ('',)),
    ('Sailor carrying', 'sailor-carry-walk', 'sailor-carry-pass', ('',)),
]


def load(aid):
    im = np.asarray(Image.open(ASSETS / f'{aid}.webp').convert('RGBA')).astype(np.float32)
    a = im[:, :, 3]
    g = (im[:, :, :3] * (a[:, :, None] / 255) + 128 * (1 - a[:, :, None] / 255)).mean(axis=2).astype(np.uint8)
    return g, a


def bounds(a):
    ys, xs = np.where(a > 40)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def feet_gap(im):
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    return im.size[1] - 1 - int(np.where(a.max(axis=1) > 40)[0].max())


def body_scale(ref, aid, frac=0.24):
    """Painted body size of `aid` relative to `ref`, and the match quality."""
    g, a = load(ref)
    t, b, l, r = bounds(a)
    tpl = g[t:t + int((b - t) * frac), l:r + 1]
    G, _ = load(aid)
    best = (-1.0, 1.0)
    for s in np.arange(0.85, 1.18, 0.005):
        Gs = cv2.resize(G, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if Gs.shape[0] < tpl.shape[0] or Gs.shape[1] < tpl.shape[1]:
            continue
        v = float(cv2.matchTemplate(Gs, tpl, cv2.TM_CCOEFF_NORMED).max())
        if v > best[0]:
            best = (v, float(s))
    return 1 / best[1], best[0]


def head_scale(ref, aid, rot, box=None):
    """How large `aid`'s figure is against `ref`'s, by the head (the top 17%
    of the reference figure, or the face in `box`), searched over size and
    rotation."""
    g, a = load(ref)
    if box:
        x0, y0, x1, y1 = box
        tpl = g[y0:y1, x0:x1]
    else:
        t, b, l, r = bounds(a)
        band = a[t:t + int((b - t) * 0.17)]
        cols = np.where(band.max(0) > 40)[0]
        tpl = g[t:t + int((b - t) * 0.17), cols.min():cols.max() + 1]
    G, _ = load(aid)
    best = (-1.0, 1.0)
    for ang in range(-rot, rot + 1, 15 if not box else 10):
        for s in np.arange(0.6 if box else 0.5, 1.7, 0.02):
            T = cv2.resize(tpl, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            if ang:
                M = cv2.getRotationMatrix2D((T.shape[1] / 2, T.shape[0] / 2), ang, 1)
                T = cv2.warpAffine(T, M, (T.shape[1], T.shape[0]), borderValue=128)
            if T.shape[0] >= G.shape[0] or T.shape[1] >= G.shape[1]:
                continue
            v = float(cv2.matchTemplate(G, T, cv2.TM_CCOEFF_NORMED).max())
            if v > best[0]:
                best = (v, float(s))
    return best[1], best[0]


def audit():
    slots = json.load(open(ASSETS / 'manifest.json'))['slots']
    lines, fit, problems = [], {}, []
    lines += ['# Sprite audit', '', 'Generated by `design/source/audit_sprites.py` from the delivered art; '
              'rerun it after every delivery. Heights and tops are in art pixels.', '']

    # 1. canvases and feet
    rows = []
    for aid, s in sorted(slots.items()):
        if s.get('status') != 'delivered' or not str(s.get('anchor', '')).startswith('bottom centre') or not s['file'].endswith('.webp'):
            continue
        if aid.startswith(('gift-', 'keepsake-', 'armour-', 'sword', 'pearl')):
            continue
        path = ASSETS / s['file']
        if not path.exists():
            continue
        im = Image.open(path)
        gap = feet_gap(im)
        # an idle frame stands where its still does
        still = aid.split('-idle-')[0] if '-idle-' in aid else None
        base = feet_gap(Image.open(ASSETS / slots[still]['file'])) if still and (ASSETS / slots.get(still, {}).get('file', '-')).exists() else 0
        size_ok = list(im.size) == list(s.get('size', im.size))
        if abs(gap - base) > FEET_TOL or not size_ok:
            rows.append(f'| `{aid}` | {im.size[0]} × {im.size[1]} | {s.get("size")} | {gap} |')
    lines += ['## Canvases and feet', '',
              f'Every delivered bottom-centre figure must fill its requested canvas and stand on its bottom edge '
              f'(at most {FEET_TOL} px of clear canvas under the lowest opaque row; an idle frame, where its still stands).', '']
    if rows:
        problems += [f'{len(rows)} sprites off their canvas or ground']
        lines += ['| Sprite | Canvas | Requested | Clear px under feet |', '| --- | --- | --- | --- |', *rows, '']
    else:
        lines += ['All pass.', '']

    # 2. walking cycles
    lines += ['## Walking cycles', '',
              f'Head top per frame, its dip below the passing frames (of the figure height; a walk dips about '
              f'{DIP:.1%}), and painted body size against contact A (head-and-shoulders match; the match score '
              f'shows how far to trust it). A frame that dips further is scaled up from its feet to a '
              f'{DIP:.1%} dip in play (`src/sprite-fit.js`) and should be redrawn.', '']
    for name, contact, passing, looks in CYCLES:
        for t in looks:
            ids = [f'{contact}-a{t}', f'{passing}-a{t}', f'{contact}-b{t}', f'{passing}-b{t}']
            if not all((ASSETS / f'{i}.webp').exists() and slots.get(i, {}).get('status') == 'delivered' for i in ids):
                continue
            tops, H = {}, None
            for i in ids:
                _, a = load(i)
                H = a.shape[0]
                tops[i] = bounds(a)[0]
            hi = min(tops[ids[1]], tops[ids[3]])
            lines += [f'### {name}{" (tinted)" if t else ""}', '', '| Frame | Head top | Dip | Body size | Match | In play |', '| --- | --- | --- | --- | --- | --- |']
            for i in ids:
                dip = (tops[i] - hi) / (H - hi)
                size, q = (1.0, 1.0) if i == ids[0] else body_scale(ids[0], i)
                scale = 1.0
                if dip > DIP + 0.005:
                    scale = round((1 - DIP) / (1 - dip), 3)
                    fit[i] = scale
                    problems.append(f'{i} dips {dip:.1%}')
                note = f'scaled {scale:.3f}' if scale != 1 else 'as drawn'
                lines.append(f'| `{i}` | {tops[i]} | {dip:.1%} | {size:.3f} | {q:.2f} | {note} |')
            lines.append('')
    # 3. climbing frames (F19): seen from behind and anchored at the lowest
    # boot; each set is compared with its first frame. The head ducks and
    # lifts between climbing frames as a climber's does, so these numbers are
    # for reading against the contact sheet, not a fit.
    lines += ['## Climbing frames', '',
              'Back-view climbing frames, anchored at the lowest boot: canvas, the clear rows above the figure, the '
              'painted area against the set\'s first frame, and whether the feet touch the bottom. Check them side '
              'by side as well; only a frame off its canvas or ground is listed for redrawing.', '']
    for t in ('', '-tinted'):
        ids = [aid for aid in sorted(slots) if aid.startswith('prince-wall-') or aid.startswith('prince-mantle-')]
        ids = [aid for aid in ids if aid.endswith('-tinted') == bool(t) and slots[aid].get('status') == 'delivered' and (ASSETS / slots[aid]['file']).exists()]
        if not ids:
            continue
        lines += [f'### Prince climbing{" (tinted)" if t else ""}', '', '| Frame | Canvas | Clear above | Area vs up-a | Feet |', '| --- | --- | --- | --- | --- |']
        areas = {}
        for aid in ids:
            im = Image.open(ASSETS / slots[aid]['file'])
            a = np.asarray(im.convert('RGBA'))[:, :, 3] > 40
            areas[aid] = int(a.sum())
        for aid in ids:
            im = Image.open(ASSETS / slots[aid]['file'])
            _, a = load(aid)
            top = bounds(a)[0]
            first = f'prince-wall-up-a{t}' if f'prince-wall-up-a{t}' in areas else ids[0]
            gap = feet_gap(im)
            ok = list(im.size) == [360, 440] and gap <= FEET_TOL
            if not ok:
                problems.append(f'{aid}: canvas {im.size[0]} x {im.size[1]}, {gap} px under the feet')
            lines.append(f'| `{aid}` | {im.size[0]} × {im.size[1]} | {top} | {areas[aid] / areas[first]:.2f} | {"on the ground" if gap <= FEET_TOL else f"{gap} px above"} |')
        lines.append('')
    # 4. character size of poses against their reference
    pose_fit = {}
    lines += ['## Character size of poses', '',
              f'Head size of each pose against its reference sprite (same look). Beyond {POSE_TOL:.0%} the game draws the '
              f'pose scaled to the reference (`POSE_FIT` in `src/sprite-fit.js`), with the sprites that share it; a match '
              f'under {POSE_MATCH} is not trusted and left as painted.', '',
              '| Pose | Reference | Size | Match | In play |', '| --- | --- | --- | --- | --- |']
    for pose, ref, rot, shared in POSES:
        for t in ('', '-tinted'):
            pid, rid = pose + t, ref + t
            if not all(slots.get(i, {}).get('status') == 'delivered' and (ASSETS / f'{i}.webp').exists() for i in (pid, rid)):
                continue
            size, q = head_scale(rid, pid, rot)
            note = 'as painted'
            # a best size at the search's edge is no measure
            if not 0.52 < size < 1.68:
                note = 'as painted (no reliable match)'
            elif q >= POSE_MATCH and abs(size - 1) > POSE_TOL:
                f = round(1 / size, 3)
                for i in (pose, *shared):
                    if slots.get(i + t, {}).get('status') == 'delivered':
                        pose_fit[i + t] = f
                note = f'drawn × {f:.3f}' + (f' (and its {len(shared)} set)' if shared else '')
            lines.append(f'| `{pid}` | `{rid}` | {size:.2f} | {q:.2f} | {note} |')
    for crew, boxes in CREW_FACES.items():
        for pose in CREW_POSES:
            for t, box in boxes.items():
                pid = f'crew-{crew}-{pose}{t}'
                rid = f'crew-{crew}{t}' + ('-redo' if crew == 'manatarms' else '')
                if not all(slots.get(i, {}).get('status') == 'delivered' and (ASSETS / f'{i}.webp').exists() for i in (pid, rid)):
                    continue
                size, q = head_scale(rid, pid, 120 if pose == 'tumble' else 60, box)
                # a best size at the search's edge is no measure
                trusted = q >= 0.58 and 0.62 < size < 1.68
                note = 'as painted'
                if trusted and abs(size - 1) > POSE_TOL:
                    pose_fit[pid] = round(1 / size, 3)
                    note = f'drawn × {pose_fit[pid]:.3f}'
                elif not trusted:
                    note = 'as painted (no reliable match)'
                lines.append(f'| `{pid}` | `{rid}` face | {size:.2f} | {q:.2f} | {note} |')
    for pid, f in BY_EYE.items():
        if slots.get(pid, {}).get('status') == 'delivered':
            pose_fit[pid] = f
            lines.append(f'| `{pid}` | {"prince-stand" if pid.startswith("prince-") else "standing crewman"}, by eye | {1 / f:.2f} | — | drawn × {f:.3f} |')
    for pid, rid in AS_PAINTED.items():
        if slots.get(pid, {}).get('status') == 'delivered':
            lines.append(f'| `{pid}` | `{rid}`, by eye | 1.00 | — | as painted |')
    lines.append('')
    # 5. where a lying figure rests: the underside of its lower back, the
    # middle fifth of the figure (a lying figure is often at an angle, so it
    # drapes over the ground from the hips, its head, feet, a halberd, rope or
    # trailing hand reaching below the line)
    rest = {}
    lying = sorted(i for i in slots if slots[i].get('status') == 'delivered' and 'asleep' in i
                   and (i.startswith('crew-') or i.startswith('azurine-')) and (ASSETS / f'{i}.webp').exists())
    if lying:
        lines += ['## Where lying figures rest', '',
                  'Rows between the underside of the lower back (the lowest row at least 60% filled across the middle '
                  'fifth of the figure) and the canvas bottom; the game lays the hips on the ground, so the figure '
                  'drapes over it, head, feet and props lower (`REST_GAP` in `src/sprite-fit.js`).', '', '| Sprite | Canvas | Rest gap |', '| --- | --- | --- |']
        for i in lying:
            im = Image.open(ASSETS / f'{i}.webp')
            a = np.asarray(im.convert('RGBA'))[:, :, 3] > 60
            cols = np.where(a.any(0))[0]
            x0, width = cols.min(), cols.max() - cols.min() + 1
            mid = a[:, x0 + int(0.4 * width):x0 + int(0.6 * width) + 1].mean(1)
            line = max(y for y in range(a.shape[0]) if mid[y] >= 0.6)
            rest[i] = int(a.shape[0] - 1 - line)
            lines.append(f'| `{i}` | {im.size[0]} × {im.size[1]} | {rest[i]} |')
        lines.append('')
    lines += ['## To redraw', '']
    lines += [f'- {p}' for p in problems] or ['Nothing.']
    lines.append('')
    js = ['// Generated by design/source/audit_sprites.py: walking frames whose head',
          '// dips too far below their passing frames, scaled up from the feet until',
          '// the dip is natural. Rerun the audit after every art delivery.',
          'export const WALK_FIT = {']
    js += [f"  '{k}': {v}," for k, v in sorted(fit.items())]
    js += ['};', '',
           '// Poses painted larger or smaller than their character (by the head',
           '// against a reference sprite); the game draws each at this scale.',
           'export const POSE_FIT = {']
    js += [f"  '{k}': {v}," for k, v in sorted(pose_fit.items())]
    js += ['};', '',
           '// Lying figures: art rows from the underside of the lower back to the',
           '// canvas bottom; the hips rest on the ground and the figure drapes over it.',
           'export const REST_GAP = {']
    js += [f"  '{k}': {v}," for k, v in sorted(rest.items())]
    js += ['};', '']
    return '\n'.join(lines), '\n'.join(js)


if __name__ == '__main__':
    report, js = audit()
    if '--check' in sys.argv:
        if REPORT.read_text() != report or FIT.read_text() != js:
            raise SystemExit('sprite-audit.md or sprite-fit.js is out of date: rerun audit_sprites.py')
        print('Sprite audit up to date')
    else:
        REPORT.write_text(report)
        FIT.write_text(js)
        print(report.split('## To redraw')[1].strip())
