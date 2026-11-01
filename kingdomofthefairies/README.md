# Kingdom of the Fairies

A hand-tinted toy-theatre voyage inspired by Georges Méliès’s silent film
*Le Royaume des fées* (1903). Play at
https://hoai2k.github.io/mini/kingdomofthefairies/.

There are three editions, chosen by the address:

- **The default** (no parameter, `?widowsbay=off`, or any value but `on` or
  `partial`) is the film edition: the prince's story after Méliès, with a
  prologue and six acts and only the period accompaniment.
- **[`?widowsbay=partial`](https://hoai2k.github.io/mini/kingdomofthefairies/?widowsbay=partial)**
  is the original five-act game under the new title: no band, no song, and the
  sailor's guitar becomes a sword (its art and its words), with new art filling
  the gaps (`PARTIAL_CAST` in `src/theme.js`). It shares the improved climbing.
- **[`?widowsbay=on`](https://hoai2k.github.io/mini/kingdomofthefairies/?widowsbay=on)**
  restores the preserved Widow’s Bay title, Langan, Frost & Wane cast and song.

Acts open in order as they are finished. **`?edit=local`** (with any of the
above) opens a panel for this browser that sets how far each edition is
unlocked, independently, and can open every scene of the open acts
(`src/editor.js`).

Each edition keeps its own saves and settings; the legacy keys remain
compatible with existing saves.

## The editions' acts

The film edition (the default) follows the film's story
([the film adaptation plan](design/film-adaptation.md)): a prologue and six
acts. The first four keep their stage machinery and rules, recast:

0. Prologue, The Betrothal: a short playable scene on the delivered sets. The
   prince receives the fairies' gifts in the betrothal court, the witch curses
   it and she and her demons seize Azurine and fly off with her, he chases the demons' chariot along the rampart, and in the armoury the
   witch binds him. He struggles against her cords (any button or push of the
   stick) until Aurora glides on and breaks the spell; he takes up the helmet,
   shield and sword she gives him, each worn as a badge above his head until
   all three transform him into the armoured prince, and kneels while she
   glides off to the left before he goes to his ship. The fire on the
   rampart burns on: leap it, or each touch costs one of three lanterns, and
   losing all three starts the chase again. Each gift or arm he takes is held
   up big in the middle of the stage, or beside him when he stands there. B
   skips a scene; it leads straight into the Royal Crossing.
1. The Royal Crossing: the royal ship's voyage (the original ship), then the
   witch's tempest, a scene: the crew light the lanterns, she strikes the mast
   and the ship breaks on the rocks.
2. The Water Fairy: the sleepers' grotto; he swims to the Water Fairy for her
   blessing, and her dolphin carriage carries him on.
3. Neptune's Court: a walk through the lobster palace (bow, holding X, past
   its guards; leap with A for the pearls beyond), then the court's moving
   floors, watched by the scrying eye.
4. The Whale's Passage: through the whale to shore, where Aurora points the
   way through the cavern (a run through the dark, by Aurora's lamp).
5. The Enchanted Tower: the cliff, a dive from its edge, a swim across the sea gap in its painted
   sea, diving a little way under the surface from the witch's swoops, visibly reaching the far bank before the tower wall up to
   Azurine's window, where she watches for him all the climb.
6. The Burning Tower: the burning floors, carrying Azurine down to the right-hand exit as that side’s fires fade, the witch's
   last stand on the clifftop (leap her fire; after each sword blow she
   drives him back, sliding on his feet, and he approaches again), after which she hides in her barrel and he pushes it over, walking Azurine
   along the wedding street, jumping for joy with Azurine as the guests cheer in a ripple. Climb the painted stairs (the couple grow slightly smaller as they climb away) and walk through the doorway at their top into the apotheosis; holding left at its exit for one second leads back out to the guests. Jump into the light beneath Aurora to begin the credits. The witch’s disappearance holds for the opening of the victory flourish, then fades with its last chord into a gradual wedding entrance.
   Every scene is played: nothing is timed to the beat or shown as a still.

The final ascent slowly lifts the couple in the pose they jumped in and holds
them there: five seconds of sparkling celebration precede the 30-second credit
roll. Once the roll begins, any direction gently releases them to the ground
over three seconds. Keep walking, dancing and
travelling between the wedding street and the final tableau during and after
the credits. Returning outside begins with a short automatic stair descent,
so an immediate forward press cannot send you straight back inside. Each jump into Aurora’s light repeats the slow ascent and hold,
while the credits run only once. “Procession Royale” continues throughout,
and completion is saved before the roll.

The film cast, props and sets use the delivered production art; anything still
requested is drawn by an interim cut-out from the planning sheets (`assets/interim/`, `assets/tableaux/`, made by
`design/source/cut_planning.py`) until the production requests arrive.

[`?widowsbay=on`](https://hoai2k.github.io/mini/kingdomofthefairies/?widowsbay=on)
keeps the original five acts unchanged (and the default plays them without the band or guitar): The Crossing, The Sleepers' Grotto,
The Sea King's Court, The Whale's Road and The Enchanted Tower (cliff, burning
house, beloved, endings and pageant).

Every edition's climbs (the cliff, and the film edition's tower wall) are continuous: he
climbs anywhere on the painted cloth, fastest up ivy and the cracks between
blocks, steady over bare rock, slow over the cliff's wet cleft and under a
ledge's lip; pushing up into a ledge he hauls himself onto it, walks along
it, and lowers himself off; A springs a short way. The surfaces are read from
the cloths by `design/source/build_climb_map.py` into `src/acts/climb-map.js`
(rerun it if a cloth changes), and `src/acts/climb.js` is the climbing. The
original and partial editions keep their own cliff on it: the giant's boot,
lifting on the beat, is the only way over the overhanging lip, the tiny
guitarist's gap shelters from stones, and loose rock gives way if he lingers.

The retained sailor, guitar, rose bargain and alternate endings are adaptation
mechanics, not events in the film. For the complete original storyline and
character identities, start with [the film reference](design/film-story.md).
[The design](design/acts.md) maps that story to future updates;
[the film adaptation plan](design/film-adaptation.md) proposes the chapters to keep, recast, replace and add;
[the story appendix](design/story-appendix.md) records proposed extensions.

## Implementation

This is a static canvas 2D / Web Audio page, with no build step.

- `src/theme.js` selects the edition, filters legacy image/animation slots and
  the song before loading, and applies the document title and install metadata.
- `src/board.js` and `src/acts/` hold the seeded gameplay rules.
- `src/art.js` paints a monochrome print and an offset stencil-colour pass;
  film look settings reduce grain, scratches, flicker and gate weave.
- `src/audio.js` starts period recordings on the first user gesture in the
  default edition and switches by scene mood. The old song-first and reprise
  behavior remains in the query edition. Sound effects retain their recorded
  stage-foley and synthesized fallbacks. The 76.5 BPM gameplay clock stays fixed
  when the song is absent; the rubato period recordings do not drive it.
- `src/main.js`, `input.js`, `touch.js`, `fit.js` and `chrome.js` handle the shell,
  controllers, keyboard, landscape touch controls, fitting and fullscreen.
- `src/camera.js` is the mobile camera. On a phone (a touch screen no more
  than 600 CSS px on its short side) it eases in 1.3x toward the player
  once he has had a scene in hand for a moment, follows him, and eases back
  out to the whole stage for each scene's opening and close, cutscenes, the
  witch's and Aurora's passes (the sea gap stays whole) and endings. Only the
  act's stage is zoomed: the frame, HUD, captions, cards, menus and touch
  controls stay put. Desktops and tablets never zoom; Settings › Mobile
  camera (shown only on phones) turns it off. `?camera=phone` tries it on any
  screen, `?camera=off` turns it off.

Use arrows/WASD to move and Space/Z/J to act. Touch uses swipes for rows and a
floating stick for swimming/climbing. The game includes per-act instructions,
pause, scene select and checkpoints. Hull and pearl tuning is in
`src/game_config.js`.

## Art, sound and workbench

[Image requests and delivery](design/image-requests.md) describe the new title
and film storyboard; PNG originals are in `design/generated/fairies/`.
The existing scenic art remains shared, with modern band assets restricted to
the query edition. Historical requests, prompts and video reference are retained
under [design/legacy/](design/legacy/README.md) and existing generated galleries.
New documentation uses the full film, not the music-video edit, as its authority.

[The film planning gallery](design/references/film-planning/index.html) contains
the ten character sheets and twenty scene concepts for the proposed adaptation.
Source request briefs, named references and native originals are retained. These are design references; interim cut-outs from them remain only for assets whose production art has not arrived.

[The production artwork gallery](design/generated/film-production/index.html)
contains the film-edition sprites, props and sets, with native originals and
submitted prompts. [Image requests](design/image-requests.md) track delivery
status. The film edition draws these through its cast maps (`src/theme.js`
and each act's `cast`).

[The character audit](design/character-audit.md) compares the cast with the
film; its hand-tinted alternates (requests F8, all delivered) are the film
edition's default cast look; Settings › Cast look › Original (or
`?look=original`) returns to the first, cleaner art.

An optional menu ambience, `?crackle=on`, holds the score back until play and
fills the title, playbill, act cards and pause with an old record's crackle
(`sfx/record.mp3` from `build_sfx.py`, with a synthesized fallback in
`src/audio.js`). It is off by default; Widow's Bay never uses it.

[Music](design/music.md) describes the six delivered period tracks and their
scene moods. New effects use `design/source/build_sfx.py`; its key comes from
`ELEVENLABS_API_KEY` and must never be committed.

[The workbench](workbench/README.md), at
https://hoai2k.github.io/mini/kingdomofthefairies/workbench/, reviews every
cinematic with pause, scrub, stepping and copied moment links. Append
`?widowsbay=on` there to review the legacy cast.

Home-screen installation uses the new manifest and icons; the query edition
selects its preserved manifest/icons with `start_url: ./?widowsbay=on`.

## Checks and publication

From the repository root:

```sh
for e in widowsbay partial; do for t in board act2 act3 act4 act5; do KOTF_EDITION=$e node kingdomofthefairies/qa/$t.test.mjs; done; done
for t in animation sailor-motion walking theme assets-loader; do node kingdomofthefairies/qa/$t.test.mjs; done
KOTF_EDITION=film node kingdomofthefairies/qa/film.test.mjs
for g in build_act_requests build_film_requests build_film_assets; do python3 kingdomofthefairies/design/source/$g.py --check; done
CHROMIUM_PATH=/usr/bin/chromium node kingdomofthefairies/qa/theme-browser.mjs
CHROMIUM_PATH=/usr/bin/chromium node kingdomofthefairies/qa/walking-browser.mjs
CHROMIUM_PATH=/usr/bin/chromium node kingdomofthefairies/qa/movement-browser.mjs
python3 kingdomofthefairies/design/source/audit_sprites.py --check   # after any art delivery; needs Pillow, numpy, OpenCV
python3 kingdomofthefairies/design/source/build_climb_map.py --check  # after a climbing cloth changes; needs Pillow
python3 kingdomofthefairies/design/source/person_sizes.py --check    # after any cast delivery (Azurine, Aurora, the witch, demons, fairies...); rerun without --check to re-measure
kingdomofthefairies/publish.sh local/pages/kingdomofthefairies
```

`?qa` exposes the shell as `window.__kingdomOfTheFairies` (and the compatible
`window.__widowsBay` alias). GitHub Pages publishes the renamed directory;
the repository game index and workflow point to it.

The [coast and artwork audit](design/reviews/coast-cleanup/README.md) records the
registered channel swim, natural rockfall particles and delivered-art checks.
Failed scenery downloads keep the game on its loading card with a reload
instruction instead of entering gameplay with substitute drawings.
