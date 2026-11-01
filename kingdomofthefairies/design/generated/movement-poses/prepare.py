"""Extract generated figures, preserve aspect ratio, and fit anatomical scale.

Run from any directory with Pillow, NumPy and SciPy installed. No body parts
are warped or repainted: only connected-component extraction and uniform
resampling. Head measurements are cap-top to beard-bottom, in source pixels.
"""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[2]
JOBS = [
    ('sailor-apex', 'air', 1, 117, 275),
    ('sailor-fall', 'air', 2, 119, 772),
    ('sailor-land', 'air', 5, 118, 290),
    ('sailor-throw', 'air', 4, 114, 703),
    ('sailor-climb-a', 'climb', 1, 127, 245),
    ('sailor-climb-b', 'climb', 2, 125, 781),
    ('sailor-stairs-a', 'climb', 3, 121, 270),
    ('sailor-stairs-b', 'climb', 4, 123, 768),
]
records = []
review = Image.new('RGB', (1440, 620), '#d0c5b8')
pen = ImageDraw.Draw(review)
for index, (ident, source, component, head, root_x) in enumerate(JOBS):
    raw = Image.open(ROOT / 'originals' / (source + '.png')).convert('RGBA')
    pixels = np.array(raw)
    labels, _ = ndimage.label(pixels[:, :, 3] > 32)
    mask = ndimage.binary_dilation(labels == component, iterations=3)
    pixels[:, :, 3] = np.where(mask, pixels[:, :, 3], 0)
    figure = Image.fromarray(pixels)
    crop = figure.getchannel('A').getbbox()
    left, top, right, bottom = crop
    scale = 60 / head  # standing reference has a 60px cap-to-chin head
    art = figure.crop(crop)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
    x = round(180 - (root_x - left) * scale)
    y = 440 - art.height
    assert 0 <= x and x + art.width <= 360 and y >= 0, ident
    out = Image.new('RGBA', (360, 440))
    out.paste(art, (x, y))
    out.save(ROOT / 'delivery' / (ident + '.png'), optimize=True)
    out.save(GAME / 'intake' / (ident + '.png'), optimize=True)
    out.save(GAME / 'assets' / (ident + '.webp'), quality=94, method=6)
    records.append(dict(id=ident, source=source+'.png', component=component,
                        sourceCrop=list(crop), sourceHeadHeight=head,
                        referenceHeadHeight=60, uniformScale=scale,
                        sourceRootX=root_x, placement=[x, y, *art.size],
                        size=[360, 440], anchor=[180, 440]))
    px = index % 4 * 360
    py = index // 4 * 310
    preview = out.resize((180, 220), Image.Resampling.LANCZOS)
    review.paste(preview, (px + 160, py + 55), preview)
    pen.line((px+10, py+275, px+350, py+275), fill='#8b5c60')
    pen.text((px+12, py+12), ident, fill='#2a1424')
    # The reference beside each pose is drawn at the same art-to-stage scale.
    ref = Image.open(GAME / 'assets' / 'sailor-stand.webp').convert('RGBA').resize((110, 180))
    review.paste(ref, (px+5, py+95), ref)
review.save(ROOT / 'review.jpg', quality=94)
(ROOT / 'fitting.json').write_text(json.dumps(records, indent=2)+'\n')
print('Prepared eight sprites at uniform anatomical scale, with a shared foot anchor')
