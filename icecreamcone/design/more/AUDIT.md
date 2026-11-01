# The book's other birds: audit of the 18 new minigames

Audited on 2026-10-09, on `main` at `7287924`, against the bar set by the
original ten (`game/src/games/{coot,cupadee,shuttercluck,gullfinch,plume,bobolinks,peeper,piffle,dodo,crow}.js`
and their tests) and the goals in [`../design.md`](../design.md): school-age
kids, Mario Party level, 30 to 60 s, easy to pick up, a real score to beat,
harder over time, the same few controls on controller, keyboard and touch,
and playable on a phone.

For each game I read the design note, the field-guide entry, the game and its
test; ran `node --test test/*.test.mjs` (139 tests, all pass; the bot scores
quoted below are from that run); ran
`node scripts/browser-check.mjs --bird <id>` for each (no page errors; every
game reaches its result card); and took extra screenshots on a 1280 x 720
desktop with a simulated controller (the bird's page, then 1.5 s, 5 s and
10 s into play) and on a 390 x 844 phone with touch. The art is not
delivered, so the stand-ins were judged for readability only, not polish.

Scores are 1 to 5, where 4 is level with the original ten and 5 is a
strength. Columns: **Cl** clarity of the goal in the first seconds, **Fun**
game feel (feedback, sound, pops), **Fair** fairness and difficulty ramp
(including the pass mark), **Read** readability of what is happening, **Ctl**
controls on controller, keyboard and touch, **Ph** phone fit (focus and
span), **Tst** test quality.

## Summary

| Bird | Game | Verdict | Cl | Fun | Fair | Read | Ctl | Ph | Tst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Milkbottle Midge | Milk Round | needs improvement | 3 | 3 | 2 | 3 | 4 | 3 | 4 |
| Waterglass Goose | Glass Harp | needs improvement | 5 | 3 | 3 | 3 | 4 | 3 | 4 |
| Jackknife Niffy | Snip Snap | needs improvement | 3 | 4 | 2 | 2 | 4 | 3 | 4 |
| Cutitup Snippit | Snip the String | meets the bar | 5 | 4 | 4 | 4 | 4 | 3 | 5 |
| Buttonbeaks | Button Up | meets the bar | 4 | 4 | 3 | 4 | 4 | 4 | 4 |
| Broomwhisk | Clean Sweep | needs improvement | 3 | 3 | 2 | 3 | 3 | 2 | 4 |
| Key Crane | Lucky Dip | meets the bar | 5 | 4 | 3 | 5 | 4 | 3 | 4 |
| Garbage Canary | Bin Day | needs improvement | 4 | 4 | 3 | 2 | 5 | 4 | 5 |
| Steampresser Sparrow | Pressing Business | needs improvement | 4 | 3 | 4 | 3 | 3 | 4 | 4 |
| Wetweather Wren | Puddle Hop | needs improvement | 2 | 4 | 3 | 3 | 4 | 4 | 4 |
| Glove Dove | Squeaky Clean | reimplement | 4 | 3 | 3 | 4 | 3 | 4 | 4 |
| Ten O'clock Tit Trush | Set the Clocks | needs improvement | 4 | 3 | 3 | 5 | 2 | 4 | 5 |
| Plugsocket Swift | Lights On | meets the bar | 4 | 4 | 4 | 4 | 4 | 3 | 5 |
| Saltshaker Shrike | Just a Pinch | needs improvement | 4 | 3 | 2 | 4 | 4 | 4 | 4 |
| Soupladle Lark | Soup's On | needs improvement | 4 | 4 | 4 | 3 | 4 | 4 | 5 |
| Drippet | Drip Drop Dash | needs improvement | 4 | 4 | 2 | 4 | 4 | 4 | 3 |
| Saw Bird | Saw It Straight | needs improvement | 4 | 4 | 4 | 4 | 2 | 4 | 3 |
| Radio Bird | Tune In | needs improvement | 3 | 2 | 2 | 3 | 3 | 2 | 3 |

Four meet the bar, thirteen need improvement, and one (the Glove Dove) should
have its core loop reworked, because it plays as a second Pressing Business.

## Across all eighteen

What is already at the bar everywhere: every game keeps to the contract, has
`hud`, `summary`, `focus` and `span`, a one-line hint on screen for the first
seconds, pops and synthesised sound on every scoring event (all the `sfx`
names exist in `audio.js`), a rumble on hits and misses, and a test with
skill-graded bots (idle, mashing and a degenerate strategy below the pass
mark) plus unit tests of the rules. The tests are, on the whole, more thorough
than the originals'.

What recurs:

1. **The core test skips them.** `test/core.test.mjs` runs only the ten in
   `BIRDS` idle and mashed and checks their entries (four-line rhyme, a
   whole-number `pass`, the required fields). Extend it to `BUILT_IDS` from
   `src/more/index.js`, so a new bird cannot land without that floor.
2. **Too many penalties.** The originals rarely take points away (Safe
   Crossing's near miss, Hot off the Press's smudge). Most of the new games
   subtract (−1 to −10) and clamp at zero, so a child's first round often ends
   on 0 after scoring several times (a random round of Milk Round ended on 0
   after a pint went in). Where a mistake already costs time (a jam, a daze, a
   stop), let that be the cost and drop the subtraction, or keep it to −1.
3. **A cluster of "slide past and press over it" games.** Snip Snap (walkers
   pass below, swoop with a lead), Button Up (coats pass above, toss up under
   one), Just a Pinch (plates pass below, drop salt with a lead) and Milk
   Round (houses pass behind, release at the right moment) share a shape.
   Each has its own twist, but keep them apart in the guide order and make
   their presentation as different as possible (see each game).
4. **Pressing Business and Squeaky Clean are the same game** (see the Glove
   Dove).
5. **Phone views that lose a key display.** Where something the player must
   watch lives far from the `focus` (the goose's crack counter, the radio's
   signal meter, the dustpan), it falls off the narrow view. Either bring it
   near the focus or draw a small copy at the view's edge.

### Changes made

- **Item 1 (done).** `test/core.test.mjs` now loads every built new bird
  (`loadMoreBirds()`) and holds it to the same checks as the ten: the entry's
  fields, a four-line rhyme, a whole-number `pass`, a list of controls, and the
  game running to its end idle and mashed. It also now asserts that random
  mashing stays below `pass`, for all 28 games.
- **Found by that check: Left Foot, Right Foot (one of the original ten).**
  Random mashing scored 57 against a pass of 45, because a wrong step only
  cost 0.6 s. Now a wrong press within 1.5 s of the last one stumbles longer
  (up to 3.4 times as long), so mashing scores 20–33; a careful beginner bot
  still scores 44–57, and the pass is now 40 (it was 45, which the beginner
  bot only just reached on one seed).
- **Item 2 (done in every game).** Where a mistake already costs time, the
  point penalty is gone or down to 1: Snip the String −5 (was −10), Bin Day
  −1, Pressing Business −1, Snip Snap only a daze, Milk Round's plain smash
  free, Just a Pinch and Soup's On −1, Tune In's wrong station a short
  grumble, Slippery Dishes loses nothing for a smash.
- **Item 3 (done).** The guide order (`MORE_IDS` in `src/more/index.js`) keeps
  the slide-past games apart: Milk Round 1st, Snip Snap 3rd, Button Up 5th,
  Just a Pinch 14th; Snip the String moved from 4th to 7th so it no longer
  sits beside Snip Snap. Just a Pinch now rides a revolving table and reads
  differently.
- **Item 4 (done).** The Glove Dove's game is rebuilt as Slippery Dishes.
- **Item 5 (done).** The goose's crack counter, the radio's speaker and
  station, the dustpan (an arrow), the chute (a wider view while carrying)
  and the fuse box (a copy at the edge) all stay in the phone view.
- **Matched to the paintings.** The 28 undiscovered birds' paintings arrived
  during the audit; every game was re-fitted to its painting (where the beak,
  blade, spout or sole really is, sizes, hitboxes, effects), and every pose
  request now describes the painting. See each bird's "Matched to the
  painting" section.

## Milkbottle Midge: Milk Round

Hold to wind up, let go to lob a pint up a garden path onto the doorstep.

**Findings**

- It asks for two timings at once: start winding at the right moment, and
  let go when both the house is under the float (x) and the ring has reached
  the step (depth). That is harder than anything in the original ten.
- The depth window is very tight late on: ±20 px over a 0.95 s wind-up across
  400 px is about 0.1 s to let go in. Bots pass, but a seven-year-old won't
  feel why they missed.
- Where the bottle lands across the street (x = 430) is not shown until you
  start holding. Nothing tells a child which house is "next" or where to aim.
- Smash −1, dog −2 more, "No milk" −1, clamped at zero: in a random round the
  score was 0 with one pint delivered and 22 smashes. Early failure feels like
  nothing happened.
- The sleeping dog stand-in is a brown loaf; "z"s help, but it doesn't read as
  a dog at a glance. The ring is small and faint (thin dashes on pale paint).
- On a phone the Midge itself sits at the left edge of the view (focus 690,
  span 900), and pops at the left are cut off.

**Improvements**

1. Always draw the throw lane: a faint dotted line or chalk mark up the
   street at the float's x, so the target house is obvious before you hold.
2. Make the ring bigger and bolder (thicker stroke, a filled tint), and turn
   it green when it would land on a step and on the house under the lane.
3. Widen the late depth window (keep `tol()` at ±30 px, or slow
   `windTime()` to no faster than 1.15 s); the ramp already has speed, dogs
   and cards.
4. Drop the −1 for a plain smash (it already loses the pint); keep a cost only
   for waking a dog (−1) and for a "No milk" house.
5. Move the focus left (`FLOAT_SX + 150`) so the Midge and the next house are
   both in the phone view.
6. Give the dog stand-in a head, ears and tail so it reads as a dog asleep.

**Changes made**

Done (55319b8); details in `milkmidge.md`.
1. A chalk throw lane always runs up the street from the Midge's hand, green when a house that wants milk is on it.
2. The landing ring is bigger and filled, green when it would land on the step.
3. The step's depth window stays ±30 px all game; the full wind-up is slower (1.35 s, falling to 1.15 s).
4. A plain smash costs nothing but a 0.7 s pause; a woken dog or a "No milk" house costs 1. A pint in the middle of the step scores 2, so the unit is now points.
5. The phone view keeps the Midge and the next house.
6. The stand-in dog reads as a dog.
Pass 16 (was 9). Bots: beginner 19–25, good 38–44, mashing 0–2, idle 0.

## Waterglass Goose: Glass Harp

Watch the Goose tap a tune on the glasses, then tap it back.

**Findings**

- Clear from the first second ("Listen…" / "Your turn!" and the dots), and
  the pentatonic notes sound pleasant. The best memory-game read of the
  eighteen.
- There is a ceiling: every good bot scores exactly 58, the most possible.
  Once a child can play all eight tunes there is no score left to beat.
- The pink (`#ea8fb0`) and mauve (`#b98aa3`) glasses are both "pink" to a
  child, and they stand side by side in the five-glass rounds; the tip tells
  them to say the colours.
- The glass the Goose is at is marked only by a small yellow triangle under
  the table edge; with a controller or keyboard that is easy to lose.
- The crack counter (three little glasses up on the window, x ≈ 1440–1540)
  is outside the phone view (focus 800, span 1300).

**Improvements**

1. Remove the ceiling: after the eighth tune keep going (longer tunes) until
   the third crack, or add a quick-play bonus (+1 for a note within 0.6 s of
   the last), so a strong player always has a higher score to chase.
2. Change the fifth tint to a clearly different hue (orange or a deep blue),
   and name it in the tip.
3. Highlight the selected glass itself: a glow or thick outline round it and
   a lift, not just the triangle.
4. Move the crack counter inside x 200–1400 (for example under "Listen…"),
   or draw it beside the HUD.

**Changes made**

Done (55319b8); details in `waterglassgoose.md`.
1. A right note within 0.8 s of the last scores one extra, so the most is 84 and the good bot no longer hits a ceiling every time; eight tunes kept, so a game stays about a minute.
2. The fifth glass is orange, not mauve.
3. The glass the Goose is at lifts, with a shadow and a pulsing outline.
4. The crack counter sits under the tune's dots, inside the phone view.
Pass 30 (was 22). Bots: beginner 32–63, good 84, random tapping 0–2, idle 0.

## Jackknife Niffy: Snip Snap

Fly along the sky and swoop to snip feathers, flowers, threads and price tags
from walkers; avoid balloons and the Park Keeper's gaze.

**Findings**

- Three rules at once (lead the walker, never a balloon, not while the Keeper
  looks) on a 45 s game. Each is fair, but together they are more than the
  originals ask.
- Skill doesn't show cleanly: beginners score 7–20 and careful snippers
  13–23 over the same seeds, and the beginner's lowest is the pass mark (7).
  Luck in the crowd decides too much.
- The Keeper's warning eye (beside the Niffy and over the Keeper) reads as a
  white cloud or blob in the stand-in. The "?" is the only clear cue, and it
  is over the Keeper at the far right.
- In the busy middle the walkers overlap into a crowd, with feathers and
  flowers stacked; it is hard to see which thing the swoop will take.
- On a phone the Keeper is usually off screen, so the eye beside the Niffy is
  the only warning, and that is the unreadable one.

**Improvements**

1. Make the warning unmistakable next to the Niffy: a big "!" or an eye that
   is plainly an eye, in red, and tint the sky a little while he looks.
2. Space walkers so no more than two overlap, and draw the thing the swoop
   would take with a highlight (a small pink ring) while hovering above it.
3. Cut variance: fewer spawns in pairs, a steadier walker speed; aim for the
   beginner band to sit clearly above 7 (for example 9–14) and good above it.
4. Make the Keeper's catch cost the daze only (no −2), or −1.
5. Keep it clear of Snip the String in the guide order; both are "snip".

**Changes made**

Done (55319b8); details in `niffy.md`.
1. The Keeper's warning is a pulsing red "!" while he turns and a plain red-rimmed eye while he looks, with a red tint on the sky.
2. Walkers keep at least 330 px apart; a pink ring marks what a swoop would take (red for a balloon string).
3. Steadier scores: walker speed ±5%, spawn gaps ±15%, two things on a walker only late on. A snap at the air makes people nearby hold on to their things for 2.5 s, so aiming matters.
4. Being caught costs only a 1.6 s daze; a balloon costs 1.
5. Guide order: Snip the String moved away from Snip Snap (see the shared changes).
Pass 9 (was 7). Bots: beginner 10–17, careful 15–22, non-stop swooping 1–5, idle 0.

## Cutitup Snippit: Snip the String

Trace a tangled balloon string down to its knot and snip there.

**Findings**

- A fresh, readable puzzle: the stand-in strings are clean ink lines, the
  wanted balloon has a dotted pink ring and the tag says which, and the
  tangle grows in a clear ramp. Wrong snips cost points and jam the blades,
  so guessing doesn't pay (mashing scores 0).
- Where exactly it snips is the hinge (its eye), not the blade tips; a child
  will aim the tips. `REACH` is generous, which hides most of it.
- On a phone, a span of 1180 makes the knots and strings small.

**Improvements**

1. Mark the snip point: a small notch or arrow under the hinge, or make the
   blade tips the snip point.
2. Narrow the phone span to about 1000 by drawing the bunch a little tighter
   (X0/X1 inward), so strings stay thick enough to trace.
3. Consider halving the wrong-string cost (−5): the jam already stings.

**Changes made**

Done (4484368); details in `snippit.md`.
1. A pink notch marks the snip point under the hinge, magenta when a knot is in reach; the tip says so.
2. Knots and balloons spread over x 400–1200; `span` is 1000 (was 1180).
3. A wrong string costs 5 (was 10).
Pass stays 120; beginner bots 155–180, good 540–600, mashing 0–35, idle 0.

## Buttonbeaks: Button Up

Pick the button a coat is missing from the bowls and toss it up into its hole.

**Findings**

- Fetch and deliver reads well: ghost buttons on pale patches, bowls of each
  kind, a dotted ring on the bowl in reach. The look-alikes differ in shape as
  well as holes, so they are fair.
- The pass mark is tight: beginners score 12–14, pass is 12.
- Shares the conveyor shape with Snip Snap and Just a Pinch.

**Improvements**

1. Lower the pass mark to 10 so a beginner gets it within a try or two.
2. When holding a button, highlight the open holes on the line that it
   matches (a pulse), so the child sees where to run.

**Changes made**

Done (4484368); details in `buttonbeaks.md`.
1. Pass lowered from 12 to 10.
2. While the pair hold a button, every hole on the line it fits pulses pink.
The shared "slides past" shape is kept: it is a fetch-and-deliver game; keep it apart from Snip Snap and Just a Pinch in the guide order. Bots: beginner 12–14, good 25–26, mashing 4–5, idle 0.

## Broomwhisk: Clean Sweep

Push leaves and dust with momentum into the dustpan; flick to send them
skidding.

**Findings**

- Steering a broom in two dimensions on a foreshortened floor (up and down is
  into the picture, y counts double) is hard to read and hard to aim for a
  child; the push direction follows the broom's motion, not its look.
- Skill barely separates: beginners 14–24, good 18–29, flickers 15–28. My
  sinusoidal random run scored 11 against a pass of 14.
- Gusts undo work the child can't prevent, and come every 5 s by the end.
- Grey dust balls on a grey-beige floor have little contrast; leaves are thin
  slivers.
- On a phone (span 1000, following the broom) the dustpan is often off
  screen, so you push towards something you can't see.

**Improvements**

1. Draw an arrow or short dotted line from the broom showing where touched
   things will slide, and light up an item once it counts as swept.
2. Widen the pan's mouth and add a gentle funnel (items within 120 px of the
   mouth that are swept slide in), so a near miss still lands.
3. Make gusts rarer and weaker (every 12 s, then 8 s) and never blow swept
   items away from the pan.
4. Darken the dust balls and fatten the leaves in the stand-ins.
5. On a phone, draw an edge arrow pointing to the pan when it is off view, or
   bias the focus towards the pan.
6. Re-tune the pass mark once the variance is down; target beginners clearly
   above it.

**Changes made**

Done (4484368); details in `broomwhisk.md`.
1. A dotted line shows where pushed things will slide; swept things glow for the 3 s they count.
2. The pan's mouth is wider (110 from its middle, was 84) and pulls in near misses within 130.
3. Gusts every 12 s rising to every 8 s (was 9 and 5), a third weaker, and they never move a swept thing.
4. Darker dust, wider leaves.
5. The phone view leans towards the pan, with a "pan" arrow when it is far off.
6. Pass 15 (was 14). Bots over 10 seeds: beginner 16–23, good 22–32, smooth wandering 4–9, flailing 0–5, zigzag 0–1, idle 0; the tests assert the last four stay below the pass.

## Key Crane: Lucky Dip

Move the trolley, let the swinging Crane settle, drop onto a prize's ring,
carry it to the chute.

**Findings**

- The most readable of the eighteen: clear rings, a clear chute with an
  arrow, a pendulum that feels physical. Exactly the claw-machine fantasy.
- Pass is tight (beginners 6–7, pass 6), and scores are small numbers, so
  one slip is a big share of the score.
- The trolley runs under the HUD clock at the middle of the rail.
- On a phone the chute is off view while at the pile.

**Improvements**

1. Lower the pass mark to 5, or slow the ring shrink (`lerp(32, 20)`).
2. Lower the rail a little (`RAIL_Y` ≈ 150) so the trolley clears the clock.
3. On a phone, show a small chute arrow at the left edge while carrying.

**Changes made**

Done (577d8b2); details in `keycrane.md`.
1. Rings shrink only to about 40 px across; pass 5 (was 6).
2. The rail is lower, clear of the HUD clock (IC-M07a's prompt moved with it).
3. On a phone the view widens to take in the trolley and the chute while a prize is carried, instead of an edge arrow.
Bots: beginner 7–9, good 8–12, mashing 0, idle 0.

## Garbage Canary: Bin Day

Hold to open the lid for rubbish; keep it shut for the hat, letter, cat and
sparrow.

**Findings**

- A strong one-button game with real skill (beginners 21–28, sharp 29–52) and
  good bots, including holding the lid open all the time (0–3).
- Readability is the problem: ten kinds of thing at about 40 px on a laptop,
  arriving at up to 560 px/s, must be sorted at a glance. In the stand-ins
  the apple core reads as a bow and the tin as a box; nothing says "keep"
  apart from knowing the object.
- The Canary itself is a yellow sliver under the lid; the bird is barely
  seen.
- Late on, a keeper follows rubbish by 0.36 s: very fast for young children.
- "Missed" pops stack on top of each other.

**Improvements**

1. Give the things that aren't rubbish a shared cue: a soft gold outline or a
   little shine, and draw everything about 1.3 times bigger.
2. Draw the canary's head larger, peeping out, and have it look at what is
   coming.
3. Keep the late gap at least 0.5 s.
4. Offset stacked pops so they don't overlap.

**Changes made**

Done (577d8b2); details in `garbagecanary.md`.
1. Everything that isn't rubbish shares a gold glow, ring and star; all things are drawn 1.3 times bigger (IC-M08b's note updated).
2. The canary head is larger (IC-M08c and d now ask for a head a third of the lid's width).
3. Arrivals are always at least 0.5 s apart, gusts included; a test checks it.
4. Pops no longer stack on each other.
Shared item 2: swallowing something that isn't rubbish costs 1 (was 2); the lid stays shut 0.9 s while the Canary splutters. Pass 18; bots: beginner 23–35, good 41–44, lid always open 0–12, mashing about 6, idle 0.

## Steampresser Sparrow: Pressing Business

Run the iron along each crease to press it out; steam presses faster; don't
linger or the cloth scorches.

**Findings**

- Clear, and the heat glow is a good warning. The ramp is sound (beginners
  21–23, good 36–38).
- On touch every new finger-down is an action press, so each time a child
  puts a finger on the board to move the iron it also puffs steam (and heats
  the cloth faster).
- On the silk scarf the stand-in's darker pink blots compete with the creases
  and the scorch marks.
- Too close to Squeaky Clean (see the Glove Dove).
- The iron is steered in two axes at 640 px/s; with a stick that is fine,
  with arrows it is coarse for following a curved crease.

**Improvements**

1. With a pointer, steam only on a tap on the iron itself (or a steam button
   on the board's edge), as Squeaky Clean does with its soap bottle.
2. Keep the cloth plain under the creases (no blots), and draw scorches as a
   clear brown iron shape.
3. With the keyboard, ease the iron in (a short acceleration) so short taps
   nudge it.
4. Keep the steam and heat mechanic here; let the Glove Dove change.

**Changes made**

Done (577d8b2); details in `steampressersparrow.md`.
1. With a pointer only a tap on the iron puffs steam; the touch hint says so.
2. The cloth is plain where creases go (IC-M09b revised); scorches are a clear iron shape.
3. Keyboard movement eases in; the stick stays direct. Tests cover both rules.
4. The steam-and-heat core is kept; the Glove Dove is being redesigned instead.
Shared item 2: a scorch costs 1 (was 2). Pass 16; bots: beginner 19–25, good 36–39, steaming on the spot 0, sweeping 0–1, idle 0.

## Wetweather Wren: Puddle Hop

The street scrolls; press to pop the umbrella and hop, hold to float, over
puddles; shelter little birds; walk under awnings with it shut.

**Findings**

- The core (press to hop, hold to float) is fun and readable, and the delivered
  chicks look good.
- Too many rules for 45 s: puddles, little birds, awnings (shut beneath),
  gusts, a narrow puddle under an awning (tap-hop only), a settle delay after
  landing, and the umbrella turning inside out if opened too often. A child
  meets a new rule every few seconds and can't tell why it stopped.
- The 0.3 s settle after landing makes a press feel ignored.
- The bonus pop says "+3" but adds 2 (the +1 for the puddle is counted
  separately).
- Beginners score 13–26 with a pass of 13; mashing reaches 8.

**Improvements**

1. Drop the inside-out rule and the landing settle; mashing is already held
   back by splashes and awnings. If mashing must still be checked, keep the
   bots' mashing under the pass mark by tuning puddle spacing instead.
2. Drop the narrow puddle under an awning (it asks for a third kind of press).
3. Make the pop say what it adds ("5 dry in a row! +2").
4. Re-tune so beginners sit above 13 on every seed.

**Changes made**

Done (71aebe9); details in `wetweatherwren.md`.
1. The inside-out rule and the landing settle are gone; a press on the ground always hops. Mashing is held back by wider puddles and the awnings instead.
2. No narrow puddle under an awning.
3. The streak pop says +2, what it adds.
4. Re-tuned: pass 15 (was 13). Bots: beginner 18–29, good 23–30, eight mashing rhythms 3–12, holding and idle 0; the test asserts every mashing rhythm stays below the pass.

## Glove Dove: Squeaky Clean

Move onto a spot on the dish and rub to wear it away; soap scrubs faster but
too much foams over.

**Findings**

- It plays, but it is Pressing Business again: move a tool in two dimensions
  over marks to wear them away, press for a timed booster (soap / steam) whose
  overuse is punished (foam over / scorch), next item when clear.
- Rubbing with the keyboard means tapping arrows back and forth, which is
  tiring; spinning the stick works but is not obvious.
- Scores are small (beginners 7–8, good 11–13, pass 7), so one slow dish is a
  big share of the score.

**Improvements**

1. Rework the core so it is not a second Pressing Business. Keep the theme
   (washing up, the long pink glove) and give it a different verb, for
   example: dishes come along the draining board, each with one kind of
   grime, and the Dove must scrub in the way that grime needs (circles for
   crust, back and forth for jam) shown by a picture on the dish; or a
   catch-and-stack game where clean wet plates slip from the Dove's grip onto
   the rack. Whatever it becomes, it should share no mechanic with Pressing
   Business.
2. If the rubbing stays, make the action itself scrub (hold A to scrub where
   you stand, with a jiggle), so keyboard and controller don't need to waggle.
3. Score spots, not dishes (one per spot, a bonus per dish), so the number
   grows steadily.

**Changes made**

Reimplemented (71aebe9) as **Slippery Dishes**; details in `glovedove.md`.
1. A new core around the painting, sharing no mechanic with Pressing Business: wet dishes pop out of the sink and the Dove runs to catch them on its long level glove neck; a press as one lands flicks it up into the rack ("Hup!"), too soon is only a hop, no press lets it slip. A dish in the rack is put away; one that falls smashes, with no points lost.
2. Not needed: there is no rubbing any more.
3. Scoring climbs steadily: 1 per Hup, 3 per dish put away.
Its art is revised: side-on dishes, catching and flicking poses (IC-M11b, e, f); the grime and scrubbing requests are dropped. Pass 35. Bots: beginner 54–73, good 75–92, mashing under dishes 8–29, never pressing 0, idle 0.

## Ten O'clock Tit Trush: Set the Clocks

Turn the watch's hands to the time a town clock calls, then press to set it.

**Findings**

- Beautifully readable: big face, the time in words and digits, a patience
  bar, the ghost hands at first, and the watch shows its own digits.
- Turning takes too long: a target can be up to 5.5 hours away, and one turn
  of the stick is one hour, so a child spins five or six full circles; on
  touch, drags five or six full circles round the face. The patience falls
  to 8 s.
- The controller has no hour jump (↑ / ↓ is keyboard only); the stick held
  left or right accelerates, but children won't find it.
- Reading "twenty-five to nine" or "7:43" is a school skill some players
  won't have yet; the digits on the watch make it a matching game, which is
  fine, but the later rounds are hard for the youngest.

**Improvements**

1. Keep targets within three hours (`far` up to 180) and give an hour jump on
   every device: LB / RB on the controller (the `left` / `right` steps), and
   on touch dragging the short hour hand moves hours.
2. Let patience scale with how far the target is (base plus 1 s per hour).
3. Keep "any minute" for the very end only (from clock 16, say), and keep
   showing the digits under the words throughout.

**Changes made**

Done (71aebe9); details in `titthrush.md`.
1. Targets stay within three hours, and there is a whole-hour jump on every device (↑/↓, the D-pad or a quick stick flick, and dragging the short hand on touch).
2. Patience is 9 s falling to 6 s, plus 1 s for every hour the hands must travel.
3. "Any minute" times start only from the sixteenth clock.
Pass 9 (was 8). Bots: beginner 11–13, good 25–27, keyboard 23–24, whirling and mashing 0, idle 0.

## Plugsocket Swift: Lights On

Fly to asking windows and plug their lamps in; unplug sleepers to keep the
fuse under its limit; flip the fuse when it blows.

**Findings**

- A good juggling game with a clear house of twelve windows, timer rings on
  the bubbles and a fuse box with a lit-lamp count. Bots show skill (beginners
  13–16, good 19–20, greedy 5–7).
- The fuse rule (three lamps safe) is the thing a child must learn; the box
  shows dots but not the limit.
- On a phone (span 820 following the Swift) the fuse box at x = 230 is off
  view when the Swift is at the right-hand windows.

**Improvements**

1. Draw three dots green and the rest red on the fuse box, so "three is
   safe" is visible.
2. On a phone, show a small fuse warning at the view's edge when it heats.

**Changes made**

Done (c9139be); details in `plugsocketswift.md`.
1. The fuse box's first three lamp places are pale green and the rest pale red; the lamps light green, then amber for the fourth, then red.
2. On a narrow screen, when the fuse box is out of view and heating or blown, a small copy of the count and the heat shows at the view's edge.
Pass stays 12. Bots: beginner 13–16, good 19–20, greedy 5–7, mashing 2–5, idle 0.

## Saltshaker Shrike: Just a Pinch

Shake the number of pinches each plate's flag shows as it slides past;
puddings want none.

**Findings**

- Readable: flags with empty circles that fill, the crossed-out shaker on
  puddings, a dotted drop line.
- The pass mark sits too close to cheap play: shaking on the spot scores
  2–26 against a pass of 30, while beginners score 31–45.
- Shares the conveyor-plus-lead shape with Snip Snap and Button Up.

**Improvements**

1. Score per plate only when it has some salt and isn't over (already so),
   and stop "shaking on the spot" from catching plates by luck: make plates
   one at a time under the Shrike faster than salt can fall, or shrink
   `FOOD_HALF` slightly, so a static shaker over-salts more. Target "still"
   below 20.
2. Raise the pass mark to about 32 once "still" is lower, keeping beginners
   above it.
3. Make it look less like the other conveyors: plates could come down a
   dumbwaiter or round a lazy Susan rather than along a straight counter.

**Changes made**

Done (c9139be); details in `saltshakershrike.md`.
1 and 3. The counter is gone: plates ride a revolving table that creeps at the ends and swings fast through the middle, where shaking on the spot would sit; a narrower catch; orders of two to five pinches after the first nine seconds. It no longer looks like the other slide-past games. New art: the table (IC-M14e) and a café scene with no counter (IC-M14a).
2. Pass stays 30, not 32, since the beginner bot's lowest over twelve seeds is exactly 30.
A salted pudding costs 1 (was 2). Bots: beginner 30–45, good 36–57, shaking on the spot 0–13 (asserted below 20), mashing 0–14, over-salting 0–4, idle 0.

## Soupladle Lark: Soup's On

Put the ring round exactly what the creature ordered in the swirling soup and
dip.

**Findings**

- A good, distinct mechanic (pick an exact set from a moving crowd) with clear
  order bubbles and patience bars.
- The Lark stand-in stands over the ring, so its body and wings cover the bits
  near the ring, the very place you need to see.
- Peas (20 px) are small for the swirl speed.

**Improvements**

1. Draw the Lark above and behind the ring (offset up and to the side, its
   bowl over the ring's centre), or fade it to half while hovering, so the
   ring's inside is never covered.
2. Draw peas larger (about 26 px).

**Changes made**

Done (c9139be); details in `ladlelark.md`.
1. The Lark hovers well above the ring, drawn smaller while only hovering; while it dips, the part below the soup is hidden behind ripples.
2. Peas are bigger (26 px, was 20).
A Yuck costs 1 (was 2). Pass stays 36. Bots: beginner 44–55, good 55–82, careless grabbing 34–52, mashing 0–13, idle 0.
The delivered painting has the ladle's hook floating apart; it is requested again in one piece (IC-R15b, 5411aa4).

## Drippet: Drip Drop Dash

Run to thirsty things to fill them, avoiding the slippery puddles your own
drips leave; hop over puddles.

**Findings**

- Readable and lively: the trail of puddles is clear, so is "Whoops!".
- Hopping all the time scores 14–16, above the pass (10) and close to good
  (19–23); the test only checks it is below good on average. The hop/puddle
  choice hardly matters.
- The fill takes only 0.5 s, so the skill is mostly running.

**Improvements**

1. Make a hop cost more: a longer rest after landing, or landing on a fresh
   puddle also skids. Target "bunny" below the pass mark.
2. Add that to the test: `Math.max(...hops) < pass`.
3. Consider the thirsty things moving away from wet tiles (a cat bowl the cat
   pushes), so the trail you lay changes where you go.

**Changes made**

Done (31b7f8e); details in `drippet.md`.
1. Hops cost more: a 1 s rest after landing (stumbling at first), landing in any puddle skids, a landing shakes out more drips, skids last 2.2 s; puddles come faster and filling a thing takes 0.7 s.
2. The tests assert that hopping everywhere and running straight without looking both stay below the pass.
3. The cat's bowl slides away from slippery puddles.
Pass 11 (was 10). Bots: beginner 11–17, good 17–22, hopping 7–10, never looking 5–10, circling, mashing and idle 0. Tuning is tight: across 10 seeds one beginner seed scored 11 and one hopping seed 15.

## Saw Bird: Saw It Straight

Saw with long left-right strokes while steering up and down to keep the cut on
the chalk line.

**Findings**

- Readable: the chalk line, the cut drawn over it, the stroke gauge and the
  rhythm dots; good grading pops.
- On a controller both jobs are on one stick: stroke left and right and
  steer up and down at the same time is a diagonal waggle, hard for a child.
  The keyboard (hold ↑ while tapping ← →) is easier; touch is natural.
- Steering against drift to keep on a line is Stitch in Time's game
  (Pincushion Piffle); the strokes are new, the steering is not.
- The bots score the same on every seed (44 and 70), so the test doesn't
  check the ramp across seeds.

**Improvements**

1. On the controller, move one job off the stick: steer with the stick, saw
   by pressing A in rhythm (or with the right stick), or saw with the stick
   and steer with LB / RB.
2. Make the steering its own thing rather than Piffle's: for example knots to
   steer around, not just a pull.
3. Add randomness that changes the bots' scores across seeds (grain, knots),
   or test several plank layouts.

**Changes made**

Done (31b7f8e); details in `sawbird.md`.
1. One job per control: holding the action pushes the saw and letting go pulls it, so the stick only steers on a controller; stick strokes still work.
2. Knots are obstacles on the line to steer round (none on the first plank, then more); sawing into one nearly stalls the saw. It no longer plays like following Stitch in Time's seam. Grades are tighter.
3. Knot layout and plank length vary by seed; the tests use six seeds.
Pass stays 30. Bots: beginner 38–44 (44–54 holding A), good 67–70, never steering 7–10, jiggling 1, mashing 0, idle 0.

## Radio Bird: Tune In

Turn the dial to find the station the listeners ask for and hold the needle
on it while its song plays.

**Findings**

- Skill hardly shows: beginners 7–9, good tuners 8–11. Each song takes 3.2 s
  of holding, so ten songs fill most of the 50 s whatever you do; the
  searching is the only skill.
- Any station you pass is pencilled on the dial, wanted or not, so after the
  first sweep the game is "go to the picture".
- The "signal" eye that closes is an abstract meter for a child.
- The action button slows the dial: an odd use of A, which elsewhere always
  does the thing.
- On a phone the view follows the needle (span 760), so the signal eye and
  speaker (x 700–900) leave the view when the needle is at the right.
- The page has no music (`tune: null`); fine, as the stations play.

**Improvements**

1. Shorten the song (1.5–2 s) and add a quick-find bonus, so finding fast is
   what scores.
2. Make the marks less certain: drift more from the start, or pencil only
   stations you held for a moment.
3. Replace the eye with something literal: the speaker crackles and its
   picture fades in as you get close, and the listeners lean forward.
4. Use A for something that matters (press to "lock" a station and start the
   song), and make fine tuning automatic near a station (a gentle snap).
5. Keep the signal and speaker in the phone view: draw them under the needle,
   or a small copy at the view's edge.

**Changes made**

Done (31b7f8e); the game is largely rebuilt, details in `radiobird.md`.
1. Songs are shorter (1.8 s) and each scores 10 plus up to 10 for a quick find, so skill shows: score is now points.
2. A station is pencilled only once played or rested on; stations drift from the start.
3. The magic-eye meter is gone: the speaker crackles and the nearest station's picture fades in through the static, and the listeners lean forward as you near the one they want.
4. A plays the station (or letting go of the needle with a pointer); a wrong one costs a 0.7 s grumble, no points. The needle settles on a nearby station when left alone.
5. The speaker and a tag for the wanted station ride under the needle, which the phone view follows.
Pass 75. Bots: beginner 85–207, good 251–317, sweeping, creeping, mashing and idle all below 75 (asserted).

## Second audit: with the delivered art

On 2026-10-09, after the art for all eighteen was delivered and fitted
(f719a7e, 2c6339b, 88966a2, af2078c, 404878d and the earlier sprite fits),
each game was played again in Chromium at 1280 x 720 (controller) and
390 x 844 (touch). Its own test bots drove it: the good bot all round, then
random mashing, then the phone. Screenshots were taken every 0.45 s from the
bird's page to the end (in the session scratchpad, `audit2/<id>/`). I looked
for feet on the ground line, poses that jump when they swap, held things
lining up (beak and glass, claws and ring, iron and cloth, bowl and soup, saw
and plank, lid and bin), z-order, clipping by the HUD and screen edges,
leftover stand-in shapes, stretching, and text over the paintings. I also
measured every delivered pose sheet's painted box per cell, to look for size
or foot-line jumps between poses.

`node --test test/*.test.mjs` passes (184 tests). `node scripts/browser-check.mjs --bird <id>` passes for all eighteen.

**Finding about the checks themselves.** The browser checks step the game at
`?dt=0.05`, a third as often as the 60-a-second steps the bots were tuned at.
At that step the timing bots fall apart. Bin Day's good bot scored 3–6
instead of 41–44, and Set the Clocks' scored 11–12 instead of 25–27. Run
three 1/60 s sub-steps per frame and the browser scores match the tests
(Bin Day 41, Set the Clocks 24). This is an artefact of the test step, not a
bug in the games: in real play the shell's steps are at most 0.05 s and
usually 1/60. A game whose timing windows are shorter than 0.05 s would
still be at risk on a slow phone.

### What was right everywhere

No leftover stand-in shapes show beside the paintings in any of the
eighteen, and nothing is stretched. Feet stand on their ground lines: the
Goose behind the glasses, the Midge on its crates, the walkers and the
Keeper on the promenade, the Buttonbeaks behind the tin, the Wren on the
pavement, the Dove on the counter, the Drippet on the tiles, the Radio Bird
on its rug. Every pose swap keeps its anchor: the Shrike's claws stay on the
rail in all four poses, and the Lark's bowl point is the same in all three
(checked against the sheet). The Key Crane's claws close on the ring. The
iron's sole sits on the cloth and the saw's teeth sit in the cut. The canary
lid swings on its hinge with its head under it.

### Shared changes

- `game/src/draw.js`: `label()` takes a `halo` option, which rings the
  letters in cream paper so they read over a busy painting. A new `hint()`
  draws a game's opening hint haloed. On a narrow screen it splits the line
  at " · " when it is wider than the game's `span`, and keeps each line
  inside the view around `focus` and above the bottom edge. This is the only
  file outside the eighteen that I touched; it is not on the other agent's
  list.
- Every game's `pop()` now steps a new pop clear of one still showing
  nearby, instead of printing on top of it (Bin Day already did). Seen in
  Milk Round ("Clink!" over "Smash!"), Snip the String and Tune In. Files:
  every `game/src/games/<id>.js` of the eighteen except `garbagecanary.js`.
- The opening hints of Milk Round, Glass Harp, Snip Snap, Clean Sweep,
  Button Up, Snip the String, Puddle Hop, Lights On, Just a Pinch, Soup's On,
  Drip Drop Dash, Saw It Straight, Set the Clocks and Tune In now use
  `hint()`. On a phone they used to run off both sides (Tune In, Soup's On,
  Milk Round, Snip Snap); now they are whole, and haloed over the painting.

### Per game

**Milk Round: fixed.** Checked the float, the Midge's throw and mood poses,
houses, path and fence, the dog, and the bottle arc; all aligned. Pops moved
with the street and were cut off at the left edge, and stacked when a
"Clink!" and a "Smash!" came together. They now stay whole on screen and
step clear of each other. The hint went over the clock and off the phone
view; it now sits under the clock as two lines over the float. File:
`games/milkmidge.js`.

**Glass Harp: fixed.** The tapping beak reaches the rim. The poses were all
placed as if their feet were at 0.98 of the cell, but the walking and
recoiling cells have them at 0.93. So the Goose floated about 16 px above
the table while it stepped between glasses or recoiled from a crack, and
dropped back when it stood. Each sheet is now placed by its own foot line
(0.99 tapping, 0.93 moving). "Listen…" and "Your turn!" were faint over the
wallpaper; they are now haloed. File: `games/waterglassgoose.js`.

**Snip Snap: fixed.** Walkers, the Keeper's three poses, the swoop and flap
poses and the nest all fit. The hint sat over the HUD clock at the top;
it is now under the Niffy, haloed, and whole on a phone. File:
`games/niffy.js`.

**Snip the String: fixed.** Balloons and kites hang from their strings, and
the Snippit's hinge is on the knot line. The "Let go of" tag sat under the
clock's lower edge, and "Quick! +15" pops rose into it. The tag moved down
14 px, pops stay below y 300 and inside x 220–1380, and "Wrong string!"
sits above "Jammed!". A painted kite can still pass behind the tag when the
bunch drifts high; that is acceptable. File: `games/snippit.js`.

**Button Up: meets the bar.** Coats hang from the line, buttons sew into the
ghost holes, and the bowls sit on the tin. Pops now step apart.

**Clean Sweep: meets the bar.** The broom poses, dustpan sides and sweepings
all fit; the slide line and glow read well.

**Lucky Dip: meets the bar.** The claws meet the ring, the prizes stand on
the velvet, and the startle pose keeps the string's anchor.

**Bin Day: meets the bar.** The lid, head, call poses and things all fit
(see the strip of the lid opening). Gold rings make "keep" things obvious.
The bots only looked broken in the browser because of the step size (above).

**Pressing Business: meets the bar.** The sole is on the cloth and the
creases are clear on the delivered garments. The silk label and scorch marks
read well.

**Puddle Hop: meets the bar.** The Wren walks and floats on the pavement
line; the splash pose stands in its puddle; the chicks and awnings fit.

**Slippery Dishes: meets the bar.** The dish lands level on the glove's neck
(checked frame by frame), and the catch and flick poses keep their feet.
Fun: the clearest of the rebuilt games; a child sees the "Hup!" at once.

**Set the Clocks: fixed.** The watch face, town clocks, hands and the
singing and fluster poses all fit. Three things fought with the hands or the
clock:
1. The digital time was written under the hands' pivot, where the long hand
   covered it half the time ("4:30" under the 6). It is now on a small
   cream card under the case.
2. "Right on time!" and "Set!" popped above the case, behind the HUD clock.
   They and "Not quite!" now pop on the face, haloed.
3. The control hint ran off a phone's view; it now uses `hint()` at the
   foot.
"Jammed!" is haloed. File: `games/titthrush.js`.

**Lights On: meets the bar.** Windows, the fuse box and the three Swift
poses fit; the plug-in dive meets the socket.

**Just a Pinch: meets the bar.** All four hanging poses keep the claws on the
rail and the cap over the salt line (checked at full size); the plates sit on
the revolving table.

**Soup's On: meets the bar.** The bowl point stays put through hover, dip and
rise (checked on the sheet), and the dip clips under the soup. Hint fixed by
the shared change.

**Drip Drop Dash: fixed.** While pouring, the Drippet stood on top of the fern
pot, hiding it, with its stream falling beside it. It now leans its drawing
(and shadow) over so the spout is above what it fills, easing back when done.
Only the drawing moves; where it stands, and so the tests and bots, are
unchanged. File: `games/drippet.js`.

**Saw It Straight: meets the bar.** The teeth sit in the cut, the planks lie
on the sawhorses, and knots are drawn on the line. The knot art is still to
come (IC-M17f, already requested); until then the code-drawn knots read
clearly.

**Tune In: meets the bar.** The dial, needle, speaker card, listeners and the
three Radio Bird poses fit. The hint ran off a phone; fixed by the shared
change. The radio parts (IC-M18f) are already requested.

### Requests for the lead

- No new image requests: nothing found needs new art. The three still
  outstanding (IC-M17f knots, IC-M18f radio parts, the dish shards and watch
  crown sheets that `src/games/glovedove.js` and `titthrush.js` list) are
  already in the request documents.
- `scripts/browser-check.mjs` (the other agent's file): its "every minigame"
  round plays with random input at `?dt=0.05`, which is fine for "no errors,
  reaches the result card". Anyone using it to judge scores should know the
  bots need 1/60 s steps.
- No redesigns proposed: all eighteen are clear and playable with their art.

## Third audit: sprite scale across poses

On 2026-10-09, after the report that "the sprite sizes are not coordinated:
the bird seems to shrink and grow as he crouches". Every game that swaps
between painted pictures of the same character was checked: the bird, and
recurring characters (the Crow's chicks, the soup queue, the diners, the
listeners, the Park Keeper). Garbage Canary, Wetweather Wren, Glove Dove, Key
Crane and Steampresser Sparrow were left to the agents fixing them; one
finding for Puddle Hop is passed on below.

### How it was measured

The size a pose shows the character at is (the scale the game draws the cell
at) x (the scale the character is painted at in that cell).

- **Drawn scale.** For each cell: from the game's code, and in Chromium by
  wrapping `drawImage` and recording the screen pixels per source pixel of
  every sprite drawn during a bot round and a mashing round (scratchpad
  `audit3/`). In the tests, the same comes from a mock canvas (below).
- **Painted scale.** For each cell against the standing portrait: SIFT and
  ORB keypoints matched between every pair of the character's cells, each
  pair fitted with a similarity transform (RANSAC), and the scales solved
  together by weighted least squares, the two detectors averaged. Where they
  disagreed, or a family was weakly linked, a rigid part was checked:
  - template matching of the head, the watch dial or the broom's binding
    over scale and rotation;
  - the area of the Saw Bird's wooden handle;
  - the diameter of the chicks' eyes.

  The script is `design/source/measure_pose_scales.py` (needs opencv-python).
  The results, with the method for each, are in
  `design/source/pose-scales.json`.
- **Pose strips.** Every pose drawn at its in-game scale, side by side on
  one baseline (scratchpad `audit3/strip-<game>.png`), looked at for each
  changed game.

Cross-checks on rigid parts, where a strong template match was possible:
the Coot's cone and scoop body 0.93 and 0.91 (consensus 0.932, 0.909); the
Gullfinch's gramophone 0.97 (0.965); the Trush's dial singing 1.01,
flustered 0.95, perched 0.84 (0.995, 0.958, 0.831); the Midge's beak and eye
when throwing 0.96 and 0.93 (0.962, 0.935); the Niffy's knife 0.97–1.03; the
Saw Bird's handle 0.976, 0.775, 0.754 (ORB 0.957, 0.822, 0.782). In the
browser after the fixes, every pose of every changed game shows its character
at 1.000 of standing, except where the median mixes positions: depth
(Broomwhisk, Drippet) or chicks of different sizes (Crow). The tests cover
those games at one position.

What made sizes jump:

1. Poses fitted by a height that changes with the pose. The Snippit was
   scaled by its eye-to-claws height, so a stooping pose was drawn bigger
   and one looking up smaller. The soup queue was fitted by each picture's
   outline, so the rabbit, ears down, grew.
2. Pose sheets painted at a different scale from the portrait, drawn at the
   portrait's framing. This affected the Goose, the Midge and the Coot, and
   one sheet of Clock Hop against the other.
3. One correction for a whole sheet whose cells are painted at different
   scales (Button Up, Clean Sweep).
4. A correction measured on a part that changes. The Drippet's cross handle
   is foreshortened when it tips. The Saw Bird's snagged blade is bowed, so
   its chord is short.

### Per game

Numbers are each pose's shown size against the standing (or default) pose,
before → after. "Painted" is the measured painted scale against the portrait.

| Game | Verdict | Before | After |
| --- | --- | --- | --- |
| Clock Hop (Tit Trush) | fixed | singing 0.88, flustered 0.85, flying 0.95 of perched | all 1.00 |
| Snip the String (Snippit) | fixed | snipping 1.03, striding 1.07, jammed 1.06, watching 0.93 | all 1.00 |
| Button Up (Buttonbeaks) | fixed | holding 0.94, tossing 0.94, striding 1.02, pecking 0.93, dazed 0.98, cheering 0.98 | all 1.00 |
| Clean Sweep (Broomwhisk) | fixed, needs re-request | every pose 1.12–1.24 (head up to 1.31) | all 1.00 by the mean of head and broom; head 1.04–1.12, broom 0.89–0.96 |
| Glass Harp (Goose) | fixed | every pose 0.96–0.97 | all 1.00 |
| Milk Round (Midge) | fixed | flinging 0.94, others 0.96–1.00; feet up to 5 px off | all 1.00, each cell on its own foot line |
| Drip Drop Dash (Drippet) | fixed | hopping 0.94, skidding 0.97, running 0.97, pouring 0.94 | all 1.00 |
| Saw It Straight (Saw Bird) | fixed | snagged 1.09, proud 0.94 of sawing | all 1.00 |
| Soup's On (Lark, queue) | fixed | Lark poses 0.98–0.99 (fine); queue: rabbit pulling a face 1.13, hedgehog 0.94, bear 1.03 | queue all 1.00 |
| Safe Crossing (Crow's chicks) | fixed | flying chick 0.85; standing chicks 0.95–1.03, walking 0.97–1.00 | all 1.00 |
| Scoop Stack (Coot) | fixed | striding 0.93, looking up 0.91; stride's feet 20 px high | all 1.00, feet on the line |
| Wind and Sing (Gullfinch) | fixed | singing 0.965 | 1.00 |
| Tea Time (Cupadee) | fixed | open 1.034 | 1.00 |
| Snip Snap (Niffy) | OK | dive and flight 0.98–1.01 | unchanged; Park Keeper's three outlines match |
| Lights On (Swift) | OK | 0.97–1.00 | unchanged |
| Just a Pinch (Shrike) | OK | 0.97–1.00; diners' two pictures match | unchanged |
| Tune In (Radio Bird) | OK | 0.99–1.04; each listener's two pictures painted alike, drawn whole-cell | unchanged |
| Say Cheese, Bloom, Left Foot Right Foot, Hot off the Press, Stitch in Time, Spot the Dodo | OK | no pose sheets of one character (the boots are one pair, painted alike, 1.025) | unchanged |

### Changes made

- `game/src/draw.js`: the original ten's painted variants (the Coot's stride
  and look-up, the Gullfinch singing, the Cupadee open) are drawn by their
  painted scale and stand on their own foot line (`VARIANTS`).
- `game/src/games/titthrush.js`: every pose is drawn at the perched pose's
  size (`PAINTED`, `POSE_CELL`). Before, the singing and flustered poses
  were drawn at the portrait's framing, so the Trush shrank by an eighth
  every time it landed.
- `game/src/games/snippit.js`: one scale for every pose (`SHOWN` over each
  cell's `painted`); claws on the ground, eye over the snip point.
- `game/src/games/buttonbeaks.js`: a painted scale per cell (`poseK`), not
  per sheet; the held button follows.
- `game/src/games/broomwhisk.js`: a painted scale per cell, replacing one
  factor of 1.27 for all.
- `game/src/games/waterglassgoose.js` (`POSE_PAINTED`),
  `game/src/games/milkmidge.js` (`POSE_CELLS`, with foot lines),
  `game/src/games/drippet.js` (`POSE_PAINTED`): a painted scale per cell.
- `game/src/games/sawbird.js`: snagged and proud poses scaled to the sawing
  one (`POSE_K`).
- `game/src/games/ladlelark.js`: each creature in the queue is drawn at one
  scale whether it waits or pulls a face; `spriteCell` was used there but not
  imported, which the new test caught.
- `game/src/games/crow.js`: a painted scale per chick cell
  (`CHICK_PAINTED`).
- Tests: `game/test/sprite-rig.mjs` (new) registers the delivered sheets at
  their true size and alpha, so `spriteCell` trims as in a browser. It draws
  a game into a recording canvas and multiplies each drawn scale by the
  measured painted scale. Each changed game's test file has a test that
  every pose shows the character within 5% of the standing size; the Coot,
  Gullfinch and Cupadee tests also check the feet. Files: `waterglassgoose`,
  `milkmidge`, `snippit`, `buttonbeaks`, `broomwhisk`, `drippet`,
  `sawbird`, `titthrush`, `ladlelark`, `crow`, `coot`, `gullfinch` and
  `cupadee` `.test.mjs`.
- `design/source/measure_pose_scales.py` and `design/source/pose-scales.json`
  (new): the measurement and its results.

### Requests

- **Re-request IC-M06d and IC-M06e (the Broomwhisk's pose sheets).** "Paint
  the Broomwhisk at exactly the scale of its portrait painting in every
  cell: the head (from the beak's tip to the back of the eye) and the broom
  (the binding cord's width) both the same size as in the portrait. In the
  delivered sheets the head is the portrait's size but the broom is about
  12% smaller (the binding 0.80 to 0.93 of the portrait's), so the bird
  cannot be drawn one size." Until they arrive, the game uses the mean of
  the two.
- **For the agent on Puddle Hop** (`wetweatherwren.js`, not touched): the
  little birds' standing (`sprites.chicks` cell 0) and flying (cell 5)
  pictures are both drawn at `h: 70` on their outlines, 372 and 429 px tall.
  The flying chick is also painted smaller (0.851 of the standing one, by
  its eye), so a chick shrinks to about three quarters as it flies off.
  Drawing cell 5 at `h: 70 * 429 / 372 / 0.851` (about 95) would keep it one
  size.
