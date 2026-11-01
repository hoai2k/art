### The Broomwhisk: Clean Sweep (45 s)

Leaves drop from the fig tree into a paved courtyard and dust collects on
the flagstones. Steer the Broomwhisk around the floor (up and down is into
and out of the picture). Whatever its bristles touch is pushed along with
the broom's own speed and slides on after it, slowing as it goes, so
sweeping is a push with momentum: get behind a leaf and sweep it towards
the dustpan, whose mouth has a dotted pink ring in front of it. Press the
action to flick the bristles: everything just in front of the broom skids
off in the way it is moving. The mechanic is pushing loose things with
momentum, like a puck, rather than catching or steering a path.

**Scoring.** One per leaf or dust ball in the pan, three for a golden
leaf (about one in eleven). Only what the broom has touched in the last
three seconds goes in; anything else, blown or drifting, bumps off the
pan's lip, so a gust never scores for you.

**Difficulty over the round.** The shared curve (`g.d()`, see
`../difficulty.md`; 2026-10-12): 0 easy, 0.5 medium, 1 hard; Normal is
medium by two-thirds of the round and ends at 0.85. Each knob is easy /
medium / hard (hard about the old end of the round, medium a little gentler
than the old middle):

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Seconds between falling leaves | 2.0 | 1.7 | 1.0 |
| Seconds between gusts (plus up to 2) | 14 | 12 | 7 |
| Gust strength (times the old push) | 0.7 | 0.86 | 1.25 |
| Gust warning (s) | 1.6 | 1.42 | 1.0 |
| Half the pan's mouth (floor units) | 120 | 114 | 100 |

No wind for the first 13 s. Gusts, warned ahead by the tree's leaves
shivering and a "Gust!" arrow, blow everything loose across the floor for
1.5 s; they leave swept things alone. At most 18 things lie on the floor.
The dustpan moves to another wall (left, right or back) after every eight
sweepings.

**Controls.** Controller: left stick or D-pad sweeps, A flicks. Keyboard:
arrows or WASD sweep, Space flicks. Mouse or touch: the broom follows the
pointer, so a quick swipe pushes hard; click or tap to flick. On a narrow
screen the view follows the broom, 1000 wide.

**Pass.** 15 points (unchanged). Sweeping is physical, so runs vary. Bots
over seeds 1–12, mean [range] share passing: medium is the old beginner
(two-thirds speed, slower to line up, no flicks); clumsy goes at a quarter
speed and lines up loosely; good is full speed without flicks, flicker
with them. Flail runs about at random flicking, wander loops smoothly,
zigzag sweeps back and forth.

| Level | Idle | Flail | Zigzag | Wander | Clumsy | Medium | Good | Flicker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 3 [0–9] | 4 [1–6] | 8 [2–14] | 13 [7–18] 25% | 22 [18–26] 100% | 24 [18–32] | 24 [19–34] |
| Normal | 0 | 3 [0–10] | 3 [1–6] | 6 [1–12] | 13 [8–19] 25% | 21 [15–26] 100% | 24 [20–31] | 24 [19–31] |
| Harder | 0 | 5 [0–13] | 3 [1–6] | 8 [3–12] | 12 [7–18] 17% | 20 [16–26] 100% | 25 [20–31] | 28 [20–37] |

The levels hardly move the scores here. What holds a sweeper back is its
own speed about the floor; gusts leave swept things alone and the funnel
forgives near misses, so Easier's softer gusts and wider pan barely help,
and its fewer leaves lower the ceiling. Easier does not let the clumsy
sweeper pass more than Normal does (the guide asks for it to); a stronger
Easier would need a change to how the game scores, not a light retune.

**Images.** IC-M06a is the courtyard, its floor of flagstones kept
completely clear. IC-M06b is four leaves, a dust ball, a feather, a golden
leaf and a sweet wrapper: about one leaf in ten falls as a feather and one
in twelve blows in as a wrapper, for variety. IC-M06c is the dustpan from the side and from the front, for the
side walls and the back wall. IC-M06d is the Broomwhisk mid-sweep and
flicking.
IC-M06e is the Broomwhisk pushing into or out of the picture with its
bristles splayed, braced against a gust (mirrored to face the wind), and
pleased when something lands in the pan.

## Changes after the audit

1. **Where things will slide, and what counts.** While the broom moves, a
   dotted pink line runs ahead of it in the direction pushed things will go.
   Anything swept has a pink glow under it for as long as it counts (3 s).
2. **Wider mouth and a funnel.** The pan takes things within 110 floor units
   of its middle (was 84), and a swept thing sliding within 130 of the mouth
   is drawn in, so a near miss still lands.
3. **Gentler wind.** Gusts come every 12 s at first and every 8 s by the
   end (was 9 and 5), blow about a third less hard, and never move a swept
   thing, so the wind can't undo a good sweep.
4. **Stand-ins read better.** Dust balls are darker with dark ink, and
   leaves are fatter (about half as wide again).
5. **The pan on a phone.** The view now follows the point between the broom
   and the pan (or as far towards the pan as keeps the broom in view), and
   when the pan is more than 420 px to the side a pink "pan" arrow beside the
   broom points to it.
6. **Re-tuned.** Variance is down and both bots score higher: beginners
   16–23 over ten seeds, good sweepers 22–32. The pass mark goes up to 15,
   with every beginner seed above it. A new bot that wanders in smooth loops
   (like the audit's random run) scores 4–9 and is asserted below it,
   alongside flailing, zigzagging and idling. A new test covers the funnel
   and the gusts sparing swept things.

No new art is needed: the arrow, line and glow are drawn by the game over
any art.

## Matched to the painting

The painting is the same size and stance as the stand-in (feet on the
floor point, about 400 units tall), so the push circle, shadow, lean and
flips needed no change; the pose sheets are now drawn at its full height.
In the painting the straw hangs like a skirt above its legs rather than
reaching the floor, so IC-M06d and IC-M06e now describe the painting (a
broomstick neck, bound straw body, crest and slate-blue beak) and ask for
the straw to brush the floor in the sweeping poses.

## Matched to the delivered art

The courtyard scene (IC-M06a) fits the game as built: the wall meets the
flagstones at y 470, where the floor's back edge already was, the fig tree
overhangs the top left where the leaves fall from, and the floor is clear.
Nothing changed. The leaves, dust, dustpan and the Broomwhisk's poses
(IC-M06b to e) are still drawn in code or from the portrait until they
arrive.

The leaves and dust, the dustpan and both pose sheets (IC-M06b to e)
arrived next. Leaves, feathers, wrappers and dust are drawn 84 wide at
the front of the floor, smaller further back. The painted dustpan is placed
by its mouth: from the side, the scoop's tip sits just past the pan's
point (mirrored for the right wall); from the front, the bottom of the
mouth sits on it, so the game's mouth and funnel line up with the painted
opening, and the dotted ring stays in front of it. The poses were painted
at about 0.79 of the portrait's size, so they are drawn 1.27 times larger,
each with its own feet (measured per cell) on the floor point and mirrored
when it faces right.

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).

The Broomwhisk pose sheets (IC-M06d, e) have a portrait-sized head on a smaller broom; a re-request is in the third audit in [`AUDIT.md`](AUDIT.md).
