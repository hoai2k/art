### The Cutitup Snippit: Snip the String (45 s)

A bunch of balloons and kites is tied along the top rail of the fence at
the edge of the fair, and the wind has crossed their strings. A tag under
the clock shows the one to let go, and that balloon wobbles inside a dotted
pink ring. Follow its string down with your eye to the knot where it is
tied, walk the Snippit there, and snip. All the strings are drawn alike, so
the only way to know is to trace them; the string under the blades glints
pink for its first stretch above the knot, a hint without giving the answer
away. The mechanic is tracing a tangle, the activity-book puzzle, against
the clock.

**Scoring.** The right string lets that balloon float off: 10 points, and 5
more if it took less than three seconds. A wrong string loses a balloon
nobody asked for, costs 5 points (never below zero) and jams the blades
for 0.8 s; the same balloon is still wanted. A snip away from every knot
does nothing. Each snipped balloon is replaced by a new one dropping into
the bunch in a colour not already there.

**Difficulty over the round.** The shared curve (`g.d()`, see
`../difficulty.md`; 2026-10-12): 0 easy, 0.5 medium, 1 hard; Normal is
medium by two-thirds of the round and ends at 0.85. Each knob is easy /
medium / hard (hard about the old end of the round, medium a little gentler
than the old middle):

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Balloons in the bunch (rounded) | 3 | 4.6 | 6 |
| How far a string may curl (px) | 25 | 76 | 195 |
| Seconds between wind swaps | none | 5 | 2.4 |

At Normal: three balloons at first, four from about 11 s, five from about
21 s; six only at Harder (from about 37 s). The wind jostles the bunch from
d 0.45 (about 25 s in at Normal, from the start at Harder, never at
Easier): two neighbours drift past each other, re-crossing their strings
while you look.

**Controls.** Controller: left stick or D-pad walks and turns, A snips. Keyboard:
arrows or A/D walk, Space snips. Mouse or touch: the Snippit follows the
pointer; a click or tap snips at the knot under it straight away. On a
narrow screen the view keeps the whole tangle (1000 wide) in sight.

**Pass.** 120 points (unchanged). Bots over seeds 1–12, mean [range] share
passing: medium is the old beginner (slow to look, one string in eight
wrong); clumsy is a little slower and loses the string more often the
bigger and curlier the tangle (1 − 0.06 per balloon over two − curl/800 of
the time right); good is quick and sure. Mash walks up and down snipping
all the time; camp stands still and snips.

| Level | Idle | Mash | Camp | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 27 [0–65] | 0 | 150 [60–235] 67% | 191 [110–275] 92% | 559 [400–735] |
| Normal | 0 | 17 [0–55] | 1 [0–10] | 125 [70–190] 42% | 190 [150–250] 100% | 593 [475–720] |
| Harder | 0 | 13 [0–65] | 2 [0–20] | 90 [15–140] 17% | 185 [140–225] 100% | 636 [585–675] |

A wrong string costs a balloon and a moment, so a clumsy round swings a
lot: Easier lets it pass two rounds in three, not the guide's three in
four, and Normal a little under half.

**Images.** IC-M04a is the fairground fence behind it all, with the top
rail kept plain for the knots and the sky kept empty for the bunch. IC-M04b
is the six balloons and six kites in the six colours, drawn without
strings (the game draws the strings from the knot or the kite's tail).
IC-M04c is the Snippit with its blades open and snapped shut, for walking
and snipping.
IC-M04d is the Snippit mid-stride, jammed after a wrong snip, and looking up
at a balloon it let go; standing still it uses IC-M04c's open blades.

## Changes after the audit

1. **Snip point marked.** A small pink notch is drawn just above the knots,
   under the hinge, and turns magenta when a knot is in reach, so a child
   aims the notch rather than the blade tips.
2. **Phone span 1000.** The knots and the bunch now spread from x 400 to
   1200 instead of 330 to 1270, so the whole tangle fits a 1000-wide view
   and the strings stay thick enough to trace.
3. **Wrong string costs 5, not 10.** The 0.8 s jam already stings. Mashing
   still stays far below the pass mark (0–35 against 120). The pass mark
   stays at 120: a beginner now scores 155–180.

## Matched to the painting

The snip point is the painting's eye, at the hinge where its blades cross
(322 units above its feet, 25 to the left), held just above the knots: the
Snippit is sized from that (about 246 px tall, feet at the bottom edge),
and the stand-in keeps its own hinge until the painting loads. The pink
notch now sits on the rail pointing up at the eye instead of covering it;
the closing-blade strokes and "Jammed!" sit on the blades and above the
head. The pose sheets are drawn at the painting's framing. IC-M04c and
IC-M04d now describe the painting (pink scissors, grey blades pointing up
and to the left, eye at the hinge, finger loops as head and body, pink tail).

## Matched to the delivered art

The fairground scene (IC-M04a) puts the fence's top rail higher than the
stand-in did: its top edge is at y 674 (measured on the painting), so the
knots, the notch and the strings now tie on there (was 706), and the
Snippit is sized from it, its eye just above the rail (about 286 px tall).
The balloons, kites and the Snippit's poses (IC-M04b to d) are still
drawn in code or from the portrait until their sheets arrive.

The balloon and kite sheet (IC-M04b) and both pose sheets (IC-M04c, d)
arrived next. Each string now ties on where the painting puts it: a
balloon's knot, or a kite's bottom point just above its bowed tail, measured
per cell (the sheet's pictures are not centred in their cells). Each pose is
drawn with its painted eye on the snip point and its claws on the ground,
from the eye and claw positions measured in each cell, and the shake on
jamming turns about the eye. The jammed pose came out milder than asked
(blades half open rather than twisted), so the shake stays. The portrait's
eye was re-measured too: 321 units up and 29 to the left of its feet.
Nothing of the Snippit's game is drawn in code now apart from the strings,
knots, notch, tag and pops.

## Second audit (2026-10-09)

Checked against the delivered art; see the second audit in [`AUDIT.md`](AUDIT.md) for what was changed.

## Cutting toward the tip (2026-10-09)

The blades now cut out toward their tip rather than at the hinge: the aim
point is 104 px left of the eye (the painted point is 112 to 132 px out), and
a knot anywhere along the open blades, from 34 px beyond the tip back to the
hinge, can be cut. When a bunch of knots sit between the blades, the one
nearest the tip is the one cut. The dotted line and the pink notch on the rail
mark the tip, and with the mouse or a finger it's the tip that follows the
pointer.

## Facing both ways (2026-10-09)

The Snippit now turns around. Pushing left or right turns it to face that
way at once, so a knot just behind it is a tap away rather than a walk to the
far side. The paintings face left; facing right, every pose is mirrored about
the eye, which stays on the snip point, so the hinge never moves and the
sprite keeps its size. The flip is drawn as a quick turn (0.12 s, through a
narrow edge-on Snippit; instant with reduced motion). The cutting rule is
mirrored: the tip is 104 px out from the eye on the side it faces, a knot from
34 px beyond the tip back to the hinge is caught, and the one nearest the tip
is cut. The dotted aim line, the pink notch, the pink glint and the shut-blade
strokes all follow. With the mouse or a finger the tip still follows the
pointer, and a pointer behind the eye turns the Snippit to face it. The test
snipper now turns to face its knot rather than walking past it: beginner
160–210, good 490–645, mashing 5–30, standing still 0, idle 0 (pass 120).

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).

**Gentle push or full push.** A gentle push of the stick walks the Snippit
either way without turning it, so it can back up to a knot behind it. Pushing
all the way (85% of the stick's travel, or the D-pad or an arrow key) turns it
to face that way. The pointer still turns it to face a finger behind its eye.
