"""Eastern cottontail (Sylvilagus floridanus), part by part (centimetres; frame as anatomy.py).

Measured on the delivered turnaround (reference/sheets/rabbit_turnaround.png, R9.3: side view
facing right, top view head right), scaled to a 40 cm head and body (nose z 20 .. rump z -20),
with review/sheet-overlay.py and the silhouette profile: the alert sit, back 25 cm high at
z -7, the head up (crown 30 cm, nose tip z 20 / y 23), large eyes (z 13, y 27), long upright ears
from z 8 / y 30 to tips at y 41, big rounded haunches 24 cm wide over the folded hind legs, the
hind feet flat on the ground from the heel (z -13) to the toes (z 3), slim fore legs under the
chest (paws at z 9-11), a 7 cm white puff of a tail at z -21.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 13, -11)),
    ('spine1', 'pelvis', (0, 17, -3)),
    ('spine2', 'spine1', (0, 17, 6)),
    ('neck',   'spine2', (0, 20, 10)),
    ('head',   'neck',   (0, 25.5, 12.5)),
    ('jaw',    'head',   (0, 21, 15.5)),
]
TAIL_N = 2
TAIL_BASE = (0, 9.5, -19.5)
TAIL_LEN = 3.5
TAIL_RISE = 0.6
TAIL_XS, TAIL_YS = 1.1, 1.0

LIMBS = [
    ('ear_L',   'head',    (2.0, 28.6, 10.8)),
    ('scap_L',  'spine2',  (3.0, 16.5, 7)),
    ('uarm_L',  'scap_L',  (3.3, 12.0, 9.8)),
    ('farm_L',  'uarm_L',  (3.3, 7.5, 8.6)),
    ('hand_L',  'farm_L',  (3.3, 1.3, 9.2)),
    ('fing_L',  'hand_L',  (3.3, 0.6, 10.3)),
    ('thigh_L', 'pelvis',  (4.8, 12.5, -10)),
    ('shin_L',  'thigh_L', (5.6, 7.5, -3.5)),
    ('foot_L',  'shin_L',  (5.4, 1.8, -12.5)),
    ('toes_L',  'foot_L',  (5.2, 0.8, -1.0)),
]
ENDS = {
    'fing_L': (3.3, 0.4, 11.5),
    'toes_L': (5.2, 0.5, 2.8),
    'ear_L': (3.4, 40.8, 6.2),
    'head': (0, 23.2, 20.2),
}
EYE = dict(bone='head', pos=(3.55, 27.1, 13.3), r=1.1, out=[1, 0.2, 0.15], ring=0xd9c9a8)
WHISKERS = dict(pos=(1.0, 23.0, 19.6))
FUR = {'root': 0.7, 'pelvis': 0.8, 'spine1': 0.8, 'spine2': 0.7, 'neck': 0.6, 'head': 0.35, 'jaw': 0.35,
       'ear': 0.12, 'scap': 0.6, 'uarm': 0.5, 'farm': 0.35, 'hand': 0.25, 'fing': 0.2,
       'thigh': 0.7, 'shin': 0.5, 'foot': 0.35, 'toes': 0.3, 'tail': 1.3}
COATS = ['natural']
SHEETS = {'natural': 'rabbit_turnaround.png'}
SHEET = dict(body=0.4, rump_u=0.08)
TRIS = 12000
GRID = 0.16
META = {'whiskers': dict(pos=[0.010, 0.230, 0.196], length=0.06, color=0x2a221c)}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.5, 1.0], [2.0, 2.6, 1.6]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # the alert sit: big round haunches, a deep rounded back, the chest up
    add('ell', 'pelvis', ((0, 12.5, -11), (8.6, 11.6, 10.2), (0.1, 0, 0)), 2.2)
    add('ell', 'spine1', ((0, 15, -2.5), (8.2, 9.8, 9), (0, 0, 0)), 2.2)
    add('ell', 'spine2', ((0, 15.5, 6), (6.6, 8.2, 6.8), (-0.3, 0, 0)), 2.0)
    add('tube', 'neck', ([(0, 18, 8.5), (0, 22.5, 11.5)], [5.0, 4.2], 1.0, 1.0), 1.8)
    # head: rounded cranium, the muzzle and split lip, big eyes (separate), cheeks
    add('ell', 'head', ((0, 25.8, 13.8), (4.3, 4.5, 4.9), (-0.35, 0, 0)), 1.0)
    add('ell', 'head', ((0, 23.6, 16.8), (3.6, 3.3, 3.3), (0, 0, 0)), 1.0)
    add('tube', 'head', ([(0, 24.6, 17.4), (0, 24.0, 19.0), (0, 23.3, 19.9)], [2.6, 1.9, 1.2], 1.05, 1.0), 0.8)
    add('ell', 'jaw', ((0, 20.8, 16.2), (2.3, 1.6, 2.6), (0, 0, 0)), 0.6)
    for s in (1, -1):
        X = 'LR'[s < 0]
        b = lambda n: B[n + '_' + X]
        # long ears: thin leaves, cupped forward, tips rounded
        ear0, ear1 = np.array(b('ear')), np.array(ENDS['ear_L']) * [s, 1, 1]
        add('tube', 'ear_' + X, ([ear0, (ear0 * 0.45 + ear1 * 0.55), ear1], [1.2, 2.3, 1.1], 0.33, 1.0), 0.4)
        # fore legs: slim, straight down under the chest
        add('ell', 'scap_' + X, ((s * 3.4, 14, 7.5), (2.2, 4.2, 3.2), (0.3, 0, 0)), 1.4)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [1.7, 1.25], 0.9, 1.0), 0.8)
        add('tube', 'farm_' + X, ([b('farm'), b('hand')], [1.15, 0.85], 1.0, 1.0), 0.5)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [0.85, 0.8], 1.2, 0.7), 0.3)
        add('tube', 'fing_' + X, ([b('fing'), np.array(ENDS['fing_L']) * [s, 1, 1]], [0.8, 0.55], 1.3, 0.6), 0.3)
        # hind legs: the big thigh folded under the haunch, the long foot flat on the ground
        add('ell', 'thigh_' + X, ((s * 5.0, 9.5, -8), (3.6, 6.8, 7.4), (-0.4, 0, 0)), 1.6)
        add('tube', 'shin_' + X, ([b('shin'), b('foot')], [1.9, 1.1], 0.9, 1.0), 0.7)
        add('tube', 'foot_' + X, ([b('foot'), b('toes')], [1.15, 1.25], 1.35, 0.6), 0.5)
        add('tube', 'toes_' + X, ([b('toes'), np.array(ENDS['toes_L']) * [s, 1, 1]], [1.25, 0.8], 1.3, 0.55), 0.3)
    return P


def fur_adjust(ctx, fur):
    # the puff tail: long soft fur; the nose bare
    fur = fur * (1 - ctx.tailw) + ctx.tailw * 1.4
    fur[np.linalg.norm(ctx.P - np.array([0, 23.4, 20.0]), axis=1) < 0.7] = 0.02
    return fur


def paint(ctx, coat):
    sm, mix = ctx.smooth, ctx.mix
    n, N = ctx.n, ctx.N
    up = N[:, 1]
    n1 = ctx.vnoise(ctx.P, 1.2, 1); n2 = ctx.vnoise(ctx.P, 0.4, 2)
    tail = ctx.bones('tail'); ear = ctx.bones('ear'); head = ctx.bones('head', 'jaw')
    # grizzled brown-grey (agouti: buff and black banding)
    c = mix(np.tile(np.array([0.50, 0.41, 0.31]), (n, 1)), [0.30, 0.25, 0.20], 0.55 * n2)
    c = mix(c, [0.58, 0.47, 0.34], sm(-0.2, 0.3, up) * sm(0.6, 0.2, up) * 0.6)                    # buff flanks
    c = mix(c, [0.62, 0.38, 0.22], ctx.bones('neck') * sm(0.0, 0.6, up) * 0.8)                     # rusty nape
    c = mix(c, [0.88, 0.85, 0.78], sm(0.0, -0.55, up) * (1 - tail) * (1 - ear))                    # pale belly
    c = mix(c, [0.92, 0.9, 0.86], tail * sm(0.4, -0.4, up))                                         # white tail underside
    c = mix(c, [0.52, 0.42, 0.32], tail * sm(-0.4, 0.4, up))
    c = mix(c, [0.55, 0.42, 0.32], ear * 0.7)
    c = mix(c, [0.62, 0.45, 0.42], ear * sm(0.2, 0.8, N[:, 2]) * 0.6)                               # inner ear
    tipEar = ear * sm(39.0, 40.6, ctx.y)
    c = mix(c, [0.2, 0.16, 0.13], tipEar * 0.8)                                                      # dark ear rims
    c = mix(c, [0.85, 0.8, 0.7], head * sm(24.0, 22.5, ctx.y) * sm(17.0, 19.5, ctx.z) * 0.6)         # pale muzzle
    eye = np.array(EYE['pos'])
    de = np.minimum(np.linalg.norm(ctx.P - eye, axis=1), np.linalg.norm(ctx.P - eye * [-1, 1, 1], axis=1))
    c = mix(c, [0.86, 0.8, 0.68], sm(EYE['r'] + 0.7, EYE['r'] + 0.2, de) * head)                    # pale eye ring
    c = mix(c, [0.55, 0.4, 0.38], sm(0.8, 0.4, np.linalg.norm(ctx.P - np.array([0, 23.4, 20.0]), axis=1)))
    tip = np.clip(0.3 + 0.25 * n1 + 0.4 * tail, 0, 1)
    ao = np.clip(0.55 + 0.45 * sm(1, 9, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
