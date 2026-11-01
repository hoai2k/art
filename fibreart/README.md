# Fibre Art

A shifting collage after the work of Hanneke de Neve, a Dutch-born artist in
New Jersey and a friend of the repository owner. Published at
https://hoai2k.github.io/mini/fibreart/.

Each scene is one of her pictures rebuilt as a live patchwork: a ground cut
into panels, with pieces of cloth laid on it. Every stick, trigger and button
is tied to something in the picture, some to a single moon or face, a few to
the whole picture. Small moves set up the large ones: a large control is
centred on one piece, and its reach grows as that piece is brought to the
middle, sewn to others or brought to its partner. Large effects rearrange the
picture or carry it into the next scene, and the controls are dealt again.
Nothing to win or lose; left alone, the pieces drift home. The pictures are
never quite still: wind gusts bend the trees and blow leaves across, and the
people breathe and tilt their heads. One to four controllers, plus keyboard and
mouse, or touch: on a phone the pieces themselves are the controls (drag one,
hold it still, tap it, fling it, and the controls bound to it answer), a piece
can be pinched and twisted, and the view pans across the picture when it is
larger than the screen.

## Layout

- [`game/`](game/): the game, static ES modules with no build step.
  - `index.html`, `styles.css`; `src/main.js` (shell, menus, players, pointer),
    `src/collage.js` (the rules: pieces, panels, bindings, verbs, setups, scene
    changes; no DOM, tested in Node), `src/render.js` (WebGL2: pieces as
    bendable meshes, one shared swirl/tide/ripple field, mask dissolves),
    `src/life.js` (wind, gusts, blowing leaves, breathing, blinking: the
    pictures' small life), `src/overlay.js` (stitched outlines, threads, pinned drawings),
    `src/input.js` (one player per controller, keyboard as another),
    `src/audio.js` (the song, *Aksak Folk Dance* by hoai2k, looping under
    every scene, and plucks and chimes made in the browser in its key, C minor).
  - `web/`: the optimised art the game loads and `web/scenes.json` (every
    scene's pieces, their homes in the composition, kinds and morph chains),
    written by [`tools/build_web.py`](tools/build_web.py) from `assets/`.
  - `assets/`: the full-size delivered images and the original song (not published); see
    [`game/assets/README.md`](game/assets/README.md).
  - `test/`: Node tests of the rules; `scripts/browser-check.mjs`: a Playwright
    run with a simulated Xbox controller that plays every scene.
- [`design/design.md`](design/design.md): the scenes, layers, verbs and how
  the controls work, and what playing it with the delivered art showed.
- [`design/image-requests.md`](design/image-requests.md): the image requests,
  generated from [`design/source/build_requests.py`](design/source/build_requests.py)
  (which also writes `design/asset-list.json`). Edit the data there and rerun it.
  [Image preview](design/generated-preview.jpg), [piece preview](design/pieces-preview.jpg),
  [delivery records](design/image-deliveries.json).
- [`reference/`](reference/README.md): photos of 28 of her works, a catalogue
  with sources, her statement, palettes and style notes. Reference only.
- [`tools/`](tools/): `extract_pieces.py` cuts the delivered piece sheets;
  `build_web.py` makes `game/web/` (Pillow, NumPy, SciPy).
- [`intake/`](intake/README.md): the drop box for new images and photos.

All 62 image requests are delivered. The generated icon, Viriditas ground,
Moons and hearts and Dancers pieces, and tree and bird morph chains now replace
the earlier stand-ins. Animation assets, control drawings and eight pause-menu badges are included.
All of it was checked in play; see "What playing it with the art showed" in
[`design/design.md`](design/design.md). [`design/checkpoint.md`](design/checkpoint.md)
records how the deliveries were saved.

## Run and check

Serve `fibreart/game/` with any static server and open it, for example
`python3 -m http.server -d fibreart/game 8000`.

```sh
node --test fibreart/game/test/*.test.mjs
python3 fibreart/design/source/build_requests.py --check
python3 fibreart/tools/build_web.py --check      # after changing art or piece homes, rerun without --check
(cd fibreart/game && node scripts/browser-check.mjs --shots /tmp/fibreart-shots)
fibreart/publish.sh local/pages/fibreart
```

Browsers: current Chrome, Edge, Firefox and Safari with WebGL 2. Controller
play was checked with a simulated Xbox controller in Chromium; testing with a
real controller is still outstanding.
