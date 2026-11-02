"""Great blue heron (Ardea herodias), part by part (centimetres; frame as anatomy.py).

Measured on the round-11 turnaround (reference/sheets/heron_turnaround.png: side view, a true
top-down view of the standing bird, a front three-quarter view), scaled to 62 cm from the folded
wing tips to the bill tip as drawn, which stands the bird 1.05 m tall: an upright stance, the
body slung steeply from the wing tips (z -30, hanging to y 33) up to the shoulders (y 82, z 0),
the breast plumes hanging forward, the neck in an S (forward to z 14 at y 80, back over z 3,
up to the head: crown 105 cm at z 10), black plumes trailing behind the head, a 13 cm dagger
bill to its tip at z 31 / y 96.5, long bare legs. Widths from the top view: the body 27 cm
across the folded wings. Wings from the flying views (heron_flying_top.png, R9.9: span about
1.95 m, the inner wing about 28 cm deep).
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 48, -16)),
    ('spine1', 'pelvis', (0, 58, -8)),
    ('spine2', 'spine1', (0, 70, 0)),
    ('neck1',  'spine2', (0, 72, 8)),
    ('neck2',  'neck1',  (0, 80, 13)),
    ('neck3',  'neck2',  (0, 88, 9)),
    ('neck4',  'neck3',  (0, 94, 5)),
    ('head',   'neck4',  (0, 100, 9)),
    ('bill',   'head',   (0, 99.6, 16)),
]
TAIL_N = 2
TAIL_BASE = (0, 40, -24)
TAIL_LEN = 9.0
TAIL_RISE = -0.9
TAIL_XS, TAIL_YS = 1.8, 0.5

LIMBS = [
    ('humerus_L', 'spine2',   (6, 74, -2)),
    ('ulna_L',    'humerus_L', (30, 75, -6)),
    ('manus_L',   'ulna_L',   (56, 75, -9)),
    ('thigh_L',   'pelvis',   (5, 48, -6)),
    ('shin_L',    'thigh_L',  (5.5, 40, -3)),
    ('tarsus_L',  'shin_L',   (5.5, 24, -6)),
    ('toes_L',    'tarsus_L', (5.5, 1.5, -4)),
]
ENDS = {
    'manus_L': (76, 75, -14),
    'toes_L': (6, 0.6, 5),
    'bill': (0, 96.5, 31),
    'head': (0, 100.5, 16),
}
BODY_BONES = ('root', 'pelvis', 'spine1', 'spine2', 'neck1', 'neck2', 'neck3', 'neck4', 'head', 'bill')
EYE = dict(bone='head', pos=(2.1, 101.6, 13.5), r=0.55, out=[1, 0.2, 0.35], color=0xe0c640, pupil=True)
FUR = {'root': 0.5, 'pelvis': 0.6, 'spine1': 0.6, 'spine2': 0.6, 'neck1': 0.5, 'neck2': 0.4, 'neck3': 0.3, 'neck4': 0.25,
       'head': 0.2, 'bill': 0.0, 'humerus': 0.5, 'ulna': 0.4, 'manus': 0.3, 'thigh': 0.4, 'shin': 0.25, 'tarsus': 0.0, 'toes': 0.0, 'tail': 0.5}
COATS = ['natural']
SHEETS = {'natural': 'heron_turnaround.png'}
SHEET = dict(body=0.62, rump_u=0.0, shadow=False)        # tail tip to bill tip as drawn (round 11 turnaround), which stands it 1.05 m tall
TRIS = 12000
GRID = 0.3
GREY = 0x7d8a98
META = {'wings': dict(bones=['humerus', 'ulna', 'manus'], color=GREY, tipColor=0x2f3540, secColor=0x55606e, covertColor=0x8b97a3,
                      primaries=dict(n=10, len=0.3, width=0.06, fan0=0.25, fan1=1.1),
                      secondaries=dict(n=11, len=0.28, width=0.055), tertials=dict(n=6, len=0.22, width=0.06),
                      tail=dict(n=7, len=0.13, width=0.045, spread=0.8, color=0x6f7c8a))}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.5, 1.0], [4.0, 3.2, 1.6]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # a slim body under the folded wings, the breast with its hanging plumes
    add('ell', 'spine1', ((0, 59, -11), (12.5, 11, 24), (-0.85, 0, 0)), 4)
    add('ell', 'spine2', ((0, 72, 1), (10, 9, 8), (-0.1, 0, 0)), 4)
    add('ell', 'spine1', ((0, 60, -13), (12, 6.5, 24), (-0.85, 0, 0)), 3)              # the folded wings' bulk
    add('ell', 'pelvis', ((0, 45, -19), (9, 7, 10), (-0.6, 0, 0)), 3)
    add('ell', 'neck1', ((0, 66, 9), (5, 13, 4.5), (0.1, 0, 0)), 2)                  # breast plumes
    # the long S neck: slender
    nk = [B['neck1'], B['neck2'], B['neck3'], B['neck4'], np.array(B['head']) + [0, 0, -1]]
    add('tube', 'neck1', ([(0, 70, 3), nk[0], nk[1]], [5.5, 4.0, 3.2], 1.0, 1.0), 2)
    add('tube', 'neck2', ([nk[1], nk[2]], [3.0, 2.6], 1.0, 1.0), 1.2)
    add('tube', 'neck3', ([nk[2], nk[3]], [2.6, 2.3], 1.0, 1.0), 1.0)
    add('tube', 'neck4', ([nk[3], nk[4]], [2.3, 2.3], 1.0, 1.0), 0.8)
    # head: narrow, flat-crowned; the plumes off the back of the head; the dagger bill
    add('ell', 'head', ((0, 100.8, 11.5), (2.5, 2.9, 4.4), (-0.1, 0, 0)), 0.8)
    add('tube', 'head', ([(0, 102.5, 8.5), (0, 99.5, 0), (0, 93.5, -8)], [1.0, 0.6, 0.25], 0.8, 0.6), 0.4)   # crest plumes
    add('tube', 'bill', ([(0, 100.2, 15), (0, 98.8, 23), (0, 96.5, 31)], [1.5, 1.0, 0.2], 0.8, 1.0), 0.5)
    for s in (1, -1):
        X = 'LR'[s < 0]
        b = lambda n: B[n + '_' + X]
        add('tube', 'humerus_' + X, ([b('humerus'), np.array(b('humerus')) * 0.6 + np.array(b('ulna')) * 0.4], [3.6, 2.2], 1.0, 0.6), 1.5)
        add('tube', 'ulna_' + X, ([b('ulna'), b('manus')], [1.5, 1.1], 1.0, 0.6), 0.6)
        add('tube', 'manus_' + X, ([b('manus'), np.array(ENDS['manus_L']) * [s, 1, 1]], [1.1, 0.6], 1.0, 0.6), 0.5)
        # legs: rusty feathered thigh, long bare shank, long toes
        add('tube', 'thigh_' + X, ([b('thigh'), b('shin')], [3.8, 2.4], 1.0, 1.0), 1.5)
        add('tube', 'shin_' + X, ([b('shin'), b('tarsus')], [1.6, 0.9], 1.0, 1.0), 0.5)
        add('tube', 'tarsus_' + X, ([b('tarsus'), b('toes')], [0.85, 0.7], 1.0, 1.0), 0.3)
        toe0 = np.array(b('toes'))
        for ang in (-0.45, 0.0, 0.45, np.pi):
            L = 9 if ang != np.pi else 5
            tip = toe0 + np.array([np.sin(ang) * L * s, -0.9, np.cos(ang) * L])
            add('tube', 'toes_' + X, ([toe0, tip], [0.6, 0.35], 1.0, 1.0), 0.3)
    return P


def paint(ctx, coat):
    sm, mix = ctx.smooth, ctx.mix
    n, N = ctx.n, ctx.N
    up = N[:, 1]
    n1 = ctx.vnoise(ctx.P, 2.0, 1)
    head = ctx.bones('head'); neck = ctx.bones('neck1', 'neck2', 'neck3', 'neck4')
    c = np.tile(np.array([0.49, 0.54, 0.6]), (n, 1))                                             # blue-grey
    c = mix(c, [0.55, 0.53, 0.52], neck * 0.8)                                                   # grey-buff neck
    fore = neck * sm(0.2, 0.8, N[:, 2]) * sm(0.6, 0.1, np.abs(N[:, 0]))
    streak = (np.sin(ctx.y * 2.2) > 0.3).astype(float)
    c = mix(c, np.where(streak[:, None] > 0, [[0.12, 0.12, 0.13]], [[0.93, 0.92, 0.88]]), fore * 0.8)   # streaked foreneck
    c = mix(c, [0.93, 0.92, 0.88], head * sm(97.0, 99.5, ctx.y))                                  # white face and crown
    stripe = head * sm(0.6, 1.4, np.abs(ctx.y - 103.4) * -1 + 2.0) * sm(8.0, 11.0, ctx.z) * (1 - sm(15, 16, ctx.z))
    c = mix(c, [0.08, 0.08, 0.1], np.clip(stripe, 0, 1))                                         # black stripe over the eye
    plume = ctx.bones('head') * sm(7.5, 5.0, ctx.z)
    c = mix(c, [0.1, 0.1, 0.12], plume)                                                           # black plumes
    c = mix(c, [0.86, 0.68, 0.24], ctx.bones('bill'))                                            # yellow-orange bill
    c = mix(c, [0.25, 0.23, 0.36], ctx.bones('bill') * sm(98.0, 96.8, ctx.y) * 0.5)
    c = mix(c, [0.56, 0.36, 0.23], ctx.bones('thigh'))                                           # rusty thighs
    c = mix(c, [0.24, 0.24, 0.2], ctx.bones('shin', 'tarsus', 'toes'))                           # dark legs
    c = mix(c, [0.72, 0.72, 0.72], ctx.bones('spine2') * sm(-0.2, -0.7, up) * 0.5)
    c *= (0.94 + 0.1 * n1)[:, None]
    tip = np.full(n, 0.15)
    ao = np.clip(0.6 + 0.4 * sm(20, 60, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
