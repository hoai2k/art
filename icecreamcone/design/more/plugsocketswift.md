### The Plugsocket Swift: Lights On (45 s)

Dusk falls on a tall house with twelve windows, four across and three
high. One at a time a little creature comes to a window and asks for a
light: a bulb in a bubble, ringed by a timer that runs from green to red.
Fly the Swift anywhere over the house and press the action at an asking
window to plug its lamp in. The creature reads by it (a bar of pages runs
down) and then falls asleep with the lamp still on, which scores. Pressing
again at a sleeping window unplugs it ("Night night"); pressing at a window
still reading does nothing but say so.

The fuse box on the garden wall shows every lamp that is on as a lit bulb,
and a heat gauge. Three lamps are safe and the gauge cools; a fourth warms
it (blown after about 3 s), five or more heat it fast. When the fuse blows,
every lamp goes out, the creatures still reading give up, and no lamp
plugs in until the Swift flies to the fuse box and flips it back on (after
a moment for it to cool). So the game is juggling a load: answer the
window closest to giving up, and keep unplugging sleepers to make room. The
mechanic is switching things on and off under a shared limit, rather than
keeping things topped up (Bloom) or toggling one light (Safe Crossing).

**Scoring.** One per room lit until its reader falls asleep. A window kept
waiting gives up ("Too dark!") and so do readers when the fuse blows; they
cost nothing but the point.

**Getting harder.** Requests come every 2.5 s at first and every 0.6 s by
the end; books take 3–4.5 s at first and up to 7.8 s at the end, so more
lamps are wanted at once than the fuse can carry, and patience shrinks from
9.5 s to 4.8 s. The sky darkens as it goes. The first ten seconds rarely need
more than two lamps. See "Difficulty over the round" at the end.

**Controls.** Controller: left stick or D-pad flies, A plugs in, unplugs
or flips the fuse. Keyboard: arrows or WASD and Space. Mouse or touch: the
Swift follows the pointer; a click or tap on a window (or the fuse box)
sends the Swift there and acts when it arrives. The window the Swift is at
is outlined. On a narrow screen the view follows the Swift, 820 wide.

**Pass.** 13 rooms lit (it was 11; see "Difficulty over the round"). A
medium electrician (slower, lets a fourth lamp in, sometimes picks a window
at random) lights 17–21 at Normal; a good one (never more than three,
unplugs the nearest sleeper first, serves the most impatient window) 18–19;
plugging in everything and never unplugging 8–10; flying at random mashing
3–7; idle 0.

**Images.** IC-M13a is the garden at dusk with the tall house, its front
wall left blank for the game's windows and a clear patch on the garden wall
for the fuse box. IC-M13b is the window in its four states (dark, asking,
reading, asleep with the lamp on) and the fuse box whole and blown; the
game draws the lamp count and heat gauge above the box. IC-M13c is the
Swift's three poses, mirrored to fly right: in flight, diving at a socket
as it plugs a lamp in, and singed (bulb out, smoking) while the fuse is
blown. Its page portrait is the Swift standing still.

## Changes after the audit

1. **"Three is safe" is visible.** The fuse box's six lamp places are pale
   green for the first three and pale red for the rest; they light up green,
   then amber for the fourth, then red.
2. **A fuse warning on a phone.** On a narrow screen, when the fuse box is
   out of view and the fuse is heating or blown, a small copy of the lamp
   count and heat gauge rides at the view's left edge, on the lawn ("◀ FUSE",
   or "◀ Flip the fuse!"), and flashes red when the fuse is hot.

The scores and pass are unchanged (pass 12; beginner 13–16, good 19–20).

## Matched to the painting

The painting's socket (the body) is at (−46, −192) in bird units, and its
bulb is straight above it at (−46, −326). The Swift's position is now the
socket. The bulb's glow and the singed smoke sit on the painted bulb, and
the code wings are left off because the painting has its own pink wings. The
pose request IC-M13c now describes the painting: a clear bulb with an orange
filament, a cream wall socket on a blue-green body, pink wings, and a flex
tail ending in a plug.

## Matched to the delivered art

The painted garden at dusk (IC-M13a) is in.
- The window rows moved down to y 320, 497 and 674, so the top row sits under the painted eaves (about y 230) and the bottom row clears the lawn (about y 790).
- The fuse box moved to the blank patch on the painted garden wall, centred at (255, 600). Its "FUSE" name now sits on a little card so it reads against the wall and the hedge.
- Still drawn in code until IC-M13b and IC-M13c arrive: the windows and their creatures, the fuse box, the cable, and the Swift's flight poses (it shows its portrait). The night deepening is a wash in code over the painting.

Sprites delivered (IC-M13b windows and fuse box, IC-M13c poses). Every anchor was measured on the PNGs.
- **Windows:** drawn 156 tall, centred on each window's place. The painted mouse replaces the code creatures, so every room now has the mouse.
- **Fuse box:** placed by the box itself (x 108–401, y 33–433 in its 512 px cell), drawn 190 tall with its foot at y + 175. The blown box sits left of centre in its cell (x 57–340, smoke to the right), so it is shifted to keep the box in the same place. The lamp count and heat gauge sit on a card just above the box. The "Flip me!" and "Too many lamps!" warnings moved below it onto the lawn, outlined.
- **Poses:** flying, plugging in (head down, bulb blazing) and singed. Each is placed by its socket (offset from its cell's centre: (−135, 144), (−4, 116), (−32, 116); drawn at 0.278 scale), so the hitbox (the socket) doesn't jump between poses. The bulb glow follows each pose's painted bulb. The code wings and smoke are no longer drawn.
- **Still drawn in code:** the cable from the box to the house, the bubbles and timer rings, the reading bars, the lamp count card, the night wash and the frown on a window that gave up. No pose is missing: the portrait is shown on the page, and the three poses cover play.
- **Pass:** lowered to 11. The fuse box moved, so the beginner bot's lowest score is now 12 (beginner 12–14, good 19–20, greedy 5–8, mashing 2–9).

## The beak touches things

A player pressed the Swift's beak to the fuse switch and to the request
bubbles, and nothing happened. Only the socket (the body) was tested, so
anything the beak touched while the body was off the target didn't count.
- The fuse's blown switch is painted at about y 747. The body couldn't fly
  below y 760, and the old fuse hit area stopped at y 730. So the beak
  could never get the switch to count.
- A request bubble sits above its window. Its upper half was outside every
  hit area, so a tap on it did nothing, and so did a beak touching it while
  the body was beside the window.

What changed:
- **The beak tip is measured, per pose.** These are the farthest opaque pixel
  of the beak in each 1024 px cell: flying (107, 442), plugging in
  (195, 784), singed (191, 464). From the socket at the drawn scale (0.278)
  that gives (−75, −60), (−87, 43) and (−80, −46), mirrored when the Swift
  faces right. The tip uses whichever pose is drawn.
- **Hit areas match what's drawn.** A window is its pane plus a margin of
  about 27 px. An asking window also takes a circle of radius 52 on its
  bubble (the bubble is 34 across and has a 6 px ring). The fuse box covers
  everything drawn for it, from the FUSE card (y − 170) to just below the
  box's foot (y + 190), and 110 px either side. That includes the switch.
- **A press acts on what the beak touches, or on what the body touches.**
  If both touch something, it acts on the one where a press does something.
  The outline shows that window. With the pointer, a click near the Swift
  works the same way. A click away from it still sends the Swift over, and
  it acts once the beak or the body reaches that target. A tap on a bubble
  now counts as a tap on its window.
- The Swift can fly down to y 796, low enough for the beak to reach the
  fuse switch.

The bots score as before: beginner 12–14, good 19–20, greedy 5–8,
mashing 2–6, idle 0. The pass stays at 11.

## Difficulty over the round

Requests follow the shared difficulty curve (`g.d()`, see
`../difficulty.md`): 0 is easy, 0.5 medium, 1 hard. At Normal it is medium by
about two-thirds of the round and ends at 0.85; Easier tops out at 0.35,
Harder opens at 0.45 and ends at 1. Each knob is easy / medium / hard, set
for each new request; hard is the old end of the round, medium a little
gentler than the old middle.

| Knob | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Seconds between requests (±20%) | 2.5 | 1.65 | 0.6 |
| Patience (s, ±10%) | 9.5 | 7.4 | 4.8 |
| Book (s, plus up to 1.5) | 3 | 4.5 | 6.3 |

**Pass mark 11 → 13.** At Easier the books stay short (3–4 s), so plugging
in every window and never unplugging lit 10–12 rooms, passing 11 on nine
seeds in twelve. At 13 it never passes. Bots over seeds 1–12 (mean, range,
share passing at 13):

| Level | Idle | Mash | Greedy | Clumsy | Medium | Good |
| --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 5 (2–7) | 11 (10–12) | 12 (11–13) 8% | 18 (17–19) 100% | 18 (17–19) |
| Normal | 0 | 5 (3–7) | 9 (8–10) | 12 (11–12) 0% | 19 (17–21) 100% | 19 (18–19) |
| Harder | 0 | 4 (1–7) | 4 (2–5) | 12 (11–12) 0% | 10 (8–11) 0% | 19 (18–19) |

The medium electrician is the old beginner; the clumsy one is slower still,
picks windows almost at random and takes 1.25 s to set off each time; the
good one never lets a fourth lamp in. Rooms lit are capped by the three
safe lamps and how fast the Swift gets round, not by how often windows
ask, so a slow electrician lights about as many at any level: Easier is
calmer but does not lift a clumsy score, and a good electrician is about
level with a medium one at Normal. Harder is where the fuse bites: long
books and quick requests blow it for anyone who lets a fourth lamp in, so
the medium player drops to 10 while the good one keeps 19. This falls
short of the guide's "Easier lets a clumsy player pass".
`test/plugsocketswift.test.mjs` checks the rest, and the knobs third by
third at each level.
