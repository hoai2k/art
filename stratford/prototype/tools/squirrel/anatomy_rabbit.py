"""Eastern cottontail (Sylvilagus floridanus), part by part (centimetres; frame as anatomy.py).

Measurements (adult, ~1.2 kg): head and body 40 cm (nose 22 .. rump -18) in the crouched sitting
pose; ears 6 cm, upright; hind feet 9.5 cm; back 17 cm high crouched; head 8.5 cm long; large eyes
high on the sides of the head; a 5 cm puff of a tail, white beneath. From mammal references; to be
re-measured on R9.3 / R9.4 (reference/sheets/rabbit_turnaround.png) when it arrives.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 12, -9)),
    ('spine1', 'pelvis', (0, 15, -2)),
    ('spine2', 'spine1', (0, 14.5, 6)),
    ('neck',   'spine2', (0, 14, 11)),
    ('head',   'neck',   (0, 16, 14)),
    ('jaw',    'head',   (0, 13, 17)),
]
TAIL_N = 2
TAIL_BASE = (0, 10, -16.5)
TAIL_LEN = 4.0
TAIL_RISE = 0.7
TAIL_XS, TAIL_YS = 1.1, 1.0

LIMBS = [
    ('ear_L',   'head',    (1.6, 20.0, 13.4)),
    ('scap_L',  'spine2',  (2.2, 13.5, 7)),
    ('uarm_L',  'scap_L',  (2.6, 8.5, 9)),
    ('farm_L',  'uarm_L',  (2.7, 5.0, 8)),
    ('hand_L',  'farm_L',  (2.7, 1.2, 10)),
    ('fing_L',  'hand_L',  (2.7, 0.6, 11.4)),
    ('thigh_L', 'pelvis',  (3.6, 10, -9)),
    ('shin_L',  'thigh_L', (4.2, 6.5, -3.5)),
    ('foot_L',  'shin_L',  (4.0, 1.6, -11.5)),
    ('toes_L',  'foot_L',  (4.0, 0.8, -4.5)),
]
ENDS = {
    'fing_L': (2.7, 0.4, 12.8),
    'toes_L': (4.0, 0.5, -1.8),
    'ear_L': (2.6, 27, 11.2),
    'head': (0, 14.6, 22.2),
}
EYE = dict(bone='head', pos=(2.55, 17.6, 16.8), r=0.85, out=[1, 0.2, 0.15], ring=0xd9c9a8)
WHISKERS = dict(pos=(0.9, 14.3, 21.3))
FUR = {'root': 0.7, 'pelvis': 0.8, 'spine1': 0.8, 'spine2': 0.7, 'neck': 0.6, 'head': 0.35, 'jaw': 0.35,
       'ear': 0.12, 'scap': 0.6, 'uarm': 0.5, 'farm': 0.35, 'hand': 0.25, 'fing': 0.2,
       'thigh': 0.7, 'shin': 0.5, 'foot': 0.35, 'toes': 0.3, 'tail': 1.3}
COATS = ['natural']
SHEETS = {'natural': 'rabbit_turnaround.png'}
SHEET = dict(body=0.4, rump_u=0.08)
TRIS = 12000
GRID = 0.16
META = {'whiskers': dict(pos=[0.009, 0.143, 0.213], length=0.05, color=0x2a221c)}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.5, 1.0], [2.0, 2.6, 1.6]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # crouched: big haunches, a rounded back, a short chest
    add('ell', 'pelvis', ((0, 10, -9.5), (6.8, 8, 8.5), (0.1, 0, 0)), 2.0)
    add('ell', 'spine1', ((0, 11.5, -1.5), (6, 6.8, 7), (0, 0, 0)), 2.0)
    add('ell', 'spine2', ((0, 10.5, 6), (5, 5.6, 5.5), (-0.15, 0, 0)), 1.8)
    add('tube', 'neck', ([(0, 12, 9.5), (0, 14, 12.5)], [3.8, 3.4], 1.0, 1.0), 1.5)
    # head: rounded cranium, the muzzle and split lip, big eyes (separate), cheeks
    add('ell', 'head', ((0, 16.8, 15.2), (3.2, 3.8, 4.4), (-0.25, 0, 0)), 1.0)
    add('ell', 'head', ((0, 15.2, 17.5), (3.0, 2.8, 3.0), (0, 0, 0)), 1.0)
    add('tube', 'head', ([(0, 16, 18), (0, 15, 20.5), (0, 14.6, 21.8)], [2.4, 1.8, 1.2], 1.05, 1.0), 0.8)
    add('ell', 'jaw', ((0, 13.2, 18.5), (1.8, 1.4, 2.4), (0, 0, 0)), 0.6)
    for s in (1, -1):
        X = 'LR'[s < 0]
        b = lambda n: B[n + '_' + X]
        # long ears: thin leaves, cupped forward, tips rounded
        ear0, ear1 = np.array(b('ear')), np.array(ENDS['ear_L']) * [s, 1, 1]
        add('tube', 'ear_' + X, ([ear0, (ear0 * 0.4 + ear1 * 0.6), ear1], [1.0, 1.6, 0.9], 0.35, 1.0), 0.4)
        # fore legs: slim
        add('ell', 'scap_' + X, ((s * 2.8, 10.5, 7), (1.6, 3.2, 2.8), (0.3, 0, 0)), 1.2)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [1.5, 1.1], 0.9, 1.0), 0.8)
        add('tube', 'farm_' + X, ([b('farm'), b('hand')], [1.0, 0.75], 1.0, 1.0), 0.5)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [0.75, 0.7], 1.2, 0.7), 0.3)
        add('tube', 'fing_' + X, ([b('fing'), np.array(ENDS['fing_L']) * [s, 1, 1]], [0.7, 0.5], 1.3, 0.6), 0.3)
        # hind legs: the big thigh, the long foot flat on the ground
        add('ell', 'thigh_' + X, ((s * 3.6, 8.5, -7), (2.6, 5, 6), (-0.4, 0, 0)), 1.5)
        add('tube', 'shin_' + X, ([b('shin'), b('foot')], [1.6, 0.9], 0.9, 1.0), 0.7)
        add('tube', 'foot_' + X, ([b('foot'), b('toes')], [0.95, 1.05], 1.3, 0.6), 0.5)
        add('tube', 'toes_' + X, ([b('toes'), np.array(ENDS['toes_L']) * [s, 1, 1]], [1.05, 0.7], 1.3, 0.55), 0.3)
    return P


def fur_adjust(ctx, fur):
    # the puff tail: long soft fur; the nose bare
    fur = fur * (1 - ctx.tailw) + ctx.tailw * 1.4
    fur[np.linalg.norm(ctx.P - np.array([0, 14.6, 22.0]), axis=1) < 0.7] = 0.02
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
    tipEar = ear * sm(25.5, 26.8, ctx.y)
    c = mix(c, [0.2, 0.16, 0.13], tipEar * 0.8)                                                      # dark ear rims
    c = mix(c, [0.85, 0.8, 0.7], head * sm(15.0, 13.5, ctx.y) * sm(19.0, 21.0, ctx.z) * 0.6)         # pale muzzle
    eye = np.array(EYE['pos'])
    de = np.minimum(np.linalg.norm(ctx.P - eye, axis=1), np.linalg.norm(ctx.P - eye * [-1, 1, 1], axis=1))
    c = mix(c, [0.86, 0.8, 0.68], sm(EYE['r'] + 0.7, EYE['r'] + 0.2, de) * head)                    # pale eye ring
    c = mix(c, [0.55, 0.4, 0.38], sm(0.8, 0.4, np.linalg.norm(ctx.P - np.array([0, 14.6, 22.0]), axis=1)))
    tip = np.clip(0.3 + 0.25 * n1 + 0.4 * tail, 0, 1)
    ao = np.clip(0.55 + 0.45 * sm(1, 9, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
