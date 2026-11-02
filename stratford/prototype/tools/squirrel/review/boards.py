"""python3 boards.py <dir>: assemble the review renders written by shots.mjs into boards:
final_turnaround.png (reference sheet + side / top / 3-4 / front), final_gaits.png (a strip per
gait), final_actions.png (jump arc, climb, sit, dig, swim)."""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
SHEET = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'reference', 'sheets', 'provisional', 'wobblers_squirrel.png')
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
except OSError: F = ImageFont.load_default()

def row(files, label, w=320):
    ims = [Image.open(f).convert('RGB') for f in files if os.path.exists(f)]
    if not ims: return None
    ims = [i.resize((w, int(i.height * w / i.width))) for i in ims]
    h = max(i.height for i in ims)
    out = Image.new('RGB', (w * len(ims), h + 26), (240, 238, 232))
    for k, i in enumerate(ims): out.paste(i, (k * w, 26))
    ImageDraw.Draw(out).text((6, 3), label, fill=(30, 30, 30), font=F)
    return out

def stack(rows, name):
    rows = [r for r in rows if r]
    if not rows: return
    W = max(r.width for r in rows); H = sum(r.height for r in rows)
    out = Image.new('RGB', (W, H), (240, 238, 232)); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(os.path.join(D, name)); print('board', name, out.size)

sheet = None
if os.path.exists(SHEET):
    s = Image.open(SHEET).convert('RGB'); s.save(os.path.join(D, '_sheet.png'))
    sheet = row([os.path.join(D, '_sheet.png')], 'reference (provisional Wobblers sheet: proportions only)', 1280)
stack([sheet, row([os.path.join(D, f'turn_{i}.png') for i in range(4)], 'model: side / top / three-quarter / front (idle pose)')], 'final_turnaround.png')
stack([row(sorted(glob.glob(os.path.join(D, f'gait_{g}_*.png'))), f'{g}') for g in ('walk', 'half', 'bound')], 'final_gaits.png')
stack([row(sorted(glob.glob(os.path.join(D, f'act_{a}_*.png'))), a) for a in ('jump', 'climb', 'sit', 'dig', 'swim')], 'final_actions.png')
