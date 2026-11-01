# The Ice-Cream Cone Coot: design

A game made from Arnold Lobel's *The Ice-Cream Cone Coot and Other Rare
Birds* (1971). It plays as a field guide: each page introduces one of the
book's rare birds, and then you play a short minigame as that bird, doing
what its object does. What the book looks like is in
[`../reference/README.md`](../reference/README.md).

It is for school-age kids, at about the level of Mario Party minigames: easy
to pick up, short (30 to 60 seconds), with a real score to beat. Each game
keeps your best score, has one score to reach to spot the bird, and gets
harder the longer it runs. There are no medals or grades: beating your best
says "New World Record!" and nothing more specific.

## Flow

1. **Title.** The logo and Press Start together in the sky at the top, clear
   of the birds walking the lane below; the Coot stands in the picture where
   there is room (by the wall, or on the riverbank on narrower screens). The
   Controls, Settings and Fullscreen buttons sit in the corner (see
   `GAME_GUIDELINES.md`).
2. **The field guide.** A card for each of the book's 28 birds, in order:
   the ten below first, then the other 18 (the Milkbottle Midge to the Radio
   Bird; their games are in [`more/`](more/)). Every card can be picked and
   played from the start, in any order. A bird not yet spotted shows as an
   ink silhouette on a darker card, with its name and its game's name; you
   see it in full only in its game until you reach its score, which spots it:
   then its painting shows on its card, its page and in the sticker book.
   Each tab shows your best score, and the heading counts the birds spotted
   ("3 of 28").
   The cards sit seven to a row (five on a narrower screen, three on a phone
   held upright) in a sheet that scrolls, its top and bottom edges fading
   like paper running on; the chosen card is always scrolled into view. Down
   goes to the card below, not to the buttons, until the last row; left and
   right run on from the end of one row to the next. The chosen card is
   unmistakable from the sofa: it lifts and grows, ringed in pink with its
   name on a pink tab, its bird comes alive, and the other cards fade back a
   little. Only the cards in view are drawn, and only the chosen one every
   frame. Under the cards: Back, the Sticker Book (Y on a controller) and
   Settings.
3. **The bird's page.** The bird large on cream paper, gently alive (it
   breathes, blinks, shuffles, does its thing now and then), with its name, a
   short rhyme in the game's own words (not the book's verses), and how its
   game plays: the goal, the controls for the device you are using, a few
   tips, and the score that spots the bird (until you've reached it) or your
   best. Until the bird is spotted its picture here is a still silhouette and
   the page number says "Not yet spotted"; its name and rhyme are there all
   along, as an introduction. One button,
   Play, starts the game; B, Esc or the × in the corner goes back to the
   guide.
4. **Play.** A 3-2-1 count, the game, then "Time!".
5. **Result.** The first time a round reaches the bird's score there is no
   result card but a celebration (about six seconds), drawn in the book's
   ink and watercolour: the bird's portrait pops in as a die-cut sticker (a
   cream margin following its outline, a cut edge, a shadow, a light sweeping
   across it) with its name; the field guide's sticker book opens under it,
   at the spread with the bird's place: the book has two spreads of 14
   (pages 1 to 14, 15 to 28), each two facing pages of seven places in the
   guide's order (rows of 2, 3, 2 side by side, or 4, 3 one above the
   other), the stickers already earned stuck in theirs (or wherever the
   player has put them, over the picture chosen for the book) and the rest
   pencilled outlines with their page numbers; the new sticker flies to its
   place and sticks with a slap and a puff ("4 of 28 birds spotted!", or
   "Every one of the 28 rare birds, spotted!" for the last). When
   the book is open at all the birds together (below) it opens at that one
   spread instead (upright, zoomed onto the bird's page), and the new
   sticker flies to its own greyed spot in the painting, shrinks to fit it
   and melts in with a bloom of its colour: the grey lifts and the bird is
   there in full colour, snapped in (and saved so) for good. Then the guide comes
   back with that bird's own card chosen, still its silhouette; it turns
   over to show its painting. Any press (A, Enter, Space, a
   click or tap) jumps to the next step; B, Esc or a long press skips to the
   end, where the card is already turned. With reduced motion the steps fade
   instead of flying and turning.

   Every other round shows the result card for about three seconds: the
   score, under "New World Record!" when it beats your best and reaches the
   bird's score ("Personal Best!" when it beats your best but falls short;
   otherwise "Time!" and your best), the score that spots the bird if you
   haven't reached it yet, and the game's own summary
   lines. It has no buttons: a little bar runs down, any press goes on
   sooner, and the guide comes back with the bird just played chosen.
6. **The sticker book.** From the guide (its button, or Y), the book alone,
   as large as the screen allows, with every sticker earned. Any sticker can
   be picked up and put anywhere on the pages of its spread: dragged with the
   mouse or a finger, or, with a controller or the keyboard, a little ink hand
   moved with the stick or the arrows picks it up with A (Space) and puts it
   down with A again; while carried it lifts with a shadow and follows. The
   one put down goes on top of the pile; stickers may overlap; one let go off
   the pages is kept just inside the nearer page. B (Esc) puts a carried
   sticker back where it was, and otherwise closes the book. LB / RB (Q / E,
   or the arrows by its name) change the picture behind the stickers: all
   the birds together (the book's first picture, below), the plain page,
   then a picture for each bird passed, in the guide's order, named by the
   bird. Each bird has its own painting for the book (IC-B01 to
   IC-B28, `book.<id>`: 2:1, a fold down the middle), drawn to the edges of
   both pages, its left half on the left (or upper) page and its right half
   on the other; until it arrives, the bird's game scene stands in, pasted in
   across the spread with its edges fading into the paper. Over a picture
   the headings and names sit on paper labels. LT / RT (Page Up / Page Down, or the arrows at the sides) turn
   between the two spreads. Every place (kept as a share of its page, so it
   stays put whether the book lies open side by side or one page above the
   other), the pile's order, the picture and the spread are saved
   (`icecreamcone.stickers.v1`) and kept from visit to visit; forgetting the
   scores in Settings empties the book too. In ?debug and ?all every sticker
   and picture is there. In ?debug nothing a round or the book changes is
   saved: scores, sticker places, the picture and even forgetting the scores
   last only for the tab's session (sessionStorage), starting from the saved
   game and leaving it untouched; settings are still saved.

   **All the birds together** is the book's first picture, and where it
   opens: one painting of all 28 birds in a woodland-edge farmyard (IC-U08,
   `book.gathering`, 2:1, with `assets/book/gathering.atlas.json` giving
   each bird's region), the first spread's 14 on its left half and the
   second's on its right. All 28 share it, so the book shows it as a
   single spread of two square pages (each half whole, nothing cut off),
   and LT / RT do not turn (the arrows at the sides go away). Every bird's
   spot starts greyed: the painting in a soft rounded patch over its region
   washed out toward the paper, only its ink lines left faint, with a faint
   dashed outline and its number on a little tag (faint until its sticker
   is earned, then inked in pink: waiting). Earned stickers not yet placed
   wait on a sticker sheet beside the book (a column either side when wide,
   the first page's birds on the left; a strip under it when upright), as
   large as there is room for. A sticker is carried at its own size, and
   its own spot glows while it is. Dropped with its centre on or near its
   own bird (and not on the fold) it snaps in: it shrinks and moves onto
   the spot, then melts into the painting, which takes its colour. Dropped
   on another bird's spot it gives a little shake and stays loose there;
   anywhere else on the pages it stays loose at full size, as on the other
   pictures; off the pages it goes back on the sheet. A filled spot can be
   picked up again (dragged, or the hand and A): the sticker pops back out
   to full size in hand and the spot greys again; B puts it back in. The
   spots snapped in and the stickers left loose on this picture are saved
   with the book (`snap` and `gpos` in `icecreamcone.stickers.v1`, which is
   now `{ v: 2, pos, bg, spread, gpos, snap }`; an older save still loads,
   with nothing snapped, and its picture, if it was the plain page, the old
   default, becomes the gathering). With reduced motion the snap is a
   short fade and nothing shakes.

   On a small screen the painting's pages are drawn larger than the room
   for them and the view scrolls over them rather than shrinking the birds:
   upright, the page fills the screen's width and scrolls up and down (one
   page at a time, the birds about twice as big as both pages stacked);
   held sideways, it is zoomed until a page is about 420 pixels and scrolls
   both ways. Drag an empty part of the picture to look around; carrying a
   sticker (or moving the hand) near the window's edge scrolls that way, so
   any spot can be reached. The sheet stays put, and every place is kept
   in the painting's own coordinates, right at any zoom or scroll.
7. **The gathering.** When every bird has been spotted, a final page shows them all
   together, like the book's endpapers (IC-U05b, `ui/gathering.webp`, 16:9,
   filling a wide screen; upright, the sticker book's 2:1 painting instead,
   its left half above its right across the screen's width, so the birds
   stay big). Its heading sits on a paper label over the painting, and the
   bird under the mouse or a finger shows its name on a little label (from
   the paintings' atlases). Any bird can be replayed at any time.

**Settings** are only Volume (one slider; music and effects keep a fixed
balance under it), Sound, Vibration, Fullscreen and Difficulty. (There was an
Unlock all switch while pages opened one after another; every bird is
playable from the start now, so it is gone, and an old saved setting is
ignored.) Motion follows the
device's reduced-motion preference. Forget my scores asks first (No is the
default) and keeps the forgotten scores aside, merged with anything forgotten
before (`icecreamcone.progress.backup.v1`, with the sticker book in
`icecreamcone.stickers.backup.v1`); while they hold a better score than
today's, Restore my scores appears and brings back the best of then and now
for every bird, and the sticker book too if it has been left empty since.

**The pause menu** has only buttons that do something: How to play, Settings,
and, small at the foot, Restart and Exit to Field Guide. There is no Resume
or Back button: B (or Esc, or the Menu button again), the × in the corner, or
a click or tap outside the dialog returns to the game. Exit to Field Guide
asks nothing: the round so far counts as if it had ended (a new best is kept),
and if that score spots the bird for the first time its own card turns over
as the guide comes back (no celebration then). How to play shows the
bird's card again, with a Controls button for the simple controls page. These
two pages have nothing else to choose, so A goes straight back to the game
and B steps back one page; nothing is focused until the stick moves.

The score to reach is the same for everyone and fairly gentle; beating your
own best is the long game.

## Controls

Every minigame uses the same small set of inputs, so kids learn them once.

| Action | Controller | Keyboard | Mouse / touch |
| --- | --- | --- | --- |
| Move | Left stick or D-pad | Arrow keys or WASD | Point (the game follows the pointer) |
| Action (press or hold) | A | Space or Enter | Click or tap (hold to hold) |
| Left / right step (Bobolinks only) | LB / RB, or X / B (both together for a double) | ← / → or A / D | Tap the left or right half |
| Pause | Menu or View | Esc or P | The pause button, top right |
| Menus | Left stick / D-pad, A, B | Arrows, Enter, Esc | Click |

## The minigames

These are the first ten; the other 18 (pages 11 to 28) are described in
[`more/`](more/), one file per bird, with their guide entries in
`game/src/more/`. Scores are whole numbers. The score that spots each bird (`pass`) is in
`game/src/birds.js`, tuned so it comes within a try or two.

### 1. Ice-Cream Cone Coot: Scoop Stack (45 s)

Scoops fall from the sky. Move the Coot left and right to catch them on its
head. Each scoop lands where it touches, so the stack leans; a stack that
leans too far topples and is lost, and you start again from the cone. Your
score is the tallest stack you build. Falling pickles and socks knock off
a scoop. Scoops fall faster as time goes on, and a golden cherry is worth
three.

A scoop that hits the side of the stack (or the Coot's head) clings there for
a moment, then slips down. How long it holds follows the physics: a stack
leaning away from it holds it longer, since that side faces up, and one
leaning towards it sheds it sooner; running towards its side presses it on,
running away peels it off, and a wobbling stack shakes it loose. A slipping
scoop comes to rest on a scoop that juts out below it, or on another
clinging scoop. A scoop that lands on a clinging one props it up, and if
it's high enough, level with the top, it is pushed up onto the stack.
Clinging scoops weigh on their side of the balance: they can tip the stack,
or steady one that leans the other way.

As the stack grows the view makes room, so there is always a good stretch of
sky above the top scoop, and new scoops start just above the top of the
view: a tall stack gets the same warning as a short one. First the Coot
steps back along the boardwalk, a little smaller with distance; then the
camera pulls back over the wide seaside painting (IC-S11), so the whole
scene shrinks together, down to half size. Until that painting arrives the
seaside stays put and only the Coot and its scoops shrink. The view closes
in again slowly after a topple.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets every knob, easy / medium / hard: scoops fall at 170 /
290 / 500 px/s, come every 1.2 / 0.92 / 0.45 s (plus up to 0.25), and pickles
and socks, none in the first 6 s, are 4% / 10% / 21% of what falls. Pass mark
stays at 6. Bots over 24 seeds (mean, range, share passing):

| Level | Idle | Run at random | Clumsy | Medium | Good chaser |
| --- | --- | --- | --- | --- | --- |
| Easier | 2 (1–4) | 3 (1–7) 13% | 6 (2–10) 54% | 10 (5–16) 92% | 29 (9–41) |
| Normal | 2 (0–5) | 3 (0–6) 4% | 6 (2–10) 63% | 8 (4–14) 88% | 29 (11–40) |
| Harder | 2 (0–5) | 2 (1–4) 0% | 5 (2–9) 38% | 8 (4–18) 83% | 24 (9–37) |

The score is the tallest stack, so luck plays a part: a random runner now and
then has scoops land on its head, as it did before the curve (about one round
in twenty at Normal with the mark at 6). The stack's balance, not the pace,
is what limits a weak player, so Easier helps a clumsy one only a little.

### 2. Cupadee: Tea Time (45 s)

A row of Cupadees walks in under the teapot one at a time. Hold the action
to pour and let go when the tea reaches the line. Close to the line scores
more, a perfect fill scores most, and a spill scores nothing and makes the
bird squawk. Later cups are smaller, walk faster or bob up and down.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) picks each Cupadee's cup as it joins the queue (the first two
are always big, still and lined at 0.72). Each knob, easy / medium / hard:
the line strays over a band 0.1 / 0.27 / 0.3 wide around 0.72; small (or
tiny) cups 0% / 58% / 65%, tiny 0% / 7% / 40%; bobbing 0% / 20% / 30%,
strolling 0% / 10% / 45%; strollers walk 34 / 49 / 68 px/s; patience 5.5 /
4.6 / 3.5 s. Pass mark stays at 600. Bots over 16 seeds (mean, range, share
passing); a pourer's miss is in time, so it grows on smaller and moving cups:

| Level | Idle | Mash | Hold | Clumsy (±0.22) | Medium (±0.14) | Good (±0.04) |
| --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 1 (0–10) | 0 | 629 (420–1010) 50% | 918 (610–1370) 100% | 1899 (1720–2060) |
| Normal | 0 | 15 (0–100) | 0 | 595 (370–1130) 44% | 863 (550–1170) 94% | 1960 (1750–2060) |
| Harder | 0 | 53 (0–200) | 3 (0–10) | 554 (380–970) 31% | 774 (610–1290) 100% | 1831 (1590–2100) |

Points come per cup and big still cups take longer to fill, so a gentler
round also serves fewer cups: Easier helps a clumsy pourer only a little.

### 3. Shuttercluck: Say Cheese (10 photos)

You are the Shuttercluck's eye. Any of the 28 guide birds or ten pocket birds peek out of
bushes, the wall, the tree and the gate for a moment: ten of our own (the
Hourglass Heron, the Spectacle Snipe and the rest, see
`game/src/subjects.js`) and those of the book's 18 later birds (the Milkbottle
Midge, the Key Crane, the Glove Dove...) whose pages in the guide are still
closed, decided as each round starts. Once every page is open only our ten
are left; in ?debug and ?all, with everything open, it is all 28 again. What
a round scores depends on the birds' rarity, not on how many there are to
find, so the score to reach stays the same. Each is drawn from its painting
(IC-R01 to IC-R18, IC-N01 to IC-N10). Move the viewfinder and press the
action to take a picture. A bird in the middle of the frame scores most;
rarer birds score more. You have ten shots. The results show your photos.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) follows how far along the round is (shots taken or time
spent, whichever is further). Each knob, easy / medium / hard: a bird stays
up 1.3 / 0.98 / 0.6 times its tier's time, its warning rustle runs 1.15 /
0.92 / 0.65 times, birds come every 1.15 / 0.84 / 0.45 s plus up to 0.6 s,
and up to 1 / 2 / 3 are out at once (one until medium; three only near
hard, so at Normal never more than two). Pass mark stays at 500. Bots over
16 seeds (mean, range, share passing):

| Level | Idle | Mash | Clumsy (slow swing, so-so frames) | Medium | Good |
| --- | --- | --- | --- | --- | --- |
| Easier | 0 | 6 (0–90) | 589 (410–850) 69% | 735 (530–1050) 100% | 1133 (1020–1310) |
| Normal | 0 | 7 (0–90) | 523 (420–710) 44% | 680 (500–920) 100% | 1135 (1020–1250) |
| Harder | 0 | 8 (0–90) | 407 (310–500) 6% | 643 (420–880) 88% | 1142 (1020–1340) |

### 4. Gramophone Gullfinch: Wind and Sing (one song)

Notes drift along the record's groove toward the needle. Press the action as
each one reaches it: perfect, good or miss. The spring runs down as you play,
and the song slows and sags; turn the left stick in circles (or mash the
action between notes, or drag in circles) to wind it back up. Score is the
accuracy, with a bonus for long streaks.

**Difficulty over the round.** The melody already moves from quarters to
eighths. On top of it the shared curve (`g.d()`, see `difficulty.md`), by how
far the song has got, sets the rest. Each knob, easy / medium / hard: tempo
72 / 89 / 110 bpm; timing windows 1.25 / 1.1 / 0.9 times their base width;
the spring runs down 0.7 / 1.1 / 1.6 times its base rate. Pass mark stays at
1500. Bots over 16 seeds (mean, range, share passing); timing errors are in
seconds, normally spread, with an occasional lapse:

| Level | Idle | Mash | Clumsy (sd 0.14 s) | Medium (sd 0.1 s) | Good (sd 0.03 s) |
| --- | --- | --- | --- | --- | --- |
| Easier | 0 | 39 (0–108) | 1564 (1210–1938) 63% | 2146 (1677–2805) 100% | 4923 (4339–5175) |
| Normal | 0 | 25 (0–83) | 1420 (1062–1759) 31% | 1900 (1514–2528) 100% | 4201 (3467–4563) |
| Harder | 0 | 19 (0–54) | 1177 (935–1433) 0% | 1551 (1223–1965) 56% | 3324 (2548–3651) |

### 5. Flowerpot Plume: Bloom (45 s)

Five Flowerpot Plumes sit on the bench, and a watering-can rose hangs above.
Move it left and right and hold the action to water. A watered plume grows
from sprout to bud to full bloom, and each bloom scores and resets to a
sprout. A plume left dry wilts and loses its growth; one watered too long
gets soggy and stops growing for a moment. Plants dry out faster as time goes
on.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets it. Each knob, easy / medium / hard: the pots dry at
0.06 / 0.15 / 0.27 a second (times each pot's thirst), slow enough at first
to tend one Plume at a time; a watered Plume soaks up to soggy 0.85 / 0.98 /
1.15 times as fast. Pass mark stays at 6. Bots over 16 seeds (mean, range,
share passing):

| Level | Idle | Mash | Sweep | Hold still | Clumsy (slow, late to move on) | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 0.3 (0–1) | 5 | 9 100% | 6.6 (6–7) 100% | 9.6 (8–10) 100% | 12 |
| Normal | 0 | 0.3 (0–1) | 5 | 8.3 (8–9) 100% | 6.0 (6–6) 100% | 9.6 (8–10) 100% | 12 |
| Harder | 0 | 0.1 (0–1) | 5 | 8 100% | 5.2 (5–6) 19% | 9.4 (8–10) 100% | 11.9 (11–12) |

Open question: holding the water on the middle Plume without moving blooms
it again and again through the soggy pauses, about 8 a round, above the pass
mark at every level, and even a clumsy gardener passes at Normal. No pass
mark fixes both (the medium gardener makes about 9.6), so it needs a design
decision (for instance a longer soggy pause, or soggy costing growth) rather
than a curve change.

### 6. Highbutton Bobolinks: Left Foot, Right Foot (40 s)

The boots cross a moonlit stream on stepping stones. Each stone is on the
left or the right; press the matching side to step. A wrong step splashes
and costs a moment. Score is the stones crossed. The stones come faster, and
some are doubles (both at once).

**Controls and foot pads.** On a controller the game says LB (or X) for the
left foot, RB (or B) for the right, and both together for a double. The
D-pad, LT and a sideways flick of the left stick still step, but aren't
listed: they can't press both feet at once. (X and B come from input.js's
generic `xPressed` / `bPressed`; B held is still `slow` for other games.) The
Left and Right pads are drawn by `drawOverlay`, fixed at the bottom corners
of the visible play area rather than in the scene, so the narrow-screen
camera can't push them off the screen; on a phone they keep at least about
72 CSS px across. Above each pad: the LB / RB bumper and the X / B button
with a controller, the ← / A and → / D keys on the keyboard, nothing extra on
touch. A pad and its buttons flash when that foot is pressed.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets it. Each knob, easy / medium / hard: the stone
underfoot sinks in 2.6 / 1.85 / 0.95 s; the next stone is on the other side
85% / 68% / 45% of the time; doubles, none in the first 7 s, come 3% / 12% /
25% of the time. Mashing also pays less: a fluster counts from when the boots
recover, not from the splash (before, a long stumble outlasted the 1.5 s
window and wiped the slate, so random mashing passed 4 seeds in 12). Pass
mark stays at 40. Bots over 16 seeds (mean, range, share passing); the clumsy
walker steps out of habit (the other foot) 30% of the time when a stone
repeats a side:

| Level | Idle | Mash | Both feet | Blind alternate | Clumsy | Medium (0.75 s) | Good (0.35 s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 20 (10–29) | 0 | 32 (19–48) 25% | 40 (35–47) 56% | 45 (39–48) 94% | 103 (96–109) |
| Normal | 0 | 20 (10–28) | 0 | 27 (12–41) 13% | 40 (34–47) 44% | 43 (39–47) 94% | 103 (97–110) |
| Harder | 0 | 20 (10–34) | 0 | 19 (11–28) 0% | 35 (22–43) 19% | 45 (37–49) 88% | 103 (91–111) |

Stones crossed is limited mostly by how quickly a player steps, so the level
moves a clumsy walker's score less than its stumbles. Known: blind
alternating, left-right five times a second, scrapes past the mark now and
then (2 seeds in 16 at Normal, 3 before the curve; 4 at Easier,
where the stones alternate more), and fast blind drumming, ten times a
second, scores well over it, as it did before. No pass mark keeps both out
without failing the medium walker.

### 7. Newspaper Peeper: Hot off the Press (45 s)

A word is printed at the top. Letters flutter down like loose feathers; move
the Peeper to catch the letters of the word in order. The wrong letter
smudges the word and costs a point. Finished words score by length. Words get
longer as you go.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets it. Each knob, easy / medium / hard: letters fall at
120 / 205 / 310 px/s (plus up to 30), sway 25 / 64 / 110 px (times 0.6 to 1),
come loose every 0.62 / 0.5 / 0.34 s (plus up to 0.12), and the needed letter
is 48% / 37% / 22% of them. The words still lengthen as they are finished.
Pass mark stays at 22 (it went from 18 to 22 with the earlier ramp: wandering
and mashing reached 19 to 21 on some seeds). Bots over 16 seeds (mean, range,
share passing); the readers notice a letter only after it has fallen a while:

| Level | Idle | Mash | Wander | Clumsy (slow, 0.8 s to notice) | Medium (0.6 s) | Good |
| --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 7 (0–16) | 10 (1–19) | 25 (15–32) 75% | 31 (20–39) 88% | 37 (32–41) |
| Normal | 0 | 9 (3–13) | 9 (2–18) | 22 (11–30) 44% | 35 (25–38) 100% | 40 (29–48) |
| Harder | 0 | 9 (2–19) | 8 (1–17) | 19 (6–31) 25% | 33 (25–41) 100% | 50 (40–58) |

Letters come a little less often at Easier, so the medium reader's score
there is a touch lower than at Normal; it still passes.

### 8. Pincushion Piffle: Stitch in Time (45 s)

A dotted seam winds down the quilt as it scrolls. Steer the needle left and
right to follow it; hold the action (A or Space) to stitch faster, at the
risk of wandering off the seam. Hold B (or Shift) to slow the quilt and the
needle a little for a tricky bend, or hold LT or RT to steer more finely
without slowing the quilt (the further the trigger, the finer). Score is the
stitches sewn on the line, so going slowly is safer but sews fewer.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets it. Each knob, easy / medium / hard: the quilt runs at
150 / 205 / 270 px/s; the seam's bends come 360 / 275 / 170 px apart (times
0.85 to 1.15) and swing up to 110 / 200 / 320 px. The seam is laid about
2000 px ahead, so its bends lag the clock by a few seconds. Pass mark stays
at 120. Bots over 16 seeds (mean, range, share passing); the sewers see the
needle a few frames late:

| Level | Idle | Mash | Clumsy (0.67 s late) | Medium (0.27 s late) | Good (hurries) |
| --- | --- | --- | --- | --- | --- |
| Easier | 36 (17–89) | 7 (2–14) | 154 (132–176) 100% | 196 100% | 309 (300–315) |
| Normal | 30 (13–44) | 8 (2–13) | 118 (97–144) 31% | 218 (210–223) 100% | 300 (285–334) |
| Harder | 26 (12–48) | 7 (2–14) | 79 (62–102) 0% | 197 (174–229) 100% | 263 (242–303) |

### 9. Dollarbill Dodo: Spot the Dodo (8 rounds)

The Dodo hides under one of three hats on the counter (four, then five in
later rounds). The hats shuffle, faster each round. When they stop, move to
the right hat and press the action. Score is the rounds won, with a bonus for
answering quickly.

**Difficulty over the round.** The hat counts stay fixed (3, 3, 4, 4, 4, 5,
5, 5) at every level, so guessing is never luckier. Everything else about a
round follows the shared curve (`g.d()`, `g.plan()`, see `difficulty.md`)
over the eight rounds (round 1 is progress 0, round 8 is 1). Each knob, easy
/ medium / hard: 2 / 9 / 16 swaps of 0.95 / 0.44 / 0.26 s each; the Dodo shown
for 1.8 / 1.15 / 0.85 s; 6 / 4.5 / 4 s to answer; feints 0% / 20% / 25% of
moves, double swaps (four hats or more) 0% / 10% / 35%, rings of three 0% /
0% / 30%. The rounds, as hats:swaps@seconds:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 3:2@0.95 | 3:2@0.92 | 4:3@0.85 | 4:5@0.76 | 4:5@0.71 | 5:6@0.69 | 5:6@0.66 | 5:7@0.59 |
| Normal | 3:2@0.95 | 3:3@0.89 | 4:5@0.74 | 4:7@0.58 | 4:9@0.46 | 5:9@0.44 | 5:11@0.40 | 5:14@0.31 |
| Harder | 3:8@0.49 | 3:9@0.45 | 4:10@0.41 | 4:11@0.38 | 4:12@0.35 | 5:13@0.35 | 5:14@0.32 | 5:16@0.26 |

(Before the curve: 2@0.95, 4@0.72, 5@0.56, 8@0.44, 10@0.38, 10@0.34,
13@0.3, 16@0.26.) Pass mark stays at 550 (it went from 450 to 550 with the
earlier ramp, when pure guessing passed about one game in ten at 450). Bots
over 24 seeds (mean, range, share passing); the medium and clumsy players
lose the Dodo's hat more often the quicker it moves, and then guess:

| Level | Idle | Guess at once | Clumsy | Medium | Sharp-eyed |
| --- | --- | --- | --- | --- | --- |
| Easier | 0 | 279 (0–640) 4% | 897 (700–1020) 100% | 992 (735–1020) 100% | 1040 |
| Normal | 0 | 314 (0–570) 4% | 518 (310–870) 38% | 600 (430–870) 75% | 1040 |
| Harder | 0 | 339 (0–660) 8% | 235 (0–510) 0% | 295 (0–630) 4% | 1040 |

At Harder the quick, long shuffles lose even the medium player, who then
does no better than guessing; that level is for records.

### 10. Safecrossing Crow: Safe Crossing (45 s)

The Crow is the traffic light at a zebra crossing. Press the action to switch
between green for the cars and red for the walkers. Little birds gather on
the pavements and cross on red; cars pile up on red and honk. Score is
everyone who crosses (birds and cars). Waiting too long makes them give up
and leave, and switching while someone is still on the crossing is a
near-miss that costs points.

**Difficulty over the round.** The shared curve (`g.d()`, see
`difficulty.md`) sets every knob, easy / medium / hard: a car per lane every
3.3 / 2.45 / 1.15 s, a flock per pavement every 4.6 / 3.5 / 1.95 s (a second
bird 30% / 50% / 80% of the time, a third 0% / 24% / 60%), cars 240 / 278 /
335 px/s, patience 8.5 / 6.9 / 4.6 s. Pass mark stays at 40. Bots over 16
seeds (mean, range, share passing):

| Level | Idle | Mash | Blind every 5 s | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- |
| Easier | 3 (0–7) | 4 (0–9) | 43 (34–52) 88% | 40 (10–52) 63% | 51 (42–58) 100% | 53 (47–60) |
| Normal | 2 (0–6) | 5 (2–9) | 48 (41–58) 100% | 38 (21–53) 44% | 53 (35–65) 94% | 62 (56–68) |
| Harder | 1 (0–3) | 2 (0–4) | 64 (54–74) 100% | 42 (35–50) 63% | 55 (42–67) 100% | 79 (58–91) |

Every car and bird across scores, so a busier road pays more to anyone who
keeps it moving, and a quieter one (Easier) pays everyone less: Easier helps
a clumsy signaller only a little. Blind switching every five seconds passes
at Normal, as it did before.

## Look and sound

- Everything sits on cream paper, in ink and wash, like the book. The
  minigame scenes are framed like the book's few framed pictures.
- Until the art arrives, every bird is drawn in code from simple shapes in
  the book's colours, with a wobbly ink outline (`game/src/draw.js`).
- Type: a clean, slightly old-fashioned sans for the rhymes, as in the book,
  and a friendly serif for headings.
- Music is recorded (see `music.md`): a title theme, a field-guide piece, four
  moods for the games and a seaside carousel, with a fanfare for the sticker
  celebration. The games' plinks, pours, clicks and honks are synthesised in
  the browser.

## Later

- Two to four players, Mario Party style: everyone plays the same minigame
  together on one screen or takes turns, with the gathering page as the
  scoreboard.
- All the birds together is on trial as the sticker book's first picture
  (snapping stickers into the painting); the plain page and the birds'
  own pictures remain one press away if it does not win out.

### Shuttercluck photographs in the Sticker Book
Say Cheese draws from all guide and pocket birds, regardless of discovery.
A weighted bag preserves rarity while exhausting the pool before repeating a
species. The original ten guide birds now have photo geometry and portraits in
the same subject pool.

RT / Page Down after the final sticker spread opens Shuttercluck’s photographs;
on the all-birds picture, RT opens them directly. LT / Page Up returns. Select
a photograph and press A, or click it, to pin or unpin. The latest round's
photos are saved on this device, together with pinned photos from older rounds.
Starting another Shuttercluck round discards only unpinned photos. Captures are
408×300 WebP images; debug keeps photos in session storage, as with stickers.
