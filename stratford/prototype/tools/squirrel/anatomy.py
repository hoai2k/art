"""The eastern grey squirrel, part by part: skeleton (rest pose) and the soft-tissue parts around it.

Units: centimetres here (converted to metres by build.py). Model frame as the game: +z forward
(nose), y up, +x the animal's LEFT; origin on the ground under the middle of the body. The rest
pose is a relaxed stand on all fours with the tail straight out behind and a little up (the game
curls it); legs are bent so the joints skin well both ways.

Measurements (adult Sciurus carolinensis, ~0.5 kg; mammal references and museum specimens,
checked against the reference sheet's grid with review/grid.py):
  head and body 25 cm (nose tip 15.2 .. rump -9.8), tail vertebrae ~21 cm (+ ~4 cm of hair at the
  tip), head 6.0 cm long, 3.4 cm wide; ear 1.4 cm above the skull, rounded; eye 1.0 cm across,
  high on the side of the head 3 cm behind the nose; back 9.5-10 cm high when standing, belly
  4 cm off the ground; humerus 3.1, radius/ulna 3.3, fore paw 2.1; femur 4.3, tibia 6.0, hind foot
  (heel to toe tips) 5.6 cm; scapula 3 cm; body width 5.6 cm at the haunches, 4.8 at the chest.
"""

# bone: (name, parent, head position (x, y, z) cm). `L`/`R` limbs are mirrored (x -> -x) by build.py.
SPINE = [
    ('root',   None,     (0, 0, 0)),
    ('pelvis', 'root',   (0, 8.0, -5.6)),
    ('spine1', 'pelvis', (0, 8.9, -2.2)),     # lumbar
    ('spine2', 'spine1', (0, 8.4, 2.4)),      # thorax
    ('neck',   'spine2', (0, 7.7, 7.2)),
    ('head',   'neck',   (0, 8.5, 9.6)),      # atlas / skull base
    ('jaw',    'head',   (0, 7.7, 10.6)),
]
TAIL_N = 12
TAIL_BASE = (0, 8.3, -9.0)
TAIL_LEN = 21.0
TAIL_RISE = 0.30          # radians above horizontal (rest)

# left limbs (x > 0); build.py mirrors them
LIMBS = [
    ('ear_L',   'head',    (1.25, 11.1, 10.2)),
    ('scap_L',  'spine2',  (1.3, 8.6, 4.6)),       # top of the shoulder blade
    ('uarm_L',  'scap_L',  (1.9, 5.7, 6.5)),       # shoulder joint
    ('farm_L',  'uarm_L',  (2.05, 3.0, 5.2)),      # elbow
    ('hand_L',  'farm_L',  (2.0, 0.75, 7.4)),      # wrist
    ('fing_L',  'hand_L',  (2.0, 0.35, 8.5)),      # knuckles
    ('thigh_L', 'pelvis',  (2.0, 7.0, -5.6)),      # hip joint
    ('shin_L',  'thigh_L', (2.7, 4.3, -2.4)),      # knee
    ('foot_L',  'shin_L',  (2.45, 1.05, -8.2)),    # ankle (heel)
    ('toes_L',  'foot_L',  (2.45, 0.4, -4.9)),     # ball of the foot
]
ENDS = {  # where a chain's last bone ends (for IK lengths and paint)
    'fing_L': (2.0, 0.25, 9.6),
    'toes_L': (2.5, 0.25, -2.6),
    'head': (0, 8.4, 15.2),
}
EYE = dict(bone='head', pos=(1.42, 9.75, 12.15), r=0.52)          # left eye centre (cm), mirrored
WHISKERS = dict(bone='head', pos=(0.75, 8.35, 14.35))             # left whisker pad (cm)

# fur length per bone (cm): shell fur depth
FUR = {'root': 0.4, 'pelvis': 0.5, 'spine1': 0.5, 'spine2': 0.45, 'neck': 0.4, 'head': 0.22, 'jaw': 0.2,
       'ear': 0.12, 'scap': 0.4, 'uarm': 0.32, 'farm': 0.2, 'hand': 0.08, 'fing': 0.04,
       'thigh': 0.45, 'shin': 0.25, 'foot': 0.08, 'toes': 0.04, 'tail': 2.2}


def parts(B):
    """the soft-tissue parts: B[name] -> bone head position (cm). Each part:
    (kind, bone, args, blend cm). kinds: 'ell' (centre, radii (x, y, z), rot (rx, ry, rz) rad),
    'tube' (points, radii, xs (width scale), ys (height scale))."""
    P = []
    add = lambda *a: P.append(a)
    # --- torso: haunch, lumbar/belly, chest (overlapping volumes on their spine bones)
    add('ell', 'pelvis', ((0, 6.9, -6.4), (2.9, 3.3, 3.9), (0.15, 0, 0)), 1.3)
    add('ell', 'pelvis', ((0, 7.4, -8.6), (2.2, 2.2, 1.9), (0, 0, 0)), 1.0)          # rump
    add('ell', 'spine1', ((0, 6.85, -1.6), (2.95, 3.3, 4.4), (-0.05, 0, 0)), 1.3)    # loins / belly
    add('ell', 'spine2', ((0, 6.35, 3.3), (2.55, 3.0, 3.6), (-0.12, 0, 0)), 1.3)    # chest
    add('ell', 'spine2', ((0, 5.3, 5.6), (1.9, 1.9, 2.0), (0, 0, 0)), 1.0)           # breast / throat
    add('tube', 'neck', ([(0, 6.9, 6.6), (0, 7.6, 8.4), (0, 8.2, 9.8)], [2.15, 1.95, 1.8], 0.92, 1.0), 1.0)
    # --- head: cranium, cheeks, muzzle, nose, chin (jaw), ears
    add('ell', 'head', ((0, 9.55, 10.9), (1.75, 2.0, 2.55), (-0.18, 0, 0)), 0.8)      # cranium
    add('ell', 'head', ((0, 8.6, 12.1), (1.75, 1.55, 2.0), (0.1, 0, 0)), 0.7)        # cheeks
    add('tube', 'head', ([(0, 9.1, 12.4), (0, 8.75, 14.0), (0, 8.45, 14.85)], [1.3, 0.95, 0.62], 0.95, 1.0), 0.6)   # muzzle
    add('ell', 'head', ((0, 8.45, 15.0), (0.42, 0.36, 0.32), (0, 0, 0)), 0.2)        # nose pad
    add('tube', 'jaw', ([(0, 7.45, 10.9), (0, 7.55, 12.7), (0, 7.85, 14.1)], [1.05, 0.75, 0.42], 1.1, 0.9), 0.5)  # chin
    for s in (1, -1):
        # ear: a rounded leaf, broad front to back seen from the side, thin across, tipped out
        add('ell', 'ear_' + 'LR'[s < 0], ((s * 1.35, 11.75, 10.15), (0.24, 1.05, 0.72), (0.2, 0, -s * 0.38)), 0.25)
    # --- forelegs
    for s in (1, -1):
        X = 'LR'[s < 0]; b = lambda n: B[n + '_' + X]
        add('ell', 'scap_' + X, ((s * 1.75, 6.9, 5.4), (1.15, 2.1, 1.8), (0.4, 0, 0)), 0.9)
        add('tube', 'uarm_' + X, ([b('uarm'), b('farm')], [1.25, 0.82], 0.85, 1.0), 0.6)
        add('tube', 'farm_' + X, ([b('farm'), _lerp(b('farm'), b('hand'), 0.5), b('hand')], [0.78, 0.6, 0.45], 0.9, 1.0), 0.4)
        add('tube', 'hand_' + X, ([b('hand'), b('fing')], [0.44, 0.42], 1.35, 0.62), 0.25)
        add('tube', 'fing_' + X, ([b('fing'), _sx(ENDS['fing_L'], s)], [0.42, 0.26], 1.5, 0.55), 0.2)
    # --- hind legs
    for s in (1, -1):
        X = 'LR'[s < 0]; b = lambda n: B[n + '_' + X]
        hip, knee, ank, ball = b('thigh'), b('shin'), b('foot'), b('toes')
        add('ell', 'thigh_' + X, ((s * 2.4, 6.1, -4.9), (1.8, 3.2, 3.5), (-0.55, 0, 0)), 1.1)     # haunch muscle
        add('tube', 'thigh_' + X, ([hip, knee], [1.7, 1.15], 0.8, 1.0), 0.8)
        add('tube', 'shin_' + X, ([knee, _lerp(knee, ank, 0.45), ank], [1.05, 0.72, 0.42], 0.8, 1.0), 0.5)
        add('tube', 'foot_' + X, ([_add(ank, (0, -0.25, 0.2)), ball], [0.48, 0.5], 1.25, 0.6), 0.3)
        add('tube', 'toes_' + X, ([ball, _sx(ENDS['toes_L'], s)], [0.5, 0.3], 1.55, 0.55), 0.2)
    return P


def tail_core_radius(t):
    """the tail's dense inner fur (radius, cm) at t = 0 (base) .. 1 (tip); the shells add the rest"""
    import numpy as np
    return float(np.interp(t, [0, 0.08, 0.3, 0.75, 0.92, 1.0], [1.2, 1.55, 1.85, 1.75, 1.3, 0.5]))


def _lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def _add(a, d): return tuple(a[i] + d[i] for i in range(3))
def _sx(p, s): return (p[0] * s, p[1], p[2])
