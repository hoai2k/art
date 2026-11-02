"""python3 creature-boards.py <dir> <creature> <action ...>: boards from creature-shots.mjs:
<creature>_turnaround.png (side / top / 3-4 / front) and <creature>_gaits.png (a strip per action)."""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont

D, kind, actions = sys.argv[1], sys.argv[2], sys.argv[3:]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except OSError: F = ImageFont.load_default()

def row(files, label, w=320):
    ims = [Image.open(f).convert('RGB') for f in files]
    if not ims: return None
    ims = [i.resize((w, int(i.height * w / i.width))) for i in ims]
    h = max(i.height for i in ims)
    out = Image.new('RGB', (w * len(ims), h + 28), (240, 238, 232))
    for k, i in enumerate(ims): out.paste(i, (k * w, 28))
    ImageDraw.Draw(out).text((6, 4), label, fill=(30, 30, 30), font=F)
    return out

def stack(rows, name):
    rows = [r for r in rows if r]
    W = max(r.width for r in rows); H = sum(r.height for r in rows)
    out = Image.new('RGB', (W, H), (240, 238, 232)); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(os.path.join(D, name)); print('board', name, out.size)

frames = lambda a: sorted(glob.glob(os.path.join(D, f'{kind}_{a}_*.png')), key=lambda f: int(f.rsplit('_', 1)[1][:-4]))
stack([row(frames('turn'), f'{kind}: side / top / three-quarter / front')], f'{kind}_turnaround.png')
stack([row(frames(a), f'{kind}: {a}') for a in actions], f'{kind}_gaits.png')
