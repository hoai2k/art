# Jackknife Niffy: Snip Snap (45 s)

The Niffy hovers over the park promenade while people stroll along below,
each with a little something that wants snipping: a long hat feather, a
buttonhole flower, a loose thread from a coat hem, a price tag left on a new
hat. Fly along the sky, and up or down between a high line (blade tip at
y 150) and a low one (y 385, about 70 px above the tallest hat feather).
Press the action to swoop. A pink ring shows what a swoop would go for: the
nearest thing whose spot, when the blade gets down to it, is within 90 px
across (35 px while flying flat out, so you line up rather than sweep). The
swoop homes onto that thing as it walks, so **a thing in the ring is
snipped**, unless its person is holding on, it is a balloon, or the Keeper
catches you first. Swoops take longer the further down they go (a pixel
every ~1/1050 s, at least 0.14 s), and the climb back likewise, so cruising
low snips quickly. Nothing is ever cut off a person: only loose bits and
bobs.

- **Scoring.** A snip scores 1, a price tag 2. A child's balloon string is
  not for snipping: the balloon floats away (−1). A swoop at nothing makes
  the people within 240 px hold a hand over their things for 1.8 s (another
  snap adds 1.8 s more, up to 3.6 s), with a "!" in a bubble over them and
  a "Hmph!"; swooping at someone holding on pops "They're holding on!".
  They relax three times as fast while the Niffy is up in the top quarter
  of its range (blade tip above y 209), and their "!" shrinks and fades as
  they do, so climbing away after a miss resets them sooner.
- **The Keeper.** He watches the pond with his back turned; now and then he
  turns (a red "!") and then looks up (his eye). While he looks he notices
  only movement, and his noticing fills an ink ring round the eye (over
  him, and beside the Niffy; the eye opens wider as it fills):
  - keeping still (under 40 px/s across plus up and down; the hovering bob
    doesn't count): nothing at any height, and the ring drains 0.15/s;
  - flying about: up to 1.6/s at the low line, scaled by lowness squared,
    so high up it is close to nothing;
  - swooping: 1.8/s at any height (a swoop from high is longer, so costs
    more).
  Full, and he whistles: "Peep! Caught!" and a 1.6 s daze, no points lost.
  It drains 0.5/s while he looks away. Pass: 12 snips.
- **Difficulty over the round.** The shared curve (`g.d()`, see
  `../difficulty.md`; 2026-10-12): 0 easy, 0.5 medium, 1 hard; Normal is
  medium by two-thirds of the round and ends at 0.85. Each knob is easy /
  medium / hard (hard about the old end of the round, medium a little gentler
  than the old middle):

  | Knob | Easy | Medium | Hard |
  | --- | --- | --- | --- |
  | Walking speed (px/s) | 80 | 108 | 175 |
  | Seconds between strollers | 1.75 | 1.47 | 0.82 |
  | Balloon chance | 0.12 | 0.19 | 0.34 |
  | Two things on one stroller | 0 | 0 | 0.32 |
  | Keeper's back turned (s) | 4.8 | 4.0 | 2.0 |
  | Keeper looking round (s) | 1.2 | 1.6 | 2.6 |
  | Warning before he looks (s) | 1.0 | 0.85 | 0.45 |

  For the first 8.5 s the Keeper never looks round and there are no
  balloons until 10 s; people walking the same way keep at least 420 px
  apart. Pairs come only past medium, so never at Easier.
- **Controls.** Stick, D-pad, arrows or WASD fly left and right, and up and
  down (▲ higher, ▼ lower); A, Space or Enter swoops. With a mouse or touch
  the Niffy follows the pointer across and in height (between the two
  lines), and a click or tap swoops for whatever the ring shows near where
  you tapped (up to 300 px aside). On a phone the view follows the Niffy,
  and the Keeper's "!", eye and meter show beside it.
- **Bots (tests), seeds 1–12, pass 12 (unchanged).** Mean [range] share
  passing. Medium is the old beginner (lines up within ±55 px, stays at its
  starting height, careless one swoop in seven); clumsy lines up within ±90
  px times the square of the walkers' speed over 80, careless three swoops in
  ten; good is the careful snipper (cruises low, keeps still under the
  Keeper's eye, darts while his back is turned, climbs after a miss). Mash
  sweeps the sky swooping (at its starting height, or low); camp swoops
  from one spot as people walk under.

  | Level | Idle | Mash | Mash low | Camp | Clumsy | Medium | Good |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | Easier | 0 | 1 [0–5] | 0 [0–2] | 4 [0–7] | 13 [8–21] 67% | 16 [9–20] 92% | 17 [14–21] |
  | Normal | 0 | 2 [0–5] | 0 [0–1] | 4 [1–9] | 10 [3–15] 25% | 17 [11–23] 92% | 18 [14–23] |
  | Harder | 0 | 2 [0–5] | 1 [0–4] | 3 [0–7] | 7 [4–10] 0% | 18 [14–20] 100% | 23 [17–28] |

  Every snip scores, so Easier's fewer, slower strollers also lower the
  ceiling: the clumsy snipper passes two rounds in three there, not the
  guide's three in four. At Normal the careful snipper is only a little
  ahead of the medium one (the stream of strollers limits both); at Harder
  it is well ahead. Over 1 s of the Keeper watching: still, high or low, 0;
  flying to and fro high, under 0.01; low, caught; swooping, caught.

## Images (IC-M03)

- **a: the park promenade** (`scene.niffy`): open sky for flying, trees, the
  pond and railings, the promenade, a branch for the nest, a plain place for
  the Keeper.
- **b: the passers-by** (`sprites.niffyWalkers`, 3 x 2): five grown-ups and
  a child walking left, with nothing on them; the game hangs the snippable
  things on them (`SPOT` in the game is measured on the stand-ins and may
  need adjusting when they arrive).
- **c: things to snip** (`sprites.niffyProps`, 3 x 2): feather, flower,
  thread, price tag, balloon (the game draws its string) and the nest.
- **d: the Park Keeper** (`sprites.parkKeeper`, 3 x 1): back turned, glancing
  round, looking up.
- **e: the Niffy swooping** (`sprites.niffyDive`, 2 x 1): blade open, blade
  shut; the game tilts it into the swoop.
- **f: the Niffy hovering and dazed** (`sprites.niffyFly`, 3 x 1): two flap
  frames for hovering, and tumbling after the Keeper's whistle.

## Changes after the audit

1. **Warning.** Beside the Niffy, and bigger over the Keeper: a pulsing red
   "!" while he turns, then a plainly drawn eye (almond white, blue iris,
   red rim and lashes) while he looks; the sky takes a red tint too.
2. **Crowds and aim.** People walking the same way keep at least 330 px
   apart (a spawn waits until its side is clear), so no more than two
   overlap. While hovering, a pink ring circles the thing a swoop would go
   for (red if it is a balloon string).
3. **Variance.** Steadier walkers (speed within ±5%, spawns within ±15%),
   and two things on one walker only after 60% of the game, 15% of the
   time. A snap at the air now makes nearby people hold on to their things
   for 2.5 s, so aiming matters and swooping at random doesn't pay. The
   beginner band is 10–17 (was 7–20), the good band 15–22, mashing 1–5, and
   the pass mark rose from 7 to 9.
4. **Keeper's catch.** No points lost: the 1.6 s daze (was 1.2 s) is the
   cost. A balloon costs 1 (was 2).
5. **Guide order.** Not done here: the order is `MORE_IDS` in
   `game/src/more/index.js`, a shared file, where Snip Snap (3rd) sits right
   before Snip the String (4th). The lead could move one of them.

## Matched to the painting

The painted Niffy is a red pocketknife whose beak is a pair of open blades,
with two more blades as wings. The game draws it so the beak's point is at
the swoop's snipping point: measured on the painting at about (−190, −291)
from the feet (the stand-in's was (−170, −230)), so rotation into the
swoop pivots on the blade tip. Its variants are drawn as whole square cells
framed like the portrait (feet on the 0.970 line), placed by the same tip.
The IC-M03e and IC-M03f prompts now describe the painting (the scissor-like
beak blades, the blades as wings, the pink feathers) and ask for the beak's
point to stay where it is in the portrait.


## Matched to the delivered art (scene)

- **Promenade.** The painted paving starts at y 733, so the walkers' feet
  at 800 stand on it. The Park Keeper now stands at y 735 (was 640), on
  the promenade's back edge in front of the painted railing, instead of
  floating over the railing at the pond's edge.
- **Nest.** The painted branch reaches in across the top left; the nest
  (stand-in until `sprites.niffyProps` arrives) now sits on it at (300, 122)
  instead of at the corner under the HUD, and snippings fly there. The
  stand-in branch follows the same line.
- **Sky.** The Niffy hovers at y 230 in the open sky above the trees; no
  change needed.
- **Still stand-in:** the passers-by, the Keeper, the things to snip, the
  nest and the Niffy's flying and swooping poses (IC-M03b–f, requested).

## Matched to the delivered art (walkers, props, Keeper, poses)

- **Where things hang.** `PAINTED_SPOT` gives, for each of the six painted
  walkers, where the feather (back of the hat band), price tag (front of the
  brim), flower (lapel) and loose thread (back of the hem) go, measured on
  the sheet from the middle of each figure's outline and up from its feet.
  The child's balloon string starts at its raised fist and is snipped just
  above it. The stand-in `SPOT` is kept for when the sheet is missing.
- **Spacing.** The painted people are wider than the stand-ins, so people
  walking the same way now keep 420 px apart (was 330). Bots after the
  change: beginner 11–17, careful 15–19, non-stop swooping 1–7, idle 0;
  pass stays 9.
- **Niffy's poses.** The flying, dazed and swooping cells are not framed
  like the portrait (they float in their cells), so each is placed by its
  own measured blade tip (`POSE_TIP`, in 1024 px cells, drawn at the
  portrait's scale): the open blades' point stays on the snipping point,
  and the swoop still pivots there.
- **Keeper.** The three painted Keepers stand 340 tall on the promenade's
  back edge (y 735) in front of the railing, as placed for the scene; the
  red warning sits above his cap.
- **Props and nest.** The painted feather, flower, thread, tag, balloon
  and nest replace the stand-ins in place. "Hey!" is now brick red and
  bolder so it reads against the trees.
- **Still drawn in code:** the balloon string, the hand held over a thing
  when someone is wary, the aim ring, the warning and the pops. No new
  requests.

## Second audit (2026-10-09)

Checked against the delivered art; see the second audit in [`AUDIT.md`](AUDIT.md) for what was changed.

## Changes after playtesting (the swoop, height and being seen)

The user found swoops "only sometimes work" and asked to fly higher and
lower, with low quicker but riskier.

1. **Reliable swoops.** A swoop used to aim within 110 px but then needed
   the blade within 38 px of the thing at arrival, so many ringed swoops
   missed. Now the swoop homes onto the ringed thing and snips it; the ring
   window is 90 px (35 px flying flat out) and is exactly what a press
   would do. With the pointer, the ring and the swoop use the tap's x.
2. **Wariness you can read.** People holding on show a cupped hand over
   their thing, a "!" in a bubble over them and a "Hmph!"; swooping at them
   pops "They're holding on!" instead of a bare "Snap!". It lasts 1.8 s
   (was 2.5 s).
3. **Height.** Up and down on the stick or keys, or the pointer's height,
   move the cruising line between y 150 and y 385; swoop and climb times
   scale with the distance.
4. **Being seen.** The Keeper no longer catches any swoop while he looks;
   his noticing fills a meter by height and by swooping, and only a full
   meter gets the Niffy whistled at and dazed.
5. **Controls and balance.** A "Fly higher / lower" line in the controls and
   new tips. Pass rose from 9 to 10 (the beginner bot's lowest is 13; the
   best mashing run 4). New tests: a ringed swoop on a walking person snips
   it, the stick sets the height and low swoops are quicker, the meter fills
   slowest high and fastest swooping, and being caught costs no points and
   the meter drains.

## Changes after playtesting, round 2 (noticed by movement, relax by climbing)

The user was spotted while keeping still low down, and meant something
else: misses make people hold on, and flying up should reset them sooner;
high up you can move about, low down you must keep still.

1. **Noticed only when moving.** The meter no longer rises from height
   alone: keeping still fills nothing anywhere (and drains slowly); flying
   about fills it by lowness squared (nothing high up, fast low down);
   swooping fills it fast at any height.
2. **Relax by climbing.** People holding on relax three times as fast while
   the Niffy is in the top quarter of its range; their "!" shrinks and
   fades as they relax. A snap at nothing now reaches people within 240 px
   (was 170), and snapping again keeps them holding on longer (up to
   3.6 s), so swooping over and over from one spot doesn't pay.
3. **Text and balance.** New hint ("keep still when he looks"), tips and
   this note. The warning beside the Niffy moves below it near the top of
   the sky, clear of the clock. Pass rose from 10 to 12: over sixteen seeds
   the beginner bot's lowest is 14 and the best degenerate run (mashing
   from one spot, low) 11. New tests: still is safe at any height, moving
   high hardly counts, moving low and swooping are noticed fast; people
   relax three times as fast while the Niffy is high; mashing from one spot
   stays under the pass mark.

