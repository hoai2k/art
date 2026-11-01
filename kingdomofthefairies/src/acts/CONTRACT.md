# Act module contract

Each act of Kingdom of the Fairies is one module in `src/acts/`, listed in
`src/acts/index.js`. The shell (`src/main.js`) owns the title, playbill, act
cards, retry card, pause and curtain call. The renderer (`src/art.js`) owns
the two-pass stencil colouring, film look, proscenium, curtains, footlights
and HUD. An act owns only what happens on its stage. The design of every act
is in `design/acts.md`; Act I (`act1.js`, `act1-art.js`) is the worked
example.

## Files per act

- `src/acts/actN.js`: rules and state, **headless** (no DOM, no canvas), so
  it can be tested in Node. It exports the module object as the default
  export and imports its drawing from `actN-art.js`.
- `src/acts/actN-art.js`: drawing, using only the kit (below).
- `qa/actN.test.mjs`: headless tests, run with
  `node kingdomofthefairies/qa/actN.test.mjs`. Simulate the act with scripted input
  and check that it can be won, can be lost, and that its keepsake and beat
  logic work. `act1-art.js` imports nothing that touches the DOM at load, so
  `actN.js` can be imported in Node; keep it that way. Don't touch
  `document` or `window` at module top level.

Helpers shared by acts are in `src/acts/shared.js`: `beatHit`,
`beatPhase`, `BEAT_WINDOW`, `clamp`, `lerp`, easing, and `rng` (seeded).

## The module object

```js
export default {
  id: 2, kicker: 'Act II', title: "The Sleepers' Grotto", size: 110,
  sub: 'Card text, one or two short lines (\n between).',
  action: 'A: kick',                 // for the instructions
  intertitle: 'Press [A] to …',      // optional: a silent-film card after the act card
  create({ seed, carry }) → state,
  step(state, dt, input),            // dt ≤ 0.05 s
  hud(state) → spec | null,
  announce(event) → string | null,   // optional: screen-reader line
  focus(state) → { x, y } | null,    // optional: the player's middle on the stage,
                                     // for the mobile camera (src/camera.js); null = whole stage
  draw(kit, state, t),               // the stage, inside the frame
  drawOver(kit, state, t),           // optional: over frame and HUD (irises)
  onEvent(kit, event, state),        // optional: particles, flashes
};
```

**Button names in text.** In `sub` and `intertitle`, write `[A]`, `[B]`,
`[MENU]` or `[LS]` for a button. The renderer draws it for the input in use:
an Xbox button for a controller, a key cap for the keyboard, or the touch
button on a phone or tablet. The intertitle is skipped on a retry.

**`carry`** is what the player brings from earlier acts:
`{ tea: 0..3, guitar, rose, pearl, stone, sleepers, score, pearls }`. The
booleans are keepsakes; `sleepers` is the number of drowned revellers woken
in Act II.

**`state`** must include:

- `status`: `'play'`, then `'won'` or `'lost'`; and `statusT`, the seconds
  since the status last changed. The shell advances shortly after a change.
- `events`: an array the act pushes `{ type, ... }` objects into. The shell
  drains it every frame. It plays `audio.play(type)` (a missing sound is
  silent), calls `onEvent` and `announce`, and rumbles the pad on `hit`.
- `result`, set when the status becomes `won`:
  `{ keepsakes: { ... }, sleepers?, score, pearls, ending? }`. Only the
  keepsakes this act grants go in `keepsakes`, for example `{ pearl: true }`.
  Act V sets `ending` to `'witch'`, `'lamp'` or `'dark'`.
- When lost, optionally `lostTitle` (a string with `\n`) and `lostSub` for
  the magenta retry card. The default title is "The Sea Keeps Her Own".

**Win and lose.**

- Three lanterns of health, as in Act I. A hit costs one and grants 1.6 s of
  grace. At zero, play the defeat beat for a second or two, then set
  `status = 'lost'`.
- Winning should play its own outro (an iris or a scene change) and then set
  `status = 'won'`. Draw the iris in `drawOver` with `kit.iris(x, y, r)`.
  While `status === 'won'`, keep drawing it closed (`kit.iris(x, y, 0)`),
  because the shell moves to the next act a moment later.

**`input`**, each frame:

- `moveX`, `moveY`: continuous, −1..1, with `moveY` positive meaning down.
- `up`, `down`, `left`, `right`: fresh presses, with menu-style repeat on
  the stick.
- `a`: a fresh press of A, Space, Z or J. `aHeld`: A held.
- `b`: a fresh press of pad B, X or Backspace. Use it for refusing or
  cancelling. Escape is pause and never reaches the act.
- `x`: a fresh press of pad X, or the X key (or touch B). Use it for taking
  or using something within reach (Act II's dive). The X key and touch B also
  reach `b`, so an act reads one or the other in a given moment. `xHeld`:
  X held (Act III's bow).
- `beat`: the song's beat as a running number (`audio.beat()`). Its
  fraction is the phase within the beat. Use `beatHit(input.beat)` for
  on-beat presses, and `beatPhase` to make machinery move on the beat. Don't
  run your own tempo clock. Store the latest beat in the state (for example
  `state.beat = input.beat`) if drawing needs it.

Until the curtain is 90% open, the shell sends zero movement and no presses
(the beat still comes).

**Scenes and checkpoints.** Losing never sends the player back to the top
of the act: the retry starts at the latest checkpoint. The same scenes make
up the scene select in the menu.

- `scenes`: the act's scenes in story order, `[{ name }, ...]`. Scene 0 is
  the start of the act. A scene is a place worth starting from: just past a
  key item, a new stretch of the stage, the start of a cutscene that leads
  into the next part.
- `create({ seed, carry, from })`. `from` is `null` (start of the act) or
  `{ scene: k, ...data }`. With only `scene`, which is what the scene select
  sends, start scene k with sensible defaults. The act's key items that lie
  before scene k count as already gathered (Act I's leaves, Act II's guitar,
  Act IV's stone, Act V's beloved when carrying her). Score, pearls and
  optional extras start at zero. With data, which is a checkpoint the act
  made itself, restore exactly that progress.
- `state.checkpoint`: `null`, or `{ scene: k, ...data }`. Set it, as a new
  object, whenever the player passes a point worth resuming from, such as
  picking up a key item, reaching a new stretch or entering the next part.
  `data` holds whatever `create` needs to put the player back there: what
  they have gathered (for example which pearls are taken, which sleepers are
  woken, whether they hold the stone), their score and pearls, and where to
  stand. It must be plain JSON, with no Sets, functions or class instances,
  because the shell copies it with `JSON.parse(JSON.stringify(...))` and
  notes the highest scene reached in the save. The player resumes with full
  lanterns; hazards start afresh. `create` from a checkpoint should set
  `state.checkpoint` to that same checkpoint (`{ ...from, scene: k }`), so a
  second loss returns to the same place.

Test it in the browser with `?qa&act=N&scene=k`.

**Art that is requested but not delivered yet.** Draw it with
`if (!k.asset(id, ...)) { stand-in }` exactly as for delivered art. To check
where the art will land before it exists, add `&testart`: every `requested`
slot is filled with a labelled placeholder at its requested size, with its
anchor marked (yellow cross) and a walkable top edge in green.

**`hud(state)`** returns
`{ lanterns, maxLanterns: 3, pearls, progress: 0..1 | null, keepsakes: [{ id, have }] }`,
or `null` to hide the HUD (during cutscenes). Keepsake ids that have icons:
`leaf`, `tea`, `pearl`, `rose`, `guitar`, `stone`. Optional `wind:
{ dir, warn }` shows the valance weathervane (Act I only).

## The kit (drawing)

`draw(kit, state, t)` is called **twice per frame**: once for the
monochrome print pass and once for the colour stencil pass. Always draw
through `kit.c` (the current pass's context) and colour through
`kit.col('#hex')`, which returns grey in the print pass. Never cache
`kit.c`. Draw the same shapes in both passes; randomness inside `draw`
breaks the registration between them, so drive any variation from state or
`t`.

The stage is 1280 × 720. The playfield inside the painted drapes is about
x 150–1130, y 60–650. The floor band below 650 carries the HUD.

| Kit member | What it does |
| --- | --- |
| `kit.c`, `kit.P`, `kit.PAL`, `kit.t` | context, painter, palette (`plum pink magenta lavender gold coral teal tealDeep foam sky skyLow cream wood woodDark velvet velvetDark rock stripe`), time |
| `kit.col(hex)` | the colour for this pass |
| `kit.img(id)` | the delivered image for an art id, or undefined |
| `kit.asset(id, cx, bottomY, w, h, extra?)` | draw delivered art anchored bottom-centre; returns `false` if not delivered, so you can draw a stand-in |
| `kit.assetCrop(id, sx, sy, sw, sh, dx, dy, dw, dh)` | part of a delivered image |
| `kit.wire(x, y0, y1)`, `kit.circle(x, y, r)`, `kit.star(x, y, r)` | primitives (fill and stroke style are yours) |
| `kit.cloud(x, y, scale, colour?)` | a hung cloud flat |
| `kit.moon(x, y, r)` | the hung moon with its face |
| `kit.sky(board?)` | Act I's night sky backdrop (pass `null`) |
| `kit.waves(row, scrolled, yOff?)` | Act I's painted wave strip for row 0–2 (`kit.ROWS[row].y` is its waterline, `.scale` its depth) |
| `kit.moonboat(x, y, face, scale)` | the witch's moon boat and dragon (`face` −1 = left) |
| `kit.lighthouse(x, groundY, lit)` | the lighthouse and cottage |
| `kit.band(k, title)` | the query-edition band cut-out (hidden by default): `title` 1 = standing on the stage-left floor; 0 = rising through the trapdoor by `k` 0..1 |
| `kit.keepsake(id, x, y, scale, empty?)` | a keepsake icon |
| `kit.burst(x, y, hex, n)`, `kit.text(str, x, y, big?)` | particles and floating text (call from `onEvent`, never from `draw`) |
| `kit.flash(v)`, `kit.shake(v)` | screen flash and shake (from `onEvent`) |
| `kit.wash(hex, alpha)` | a tint over the whole stage, such as the pink shore or the red fire |
| `kit.iris(x, y, r)` | black everywhere outside a circle (stage coordinates, mapped through the mobile camera) |
| `kit.flat(f)` | run `f()` fixed to the screen rather than the zoomed stage: for instructions or gauges an act paints at set places from `draw` |

**The mobile camera.** On phones the shell zooms `draw` (and particles and
`kit.text`) toward `focus(state)` while the scene is in the player's hands
(`touchLive`). The frame, HUD, `drawOver` and `k.over` captions are not
zoomed. Anything in `draw` that belongs at a fixed place on the screen goes
through `kit.flat`.

**Art.** Use the art ids from `design/image-requests.md` Part C, at the
sizes given there halved (requests are at 2× stage pixels). Every id gets a
procedural stand-in in the same spirit: flat painted cut-outs on wires and
sticks, front-on, in the palette. When the real file is delivered,
`kit.asset` draws it instead with no code change. Stand-ins should read
clearly at a glance: silhouettes and colour blocks, not detail.

**Sound.** Name your events after what happens (`clamSnap`, `sleeperWake`,
`sentrySnap`). The shell plays `audio.play(type)`; a name with no sound yet
is silent. Real sounds are generated later with ElevenLabs from
`design/source/build_sfx.py`. List each new event name, with a one-line
foley description, in your report.

## Testing in the browser

The page is static. Serve the folder directly and jump to your act:

```sh
cd widowsbay && python3 -m http.server <port>
# open http://localhost:<port>/?qa&act=N&carry=all
```

`?qa` exposes `window.__widowsBay = { S, settings, audio }`: `S.state` is
your act's state and `S.mode` the shell mode. `act=N` jumps straight to act N
after Press Start. `carry=all` gives every keepsake except the rose;
`carry=rose` gives the rose too.

Playwright is at `/opt/node-tools/node_modules/playwright`; load it with
`createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright')`.
Chromium is preinstalled. Click `#start`, press Enter until
`S.mode === 'play'`, then drive it. Check for page errors and take
screenshots.

Rendering is slow without a GPU (about 25 fps), so let time pass in real
seconds. The song may still be loading; the act card holds until it is
ready.
