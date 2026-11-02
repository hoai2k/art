"""Build a playable creature: anatomy parts -> signed distance fields -> smooth union -> surface nets ->
decimated, rigged (skin weights from the part fields), painted mesh for the game.

    python3 stratford/prototype/tools/squirrel/build.py [--creature squirrel|beaver|rabbit|swan|heron]
                                                       [--paint procedural|sheet] [--tris N]

Each creature is an anatomy module beside this file (anatomy.py for the squirrel, anatomy_<name>.py
for the others) with the same interface: SPINE / LIMBS / TAIL_* (the skeleton, rest pose, cm),
parts(B) (the soft-tissue parts), ENDS, EYE, FUR, and optionally COATS, paint(ctx, coat),
fur_adjust(ctx, fur), SHEETS / SHEET (reference sheets and how to scale them), META (extra data
for the game, e.g. a bird's wing feather layout), TRIS, BODY_BONES.

Writes stratford/prototype/game/assets/<name>/<name>.json + <name>.bin (see FORMAT below).
Needs numpy, scipy, Pillow and fast-simplification (installed into /home/user/art/local/pylib:
`pip install --target local/pylib fast-simplification`, then delete local/pylib/numpy*).

--paint procedural (default): both coats painted from the anatomy (regions by bone, normal and
    position): grizzled grey back, rusty wash on flanks, face and feet, cream belly, eye-ring, etc.
--paint sheet: the grey coat projected from reference/sheets/squirrel_grey_turnaround.png (R1.1)
    and the black from squirrel_black_turnaround.png (R1.2) (side and top views, by the vertex
    normal), with the procedural coat filling what the sheets can't see (belly, inner legs).
    Falls back to the provisional sheet with --sheet <file>.

FORMAT (squirrel.json): { version, bones: [{name, parent (index or -1), pos [x, y, z] metres (rest,
model space)}], vertexCount, indexCount, attributes: {name: {offset, count, itemSize, type,
normalized}}, index: {offset, type}, eyes, whiskers, fur, bounds }. squirrel.bin holds the arrays
at those byte offsets: position f32x3, normal i8x4 (normalized), skinIndex u8x4, skinWeight u8x4
(normalized), colorGrey u8x4, colorBlack u8x4 (rgb + a = fur-tip lightness), fur u8x4 (r = fur
length / fur.max, g = region id, b = tail t, a = ao), furDir i8x4 (rest-space hair direction).
"""
import os, sys, json, math, time, argparse
import numpy as np
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.append(os.path.join(ROOT, 'local', 'pylib'))
import importlib
A = None   # the creature's anatomy module (main() sets it)
OUT = None
CM = 0.01


# ------------------------------------------------------------------------------------------------
# skeleton
# ------------------------------------------------------------------------------------------------
def skeleton():
    bones = [(n, p, tuple(v)) for n, p, v in A.SPINE]
    for n, p, v in A.LIMBS:
        bones.append((n, p, v))
    for n, p, v in A.LIMBS:
        bones.append((n.replace('_L', '_R'), p.replace('_L', '_R'), (-v[0], v[1], v[2])))
    d = np.array([0, math.sin(A.TAIL_RISE), -math.cos(A.TAIL_RISE)])
    seg = A.TAIL_LEN / A.TAIL_N
    for i in range(A.TAIL_N):
        bones.append((f'tail{i}', 'pelvis' if i == 0 else f'tail{i - 1}', tuple(np.array(A.TAIL_BASE) + d * seg * i)))
    names = [b[0] for b in bones]
    B = {n: np.array(v, float) for n, p, v in bones}
    return bones, names, B


def rotm(rx, ry, rz):
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


# ------------------------------------------------------------------------------------------------
# signed distance parts (functions of points (n, 3) in cm)
# ------------------------------------------------------------------------------------------------
def f_ell(c, r, rot):
    c = np.array(c, float); r = np.array(r, float); R = rotm(*rot)
    def f(p):
        q = (p - c) @ R            # local coords (R columns = local axes)
        k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
        return np.where(k1 > 1e-9, k0 * (k0 - 1) / np.maximum(k1, 1e-9), -r.min())
    lo = c - r.max(); hi = c + r.max()
    return f, lo, hi


def f_tube(pts, rad, xs=1.0, ys=1.0):
    pts = np.array(pts, float); rad = np.array(rad, float)
    sc = np.array([xs, ys, 1.0])
    ps = pts / sc
    def f(p):
        q = p / sc
        d = np.full(len(p), 1e3)
        for i in range(len(ps) - 1):
            a, b = ps[i], ps[i + 1]; ab = b - a; L2 = max(float(ab @ ab), 1e-12)
            t = np.clip(((q - a) @ ab) / L2, 0, 1)
            dd = np.linalg.norm(q - a - t[:, None] * ab, axis=1) - (rad[i] + (rad[i + 1] - rad[i]) * t)
            d = np.minimum(d, dd)
        return d * min(1.0, xs, ys)
    m = rad.max() * max(xs, ys, 1.0)
    return f, pts.min(axis=0) - m, pts.max(axis=0) + m


def make_fields(B, names):
    F = []
    for kind, bone, args, blend in A.parts(B):
        if kind == 'ell':
            f, lo, hi = f_ell(*args)
        else:
            f, lo, hi = f_tube(*args)
        F.append(dict(f=f, lo=lo, hi=hi, bone=bone, blend=blend))
    # tail: one tube per tail bone (flattened: hairs spread sideways), radius from tail_core_radius
    n = A.TAIL_N
    for i in range(n):
        a = B[f'tail{i}']; b = B[f'tail{i + 1}'] if i + 1 < n else a + (B[f'tail{i}'] - B[f'tail{i - 1}'])
        t0, t1 = i / n, (i + 1) / n
        f, lo, hi = f_tube([a, b], [A.tail_core_radius(t0), A.tail_core_radius(t1)], getattr(A, 'TAIL_XS', 1.45), getattr(A, 'TAIL_YS', 0.8))
        F.append(dict(f=f, lo=lo, hi=hi, bone=f'tail{i}', blend=0.9 if i == 0 else 0.5))
    return F


# ------------------------------------------------------------------------------------------------
# meshing
# ------------------------------------------------------------------------------------------------
def surface_nets(D):
    """vertices (grid index coords) and triangles of the zero surface of a distance volume"""
    s = D < 0
    nz, ny, nx = D.shape
    cube = np.zeros((nz - 1, ny - 1, nx - 1, 3)); cnt = np.zeros((nz - 1, ny - 1, nx - 1))
    corners = [(a, b, c) for a in (0, 1) for b in (0, 1) for c in (0, 1)]
    edges = [(p, q) for p in corners for q in corners if sum(abs(np.array(p) - np.array(q))) == 1 and p < q]
    sl = lambda o: (slice(o[0], nz - 1 + o[0]), slice(o[1], ny - 1 + o[1]), slice(o[2], nx - 1 + o[2]))
    for p, q in edges:
        a, b = D[sl(p)], D[sl(q)]
        x = (a < 0) != (b < 0)
        t = np.where(x, a / np.where(x, a - b, 1), 0)
        for ax in range(3):
            cube[..., ax] += np.where(x, p[ax] + (q[ax] - p[ax]) * t, 0)
        cnt += x
    has = cnt > 0
    idx = -np.ones(cnt.shape, int); idx[has] = np.arange(has.sum())
    verts = cube[has] / cnt[has][:, None] + np.argwhere(has)
    faces = []
    for ax in range(3):
        o = [0, 0, 0]; o[ax] = 1
        a = s[:nz - o[0], :ny - o[1], :nx - o[2]]; b = s[o[0]:, o[1]:, o[2]:]
        edge = a != b
        e = np.argwhere(edge); inside_first = a[edge]
        u, v = [i for i in range(3) if i != ax]
        good = (e[:, u] >= 1) & (e[:, v] >= 1) & (e[:, u] < D.shape[u] - 1) & (e[:, v] < D.shape[v] - 1)
        e, inside_first = e[good], inside_first[good]
        def cell(du, dv):
            c = e.copy(); c[:, u] -= du; c[:, v] -= dv
            c[:, ax] = np.minimum(c[:, ax], cnt.shape[ax] - 1)
            return idx[c[:, 0], c[:, 1], c[:, 2]]
        q = np.stack([cell(1, 1), cell(0, 1), cell(0, 0), cell(1, 0)], 1)
        ok = (q >= 0).all(axis=1); q, fl = q[ok], inside_first[ok]
        flip = fl if ax != 1 else ~fl
        faces += [np.where(flip[:, None], q[:, [0, 1, 2]], q[:, [0, 2, 1]]), np.where(flip[:, None], q[:, [0, 2, 3]], q[:, [0, 3, 2]])]
    return verts, np.concatenate(faces)


def trilin(V, p):
    i = np.clip(np.floor(p).astype(int), 0, np.array(V.shape) - 2); f = p - i; out = 0
    for dz in (0, 1):
        for dy in (0, 1):
            for dx in (0, 1):
                w = (f[:, 0] if dz else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dx else 1 - f[:, 2])
                out = out + w * V[i[:, 0] + dz, i[:, 1] + dy, i[:, 2] + dx]
    return out


def smin(D, d, k):
    h = np.clip(k - np.abs(D - d), 0, None) / k
    return np.minimum(D, d) - h * h * k * 0.25


def build_mesh(F, h, tris):
    lo = np.min([f['lo'] for f in F], axis=0) - 1.0; hi = np.max([f['hi'] for f in F], axis=0) + 1.0
    ax = [np.arange(lo[i], hi[i] + h, h) for i in range(3)]
    shape = tuple(len(a) for a in ax)
    D = np.full(shape, 50.0, np.float32)
    for f in F:
        a = [max(0, int((f['lo'][i] - f['blend'] * 2 - lo[i]) / h)) for i in range(3)]
        b = [min(shape[i], int((f['hi'][i] + f['blend'] * 2 - lo[i]) / h) + 2) for i in range(3)]
        gx, gy, gz = np.meshgrid(ax[0][a[0]:b[0]], ax[1][a[1]:b[1]], ax[2][a[2]:b[2]], indexing='ij')
        p = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], 1)
        d = f['f'](p).reshape(gx.shape).astype(np.float32)
        sub = D[a[0]:b[0], a[1]:b[1], a[2]:b[2]]
        D[a[0]:b[0], a[1]:b[1], a[2]:b[2]] = smin(sub, d, f['blend'])
    D = ndi.gaussian_filter(D, 0.6)
    v, faces = surface_nets(D)
    print(f'  surface nets: {len(v)} verts, {len(faces)} tris (grid {shape})')
    import fast_simplification
    if tris and len(faces) > tris:
        v2, f2 = fast_simplification.simplify(v.astype(np.float32), faces.astype(np.int32), target_reduction=1 - tris / len(faces))
        v, faces = v2.astype(np.float64), f2.astype(np.int64)
    # keep the biggest connected piece
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]]])
    nc, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v))), directed=False)
    if nc > 1:
        keep = lab == np.argmax(np.bincount(lab)); remap = np.cumsum(keep) - 1
        faces = remap[faces[keep[faces[:, 0]]]]; v = v[keep]
    P = lo + v * h
    g = np.gradient(D)
    N = np.stack([trilin(g[i], v) for i in range(3)], 1); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    # winding: outward
    a_, b_, c_ = P[faces[:, 0]], P[faces[:, 1]], P[faces[:, 2]]
    fn = np.cross(b_ - a_, c_ - a_)
    if (fn * N[faces[:, 0]]).sum() < 0:
        faces = faces[:, [0, 2, 1]]
    return P, N, faces


# ------------------------------------------------------------------------------------------------
# rig weights
# ------------------------------------------------------------------------------------------------
def skin(P, F, names):
    dv = np.stack([f['f'](P) for f in F], 1)                    # (n, fields)
    k = np.array([max(0.25, f['blend'] * 0.45) for f in F])
    soft = np.exp(-(dv - dv.min(axis=1, keepdims=True)) / k[None, :])
    bid = np.array([names.index(f['bone']) for f in F])
    W = np.zeros((len(P), len(names)))
    for j in range(len(F)):
        W[:, bid[j]] += soft[:, j]
    W /= W.sum(axis=1, keepdims=True)
    order = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, order, axis=1)
    w4[w4 < 0.02] = 0
    w4 /= w4.sum(axis=1, keepdims=True)
    # quantise to u8 summing to 255
    q = np.floor(w4 * 255).astype(int); q[:, 0] += 255 - q.sum(axis=1)
    return order.astype(np.uint8), q.astype(np.uint8), W


# ------------------------------------------------------------------------------------------------
# paint
# ------------------------------------------------------------------------------------------------
def vnoise(P, scale, seed=0):
    """smooth 3D value noise (0..1) at points (cm)"""
    rng = np.random.default_rng(seed)
    G = rng.random((32, 32, 32))
    q = P / scale + 7.3
    i = np.floor(q).astype(int); f = q - i; f = f * f * (3 - 2 * f); out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * G[(i[:, 0] + dx) % 32, (i[:, 1] + dy) % 32, (i[:, 2] + dz) % 32]
    return out


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def mix(a, b, t):
    return a * (1 - t[:, None]) + np.asarray(b, float) * t[:, None]


def region_weights(W, names, prefixes):
    return sum(W[:, i] for i, n in enumerate(names) if any(n.startswith(p) for p in prefixes))


def paint_procedural(P, N, W, names, B, coat):
    n = len(P)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    head = region_weights(W, names, ['head', 'jaw']); ear = region_weights(W, names, ['ear'])
    tail = region_weights(W, names, ['tail']); paws = region_weights(W, names, ['hand', 'fing', 'foot', 'toes'])
    lower_leg = region_weights(W, names, ['farm', 'shin'])
    up = N[:, 1]
    side = np.abs(N[:, 0])
    n1 = vnoise(P, 1.6, 1); n2 = vnoise(P, 0.55, 2); n3 = vnoise(P, 4.0, 3)
    # belly line: cream underneath (normals down), on the chest/throat front and inside the legs
    belly_t = smooth(0.05, -0.45, up + 0.25 * (n1 - 0.5))
    throat = smooth(0.2, 0.75, N[:, 2]) * smooth(9.5, 6.0, y) * smooth(3.5, 6.5, z) * (1 - head * 0.3)
    chin = region_weights(W, names, ['jaw']) * smooth(0.2, -0.4, up)
    lip = head * smooth(13.2, 14.6, z) * smooth(8.6, 8.0, y)
    cream_t = np.clip(np.maximum.reduce([belly_t * (1 - tail) * (1 - paws * 0.7), throat, chin, lip * 0.9]), 0, 1)
    # flank band: just above the cream line
    flank_t = smooth(-0.35, 0.05, up) * smooth(0.65, 0.15, up) * (1 - tail) * (1 - head * 0.6)
    eye = np.array(A.EYE['pos'], float)
    de = np.minimum(np.linalg.norm(P - eye, axis=1), np.linalg.norm(P - eye * [-1, 1, 1], axis=1))
    ring = smooth(A.EYE['r'] + 0.55, A.EYE['r'] + 0.15, de) * head
    nosepad = head * smooth(0.55, 0.3, np.linalg.norm(P - np.array([0, 8.45, 15.0]), axis=1))
    inner_ear = ear * smooth(0.0, 0.6, N[:, 2] * 0.8 + 0.4)
    cheek = head * smooth(0.2, 0.75, side) * smooth(10.8, 12.5, z) * (1 - lip)
    dorsal = smooth(0.55, 0.95, up) * (1 - head) * (1 - tail)
    claws = region_weights(W, names, ['fing', 'toes']) * smooth(0.6, 0.95, np.where(z > 0, (z - 8.5) / 1.1, (z + 4.9) / 2.3))
    if coat == 'grey':
        grey = np.array([0.50, 0.50, 0.50]); grey_d = np.array([0.36, 0.35, 0.34]); brown = np.array([0.55, 0.45, 0.36])
        c = mix(np.tile(grey, (n, 1)), grey_d, 0.6 * n2)                     # grizzle
        c = mix(c, brown, 0.35 * dorsal * (0.6 + 0.4 * n1))                  # brownish dorsal wash
        c = mix(c, [0.68, 0.48, 0.33], 0.75 * flank_t)                       # rusty flank band
        c = mix(c, [0.62, 0.45, 0.32], 0.55 * cheek)                         # rusty cheeks
        c = mix(c, [0.60, 0.46, 0.36], 0.75 * paws + 0.4 * lower_leg)        # rusty feet
        c = mix(c, [0.92, 0.88, 0.79], cream_t)                              # cream belly / throat / chin
        c = mix(c, [0.90, 0.86, 0.78], ring)                                 # eye ring
        c = mix(c, [0.62, 0.42, 0.38], 0.7 * inner_ear)                      # pinkish-brown inner ear
        c = mix(c, [0.47, 0.43, 0.41], tail * 0.6)                           # tail core: grey
        c = mix(c, [0.62, 0.48, 0.38], tail * smooth(-0.1, -0.6, up) * 0.6)  # warm under the tail
        c = mix(c, [0.30, 0.22, 0.22], nosepad)
        c = mix(c, [0.22, 0.20, 0.20], claws * 0.85)
        tip = np.clip(0.35 + 0.55 * tail + 0.2 * n3, 0, 1)                   # fur-tip lightness: silvery tail fringe
    else:
        base = np.array([0.10, 0.085, 0.078]); warm = np.array([0.24, 0.16, 0.11])
        c = mix(np.tile(base, (n, 1)), [0.15, 0.125, 0.11], 0.5 * n2)
        c = mix(c, warm, 0.7 * flank_t + 0.45 * tail * n3 + 0.35 * cream_t + 0.3 * cheek)
        c = mix(c, [0.36, 0.30, 0.26], ring * 0.85)
        c = mix(c, [0.24, 0.15, 0.14], 0.6 * inner_ear)
        c = mix(c, [0.10, 0.07, 0.07], nosepad)
        c = mix(c, [0.05, 0.05, 0.05], claws * 0.85)
        tip = np.clip(0.06 + 0.14 * tail + 0.06 * n3, 0, 1)
    ao = np.clip(0.55 + 0.45 * smooth(0.5, 3.5, y) * (0.7 + 0.3 * up.clip(0, 1)), 0, 1)
    return np.clip(c, 0, 1), tip, ao


def paint_sheet(P, N, W, names, coat, file, proc):
    """project a turnaround sheet's side and top views (scaled by sheet.py) onto the vertices"""
    from sheet import Sheet
    sh = Sheet(file, **getattr(A, 'SHEET', {}))
    from scipy.ndimage import map_coordinates
    c_proc, tip, ao = proc
    out = c_proc.copy()
    for view in ('side', 'top'):
        rgb = sh.sp if view == 'side' else sh.tp; m = sh.sm if view == 'side' else sh.tm
        if view == 'side':
            u, v = sh.side_px(P[:, 2] * CM, P[:, 1] * CM); wv = np.abs(N[:, 0]) ** 2
        else:
            u, v = sh.top_px(P[:, 2] * CM, P[:, 0] * CM); wv = np.clip(N[:, 1], 0, 1) ** 2
        inside = map_coordinates(m.astype(float), [v, u], order=1) > 0.5
        col = np.stack([map_coordinates(rgb[..., k], [v, u], order=1) for k in range(3)], 1)
        wv = wv * inside
        out = out * (1 - wv[:, None]) + col * wv[:, None]
    return out, tip, ao


# ------------------------------------------------------------------------------------------------
# hair direction
# ------------------------------------------------------------------------------------------------
def fur_dirs(P, N, W, names, bones, B):
    """rest-space hair direction per vertex: down the limbs, back along the body and head, out
    along the tail (and outward from its axis), tangent to the skin"""
    child = {}
    for n, p, v in bones:
        if p and p not in child: child[p] = n
    D = np.zeros((len(names), 3))
    for i, n in enumerate(names):
        a = B[n]
        b = B[child[n]] if n in child else (np.array(A.ENDS.get(n.replace('_R', '_L'), a + [0, 0, -1])) * ([-1, 1, 1] if n.endswith('_R') else 1))
        d = b - a
        if n in getattr(A, 'BODY_BONES', ('root', 'pelvis', 'spine1', 'spine2', 'neck', 'head', 'jaw')):
            d = -d if d[2] > 0 else d          # body hair runs back toward the rump
            if n == 'head': d = np.array([0, 0.25, -1.0])
        if n.startswith('ear'): d = np.array([0, 1.0, 0])
        D[i] = d / (np.linalg.norm(d) + 1e-9)
    d = W @ D
    d -= (d * N).sum(axis=1, keepdims=True) * N
    return d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)


# ------------------------------------------------------------------------------------------------
class Ctx:
    """what a creature's paint() / fur_adjust() get: the mesh, its weights and the helpers"""
    def __init__(self, P, N, W, names, B):
        self.P, self.N, self.W, self.names, self.B = P, N, W, names, B
        self.x, self.y, self.z = P[:, 0], P[:, 1], P[:, 2]
        self.n = len(P)
        self.smooth, self.mix, self.vnoise = smooth, mix, vnoise
    def bones(self, *prefixes): return region_weights(self.W, self.names, list(prefixes))


def main():
    global A, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument('--creature', default='squirrel')
    ap.add_argument('--paint', default='procedural', choices=['procedural', 'sheet'])
    ap.add_argument('--sheet', default=None, help='sheet for the first coat (relative to reference/sheets)')
    ap.add_argument('--sheet-black', default=None)
    ap.add_argument('--tris', type=int, default=None)
    ap.add_argument('--h', type=float, default=None, help='grid cell, cm')
    a = ap.parse_args()
    name = a.creature
    A = importlib.import_module('anatomy' if name == 'squirrel' else f'anatomy_{name}')
    OUT = os.path.join(HERE, '..', '..', 'game', 'assets', name)
    tris = a.tris or getattr(A, 'TRIS', 13000)
    h = a.h or getattr(A, 'GRID', 0.13)
    t0 = time.time()
    bones, names, B = skeleton()
    F = make_fields(B, names)
    P, N, faces = build_mesh(F, h, tris)
    bi, bw, W = skin(P, F, names)
    ctx = Ctx(P, N, W, names, B)
    coats = getattr(A, 'COATS', ['grey', 'black'])
    proc = (lambda coat: A.paint(ctx, coat)) if hasattr(A, 'paint') else (lambda coat: paint_procedural(P, N, W, names, B, coat))
    sheets = dict(getattr(A, 'SHEETS', {'grey': 'squirrel_grey_turnaround.png', 'black': 'squirrel_black_turnaround.png'}))
    if a.sheet: sheets[coats[0]] = a.sheet
    if a.sheet_black: sheets['black'] = a.sheet_black
    painted = {}
    for coat in coats:
        f = sheets.get(coat)
        if a.paint == 'sheet' and f and os.path.exists(os.path.join(HERE, '..', '..', 'reference', 'sheets', f)):
            painted[coat] = paint_sheet(P, N, W, names, coat, f, proc(coat))
        else:
            painted[coat] = proc(coat)
    ao = painted[coats[0]][2]
    fdir = fur_dirs(P, N, W, names, bones, B)
    # fur length per vertex (cm), from the bones' fur
    fl_b = np.array([A.FUR.get(n.split('_')[0].rstrip('0123456789'), 0.3) for n in names])
    fur = W @ fl_b
    tail_t = np.zeros(len(P))
    for i, n in enumerate(names):
        if n.startswith('tail'):
            tail_t += W[:, i] * (int(n[4:]) + 0.5) / A.TAIL_N
    tailw = region_weights(W, names, ['tail'])
    tail_t = np.where(tailw > 1e-3, tail_t / np.maximum(tailw, 1e-3), 0)
    ctx.tail_t, ctx.tailw = tail_t, tailw
    if hasattr(A, 'fur_adjust'): fur = A.fur_adjust(ctx, fur)
    fmax = float(max(fur.max(), 1e-3))
    region = np.zeros(len(P), np.uint8)
    for key, val in (('head', 1), ('jaw', 1), ('bill', 1), ('ear', 2), ('tail', 3), ('hand', 4), ('fing', 4), ('foot', 4), ('toes', 4)):
        region[region_weights(W, names, [key]) > 0.5] = val

    # ---- write ---------------------------------------------------------------------------------
    os.makedirs(OUT, exist_ok=True)
    n = len(P)
    pos = (P * CM).astype(np.float32)
    def u8(v): return np.clip(np.round(v * 255), 0, 255).astype(np.uint8)
    def i8(v): return np.clip(np.round(v * 127), -127, 127).astype(np.int8)
    pad4 = lambda a3, w=0: np.concatenate([a3, np.full((len(a3), 1), w, a3.dtype)], 1)
    attrs = [
        ('position', pos, 3, 'f32', False),
        ('normal', pad4(i8(N)), 4, 'i8', True),
        ('skinIndex', bi, 4, 'u8', False),
        ('skinWeight', bw, 4, 'u8', True),
    ]
    for coat in coats:
        col, tip, _ = painted[coat]
        attrs.append(('color' + coat[0].upper() + coat[1:], np.concatenate([u8(col), u8(tip)[:, None]], 1), 4, 'u8', True))
    attrs += [
        ('fur', np.stack([u8(fur / fmax), region, u8(tail_t), u8(ao)], 1).astype(np.uint8), 4, 'u8', True),
        ('furDir', pad4(i8(fdir)), 4, 'i8', True),
    ]
    blob = bytearray(); meta_attrs = {}
    for aname, arr, size, typ, norm in attrs:
        while len(blob) % 4: blob.append(0)
        meta_attrs[aname] = dict(offset=len(blob), itemSize=size, type=typ, normalized=norm)
        blob += np.ascontiguousarray(arr).tobytes()
    while len(blob) % 4: blob.append(0)
    idx32 = n > 65535
    ioff = len(blob); blob += faces.astype(np.uint32 if idx32 else np.uint16).tobytes()
    bone_out = [dict(name=nm, parent=(names.index(p) if p else -1), pos=(np.array(v) * CM).round(5).tolist()) for nm, p, v in bones]
    ends = {k: (np.array(v) * CM).round(5).tolist() for k, v in A.ENDS.items()}
    eye = dict(bone=A.EYE.get('bone', 'head'), pos=(np.array(A.EYE['pos']) * CM).round(5).tolist(), r=A.EYE['r'] * CM)
    for k in ('color', 'ring', 'out'):
        if k in A.EYE: eye[k] = A.EYE[k]
    meta = dict(version=1, creature=name, built=time.strftime('%Y-%m-%d'), paint=a.paint, vertexCount=n, indexCount=int(faces.size),
                attributes=meta_attrs, index=dict(offset=ioff, type='u32' if idx32 else 'u16'),
                bones=bone_out, ends=ends, coats=coats, eyes=eye,
                fur=dict(max=fmax * CM), tail=dict(n=A.TAIL_N, length=A.TAIL_LEN * CM),
                bounds=dict(min=pos.min(axis=0).round(4).tolist(), max=pos.max(axis=0).round(4).tolist()))
    if getattr(A, 'WHISKERS', None):
        meta['whiskers'] = dict(bone='head', pos=(np.array(A.WHISKERS['pos']) * CM).round(5).tolist())
    meta.update(getattr(A, 'META', {}))
    with open(os.path.join(OUT, name + '.bin'), 'wb') as f: f.write(bytes(blob))
    with open(os.path.join(OUT, name + '.json'), 'w') as f: json.dump(meta, f, indent=1)
    print(f'{name}: {n} verts, {len(faces)} tris, {len(names)} bones, {len(blob) / 1024:.0f} KB, {time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
