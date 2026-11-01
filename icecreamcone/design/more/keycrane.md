### The Key Crane: Lucky Dip (45 s)

An old penny-arcade crane cabinet full of lost-property trinkets: a
lantern, a birdcage, a handbag, a basket, a bell, a kettle, an alarm clock,
each with a wire ring on top. The Key Crane hangs on a string from a
trolley on the brass rail, and its claws are the hook. Move the trolley
left and right, then drop: the Crane goes straight down, and its claws
close at the bottom. If they close on a ring, the prize comes up with it;
carry it over the chute at the left and it drops in (or drop it there
yourself). The mechanic is a claw crane on a pendulum: moving the trolley
sets the Crane swinging, and the swing carries on while it is lowered, so
you stop over a ring, let it settle (or time the swing), and then drop. A
faint dotted line from the claws shows where they are over the pile.

**Scoring.** One per prize in the chute; a golden pocket watch counts as
three. Claws that close on the top of a prize, or on nothing, come up
empty. Carrying, a swing past about 24° (a jerk of the stick back and
forth) makes the prize slip off and fall back onto the pile, or, if it was
nearly there, into the chute. A new prize tumbles in from above for each
one taken, so the pile always has six or so.

**Difficulty over the round.** The shared curve (`g.d()`, see
`../difficulty.md`; 2026-10-12): 0 easy, 0.5 medium, 1 hard; Normal is
medium by two-thirds of the round and ends at 0.85. Each knob is easy /
medium / hard (hard about the old end of the round, medium a little gentler
than the old middle):

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Ring radius for new prizes (px, ±10%) | 34 | 29 | 18 |
| Swing damping (per s) | 3.2 | 3.05 | 2.7 |
| A carried prize slips past (rad) | 0.47 | 0.44 | 0.37 |

Golden watches, with rings a fifth smaller still, turn up after 8 s. The
trolley is slower with a prize in the claws.

**Controls.** Controller: left stick or D-pad moves the trolley, A drops
(and lets go). Keyboard: arrows or A/D, Space. Mouse or touch: the trolley
follows the pointer; the Crane drops when you let go of the click or touch,
so a finger can drag to aim first. On a narrow screen the view follows the
trolley, and while a prize is carried it widens smoothly to keep the chute
in sight too.

**Pass.** 5 prizes (unchanged). Bots over seeds 1–12, mean [range] share
passing: medium is the old beginner (60% stick, waits until the swing is
small); clumsy pushes the stick 30% and stops up to 50 px to one side of
the ring, picked afresh for each try; good goes full speed, drops while it
is still swinging a little and goes for golden watches. Mash wanders
dropping all the time.

| Level | Idle | Mash | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- |
| Easier | 0 | 0 | 5 [3–7] 83% | 8 [7–9] 100% | 10 [8–11] |
| Normal | 0 | 0 | 5 [4–7] 83% | 8 [7–9] 100% | 9 [8–10] |
| Harder | 0 | 0 | 5 [3–7] 58% | 7 [7–9] 100% | 9 [7–10] |

The winch sets the pace (each try takes a few seconds whatever the level)
and five prizes is a low bar, so even the clumsy operator mostly passes at
Normal: the guide wants it to pass seldom there. Only a misser or the
masher, which never hooks a ring, fails. The levels change the score less
here than in most games.

**Images.** IC-M07a is the inside of the cabinet: the brass rail, the
wallpaper, the velvet floor and the chute, with the space between kept
empty for the crane and the pile. IC-M07b is the eight trinkets, painted
without rings (the game draws each ring at its true size, since the rings
shrink). IC-M07c is the Key Crane hanging from its shaft with its claws
open and shut, to swing on the string in place of the standing portrait.
IC-M07d is the same hanging Crane startled, legs kicked apart, shown for a
moment when a prize slips or the claws close on nothing.

## Changes after the audit

1. Rings now shrink only to about 40 px across (`lerp(32, 20)`), and the
   pass mark is 5 rather than 6, so one slip no longer decides the page.
   Beginners score 7–9 on seeds 1–8; good 8–12.
2. The rail is lower (`RAIL_Y` 150), so the trolley runs clear of the HUD
   clock. The scene request (IC-M07a) now puts the rail about 13% down.
3. Instead of an arrow at the edge, the phone view widens while a prize is
   carried (the game's `span` grows smoothly to take in the trolley and the
   chute, and `focus` moves between them), so the chute itself stays in
   sight. On a wide screen nothing changes.

Shared items: no point penalties here; the chute was the one display that
fell off the narrow view (item 3).

## Matched to the painting

The Key Crane hangs by the middle of its painted shaft (measured on the
painting: 246 of its 400 units above the feet), drawn 36 units to the left
so its two painted feet sit either side of the hook point under the string;
the code-drawn claws are only drawn on the stand-in now. The hanging poses
(IC-M07c, IC-M07d) are drawn as whole cells with a fixed placement (the
shaft's middle on the centre line 35% down, the claw tips 93% down), and
their prompts now describe the painting's design: the bow head with the eye
inside it, the top hat, the collared shaft and the pink-and-olive feathers.

## Matched to the delivered art

The cabinet scene (IC-M07a) is in. Its brass rod runs 92 px down (higher
than asked), so the trolley's wheels now ride on it (`RAIL_Y` 114); only the
wheels pass under the HUD clock. The chute is the painted box: its top face
runs from x 60 to 355 and its hole is centred at (200, 577), so the catch
line, the glow round the hole while a prize is carried and the "+1" all sit
on the painted hole. The prizes stand on the painted velvet (812 px, between
its back edge at 720 and front at 855). The opening hint is two short lines
on a paper backing, centred on the view so a phone shows all of it. Still
stand-in: the prizes (IC-M07b) and the hanging and startled Crane (IC-M07c,
IC-M07d), drawn from the standing portrait meanwhile.

The sprites are in too (IC-M07b, IC-M07c, IC-M07d). The prizes are drawn at
their painted shapes with each one's top middle (measured per cell: the
basket's handle side, the kettle's lid knob) under the code-drawn ring,
which stays in code because the rings shrink. The hanging Crane is drawn
from measured points on its cells: the string ties on at the shaft's middle
above the feet ((584, 350) open, (550, 349) gripping, (578, 391) startled)
at the scale that puts the open claws (584, 900) the game's hook distance
below it. The gripping pose shows only with a prize in the claws, since it
is painted holding a ring (the prize's own ring is drawn behind it); a miss
shows the startled pose instead, drawn as painted with its shaft tipped
about 10 degrees, a jolt. Nothing is stand-in any more.

Scale check (owner's report that sprite birds shrink and grow): the hanging,
gripping and startled poses all draw at one scale, and measure the same: the
key from the eye's middle to its far knob is 693, 697 and 700 px in the
three cells (within 1%); a test checks it.
