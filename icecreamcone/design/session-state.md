# Session state: The Ice-Cream Cone Coot

A running note of where the work stands, kept so a fresh session can pick up
without the conversation. Update it as work starts, finishes or is handed to an
agent. Newest first.

## Open

- **Bobolinks controls and fixed foot pads: done 2026-10-14 (not yet
  merged).** Controller text: LB (or X) left, RB (or B) right, both
  together for a double; no D-pad or stick (they still work, unlisted).
  input.js `state()` gains generic `xPressed` / `bPressed` fresh presses.
  The Left / Right pads moved to a new `drawOverlay(g, { w, h, s, kind })`
  hook (main.js, screen-fixed, documented in games/index.js) with LB / RB +
  X / B icons (keys on keyboard, none on touch). Controls lines moved from
  main.js to `src/controls.js` so they can be tested.
- **All birds playable: done 2026-10-13 (not yet merged).** Every card is
  playable from the start. An unspotted bird shows its silhouette on its
  card and page (name, rhyme, game and tips all shown; the game draws it in
  full). A first pass plays the sticker celebration, then the guide turns
  over that bird's own card (`turnsOver`, `spottedLine` in reward.js); Exit
  to Field Guide with a first pass turns it over too. No next-card unlock;
  the Unlock all setting is gone (old saved flag ignored). Sticker book,
  gathering and the spotted count follow passed birds; Shuttercluck's
  subjects were already every bird.
- **Difficulty rework: done 2026-10-12.** All 28 games use
  `src/games/difficulty.js` (`curve(env)`, `knob(d, easy, medium, hard)`);
  Easier / Normal / Harder in Settings; per-level bests. Pass marks changed:
  Shrike 35, Peeper 22, Dodo 550, Lights On 13, Bin Day 20, Puddle Hop 14,
  Milk Round 15, Scoop Stack 6. Open questions to the user: Bloom (holding
  the water on one plume scores about 8, above the pass of 6), Bobolinks
  (blind drumming passes about 1 round in 8). In throughput games Easier
  helps clumsy players little (see each design note).
- **Points scaled by difficulty: done 2026-10-12.** Each change in a game's
  score earns (1 + d) at that moment (`src/points.js`, wrapped round
  `update()` in main.js; d from each game's own `g.d()` / Puddle Hop's
  `g.dNow()`). Passing still uses the plain score; bests and World Records
  are in points (`tally` keeps plain bests). Old saves converted at each
  level's average multiplier (Normal x1.38). See `design/difficulty.md`,
  Points.
- **Clean Sweep redraw (IC-M06f, IC-M06g):** requested 2026-10-09. The
  Broomwhisk's pose sheets paint the head at portrait size and the broom about
  12% smaller. Until the new sheets arrive, `src/games/broomwhisk.js` draws
  them at a compromise scale (the geometric mean). When they arrive: drop them
  in `intake/`, register them at one scale like the others (see
  `design/source/pose-scales.json`, `test/sprite-rig.mjs`), and flip the
  requests to delivered in `design/source/more/broomwhisk.json`.
- **Lights On fuse:** the user was told how it works (more than 3 lamps on,
  sleepers included, heat it; unplug sleepers to cool it). Offered: make
  sleeping lamps easier to spot, or forgive a fourth lamp longer. No answer
  yet.

## Latest Shuttercluck photographs update

- All 28 guide birds and ten pocket birds may appear, discovered or otherwise.
  Weighted selection exhausts the species pool before repeating.
- The back of the stickerbook has a photo album: RT after the final spread
  (or directly from the all-birds picture), LT back. Click or A pins/unpins.
- Photos persist on the device; new rounds clear unpinned photos and keep pins.
  Debug uses session storage. Original guide portraits now have photo geometry.
- Checks cover pool diversity, pin retention, reloads and repeated rounds,
  real photo capture, and controller/mouse album navigation.

## Latest stickerbook titles update

- Only the first physical page says “My Field Guide”. Other pages are titled
  by their own sticker range (Birds 8–14, Birds 15–21, Birds 22–28).
- The header shows the current spread's bird range and total spotted, so LT/RT
  page turns change the visible titles while preserving collection progress.

## Latest Puddle Hop update

- Wren's path is 20 screen units lower, through the puddle middle.
- IC-M10i delivered: slip, fallen, getting up and wing-shake sheet.
- Recovery lasts 1.35 s: forward slip, fall, get up, wings spray water,
  then walking resumes. Pose scales fitted to the same eye size as the walk.

## Latest controls and hazards update

- Drip Drop Dash: water keeps momentum with weak steering instead of disabling
  controls; hopping and filling still work. Puddles last 6.5–12 s. Existing
  IC-M16d slipping artwork is suitable and reused.
- Entry pages: LS or RS up/down scrolls only the instructions; poem and Play
  stay fixed. Mouse/touch can scroll the same panel.
- Bin Day: wider lane and vertical reach, backwards catches under the hinge,
  mirrored head poses. Only a fresh lid opening knocks items away; they fling
  back against the wind. A closed lid and automatic jam recovery do not knock.
- Validation: all 32 unit-test files pass; browser regression verifies both
  sticks scroll a long entry on an 844×390 screen with the poem fixed.

## Done on `main` (2026-10-09)

| Commit | What |
| --- | --- |
| 2026-10-12 | A resting mouse no longer takes over from a controller or keyboard (needs about 24 px of movement in half a second; `nudge` in input.js): it made the Coot drift to the cursor |
| 2026-10-12 | Pictures that fail to load are retried (3 tries, then again before each game: `loadImage`, `reloadMissing` in main.js); Scoop Stack pass mark 10 to 6 |
| 2026-10-11 | Fullscreen on/off in Settings (`src/fullscreen.js`); World Record card with confetti, rosette and fanfare, and a smaller "Passed" tick and sparkles, on already-passed birds (`resultKind` in `src/reward.js`) |
| 742e072 | Puddle Hop chicks one size as they fly off |
| 3ec4c10 | Broomwhisk re-request (IC-M06f/g) |
| 369d8fd | Third audit: every pose of a character at one size, in 12 games (AUDIT.md, `pose-scales.json`, `sprite-rig.mjs`) |
| 361b9bf | Sticker book: still parts cached, stickers cut ahead of time (about 11 to 59 fps) |
| e1c672f | Press Start on the horizon, halfway between logo and camera bird (`placePressStart` in main.js) |
| 0e1cb32 | Soup's On: bits lying across the ring count; RS / Q-E / wheel resize the ring 0.8x to 1.3x |
| 6f3263c | Pause menu ignores a stick held when pausing until it is centred (`navStickHeld` in input.js) |
| 4eb3443 | Puddle Hop and Slippery Dishes new sheets fitted at one size |
| f521624 | Snip the String bird turns to face and snip either way |
| 6e72cc7 | Lights On: the Swift's beak works the bubbles, panes and fuse lever |
| d6335c2 | Bin Day pieces registered by measured features; fairer catching |
| 1c579b8 | Press Start lower, title hint line removed |

## Ways of working

- Checks, from `icecreamcone/game`: `node --test test/*.test.mjs`,
  `node scripts/browser-check.mjs` (`--no-games`, `--bird <id>`), and
  `python3 ../design/source/build_requests.py --check`.
- Size sprites from a feature that doesn't change between poses (eye, rim,
  lid, handle), never from cell or outline height; each game's test holds its
  poses within 4-5% of standing.
- `?debug` shows every card turned over, celebrates every pass, and keeps saves
  for the session only.
- When agents share the checkout, commit with explicit file lists and test
  the staged change in a clean worktree.
