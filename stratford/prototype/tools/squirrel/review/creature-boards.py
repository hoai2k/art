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

# beside the sheets: the turnaround board next to the turnaround sheet, the gait board next to the
# pose sheet (reference/sheets/<creature>_turnaround.png / _poses.png), when they exist
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'reference', 'sheets')
def beside(board, sheet, name, label):
    if not os.path.exists(sheet): return
    a = Image.open(os.path.join(D, board)).convert('RGB'); b = Image.open(sheet).convert('RGB')
    b = b.resize((int(b.width * a.height / b.height), a.height))
    out = Image.new('RGB', (a.width + b.width + 12, a.height + 28), (240, 238, 232))
    out.paste(a, (0, 28)); out.paste(b, (a.width + 12, 28))
    ImageDraw.Draw(out).text((6, 4), label, fill=(30, 30, 30), font=F)
    out.save(os.path.join(D, name)); print('board', name, out.size)
beside(f'{kind}_turnaround.png', os.path.join(REF, f'{kind}_turnaround.png'), f'{kind}_turnaround_vs_sheet.png', f'{kind}: model (left) | turnaround sheet (right)')
beside(f'{kind}_gaits.png', os.path.join(REF, f'{kind}_poses.png'), f'{kind}_gaits_vs_poses.png', f'{kind}: gaits and actions (left) | pose sheet (right)')
