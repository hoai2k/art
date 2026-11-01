# Glove Dove: Slippery Dishes (45 s)

Bird 11 of the book's other birds. The Glove Dove is a long pink rubber
washing-up glove with a dove's head. Code: `game/src/games/glovedove.js`;
entry: `game/src/more/glovedove.js`; tests: `game/test/glovedove.test.mjs`.

## Rules

The washing-up is done, but every dish is wet, soapy and slippery. One at a
time they pop up out of the suds in the sink on the left and come down over
the counter. The Glove Dove runs along the counter beneath them, catches each
on its long glove neck and bumps it up and away to the right, until it drops
into the plate rack.

- **Where.** A ring on the counter shows where each falling dish will come
  down; it turns pink when the glove is under it.
- **Crouch (hold the action).** The Dove sinks, its glove neck held level
  like a tray, and a dish that comes down on it settles there. While crouched
  it shuffles along more slowly, carrying the dish with it. A row of five
  pink dots over the glove fills as the crouch winds up (0.45 s).
- **Bump (let go).** The Dove springs up and bumps the dish. Wound right up
  (all the dots full), it is a **"Hup!"**: high and long and aimed at the
  rack (from near the sink it may take two, or carry it closer first). Let go
  sooner and it is only a hop along to the right. Letting go just as a dish
  lands bumps it at once. The head turns to the right to aim once a dish has
  settled or the crouch is full, and swings back to the left after the bump;
  the body always faces left.
- **Standing up**, a dish bounces off the rubber once, low and short; the
  second time it slips off ("Slippery!"). Holding the action all the time
  catches one dish and never puts it away; mashing gives only short hops.
- **Into the rack:** "Put away!". A dish that hits the counter or the floor
  smashes ("Crash!": no points lost, but it is gone). One that drops back into
  the sink just pops up again later.

## Scoring

Three points for each dish put away and one for each "Hup!". The page opens
at 30.

## Getting harder

At first one or two plates come up every three seconds, then cups and
bowls. From 15 s heavy pans and pie dishes join them (pans fly lower, so
they need more bumps), and dishes come faster (every second by the end)
with up to six in the air at once, so a dish carried too long lets others
fall. See "Difficulty over the round" below.

Bots (`node --test test/glovedove.test.mjs`, six seeds): a beginner (slow on
the stick, crouching 0.4 s before a dish lands, letting go anywhere from 0.6
to 1.8 full crouches) scores 52 to 66; a clumsy one (slower still, and
forgetting one dish in five) 35 to 43; a good player (carries a dish to
the middle of the counter before a full "Hup!") 89 to 93. Running under every
dish and mashing at five rhythms scores 0 to 18; holding all the time,
standing without pressing and idling score 0.

## Difficulty over the round

The washing-up follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard; hard
is the old end of the round, medium a little gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Seconds between dishes (±15%) | 3.1 | 2.15 | 1.0 |
| Most dishes out at once (rounded) | 2 | 4 | 6 |
| Pans and pie dishes (after the first third) | 30% | 46% | 68% |

Unchanged: the first two dishes are plates, and no pans come in the first
third (15 s) at any level.

**Pass mark stays at 30.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Mash | Hold | Bounce | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 10 (6–12) | 0 | 0 | 24 (12–33) 33% | 56 (49–61) 100% | 62 (60–65) |
| Normal | 0 | 9 (0–21) | 0 | 0 | 23 (13–32) 25% | 54 (49–60) 100% | 72 (69–77) |
| Harder | 0 | 9 (0–18) | 0 | 0 | 25 (15–34) 42% | 54 (49–60) 100% | 97 (93–101) |

The medium player is the old beginner; the clumsy one runs at 0.4, winds up
loosely, and forgets a dish one time in five plus one in five more for each
other dish out; the good one carries dishes to the middle before a full
"Hup!". A smashed dish costs nothing, so a slower player's score is how many
dishes they can carry, whatever the level: Easier is calmer (fewer dishes,
fewer pans) but does not lift a clumsy player's score, and Harder does not
lower it. Only a player fast enough to keep up gains from a busier sink,
which is where records are made. This falls short of the guide's "Easier
lets a clumsy player pass"; it would take a cost for smashing to change.
`test/glovedove.test.mjs` checks the rest, and the knobs third by third at
each level.

## Controls

| Device | Run | Crouch / bump |
| --- | --- | --- |
| Controller | left stick or D-pad | hold A, let go |
| Keyboard | ← / → or A / D | hold Space or Enter, let go |
| Mouse / touch | the Dove runs to the pointer | hold the button or a finger down to crouch (dragging moves it), lift to bump |

On a narrow screen the view follows the Dove, leaning towards the rack.

## Images

- **IC-M11a, the scene** (`scene.glovedove`): the kitchen from the side, the
  sink of suds on the left, an empty plate rack on the right, and a bare
  counter and wall between for play.
- **IC-M11b, dishes** (`sprites.dishes`, 3 x 2): six wet dishes seen from the
  side, spun in the air and stood in the rack.
- **IC-M11e, the Glove Dove cheering and dismayed** (`sprites.glovedovePoses`,
  2 x 1): when a dish is put away, and when one smashes. Until it arrives the
  portrait hops or squashes.
- **IC-M11f, the Glove Dove catching and flicking** (`sprites.glovedoveToss`,
  2 x 1): the long glove neck held level like a tray while a press is live,
  and snapping up for the flick. Until it arrives the portrait braces, then
  tips back, with little pink marks over the glove while a catch is ready.
  Now the stand-ins for the crouch and bump until IC-M11h arrives.
- **IC-M11h, the crouch, bump and look back** (`sprites.glovedoveBump`, 3 x 2,
  requested): six full-figure frames, the body always facing left: sinking
  (first 0.1 s of a hold), deep crouch with the glove level (held, no dish),
  head turning (0.12 s once a dish has settled or the crouch is full), head
  turned right and aiming (held after that), the bump (0.25 s after letting
  go), and looking back (0.3 s). Full figures rather than a separate head
  and body, because the head and long glove neck are one object growing out
  of the feather ruff, and a separately painted neck would leave a seam and
  a pivot the painter can't register. Registered by the feet (baseline y
  1002 of 1024, midway at x 512), with the crouched glove's top a level line
  at y 640 for the dish to rest on. Until it arrives: the braced pose
  squashed down for the crouch, the flick pose for the bump, no head turn.

## Changes after the audit

1. **Reworked the core.** Squeaky Clean (move over spots and rub them away,
   soap as a booster that foams over) played like Pressing Business. Slippery
   Dishes is a timing-and-positioning keepy-uppy: run under a falling dish and
   flick it on contact, the quality of the flick set by the timing, to carry
   it through the air into the rack. It shares no mechanic with Pressing
   Business (no wearing away, no booster) or with Scoop Stack (dishes are
   flicked on, not caught and stacked). The title, goal, tips and rhyme are
   new.
2. Not needed: there is no rubbing any more. The action is a single, timed
   press, the same on every device.
3. Scores grow steadily: one point per "Hup!" and three per dish put away,
   so a round is worth 35 to 80 rather than 7 to 13 dishes.

Images: the scene (IC-M11a) and the dishes (IC-M11b) are kept with new
prompts (side view instead of from above). The grime (IC-M11c) and the
scrubbing pose (IC-M11d) are no longer needed and are removed. IC-M11e is
kept but now asks for cheering and dismayed (it was cheering and swamped in
foam). The catching and flicking poses are new, as IC-M11f.

## Matched to the painting

The game was designed around the painting, which arrived during the rework.
The Glove Dove's long pink glove is its neck, held level behind its head with
the cuff open at the back. So the dishes land on top of the glove, not on the
head: the catch height (473 px, 355 painting units above the feet) and the
catch centre (57 px behind the feet, the middle of the glove) are measured
from the painting. The landing ring turns pink when the glove, not the
feet, is under a dish, and the pointer steers the glove to where you touch.
The Dove always faces left, towards the sink, so the glove always reaches
back towards the rack and the catch point never jumps when it turns. The
flick tips the whole painting back from the feet, so the glove swings up.
The pose requests (IC-M11e, IC-M11f) describe the painting's design: fingers
as a crest on the head, the long studded cuff behind it, and the scalloped
blue-grey body.

## Matched to the delivered art

The kitchen scene (IC-M11a) shows the counter top from a little above, so the
play space is lower than the stand-in's: the Dove now stands near the front
edge of the counter top (y 540; the edge is at 554), the sink's suds are at
y 390 and its rim at x 360, and a dish is put away when it drops through the
tops of the painted rack's wires (y 360, x 1250 to 1560); the dishes put away
stand on the painted tray. To fit the lower space the dishes fly on a smaller
scale (gravity and launches cut to 0.6, the same times in the air), so the
bots' scores hardly moved (beginner 51 to 68, good 76 to 87, mashing 4 to 27,
pass still 35). The hint sits on the tiles under the window. Still drawn in
code: the dishes (IC-M11b) and the Dove's catch, flick, cheer and dismay
poses (IC-M11e, IC-M11f), all requested.

The Dove's sheets and the dishes have arrived (IC-M11b, IC-M11e, IC-M11f).
The pose sheets are painted at the portrait's framing, so each is drawn whole
at the portrait's scale and stood on its measured feet (brace and flick 0.979
of the cell down, cheer and dismay at the cell's foot; the cheer's feet sit at
0.46 across). The braced pose lowers the glove to a level tray 252 painting
units above the feet with its middle 84 units behind them, measured on the
sheet, so dishes now meet the glove there (y 357; the portrait's glove was
346 units up) and the Dove braces automatically whenever a dish is about to
come down on its glove, then flicks, cheers or droops. The code's pink "ready"
marks and the portrait's tilts are gone. The dishes fly as painted, and stand
up in the painted rack as their side views turned upright. With the glove
lower the beginner bot scores 37 to 70 and the good one 66 to 79; mashing
stays at most 20, so the pass mark is now 30 (it was 35).

Requested (IC-M11g, `sprites.dishShards`): a smashed heap for each dish, left
on the counter for a moment after a crash. Until it arrives the game throws
little triangles of the dish's colours, the only thing still drawn in code.

## Hold to crouch, let go to bump

At the owner's request the control changed from a timed press to hold to
crouch and let go to bump, with the head turning right to aim and back after.
The timed "Hup!" press, its fumble and the automatic brace are gone; a dish
now settles on the crouched glove and can be carried, and how long the
crouch was held (not the timing of a press) decides between a "Hup!" and a
hop. Pass 30 kept (beginners 44 to 63, clumsy 34 to 52, mashing at most 21).

### The crouch-and-bump sheet (IC-M11h), and one size for every pose

The bump sheet arrived painted at about two thirds of the portrait's size,
and the cheer/dismay sheet at 0.92; fitting cells by their height made the
Dove grow as it crouched. Now every cell is drawn at a scale measured on the
art: on each cell the eye's diameter, the square root of the blue-grey
feather area and the square root of the ochre leg area were measured against
the portrait's, and their common value is the cell's scale (portrait 1;
cheer and dismay 0.92; sinking, turning, aiming, bump and look-back 0.68;
the deep crouch 0.655). Each cell stands with the middle of its feet where
the portrait's feet are. The table is `DOVE_POSES` in the game;
`test/glovedove.test.mjs` re-measures the three features on every cell from
the PNGs and checks that their median stays within 4% of the portrait's on
screen (all within 2.5%).

From the same measurements: the standing glove's top (where a dish bounces)
is 247 px above the feet, the crouched glove's level top 166 px, and a
caught dish rests on the middle of its level part, 28 px behind the Dove's
x. The crouch's wind-up dots moved up above the resting dish. The braced and
flick poses (IC-M11f) and the squashed stand-ins are no longer used.

Two cut-off slivers along the bottom edge of the crouch cell, and a speck in
the head-turn cell, were erased from glovedove-bump.png (nothing of the
painting itself was changed). Hops without a full crouch now go a little
less far (110 to 280 px a second along), so a slow rhythm of crouch-and-let-go
stays under the pass mark: beginners 53 to 60, clumsy 32 to 45, good 85 to 89,
mashing at most 15, pass 30.
