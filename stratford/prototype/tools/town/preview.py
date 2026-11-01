#!/usr/bin/env python3
"""Top-down preview PNG of game/data: terrain shading, buildings by height, roads, water, trees, landmarks."""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from common import *

S = 0.9  # px per metre


def main(out, crop=None):
    town = json.load(open(os.path.join(OUT_DIR, 'town.json')))
    b = town['bounds']; tr = town['terrain']
    if crop:
        cx0, cz0, cx1, cz1 = crop
    else:
        cx0, cz0, cx1, cz1 = b['minX'], b['minZ'], b['maxX'], b['maxZ']
    scale = S if not crop else 3.0
    W, H = int((cx1 - cx0) * scale), int((cz1 - cz0) * scale)
    P = lambda x, z: ((x - cx0) * scale, (z - cz0) * scale)
    raw = np.fromfile(os.path.join(OUT_DIR, 'terrain.bin'), '<u2').reshape(tr['nz'], tr['nx']).astype('float64') / 100
    gy, gx = np.gradient(raw, 4.0)
    shade = np.clip(0.5 + (-(gx) * 0.7 + (-gy) * 0.7) * 2.5, 0, 1)   # light from NW
    relief = (raw - raw.min()) / max(1, np.ptp(raw))
    img_t = np.stack([0.55 + 0.25 * shade - 0.1 * relief] * 3, -1)
    img_t[..., 1] += 0.08
    tw, th = tr['nx'], tr['nz']
    base = Image.fromarray((np.clip(img_t, 0, 1) * 255).astype('uint8')).resize(
        (int(tw * 4 * scale), int(th * 4 * scale)), Image.BILINEAR)
    img = Image.new('RGB', (W, H), (150, 160, 140))
    img.paste(base, (int((tr['x0'] - cx0) * scale), int((tr['z0'] - cz0) * scale)))
    d = ImageDraw.Draw(img, 'RGBA')
    colors = {'park': (110, 170, 90, 150), 'grass': (130, 185, 100, 110), 'garden': (90, 160, 80, 170), 'parking': (170, 170, 175, 200),
              'wood': (60, 120, 60, 170), 'pitch': (120, 190, 110, 170), 'plaza': (215, 200, 170, 220), 'cemetery': (120, 150, 110, 170),
              'railway': (150, 140, 130, 150)}
    for a in town['areas']:
        d.polygon([P(*p) for p in a['outer']], fill=colors.get(a['kind'], (200, 200, 200, 100)))
    for w in town['water']['polygons']:
        d.polygon([P(*p) for p in w['outer']], fill=(70, 130, 200, 255))
        for h in w.get('holes', []):
            d.polygon([P(*p) for p in h], fill=(150, 160, 140, 255))
    rc = {'primary': (250, 235, 160), 'secondary': (250, 235, 160), 'tertiary': (255, 250, 230), 'residential': (255, 255, 255),
          'service': (235, 235, 235), 'footway': (205, 160, 140), 'path': (190, 150, 120), 'cycleway': (150, 150, 220), 'steps': (200, 100, 100)}
    for r in sorted(town['roads'], key=lambda r: r['width']):
        d.line([P(*p) for p in r['points']], fill=rc.get(r['kind'], (255, 255, 255)) + (255,), width=max(1, int(r['width'] * scale)))
    for r in town['railways']:
        d.line([P(*p) for p in r['points']], fill=(60, 60, 60, 255), width=max(1, int(2 * scale)))
    for r in town['water']['rivers']:
        d.line([P(*p) for p in r['points']], fill=(60, 110, 190, 255), width=max(1, int(r['width'] * scale * 0.4)))
    hs = [x['height'] + x['roofHeight'] * 0.6 for x in town['buildings']]
    for x in town['buildings']:
        h = x['height'] + x['roofHeight'] * 0.6
        t = min(1, h / 20)
        col = (int(250 - 190 * t), int(215 - 160 * t), int(120 + 60 * t) if t < .5 else int(150 - 100 * (t - .5)))
        col = (int(255 * min(1, 0.4 + t * 1.2)), int(220 * (1 - t) + 20), int(90 + 120 * t * (1 - t) * 2))
        d.polygon([P(*p) for p in x['outer']], fill=col + (255,), outline=(60, 40, 30, 255))
    for t in town['trees']:
        x, y = P(t['x'], t['z']); r = max(1.2, t['crown'] * scale / 2)
        c = {'willow': (150, 190, 70), 'maple': (50, 130, 50), 'oak': (30, 100, 40), 'spruce': (20, 80, 70), 'linden': (90, 160, 60)}.get(t['kind'], (70, 140, 70))
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (170,))
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    except Exception:
        f = ImageFont.load_default()
    for l in town['landmarks']:
        x, y = P(l['x'], l['z'])
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(220, 0, 0, 255), outline=(255, 255, 255, 255))
        d.text((x + 7, y - 7), l['name'], fill=(0, 0, 0, 255), font=f, stroke_width=2, stroke_fill=(255, 255, 255, 255))
    sp = town['spawn']; x, y = P(sp['x'], sp['z'])
    d.polygon([(x, y - 8), (x + 6, y + 6), (x - 6, y + 6)], fill=(255, 140, 0, 255), outline=(0, 0, 0, 255))
    img.save(out)
    print('wrote', out, img.size)


if __name__ == '__main__':
    out = sys.argv[1]
    crop = tuple(map(float, sys.argv[2:6])) if len(sys.argv) >= 6 else None
    main(out, crop)
