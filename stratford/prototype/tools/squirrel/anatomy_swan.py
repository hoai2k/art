"""Mute swan (Cygnus olor), part by part (centimetres; frame as anatomy.py; origin on the ground
under the body standing, so the swimming waterline is 36 cm up the model).

Measured on the delivered turnaround (reference/sheets/swan_turnaround.png, R1.5; 2.07 mm a pixel
for 1.4 m bill to tail): body 1.0 m plus a 18 cm tail, the head top 84 cm above the water, the neck
in an S over the breast; plus mute swan references for what a swimming view can't show (wingspan
2.3 m, legs: black, short, set far back, big webbed feet). The wings are built spread (the rest
pose) as feather cards on humerus / ulna / manus bones and folded by the animator.
The pose sheet and flying views (R9.5, R9.6) will check the wings and the standing pose.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 44, -24)),
    ('spine1', 'pelvis', (0, 47, -2)),
    ('spine2', 'spine1', (0, 48, 18)),
    ('neck1',  'spine2', (0, 53, 31)),
    ('neck2',  'neck1',  (0, 66, 38)),
    ('neck3',  'neck2',  (0, 84, 38)),
    ('neck4',  'neck3',  (0, 100, 34)),
    ('head',   'neck4',  (0, 110, 35)),
    ('bill',   'head',   (0, 110, 41)),
]
TAIL_N = 2
TAIL_BASE = (0, 47, -46)
TAIL_LEN = 16.0
TAIL_RISE = 0.25
TAIL_XS, TAIL_YS = 2.0, 0.5

LIMBS = [
    ('humerus_L', 'spine2',   (11, 55, 22)),
    ('ulna_L',    'humerus_L', (40, 56, 16)),
    ('manus_L',   'ulna_L',   (72, 56, 12)),
    ('thigh_L',   'pelvis',   (10, 36, -2)),
    ('shin_L',    'thigh_L',  (11, 25, 2)),
    ('tarsus_L',  'shin_L',   (11, 12, -2)),
    ('toes_L',    'tarsus_L', (11, 1.8, 3)),
]
ENDS = {
    'manus_L': (95, 56, 6),
    'toes_L': (11.5, 0.8, 17),
    'bill': (0, 103, 52),
    'head': (0, 110, 41),
}
BODY_BONES = ('root', 'pelvis', 'spine1', 'spine2', 'neck1', 'neck2', 'neck3', 'neck4', 'head', 'bill')
EYE = dict(bone='head', pos=(3.3, 112.2, 38.6), r=0.75, out=[1, 0.25, 0.25], color=0x1a1210)
FUR = {'root': 0.6, 'pelvis': 0.7, 'spine1': 0.7, 'spine2': 0.7, 'neck1': 0.45, 'neck2': 0.4, 'neck3': 0.35, 'neck4': 0.3,
       'head': 0.2, 'bill': 0.0, 'humerus': 0.5, 'ulna': 0.4, 'manus': 0.3, 'thigh': 0.5, 'shin': 0.3, 'tarsus': 0.0, 'toes': 0.0, 'tail': 0.6}
COATS = ['natural']
SHEETS = {'natural': 'swan_turnaround.png'}
SHEET = dict(body=1.4, rump_u=0.0, y0=0.36)
TRIS = 14000
GRID = 0.4
WHITE = 0xf3f1ea
META = {'wings': dict(bones=['humerus', 'ulna', 'manus'], color=WHITE, tipColor=0xf0eee6, covertColor=0xfaf8f2, secColor=0xf1efe8,
                      primaries=dict(n=10, len=0.4, width=0.075, fan0=0.25, fan1=1.15),
                      secondaries=dict(n=12, len=0.3, width=0.07), tertials=dict(n=7, len=0.26, width=0.075),
                      tail=dict(n=9, len=0.2, width=0.06, spread=1.0, color=0xf2f0e9)),
        'waterline': 0.36}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.5, 1.0], [7, 6, 3]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # the hull: a long, deep, rounded body; a full breast; a raised rump
    add('ell', 'spine1', ((0, 43, -4), (21, 18, 42), (0.04, 0, 0)), 6)
    add('ell', 'spine2', ((0, 41, 24), (17, 16, 15), (-0.2, 0, 0)), 6)
    add('ell', 'pelvis', ((0, 46, -34), (15, 13, 16), (0.12, 0, 0)), 5)
    add('ell', 'spine1', ((0, 54, -6), (18, 9, 32), (0.05, 0, 0)), 6)        # the folded wings' bulk on the back
    # the neck: thick at the base, an S up to the head
    nk = [B['neck1'], B['neck2'], B['neck3'], B['neck4'], np.array(B['head']) + [0, 0, -1]]
    add('tube', 'neck1', ([(0, 46, 28), nk[0], nk[1]], [8.5, 6.8, 5.4], 1.0, 1.0), 3)
    add('tube', 'neck2', ([nk[1], nk[2]], [5.4, 4.6], 1.0, 1.0), 2)
    add('tube', 'neck3', ([nk[2], nk[3]], [4.6, 4.2], 1.0, 1.0), 2)
    add('tube', 'neck4', ([nk[3], nk[4]], [4.2, 4.0], 1.0, 1.0), 1.5)
    # head and bill (the black knob and facial skin at the base)
    add('ell', 'head', ((0, 111.5, 36.5), (3.6, 4.0, 5.8), (-0.15, 0, 0)), 1.2)
    add('tube', 'bill', ([(0, 110.5, 40), (0, 108, 46), (0, 104, 51.5)], [2.3, 1.8, 1.0], 1.15, 0.7), 0.8)
    add('ell', 'bill', ((0, 112.6, 41.2), (1.5, 1.6, 1.6), (0, 0, 0)), 0.6)       # knob
    for s in (1, -1):
        X = 'LR'[s < 0]
        b = lambda n: B[n + '_' + X]
        # wing roots blend into the shoulders (the wing itself is feather cards)
        add('tube', 'humerus_' + X, ([b('humerus'), np.array(b('humerus')) * 0.6 + np.array(b('ulna')) * 0.4], [5.5, 3.2], 1.0, 0.6), 2)
        add('tube', 'ulna_' + X, ([b('ulna'), b('manus')], [2.0, 1.5], 1.0, 0.6), 0.8)
        add('tube', 'manus_' + X, ([b('manus'), np.array(ENDS['manus_L']) * [s, 1, 1]], [1.4, 0.8], 1.0, 0.6), 0.6)
        # legs: feathered thigh inside the body, black shank and big webbed feet
        add('ell', 'thigh_' + X, ((s * 11, 31, 0), (5, 7, 7), (0, 0, 0)), 3)
        add('tube', 'shin_' + X, ([b('shin'), b('tarsus')], [3.0, 1.9], 1.0, 1.0), 1.0)
        add('tube', 'tarsus_' + X, ([b('tarsus'), b('toes')], [1.6, 1.3], 0.8, 1.2), 0.6)
        add('tube', 'toes_' + X, ([b('toes'), np.array(ENDS['toes_L']) * [s, 1, 1]], [2.0, 3.2], 2.6, 0.25), 0.5)   # the web
    return P


def paint(ctx, coat):
    sm, mix = ctx.smooth, ctx.mix
    n = ctx.n
    n1 = ctx.vnoise(ctx.P, 2.5, 1)
    c = np.tile(np.array([0.95, 0.94, 0.9]), (n, 1))
    c = mix(c, [0.93, 0.89, 0.8], ctx.bones('neck1', 'neck2', 'neck3', 'neck4', 'head') * 0.5)      # a faint buff on the neck
    bill = ctx.bones('bill')
    c = mix(c, [0.93, 0.42, 0.12], bill)                                                            # orange bill
    knob = sm(2.6, 1.4, np.linalg.norm(ctx.P - np.array([0, 112.6, 41.2]), axis=1))
    face = ctx.bones('head') * sm(39.0, 41.5, ctx.z) * sm(114, 108, ctx.y)
    nail = sm(1.6, 0.6, np.linalg.norm(ctx.P - np.array([0, 104.5, 51.2]), axis=1))
    c = mix(c, [0.06, 0.05, 0.05], np.clip(knob + face * 0.9 + nail, 0, 1))                       # black knob, face, nail
    c = mix(c, [0.08, 0.08, 0.08], ctx.bones('tarsus', 'toes') + ctx.bones('shin') * sm(26, 20, ctx.y))   # black legs
    c *= (0.95 + 0.08 * n1)[:, None]
    tip = np.full(n, 0.3)
    ao = np.clip(0.6 + 0.4 * sm(15, 45, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
