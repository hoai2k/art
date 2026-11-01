#!/usr/bin/env python3
"""Interim cast and tableaux for the film edition, cut from the planning art.

Until the production sprites (build_film_assets.py, F1-F4) are delivered, the
default edition draws figures cut out of the character sheets in
design/references/film-planning/originals/, and shows the scene concepts as
tableaux in its cutscenes. This script makes them:

- assets/interim/<id>.webp: a figure keyed off its sheet's card (the crop's
  own border colour), keeping only the largest figure in the crop, fitted to
  the production slot's size with its anchor at bottom centre. The slot in
  assets/manifest.json gets "interim": "interim/<id>.webp"; it stays
  `requested`, and the delivered art replaces it.
- assets/tableaux/<id>.webp: a scene concept cropped to its stage (inside the
  painted proscenium, above the footlights) at 1280 x 720, registered as a
  delivered slot `tableau-<scene>`.

Requires Pillow, numpy and scipy.

    python3 kingdomofthefairies/design/source/cut_planning.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'design', 'references', 'film-planning', 'originals')
MANIFEST = os.path.join(ROOT, 'assets', 'manifest.json')
OUT = os.path.join(ROOT, 'assets', 'interim')
TAB = os.path.join(ROOT, 'assets', 'tableaux')

# id: (sheet, (x0, y0, x1, y1) in the sheet's pixels, flip horizontally)
FIGURES = {
    'prince-stand': ('char-bel-azor', (440, 19, 739, 716), False),
    'prince-court': ('char-bel-azor', (1217, 93, 1528, 708), True),
    'azurine-stand': ('char-azurine', (18, 14, 496, 733), False),
    'aurora-stand': ('char-aurora', (13, 8, 555, 739), False),
    'aurora-point': ('char-aurora', (965, 11, 1521, 753), False),
    'water-fairy-stand': ('char-water-fairy', (11, 35, 568, 719), False),
    'witch-hooded': ('char-witch', (17, 68, 418, 708), False),
    'witch-cloud': ('char-witch', (1083, 25, 1510, 452), False),
    'witch-storm': ('char-witch', (1083, 25, 1510, 452), False),
    'witch-barrel': ('char-witch', (1208, 444, 1510, 717), False),
    'king-stand': ('char-royal-court', (0, 60, 320, 615), False),
    'queen-stand': ('char-royal-court', (258, 60, 510, 615), False),
    'fairy-ring': ('char-royal-court', (510, 60, 803, 615), False),
    'fairy-crown': ('char-royal-court', (760, 60, 990, 615), False),
    'fairy-gold': ('char-royal-court', (1004, 60, 1236, 615), False),
    'demon-red': ('char-demons', (475, 125, 790, 700), False),
    'demon-teal': ('char-demons', (1180, 125, 1530, 700), False),
    'crew-squire': ('char-crew', (42, 43, 583, 677), False),
    'crew-helmsman': ('char-crew', (546, 19, 999, 678), False),
    'crew-manatarms': ('char-crew', (1021, 10, 1474, 689), False),
    'crew-asleep': ('char-crew', (1056, 689, 1516, 973), False),
    'octopus': ('char-sea-creatures', (19, 16, 457, 274), False),
    'dolphin-carriage': ('char-sea-creatures', (25, 296, 501, 493), True),
    'lobster-guard-closed': ('char-sea-creatures', (61, 467, 306, 767), False),
    'lobster-guard-open': ('char-sea-creatures', (426, 470, 734, 767), False),
}

# Props cut from the sheets' detail sketches: id: (sheet, box, degrees to turn
# anticlockwise).
DETAILS = {
    'sword-sinking': ('char-bel-azor', (1117, 778, 1501, 941), -90),
    'keepsake-sword': ('char-bel-azor', (1117, 778, 1501, 941), 45),
    'keepsake-seal': ('char-neptune', (994, 782, 1511, 958), 45),
    'gift-ring': ('char-royal-court', (590, 815, 655, 905), 0),
    'gift-crown': ('char-royal-court', (770, 815, 1005, 970), 0),
    'gift-gold': ('char-royal-court', (1130, 820, 1290, 935), 0),
    'gift-flower': ('char-royal-court', (1430, 800, 1510, 965), 0),
}

# The prince's other poses, made from his standing cut-out the way a toy-theatre
# figure is worked: tilted, squashed or laid flat (degrees anticlockwise,
# vertical scale, keep only the top fraction).
DERIVED = {
    'prince-walk-a': (3, 1, 1), 'prince-walk-b': (-3, 1, 1), 'prince-stairs-a': (4, 1, 1), 'prince-stairs-b': (-2, 1, 1),
    'prince-leap': (-14, 1, 1), 'prince-apex': (-6, 1, 1), 'prince-fall': (12, 1, 1), 'prince-land': (0, 0.9, 1),
    'prince-climb-a': (5, 1, 1), 'prince-climb-b': (-5, 1, 1), 'prince-crouch': (-8, 0.82, 1), 'prince-push': (-20, 1, 1),
    'prince-swim-a': (-82, 1, 1), 'prince-swim-b': (-88, 1, 1), 'prince-seated': (0, 1, 0.6),
}

# Gold fairy stars, painted here (no sheet has one on its own).
STARS = ['aurora-star', 'keepsake-star', 'keepsake-lamp']

# Scene concepts shown as cutscene tableaux.
TABLEAUX = ['betrothal', 'curse', 'abduction', 'arming', 'tempest', 'water-fairy', 'procession', 'azure-grotto',
            'whale-shore', 'cliff-gap', 'tower-climb', 'tower-fire', 'stair-carry', 'barrel', 'wedding', 'apotheosis', 'galley-departure']


def cut(sheet, box, flip, tol=40):
    im = Image.open(os.path.join(SRC, sheet + '.png')).convert('RGB').crop(box)
    a = np.asarray(im).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    near = np.sqrt(((a - bg) ** 2).sum(-1)) < tol
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge))
    fg = ndimage.binary_opening(fg, iterations=2)
    l2, n = ndimage.label(fg)
    if n > 1:  # keep the largest figure: drops fragments of its neighbours
        sizes = ndimage.sum(fg, l2, range(1, n + 1))
        fg = l2 == (int(np.argmax(sizes)) + 1)
    fg = ndimage.binary_fill_holes(fg)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert('RGBA')
    out.putalpha(alpha)
    out = out.crop(out.getbbox())
    return out.transpose(Image.FLIP_LEFT_RIGHT) if flip else out


def fit(fig, w, h, anchor='bottom centre'):
    s = min(w / fig.width, h / fig.height)
    f = fig.resize((max(1, round(fig.width * s)), max(1, round(fig.height * s))), Image.LANCZOS)
    # A bottom-anchored figure is kept trimmed to itself, at the slot's height:
    # the game fits film art by height, so padding would shrink it.
    if anchor.startswith('bottom'):
        s = min(h / fig.height, 1.6 * w / fig.width)
        return fig.resize((max(1, round(fig.width * s)), max(1, round(fig.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    y = (h - f.height) // 2 if anchor.startswith('centre') else 0 if anchor.startswith('top') else h - f.height
    canvas.alpha_composite(f, ((w - f.width) // 2, y))
    return canvas


def star(n=1):
    from PIL import ImageDraw
    import math
    size = 256
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((28, 28, size - 28, size - 28), fill=(255, 226, 140, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(26))
    im.alpha_composite(glow)
    d = ImageDraw.Draw(im)
    spots = [(0.5, 0.5, 0.36)] if n == 1 else [(0.5, 0.3, 0.2), (0.3, 0.66, 0.2), (0.7, 0.66, 0.2)]
    for cx, cy, r in spots:
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rr = r * size * (1 if i % 2 == 0 else 0.42)
            pts.append((cx * size + rr * math.cos(a), cy * size + rr * math.sin(a)))
        d.polygon(pts, fill=(222, 178, 74, 255), outline=(150, 104, 40, 255))
        d.ellipse((cx * size - r * size * 0.18, cy * size - r * size * 0.5, cx * size + r * size * 0.05, cy * size - r * size * 0.28), fill=(255, 244, 200, 230))
    return im.crop(im.getbbox())


# A new role's stand-in: a delivered figure, mirrored (the bosun until his own
# sprite arrives, a second sleeper beside the first).
MIRRORS = {'crew-bosun': 'crew-squire', 'crew-asleep-b': 'crew-asleep'}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TAB, exist_ok=True)
    m = json.load(open(MANIFEST))
    slots = m['slots']
    for aid, (sheet, box, flip) in FIGURES.items():
        slot = slots[aid]
        w, h = slot['size']
        fit(cut(sheet, box, flip), w, h, slot['anchor']).save(os.path.join(OUT, aid + '.webp'), quality=90, method=6)
        slot['interim'] = f'interim/{aid}.webp'
    for aid, (sheet, box, turn) in DETAILS.items():
        slot = slots[aid]
        # the sword's grey blade is near the card's colour: key it tighter
        fig = cut(sheet, box, False, 20 if 'sword' in aid else 40).rotate(turn, expand=True, resample=Image.BICUBIC)
        fit(fig.crop(fig.getbbox()), *slot['size'], slot['anchor']).save(os.path.join(OUT, aid + '.webp'), quality=90, method=6)
        slot['interim'] = f'interim/{aid}.webp'
    prince = cut(*FIGURES['prince-stand'])
    for aid, (turn, sy, top) in DERIVED.items():
        slot = slots[aid]
        fig = prince.crop((0, 0, prince.width, round(prince.height * top)))
        if sy != 1:
            fig = fig.resize((fig.width, round(fig.height * sy)), Image.LANCZOS)
        fig = fig.rotate(turn, expand=True, resample=Image.BICUBIC)
        fit(fig.crop(fig.getbbox()), *slot['size'], slot['anchor']).save(os.path.join(OUT, aid + '.webp'), quality=90, method=6)
        slot['interim'] = f'interim/{aid}.webp'
    # Carrying Azurine: his standing cut-out with hers laid across his arms.
    slot = slots['prince-carry']
    her = cut(*FIGURES['azurine-stand']).rotate(78, expand=True, resample=Image.BICUBIC)
    her = her.crop(her.getbbox())
    her = her.resize((round(prince.width * 1.05), round(her.height * prince.width * 1.05 / her.width)), Image.LANCZOS)
    pair = Image.new('RGBA', (prince.width + her.width // 2, prince.height), (0, 0, 0, 0))
    pair.alpha_composite(prince, (0, 0))
    pair.alpha_composite(her, (pair.width - her.width, round(prince.height * 0.28)))
    fit(pair, *slot['size'], slot['anchor']).save(os.path.join(OUT, 'prince-carry.webp'), quality=90, method=6)
    slot['interim'] = 'interim/prince-carry.webp'
    for aid in STARS:
        slot = slots[aid]
        fit(star(3 if aid == 'keepsake-star' else 1), *slot['size'], slot['anchor']).save(os.path.join(OUT, aid + '.webp'), quality=90, method=6)
        slot['interim'] = f'interim/{aid}.webp'
    # New roles drawn as a delivered figure mirrored until their own art arrives.
    for aid, src in MIRRORS.items():
        slot = slots[aid]
        Image.open(os.path.join(ROOT, 'assets', src + '.webp')).transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, aid + '.webp'), quality=90, method=6)
        slot['interim'] = f'interim/{aid}.webp'
    for scene in TABLEAUX:
        im = Image.open(os.path.join(SRC, f'concept-{scene}.png')).convert('RGB')
        W, H = im.size
        h = round(H * 0.86)
        w = round(h * 16 / 9)
        x0 = (W - w) // 2
        im.crop((x0, 0, x0 + w, h)).resize((1280, 720), Image.LANCZOS).save(os.path.join(TAB, scene + '.webp'), quality=88, method=6)
        slots[f'tableau-{scene}'] = {'status': 'delivered', 'file': f'tableaux/{scene}.webp', 'edition': 'film',
                                     'from': f'design/references/film-planning/originals/concept-{scene}.png'}
    with open(MANIFEST, 'w') as f:
        json.dump(m, f, indent=2)
        f.write('\n')
    print(f'{len(FIGURES) + len(DETAILS) + len(DERIVED) + len(STARS)} interim images, {len(TABLEAUX)} tableaux')


if __name__ == '__main__':
    main()
