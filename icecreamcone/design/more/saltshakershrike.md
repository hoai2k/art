### The Saltshaker Shrike: Just a Pinch (45 s)

The Shrike hangs upside down by its feet from a brass rail over a big round
revolving café table (a lazy Susan), its perforated cap pointing down. The
cook sets each plate on the table's right-hand edge, and the table turns it
round the near side to the diner at the left. Each has
a little flag with dots: how many pinches of salt it wants (one to five).
Move along the rail and press the action to shake one pinch. The salt
takes about half a second to fall and the table keeps turning: a plate
creeps at the two ends and swings fast across the middle, so the ends are
the easy places and the middle needs a lead. Each pinch that lands fills a
dot on its flag; one too many shows as a red dot. Salt that misses lands on
the table. The mechanic is counting presses onto a moving target with a
lead, rather than holding to a line (Tea Time) or framing (Say Cheese).

**Scoring.** When a plate reaches the diner: just right 3 ("Just right!"),
one pinch out 1 ("A little bland" or "A little salty", only if it had any
salt), anything else 0 and a frown. Puddings (cake, sundae) carry a flag
with a crossed-out shaker and want no salt: left alone they score nothing,
salted they cost 1.

**Getting harder.** The table turns at 0.4 radians a second at first and
0.65 by the end (a plate takes about 8 s, then about 5 s, to go round), and
plates come every 2.8 s at first, every 1.35 s at the end. Orders are one
to three pinches for the first nine seconds, then two to four, then two to
five. Puddings start after 8 s, about one plate in five. All the plates
ride the same table, so they never overtake.

**Controls.** Controller: left stick or D-pad moves along the rail, A
shakes. Keyboard: ← → or A / D, Space. Mouse or touch: the Shrike follows
the pointer along the rail; click or tap to shake. A faint dotted line
shows where the salt falls. On a narrow screen the view follows the
Shrike, 900 wide.

**Pass.** 30 points. Bots over seeds 1–12: a beginner (leads only 70% as
much as it should, slower, aims loosely, loses count one time in eight)
30–45; a good cook (full lead, keeps pace with the plate) 36–57; shaking
on the spot 0–13; wandering and mashing 0–14; following each plate and
shaking all the way 0–4; idle 0.

**Images.** IC-M14a is the café, its wall and tiled floor kept plain for
the table and the falling salt (the game draws its own brass rail).
IC-M14e is the round revolving table, its top's oval spanning the full
width so the game can fit the plates' rim to it. IC-M14b is the eight dishes on their plates: six savoury, two
puddings. IC-M14c is the four diners, waiting and pulling a face.
IC-M14d is the Shrike painted hanging upside down by its claws (a flipped
portrait would be lit from below): still, shaking out a pinch, squawking
pleased at a plate that's just right, and flinching at a frown. Until it
arrives the game turns the portrait upside down.

## Changes after the audit

1. **Shaking on the spot no longer pays.** The plates now ride a turning
   table instead of a straight counter, so each one crosses the middle (where
   a lazy shaker sits) at its fastest; the catch is narrower (`FOOD_HALF` 64
   to 50); and after the first nine seconds orders are two to five pinches,
   not one to five, so one or two lucky pinches rarely match. The table turns
   at 0.4 to 0.65 radians a second.
2. **Pass kept at 30**, not raised to 32: the slower beginner bot's lowest
   score over twelve seeds is 30, and the guide asks that a beginner clear it
   every time. Bots over seeds 1–12: beginner 30–45, good 36–57, shaking on
   the spot 0–13 (asserted below 20), wandering and mashing 0–14, following
   a plate and shaking all the way 0–4, idle 0.
3. **It looks different from the other conveyors:** a round lazy Susan in a
   café with a tiled floor, the plates creeping and swinging round it, and
   the Shrike over it. This needed new art: IC-M14a (the café, now without a
   counter, its middle kept clear for the table) was rewritten and IC-M14e
   (the revolving table) added.
- Shared guidance: a salted pudding now costs 1, not 2.

## Matched to the painting

The painting's cap is high and forward of its feet, at (−83, −375) in bird
units, where the stand-in's was at (0, −268). Turned upside down, it is drawn
a little smaller (size 229, not 320) and shifted so that its cap hangs where
the salt falls from, at the same height. The pose request IC-M14d now
describes the painting itself: a fluted glass body, a domed silver cap with
an eye mask, mauve and olive wings.

## Matched to the delivered art

The repainted café (IC-M14a) is in: striped wall, menu board, shelves, clock, the kitchen hatch at the right and the checked floor from about y 616.
- The plates are set down at the table's right-hand end (x 1460), in front of the painted hatch.
- The diner stands at the left before the shelves.
- Nothing needed moving.
- Still drawn in code until their sprites arrive: the revolving table (IC-M14e), the plates and food (IC-M14b), the diners (IC-M14c) and the Shrike's hanging poses (IC-M14d; the portrait is shown turned upside down). The brass rail and the salt are always drawn in code.

Sprites delivered (IC-M14b plates, IC-M14c diners, IC-M14d hanging poses, IC-M14e table). Every anchor was measured on the PNGs.
- **Table:** its top oval is centred at (1024, 222) of the 2048 × 1024 sheet, 1002 px to each side. It is drawn 0.689 times size so the oval spans 690 to each side round (860, 560); its foot runs off the bottom of the screen. The plates' rim moved out to 108 (from 95) to sit 87% of the way out on the painted top.
- **Hanging poses:** each hangs from claws at the top of its cell, so the claws are on the rail (0.277 scale). Each is placed by its own cap holes ((503, 782), (503, 763), (484, 763), (521, 726)) so the salt still falls from the cap. They are no longer mirrored.
- **Diners:** they now stand behind the table's left end (x 320, waist at y 600, 220 tall), drawn before the table so its top hides the cut-off waist. The plate arrives in front of them.
- **Plates:** 200 wide by their painted plate. The salt dots sit on each dish's food height as drawn.
- **Still drawn in code:** the brass rail, the salt and its spills, and the flags. The painted table doesn't show itself turning (the turning knots were only on the code table); the plates going round show it. No pose is missing.

## Difficulty over the round

The lunch rush follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85. Each knob is easy / medium /
hard; hard is roughly the old end of the round, medium a little gentler than
the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Table turn (rad/s) | 0.36 | 0.55 | 0.78 |
| Seconds between plates (±15%) | 2.7 | 1.95 | 1.15 |
| Pudding chance | 0 | 0.15 | 0.22 |
| Pinches wanted | all 1 | 1–3 | 2–5 |

Pinches: `floor(knob(d, 1, 1, 2) + r * knob(d, 1, 2.4, 3.6))`, so a Normal
round opens on ones, twos creep in, threes come near the middle, and fours
and fives only at the end. Easier never asks for more than two.

**Pass mark stays at 35.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Mash | Shake on the spot | Over-salt | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 15 (9–19) | 27 (18–34) | 0 | 39 (35–42) 100% | 42 (35–48) 100% | 45 (39–48) |
| Normal | 0 | 15 (1–25) | 27 (21–32) | 0 | 29 (15–38) 17% | 45 (39–51) 100% | 48 (36–54) |
| Harder | 0 | 10 (4–16) | 18 (11–28) | 2 | 13 (5–24) 0% | 52 (43–57) 100% | 58 (45–69) |

The medium player is the old beginner (leads 70%, loses count one pinch in
eight). The clumsy one leads 30%, shakes only every half second and looks up
0.7 s late on each new plate. Points come from plates served, so a busier
table pays more to whoever keeps up: the hard end is where records are made.
`test/saltshakershrike.test.mjs` checks all of this, and the orders third by
third at each level.
