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
- **Ambient beds** (approved by the owner) are placed by area in the town by `src/ambience-zones.js` and played as crossfading beds by `src/audio.js`. `amb_river_flow` (the Avon below the dam) plays its two approved takes there.
- **Held loops** are previewed in the scratchpad's `sfx-previews/<name>-<take>-seam.mp3` (each loop
  played twice across its crossfade). To approve one, delete its `"hold": true` in
  `tools/sfx/sfx.json` and run `python3 tools/sfx/generate.py --no-generate`: it is processed into
  `game/web/sfx/` and listed in `index.json` (`_loops`), and `src/audio.js` then plays it as a bed.
- **Skipped takes:** `rabbit_hop` take 2 is near-silent, so it stays an original and is left out of
  `web/` (`skip` in `sfx.json`).
- **Style:** natural, close-miked, clean, no music, no voices or speech, no
  traffic horns or sirens. Autumn in a small Ontario town.

Status key: `open`, `held` (generated, waiting for the owner's ear),
`delivered`, `library` (generated and kept for later, not in the game), `dropped`.

## Round S1: the creatures

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `squirrel_step_pavement` | one-shot | 6 | A single quick patter of a squirrel's four small feet landing on concrete pavement, light claw clicks, very short, close up | `delivered` |
| `squirrel_step_leaves` | one-shot | 6 | A squirrel bounding once through dry fallen autumn leaves, a quick crisp rustle, very short, close up | `delivered` |
| `squirrel_step_grass` | one-shot | 4 | A squirrel's light bound on short lawn grass, soft and quiet, very short | `delivered` |
| `squirrel_climb_bark` | one-shot | 6 | Sharp little claws scrabbling up rough tree bark, a quick burst, close up | `delivered` |
| `squirrel_climb_brick` | one-shot | 4 | Tiny claws scratching quickly on old brick, a short scrabble | `delivered` |
| `squirrel_land` | one-shot | 4 | A small animal landing softly from a jump onto pavement, a light thump with a claw click | `delivered` |
| `squirrel_chatter` | one-shot | 4 | An eastern grey squirrel's scolding alarm call: rapid chattering "kuk-kuk-kuk" with a raspy ending, natural recording | `delivered` |
| `squirrel_eat` | one-shot | 3 | A squirrel gnawing quickly on an acorn shell, tiny crunching and scraping, close up | `delivered` |
| `squirrel_dig` | one-shot | 4 | Small paws digging quickly in soft soil and leaf litter, a short flurry | `delivered` |
| `leaf_pile_burst` | one-shot | 4 | Something small diving into a pile of dry autumn leaves, a big crisp whoosh and rustle settling down | `delivered` |
| `beaver_step` | one-shot | 4 | A heavy-bodied beaver waddling one step on damp ground, a soft padded thud with a slight wet squelch | `delivered` |
| `beaver_tail_slap` | one-shot | 3 | A beaver slapping its broad tail on the surface of a calm river, a loud flat smack and splash echoing across the water | `delivered` |
| `beaver_gnaw` | one-shot | 4 | A beaver gnawing wood with its big incisors, rapid rasping and chipping of wood fibres, close up | `delivered` |
| `rabbit_hop` | one-shot | 6 | A rabbit's single soft hop landing on grass, a muffled double thump, very short | `delivered` |
| `rabbit_thump` | one-shot | 3 | A rabbit thumping its hind foot on the ground in warning, one sharp low thump | `delivered` |
| `swan_hiss` | one-shot | 3 | A mute swan's angry hiss, a long breathy rasping hiss, natural recording | `delivered` |
| `swan_wingbeat` | one-shot | 4 | A single powerful wingbeat of a large swan in flight, the distinctive throbbing whistle of mute swan wings, close up | `delivered` |
| `swan_takeoff` | one-shot | 2 | A large swan running across water to take off: feet slapping the water surface rhythmically while wings beat heavily, building up, about 3 seconds | `delivered` |
| `swan_land_water` | one-shot | 3 | A large swan landing on a calm river, a long skiing splash that settles into small ripples | `delivered` |
| `heron_call` | one-shot | 3 | A great blue heron's harsh croaking call, a deep hoarse "frahnk", natural recording | `delivered` |
| `heron_wingbeat` | one-shot | 4 | A single slow deep wingbeat of a large heron, a soft whoosh, close up | `delivered` |
| `heron_wade` | one-shot | 4 | A long-legged bird lifting a foot and stepping slowly in shallow water, a quiet drip and gentle slosh | `delivered` |
| `swim_paddle` | one-shot | 4 | A small animal paddling at the surface of calm water, soft rhythmic little splashes | `delivered` |
| `dive` | one-shot | 3 | An animal diving under calm river water, a short plunge and bubbling | `delivered` |
| `surface` | one-shot | 3 | An animal surfacing from under water, a gentle splash and a short exhale | `delivered` |
| `underwater` | loop | 1 | Muffled underwater ambience in a slow river, low rumble and faint bubbles, seamless loop, 20 seconds | `delivered` |
| `nut_pickup` | one-shot | 3 | Picking up an acorn from leaves, a tiny rustle and a little click | `delivered` |

## Round S2: the town

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `amb_downtown` | loop | 2 | A quiet small-town main street in autumn afternoon: occasional distant cars passing slowly, far-off footsteps and murmur with no clear words, birds, a light breeze in trees; no horns, sirens or music; seamless loop, 30 seconds | `delivered` |
| `amb_park_trees` | loop | 2 | A park on a calm October afternoon: wind gently moving through maple trees with dry leaves rustling, chickadees and a blue jay in the distance, seamless loop, 30 seconds | `delivered` |
| `amb_waterfowl_busy` | loop | 1 | A river lake shore busy with waterfowl: a great many ducks and geese quacking and honking close by, water lapping, wings splashing, seamless loop, 30 seconds (the owner's take `amb_river-1`: only where waterfowl gather) | `delivered` |
| `amb_pond_waterfowl` | loop | 1 | A quiet pond or calm lake with a few waterfowl on it: occasional soft duck quacks and geese far off, gentle lapping at the bank, seamless loop, 30 seconds (the owner's take `amb_river-2`) | `delivered` |
| `amb_river_flow` | loop | 2 | A slow small river flowing past grassy banks under willows: gentle continuous water movement and soft gurgles over stones, no birds, no ducks, no voices, seamless loop, 30 seconds | `delivered` |
| `amb_weir` | loop | 1 | A small river dam with water spilling over a low weir, a steady soft roar and splash, seamless loop, 20 seconds | `delivered` |
| `amb_residential` | loop | 1 | A quiet residential street in autumn: wind in the trees, a dog barking once far away, a screen door, birds; seamless loop, 30 seconds | `delivered` |
| `city_hall_bell` | one-shot | 2 | A large tower clock bell striking the hour once, deep bronze tone with a long decay, heard from a little distance in a town square | `delivered` |
| `wind_gust` | one-shot | 4 | A gust of autumn wind sweeping through trees and blowing dry leaves along a street | `delivered` |
| `car_pass` | one-shot | 4 | A single car passing slowly along a town street at 30 km/h, heard from the sidewalk, tyres on asphalt, no horn | `delivered` |
| `geese_overhead` | one-shot | 2 | A flock of Canada geese honking as they fly overhead and fade into the distance | `delivered` |
| `crow_call` | one-shot | 3 | An American crow cawing two or three times from a tree | `delivered` |
| `bluejay_call` | one-shot | 3 | A blue jay's loud "jay jay" call from a tree | `delivered` |
| `chickadee_call` | one-shot | 3 | Field recording of a real black-capped chickadee: a quick high thin "chick" then fast buzzy bird notes, no human voice (the first takes sounded like a person singing "dee-dee-dee" and were removed; of the new takes the owner approved 1 and 3) | `delivered` |

## Round S3: discoveries and interface

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `discover` | one-shot | 3 | A gentle warm two-note chime like a small hand bell and a soft wooden marimba together, pleasant and quiet, 1.5 seconds | `delivered` |
| `ui_move` | one-shot | 2 | A very soft short wooden tick, like a pencil tapping paper, for moving through a menu | `delivered` |
| `ui_confirm` | one-shot | 2 | A soft warm wooden click with a tiny bell tone, for confirming a menu choice | `delivered` |
| `ui_back` | one-shot | 2 | A soft muted paper rustle, for closing a menu | `delivered` |
| `map_open` | one-shot | 2 | A sheet of old parchment being unfolded, crisp paper sound, 1 second | `delivered` |
| `creature_switch` | one-shot | 2 | A soft magical whoosh of autumn leaves swirling and settling, 1.5 seconds | `delivered` |

## Round S4: library for later

Generated for later games and kept only as originals in `game/assets/sfx/library/` (in Git, never published, not processed, not loaded). Loops are `hold: true`; sounds are short and at most 2 takes.

| Name | Kind | Takes | Prompt | Status |
|---|---|---|---|---|
| `amb_cafe_interior` | loop | 1 | Inside a busy small-town cafe: soft indistinct murmur of many people with no intelligible words, cups clinking on saucers, cutlery on plates, an espresso machine hissing now and then, seamless loop, about 12 seconds | `library` |
| `amb_cafe_patio` | loop | 1 | An outdoor cafe patio on a mild day: low murmur of a few people with no intelligible words, cutlery and cups, a distant street behind, seamless loop, about 12 seconds | `library` |
| `amb_theatre_crowd` | loop | 1 | A festival theatre foyer before a show: a large crowd murmuring with no intelligible words, shuffling feet, an excited low hum, seamless loop, about 12 seconds | `library` |
| `theatre_applause` | one-shot | 2 | Applause of a seated audience heard from inside a theatre, swelling and fading, with a few distant cheers, no speech | `library` |
| `theatre_chimes` | one-shot | 2 | Soft theatre intermission chimes, three rising notes on a chime bar, in a hall with gentle reverb | `library` |
| `amb_farmers_market` | loop | 1 | A farmers market on a morning: busy crowd murmur with no intelligible words, paper bags rustling, a cash box clink, outdoor air, seamless loop, about 12 seconds | `library` |
| `busker_fiddle` | one-shot | 2 | A street busker playing a lively folk fiddle far down a street, distant and thin, wandering notes with no recognisable tune | `library` |
| `kids_park` | loop | 1 | Children playing in a park at a distance: happy shrieks and laughter with no words, swings creaking, seamless loop, about 12 seconds | `library` |
| `dog_bark` | one-shot | 2 | A medium dog barking three times in a backyard, a little distant, natural recording | `library` |
| `bicycle_bell` | one-shot | 2 | A single bright ring of a bicycle bell, ding-ding, outdoors | `library` |
| `footsteps_sidewalk` | one-shot | 2 | Two or three passers-by walking on a concrete sidewalk, footsteps approaching and passing, shoes only, no voices | `library` |
| `door_shop_bell` | one-shot | 2 | A shop door opening with a small brass bell jingling above it, then closing | `library` |
| `construction_far` | loop | 1 | A construction site far away: faint rhythmic hammering, a distant machine engine and a reversing beeper, muffled by distance, seamless loop, about 12 seconds | `library` |
| `lawnmower_far` | loop | 1 | A petrol lawn mower running far away in a suburban yard, steady drone, muffled by distance, seamless loop, about 12 seconds | `library` |
| `leaf_blower` | loop | 1 | A leaf blower running at moderate distance, steady whine and roar, seamless loop, about 10 seconds | `library` |
| `rain_leaves` | loop | 1 | Gentle autumn rain falling on dry leaves and trees, steady patter, seamless loop, about 12 seconds | `library` |
| `thunder_roll` | one-shot | 2 | A long low rolling thunder in the distance, rumbling and fading, no rain | `library` |
| `rain_gutter` | loop | 1 | Rain running down a metal gutter and downspout, trickling and gurgling, seamless loop, about 10 seconds | `library` |
| `wind_night` | loop | 1 | Soft wind at night in bare trees, a lonely low breeze, a faint creak, seamless loop, about 12 seconds | `library` |
| `crickets_dusk` | loop | 1 | Field crickets chirping at dusk on a warm evening, steady and calm, seamless loop, about 12 seconds | `library` |
| `frogs_river` | loop | 1 | Frogs calling by a river at evening: green frogs plucking and spring peepers, seamless loop, about 12 seconds | `library` |
| `owl_night` | one-shot | 2 | A great horned owl hooting its low "hoo hoo-hoo hoo hoo" at night, natural recording | `library` |
| `woodpecker_drum` | one-shot | 2 | A downy woodpecker drumming rapidly on a dead tree trunk, echoing in the woods | `library` |
| `robin_song` | one-shot | 2 | An American robin singing its cheerful caroling song from a branch, natural recording | `library` |
| `cardinal_song` | one-shot | 2 | A northern cardinal singing bright clear whistles "cheer cheer cheer", natural recording | `library` |
| `mourning_dove` | one-shot | 2 | A mourning dove cooing its soft mournful "coo-OO-oo, oo, oo", natural recording | `library` |
| `redwinged_blackbird` | one-shot | 2 | A red-winged blackbird singing its "conk-la-ree" song from a reed, natural recording | `library` |
| `mallard_quack` | one-shot | 2 | Mallard ducks quacking, a few hen quacks on a river, natural recording | `library` |
| `kingfisher_rattle` | one-shot | 2 | A belted kingfisher flying along a river giving its dry rattling call, natural recording | `library` |
| `train_horn` | one-shot | 2 | A distant freight train sounding its horn, two long blasts and a short and a long, heard from a mile away, rural Ontario | `library` |
| `train_freight_pass` | one-shot | 2 | A long freight train passing at a level crossing: steady rumble, rhythmic wheel clacks, couplings, no horn | `library` |
| `church_carillon` | one-shot | 2 | A church carillon of bronze bells ringing a slow hymn-like pattern with no recognisable tune, from across a town, long decay | `library` |
| `bee_buzz` | one-shot | 2 | A honey bee buzzing steadily close to the ear and flying past | `library` |
| `bumblebee_buzz` | one-shot | 2 | A big bumblebee buzzing low and loud, close up, hovering then flying away | `library` |
| `fly_buzz` | one-shot | 2 | A housefly buzzing erratically close up, circling and landing | `library` |
| `mosquito_whine` | one-shot | 2 | A mosquito whining thin and high near the ear, close up | `library` |
| `cicadas` | loop | 1 | Cicadas droning in tall trees on a hot summer day, rising and falling pulsing drone, seamless loop, about 12 seconds | `library` |
| `grasshopper_clicks` | one-shot | 2 | Grasshoppers clicking and ticking in dry grass, a few close, natural recording | `library` |
| `ant_world_steps` | one-shot | 2 | Tiny scale: very small quick footsteps and scratching of an ant on dry leaves, ultra close macro recording | `library` |
| `splash_small` | one-shot | 2 | A small stone plopping into calm river water, one clean plop with ripples | `library` |
| `splash_big` | one-shot | 2 | A big heavy splash of something large dropping into a river, a loud deep splash and water falling back | `library` |
| `fish_jump` | one-shot | 2 | A fish leaping out of a river and splashing back, a quick flap and plop | `library` |
| `oars_avon` | one-shot | 2 | Wooden oars of a rowboat creaking in oarlocks and dipping into a calm river, slow rhythmic strokes, water dripping | `library` |
| `pedal_boat` | loop | 1 | A pedal boat on a lake: plastic paddle wheel churning water rhythmically, gentle slapping on the hull, seamless loop, about 10 seconds | `library` |
