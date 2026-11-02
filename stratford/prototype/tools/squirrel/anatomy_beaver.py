"""North American beaver (Castor canadensis), part by part (centimetres; frame as anatomy.py: +z
forward, y up, +x the animal's left, origin on the ground under the middle of the body).

Measurements (adult, ~20 kg): head and body 80 cm (nose 46 .. rump -34), the paddle tail 30 cm
long, 13 cm wide and 2 cm thick, held flat; back 32 cm high when walking, belly 9 cm off the
ground; head 15 cm long and 12 wide, small round ears 3 cm, small eyes high on the head; short
fore legs with small clawed hands; hind feet 17 cm, webbed. From mammal references; to be
re-measured on R9.1 / R9.2 (reference/sheets/beaver_turnaround.png) when it arrives.
"""
import numpy as np

SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 22, -20)),
    ('spine1', 'pelvis', (0, 26, -4)),
    ('spine2', 'spine1', (0, 24, 14)),
    ('neck',   'spine2', (0, 21, 25)),
    ('head',   'neck',   (0, 21, 31)),
    ('jaw',    'head',   (0, 15, 35)),
]
TAIL_N = 4
TAIL_BASE = (0, 13, -34)
TAIL_LEN = 30.0
TAIL_RISE = -0.12
TAIL_XS, TAIL_YS = 3.6, 0.4           # a broad flat paddle

LIMBS = [
    ('ear_L',   'head',    (5.0, 27.0, 31.5)),
    ('scap_L',  'spine2',  (6, 23, 18)),
    ('uarm_L',  'scap_L',  (8, 14, 22)),
    ('farm_L',  'uarm_L',  (8.5, 8, 19)),
    ('hand_L',  'farm_L',  (8.5, 2.5, 23)),
    ('fing_L',  'hand_L',  (8.5, 1.2, 26)),
    ('thigh_L', 'pelvis',  (10, 17, -20)),
    ('shin_L',  'thigh_L', (11, 10, -10)),
    ('foot_L',  'shin_L',  (11, 3, -20)),
    ('toes_L',  'foot_L',  (11.5, 1.5, -11)),
]
ENDS = {
    'fing_L': (8.5, 0.6, 29),
    'toes_L': (12.5, 0.8, -3),
    'head': (0, 18, 47),
}
EYE = dict(bone='head', pos=(5.2, 24.2, 38.5), r=0.85, out=[1, 0.35, 0.25])
WHISKERS = dict(pos=(3.0, 18.3, 44.0))
FUR = {'root': 0.5, 'pelvis': 0.55, 'spine1': 0.55, 'spine2': 0.5, 'neck': 0.6, 'head': 0.35, 'jaw': 0.3,
       'ear': 0.2, 'scap': 0.6, 'uarm': 0.5, 'farm': 0.3, 'hand': 0.05, 'fing': 0.02,
       'thigh': 0.7, 'shin': 0.3, 'foot': 0.02, 'toes': 0.02, 'tail': 0.0}
COATS = ['natural']
SHEETS = {'natural': 'beaver_turnaround.png'}
SHEET = dict(body=0.8, rump_u=0.3)       # check rump_u against R9.1's side view when it lands
TRIS = 14000
GRID = 0.32
META = {'whiskers': dict(pos=[0.03, 0.183, 0.44], length=0.07, color=0x1d1714)}


def tail_core_radius(t):
    return float(np.interp(t, [0, 0.12, 0.4, 0.8, 1.0], [1.6, 2.3, 2.7, 2.6, 1.8]))


def parts(B):
    P = []
    add = lambda *a: P.append(a)
    # a heavy rounded body, highest over the hips
    add('ell', 'pelvis', ((0, 19, -20), (14.5, 14.5, 17), (0.1, 0, 0)), 4.0)
    add('ell', 'spine1', ((0, 19.5, -3), (15, 15, 16), (0, 0, 0)), 4.0)
    add('ell', 'spine2', ((0, 17.5, 13), (12, 12.5, 12), (-0.1, 0, 0)), 3.5)
    add('ell', 'pelvis', ((0, 16, -31), (9, 8, 6), (0, 0, 0)), 3.0)                 # rump into the tail
    add('tube', 'neck', ([(0, 18, 22), (0, 19.5, 28), (0, 20, 31)], [9.5, 8.5, 7.8], 1.05, 1.0), 3.0)
    # head: broad cranium, deep cheeks, blunt muzzle, the big orange incisors
    add('ell', 'head', ((0, 22, 34), (6.5, 6.5, 7.5), (-0.1, 0, 0)), 2.0)
    add('ell', 'head', ((0, 19, 37.5), (6.5, 5.5, 5.5), (0, 0, 0)), 2.0)            # cheeks
    add('tube', 'head', ([(0, 20.5, 38), (0, 19.5, 43), (0, 18.5, 46)], [5.0, 4.0, 3.0], 1.05, 0.95), 1.5)
    add('ell', 'head', ((0, 19, 46.5), (1.6, 1.2, 1.0), (0, 0, 0)), 0.5)            # nose pad
    add('ell', 'jaw', ((0, 15.5, 39), (3.8, 3.0, 5.0), (0, 0, 0)), 1.5)            # chin
    add('ell', 'jaw', ((0, 15.6, 44.6), (1.4, 1.7, 0.7), (0.2, 0, 0)), 0.3)         # incisors
    for s in (1, -1):
        X = 'LR'[s < 0]
        add('ell', 'ear_' + X, ((s * 5.6, 27.2, 31.5), (0.9, 1.8, 1.7), (0, 0, -s * 0.3)), 0.6)
        b = lambda n: B[n + '_' + X]
        # fore legs: short, the hands small and dexterous
        add('ell', 'scap_' + X, ((s * 8, 17, 19), (4, 6, 6), (0.3, 0, 0)), 2.5)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [4.0, 3.0], 0.9, 1.0), 1.8)
        add('tube', 'farm_' + X, ([b('farm'), b('hand')], [2.8, 1.9], 0.9, 1.0), 1.2)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [1.7, 1.6], 1.4, 0.6), 0.6)
        add('tube', 'fing_' + X, ([b('fing'), np.array(ENDS['fing_L']) * [s, 1, 1]], [1.5, 0.8], 1.5, 0.5), 0.5)
        # hind legs: big haunch, the large webbed foot
        add('ell', 'thigh_' + X, ((s * 9.5, 15, -16), (6, 9, 10), (-0.3, 0, 0)), 3.0)
        add('tube', 'shin_' + X, ([b('shin'), b('foot')], [4.0, 2.2], 0.9, 1.0), 1.5)
        add('tube', 'foot_' + X, ([b('foot'), b('toes')], [2.0, 2.4], 1.6, 0.45), 0.8)
        add('tube', 'toes_' + X, ([b('toes'), np.array(ENDS['toes_L']) * [s, 1, 1]], [2.6, 2.4], 2.4, 0.3), 0.6)   # the web
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
    nose = ctx.smooth(2.0, 1.0, np.linalg.norm(ctx.P - np.array([0, 19, 46.5]), axis=1))
    c = mix(c, [0.10, 0.08, 0.07], nose)
    teeth = ctx.smooth(2.2, 1.2, np.linalg.norm(ctx.P - np.array([0, 15.6, 44.6]), axis=1))
    c = mix(c, [0.86, 0.45, 0.14], teeth)
    c *= (0.9 + 0.2 * n2)[:, None]
    tip = np.clip(0.18 + 0.15 * n1, 0, 1) * (1 - tail)
    ao = np.clip(0.55 + 0.45 * sm(2, 14, ctx.y), 0, 1)
    return np.clip(c, 0, 1), tip, ao
