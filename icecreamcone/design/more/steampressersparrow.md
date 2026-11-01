### The Steampresser Sparrow: Pressing Business (45 s)

The laundry's ironing board and a basket of crumpled washing. One garment
at a time slides onto the board, crossed with creases: a handkerchief
first, then shirts, pillowcases, trousers, tablecloths and silk scarves.
The Steampresser Sparrow is the iron. Move it anywhere on the board, and
any crease under its sole is pressed as it passes; the crease fades and,
once all of it is flat, it's gone. Press the action for a puff of steam:
for 0.65 s the sole is a little bigger and presses nearly twice as fast.
The tank holds three puffs and refills one every 1.3 s. But an iron that
lingers heats the cloth (the glow under it warms from yellow to red), and
steam heats it faster: too hot and it scorches. The mechanic is steering
in two dimensions, running the iron along each crease and keeping it
moving.

**Scoring.** One per crease pressed out. Every crease of a garment pressed
out with no scorch: +2. A scorch leaves an iron-shaped brown mark, costs 1
(never below zero) and loses that garment's bonus. The next garment comes as soon as the last crease is
out, or when its time runs out (the ribbon along the top of the board).

**Getting harder.** See "Difficulty over the round" below. Moving at 400 px
a second or more never heats the cloth; standing still with steam scorches
it in under a second, dry in about 2.5 s.

**Controls.** Controller: left stick or D-pad moves the iron, A puffs
steam. Keyboard: arrows or WASD, Space; the iron eases in, so a short tap
nudges it. Mouse or touch: the iron follows the pointer; a click or tap on
the iron itself puffs steam (a finger put down elsewhere only moves it). On a narrow screen the view
follows the iron.

**Pass.** 16 points. Bots: a beginner (keyboard at less than half speed, no
steam; seeds 1–8) 23–27; a good presser (stick, steam on every stroke)
39–40; standing
still puffing steam 0; sweeping the whole board row by row with steam 0–1;
idle 0.

**Images.** IC-M09a is the laundry with the ironing board seen from above,
its top kept plain for the garments. IC-M09b is the six garments laid flat
and smooth (the game draws the creases and scorches on them). IC-M09c is
the Sparrow pressing, legs tucked away and sole flat on the cloth, dry and
steaming, since the standing portrait would put it on stilts. IC-M09d is the Sparrow
jerking its toe up off the cloth in alarm, shown for a moment after a
scorch.

## Changes after the audit

1. With a pointer, steam puffs only on a tap on the iron itself (within
   about 130 px of it); a finger put down anywhere else only moves the
   iron. The opening hint says "tap the iron for steam" on touch.
2. The cloth is plain where the creases go: the silk scarf has only a sheen,
   a narrow border and fringed ends (no blots), and the tablecloth's checks
   are a border only. Scorches are a clear, darker brown iron shape with an
   ink outline and its steam holes. IC-M09b now asks for the scarf and
   tablecloth plain in the middle.
3. With the keyboard the iron eases in (a slower acceleration), so a short
   tap nudges it; the stick stays direct. A test checks a short tap moves it
   only a little.
4. The steam-and-heat core stays, as the audit asks (the Glove Dove is the
   one being changed).

Shared item 2 (penalties): a scorch now costs 1, not 2; it also loses the
garment's +2 bonus. Standing still and puffing steam still scores 0.

## Matched to the painting

The painted iron's sole is tipped (toe up 0.19 rad) and sits 23 units right
of the painting's centre, so the game now draws the Sparrow from the middle
of its sole, levelled, over the middle of the pressing footprint (it used to
sit off to the right of the glow), at a size (250) where the sole is as long
as the footprint. Steam puffs rise from the row of holes just above the
sole. The pressing poses (IC-M09c, IC-M09d) are drawn as whole cells with
the sole's middle on the centre line and its underside 80% down, and their
prompts now describe the painted sad iron (wooden handle on curled posts,
the knob, the row of steam holes, the sparrow wing and head) and ask for a
level sole, and for no steam at all in the dry pose, since the portrait is
painted steaming.

## Matched to the delivered art

The laundry scene (IC-M09a) is in. Its ironing board runs from the point at
x 95 to the square end at 1470, its top from 362 to 728 px, so the board's
bounds, the heat grid, the iron's range (y 395 to 700) and the garments'
centre (830, 545) now sit on the painted board, clear of its tapered point;
the time ribbon runs just above its top edge. The opening hint is two short
lines on a paper backing, centred on the view. Still stand-in: the garments
(IC-M09b) and the pressing and scorched Sparrow (IC-M09c, IC-M09d), drawn
from the portrait, levelled and cut at the sole, meanwhile.

The sprites are in too (IC-M09b, IC-M09c, IC-M09d). Each garment now has
its painted shape (handkerchief 500 x 326, shirt 880 x 328, pillowcase
700 x 328, trousers 920 x 326, tablecloth 700 x 327, scarf 1000 x 180) for
painted and stand-in alike, and creases are laid only where there is cloth
(the shirt's body and sleeves, the trousers' legs, inside the borders, the
scarf without its fringe). The pressing Sparrow is drawn from its measured
sole: the middle of the underside (595, 816) over the footprint's middle,
at a scale that makes the sole 170 px long; the scorched pose is put so its
heel (871, 877) lands where the pressing pose's heel is, so it stays on the
cloth as it tips up. The code-drawn steam puffs are left out once the
painted steaming pose is in. Nothing is stand-in any more.

Scale check (owner's report that sprite birds shrink and grow): the pressing,
steaming and scorched poses all draw at one scale and measure the same: the
wooden handle is 415, 415 and 412 px along the iron (the scorched pose is
tipped up, so its eyes look bigger but the iron is not); a test checks it.

## Difficulty over the round

The round follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard, set as
each garment comes in; hard is the old end of the round, medium a little
gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Creases per garment (+1 for shirts and trousers, +1 two times in five; 7 at most) | 2 | 4.1 | 6.6 |
| Seconds per garment (plus 0.6 s a crease) | 14 | 11.2 | 7.5 |
| Silk scarf chance (after the first third) | 0.10 | 0.23 | 0.40 |

Unchanged: each later crease on a garment is longer than the one before
(a crease that won't fit on the cloth is tried shorter); the first third
brings only the handkerchief, pillowcase and tablecloth, shirts, trousers
and silk join after that, and the last third leaves out the handkerchief.

**Pass mark stays at 16.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Mash | Camp | Sweep | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 0 | 0 | 0 (0–1) | 16 (10–20) 67% | 26 (23–29) 100% | 44 (39–49) |
| Normal | 0 | 0 | 0 | 0 (0–1) | 14 (11–18) 25% | 25 (20–30) 100% | 42 (35–44) |
| Harder | 0 (0–2) | 0 | 0 | 0 (0–1) | 12 (7–16) 17% | 20 (13–26) 83% | 38 (35–43) |

The medium presser is the old beginner (stick at 0.45, no steam); the
clumsy one pushes at 0.3 and looks away a second in every three; the good
one pushes at 0.75 and puffs steam. Points come from creases pressed, and a
crease takes the same work at any level, so Easier (fewer creases, more
time) helps a clumsy presser less than it would in a game scored on
accuracy; it still passes twice as often as at Normal.
`test/steampressersparrow.test.mjs` checks all of this, and the knobs third
by third at each level.
