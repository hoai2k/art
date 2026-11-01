# Difficulty: one curve, three levels

How every minigame sets its difficulty, and how to convert one. The worked
examples are Salt Shaker Shrike, Coot and Crow (`src/games/saltshakershrike.js`,
`coot.js`, `crow.js` and their tests).

**Light touch.** Most games already feel right. Treat today's game as the
reference: **hard ≈ today's end of the round, medium a little gentler than
today's middle, easy ≈ today's opening.** Keep knob values close to what they
are; the change is mostly *where in the round* each value is reached. No new
mechanics, no restructuring. Move a pass mark only if the bots require it.

## The curve

`src/games/difficulty.js` gives `d`, how hard it is now: 0 is easy, 0.5 medium
(what the pass mark is built around), 1 hard (records, never needed to pass).
`d` follows the round's progress `p` (0..1) along the curve for the setting:

| p | 0 | 0.2 | 0.4 | 0.5 | 0.65 | 0.8 | 0.9 | 1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easier | 0 | 0.06 | 0.17 | 0.22 | 0.25 | 0.27 | 0.30 | 0.35 |
| **Normal** | 0 | 0.11 | 0.34 | 0.43 | **0.50** | 0.56 | 0.68 | 0.85 |
| Harder | 0.45 | 0.52 | 0.65 | 0.71 | 0.75 | 0.80 | 0.88 | 1 |

Up to 65% of the round it is a smoothstep from `start` to `mid` (gentle
opening, a pause at medium); after that a quadratic ease-in to `end`, so the
hard part comes only at the end. The anchors are `CURVES` in difficulty.js.

## The knob pattern

```js
import { curve, knob } from './difficulty.js';

export default function create(env) {
  ...
  const dAt = curve(env);                                 // reads env.difficulty
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  // Each knob: easy, medium, hard.
  g.omega = () => knob(g.d(), 0.36, 0.55, 0.78);          // table turn, rad/s
  g.gap = () => knob(g.d(), 2.7, 1.95, 1.15);             // seconds between plates
```

`knob(d, easy, medium, hard)` is straight lines through the three anchors
(clamped). Write *every* difficulty knob this way, with a comment naming the
unit; three numbers read more clearly than one range. Expose knobs on `g` so
tests can read them. Remove the old `g.ramp()` / `level()` / `diff()`.

- **Converting a `lerp(a, b, ramp())`:** easy = `a`, hard = `b`, medium = the
  old value at the old mid-round, nudged 5–10% towards easy.
  Crow: `lerp(3.3, 1.15, level())` became `knob(g.d(), 3.3, 2.45, 1.15)`.
- **Steps and counts:** turn the old stages into one formula of `d`. Shrike:
  `clamp(Math.floor(knob(d, 1, 1, 2) + r * knob(d, 1, 2.4, 3.6)), 1, 5)`
  pinches: all ones at easy, 1–3 at medium, 2–5 at hard.
- **Chances:** `rng() < knob(g.d(), 0.3, 0.5, 0.8)` (Crow's second bird).
- **Fixed opening rules** (Coot's "no pickles for the first 6 s") can stay.

## What easy, medium and hard mean

- **Easy** is the gentle opening of today's game, not a different game:
  slower, sparser, simplest orders (Shrike: one-pinch plates, slow table, few
  plates; no puddings).
- **Medium** is what a competent player handles. Normal reaches it at 65% and
  rests there; the pass mark is set so a player who handles medium passes.
- **Hard** is about today's end of the round. Only Harder reaches it fully;
  Normal ends at 0.85.

**Watch the score's ceiling.** When the score counts things served (plates,
cars, birds), a sparser easy end lowers *everyone's* score, so Easier may
help a weak player less than it seems (Crow). Keep the flow knobs' easy
anchor no sparser than today's opening, and let the easing come from the
pressure knobs (speed, patience, order size).

## Picking the pass mark

One mark for every level (`pass` in the bird's entry). Run the bot table
below and keep today's mark unless:
- the medium bot passes under 75% of seeds at Normal (lower it), or
- idle or mashing reaches it at Normal or Easier (raise it).
Say in the design note what moved and why. Luck-heavy scores (Coot's
tallest stack) are checked as a rate, not "never".

## Bots and assertions

Run every bot at every level over 12–24 seeds into one table, print it, and
assert on it. Bots:

| Bot | What it is |
| --- | --- |
| idle | no input |
| mash | presses / moves at random (and any "mash in one spot" variant) |
| clumsy | weaker than medium: slower, looser, late to look, loses count |
| medium | competent, not expert; usually the existing "beginner" bot |
| good | the existing strong bot |

Make the clumsy bot's mistakes grow with the pace (late reactions, slow
repeat, aim error that scales with speed), not fixed blunders, or every
level looks the same to it.

Assert:
- Normal: medium passes ≥ 75%; clumsy seldom; idle and mash never.
- Easier: clumsy passes (≥ 75% where the scoring allows; at least more
  often than at Normal); idle and mash never.
- Harder: good scores clearly more than medium; clumsy does worse than at
  Normal.
- The ramp itself, third by third, at Normal (and Easier / Harder where it
  says something), read from the game's own knobs or what it spawns.

## Test template

```js
import { run, env, blank } from './harness.mjs';   // run(..., { difficulty })

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = { idle: () => () => ({}), mash: (s) => masher(s), clumsy: (s) => bot(s, 'clumsy'), medium: (s) => bot(s), good: (s) => bot(s, 'good') };
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('<id>: at Normal a medium player passes; idle and mashing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});
test('<id>: Easier lets a clumsy player pass', () => { ... });
test('<id>: Harder ends hard: the good bot scores clearly more', () => { ... });
```

A game made with `create(env(seed))` (no `difficulty`) plays Normal, so old
tests keep working. Put the bot table in the game's design note.

## Settings and scores

- **Settings → Difficulty:** Easier · Normal · Harder (default Normal). D-pad
  or arrows reach it row by row; left/right step it; a click, A or Enter
  picks. Saved with the other settings (also in `?debug`, like every setting).
- **The game gets it as `env.difficulty`.** A round keeps the level it
  started at, even if Settings change it from the pause menu.
- **Bests per level, in points** (see Points below). `progress[id].best` is
  the Normal best, `progress[id].by.easier` and `.by.harder` the others;
  `progress[id].tally` holds the best plain score at each level. `bestAt(entry,
  level)` and `tallyAt(entry, level)` in store.js read them. The guide, the
  bird's page and the result card show the best points for the current level;
  World Record means new best points at that level.
- **A pass at any level counts for good** (`passed`), with the same mark.
- **The result card** names the level when it isn't Normal ("Easier level"),
  and shows the plain score with the points under it.
- `mergeProgress`, `restoreProgress`, `canRestore` and `keepOldPasses` handle
  every level (`test/store.test.mjs`).

## Points

Each scoring action earns its value times **(1 + d)**, where `d` is the
difficulty at that moment: 1x at the easiest, 2x at the hardest. The later in
the round and the harder the level, the more it is worth, so a Harder player
naturally outscores a Normal one for the same play. Points decide bests and
World Records; **passing still uses the plain score** against the bird's pass
mark, so Easier stays easier to pass.

- **Worked out once, in the shell.** `src/points.js` `pointsFor(game)` wraps
  each `game.update()` in main.js's play loop: it reads `d` just before the
  update (the moment the action was taken, before a round or clock moves on),
  and adds the change in `game.score` after it times (1 + d). Games are not
  touched. Penalties (a fall in the score) scale the same way; points never go
  below 0. The exact tally is kept; whole numbers are shown and saved.
- **`d` comes from the game itself.** Every game exposes its curve as `g.d()`
  (Puddle Hop as `g.dNow()`, its `g.d` being the distance walked), so the
  shell needs no table of round lengths: most games follow time
  (`elapsed / duration`), Gullfinch its beats, Dodo and Glass Harp their
  rounds, Shuttercluck the further of shots taken and time. `test/points.test.mjs`
  checks all 28 expose it, in 0..1, rising through a round.
- **Scores that are not sums still work.** Scoop Stack's score is the tallest
  stack so far: it earns (1 + d) each time it reaches a new height, and
  nothing when the stack falls and is rebuilt below it. Games that clamp their
  own score at 0 (Crow, Bin Day and others) give no change below 0, so no
  points are lost there either.
- **What it comes to.** Spread evenly through a round, one unit of score is
  worth on average about 1.18 points at Easier, 1.38 at Normal and 1.68 at
  Harder (`AVERAGE_MULTIPLIER` in store.js). The bots in `points.test.mjs`
  earn per unit: Scoop Stack 1.19 / 1.38 / 1.64, Crow 1.21 / 1.47 / 1.84.
- **Shown** on the result card ("12 scoops in your tallest stack", "19 points"
  under it; for birds already scored in points, "12 points" and "19 with the
  bonus"), in the HUD after the game's own line ("· 19 pts"), on the guide's
  cards ("best 19 pts"), the bird's page and How to play.
- **Old saves.** Bests saved before points were plain scores. Each is
  converted once, as it loads, at its level's average multiplier (a Normal 10
  becomes 14 points) and kept as that level's plain best too (`tally`); a
  converted entry is marked `v: 2`. So the first round after the change
  played as well as before earns about the converted best, rather than an
  easy World Record (or one that can never be beaten). `mergeProgress`,
  `restoreProgress` and `canRestore` convert a kept backup the same way;
  `keepOldPasses` and the "passed" fallback read the plain best.
