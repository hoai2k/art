### The Soupladle Lark: Soup's On (50 s)

A big copper pot of soup swirls on the stove, carrots, peas, dumplings and
mushrooms going round and round in it (the middle turns faster than the
edge). A queue of hungry creatures waits at the counter, and the one at
the front says what it wants in a bubble over the pot: two carrots and a
pea, say, with a patience bar. The Lark is the ladle: move the dotted ring
over the soup and press the action to dip. Whatever lies across the
ring comes up and flies into the creature's bowl, and the bubble ticks off what
was wanted. The mechanic is picking an exact set out of a moving crowd:
choose a moment when only wanted bits are in the ring (or two of them at
once), rather than catching (Scoop Stack) or framing one target (Say
Cheese).

**Scoring.** A bowl with just what was asked: 3, or 4 if served while the
patience bar is still green ("Quick and delicious!"). One unwanted bit is
forgiven ("No peas!"): the bowl then scores 1. A second unwanted bit, or
the old boot that bobs up now and then, is "Yuck!": the creature leaves
and it costs 1. A creature kept waiting too long leaves ("Hmph!"). An empty
dip is just a splash.

**Getting harder.** The soup swirls from 0.4 to 1.1 turn-rate as time goes
on. Orders are one or two of a single thing for the first 21 s, then two
or three of up to two kinds, then (from about 36 s) three or four of up to
three. Dumplings join after 7 s, mushrooms after 20 s, the boot after
17 s. Patience runs from 14 s down to 7.5 s, plus 1.5 s per item. The cook
drops in more of anything the pot is short of, so every order can be made.
See "Difficulty over the round" at the end.

**Controls.** Controller: left stick or D-pad moves the ring, A or RT
dips, the right stick up / down makes the ring smaller / bigger.
Keyboard: arrows or WASD, Space, Q / E for the ring's size. Mouse or
touch: the ring follows the pointer over the pot; click or tap to dip; the
mouse wheel sizes the ring. On a narrow screen the view
stays on the pot and the order bubble, 920 wide (the queue is off to the
right).

**Pass.** 36 points. Bots over seeds 1–6: a beginner (slower, no lead,
looks only at the ring as it is now, sometimes dips in a hurry, pauses to
look after each dip) 44–75; a good cook (leads the swirl, dips two at
once, checks the ring where it really is) 42–78; dipping on the nearest
wanted bit without looking round it 18–48; mashing 0–9; dipping on the
spot 0–8; idle 0.

**Images.** IC-M15a is the soup kitchen, the middle kept plain for the
pot and the counter on the right clear for the queue. IC-M15b is the pot,
its broth oval as wide as the pot and three-eighths as tall so the game can
fit the swirl to it, and the serving bowl. IC-M15c is the carrot, pea,
dumpling, mushroom and boot. IC-M15d is the four creatures in the queue,
waiting and pulling a face. IC-M15e is the Lark in the air over the pot:
hovering with its wings beating, dipping bowl first, and rising with a
brimming bowl, its bowl at the centre of each picture so it sits over the
ring.

## Changes after the audit

1. **The Lark no longer covers the ring.** It hovers higher (its bowl about
   150 above the ring, not 80, so its feet clear the ring) and is drawn at 60%
   opacity while it only hovers; it comes down at full strength only to dip.
   While dipping, everything of it below the soup's surface is hidden and a
   ring of ripples spreads, instead of a broth-coloured patch that hid the
   bits.
2. **Peas are bigger:** 26 px across, not 20 (and up to about 40 px with
   the pot's own scale).
- Shared guidance: a "Yuck!" now costs 1, not 2 (the creature leaving is
  already the cost). Pass stays 36. Bots over seeds 1–6: beginner 44–55,
  good 55–82, dipping at the nearest wanted bit without looking round it
  34–52, mashing 0–13, dipping on the spot 0–8, idle 0.

## Matched to the painting

The painting's bowl bottom is at (42, −128) in bird units (the stand-in's was
at (20, −90)). The bowl is now placed over the ring by that point, and the
code wings are left off because the painting has its own. The pose request
IC-M15e now describes the painting: speckled grey enamel, its curled hook
floating above its back, grey-blue wings, ochre legs.

## Matched to the delivered art

The soup kitchen (IC-M15a) and the repainted Lark are in. The new painting is one piece, with the hook curling up from the head as a crest.
- The Lark is placed by its new bowl bottom, at (50, −131) in bird units.
- The pot moved right to x 665 to sit over the painted range, and the code flames are left off when the scene is there.
- The serving bowl sits on the painted counter's top (y 655).
- The queue now stands behind the counter: only what is above its top (y 648) shows.
- The pose request IC-M15e now describes the one-piece ladle with its crest.
- Still drawn in code until their sprites arrive: the pot and the bowl (IC-M15b), the bits (IC-M15c), the queue (IC-M15d) and the Lark's flying and dipping poses (IC-M15e; the portrait is shown).

Sprites delivered (IC-M15b pot and bowl, IC-M15c bits, IC-M15d queue, IC-M15e poses). Every anchor was measured on the PNGs.
- **Pot and play area:** the painted broth is a flatter oval than the code pot's (centre (510, 559) of its 1024 px cell, 305 by 75 px). The play area now follows it: the surface is centred at (650, 490), 360 by 88, with the pot drawn 1.18 times size. The pot is big and stands over the range, its foot below the screen. In units of the surface the rules are unchanged, so the bots' scores barely move (beginner 46–58, good 44–104, grabbing 24–58, mashing 0–6, on the spot 0–8). On screen the ring is now 72 by 18 px.
- **Serving bowl:** placed by its broth (centre (512, 710) of its cell, 0.42 scale), its foot on the painted counter.
- **Bits:** their trims include a few drops of broth, so they are sized per kind (the pea about 26 px). They are only rocked, not spun, since they are painted at a slant.
- **Queue:** the four creatures stand behind the counter, feet hidden, with the yuck row for a "Yuck!" or a walk-out.
- **Lark poses:** hovering, dipping and rising, each placed by the bowl's lowest point ((88, 172), (100, 200), (94, 158) from each cell's centre; 0.41 scale). Hovering is drawn at 60% as before. The code wings and brimming soup are no longer drawn.
- **Still drawn in code:** the ring, ripples and splashes, the order bubble and patience bar, and the flying bits. No pose is missing.

## The ring: lenient, and sized by the player

- **What comes up.** A bit counts when it lies across the ring's line, not
  only when its centre is inside. Each bit's footprint on the soup is a
  circle as wide as its painted body (measured on lark-bits.png: the carrot
  1.0 of its drawn height, the pea 0.88, the dumpling 1.05, the mushroom
  0.95, the boot 1.1), and a bit comes up when its centre is within the
  ring's radius plus 0.45 of that footprint's radius (about 10 px more on
  screen for a pea). One that only touches the ring with its edge stays.
  Two unwanted bits or the boot are still "Yuck!", so a sweep that takes
  everything still fails.
- **The pea is drawn where it floats.** Its painted trim takes in a broth
  drop well off to its right, so the pea used to be drawn about 20 px left
  of where the ring caught it. It is now drawn 0.44 of its height to the
  right, its body on its place.
- **Ring size.** Right stick up makes the ring smaller and down makes it
  bigger, smoothly while held, and it keeps its size when let go (it holds
  still during a dip). Q / E do the same on the keyboard, and the mouse
  wheel steps it (away from you smaller, toward you bigger). The range is
  0.8 to 1.3 of the usual ring (58 by 14 px to 94 by 23 px on screen). RT,
  A, Space and a click still dip. On a touch screen it stays at its usual
  size.
- **Balance.** Bigger is not better: the soup is crowded, so a big ring
  brings up the unwanted bits round what you want. It pays only for two
  wanted bits lying close together. A small ring picks one bit out of a
  crowd but has to be put right on it. No other cost was needed: an extra
  dip time for the big ladle barely changed the bots' scores, since the
  crowd already costs it more.
- Pass stays 36. Bots over seeds 1–6, at a fixed size:

  | Bot | 0.8 | 1 (usual) | 1.3 |
  | --- | --- | --- | --- |
  | Beginner | 53–70 | 46–57 | 28–54 |
  | Good cook | 62–100 | 51–79 | 22–90 |
  | Nearest wanted bit | 30–45 | 33–53 | 0–42 |
  | Mashing | 0–3 | 0–13 | 0–5 |
  | Dipping on the spot | 0–8 | 0–8 | 0–8 |

  Before the change (centre inside the ring, the usual size): beginner
  46–58, good 44–104, nearest bit 24–58, mashing 0–6, on the spot 0–8.

## Third audit: pose sizes (2026-10-09)

Every painted pose is drawn so the character is one size, by the scale each cell is painted at (`design/source/pose-scales.json`); a test checks it. See the third audit in [`AUDIT.md`](AUDIT.md).

## Difficulty over the round

The soup follows the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard; hard
is the old end of the round, medium a little gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Swirl (rad/s) | 0.4 | 0.72 | 1.1 |
| Order step, `floor(knob(d, 0, 1.15, 2.5))` | 0: 1–2 of one kind | 1: 2–3 of up to two kinds | 2: 3–4 of up to three kinds |
| Patience, before 1.5 s per item (s) | 14 | 11.1 | 7.5 |
| Old boot (chance per new bit, after the first third) | 0.12 | 0.22 | 0.35 |

The kinds in the pot still widen by time at every level: two to 7 s, three
to 20 s, then four. At Normal the orders are one kind until about 28 s, two
kinds from there and three only in the last 4 s; Easier keeps one-kind
orders all round; Harder opens on two kinds and reaches three in the last
fifth.

**Pass mark stays at 36.** Bots over seeds 1–12 (mean, range, share passing):

| Level | Idle | Mash | Dip on the spot | Nearest bit | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 6 (0–26) | 2 (0–8) | 56 (35–81) 92% | 44 (31–58) 83% | 68 (40–85) 100% | 61 (33–104) |
| Normal | 0 | 2 (0–9) | 2 (0–8) | 43 (24–69) 58% | 36 (27–45) 58% | 61 (44–85) 100% | 67 (48–108) |
| Harder | 0 | 3 (0–11) | 0 (0–4) | 18 (4–27) 0% | 28 (18–37) 8% | 47 (25–70) 75% | 67 (42–93) |

The medium cook is the old beginner (dips where a bit is now, not where it
will be, so it misses more as the swirl speeds up, and looks 0.6 s after
each dip); the clumsy one is slower on the stick and takes 1.8 s to look
up; the good one leads the swirl and dips between pairs. The clumsy cook
passes at Normal more than the guide's "seldom" (58%), but Easier lifts it
clearly (83%) and Harder stops it (8%). Small orders at Easier pay less
per creature, so a good cook scores no more there than a medium one: the
records are made at Normal and Harder. `test/ladlelark.test.mjs` checks this,
the knobs third by third at each level, and the orders, patience, swirl
and boot early and late at Normal.
