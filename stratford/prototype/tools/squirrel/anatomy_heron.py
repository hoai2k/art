"""Great blue heron (Ardea herodias), part by part (centimetres; frame as anatomy.py).

Measured on the delivered turnaround's side view (reference/sheets/heron_turnaround.png, R9.7),
scaled to 85 cm from tail tip to bill tip as drawn, which stands the bird 1.05 m tall (at the
1 m used before it came out 1.24 m tall): the body slung under folded wings that reach the tail
(tail tip z -42, y 46; the back rising to the shoulders at y 80, z 0), hanging breast plumes,
the neck in an S forward to z 18 and back over the shoulders to the head (crown 105 cm at z 15),
black plumes trailing behind the head, the dagger bill to its tip at z 42.5 / y 96, long bare
legs with rusty thighs. R9.7's top view shows the bird on its side, so widths come from the
three-quarter view and the flying views (heron_flying_top.png, R9.9: span about 1.95 m, the inner
wing about 30 cm deep). Rerun build.py when the replacement turnaround (round 11) lands.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 56, -20)),
    ('spine1', 'pelvis', (0, 63, -8)),
    ('spine2', 'spine1', (0, 70, 2)),
    ('neck1',  'spine2', (0, 74, 8)),
    ('neck2',  'neck1',  (0, 82, 13)),
    ('neck3',  'neck2',  (0, 91, 10)),
    ('neck4',  'neck3',  (0, 97, 10.5)),
    ('head',   'neck4',  (0, 100.5, 14.5)),
    ('bill',   'head',   (0, 100.2, 19.5)),
]
TAIL_N = 2
TAIL_BASE = (0, 50, -33)
TAIL_LEN = 11.0
TAIL_RISE = -0.15
TAIL_XS, TAIL_YS = 1.8, 0.5

LIMBS = [
    ('humerus_L', 'spine2',   (6, 72, 0)),
    ('ulna_L',    'humerus_L', (30, 73, -4)),
    ('manus_L',   'ulna_L',   (56, 73, -7)),
    ('thigh_L',   'pelvis',   (5, 52, -10)),
    ('shin_L',    'thigh_L',  (5.5, 42, -6)),
    ('tarsus_L',  'shin_L',   (5.5, 24, -10)),
    ('toes_L',    'tarsus_L', (5.5, 1.5, -8)),
]
ENDS = {
    'manus_L': (76, 73, -12),
    'toes_L': (6, 0.6, 1),
    'bill': (0, 96, 42.5),
    'head': (0, 100.5, 19.5),
}
BODY_BONES = ('root', 'pelvis', 'spine1', 'spine2', 'neck1', 'neck2', 'neck3', 'neck4', 'head', 'bill')
EYE = dict(bone='head', pos=(2.0, 101.0, 17.6), r=0.55, out=[1, 0.2, 0.35], color=0xe0c640, pupil=True)
FUR = {'root': 0.5, 'pelvis': 0.6, 'spine1': 0.6, 'spine2': 0.6, 'neck1': 0.5, 'neck2': 0.4, 'neck3': 0.3, 'neck4': 0.25,
       'head': 0.2, 'bill': 0.0, 'humerus': 0.5, 'ulna': 0.4, 'manus': 0.3, 'thigh': 0.4, 'shin': 0.25, 'tarsus': 0.0, 'toes': 0.0, 'tail': 0.5}
COATS = ['natural']
SHEETS = {'natural': 'heron_turnaround.png'}
SHEET = dict(body=0.85, rump_u=0.0, side=dict(box=(0, 0, 830, 1080)), top=False)   # tail tip to bill tip; 1.05 m tall; R9.7's top view is the bird on its side
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
    add('ell', 'spine1', ((0, 63, -14), (11, 11, 26), (-0.5, 0, 0)), 4)
    add('ell', 'spine2', ((0, 69, 1), (9.5, 10, 9), (-0.1, 0, 0)), 4)
    add('ell', 'spine1', ((0, 64, -16), (10.5, 6, 26), (-0.5, 0, 0)), 3)               # the folded wings' bulk
    add('ell', 'pelvis', ((0, 52, -27), (8, 6, 12), (-0.3, 0, 0)), 3)
    add('ell', 'neck1', ((0, 64, 7), (4.5, 12, 4), (0.15, 0, 0)), 2)                 # breast plumes
    # the long S neck: slender
    nk = [B['neck1'], B['neck2'], B['neck3'], B['neck4'], np.array(B['head']) + [0, 0, -1]]
    add('tube', 'neck1', ([(0, 69, 5), nk[0], nk[1]], [5.5, 4.0, 3.2], 1.0, 1.0), 2)
    add('tube', 'neck2', ([nk[1], nk[2]], [3.0, 2.6], 1.0, 1.0), 1.2)
    add('tube', 'neck3', ([nk[2], nk[3]], [2.6, 2.3], 1.0, 1.0), 1.0)
    add('tube', 'neck4', ([nk[3], nk[4]], [2.3, 2.3], 1.0, 1.0), 0.8)
    # head: narrow, flat-crowned; the plumes off the back of the head; the dagger bill
    add('ell', 'head', ((0, 101, 15.5), (2.5, 2.8, 4.2), (-0.1, 0, 0)), 0.8)
    add('tube', 'head', ([(0, 102.3, 13), (0, 100, 4), (0, 95.5, -6)], [1.0, 0.6, 0.25], 0.8, 0.6), 0.4)   # crest plumes
    add('tube', 'bill', ([(0, 100.6, 18.5), (0, 99.2, 29), (0, 96, 42.5)], [1.5, 1.0, 0.2], 0.8, 1.0), 0.5)
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
    c = mix(c, [0.93, 0.92, 0.88], head * sm(97.5, 100.0, ctx.y))                                  # white face and crown
    stripe = head * sm(0.6, 1.4, np.abs(ctx.y - 102.6) * -1 + 2.0) * sm(13.5, 17.5, ctx.z) * (1 - sm(20, 21, ctx.z))
    c = mix(c, [0.08, 0.08, 0.1], np.clip(stripe, 0, 1))                                         # black stripe over the eye
    plume = ctx.bones('head') * sm(12.5, 9.5, ctx.z)
    c = mix(c, [0.1, 0.1, 0.12], plume)                                                           # black plumes
    c = mix(c, [0.86, 0.68, 0.24], ctx.bones('bill'))                                            # yellow-orange bill
    c = mix(c, [0.25, 0.23, 0.36], ctx.bones('bill') * sm(98.6, 97.2, ctx.y) * 0.5)
    c = mix(c, [0.56, 0.36, 0.23], ctx.bones('thigh'))                                           # rusty thighs
    c = mix(c, [0.24, 0.24, 0.2], ctx.bones('shin', 'tarsus', 'toes'))                           # dark legs
    c = mix(c, [0.72, 0.72, 0.72], ctx.bones('spine2') * sm(-0.2, -0.7, up) * 0.5)
    c *= (0.94 + 0.1 * n1)[:, None]
    tip = np.full(n, 0.15)
    ao = np.clip(0.6 + 0.4 * sm(20, 60, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
