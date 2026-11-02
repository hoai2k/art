"""python3 review/sheet-overlay.py <creature> <out.png> [label]: the built model (game/assets/<creature>)
drawn over its reference sheet's side and top views at the sheet's scale (anatomy_<creature>.SHEET):
the sheet with the model's outline in red, and the model's painted silhouette beside it. Used for
the before / after turnaround boards when re-measuring against a delivered sheet."""
import os, sys, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from sheet import Sheet

def font(n):
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', n)
    except OSError: return ImageFont.load_default()

def load_model(kind):
    d = os.path.join(HERE, '..', '..', '..', 'game', 'assets', kind)
    m = json.load(open(os.path.join(d, kind + '.json')))
    b = open(os.path.join(d, kind + '.bin'), 'rb').read()
    a = m['attributes']
    P = np.frombuffer(b, np.float32, m['vertexCount'] * 3, a['position']['offset']).reshape(-1, 3)
    I = np.frombuffer(b, np.uint16 if m['index']['type'] == 'u16' else np.uint32, m['indexCount'], m['index']['offset']).reshape(-1, 3)
    ck = [k for k in a if k.startswith('color')][0]
    t = np.float32 if a[ck]['type'] == 'f32' else np.uint8
    k = a[ck]['itemSize']
    C = np.frombuffer(b, t, m['vertexCount'] * k, a[ck]['offset']).reshape(-1, k)[:, :3].astype(np.float32)
    if t == np.uint8: C = C / 255
    return P, I, C

def raster(uv, I, C, size, N, light):
    """painter's-order filled triangles (flat colour per triangle)"""
    im = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    tri = uv[I]; depth = N[I].mean(axis=1)
    col = C[I].mean(axis=1)
    order = np.argsort(depth)
    for k in order:
        sh = light[k]
        c = tuple(int(v) for v in np.clip(col[k] * sh * 255, 0, 255))
        d.polygon([tuple(p) for p in tri[k]], fill=c + (255,))
    return im

def view(sh, P, I, C, which):
    if which == 'side':
        rgb = sh.sp; u, v = sh.side_px(P[:, 2], P[:, 1]); depth = P[:, 0]
    else:
        rgb = sh.tp; u, v = sh.top_px(P[:, 2], P[:, 0]); depth = P[:, 1]
    base = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).convert('RGB')
    uv = np.stack([u, v], 1)
    # flat shading from face normals
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    n = np.cross(b - a, c - a); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    L = np.array([0.4, 0.8, 0.45]) if which == 'side' else np.array([0.3, 0.9, 0.3])
    light = 0.55 + 0.45 * np.clip(np.abs(n @ (L / np.linalg.norm(L))), 0, 1)
    sil = raster(uv, I, C, base.size, depth, light)
    alpha = np.asarray(sil)[..., 3] > 0
    edge = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    over = base.copy()
    # a grid in the model frame, every `step` cm (labelled every 5 steps)
    body = sh.k * (sh.nose - sh.rump)
    step = min((1, 2, 5, 10), key=lambda st: abs(body * 100 / st - 40))
    g = ImageDraw.Draw(over); f = font(11)
    for cm in range(-300, 300, step):
        x = sh.side_px(cm / 100, 0)[0] if which == 'side' else sh.top_px(cm / 100, 0)[0]
        if 0 <= x < base.width:
            g.line([(x, 0), (x, base.height)], fill=(200, 90, 90) if cm % (5 * step) == 0 else (225, 190, 190))
            if cm % (5 * step) == 0: g.text((x + 2, 2), str(cm), fill=(160, 0, 0), font=f)
        y = sh.side_px(0, cm / 100)[1] if which == 'side' else sh.top_px(0, cm / 100)[1]
        if 0 <= y < base.height:
            g.line([(0, y), (base.width, y)], fill=(90, 90, 200) if cm % (5 * step) == 0 else (190, 190, 225))
            if cm % (5 * step) == 0: g.text((2, y + 1), str(cm), fill=(0, 0, 160), font=f)
    over = Image.blend(base, over, 0.6)
    over.paste((230, 30, 30), mask=edge)
    model = Image.new('RGB', base.size, (205, 205, 205)); model.paste(sil, mask=sil)
    return over, model

def board(kind, out, label='', crop=True):
    A = importlib.import_module(f'anatomy_{kind}')
    sh = Sheet(A.SHEETS[A.COATS[0]] if hasattr(A, 'SHEETS') else None, **getattr(A, 'SHEET', {}))
    P, I, C = load_model(kind)
    tiles = []
    for w in ('side', 'top'):
        if w == 'top' and sh.tp is None: continue
        o, m = view(sh, P, I, C, w)
        if crop:   # crop to the drawing and the model, with a margin
            mm = sh.sm if w == 'side' else sh.tm
            r, c = np.where(mm)
            a = np.asarray(m)[..., :3].astype(int); r2, c2 = np.where(np.abs(a - 205).sum(-1) > 6)
            r0, r1 = min(r.min(), r2.min()) - 20, max(r.max(), r2.max()) + 20
            box = (0, max(0, r0), o.width, min(o.height, r1))
            o, m = o.crop(box), m.crop(box)
        tiles.append((o, m))
    W = max(o.width for o, _ in tiles) * 2; H = sum(o.height for o, _ in tiles)
    im = Image.new('RGB', (W, H + 30), (240, 238, 232)); d = ImageDraw.Draw(im)
    d.text((6, 6), f'{kind} {label}: sheet + model outline (red) | model at the same scale', fill=(20, 20, 20), font=font(16))
    y = 30
    for o, m in tiles:
        im.paste(o, (0, y)); im.paste(m, (W // 2, y)); y += o.height
    im.save(out); print('board', out, im.size)

if __name__ == '__main__':
    board(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
