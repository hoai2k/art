"""North American beaver (Castor canadensis), part by part (centimetres; frame as anatomy.py: +z
forward, y up, +x the animal's left, origin on the ground under the middle of the body).

Measured on the delivered sheets, scaled to an 80 cm head and body (nose z 40 .. rump z -40):
the side from the walking pose of reference/sheets/beaver_poses.png (R9.2, cell 1, a true
profile; the turnaround's "side" view is turned three-quarters), the width from the top view of
beaver_turnaround.png (R9.1). The sheets draw a heavy, round beaver: back 46 cm high over the
hips (z -12), belly 10 cm off the ground, a broad body about 56 cm across with its fur, a big
blunt head (crown 35 cm, nose tip z 40 / y 26.5, eye z 32.5 / y 30, small round ears at z 22),
the orange incisors under the nose, short fore legs, big webbed hind feet, and the scaly
paddle tail 26 cm long and about 26 cm wide, held flat behind. Rerun build.py when the
replacement turnaround (round 11) lands at the same path.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 28, -26)),
    ('spine1', 'pelvis', (0, 32, -8)),
    ('spine2', 'spine1', (0, 30, 10)),
    ('neck',   'spine2', (0, 27, 20)),
    ('head',   'neck',   (0, 28, 27)),
    ('jaw',    'head',   (0, 21.5, 32)),
]
TAIL_N = 4
TAIL_BASE = (0, 11, -41)
TAIL_LEN = 26.0
TAIL_RISE = -0.18
TAIL_XS, TAIL_YS = 6.3, 0.32           # a broad flat paddle

LIMBS = [
    ('ear_L',   'head',    (7.5, 34.0, 23.0)),
    ('scap_L',  'spine2',  (9, 27, 14)),
    ('uarm_L',  'scap_L',  (12, 18, 17)),
    ('farm_L',  'uarm_L',  (12.5, 10, 14)),
    ('hand_L',  'farm_L',  (12.5, 2.6, 17.5)),
    ('fing_L',  'hand_L',  (12.5, 1.2, 20.5)),
    ('thigh_L', 'pelvis',  (14, 24, -22)),
    ('shin_L',  'thigh_L', (15.5, 12, -12)),
    ('foot_L',  'shin_L',  (15.5, 3, -29)),
    ('toes_L',  'foot_L',  (16, 1.5, -17)),
]
ENDS = {
    'fing_L': (12.5, 0.6, 23.5),
    'toes_L': (17.5, 0.8, -8),
    'head': (0, 26.5, 40.5),
}
EYE = dict(bone='head', pos=(8.6, 30.2, 32.5), r=1.05, out=[1, 0.35, 0.25])
WHISKERS = dict(pos=(3.5, 25.2, 38.0))
FUR = {'root': 0.6, 'pelvis': 0.7, 'spine1': 0.7, 'spine2': 0.6, 'neck': 0.7, 'head': 0.4, 'jaw': 0.35,
       'ear': 0.2, 'scap': 0.7, 'uarm': 0.6, 'farm': 0.35, 'hand': 0.05, 'fing': 0.02,
       'thigh': 0.8, 'shin': 0.35, 'foot': 0.02, 'toes': 0.02, 'tail': 0.0}
COATS = ['natural']
SHEETS = {'natural': 'beaver_turnaround.png'}
# R9.1's side view is turned: the side comes from R9.2's walking pose, the top from R9.1
SHEET = dict(body=0.8, rump_u=0.25, side=dict(file='beaver_poses.png', row=0, rows=2, col=0), top=dict(file='beaver_turnaround.png', row=0, rows=1, col=1))
TRIS = 14000
GRID = 0.4
META = {'whiskers': dict(pos=[0.035, 0.252, 0.38], length=0.09, color=0x1d1714)}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.12, 0.4, 0.8, 1.0], [1.2, 2.2, 2.7, 2.5, 1.3]))


def tail_parts(B):
    """the paddle: flat ellipsoids, one per tail bone, overlapping into one smooth oval (from the
    top view: 7 cm across where it leaves the rump, 26 cm at its widest, a rounded end)"""
    P = []
    seg = TAIL_LEN / TAIL_N
    d = np.array([0, np.sin(TAIL_RISE), -np.cos(TAIL_RISE)])
    widths = [8.0, 14.5, 16.5, 13.5]
    for i in range(TAIL_N):
        c = np.array(TAIL_BASE) + d * seg * (i + 0.55)
        P.append(('ell', f'tail{i}', (tuple(c), (widths[i], 1.1, seg * (1.0 if i in (0, TAIL_N - 1) else 1.45)), (-TAIL_RISE, 0, 0)), 2.5 if i else 3.0))
    return P


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # a heavy rounded body, highest over the hips
    add('ell', 'pelvis', ((0, 22, -24), (26, 17, 17), (0.1, 0, 0)), 5.0)
    add('ell', 'spine1', ((0, 28, -5), (30, 18.5, 22), (0, 0, 0)), 5.0)
    add('ell', 'spine2', ((0, 26, 9), (25, 14.5, 14), (-0.15, 0, 0)), 4.5)
    add('ell', 'pelvis', ((0, 15, -38), (12, 8, 6), (0, 0, 0)), 3.5)                 # rump into the tail
    add('tube', 'neck', ([(0, 24, 17), (0, 26, 23), (0, 27, 27)], [13, 11.5, 10], 1.1, 1.0), 4.0)
    # head: broad cranium, deep cheeks, blunt muzzle, the big orange incisors
    add('ell', 'head', ((0, 27.5, 29), (11, 7.5, 8.5), (-0.1, 0, 0)), 2.5)
    add('ell', 'head', ((0, 24.5, 32.5), (11, 6, 6.5), (0, 0, 0)), 2.5)             # cheeks
    add('tube', 'head', ([(0, 27.5, 33), (0, 27, 37), (0, 26.4, 39.6)], [6.2, 4.6, 3.0], 1.1, 0.95), 1.5)
    add('ell', 'head', ((0, 26.6, 40.2), (2.3, 1.6, 1.2), (0, 0, 0)), 0.6)            # nose pad
    add('ell', 'jaw', ((0, 21.5, 33.5), (5.5, 3.4, 5.0), (0, 0, 0)), 1.8)            # chin
    add('ell', 'jaw', ((0, 21.6, 37.4), (1.8, 2.2, 0.8), (0.2, 0, 0)), 0.3)          # incisors
    for s in (1, -1):
        X = 'LR'[s < 0]
        add('ell', 'ear_' + X, ((s * 7.6, 34.5, 23), (1.2, 2.4, 2.2), (0, 0, -s * 0.3)), 0.8)
        b = lambda n: B[n + '_' + X]
        # fore legs: short, the hands small and dexterous
        add('ell', 'scap_' + X, ((s * 10.5, 22, 13), (7.5, 8, 8), (0.3, 0, 0)), 4.0)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [5.0, 3.8], 0.9, 1.0), 2.0)
        add('tube', 'farm_' + X, ([b('farm'), b('hand')], [3.4, 2.3], 0.9, 1.0), 1.4)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [2.0, 1.9], 1.4, 0.6), 0.7)
        add('tube', 'fing_' + X, ([b('fing'), np.array(ENDS['fing_L']) * [s, 1, 1]], [1.8, 1.0], 1.5, 0.5), 0.5)
        # hind legs: big haunch, the large webbed foot
        add('ell', 'thigh_' + X, ((s * 12, 20, -19), (10, 12, 13), (-0.3, 0, 0)), 4.0)
        add('tube', 'shin_' + X, ([b('shin'), b('foot')], [5.0, 2.8], 0.9, 1.0), 1.8)
        add('tube', 'foot_' + X, ([b('foot'), b('toes')], [2.6, 3.0], 1.6, 0.45), 1.0)
        add('tube', 'toes_' + X, ([b('toes'), np.array(ENDS['toes_L']) * [s, 1, 1]], [3.2, 3.0], 2.4, 0.3), 0.7)   # the web
    return [p for p in P if p]


def paint(ctx, coat):
    sm, mix = ctx.smooth, ctx.mix
    n, N = ctx.n, ctx.N
    up = N[:, 1]
    n1 = ctx.vnoise(ctx.P, 3.0, 1); n2 = ctx.vnoise(ctx.P, 1.0, 2)
    tail = ctx.bones('tail'); feet = ctx.bones('foot', 'toes', 'hand', 'fing'); head = ctx.bones('head', 'jaw')
    c = mix(np.tile(np.array([0.38, 0.23, 0.13]), (n, 1)), [0.26, 0.15, 0.08], sm(0.2, 0.9, up) * (0.6 + 0.4 * n1))   # darker back
    c = mix(c, [0.47, 0.33, 0.22], sm(0.0, -0.6, up) * (1 - tail))                                                 # paler belly
    c = mix(c, [0.32, 0.20, 0.12], head * 0.5)
    c = mix(c, [0.2, 0.15, 0.12], ctx.bones('ear') * 0.6)
    c = mix(c, [0.13, 0.11, 0.10], feet * 0.9)
    # the tail: dark grey-black leather with a scale pattern
    cell = ctx.vnoise(ctx.P * np.array([1, 1, 1]), 0.9, 7)
    scale = (np.abs(np.sin(ctx.x * 4.2 + ctx.z * 2.1)) * np.abs(np.sin(ctx.z * 4.2 - ctx.x * 2.1)))
    c = mix(c, np.stack([0.17 + 0.05 * scale, 0.16 + 0.05 * scale, 0.16 + 0.05 * scale], 1) * (0.85 + 0.3 * cell[:, None]), tail)
    nose = ctx.smooth(2.0, 1.0, np.linalg.norm(ctx.P - np.array([0, 26.6, 40.2]), axis=1))
    c = mix(c, [0.10, 0.08, 0.07], nose)
    teeth = ctx.smooth(2.2, 1.2, np.linalg.norm(ctx.P - np.array([0, 21.6, 37.4]), axis=1))
    c = mix(c, [0.86, 0.45, 0.14], teeth)
    c *= (0.9 + 0.2 * n2)[:, None]
    tip = np.clip(0.18 + 0.15 * n1, 0, 1) * (1 - tail)
    ao = np.clip(0.55 + 0.45 * sm(2, 18, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
