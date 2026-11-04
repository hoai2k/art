# Stratford prototype: handoff and current state

Read this first when resuming work on `stratford/` in a new session. It
records where things stand, what is in flight, and what the owner is waiting
on. Keep it current: update it at the end of every task.

Last updated: 2026-11-04.

## Where things stand

- Live at https://games.hoai.net/art/stratford/prototype/ (no library card and
  no `/art/stratford/` page, on the owner's instruction, until the game proper).
  Last deploy: `main` = `deploy` = `e828835`.
- Working branch for this line of work: `claude/youthful-mendel-d8dqgj`.
- Contracts: [`ARCHITECTURE.md`](ARCHITECTURE.md). Layout and checks:
  [`../README.md`](../README.md). Creatures: [`squirrel.md`](squirrel.md).
  Images: [`image-requests.md`](image-requests.md). Sounds:
  [`sound-requests.md`](sound-requests.md). Facade survey:
  [`reference/mapillary-survey.md`](reference/mapillary-survey.md). Landmark
  notes: [`reference/town-notes.md`](reference/town-notes.md).

What the game has, all live:

- The streaming town (200 m chunks, LOD, per-chunk BVH colliders, detail
  layers by creature scale) from OSM + NRCan LiDAR (`game/data/`).
- Building fronts modelled in 3D from the facade kit, driven by a Mapillary
  survey (`game/data/facades.json`, 175 buildings) where one exists; City Hall,
  Courthouse, Avon Theatre, Festival and Tom Patterson theatres, churches.
- Ground: textures at realistic scale, three tiers of ground detail (leaves
  that scatter, piles that burst, debris, grates, puddles), drawn ground and
  collider surface ids agree (a probe test guards it).
- Five playable creatures (squirrel, beaver, rabbit, swan, heron) from
  reference sheets; swim, dive, wade and fly modes; creature select (pause or
  Settings); LT / Q superspeed (10×).
- Follow camera (LB/RB zoom), a raised touch camera, full phone/tablet touch
  controls (drag to look, tap to show a stick and jump/fly button).
- Recorded sounds (ElevenLabs) with surface-aware footsteps, creature sounds,
  ambient beds placed by area; `?sounds=1` shows a log of each sound playing.

## In flight when this was written (not yet merged or deployed)

**Residential realism pass**, started 2026-11-04 after the owner said
Elizabeth Street doesn't look realistic. Work in progress is committed to the
working branch only (snapshot commits), NOT on `main`. Scope:

1. Trees: a real species mix by setting (maples, oaks, lindens, honey locust,
   ash, spruce, pine; willows only by water), mid-October colour spread with
   many still green or yellow, clumped crowns with visible branches.
2. House heights inflated by tree canopy in the LiDAR (e.g. a 3-storey
   flat-roofed slab among 1.5-storey houses on Elizabeth Street): corrected in
   code, not in `data/`.
3. A richer house generator (`src/town/houses.js`, `housegeo.js`, `lots.js`):
   Ontario Gothic, Italianate, Queen Anne, workers' cottages, foursquares,
   bungalows; porches, dormers, bays, steps, driveways, garages, fences,
   hedges, gardens.
4. Curb-return glitches (stretched curb texture, a dark wedge at corners).
5. If time: downtown dressing (invented generic shop signs, never real
   business names; hanging baskets; lit shop windows; cornice variety).

To resume: check what's in `src/town/` on the working branch, run every check
(below), compare Elizabeth Street with the "before" renders (lab bench
positions on the Elizabeth Street road at 15 % and 75 % along at 1.6 m, and
from 18 m above at 30 %), then merge to `main` and deploy.

**Image requests round 12** (linden and honey-locust leaf clusters) were
written by that pass and pushed to `main` with this handoff.

## Waiting on the owner

- **Photos of Elizabeth Street** (offered 2026-11-04): one front-on photo per
  house from across the street, geotagged or with the house number; a few
  along-street views; dropped in `stratford/intake/`. Only 2 of its 59 houses
  are in the Mapillary survey (summer trees hide them). Record each house in
  `game/data/facades.json` (same schema as the survey, `roof`/`roof_colour`
  for houses) and the photos themselves may be committed to `reference/`
  (crop faces and plates).
- **Photos of Market Square and downtown fronts** (York Street especially):
  the square's interior is unsurveyed (no post-2019 Mapillary frames).
- **Image round 12** to generate.

## Secrets (never commit, never print)

Kept outside Git in `/home/user/art/local/secrets/` on the session machine;
a new container won't have them:

- `mapillary_token` (read-only Mapillary client token).
- `elevenlabs_key` (ElevenLabs sound-generation key).

The owner pasted both into the chat, so they should be regenerated when the
work is done. In a new container, ask the owner to add them as environment
variables `MAPILLARY_TOKEN` and `ELEVENLABS_API_KEY` in the cloud
environment's settings rather than pasting them again. Tools read the key from
the environment (`tools/sfx/generate.py`) or the token file (survey scripts).

## Checks (run all before merging)

```bash
cd stratford/prototype/game/test && node --test --test-concurrency=1 shell.test.mjs town-data.test.mjs squirrel.test.mjs creatures.test.mjs audio.test.mjs town.test.mjs touch.test.mjs publish.test.mjs
```

```bash
node stratford/prototype/game/scripts/browser-check.mjs
```

```bash
python3 stratford/prototype/tools/build_web.py --check
```

Software WebGL draws the real town at seconds per frame: run long checks in
the background. After deploying, load each creature from the live site (the
publish copy once lacked four creatures' models; `publish.test.mjs` now
guards that).

## Known issues and notes

- Kingdom of the Fairies' `partial` edition act2–act4 qa checks failed on
  `main` on 2026-11-04 from another session's Kingdom work (not Stratford).
- One Huron Street bridge abutment spot may still have an open edge under a
  path (the ground probe tolerates 1 in 1,000 points).
- Sound: the chickadee's first takes sounded like a person singing
  "dee-dee-dee"; replaced with owner-approved takes 1 and 3. If the owner
  reports another odd sound, `?sounds=1` names it.
- Deploys: `CLAUDE.md` deploy state is ENABLED; deploy with
  `git push origin main:deploy` after merging, then verify the live page.
