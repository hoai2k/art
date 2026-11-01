### The Buttonbeaks: Button Up (45 s)

Coats, cardigans and waistcoats travel right to left along the washing
line, and each has empty buttonholes. Every hole shows, on a pale patch,
a ghost of the button it is missing: its colour, its shape (round, square
or flower) and its two or four thread holes. The two Buttonbeaks stand
behind an open button tin with a bowl for each kind of button. Walk them to
the right bowl and press to pick one up; walk under the coat and press
again to toss it up. A toss that reaches a coat sews itself into an empty
hole of its kind on that coat. The mechanic is fetch and deliver: read what
is wanted, fetch it, and get under a moving target with it.

**Scoring.** One per button sewn on. A button that matches nothing on the
coat it hits bounces off and the Buttonbeaks are dizzy for a second. B lets go of a held button: it drops into the grass, with no daze and
nothing counted. A toss with no coat above also flies away harmlessly (the
way to get rid of a wrong pick on the keyboard, or by touch). A coat that leaves with open holes simply goes; the results
count the coats buttoned all the way.

**Difficulty over the round.** The shared curve (`g.d()`, see
`../difficulty.md`; 2026-10-12): 0 easy, 0.5 medium, 1 hard; Normal is
medium by two-thirds of the round and ends at 0.85. Each knob is easy /
medium / hard (hard about the old end of the round, medium a little gentler
than the old middle):

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Line speed (px/s) | 75 | 98 | 150 |
| Line between coats (px, plus up to 80) | 330 | 297 | 220 |
| Holes on a coat, on average | 1 | 1.45 | 2.7 |
| Bowls | 4 | 6 from d 0.36 | 6 |

Holes: the whole part of the average, plus one more with the chance of
its fraction, so one hole at first, one or two at medium, two or three
(mostly three) at hard. The two bowls of look-alikes (a pink square with
two holes beside the pink round with four, a blue flower beside the blue
round) join at d 0.36: about 19 s in at Normal, from the start at Harder,
never at Easier.

**Controls.** Controller: left stick or D-pad walks, A picks up or tosses,
B discards the held button (`input.bPressed`, the controller's fresh B
press; no keyboard key stands in for it). Keyboard: arrows or A/D walk,
Space picks up or tosses. Mouse or touch:
they follow the pointer; tap a bowl to pick from it, tap up by the coats
to toss from there. On a narrow screen the view follows them, 1000 wide.

**Pass.** 10 buttons (unchanged). Bots over seeds 1–12, mean [range]
share passing: medium is the old beginner (slower, a moment to look, now
and then a look-alike by mistake); clumsy is slower still, looks longer and
picks look-alikes more; good is quick and sure. Mash walks up and down
pressing all the time.

| Level | Idle | Mash | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- |
| Easier | 0 | 3 [0–6] | 10 [8–12] 83% | 12 [11–13] 100% | 12 [11–14] |
| Normal | 0 | 4 [3–6] | 9 [7–12] 42% | 13 [12–16] 100% | 16 [15–18] |
| Harder | 0 | 6 [3–10] 8% | 7 [4–10] 8% | 12 [11–15] 100% | 29 [27–31] |

(Since 2026-10-14 the tailors stand the tall bird's beak over the bowl and
let go of an unwanted button with B; see below. Before that: Easier 3 /
10 83% / 12 / 12, Normal 4 / 9 33% / 13 / 16, Harder 6 8% / 7 8% / 13 /
28, the same within a point.)

At Harder (six bowls from the start and three-hole coats at the end) a
lucky masher reaches the mark now and then (2 of 40 seeds); it never does
at Normal or Easier, so the mark stays.

**Images.** IC-M05a is the garden with the two clothes posts and the
front of the tin; the line itself is drawn by the game so the coats hang
on it. IC-M05b is the six buttons in the game's order. IC-M05c is four
garments with a plain, buttonless placket down the exact middle, where the
game puts the holes and buttons. IC-M05d is one bowl, drawn for each kind.
IC-M05e is the pair holding something up between their beaks and tossing
it.
IC-M05f is the pair mid-stride, pecking into a bowl, dazed after a wrong
button and hopping for joy when one is sewn on.

## Changes after the audit

1. **Pass lowered to 10** (from 12), so a beginner (12–14 with the bots)
   clears it within a try or two. Mashing scores 4–5.
2. **Matching holes pulse.** While the Buttonbeaks hold a button, every open
   hole on the line that it fits gets a pulsing pink ring, so the child sees
   where to run. The tips say so.

Not changed: the shared "things pass by" shape (the audit's point 3 across
all games). Button Up already differs by being fetch-and-deliver (two
trips, reading a button's colour, shape and holes) rather than timing one
press; its place in the guide order is for the lead to keep apart from
Snip Snap and Just a Pinch. There were no point penalties to drop.

## Matched to the painting

The painted pair stands taller than the stand-in (362 units against 230),
so the held button now sits between their two heads, above the pink one's
beak and clear of the yellow one's eye, with a thread to each beak; tosses,
the aim line and the dizzy stars start from there, and the pose sheets are
drawn at the painting's height. IC-M05e and IC-M05f now describe the
painting (the taller yellow-headed bird on the left, the smaller pink one
on the right, bodies of overlapping buttons).

## Matched to the delivered art

The washing line now hangs from the hooks painted on the two posts in the
garden scene (IC-M05a): from (98, 116) to (1502, 116), sagging 26 in the
middle, instead of running edge to edge lower down. The bowls sit in the
painted open tin, their rims just behind its rim (y 756), and the
Buttonbeaks stand on the lawn just behind it (feet at y 748), so the held
button and their tosses start higher too. A touch below y 712 counts as a
tap on the bowls. The coats, buttons, bowls and the pair's poses (IC-M05b
to f) are still drawn in code or from the portrait until they arrive.

The buttons, coats, bowl and both pose sheets (IC-M05b to f) arrived next.
Each painted coat hangs with its shoulders just under the pegs and its
plain centre strip on the line of buttonholes (strip and shoulders measured
per coat; the holes moved up a little, to 80, 155 and 228 below the line,
so the lowest stays above every hem). Each bowl is drawn 150 wide, set in
the tin with its heap of buttons inside its rim. The poses are drawn at a
fixed scale per sheet (the pose sheet was painted smaller than the
portrait) with their claws on the lawn line and the pair's feet centred
where the portrait's are, so nothing jumps between poses; the pecking pose
is short, as painted, rather than stretched. While they hold a button they
show the holding pose, and the button sits just above their touching beak
tips, so the code-drawn thread is gone; tosses start from there. During
the quick peck the button isn't shown until it's picked up.

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).

## B discards; the tall bird's beak picks (2026-10-14)

The user asked for B to discard the held button, and for a button under
the taller bird's beak to be picked up: he is the dominant one.

- **B discards.** Before, the only way to get rid of a button was to toss
  it where no coat was overhead. Now B (a fresh press, `input.bPressed`)
  drops it into the grass with a soft sound and a grey "Dropped": no daze,
  not counted as wrong (`g.dropped` counts them). It works while dazed
  too. The keyboard and touch keep the old toss-it-clear way; input.js
  gives B no keyboard key.
- **The tall beak picks first.** Before, they picked from the bowl within
  80 px of the pair's middle, which is under the pink one's beak (its tip
  is about 7 px left of the middle in the portrait). The tall
  yellow-headed bird's beak tip is about 133 px left of the middle, so
  with it right over a bowl the pink one's beak was often over the next
  one, and that next bowl was picked. Now the bowl under the tall beak's
  tip (within the bowl's drawn half-width, 75 px) is picked; only if
  there is none does the old reach round the middle count. The dashed
  ring on the bowl shows which one a press takes. Tapping a bowl still
  picks the bowl tapped.
- **Measured, not guessed.** The tip is the leftmost opaque pixel of the
  yellow beak (the top one of a tie) on the delivered pictures: (50, 192)
  in the portrait, (112, 287) striding, (174, 186) cheering. On screen
  that is (-133, -222), (-136, -213) and (-134, -257) from the pair's feet
  point, so whichever pose shows, the tip is within 3 px of the same x;
  the pick uses the standing one. A test re-reads the PNGs' alpha and
  checks these, and checks a tip 1 px inside a bowl's rim picks it and
  1 px outside doesn't.
- **Balance.** The bots now aim the tall beak (`g.pickX(i)`) and discard
  with B. Scores moved by a point at most (table above); the pass stays
  10.

