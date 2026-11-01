# The Ice-Cream Cone Coot

A field guide of rare birds from Arnold Lobel's *The Ice-Cream Cone Coot and
Other Rare Birds* (1971), with a Mario Party-style minigame for each bird:
catch scoops as the Ice-Cream Cone Coot, pour tea into the Cupadee, take
pictures as the Shuttercluck, and so on through all 28 of the book's birds. Each game lasts 30
to 60 seconds and keeps your best score ("New World Record!" when you beat
it, or "Personal Best!" while it's still short of the bird's score). Every
bird can be played from the start; until you reach its score it shows only
as a silhouette in the guide (its name, rhyme and game are all there, and
the game itself draws it in full). Reaching the score spots it: its sticker
goes in the sticker book and its card in the guide turns over to its
painting. The book opens at a
painting of all the birds together, each bird's spot greyed until its
sticker is snapped into it (it melts in and the bird takes its colour; on a
phone the painting is zoomed in and scrolls); the stickers can also be put
anywhere on its pages, over that painting, a plain page or a picture of each
bird passed (its own book painting, IC-B01..B28, or its game's scene until
that arrives).

Play it at https://hoai2k.github.io/mini/icecreamcone/. It sits behind the
shared invite gate (`game/src/gate/gate.js`, a copy of `gate/loader.js` from the
`hoai2k.github.io` repository, which loads the shared door), which is off on localhost.

- [`design/design.md`](design/design.md): the flow, the guide, the sticker
  book, the controls and the first ten minigames; the other 18 are in
  [`design/more/`](design/more/).
- [`design/music.md`](design/music.md): the music, which track plays where, and
  tracks that could be added later.
- [`design/image-requests.md`](design/image-requests.md): the open image requests
  (finished ones move to [`design/image-requests-history.md`](design/image-requests-history.md)),
  generated from [`design/source/build_requests.py`](design/source/build_requests.py),
  which also writes `game/src/asset-list.js`. Edit the data there and rerun it.
  Delivered images live in [`game/assets/`](game/assets/); the request list tracks remaining work. The first
  25 images have prompts and checksums in
  [`design/image-deliveries.json`](design/image-deliveries.json); the 14
  gameplay sprites and the medal sheet (no longer used) are recorded with their grid layouts in
  [`design/image-deliveries-round-2.json`](design/image-deliveries-round-2.json).
  The expanded seaside for Scoop Stack is recorded in
  [`design/image-deliveries-wide.json`](design/image-deliveries-wide.json).
  The 18 additional book birds and 10 original pocket birds are recorded in
  [`design/image-deliveries-subjects.json`](design/image-deliveries-subjects.json).
  Backgrounds for the 18 additional minigames are recorded in
  [`design/image-deliveries-minigame-scenes.json`](design/image-deliveries-minigame-scenes.json).
  New image drops go in [`intake/`](intake/README.md).
- [`reference/`](reference/README.md): photos of the book's pages and notes on
  its style and its birds, for the image generator. Reference only; never
  published.

| File | What it is |
| --- | --- |
| `game/src/main.js` | Screens, menus and navigation, the guide, bird pages, running a minigame (count-in, HUD, pause, results, best scores) |
| `game/src/reward.js` | After a round: celebration or brief result, the celebration's steps and timing, the sticker book's layout (two spreads of 14, or all the birds together on one spread with the sticker sheet) |
| `game/src/celebrate.js` | The sticker celebration and the sticker book screen, drawn on the stage: die-cut stickers from the portraits, the book and its pictures, the greyed spots of all the birds together and a sticker snapping into one, the flight, the hand |
| `game/src/stickerbook.js` | The sticker book's rules: where a dropped sticker goes, the pile's order, the pictures available, what is saved (and loading older saves); on all the birds together, which spot a drop lands on (from `assets/book/gathering.atlas.json`), snapping in and out, and the zoomed view's scrolling |
| `game/src/birds.js` | The field guide's 28 birds in order: names, rhymes, goals, tips, the score that spots each bird (the first ten here) |
| `game/src/more/*.js` | The book's other 18 birds' guide entries (pages 11 to 28), with their controls; `more/index.js` puts them in order |
| `game/src/subjects.js` | The birds Shuttercluck can photograph (the 18 above and ten of our own): names, rarity, their stand-in drawings and where each painting goes; a round can show any of them, spotted or not |
| `game/src/games/*.js` | One minigame per bird; `games/index.js` documents the contract they share |
| `game/src/draw.js` | Ink-and-wash drawing: the stand-in birds, how each delivered portrait is placed, and what is drawn over it (lamps, growth, blinks) |
| `game/src/input.js` | Controllers, keyboard, mouse and touch, as one small set of actions |
| `game/src/audio.js` | Synthesised sound effects; the recorded music and celebration fanfare (`game/assets/music/`, `game/assets/sfx/`), with music-box tunes standing in |
| `game/src/games/difficulty.js` | The one difficulty curve every minigame follows, and `knob(d, easy, medium, hard)`; Settings → Difficulty (Easier · Normal · Harder) picks the curve. See `design/difficulty.md` |
| `game/src/points.js` | Points: each change in a game's score times (1 + d), the difficulty at that moment (1x to 2x), worked out by the shell; see `design/difficulty.md` |
| `game/src/store.js` | Saved settings, bests in points and best plain scores (one of each per Difficulty level; older saves converted) and the sticker book (`icecreamcone.stickers.v1`) |
| `game/assets/*/gathering.atlas.json` | Where each bird is in the two gathering paintings (the book's 2:1 one and the finale's 16:9 one) |

## Controls

| Action | Controller | Keyboard | Mouse or touch |
| --- | --- | --- | --- |
| Move | Left stick or D-pad | Arrow keys or WASD | Point: the game follows |
| Action (press or hold) | A or RT | Space or Enter | Click or tap, hold to hold |
| Left / right step (Bobolinks) | LB / RB or D-pad ◀ ▶ | ← / → | Tap the left or right half |
| Wind the spring (Gullfinch) | Spin the left stick | Tap Space or ← → between notes | Drag in circles |
| Pause | Menu or View | Esc or P | The pause button |
| Sticker book: open (from the guide) | Y | Arrows to the Sticker Book button, Enter | The Sticker Book button |
| Sticker book: pick up / put down (on its own bird in all the birds together, it snaps in) | Stick moves the hand, A | Arrows move the hand, Space | Drag |
| Sticker book: look around a zoomed picture (phones) | Move the hand to its edge | Arrows to its edge | Drag the picture, or carry a sticker to its edge |
| Sticker book: picture / turn the page | LB RB / LT RT | Q E / Page Up, Page Down | The arrows |
| Sticker book: put back / close | B | Esc | The × |

## Run and check

```sh
cd icecreamcone/game
python3 -m http.server 8125        # then open http://localhost:8125/
                                   # every bird is playable anyway; ?debug shows every card turned
                                   # over (and every sticker and picture in the sticker book), and
                                   # every round that reaches its score plays the sticker
                                   # celebration (?all: the cards only); in ?debug
                                   # scores, stickers and resets last only for the tab's session
node --test test/*.test.mjs        # birds, every minigame idle and mashed, a bot per game,
                                   # the sticker book's layout and rules
node scripts/browser-check.mjs     # in Chromium: title → guide → page → play → pause → result → guide,
                                   # first pass → sticker celebration → its own card turning over, repeat → result,
                                   # a fresh save playing the 10th bird and turning its card,
                                   # (snapping into all the birds together), ?debug, keyboard round,
                                   # the 28-card guide, the sticker book (all the birds together:
                                   # snap in, wrong spot, take out, with the mouse and the controller;
                                   # the spreads; pictures; kept over a reload), the gathering zoomed
                                   # and scrolling on phones (390x844, 844x390), then all 28
                                   # minigames to their end (--no-games skips those)
python3 ../design/source/build_requests.py --check
```

`publish.sh` copies the game into the Pages output (`local/pages/icecreamcone`).
The browser check simulates an Xbox controller by replacing
`navigator.getGamepads` and runs with `?dt=0.05`. Testing with a real Xbox
controller, and listening to the synthesised sound, are still outstanding.
