# The Saw Bird: Saw It Straight (50 s)

A long plank lies across two sawhorses with a blue chalk line along it, and
the Saw Bird (a carpenter's handsaw) cuts along the line from the right-hand
end to the left. It plays as two hands at once: one pushes and pulls the saw,
the other keeps it on the line.

**Strokes.** The stick's left-right position is the saw's place in its
stroke (arrows: hold ← then →; mouse or finger: drag back and forth). Each
stroke only bites once it has travelled about a third of the way, so short
jiggles and button-mash flicking barely cut, and long full strokes do. Long
strokes in a row build a rhythm (the five orange dots under the gauge) that
makes each stroke bite up to half as much again; stopping or a short stroke
loses it. The saw has a top speed, so there is nothing to gain by thrashing.

**Steering.** The cut heads the way the saw is tipped: stick or arrows up
and down (with a pointer, point above or below the cut). The grain pulls each
plank's cut steadily to one side, and knots (from the second plank) give it
a sudden shove and slow the saw, so the cut keeps needing small corrections.
The dark cut line is drawn over the chalk line, so you can see every wobble.

**Scoring.** When the cut reaches the end the plank falls in two and is
marked by how far, on average, the cut strayed from the chalk: dead straight
(within 6 px) 10 points, straight (14 px) 7, a bit crooked (26 px) 4,
crooked 1. The page opens at 30 points.

**Getting harder:** planks grow from about 600 px to 1050 px long, the grain
pulls up to three times as hard, and no knot, then one, two and three sit on
the line. The first plank is short with a gentle grain and no knot. See
"Difficulty over the round" below.

**Controls:** stick or arrows/WASD (left-right to saw, up-down to steer);
mouse or touch: drag left and right, and point where the cut should go. On a
narrow screen the view follows the cut.

**Bots** (`game/test/sawbird.test.mjs`): a beginner sawyer (shorter
strokes, pauses, sees knots late, a shaky and slow steering hand) scores 44
to 51 over six seeds; holding A to push, the same beginner scores 46 to 51;
a good sawyer 67 to 80. Full strokes that never steer score 13 to 16,
fast jiggling 4, mashing A 0, and idling 0.

## Difficulty over the round

Each new plank follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard; hard
is the old end of the round, medium a little gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Length (px, ±15%) | 600 | 810 | 1050 |
| Grain pull (×0.7–1.3) | 0.05 | 0.10 | 0.16 |
| Knots on the line (+ up to 0.6, rounded down, 3 at most) | 0.7 | 1.9 | 3.3 |

The first plank never has a knot. Easier's planks stay under about 750 px
with at most two knots; Harder opens on 790 px planks with one or two.

**Pass mark stays at 30.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Jiggle | Unsteered | Mash A | Clumsy | Medium | Medium holding A | Good |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 4 | 19 (14–23) | 0 | 36 (31–41) 100% | 56 (48–70) 100% | 64 (58–68) 100% | 86 (80–90) |
| Normal | 0 | 4 | 14 (10–16) | 0 | 29 (22–38) 42% | 52 (47–57) 100% | 58 (51–64) 100% | 79 (70–80) |
| Harder | 0 | 1 | 6 (6–7) | 0 | 21 (18–31) 8% | 37 (31–41) 100% | 43 (35–51) 100% | 69 (60–70) |

The medium sawyer is the old beginner (skill 0.3); the clumsy one is the
same bot a step further down (skill −0.1: shorter strokes, longer pauses,
sees knots later, a shakier hand), and its mistakes grow with the grain's
pull and the knots. `test/sawbird.test.mjs` checks all of this, the knobs
third by third at each level, and the planks early and late at Normal.

## Images (IC-M17)

- **IC-M17a, the carpenter's yard** (`scene.sawbird`): the background; the
  middle of the yard stays plain for the sawhorses and the plank.
- **IC-M17b, planks** (`sprites.planks`, 1 x 3): pine, oak and cedar,
  stretched to each plank's length; the chalk line, knots and the cut are
  drawn over them, and the two halves are cut apart along the cut.
- **IC-M17c, sawhorse** (`sprites.sawhorse`): used twice under the plank.
- **IC-M17d, the Saw Bird sawing** (`sprites.sawbirdSawing`): blade level,
  teeth down and legs tucked, so its teeth sit in the cut; it slides back and
  forth and tips a little as it steers.
- **IC-M17e, snagged and proud** (`sprites.sawbirdPoses`, 2 x 1): the
  bowed blade shown for a moment when the saw hits a knot or a cut comes out
  crooked, and the Saw Bird standing proud beside the plank after a
  straight or dead-straight cut, while the next plank slides in.

The Saw Bird's states: sawing (IC-M17d, slid back and forth and tipped to
steer), between planks (the sawing pose, lifted), snagged (IC-M17e, shaken),
proud (IC-M17e, hopping). The page uses the portrait.

## Changes after the audit

1. **A controller no longer needs a diagonal waggle.** Hold the action to
   push the saw and let go to pull it back (Space too), so the stick only
   steers. Stick strokes still work. Pressing A quickly gives short strokes,
   which barely cut. The on-screen hint and the page's controls say so for
   each device.
2. **Steering of its own: knots to go round.** Knots no longer shove the
   cut. They sit on the chalk line as obstacles, from none on the first
   plank to one, two, then two or three. Sawing into one nearly stalls the
   saw ("Knot! Steer round"). Going round costs nothing, because the
   stretch of cut near a knot isn't counted in the grade, so the choice is
   to swerve out and back, or grind slowly through. The grades are tighter
   (within 4, 10, 20 px) and the grain pulls a little harder.
3. **Seeds now vary.** Knot positions, sizes and counts, and plank lengths
   (±15%), now change from seed to seed, so the bots' scores vary. The tests
   use six seeds and assert the holding-A beginner too.

## Matched to the painting

The painting (`assets/subjects/sawbird.png`) carries the whole handsaw as its
head, held out to the left with its tip a little up: the teeth run from
(-185, -264) to (36, -218) in drawBird units, about 0.2 rad off level, with
the feathered body and legs below the handle. While sawing, the game turns
the painting so its teeth lie level on the cut, with the tip leading. It
hides everything below the teeth (body and legs), as if sunk in the cut,
until the sawing pose (IC-M17d) arrives. The proud pose falls back to the
full painting standing beside the plank. IC-M17d and IC-M17e are rewritten
for the painting's design: the saw is its head, so the sawing pose has the
whole bird crouched forward and down with its saw-head level and nothing
below the teeth, and the proud pose tips the saw-head up like a salute.

## Matched to the delivered art

- **Scene (IC-M17a, delivered):** the painted yard leaves the middle open as
  asked: the workshop wall, the logs and the wheelbarrow stay clear of the
  plank (x 300 to 1300) and of the sawhorses. The proud pose's standing spot
  moved in a little (x 1370), off the painted plants and rocks in the
  bottom-right corner. Nothing else needed moving.
- **Still stand-ins:** the planks (IC-M17b), the sawhorse (IC-M17c) and the
  poses (IC-M17d, IC-M17e). They are still requested, with no change.
- **Sprites (delivered):** the planks (IC-M17b), the sawhorse (IC-M17c), the
  sawing pose (IC-M17d) and the snag and proud poses (IC-M17e). No stand-in
  drawing is left for any of them.
  - *Sawing pose.* It is drawn from measurements: in its 1024 px picture
    the blade's tip is at x 11, the teeth run along y 845 and the blade is
    about 590 px long. It is drawn with the blade about 195 px long, tip
    leading and teeth on the cut, tipped to steer.
  - *Snag pose.* The bowed blade (tip x 104, teeth about y 830, blade about
    455 px) is drawn at the same blade length in the same place.
  - *Proud pose.* It stands 250 px tall beside the plank.
  - *Sawhorses.* There are two, 200 px tall, at x 640 and 960, their beams
    tucked under the plank's near edge.
  - *Planks.* Each painted plank is stretched to the plank's length, and
    splits along the cut as before.
- **New request IC-M17f, knots** (`sprites.knots`, 3 x 1): the knots on the
  line are still ink ovals drawn in code over the painted planks. The game
  already draws the painted knot once it arrives, sized to the knot plus its
  ring of grain.
- **Still drawn in code (game information):** the chalk line, the cut, the
  stroke gauge and rhythm dots, the sawdust and the pops.

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).
