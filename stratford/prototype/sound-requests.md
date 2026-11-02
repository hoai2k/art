# Stratford prototype: sound requests

Sound effects and ambience for the prototype, to be generated with ElevenLabs'
sound-effects API (the same approach as the Wobblers in `swingers`:
`wobblers/dev/sfx/`). Every sound has a synthesized stand-in in
`game/src/audio.js`, so nothing here blocks play; a delivered sound replaces
its stand-in.

- **Generation:** `tools/sfx/generate.py` reads `tools/sfx/sfx.json` (one entry
  per sound: name, prompt, duration, how many takes, loop or one-shot) and
  writes the originals to `game/assets/sfx/originals/` (kept, not published)
  and processed copies to `game/web/sfx/` (trimmed, normalised, Ogg/MP3) plus
  `game/web/sfx/index.json`, which the game loads. The API key is read from the
  environment variable `ELEVENLABS_API_KEY` and never written to a file.
- **One-shots** (footsteps, calls, splashes) get 3–6 takes each, so repeats
  don't sound mechanical; the game picks one at random with small pitch and
  volume variation.
- **Ambient loops need the owner's ear first.** Generated loops often have
  seams or odd events. They're made with `hold: true`, which keeps them out of
  the game, and the owner hears a preview that plays the loop twice across its
  seam before they go in.
- **Style:** natural, close-miked, clean, no music, no voices or speech, no
  traffic horns or sirens. Autumn in a small Ontario town.

Status key: `open`, `held` (generated, waiting for the owner's ear),
`delivered`, `dropped`.

## Round S1: the creatures

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `squirrel_step_pavement` | one-shot | 6 | A single quick patter of a squirrel's four small feet landing on concrete pavement, light claw clicks, very short, close up | `open` |
| `squirrel_step_leaves` | one-shot | 6 | A squirrel bounding once through dry fallen autumn leaves, a quick crisp rustle, very short, close up | `open` |
| `squirrel_step_grass` | one-shot | 4 | A squirrel's light bound on short lawn grass, soft and quiet, very short | `open` |
| `squirrel_climb_bark` | one-shot | 6 | Sharp little claws scrabbling up rough tree bark, a quick burst, close up | `open` |
| `squirrel_climb_brick` | one-shot | 4 | Tiny claws scratching quickly on old brick, a short scrabble | `open` |
| `squirrel_land` | one-shot | 4 | A small animal landing softly from a jump onto pavement, a light thump with a claw click | `open` |
| `squirrel_chatter` | one-shot | 4 | An eastern grey squirrel's scolding alarm call: rapid chattering "kuk-kuk-kuk" with a raspy ending, natural recording | `open` |
| `squirrel_eat` | one-shot | 3 | A squirrel gnawing quickly on an acorn shell, tiny crunching and scraping, close up | `open` |
| `squirrel_dig` | one-shot | 4 | Small paws digging quickly in soft soil and leaf litter, a short flurry | `open` |
| `leaf_pile_burst` | one-shot | 4 | Something small diving into a pile of dry autumn leaves, a big crisp whoosh and rustle settling down | `open` |
| `beaver_step` | one-shot | 4 | A heavy-bodied beaver waddling one step on damp ground, a soft padded thud with a slight wet squelch | `open` |
| `beaver_tail_slap` | one-shot | 3 | A beaver slapping its broad tail on the surface of a calm river, a loud flat smack and splash echoing across the water | `open` |
| `beaver_gnaw` | one-shot | 4 | A beaver gnawing wood with its big incisors, rapid rasping and chipping of wood fibres, close up | `open` |
| `rabbit_hop` | one-shot | 6 | A rabbit's single soft hop landing on grass, a muffled double thump, very short | `open` |
| `rabbit_thump` | one-shot | 3 | A rabbit thumping its hind foot on the ground in warning, one sharp low thump | `open` |
| `swan_hiss` | one-shot | 3 | A mute swan's angry hiss, a long breathy rasping hiss, natural recording | `open` |
| `swan_wingbeat` | one-shot | 4 | A single powerful wingbeat of a large swan in flight, the distinctive throbbing whistle of mute swan wings, close up | `open` |
| `swan_takeoff` | one-shot | 2 | A large swan running across water to take off: feet slapping the water surface rhythmically while wings beat heavily, building up, about 3 seconds | `open` |
| `swan_land_water` | one-shot | 3 | A large swan landing on a calm river, a long skiing splash that settles into small ripples | `open` |
| `heron_call` | one-shot | 3 | A great blue heron's harsh croaking call, a deep hoarse "frahnk", natural recording | `open` |
| `heron_wingbeat` | one-shot | 4 | A single slow deep wingbeat of a large heron, a soft whoosh, close up | `open` |
| `heron_wade` | one-shot | 4 | A long-legged bird lifting a foot and stepping slowly in shallow water, a quiet drip and gentle slosh | `open` |
| `swim_paddle` | one-shot | 4 | A small animal paddling at the surface of calm water, soft rhythmic little splashes | `open` |
| `dive` | one-shot | 3 | An animal diving under calm river water, a short plunge and bubbling | `open` |
| `surface` | one-shot | 3 | An animal surfacing from under water, a gentle splash and a short exhale | `open` |
| `underwater` | loop | 1 | Muffled underwater ambience in a slow river, low rumble and faint bubbles, seamless loop, 20 seconds | `open` (hold) |
| `nut_pickup` | one-shot | 3 | Picking up an acorn from leaves, a tiny rustle and a little click | `open` |

## Round S2: the town

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `amb_downtown` | loop | 2 | A quiet small-town main street in autumn afternoon: occasional distant cars passing slowly, far-off footsteps and murmur with no clear words, birds, a light breeze in trees; no horns, sirens or music; seamless loop, 30 seconds | `open` (hold) |
| `amb_park_trees` | loop | 2 | A park on a calm October afternoon: wind gently moving through maple trees with dry leaves rustling, chickadees and a blue jay in the distance, seamless loop, 30 seconds | `open` (hold) |
| `amb_river` | loop | 2 | Beside a slow river in a town park: gentle lapping at the bank, ducks and geese far off, wind in willows, seamless loop, 30 seconds | `open` (hold) |
| `amb_weir` | loop | 1 | A small river dam with water spilling over a low weir, a steady soft roar and splash, seamless loop, 20 seconds | `open` (hold) |
| `amb_residential` | loop | 1 | A quiet residential street in autumn: wind in the trees, a dog barking once far away, a screen door, birds; seamless loop, 30 seconds | `open` (hold) |
| `city_hall_bell` | one-shot | 2 | A large tower clock bell striking the hour once, deep bronze tone with a long decay, heard from a little distance in a town square | `open` |
| `wind_gust` | one-shot | 4 | A gust of autumn wind sweeping through trees and blowing dry leaves along a street | `open` |
| `car_pass` | one-shot | 4 | A single car passing slowly along a town street at 30 km/h, heard from the sidewalk, tyres on asphalt, no horn | `open` |
| `geese_overhead` | one-shot | 2 | A flock of Canada geese honking as they fly overhead and fade into the distance | `open` |
| `crow_call` | one-shot | 3 | An American crow cawing two or three times from a tree | `open` |
| `bluejay_call` | one-shot | 3 | A blue jay's loud "jay jay" call from a tree | `open` |
| `chickadee_call` | one-shot | 3 | A black-capped chickadee singing "chick-a-dee-dee-dee" nearby | `open` |

## Round S3: discoveries and interface

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `discover` | one-shot | 3 | A gentle warm two-note chime like a small hand bell and a soft wooden marimba together, pleasant and quiet, 1.5 seconds | `open` |
| `ui_move` | one-shot | 2 | A very soft short wooden tick, like a pencil tapping paper, for moving through a menu | `open` |
| `ui_confirm` | one-shot | 2 | A soft warm wooden click with a tiny bell tone, for confirming a menu choice | `open` |
| `ui_back` | one-shot | 2 | A soft muted paper rustle, for closing a menu | `open` |
| `map_open` | one-shot | 2 | A sheet of old parchment being unfolded, crisp paper sound, 1 second | `open` |
| `creature_switch` | one-shot | 2 | A soft magical whoosh of autumn leaves swirling and settling, 1.5 seconds | `open` |
