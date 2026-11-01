"""python3 review/grid.py <sheet.png relative to reference/sheets> <out.png>: the sheet's side and top
views with a centimetre grid in the model frame (z forward, y up, x left; origin on the ground
under the middle of the body), to read part positions from. See ../../../squirrel.md."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from sheet import Sheet

def font(n):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', n)
    except OSError: return ImageFont.load_default()

def grid_image(sh, which, scale=2.0):
    rgb = sh.sp if which == 'side' else sh.tp
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).convert('RGB')
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(im); f = font(12)
    for cm in range(-40, 30):
        z = cm / 100
        if which == 'side':
            x, _ = sh.side_px(z, 0)
        else:
            x, _ = sh.top_px(z, 0)
        x *= scale
        d.line([(x, 0), (x, im.height)], fill=(220, 60, 60) if cm % 5 == 0 else (240, 180, 180), width=1)
        if cm % 5 == 0: d.text((x + 2, 2), f'{cm}', fill=(180, 0, 0), font=f)
    for cm in range(-20, 30):
        v = cm / 100
        if which == 'side':
            _, y = sh.side_px(0, v)
        else:
            _, y = sh.top_px(0, v)
        y *= scale
        d.line([(0, y), (im.width, y)], fill=(60, 60, 220) if cm % 5 == 0 else (180, 180, 240), width=1)
        if cm % 5 == 0: d.text((2, y + 2), f'{cm}', fill=(0, 0, 180), font=f)
    return im

if __name__ == '__main__':
    sh = Sheet(sys.argv[1])
    a, b = grid_image(sh, 'side'), grid_image(sh, 'top')
    out = Image.new('RGB', (a.width + b.width, max(a.height, b.height)), 'white'); out.paste(a, (0, 0)); out.paste(b, (a.width, 0))
    out.save(sys.argv[2]); print('metres per side px', sh.k)
