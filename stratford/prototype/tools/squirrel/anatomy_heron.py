"""Great blue heron (Ardea herodias), part by part (centimetres; frame as anatomy.py).

Measurements (adult, ~2.3 kg): 1.1 m tall standing with the neck in a relaxed S; body 45 cm with
the folded wings; legs 50 cm to the belly (bare dark shanks, rusty feathered thighs), long toes;
dagger bill 14 cm, yellow-orange; wingspan 1.8 m. Plumage: blue-grey body and wings, darker flight
feathers, white face and crown with a black stripe running into plumes, grey neck with a streaked
white and black foreneck and long breast plumes. From bird references; to be re-measured on R9.7
- R9.9 (reference/sheets/heron_turnaround.png, heron_poses.png, heron_flying_top.png).
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 60, -12)),
    ('spine1', 'pelvis', (0, 64, -1)),
    ('spine2', 'spine1', (0, 68, 9)),
    ('neck1',  'spine2', (0, 71, 15)),
    ('neck2',  'neck1',  (0, 81, 18)),
    ('neck3',  'neck2',  (0, 91, 13)),
    ('neck4',  'neck3',  (0, 99, 14)),
    ('head',   'neck4',  (0, 105, 18)),
    ('bill',   'head',   (0, 105, 23)),
]
TAIL_N = 2
TAIL_BASE = (0, 60, -24)
TAIL_LEN = 10.0
TAIL_RISE = -0.45
TAIL_XS, TAIL_YS = 1.8, 0.5

LIMBS = [
    ('humerus_L', 'spine2',   (6, 70, 8)),
    ('ulna_L',    'humerus_L', (30, 71, 4)),
    ('manus_L',   'ulna_L',   (56, 71, 1)),
    ('thigh_L',   'pelvis',   (5, 58, -4)),
    ('shin_L',    'thigh_L',  (5.5, 47, 0)),
    ('tarsus_L',  'shin_L',   (5.5, 27, -4)),
    ('toes_L',    'tarsus_L', (5.5, 1.5, -2)),
]
ENDS = {
    'manus_L': (76, 71, -4),
    'toes_L': (6, 0.6, 9),
    'bill': (0, 101.5, 37),
    'head': (0, 105, 23),
}
BODY_BONES = ('root', 'pelvis', 'spine1', 'spine2', 'neck1', 'neck2', 'neck3', 'neck4', 'head', 'bill')
EYE = dict(bone='head', pos=(1.9, 106.2, 21.6), r=0.55, out=[1, 0.2, 0.35], color=0xe0c640, pupil=True)
FUR = {'root': 0.5, 'pelvis': 0.6, 'spine1': 0.6, 'spine2': 0.6, 'neck1': 0.5, 'neck2': 0.4, 'neck3': 0.3, 'neck4': 0.25,
       'head': 0.2, 'bill': 0.0, 'humerus': 0.5, 'ulna': 0.4, 'manus': 0.3, 'thigh': 0.4, 'shin': 0.25, 'tarsus': 0.0, 'toes': 0.0, 'tail': 0.5}
COATS = ['natural']
SHEETS = {'natural': 'heron_turnaround.png'}
SHEET = dict(body=1.0, rump_u=0.0)
TRIS = 12000
GRID = 0.3
GREY = 0x7d8a98
META = {'wings': dict(bones=['humerus', 'ulna', 'manus'], color=GREY, tipColor=0x2f3540, secColor=0x55606e, covertColor=0x8b97a3,
                      primaries=dict(n=10, len=0.3, width=0.06, fan0=0.25, fan1=1.1),
                      secondaries=dict(n=11, len=0.25, width=0.055), tertials=dict(n=6, len=0.2, width=0.06),
                      tail=dict(n=7, len=0.13, width=0.045, spread=0.8, color=0x6f7c8a))}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.5, 1.0], [4.0, 3.2, 1.6]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # a slim body under the folded wings, the breast with its hanging plumes
    add('ell', 'spine1', ((0, 64, -3), (11, 11, 21), (0.2, 0, 0)), 4)
    add('ell', 'spine2', ((0, 66, 8), (9.5, 10, 10), (-0.1, 0, 0)), 4)
    add('ell', 'spine1', ((0, 69.5, -5), (10, 5, 19), (0.2, 0, 0)), 3)              # the folded wings' bulk
    add('ell', 'pelvis', ((0, 59, -18), (8, 7, 9), (0.3, 0, 0)), 3)
    add('ell', 'neck1', ((0, 66, 17), (4, 9, 3.5), (0.2, 0, 0)), 2)                  # breast plumes
    # the long S neck: slender
    nk = [B['neck1'], B['neck2'], B['neck3'], B['neck4'], np.array(B['head']) + [0, 0, -1]]
    add('tube', 'neck1', ([(0, 67, 11), nk[0], nk[1]], [5.0, 3.6, 3.0], 1.0, 1.0), 2)
    add('tube', 'neck2', ([nk[1], nk[2]], [3.0, 2.6], 1.0, 1.0), 1.2)
    add('tube', 'neck3', ([nk[2], nk[3]], [2.6, 2.3], 1.0, 1.0), 1.0)
    add('tube', 'neck4', ([nk[3], nk[4]], [2.3, 2.3], 1.0, 1.0), 0.8)
    # head: narrow, flat-crowned; the plumes off the back of the head; the dagger bill
    add('ell', 'head', ((0, 105.5, 19.5), (2.4, 2.7, 4.0), (-0.1, 0, 0)), 0.8)
    add('tube', 'head', ([(0, 106.5, 17), (0, 107.5, 10), (0, 107, 5)], [1.0, 0.6, 0.25], 0.8, 0.6), 0.4)   # crest plumes
    add('tube', 'bill', ([(0, 105, 22.5), (0, 103.8, 29), (0, 101.5, 37)], [1.4, 0.9, 0.2], 0.8, 1.0), 0.5)
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
    c = mix(c, [0.93, 0.92, 0.88], head * sm(102, 104.5, ctx.y))                                  # white face and crown
    stripe = head * sm(0.6, 1.4, np.abs(ctx.y - 107.3) * -1 + 2.0) * sm(17, 21, ctx.z) * (1 - sm(24, 25, ctx.z))
    c = mix(c, [0.08, 0.08, 0.1], np.clip(stripe, 0, 1))                                         # black stripe over the eye
    plume = ctx.bones('head') * sm(16.5, 13, ctx.z)
    c = mix(c, [0.1, 0.1, 0.12], plume)                                                           # black plumes
    c = mix(c, [0.86, 0.68, 0.24], ctx.bones('bill'))                                            # yellow-orange bill
    c = mix(c, [0.25, 0.23, 0.36], ctx.bones('bill') * sm(102.8, 101.4, ctx.y) * 0.5)
    c = mix(c, [0.56, 0.36, 0.23], ctx.bones('thigh'))                                           # rusty thighs
    c = mix(c, [0.24, 0.24, 0.2], ctx.bones('shin', 'tarsus', 'toes'))                           # dark legs
    c = mix(c, [0.72, 0.72, 0.72], ctx.bones('spine2') * sm(-0.2, -0.7, up) * 0.5)
    c *= (0.94 + 0.1 * n1)[:, None]
    tip = np.full(n, 0.15)
    ao = np.clip(0.6 + 0.4 * sm(20, 60, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
