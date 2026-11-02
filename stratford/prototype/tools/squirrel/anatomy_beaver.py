"""North American beaver (Castor canadensis), part by part (centimetres; frame as anatomy.py: +z
forward, y up, +x the animal's left, origin on the ground under the middle of the body).

Measured on the round-11 turnaround (reference/sheets/beaver_turnaround.png: a true side profile,
the top view head right, a front three-quarter view), scaled to an 80 cm head and body (nose
z 40 .. the base of the tail z -40): a heavy, hunched beaver, the back domed to 59 cm over z -10,
the rump falling straight to the ground at z -40, the big head held high (crown 53 cm at z 24,
nose tip z 40 / y 42, eye z 29 / y 45.5, small round ears at z 22 / y 49), the orange incisors
under the nose, short fore legs under the chest, big webbed hind feet, about 60 cm across the
haunches and 46 across the shoulders; the scaly paddle tail lies flat on the ground behind,
22 cm long, 22 cm wide and 2-3 cm thick. The walking pose (beaver_poses.png, R9.2) checks the gait.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 30, -24)),
    ('spine1', 'pelvis', (0, 38, -8)),
    ('spine2', 'spine1', (0, 36, 10)),
    ('neck',   'spine2', (0, 36, 20)),
    ('head',   'neck',   (0, 40, 28)),
    ('jaw',    'head',   (0, 31, 33)),
]
TAIL_N = 4
TAIL_BASE = (0, 5.5, -39)
TAIL_LEN = 22.0
TAIL_RISE = 0.0
TAIL_XS, TAIL_YS = 6.3, 0.32           # a broad flat paddle

LIMBS = [
    ('ear_L',   'head',    (8.5, 48.5, 23.0)),
    ('scap_L',  'spine2',  (10.5, 32, 14)),
    ('uarm_L',  'scap_L',  (12, 22, 17)),
    ('farm_L',  'uarm_L',  (12.5, 12, 18)),
    ('hand_L',  'farm_L',  (12.5, 2.6, 20)),
    ('fing_L',  'hand_L',  (12.5, 1.2, 23)),
    ('thigh_L', 'pelvis',  (14, 28, -22)),
    ('shin_L',  'thigh_L', (15.5, 14, -12)),
    ('foot_L',  'shin_L',  (16.5, 3, -24)),
    ('toes_L',  'foot_L',  (17, 1.5, -12)),
]
ENDS = {
    'fing_L': (12.5, 0.6, 26),
    'toes_L': (18.5, 0.8, -4),
    'head': (0, 42, 40.5),
}
EYE = dict(bone='head', pos=(9.6, 45.5, 29.0), r=1.05, out=[1, 0.35, 0.25])
WHISKERS = dict(pos=(3.5, 39.0, 38.5))
FUR = {'root': 0.6, 'pelvis': 0.7, 'spine1': 0.7, 'spine2': 0.6, 'neck': 0.7, 'head': 0.4, 'jaw': 0.35,
       'ear': 0.2, 'scap': 0.7, 'uarm': 0.6, 'farm': 0.35, 'hand': 0.05, 'fing': 0.02,
       'thigh': 0.8, 'shin': 0.35, 'foot': 0.02, 'toes': 0.02, 'tail': 0.0}
COATS = ['natural']
SHEETS = {'natural': 'beaver_turnaround.png'}
SHEET = dict(body=0.8, rump_u=0.22)        # R9.1 replacement (round 11): a true profile, the top view head right
TRIS = 14000
GRID = 0.4
META = {'whiskers': dict(pos=[0.035, 0.39, 0.385], length=0.09, color=0x1d1714)}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.12, 0.4, 0.8, 1.0], [1.2, 2.2, 2.7, 2.5, 1.3]))


def tail_parts(B):
    """the paddle: thin flat ellipsoids, one per tail bone, overlapping into one smooth oval (the
    round-11 sheet: 22 cm long, 22 cm across at its widest, 2-3 cm thick, lying flat), blended
    only a little so it stays thin from the side"""
    P = []
    seg = TAIL_LEN / TAIL_N
    d = np.array([0, np.sin(TAIL_RISE), -np.cos(TAIL_RISE)])
    widths = [7.0, 10.5, 11.5, 9.0]
    for i in range(TAIL_N):
        c = np.array(TAIL_BASE) + d * seg * (i + 0.55)
        P.append(('ell', f'tail{i}', (tuple(c), (widths[i], 1.2, seg * (1.0 if i in (0, TAIL_N - 1) else 1.45)), (-TAIL_RISE, 0, 0)), 1.6 if i == 0 else 0.7))
    return P


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # a heavy hunched body, domed over the middle, the rump falling straight to the ground
    add('ell', 'pelvis', ((0, 27, -24), (28, 24, 17), (0, 0, 0)), 5.0)
    add('ell', 'spine1', ((0, 33, -8), (30, 26, 22), (0, 0, 0)), 5.0)
    add('ell', 'spine2', ((0, 32, 10), (23, 20, 13), (-0.15, 0, 0)), 4.5)
    add('ell', 'pelvis', ((0, 7, -38), (8, 3.5, 4), (0, 0, 0)), 1.5)                   # rump into the tail
    add('tube', 'neck', ([(0, 33, 17), (0, 36, 23), (0, 39, 27)], [16, 13.5, 11], 1.1, 1.0), 4.0)
    # head: broad cranium held high, deep cheeks, blunt muzzle, the big orange incisors
    add('ell', 'head', ((0, 42, 30), (11.5, 9, 9.5), (-0.25, 0, 0)), 2.5)
    add('ell', 'head', ((0, 36.5, 32), (11.5, 7, 7), (0, 0, 0)), 2.5)                # cheeks
    add('tube', 'head', ([(0, 41.5, 34), (0, 41.5, 37.5), (0, 42, 39.6)], [6.2, 4.6, 3.0], 1.1, 0.95), 1.5)
    add('ell', 'head', ((0, 42.2, 40.2), (2.3, 1.6, 1.2), (0, 0, 0)), 0.6)            # nose pad
    add('ell', 'jaw', ((0, 32, 34), (5.5, 3.4, 5.0), (0, 0, 0)), 1.8)                # chin
    add('ell', 'jaw', ((0, 30, 36.2), (1.8, 2.2, 0.8), (0.2, 0, 0)), 0.3)            # incisors
    for s in (1, -1):
        X = 'LR'[s < 0]
        add('ell', 'ear_' + X, ((s * 8.6, 49, 23), (1.3, 2.6, 2.4), (0, 0, -s * 0.3)), 0.8)
        b = lambda n: B[n + '_' + X]
        # fore legs: short, the hands small and dexterous
        add('ell', 'scap_' + X, ((s * 11, 28, 14), (7.5, 9, 8), (0.3, 0, 0)), 4.0)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [5.0, 3.8], 0.9, 1.0), 2.0)
        add('tube', 'farm_' + X, ([b('farm'), b('hand')], [3.4, 2.3], 0.9, 1.0), 1.4)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [2.0, 1.9], 1.4, 0.6), 0.7)
        add('tube', 'fing_' + X, ([b('fing'), np.array(ENDS['fing_L']) * [s, 1, 1]], [1.8, 1.0], 1.5, 0.5), 0.5)
        # hind legs: big haunch, the large webbed foot
        add('ell', 'thigh_' + X, ((s * 14, 24, -18), (11, 15, 14), (-0.3, 0, 0)), 4.0)
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
    nose = ctx.smooth(2.0, 1.0, np.linalg.norm(ctx.P - np.array([0, 42.2, 40.2]), axis=1))
    c = mix(c, [0.10, 0.08, 0.07], nose)
    teeth = ctx.smooth(2.2, 1.2, np.linalg.norm(ctx.P - np.array([0, 30, 36.2]), axis=1))
    c = mix(c, [0.86, 0.45, 0.14], teeth)
    c *= (0.9 + 0.2 * n2)[:, None]
    tip = np.clip(0.18 + 0.15 * n1, 0, 1) * (1 - tail)
    ao = np.clip(0.55 + 0.45 * sm(2, 24, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
