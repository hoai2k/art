# Stratford

Exploring downtown Stratford, Ontario as small creatures. Today this folder
holds the **prototype**, *Stratford Squirrel*: a black squirrel running,
leaping and climbing through a 3D model of the town around Market Square, the
Avon River and the theatres, built from OpenStreetMap and LiDAR. Squirrels
come first; insects are planned, so the world streams in pieces and changes its
detail with the creature's size.

The prototype publishes at https://games.hoai.net/art/stratford/prototype/.
On purpose there is no page at `/art/stratford/` and no card in the game
library yet: those come with the game proper, once the prototype has been
worked on.

## Layout

- [`prototype/ARCHITECTURE.md`](prototype/ARCHITECTURE.md): the contracts
  between the parts: world coordinates, the `town.json` schema, the World and
  creature contracts, controls, and "Many creatures, many scales" (streamed
  chunks, collision queries, detail layers, transitions).
- [`prototype/game/`](prototype/game/): the game, static ES modules, no build
  step. three.js r170 and three-mesh-bvh 0.8.3 vendored in `lib/`.
  - `index.html`, `styles.css`, `src/main.js` (shell, loop, screens),
    `src/input.js`, `src/audio.js` (all synthesized), `src/ui/` (title,
    menus, HUD, map and journal), `src/game/` (landmark discoveries, nuts,
    the save).
  - `src/town/`: the streaming town (200 m chunks, LOD, colliders, landmarks,
    streets with real curbs, trees, water, sky, detail layers by scale).
  - `src/creatures/` (registry, generic controller, camera, collision) and
    `src/squirrel/` (model, animation, tuning); `src/stand-in-world.js` (a
    test yard).
  - `data/`: `town.json` + `terrain.bin` from [`prototype/tools/town/`](prototype/tools/town/README.md).
  - `assets/`: delivered full-size art (not published) and the built squirrel
    model; `web/`: the small copies the game loads, made by
    `prototype/tools/build_web.py`, which also writes `assets/manifest.json`.
  - `lab/town.html` (fly or walk at any creature scale, detail layers,
    time of day) and `lab/squirrel.html` (the squirrel on the test yard;
    `?town=1` for the town): developer benches, published but unlinked.
- [`prototype/squirrel.md`](prototype/squirrel.md): how the squirrel is built
  and animated, and what's left for the new black squirrel.
- [`prototype/image-requests.md`](prototype/image-requests.md): every image the
  game asked for (procedural stand-ins until delivered).
- [`prototype/reference/`](prototype/reference/README.md): openly licensed
  photos with a catalogue, the generated reference sheets, the data sources
  (`data/README.md`) and [`town-notes.md`](prototype/reference/town-notes.md)
  (written observations of the landmarks from sources of every kind; no
  copyrighted images are stored). Never published.
- [`intake/`](intake/README.md): the drop box for new art and photos.
- `publish.sh`: copies the playable prototype to `local/pages/stratford/prototype/`.

## Checks

Run from the repository root before committing a change here:

```bash
node --test stratford/prototype/game/test/shell.test.mjs stratford/prototype/game/test/town-data.test.mjs stratford/prototype/game/test/squirrel.test.mjs stratford/prototype/game/test/town.test.mjs
```

```bash
node stratford/prototype/game/scripts/browser-check.mjs
```

```bash
python3 stratford/prototype/tools/build_web.py --check
```

The squirrel and town tests and the browser check use Playwright with
Chromium. In software WebGL the real town draws a frame in seconds, so the
browser check runs a smoke test on the real town and its full controller suite
on the test yard. The on-demand "tests: full" deploy run uses only the
browser-free tests (shell and town data).

## Data and credits

Map data © OpenStreetMap contributors (ODbL). Elevation from NRCan's High
Resolution Digital Elevation Model (Open Government Licence – Canada). Details
in `prototype/reference/data/README.md`.
