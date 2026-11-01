# The Drippet: Drip Drop Dash (45 s)

The Drippet is a blue water tap on legs that never quite turns off. It runs
about a tiled kitchen floor, dripping as it goes, and every drip spreads into
a puddle. Thirsty things wait on the floor: a drooping fern, the cat's empty
bowl, a glass, a vase of tired daisies. Run to one and stand over it (inside
its dashed ring) for half a second while the tap fills it. A thing left too
long gives up (its little drop-clock runs out) and another appears elsewhere.

A fresh drip is harmless, but a puddle that has sat for about a second is
slippery: run into one and the Drippet skids across the floor for a second,
spinning, and can't be steered. Press the action to hop over a puddle. A hop
is a little slower than running and lands with a splash that leaves a puddle
of its own, and landing in an old puddle still skids, so hopping everywhere
floods the floor rather than saving time. Running fast spreads the drips out
into a dotted trail you can slip between; dawdling makes one big puddle in
front of you.

**Score:** drinks (one per thing filled). The page opens at 13.

**Getting harder:** the tap drips faster (every 0.38 s down to 0.18 s), the
puddles spread wider and last longer (6 s up to 13 s), the thirsty things
lose patience sooner (12 s down to 6.5 s), and after 15 s two are thirsty at
once. The first thing appears at least a short run away on a dry floor, and
a new thing never appears under the Drippet. See "Difficulty over the
round" below.

**Controls:** stick, D-pad, arrows or WASD run in any direction; A, Space or
Enter hops. With a mouse or finger the Drippet runs towards the pointer, and
a click or tap hops. On a narrow screen the view follows the Drippet.

**Bots** (`game/test/drippet.test.mjs`): a beginner runner (shorter
look-ahead, fewer ways round, sometimes forgets to hop) scores 16 to 19 over
six seeds; a good one 20 to 22. Hopping all the way to every thing scores 16
to 19, running straight at each thing without looking 18 to 20, and running
in circles 0 to 1, idling 0.

## Difficulty over the round

The kitchen follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard; hard
is the old end of the round, medium a little gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Seconds between drips (±15%) | 0.38 | 0.29 | 0.18 |
| Puddle size, largest (px) | 32 | 45 | 60 |
| Puddle lasts (s) | 6 | 9.2 | 13 |
| Patience (s) | 12 | 9.5 | 6.5 |

The second thirsty thing still comes a third of the way in (15 s) at every
level. (While re-balancing before, idling once scored a drink when a new
thing was placed as a last resort right under the Drippet; that last resort
goes to the far side of the floor.)

**Pass mark stays at 13.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Mash | Circles | Hop all the way | Never looking | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 0 (0–1) | 0 (0–1) | 18 (16–20) | 20 (18–23) | 13 (12–14) 67% | 19 (18–20) 100% | 22 (20–25) |
| Normal | 0 | 0 (0–2) | 0 (0–1) | 18 (16–20) | 20 (18–21) | 12 (12–13) 33% | 18 (14–21) 100% | 22 (20–24) |
| Harder | 0 | 0 (0–1) | 0 | 17 (16–19) | 19 (16–21) | 11 (9–13) 8% | 17 (15–18) 100% | 20 (18–23) |

The medium runner is the old beginner; the clumsy one is slower, looks only
a little ahead and takes 0.9 s to set off for each thing; the good one
steers round old puddles. Things served are capped by how fast the Drippet
gets round, so Easier lifts a slow runner only a little (67% against 33%),
and hopping all the way or running straight in still pass at every level:
the floor's puddles cost time, not points. `test/drippet.test.mjs` checks
this, the knobs third by third at each level, and the floor, thirsty things
and patience early and late at Normal.

## Images (IC-M16)

- **IC-M16a, the kitchen** (`scene.drippet`): the background; the floor
  below 55% of the height stays empty because everything moves there.
- **IC-M16b, thirsty things** (`sprites.drippetThings`, 4 x 2): the four
  things dry (top row) and refreshed (bottom row); a thing switches to its
  refreshed cell when filled.
- **IC-M16c, puddles** (`sprites.puddles`, 3 x 1): three puddle shapes,
  scaled to each puddle as it spreads and dries.
- **IC-M16d, hopping and skidding** (`sprites.drippetPoses`, 2 x 1): the
  Drippet's two moving poses; standing and running use its portrait.
- **IC-M16e, running and pouring** (`sprites.drippetMore`, 2 x 1): a
  mid-stride pose, shown by turns with the portrait as it runs, and the
  Drippet tipped forward pouring while it fills a thirsty thing.

The Drippet's states: standing (portrait), running (portrait and stride by
turns, bobbing), hopping (IC-M16d), skidding (IC-M16d, spun), pouring
(IC-M16e). Facing right is the same pictures flipped.

## Changes after the audit

1. **Hops cost more.** After landing the Drippet can't hop again for a
   second, and it stumbles at half speed for the first quarter of it.
   Landing in any puddle skids, even a fresh one, and the jolt shakes three
   more drips out around it. Skids also last longer (2.2 s) and send it off
   sideways. Hopping everywhere now scores 7 to 10, below the pass mark.
   Puddles also come faster from the start (a drip every 0.34 s, down to
   0.2 s), because running straight through them used to cost almost
   nothing. The thirsty things take 0.7 s to fill instead of 0.5 s.
2. **Test.** The test asserts that hopping everywhere and running straight
   without looking both stay below the pass mark, over six seeds. It also
   tests the landing skid, the hop rest and the cat's bowl. The runner bots
   now steer round puddles, and only hop when there's no way round.
3. **The cat's bowl moves.** It slides away from slippery puddles near it,
   so dripping round the bowl chases it off. The pass mark is 11: a beginner
   scores 11 to 17. Across ten seeds tried outside the test, one beginner
   seed scored 11 and one hopping seed scored 15, so there is some overlap.

## Matched to the painting

The painting (`assets/subjects/drippet.png`) is a rusty blue tap whose spout
is a long beak with a brass mouth, set lower and further forward than the
stand-in's spout. Once the painting has loaded the game uses the measured
spout mouth (163 units forward, 229 up), so drips fall from the painted
spout. The bird is drawn at 250 instead of 300, because the painting stands
taller than the stand-in. The pose sprites are drawn at 0.9 of that size.
IC-M16d and IC-M16e now describe the painting's design (cross handle, brass
collar, grey-blue wing, pink tail, ochre legs).

## Matched to the delivered art

- **Scene (IC-M16a, delivered):** the painted kitchen's tiled floor begins
  just below the skirting board, at about 540 of 900. The Drippet's feet and
  the thirsty things now keep below 560 (it was 500), so nothing stands on
  the skirting or the cupboards. The opening hint moved down onto the floor.
  With the smaller floor the puddles crowd more, so I re-tuned: over ten
  seeds a beginner scores 14 to 19 and a good runner 16 to 26. Hopping
  everywhere scores 6 to 12, never looking 9 to 11 (four seeds), and the
  pass mark is 13.
- **Still stand-ins:** the thirsty things (IC-M16b), the puddles (IC-M16c)
  and the poses (IC-M16d, IC-M16e). They are still requested, with no change.
- **Sprites (delivered):** the thirsty things (IC-M16b), the puddles
  (IC-M16c), the hop and skid poses (IC-M16d) and the run and pour poses
  (IC-M16e). No stand-in drawing is left for any of them.
  - *Things.* Each is drawn as a whole 512 px cell, 222 px tall at depth
    scale 1, with its painted base (about 52 px above the cell's foot) on
    the floor, so the bowl stays small beside the fern. While filling, the
    watered picture fades in over the dry one.
  - *Puddles.* Each is fitted to its oval (2r wide by about r tall, slightly
    taller than painted, to match where it is slippery). A fresh puddle is
    faint and an old, slippery one full strength.
  - *Poses.* They are painted a little smaller in their cells than the
    portrait, so they are scaled up by the measured width of the cross
    handle (361 px hopping and skidding, 399 px running and pouring, 445 px
    in the portrait). Each stands on its lowest painted point; running
    alternates the stride with the portrait.
  - *Pouring.* The pose paints its own stream, so the game stops dropping
    code drips while it pours.
- The opening hint moved to the foot of the floor, with a paper-coloured
  outline so it reads over the tiles.
- **Still drawn in code (game information, not stand-ins):** the dashed
  ring under each thirsty thing with its fill arc, the little drop-clock of
  its patience, the falling drips and splash dots, and the pops.

## Second audit (2026-10-09)

Checked against the delivered art; see the second audit in [`AUDIT.md`](AUDIT.md) for what was changed.

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).

### Sliding instead of stun
Water preserves incoming velocity, with slow steering and braking while sliding.
The action still hops, and the tap still fills things it passes over. Puddles
last 6.5–12 seconds instead of 5–9.5. The existing IC-M16d skid pose already
shows a foot slipping forward; reuse it with a small wobble, without the
previous exaggerated spinning. No additional sprite is needed.
