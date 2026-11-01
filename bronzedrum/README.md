# Bronze Drum

A drum-command rhythm game about the Trưng sisters, who raised an army of
women against Han rule around 40 CE. It adapts Phong Nguyen's novel
*Bronze Drum*, staged as a backlit paper-cut theatre.

Play it at https://hoai2k.github.io/mini/bronzedrum/. It has nine
chapters in story order: four battles, four call-and-answer chapters (echo
the caller's rhythm), and one casting chapter (keep pace with the bellows).
[`design/design.md`](design/design.md) lists them.
It sits behind the shared invite gate (`game/src/gate/gate.js`, a
copy of `gate/loader.js` from the `hoai2k.github.io` repository, which loads the shared door, loaded by
`game/src/boot.js`), which is off on localhost. The sound workbench is not gated.

**Drum Practice**, on the title screen, has no right or wrong. In free drumming
the crew loops whatever rhythm you drum, until you clear it, while you play
along and dancers gather. In call and answer
you and a partner take turns to call a rhythm and answer it, and the exchange
plays on until you clear it. Training lists every rhythm the chapters
use (plus a few of its own), numbered and sorted into nine levels of difficulty, to practise one at a
time (`src/training.js`; `LEVEL_OVERRIDES` there moves a rhythm to another level). You can set the length (2 to 12 beats, rests
allowed) and play a secondary drum alongside the bronze one: the barrel drum by
default, or a mõ, rice drum, gong, bamboo, lion-dance drum or cymbals.

It plays with a controller, a keyboard, a mouse, or on a phone or tablet held
sideways, where the bronze drum becomes the instrument: tap its centre and its rim.
On a phone the first tap in landscape goes full screen (on iPhone Safari, swipe
up to hide the bars, or add the game to the home screen).

In the tutorial, faint drum dots follow the rhythm in the current instruction
or demonstration, including its tier. Entering a different command shows only
the strokes played, without suggesting an unrelated continuation.

- [`design/design.md`](design/design.md): the concept, the core loop, the art
  direction and the open questions.
- [`design/image-requests.md`](design/image-requests.md): the image requests,
  generated from [`design/source/build_requests.py`](design/source/build_requests.py).
  Edit the data there and rerun it. The script also writes
  `game/assets/manifest.json`, which the game reads.
- [`design/sound-effects.md`](design/sound-effects.md) and
  [`design/music-requests.md`](design/music-requests.md): the sound effects
  (generated with ElevenLabs) and the prompts for the score, both built from
  [`design/source/build_audio.py`](design/source/build_audio.py).
- [`design/screens/`](design/screens/): screenshots of the game with the
  delivered art.
- [`game/`](game/): the game itself, static ES modules with no build step.
- [`workbench/`](workbench/): the sound workbench (published only while
  `deploy_config.json` says `"includeWorkbenches": true`), published at
  https://hoai2k.github.io/mini/bronzedrum/workbench/. It plays each chapter's
  ambience next to its alternate takes (level-matched, with an optional drum
  over them), every effect take and the music, and lets you mark each one and
  copy the notes. Its catalogue, `sounds.json`, is written by `build_audio.py`;
  `--alternates` makes the alternate beds and `--music-trial` the music experiment.
  `node workbench/make-scenes.mjs` recaptures the chapter scenes shown beside
  the sounds (`workbench/scenes/`).

## Text

Every word the game shows is in [`game/src/text_config.js`](game/src/text_config.js):
menus, settings and their tips, credits, instructions, chapter titles, stories
and endings, hints, lessons, on-screen labels, Drum Practice and Training. Keys
say where the text appears; `{name}` marks a value the game fills in. The page
(`index.html`) holds no words of its own: its elements carry `data-text` keys
and are filled from the file when the game starts. (It is plain JavaScript,
not TypeScript, because the game runs without a build step.)

## Run and check

```sh
cd bronzedrum/game
python3 -m http.server 8123     # then open http://localhost:8123/
node --test test/*.test.mjs     # rhythm reader, chapters, battles, practice
node scripts/check.mjs          # syntax, manifest ids, no per-frame canvas filters
node scripts/browser-check.mjs  # in Chromium: frame time per scene, demonstration
                                # timing under a slow CPU, title selection
python3 ../design/source/build_requests.py --check
python3 ../design/source/build_audio.py --check
python3 ../design/source/build_web_art.py --check
python3 ../design/source/build_rigs.py --check
```

## Music

The five core tracks are delivered: the title theme (`mu-title`), the chapter
select (`mu-select`), the battle and story beds (`mu-bed-battle`,
`mu-bed-story`) and the ending (`mu-ending`). The anthem, the Song of the Two
Queens (`mu-anthem`, *Trống Đồng Vang Dới Đất Trời*), plays round and round on
the menus (title, chapter select) and on the Coronation's success moment.
The two old menu themes moved into chapters, each in place of its shared bed
until the chapter's own bed arrives: `mu-select` (the two sisters) under the
Garden, and on Drum Practice's screen of modes (the drumming itself has no music), and `mu-title` (quan họ call and answer) under The
Villages Answer. Measured, neither has a stronger pulse than the shared beds
(onset autocorrelation 0.52 and 0.58, against 0.53 and 0.76), so neither
fights the player's tempo. The rest of
[`design/music-requests.md`](design/music-requests.md) is optional; each
chapter falls back to the shared bed until its own arrives.

The tracks as delivered are kept in `design/music-masters/<id>.mp3` (not
published). To add or replace one, put it there under its request id and run:

```sh
python3 bronzedrum/design/source/build_audio.py --music
```

This writes the game's copy to `game/assets/music/` (cover art stripped, silence
trimmed, matched to −17 LUFS, 128 kbps) and measures the loop points of the
looping tracks into `design/source/music-loops.json`: where the body starts
after the fade-in and ends before the fade-out. The game never restarts a loop
outright. Just before the loop end it starts a second copy at the loop start
and crossfades the two over three seconds on an equal-power curve, so neither
the track's own fades nor the gap browsers leave when an MP3 loops are heard.

## Sound effects

All sound effects come from ElevenLabs. To generate missing effects, or to
remake one, run:

```sh
python3 bronzedrum/design/source/build_audio.py --generate [--force <id>]
```

The script reads the API key from the `ELEVENLABS_API_KEY` environment variable
(set it in the cloud environment's settings) or from `~/.config/elevenlabs.key`.
The key is never committed.

Each take is checked by measuring its level over time and how its energy splits
between low and high frequencies. Takes that fail are listed in `REJECTED` with
the reason. The game falls back to its synthesised sounds for anything missing.

`bronzedrum/publish.sh local/pages/bronzedrum` copies the game into the Pages
output. The workflow in `.github/workflows/pages.yml` runs the tests and the
manifest check, then publishes the game.

## Responsiveness

A stroke must be heard and seen the moment it is played, so the frame loop is
kept light and every clock is read precisely:

- **One smooth clock.** Sounds are scheduled on the audio clock, but it only
  advances once per audio buffer (every 3 ms in Chrome, 10-40 ms elsewhere), so
  `songTime()` in `main.js` reads the performance clock locked to it. Pictures
  drawn from it move evenly, and a stroke's time is exact.
- **Strokes land on the first frame.** The close-up sticks and the sisters on
  the palanquin are drawn on the drum from the first frame after a stroke, then
  lift back to the ready (a swing in would only show after the sound).
- **Controllers between frames.** A controller is polled every 4 ms as well as
  once a frame, and a stroke is timed from the controller's own timestamp.
- **Samples start on the attack.** Leading silence (MP3 padding, which not
  every browser removes) is cut from one-shot samples when they load.
- **Fewer full-screen layers.** The far scenery (sky, far karst, karst, haze)
  is cached as one image, redrawn only when its slow parallax moves a pixel,
  and the paper fibre and vignette are baked into one overlay: about 5 screens
  painted per frame instead of 9.
- **Resolution follows the frame rate.** If play runs below about 50 fps for
  two seconds, the canvas drops half a step of pixel ratio (to no less than 1).

## Delivered art

Settings, Style chooses between the shadow puppets and the water puppets (see
`design/design.md`, Two looks). All 60 water-puppet images (BD-W01 onwards)
are delivered and load under `wp-` ids: lacquer scenery, a pond strip, chapter
cards, props, effects and figures. The scenery, props and cards use lacquer painting. The 18 figure and rig sheets
were regenerated as rounded carved wooden puppets, and BD-WP11 now includes
the water pavilion. The water sisters use independently measured crop boxes;
shadow art and rigs are retained. Replacement provenance and native/export sizes
are recorded in `design/image-regenerations-water-puppets.json`.
BD-WC15 faces left and has distinct stride and tucked-leg running poses.
All 19 water-puppet regeneration requests are delivered.

All 152 requests have generated artwork, including BD-C14, the wider drum
palanquin with standing places for the sisters, and the five Drum Practice assets
(BD-U17 to BD-U19, BD-P11, BD-C13): 21 style and direction images in
`design/references/` and 131 game images in `game/assets/art/`. The shadow set follows
the coloured-paper direction (BD-S02); the water set follows BD-W01.

BD-U26 supplies the card art for Drum Practice's Training mode. The first
chapter's lesson in blocking uses BD-C15 (village children throwing stones) and
BD-C16, BD-C17 (the spearwoman and the archer covering their faces), replacing
the procedural stand-ins.

BD-U20 and BD-U21 are delivered close-ups of the sisters' forearms and sticks
that swing onto the HUD drum on each stroke. BD-U22 to BD-U25 are delivered
alternatives: Settings, Drumsticks picks Carved (BD-U20/21), Folk (BD-U22/24)
or Ceremonial (BD-U23/25).

[`design/image-deliveries.json`](design/image-deliveries.json) records the exact
generation and correction prompts, references, native image sizes, export sizes,
and sprite-sheet cells. Exports match the requested dimensions; larger canvases
are resampled from the generator's native output rather than generated at native
4K.

Both sisters are jointed puppets cut from their part sheets (BD-R01, BD-R02).
[`design/source/build_rigs.py`](design/source/build_rigs.py) holds each piece's
box, its pin hole and the parent pin it hangs on (measured from the painted pin
holes), and cuts the pieces into `game/assets/rigs/`. `src/rig.js` poses them.
On the palanquin they stand either side of the drum: Trắc's beater comes down
on the sun-star on each tùng, while her body leans in and her cape and sash
ribbons trail on springs. Nhị turns to face the drum, and on each cắc her near
stick whips down onto the rim while the far one flicks up. The strike angles in
`render/figures.js` (`PALANQUIN`) are solved by forward kinematics so the heads
land on the drum. The elephant and spearwoman sheets are not cut yet.

Over the HUD drum, the sisters' sticks can be seen close up (in the battle
chapters and in Drum Practice and Training; the sisters on the palanquin play
each command back with the replay instead of following the player's strokes): on a deep stroke
Trắc's beater comes down from the bottom left onto the sun-star, on a rim stroke
Nhị's stick, held up steeply from the bottom right, swings in sideways onto the
drum's far right edge, almost along the rim. The arms are mirrored from the art,
so the left of the drum shows a left hand and the right a right hand. Height above the drum is drawn as depth (a raised stick is larger, turned
up about the wrist, its shadow further below it). Each waits raised while the
strokes keep coming and drops away below the screen 0.8 s after its last one
(`closeSticks` in `render/hud.js`). With a controller or keys they land on the
sun-star and the right of the rim; a tap on the touch drum is struck where it
landed, and a rim tap on the left half brings Nhị's arm in from the left. The pair is chosen under Settings,
Drumsticks (`STICK_SETS`); all six sticks share one layout, and the drawn
stand-in remains for a missing image.

The manifest's `runtime` flag distinguishes the 123 images used by the game
from the 8 delivered sheets it does not use directly: six puppet part sheets
(four of them cut into the sisters' rigs, two for each style) and the glyph
and icon sheets. They remain available
for production work without being downloaded at game startup. The effects
sheets are in use: hits and deflections burst into the paper scraps (BD-F01,
picked by colour), the arrows and bolts fly as BD-F02, and when the drum wakes
its rings (BD-F03) spread from the drum.

The PNGs in `game/assets/art/` are the masters, kept at the requested sizes.
The game loads WebP copies scaled to the size it actually draws them at (14.0 MB
in all for both styles). Only these copies are published. After
delivering or replacing art, rerun
[`design/source/build_web_art.py`](design/source/build_web_art.py) and then
`build_requests.py`. The renderer also tints the painted parallax layers to
each chapter's light (dawn, day, night), because one set of layers serves all
three chapters.

Delivered art is integrated through [`intake/`](intake/README.md). For each image:

1. Put the file at the **File** path given in its request, under
   `game/assets/art/`. Direction pieces go under `design/references/`.
2. Set the request's `status` to `"delivered"` in `build_requests.py` and rerun
   the script.

The game then loads the image in place of its procedural stand-in. Stand-ins are
drawn by `game/src/render.js`.
